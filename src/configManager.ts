import { Snowflake } from "discord.js";
import * as fs from "fs";
import jsonfile from "jsonfile";

import { Logger } from "./logger.js";
import { GlobalConfigFile, ServiceLocation, globalConfigFileSchema, serviceLocationSchema } from "./structures.js";

export class ConfigManager {
	private static readonly LOGGER = Logger.get("ConfigManager");

	private static GLOBAL_CONFIG: GlobalConfigFile;
	private static readonly CONFIGS = new Map<Snowflake, ServiceLocation>();

	private constructor() {}

	public static loadConfigs() {
		try {
			this.LOGGER.log("Loading global config...");
			this.GLOBAL_CONFIG = globalConfigFileSchema.parse(jsonfile.readFileSync("./config.json"));
		} catch (e) {
			// If this fails we screwed anyway, might as well throw on our way out

			this.LOGGER.error("Failed to read global config!");
			throw e;
		}

		let dirContent: fs.Dirent[];
		try {
			this.LOGGER.log("Reading service location configs directory...");
			dirContent = fs.readdirSync("./run/configs/", { withFileTypes: true, recursive: false });
		} catch (_e: any) {
			const e = _e as Error;
			this.LOGGER.error(`${e.name}: ${e.message}`);
			this.LOGGER.error("Failed to read service location configs directory!");
			return;
		}
		const dirFiles = dirContent.filter((dirent) => dirent.isFile());

		this.CONFIGS.clear();
		for (const dirFile of dirFiles) {
			try {
				this.LOGGER.log(`Reading service location config ${dirFile.name}...`);
				const config = serviceLocationSchema.parse(jsonfile.readFileSync(`./run/configs/${dirFile.name}`));
				this.CONFIGS.set(config.guildId, config);
			} catch (_e: any) {
				const e = _e as Error;
				this.LOGGER.error(`${e.name}: ${e.message}`);
				this.LOGGER.error(`Failed to read config file ${dirFile.name} !`);
			}
		}
	}

	public static getGlobalConfig(): Readonly<GlobalConfigFile> {
		return this.GLOBAL_CONFIG;
	}

	public static getServiceLocations(): readonly ServiceLocation[] {
		const serviceLocations: ServiceLocation[] = [];
		for (const serviceLocation of this.CONFIGS.values()) serviceLocations.push(serviceLocation);

		return serviceLocations;
	}

	public static getConfig(guildId: Snowflake): ServiceLocation | undefined {
		return this.CONFIGS.get(guildId);
	}
}
