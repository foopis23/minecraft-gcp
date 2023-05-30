import { Command, CommandType, InteractionCallbackType } from "./types";
import { computeInstancesClient, pubsubClient } from "./gcp";
import { env } from "./env/runtime";

export const commands = [
	{
		command: {
			name: "start",
			type: CommandType.CHAT_INPUT,
			description: "Starts the minecraft server!"
		},
		handler: async (interaction, req, res) => {
			await pubsubClient
				.topic(env.GCPUB_START_TOPIC)
				.publishMessage(
					{
						data: Buffer.from(
							JSON.stringify({
								interactionId: interaction.id,
								interactionToken: interaction.token,
								project: env.GCP_PROJECT_ID,
								zone: env.GCE_ZONE,
								instance: env.GCE_INSTANCE_NAME
							})
						)
					}
				);

			return {
				type: InteractionCallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: `Starting Minecraft Server...`
				}
			}
		}
	},
	{
		command: {
			name: "stop",
			type: CommandType.CHAT_INPUT,
			description: "Stops the minecraft server!"
		},
		handler: async (interaction, req, res) => {
			await computeInstancesClient.stop({
				project: env.GCP_PROJECT_ID,
				zone: env.GCE_ZONE,
				instance: env.GCE_INSTANCE_NAME,
			});

			return {
				type: InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: "Stopped Minecraft Server"
				}
			}
		}
	}
] satisfies Command[];
