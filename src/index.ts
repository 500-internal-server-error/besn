import { Client, Collection, Events, GuildMember, IntentsBitField, Snowflake } from "discord.js";
import { DateTime } from "luxon";
import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler";

import { BoostNotifier } from "./boostNotifier.js";
import { MasterCommandHandler } from "./commandHandler.js";
import { CrashCommandHandler } from "./commands/crash.js";
import { DumpConfigCommandHandler } from "./commands/dumpconfig.js";
import { ListEventsCommandHandler } from "./commands/listevents.js";
import { StatusCommandHandler } from "./commands/status.js";
import { ReloadConfigsCommandHandler } from "./commands/reloadconfigs.js";
import { UpdateDbCommandHandler } from "./commands/updatedb.js";
import { ConfigManager } from "./configManager.js";
import { EventReminder, EventReminderEvent } from "./eventReminder.js";
import { LoggerFactory } from "./logger.js";
import { ExitCode } from "./structures.js";

async function main() {
	const loggerFactoryError = LoggerFactory.init(`./run/logs/${DateTime.utc().toISO().replaceAll(":", ".")}.log`);
	if (loggerFactoryError) {
		console.error(`${loggerFactoryError.name}: ${loggerFactoryError.message}`);
		return ExitCode.BadLogFile;
	}

	const configManagerInitResult = ConfigManager.init(LoggerFactory.get("ConfigManager"), "./config.json", "./run/configs");
	if (configManagerInitResult instanceof Error) return ExitCode.BadGlobalConfig;
	if (Array.isArray(configManagerInitResult)) return ExitCode.BadConfigsDir;

	const logger = LoggerFactory.get("main");

	// 5. Setup discord client, part 1
	// We need a reference to it later

	const client = new Client({
		intents: [
			IntentsBitField.Flags.Guilds,
			IntentsBitField.Flags.GuildMembers
		]
	});

	// 6. Setup command handlers
	// We need it a reference to it later
	// We need a reference to the client here

	CrashCommandHandler.init(logger.fork("CrashCommandHandler"));
	DumpConfigCommandHandler.init(logger.fork("DumpConfigCommandHandler"));
	ListEventsCommandHandler.init(logger.fork("ListEventsCommandHandler"));
	ReloadConfigsCommandHandler.init(logger.fork("ReloadConfigsCommandHandler"));
	StatusCommandHandler.init(logger.fork("StatusCommandHandler"));
	UpdateDbCommandHandler.init(logger.fork("UpdateDbCommandHandler"));

	MasterCommandHandler.init(
		logger.fork("MasterCommandHandler"),
		client,
		ConfigManager.getServiceLocations(),
		[
			CrashCommandHandler.getInstance(),
			DumpConfigCommandHandler.getInstance(),
			ListEventsCommandHandler.getInstance(),
			ReloadConfigsCommandHandler.getInstance(),
			StatusCommandHandler.getInstance(),
			UpdateDbCommandHandler.getInstance()
		]
	);

	BoostNotifier.init(logger.fork("BoostNotifier"), ConfigManager.getServiceLocations());

	// 7. Setup discord client, part 2
	// Finish the setup

	const refreshMemberJobScheduler = new ToadScheduler();
	refreshMemberJobScheduler.addSimpleIntervalJob(
		new SimpleIntervalJob(
			{ hours: 1 },
			new AsyncTask(
				"Main: GuildMemberRefreshJob",
				async () => {
					logger.log("Refreshing GuildMember cache...");
					const fetches: Promise<Collection<Snowflake, GuildMember>>[] = [];
					client.guilds.cache.forEach((guild) => fetches.push(guild.members.fetch()));
					await Promise.allSettled(fetches);
					logger.log("Finished refreshing GuildMember cache");
				}
			)
		)
	);

	client.on(Events.ClientReady, async () => {
		// Definitely not null since we are listening to the ready event,
		// but TS doesn't know that for some reason
		if (!client.isReady()) return;

		logger.log(`Logged in as ${client.user.tag}`);
		logger.log("Bonjour!");

		// 9. Register commands

		logger.log("Registering commands...");
		await MasterCommandHandler.registerCommands();
		logger.log("Finished registering commands");

		client.guilds.cache.forEach((guild) => guild.members.fetch());
	});

	client.on(Events.InteractionCreate, (interaction) => {
		if (!interaction.isChatInputCommand()) return;

		MasterCommandHandler.handle(interaction);
	});

	client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
		void BoostNotifier.handle(oldMember as GuildMember, newMember);
	});

	logger.log("Setting up module EventReminder...");
	await EventReminder.init(logger.fork("EventReminder"));
	EventReminder.on(EventReminderEvent.StoryStart, async (name, startAt) => {
		for (const serviceLocation of ConfigManager.getServiceLocations()) {
			try {
				const guild = await client.guilds.fetch(serviceLocation.guildId);
				if (!guild) continue;

				const ioChannel = await guild.channels.fetch(serviceLocation.ioChannelId);
				if (!ioChannel) continue;
				if (!ioChannel.isTextBased()) continue;

				const pingRoleId = serviceLocation.modules.eventReminder.storyPingRoleId;
				let msg = `# Event Starting <t:${startAt.toSeconds()}:R>!\n\n`;
				msg += `## Event _${name}_ will start at <t:${startAt.toSeconds()}:f>.\n\n`;
				msg += `<@&${pingRoleId}>`;
				void ioChannel.send(msg);
				logger.log(`Announced event at guild ${guild.id}`);
			} catch (e) {
				if (!(e instanceof Error)) throw e;

				logger.error(`${e.name}: ${e.message}`);
				logger.error(
					`Was processing: { guildId: ${serviceLocation.guildId} , ioChannelId: ${serviceLocation.ioChannelId} }`
				);
			}
		}
	});
	EventReminder.on(EventReminderEvent.ShowStart, async (name, startAt) => {
		for (const serviceLocation of ConfigManager.getServiceLocations()) {
			try {
				const guild = await client.guilds.fetch(serviceLocation.guildId);
				if (!guild) continue;

				const ioChannel = await guild.channels.fetch(serviceLocation.ioChannelId);
				if (!ioChannel) continue;
				if (!ioChannel.isTextBased()) continue;

				const pingRoleId = serviceLocation.modules.eventReminder.showPingRoleId;
				let msg = `# Virtual Live Starting <t:${startAt.toSeconds()}:R>!\n\n`;
				msg += `## _${name}_ will start at <t:${startAt.toSeconds()}:f>.\n\n`;
				msg += `<@&`;
				switch (typeof pingRoleId) {
					case "string": {
						msg += `${pingRoleId}`;
						logger.debug(`pingRoleId is a string: ${pingRoleId}`);
					} break;

					case "object": {
						const startAtHour = `UTC${`${startAt.toUTC().hour}`.padStart(2, "0")}`;
						msg += (pingRoleId as { [index: string]: string; })[startAtHour] ?? "0";
						logger.debug(`pingRoleId is an object: startAtHour = ${startAtHour}`);
					} break;

					default: {
						msg += "0";
						logger.error(`Something has gone very wrong here, typeof is ${typeof pingRoleId}`);
					} break;
				}
				msg += `>`;
				void ioChannel.send(msg);
				logger.log(`Announced event at guild ${guild.id}`);
				logger.debug(msg);
			} catch (e) {
				if (!(e instanceof Error)) throw e;

				logger.error(`${e.name}: ${e.message}`);
				logger.error(
					`Was processing: { guildId: ${serviceLocation.guildId} , ioChannelId: ${serviceLocation.ioChannelId} }`
				);
			}
		}
	});

	// 8. Login

	logger.log("Logging in...");
	await client.login(ConfigManager.getGlobalConfig().token);

	return ExitCode.Ok;
}

process.exitCode = await main();
