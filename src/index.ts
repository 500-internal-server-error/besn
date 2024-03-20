import { Client, IntentsBitField } from "discord.js";

import { MasterCommandHandler } from "./commandHandler.js";
import { CrashCommandHandler } from "./commands/crash.js";
import { DumpConfigCommandHandler } from "./commands/dumpconfig.js";
import { ListEventsCommandHandler } from "./commands/listevents.js";
import { ReloadConfigsCommandHandler } from "./commands/reloadconfigs.js";
import { StatusCommandHandler } from "./commands/status.js";
import { UpdatedbCommandHandler } from "./commands/updatedb.js";
import { ConfigManager } from "./configManager.js";
import { EventReminder, EventReminderEvent } from "./eventReminder.js";
import { Logger } from "./logger.js";
import { ICommandHandler } from "./structures.js";

async function main() {
	const logger = Logger.get("main");

	ConfigManager.loadConfigs();

	const client = new Client({
		intents: [
			IntentsBitField.Flags.Guilds
		]
	});

	const commands: ICommandHandler[] = [
		CrashCommandHandler.getInstance(),
		DumpConfigCommandHandler.getInstance(),
		ListEventsCommandHandler.getInstance(),
		StatusCommandHandler.getInstance(),
		UpdatedbCommandHandler.getInstance(),
		ReloadConfigsCommandHandler.getInstance()
	];

	const masterCommandHandler = new MasterCommandHandler(client, ConfigManager.getServiceLocations(), commands);

	client.on("ready", async () => {
		// Definitely not null since we are responding to the "ready" event,
		// but ts doesn't know that
		if (!client.user) return;

		logger.log(`Logged in as ${client.user.tag}`);
		logger.log(`Bonjour!`);

		logger.log("Registering commands...");
		await masterCommandHandler.registerCommands();
		logger.log("Finished registering commands");
	});

	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isChatInputCommand()) return;

		masterCommandHandler.handle(interaction);
	});

	logger.log("Setting up module EventReminder...");
	await EventReminder.init();
	EventReminder.EVENT_EMITTER.on(EventReminderEvent.StoryStart, async (name, startAtSeconds) => {
		for (const serviceLocation of ConfigManager.getServiceLocations()) {
			try {
				const guild = await client.guilds.fetch(serviceLocation.guildId);
				if (!guild) continue;

				const ioChannel = await guild.channels.fetch(serviceLocation.ioChannelId);
				if (!ioChannel) continue;
				if (!ioChannel.isTextBased()) continue;

				const pingRoleId = serviceLocation.modules.eventReminder.pingRoleId;
				ioChannel.send(`# Event Starting <t:${startAtSeconds}:R>!\n\n## Event _${name}_ will start at <t:${startAtSeconds}:f>.\n\n<@&${pingRoleId}>`);
				logger.log(`Announced event at guild ${guild.id}`);
			} catch (e: any) {
				logger.error(e.message);
				logger.error(`Was processing: { guildId: ${serviceLocation.guildId} , ioChannelId: ${serviceLocation.ioChannelId} }`);
			}
		}
	});
	EventReminder.EVENT_EMITTER.on(EventReminderEvent.ShowStart, async (name, startAtSeconds) => {
		for (const serviceLocation of ConfigManager.getServiceLocations()) {
			try {
				const guild = await client.guilds.fetch(serviceLocation.guildId);
				if (!guild) continue;

				const ioChannel = await guild.channels.fetch(serviceLocation.ioChannelId);
				if (!ioChannel) continue;
				if (!ioChannel.isTextBased()) continue;

				const pingRoleId = serviceLocation.modules.eventReminder.pingRoleId;
				ioChannel.send(`# Virtual Live Starting <t:${startAtSeconds}:R>!\n\n## _${name}_ will start at <t:${startAtSeconds}:f>.\n\n<@&${pingRoleId}>`);
				logger.log(`Announced event at guild ${guild.id}`);
			} catch (e: any) {
				logger.error(e.message);
				logger.error(`Was processing: { guildId: ${serviceLocation.guildId} , ioChannelId: ${serviceLocation.ioChannelId} }`);
			}
		}
	});

	logger.log("Logging in...");
	client.login(ConfigManager.getGlobalConfig().token);
}

// (async () => {
// 	const logger = Logger.get("_start");
// 	try {
// 		await main();
// 	} catch (e: any) {
// 		logger.error("Uncaught exception!");
// 		logger.error(`${e.name}: ${e.message}`);
// 		logger.error(e.stack);
// 	}
// })();
await main(); // todo: fix resource downloader
