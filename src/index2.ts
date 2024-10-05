import { Client, IntentsBitField } from "discord.js";
import { DateTime } from "luxon";
import * as path from "path";

import { Besn } from "./besn.js";
import { ConfigManager } from "./configManager2.js";
import { MasterCommandHandler } from "./commandHandler2.js";
// import { CrashCommandHandler } from "./commands/crash.js";
// import { DumpConfigCommandHandler } from "./commands/dumpconfig.js";
// import { ListEventsCommandHandler } from "./commands/listevents.js";
import { StatusCommandHandler } from "./commands/status2.js";
// import { ReloadConfigsCommandHandler } from "./commands/reloadconfigs.js";
// import { UpdatedbCommandHandler } from "./commands/updatedb.js";
import { CompositeLogWriter, ConsoleLogWriter, FileBasedLogWriter, Logger } from "./logger2.js";
import { ExitCode } from "./structures.js";
import * as util from "./util.js";

async function main(args: readonly string[]): Promise<number> {
	// Set default settings

	const settings = {
		selfContained: process.env["NODE_ENV"] === "production" ? false : true,
		win32LogFix: process.platform === "win32" ? true : false
	};

	// Parse args

	for (let i = 0; i < args.length; i++) {
		if (!args[i].startsWith("-")) continue;

		switch (args[i]) {
			case "-s":
			case "--self-contained": {
				settings.selfContained = true;
			} break;

			case "-x":
			case "--no-self-contained": {
				settings.selfContained = false;
			} break;

			case "-w":
			case "--win32-log-fix": {
				settings.win32LogFix = true;
			} break;

			case "-u":
			case "--no-win32-log-fix": {
				settings.win32LogFix = false;
			} break;

			case "-h":
			case "--help": {
				// Ruler
				// --- 012345678901234567890123456789012345678901234567890123456789012345678901234567890 ---
				//     |         |         |         |         |         |         |         |         |
				// --- 01234567 10 234567 20 234567 30 234567 40 234567 50 234567 60 234567 70 234567 80 ---

				const cleanArgv0 = path.basename(args[0]);
				let out = `Usage: ${cleanArgv0} [OPTION]...\n`;
				out += `\n`;
				out += `Options:\n`;
				out += `  -h, --help               Print this help\n`;
				out += `  -s, --self-contained     Use the install directory to store data instead of\n`;
				out += `                           the usual places (XDG spec and its fallback\n`;
				out += `                           locations)\n`;
				out += `  -x, --no-self-contained  Attempt to use the XDG spec (and its fallback\n`;
				out += `                           locations) to store data instead of the install\n`;
				out += `                           directory\n`;
				out += `  -w, --win32-log-fix      Replace ':' with '.' in log file names to avoid\n`;
				out += `                           windows choking on timestamps\n`;
				out += `  -u, --no-win32-log-fix   Pretend there are no restrictions to path names\n`;
				out += `                           other than the path separator '/' and hope we\n`;
				out += `                           don't crash\n`;
				console.log(out);
				return ExitCode.Ok;
			}

			default: {
				const cleanArgv0 = path.basename(args[0]);
				const cleanArg = args[i][1] === "-" ? args[i].slice(2) : args[i].slice(1);
				let out = `${cleanArgv0}: unknown option -- ${cleanArg}`;
				out += `Try '${cleanArgv0} --help' for more information.`;
				console.error(out);
				return ExitCode.BadOption;
			}
		}
	}

	// Setup logger, part 1
	// The console is all we have right now, the log file is not ready

	const consoleLogWriter = new ConsoleLogWriter();
	const logger = new Logger("main", consoleLogWriter);

	// Setup logger, part 2
	// Determine the log file to use, look at the settings

	const baseLogFileName = `${DateTime.utc().toISO()}.log`;
	const logFileName = settings.win32LogFix ? baseLogFileName.replaceAll(":", ".") : baseLogFileName;

	const globalConfigFilePath = settings.selfContained ? "./config.json" : `${util.getConfigHome()}/config.json`;
	const configsDirPath = settings.selfContained ? "./run/configs" : `${util.getConfigHome()}/configs`;
	const logFilePath = settings.selfContained ? `./run/logs/${logFileName}` : `${util.getStateHome()}/logs/${logFileName}`;

	let fileBasedLogWriter;
	try {
		fileBasedLogWriter = FileBasedLogWriter.openFile(logFilePath);
	} catch (_e: any) {
		const e = _e as Error;

		logger.error(`Failed to open log file! ${e.name}: ${e.message}`);
		return ExitCode.BadLogFile;
	}

	// Setup logger, part 3
	// We now have a file, extend the logger

	const compositeLogWriter = new CompositeLogWriter([consoleLogWriter, fileBasedLogWriter]);
	logger.setLogWriter(compositeLogWriter);

	// Log settings
	// Slight detour

	logger.debug(`Using settings:\n${JSON.stringify(settings, null, 4)}`);

	// Setup discord client

	const client = new Client({
		intents: [
			IntentsBitField.Flags.Guilds,
			IntentsBitField.Flags.GuildMembers
		]
	});

	// Setup config manager
	// It might not be able to load the configs

	const configManager = new ConfigManager(logger.fork("ConfigManager"), globalConfigFilePath, configsDirPath);

	if (!configManager.loadGlobalConfig()) {
		logger.error("Failed to load global config!");
		return ExitCode.BadGlobalConfig;
	}

	const [configManagerErrored, configManagerErrors] = configManager.loadConfigs();
	if (configManagerErrored) {
		let out = "Failed to load some service location configs! Errors:\n";
		for (const configManagerError of configManagerErrors) {
			out += `${configManagerError.name}: ${configManagerError.message}\n`;
		}

		logger.warn(out);
	}

	// Setup modules: command handler

	const commandHandler = new MasterCommandHandler(
		logger.fork("MasterCommandHandler"),
		client,
		configManager.getServiceLocations(),
		[
			// CrashCommandHandler.getInstance(),
			// DumpConfigCommandHandler.getInstance(),
			// ListEventsCommandHandler.getInstance(),
			new StatusCommandHandler(logger.fork("StatusCommandHandler"))
			// UpdatedbCommandHandler.getInstance(),
			// ReloadConfigsCommandHandler.getInstance()
		]
	);

	// Construct and run bot

	const besn = new Besn(
		logger.fork("Besn"),
		client,

		configManager,
		commandHandler
	);

	await besn.login(configManager.getGlobalConfig().token);
	besn.registerCommands();

	return 0;
}

process.exitCode = await main(process.argv.slice(1));
