import * as functions from '@google-cloud/functions-framework';
import * as nacl from 'tweetnacl';
import { HTTPError, InteractionCallbackType, InteractionType, interactionSchema, startMinecraftServerEventSchema } from './types';
import { commands } from './commands';
import { computeInstancesClient } from './gcp';
import { ZoneOperationsClient } from '@google-cloud/compute';
import { env } from './env/runtime';

function authorize(req: functions.Request, res: functions.Response) {
	const signature = req.get('X-Signature-Ed25519');
	const timestamp = req.get('X-Signature-Timestamp')

	if (!signature || !timestamp || !req.rawBody) {
		throw new HTTPError(401, 'Unauthorized');
	}

	const isVerified = nacl.sign.detached.verify(
		Buffer.from(timestamp + req.rawBody),
		Buffer.from(signature, 'hex'),
		Buffer.from(env.DISCORD_PUBLIC_KEY, 'hex')
	);

	if (!isVerified) {
		throw new HTTPError(401, 'Unauthorized');
	}
}

functions.http('interactions', (req, res) => {
	try {
		// method validation
		if (req.method !== 'POST') {
			res.status(405).send('Method Not Allowed');
			return;
		}

		// authorize request
		authorize(req, res);

		// validate input
		const parseResults = interactionSchema.safeParse(req.body);
		if (!parseResults.success) {
			res.status(400).send('Bad Request');
			return;
		}
		const interaction = parseResults.data;

		if (interaction.type !== 1 && interaction.type !== 2) {
			res.status(400).send('Bad Request');
			return;
		}

		// handle interaction types
		switch (interaction.type) {
			case InteractionType.PING:
				res.json({
					type: 1,
				});
				return;
			case InteractionType.APPLICATION_COMMAND:
				const command = commands.find(c => c.command.name === interaction.data?.name);
				if (!command) {
					res.json({
						type: 4,
						data: {
							content: "Missing command handler... this shouldn't happen",
						}
					});
					return;
				}
				command.handler(interaction, req, res)
					.then(response => res.json(response));
				return;
			default:
				res.status(400).send('Bad Request');
		}
	} catch (e) {
		if (e instanceof HTTPError) {
			res.status(e.code).send(e.message);
			return;
		}
		throw e;
	}
});

functions.cloudEvent<{ message: { data: string } }>('minecraft-server-start', async (event) => {
	if (event.data === undefined) {
		throw new Error('Missing event data');
	}

	const { interactionToken, project, zone, instance } =
		startMinecraftServerEventSchema.parse(
			JSON.parse(
				Buffer.from(event.data.message.data, 'base64').toString()
			)
		);

	// start instance
	const [response] = await computeInstancesClient.start({
		project,
		zone,
		instance,
	});

	// wait for instance to start
	const operationsClient = new ZoneOperationsClient();
	let done = response.latestResponse.done;
	while (done) {
		done = (await operationsClient.wait({
			operation: response.latestResponse.name,
			project: project,
			zone: zone
		}))[0].status === "DONE";
	}

	// wait for network to be ready
	//! This is kind of a hack... but I'm not sure how to do this properly..
	let retryCount = 0;
	let ip;
	while (retryCount < 5) {
		// wait 1 second
		await new Promise(resolve => setTimeout(resolve, 1000));

		// get ip address of instance
		const [instanceResponse] = await computeInstancesClient.get({
			project,
			zone,
			instance,
		});
		ip = instanceResponse.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP;
		if (ip) {
			break;
		}
	}

	// send follow up
	const followUpResponse = await fetch(`https://discord.com/api/v9/webhooks/${env.DISCORD_APPLICATION_ID}/${interactionToken}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			content: `Minecraft Server Started! Connect with \`${ip}\``,
		})
	});

	if (!followUpResponse.ok) {
		throw new Error(`Failed to send follow up message: ${followUpResponse.status} ${followUpResponse.statusText}\n${await followUpResponse.text()}`)
	}
});
