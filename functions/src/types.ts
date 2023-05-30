import { z } from "zod";
import * as functions from '@google-cloud/functions-framework';

export enum InteractionType {
	PING = 1,
	APPLICATION_COMMAND = 2,
	MESSAGE_COMPONENT = 3,
	APPLICATION_COMMAND_AUTOCOMPLETE = 4,
	MODAL_SUBMIT = 5
}

export const interactionSchema = z.object({
	id: z.string(),
	type: z.nativeEnum(InteractionType),
	application_id: z.string(),
	data: z.object({
		id: z.string(),
		name: z.string(),
		guild_id: z.string().optional(),
		target_id: z.string().optional(),
	}).optional(),
	guild_id: z.string().optional(),
	channel_id: z.string().optional(),
	token: z.string(),
	version: z.number(),
});
export type Interaction = z.infer<typeof interactionSchema>;

export enum CommandType {
	CHAT_INPUT = 1,
	USER = 2,
	MESSAGE = 3,
}

export enum InteractionCallbackType {
	PONG = 1,
	CHANNEL_MESSAGE_WITH_SOURCE = 4,
	DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5,
	DEFERRED_UPDATE_MESSAGE = 6,
	UPDATE_MESSAGE = 7,
	APPLICATION_COMMAND_AUTOCOMPLETE_RESULT = 8,
	MODAL = 9
}

type InteractionCallback = {
	type: InteractionCallbackType,
	data: {
		tts?: boolean,
		content?: string,
		embeds?: any[],
		allowed_mentions?: {
			parse: string[],
		},
		flags?: number,
		components?: any[],
		attachment?: any[],
	},
}

export interface Command {
	command: {
		name: string,
		type: CommandType,
		description: string,
	},
	handler: (interaction: Interaction, req: functions.Request, res: functions.Response) => Promise<InteractionCallback> | InteractionCallback | void | Promise<void>,
}

export class HTTPError extends Error {
	constructor(public code: number, message?: string) {
		super(message);
	}
}

export const startMinecraftServerEventSchema = z.object({
	interactionId: z.string(),
	interactionToken: z.string(),
	project: z.string(),
	zone: z.string(),
	instance: z.string(),
});
export type StartMinecraftServerEvent = z.infer<typeof startMinecraftServerEventSchema>;