import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

config({
	path: resolve(__dirname, "../.env"),
});

export const env = z.object({
	DISCORD_APPLICATION_ID: z.string(),
	DISCORD_GUILD_ID: z.string(),
	DISCORD_TOKEN: z.string(),
}).parse(process.env);
