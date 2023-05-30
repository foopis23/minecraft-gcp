import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

config({
	path: resolve(__dirname, "../.env"),
})

export const env = z.object({
	DISCORD_APPLICATION_ID: z.string(),
	DISCORD_PUBLIC_KEY: z.string(),
	GCP_PROJECT_ID: z.string(),
	GCE_ZONE: z.string(),
	GCE_INSTANCE_NAME: z.string(),
	GCPUB_START_TOPIC: z.string(),
}).parse(process.env);
