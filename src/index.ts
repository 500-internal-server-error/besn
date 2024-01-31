import { Client, IntentsBitField } from "discord.js";
import * as jsonfile from "jsonfile";

const config = jsonfile.readFileSync("./config.json");

const client = new Client({
	intents: [
		IntentsBitField.Flags.Guilds
	]
});

client.on("ready", () => {
	// Definitely not null since we are responding to the "ready" event, but ts doesn't know that
	if (!client.user) return;

	console.log(`>>> Logged in as ${client.user.tag}`);
	console.log(`>>> Bonjour!`);
});

client.login(config.token);
