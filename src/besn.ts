import { Client, IntentsBitField } from "discord.js";

import { Logger } from "./logger2.js";
import { ConfigManager } from "./configManager2.js";
import { ExitCode } from "./structures.js";
import { MasterCommandHandler } from "./commandHandler2.js";

export class Besn {
	private readonly logger: Logger;

	private readonly client: Client;

	private readonly configManager: ConfigManager;
	private readonly commandHandler: MasterCommandHandler;

	public constructor(
		logger: Logger,

		globalConfigFilePath: string,
		configsDirPath: string
	) {
		this.logger = logger;

		this.client = new Client({
			intents: [
				IntentsBitField.Flags.Guilds,
				IntentsBitField.Flags.GuildMembers
			]
		});

		this.configManager = new ConfigManager(
			this.logger.fork("ConfigManager"),
			globalConfigFilePath,
			configsDirPath
		);

		this.commandHandler = new MasterCommandHandler(this.logger.fork("MasterCommandHandler"), this.client);
	}

	private loadGlobalConfig() {
		return this.configManager.loadGlobalConfig();
	}

	private loadConfigs() {
		return this.configManager.loadConfigs();
	}

	private addCommand() {
		// this.commandHandler.
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
