import { Snowflake } from "discord.js";
import * as fs from "fs";
import jsonfile from "jsonfile";

import { Logger } from "./logger2.js";
import { GlobalConfigFile, ServiceLocation, globalConfigFileSchema, serviceLocationSchema } from "./structures.js";

// Dark magic from https://stackoverflow.com/a/79054711

export class ConfigManager<_T extends null = null> {
	private readonly logger: Logger;

	private readonly globalConfigFilePath: string;
	private readonly configsDirPath: string;

	private globalConfig: GlobalConfigFile | _T;
	private configs: Map<Snowflake, ServiceLocation>;

	public constructor(logger: Logger, globalConfigFilePath: string, configsDirPath: string) {
		this.logger = logger;
		this.globalConfigFilePath = globalConfigFilePath;
		this.configsDirPath = configsDirPath;

		this.globalConfig = null as _T;
		this.configs = new Map();
	}

	public loadGlobalConfig(): this is ConfigManager<never> {
		try {
			this.logger.log("Loading global config...");
			this.globalConfig = globalConfigFileSchema.parse(jsonfile.readFileSync(this.globalConfigFilePath));
			this.logger.log("Finished loading global config");
			return true;
		} catch (_e: any) {
			const e = _e as Error;
			this.logger.error(`Failed to load global config! Error: ${e.message}`);
			return false;
		}
	}

	public loadConfigs(): [boolean, Error[]] {
		let dirContent: fs.Dirent[];
		try {
			dirContent = fs.readdirSync(this.configsDirPath, { withFileTypes: true, recursive: true });
		} catch {
			this.logger.error("Failed to read service locations configs dir!");
			return [false, []];
		}
		const dirFiles = dirContent.filter((dirent) => dirent.isFile());

		this.configs.clear();
		const errors: Error[] = [];
		for (const dirFile of dirFiles) {
			const dirFileFullName = `${this.configsDirPath}/${dirFile.name}`;
			try {
				this.logger.log(`Loading service location config '${dirFileFullName}...'`);
				const config = serviceLocationSchema.parse(jsonfile.readFileSync(dirFileFullName));
				this.configs.set(config.guildId, config);
				this.logger.log(`Finished loading service location config '${dirFileFullName}'`);
			} catch (_e: any) {
				const e = _e as Error;
				this.logger.error(`Failed to load service location config '${dirFileFullName}'! ${e.name}: ${e.message}`);
				errors.push(e);
			}
		}

		return [errors.length > 0, errors];
	}

	public getGlobalConfig(): Readonly<GlobalConfigFile> | _T {
		return this.globalConfig;
	}

	public getServiceLocations(): readonly ServiceLocation[] {
		const serviceLocations = [];
		for (const serviceLocation of this.configs.values()) serviceLocations.push(serviceLocation);
		return serviceLocations;
	}

	public getConfig(guildId: Snowflake): ServiceLocation | undefined {
		return this.configs.get(guildId);
	}
}
