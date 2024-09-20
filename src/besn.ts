import { DateTime } from "luxon";
import * as path from "path";

import { CompositeLogWriter, ConsoleLogWriter, FileBasedLogWriter, Logger } from "./logger2.js";
import { ConfigManager } from "./configManager2.js";
import * as util from "./util.js";

const enum ExitCode {
	Ok,
	Unknown,
	BadOption,
	BadGlobalConfig,
	BadConfigsDir,
	BadLogFile
}

export class Besn {
	private readonly logger: Logger;

	private readonly configManager: ConfigManager;

	public constructor(globalConfigFilePath: string, configsDirPath: string, logger: Logger) {
		this.logger = logger;

		this.configManager = new ConfigManager(
			this.logger.fork("ConfigManager"),
			globalConfigFilePath,
			configsDirPath
		);
	}

	private loadGlobalConfig() {
		return this.configManager.loadGlobalConfig();
	}

	private loadConfigs() {
		return this.configManager.loadConfigs();
	}

	public run() {
		const globalConfigLoaded = this.loadGlobalConfig();
		if (!globalConfigLoaded) return ExitCode.BadGlobalConfig;

		const [configsDirLoaded, configErrors] = this.loadConfigs();
		if (!configsDirLoaded) return ExitCode.BadConfigsDir;
		if (configErrors.length > 0) {
			let errors = "";
			for (const configError of configErrors) errors += `${configError.message}\n`;

			this.logger.warn(`Some configs failed to load! Errors:\n${errors}`);
		}

		return ExitCode.Ok;
	}
}

function main(args: readonly string[]) {
	const consoleLogWriter = new ConsoleLogWriter();
	const logger = new Logger("main", consoleLogWriter);

	const settings = {
		selfContained: process.env["NODE_ENV"] === "production" ? false : true,
		win32LogFix: process.platform === "win32" ? true : false
	};

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

		logger.error(`Failed to open log file! Error: ${e.message}`);
		return ExitCode.BadLogFile;
	}

	const compositeLogWriter = new CompositeLogWriter([consoleLogWriter, fileBasedLogWriter]);
	logger.setLogWriter(compositeLogWriter);

	const besn = new Besn(
		globalConfigFilePath,
		configsDirPath,
		logger
	);

	return besn.run();
}

process.exitCode = main(process.argv.slice(1));
