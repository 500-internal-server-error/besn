import { Client, Collection, Events, GuildMember, IntentsBitField, Snowflake } from "discord.js";
import { DateTime } from "luxon";
import * as path from "path";
import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler";

import { BoostNotifier } from "./boostNotifier.js";
import { MasterCommandHandler } from "./commandHandler.js";
import { CrashCommandHandler } from "./commands/crash.js";
import { DumpConfigCommandHandler } from "./commands/dumpconfig.js";
import { ListEventsCommandHandler } from "./commands/listevents.js";
import { StatusCommandHandler } from "./commands/status.js";
import { ReloadConfigsCommandHandler } from "./commands/reloadconfigs.js";
import { UpdateDbCommandHandler } from "./commands/updatedb.js";
import { ConfigDirLoadError, ConfigManager, ConfigManagerEvent, GlobalConfigLoadError } from "./configManager.js";
import { EventReminder, EventReminderEvent } from "./eventReminder.js";
import { LoggerFactory, LogLevel } from "./logger.js";

export const enum ExitCode {
	Ok,
	Unknown,
	BadOption,
	BadGlobalConfig,
	BadConfigsDir,
	BadLogFile
}

async function main(args: string[]) {
	const options = {
		logFileName: `./run/logs/${DateTime.utc().toISO().replaceAll(":", ".")}.log`,
		minLogLevel: LogLevel.Debug
	};

	// TS cannot understand args.length > 0, so explicit cast is needed
	// https://github.com/microsoft/TypeScript/issues/30406
	if (args.length > 0) {
		const args2 = [...args];
		const cleanArgv0 = path.basename(args2.shift()!);
		while (args2.length > 0) {
			const arg = args2.shift()!;
			if (arg === "-h" || arg === "--help") {
				let out = `Usage: ${cleanArgv0} [OPTION]...\n`;
				out += "\n";
				out += "  -h, --help      Print this help and exit\n";
				out += "  -W, --log-level Set log level (0: Debug, 1: Log, 2: Warn, 3: Error)";
				console.log(out);
				return ExitCode.Ok;
			} else if (arg === "-W" || arg === "--log-level") {
				const level = args2.shift();
				if (level === "debug" || level === "0") {
					options.minLogLevel = LogLevel.Debug;
				} else if (level === "log" || level === "1") {
					options.minLogLevel = LogLevel.Log;
				} else if (level === "warn" || level === "2") {
					options.minLogLevel = LogLevel.Warn;
				} else if (level === "error" || level === "3") {
					options.minLogLevel = LogLevel.Error;
				} else {
					console.error(`${cleanArgv0}: unknown option for ${arg}: ${level}`);
					return ExitCode.BadOption;
				}
			} else {
				console.error(`${cleanArgv0}: unknown option: ${arg}`);
				return ExitCode.BadOption;
			}
		}
	}

	const loggerFactoryError = LoggerFactory.init(options.logFileName, options.minLogLevel);
	if (loggerFactoryError) {
		console.error(`${loggerFactoryError.name}: ${loggerFactoryError.message}`);
		return ExitCode.BadLogFile;
	}

	const configManagerInitResult = ConfigManager.init(LoggerFactory.get("ConfigManager"), "./config.json", "./run/configs");
	if (configManagerInitResult instanceof GlobalConfigLoadError) return ExitCode.BadGlobalConfig;
	if (configManagerInitResult instanceof ConfigDirLoadError) return ExitCode.BadConfigsDir;

	const logger = LoggerFactory.get("main");

	process.on("uncaughtExceptionMonitor", (err, origin) => {
		logger.error(`${err.name} (${origin}): ${err.message}\n\n${err.stack}`);
	});

	const client = new Client({
		intents: [
			IntentsBitField.Flags.Guilds,
			IntentsBitField.Flags.GuildMembers
		]
	});

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

				const ioChannel = await guild.channels.fetch(serviceLocation.modules.eventReminder.ioChannelId);
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
					`Was processing:\n`
					+ `  - guildId: ${serviceLocation.guildId}\n`
					+ `  - ioChannelId: ${serviceLocation.modules.eventReminder.ioChannelId}`
				);
			}
		}
	});
	EventReminder.on(EventReminderEvent.ShowStart, async (name, startAt) => {
		for (const serviceLocation of ConfigManager.getServiceLocations()) {
			try {
				const guild = await client.guilds.fetch(serviceLocation.guildId);
				if (!guild) continue;

				const ioChannel = await guild.channels.fetch(serviceLocation.modules.eventReminder.ioChannelId);
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
					`Was processing:\n`
					+ `  - guildId: ${serviceLocation.guildId}\n`
					+ `  - ioChannelId: ${serviceLocation.modules.eventReminder.ioChannelId}`
				);
			}
		}
	});

	ConfigManager.on(ConfigManagerEvent.ConfigsReloaded, (serviceLocations) => {
		MasterCommandHandler.setServiceLocations(serviceLocations);
		BoostNotifier.setServiceLocations(serviceLocations);
	});

	logger.log("Logging in...");
	await client.login(ConfigManager.getGlobalConfig().token);

	return ExitCode.Ok;
}

process.exitCode = await main(process.argv.slice(1));
