import { Logger } from "./logger2.js";
import { ConfigManager } from "./configManager2.js";
import { ExitCode } from "./structures.js";

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
