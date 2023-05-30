import { commands } from "./commands";
import { Command } from "./types";

import { env } from "./env/deploy";

(async function () {
	const url = `https://discordapp.com/api/v9/applications/${env.DISCORD_APPLICATION_ID}/guilds/${env.DISCORD_GUILD_ID}/commands`

	const currentCommands = await (await fetch(url, {
		method: "GET",
		headers: {
			"Authorization": `Bot ${env.DISCORD_TOKEN}`,
			"Content-Type": "application/json",
		},
	})).json();

	const commandsToDelete = currentCommands.filter((currentCommand: any) => {
		return !commands.find((command) => {
			return command.command.name === currentCommand.name
		})
	})

	const commandsToCreate = commands.filter((command) => {
		return !currentCommands.find((currentCommand: any) => {
			return command.command.name === currentCommand.name
		})
	})

	const commandsToUpdate = commands.reduce((acc: Record<string, Command>, command) => {
		const currentCommand = currentCommands.find((currentCommand: any) => {
			return command.command.name === currentCommand.name
		})

		if (currentCommand) {
			if (JSON.stringify(command.command) !== JSON.stringify(currentCommand)) {
				acc[currentCommand.id] = command
			}
		}

		return acc
	}, {})

	for (const command of commandsToDelete) {
		await fetch(`${url}/${command.id}`, {
			method: "DELETE",
			headers: {
				"Authorization": `Bot ${env.DISCORD_TOKEN}`,
				"Content-Type": "application/json",
			},
		})
	}
	console.log("Deleted " + commandsToDelete.length + " commands")

	for (const command of commandsToCreate) {
		await fetch(url, {
			method: "POST",
			headers: {
				"Authorization": `Bot ${env.DISCORD_TOKEN}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(command.command),
		})
	}
	console.log("Created " + commandsToCreate.length + " commands")

	for (const [id, command] of Object.entries(commandsToUpdate)) {
		await fetch(`${url}/${id}`, {
			method: "PATCH",
			headers: {
				"Authorization": `Bot ${env.DISCORD_TOKEN}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(command.command),
		})
	}
	console.log("Updated " + Object.keys(commandsToUpdate).length + " commands")
})()
