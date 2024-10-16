import { Snowflake } from "discord.js";
import * as fs from "fs";
import jsonfile from "jsonfile";

import { Logger } from "./logger2.js";
import { GlobalConfigFile, globalConfigFileSchema, ServiceLocation, serviceLocationSchema } from "./structures.js";
import { nameof, MultipleClassInitializationsError, UninitializedClassError } from "./util.js";

export class ConfigManager {
	private static LOGGER?: Logger = undefined;

	private static GLOBAL_CONFIG?: Readonly<GlobalConfigFile> = undefined;
	private static CONFIGS?: Map<Snowflake, Readonly<ServiceLocation>> = undefined;

	private constructor() {}

	/**
	 * Convenience method to initialize this class, combining setting a {@linkcode Logger} and initializing the
	 * {@linkcode GlobalConfigFile} structure and {@linkcode ServiceLocation} configs. See:
	 * - {@linkcode ConfigManager.setLogger}
	 * - {@linkcode ConfigManager.loadGlobalConfig} and {@linkcode ConfigManager.setGlobalConfig}
	 * - {@linkcode ConfigManager.loadConfigs} and {@linkcode ConfigManager.setConfigs}
	 *
	 * This method should not be called multiple times. While it is possible, doing so is likely a mistake or a sign of
	 * bad architecture.
	 *
	 * @param logger The {@linkcode Logger} to use for future operations
	 * @param globalConfigFilePath Path to the global config file
	 * @param configsDirPath Path to the service location configs directory
	 *
	 * @returns None if no errors occurred during initialization, an error if loading the global config file failed or
	 * if reading the service location configs directory failed, or an array of errors if any failures occurred while
	 * loading service location configs
	 *
	 * @throws Throws {@linkcode MultipleClassInitializationsError} if the class has already been initialized or
	 * partially initialized, either by {@linkcode ConfigManager.init} or {@linkcode ConfigManager.setLogger}
	 */
	public static init(logger: Logger, globalConfigFilePath: string, configsDirPath: string): Error | Error[] | void {
		this.setLogger(logger);

		const globalConfigLoadResult = this.loadGlobalConfig(globalConfigFilePath);
		if (globalConfigLoadResult instanceof Error) return globalConfigLoadResult;
		this.setGlobalConfig(globalConfigLoadResult);

		const configsLoadResult = this.loadConfigs(configsDirPath);
		if (configsLoadResult instanceof Error) return configsLoadResult;
		const [configs, configLoadErrors] = configsLoadResult;
		if (configLoadErrors.length > 0) return configLoadErrors;
		this.setConfigs(configs);
	}

	/**
	 * Change the {@linkcode Logger} used for future operations
	 *
	 * This method should not be called multiple times. While it is possible, doing so is likely a mistake or a sign of
	 * bad architecture.
	 *
	 * @param logger The {@linkcode Logger} to use for future operations
	 *
	 * @returns None
	 *
	 * @throws Throws {@linkcode MultipleClassInitializationsError} if the class has already been initialized or
	 * partially initialized, either by {@linkcode ConfigManager.init} or {@linkcode ConfigManager.setLogger}
	 */
	public static setLogger(logger: Logger) {
		if (this.LOGGER) throw new MultipleClassInitializationsError(this.name, nameof(() => this.LOGGER));
		this.LOGGER = logger;
	}

	/**
	 * Change the {@linkcode GlobalConfigFile} structure to use for future operations
	 *
	 * @param globalConfig The {@linkcode GlobalConfigFile} structure to use for future operations
	 *
	 * @returns None
	 */
	public static setGlobalConfig(globalConfig: Readonly<GlobalConfigFile>) {
		this.GLOBAL_CONFIG = globalConfig;
	}

	/**
	 * Change the {@linkcode ServiceLocation} configs to use for future operations
	 *
	 * @param serviceLocations The {@linkcode ServiceLocation} configs to use for future operations
	 *
	 * @returns None
	 */
	public static setConfigs(serviceLocations: readonly ServiceLocation[]) {
		if (!this.CONFIGS) this.CONFIGS = new Map<Snowflake, ServiceLocation>();
		this.CONFIGS.clear();
		for (const serviceLocation of serviceLocations) this.CONFIGS.set(serviceLocation.guildId, serviceLocation);
	}

	/**
	 * Read and parse the global config file
	 *
	 * @param globalConfigFilePath - Path to the global config file
	 *
	 * @returns The parsed {@linkcode GlobalConfigFile} if the load succeeded, otherwise returns the error
	 *
	 * @throws Throws {@linkcode UninitializedClassError} if this class does not have a {@linkcode Logger} setup. See
	 * {@linkcode ConfigManager.init} and/or {@linkcode ConfigManager.setLogger}.
	 */
	public static loadGlobalConfig(globalConfigFilePath: string): GlobalConfigFile | Error {
		if (!this.LOGGER) throw new UninitializedClassError(this.name, nameof(() => this.LOGGER));

		try {
			this.LOGGER.log("Loading global config...");
			return globalConfigFileSchema.parse(jsonfile.readFileSync(globalConfigFilePath));
		} catch (e) {
			if (!(e instanceof Error)) throw e;

			this.LOGGER.error(`Failed to read global config! ${e.name}: ${e.message}`);
			return e;
		}
	}

	/**
	 * Read and parse service location config files from the service location config directory
	 *
	 * @param configsDirPath Path to the service location configs directory
	 *
	 * @returns A tuple containing an array of {@linkcode ServiceLocation}s and an array of errors that occurred while
	 * reading and/or parsing the service location config files, if any, if reading the service location config
	 * directory succeeded, or an error if reading the directory failed
	 *
	 * @throws Throws {@linkcode UninitializedClassError} if this class does not have a {@linkcode Logger} setup. See
	 * {@linkcode ConfigManager.init} and/or {@linkcode ConfigManager.setLogger}.
	 */
	public static loadConfigs(configsDirPath: string): [ServiceLocation[], Error[]] | Error {
		if (!this.LOGGER) throw new UninitializedClassError(this.name, nameof(() => this.LOGGER));

		const out: [ServiceLocation[], Error[]] = [[], []];

		let dirContent: fs.Dirent[];
		try {
			this.LOGGER.log("Reading service location configs direectory...");
			dirContent = fs.readdirSync(configsDirPath, { withFileTypes: true, recursive: false });
		} catch (e) {
			if (!(e instanceof Error)) throw e;

			this.LOGGER.error(`Failed to read service location configs directory! ${e.name}: ${e.message}`);
			return e;
		}
		const dirFiles = dirContent.filter((dirent) => dirent.isFile());

		for (const dirFile of dirFiles) {
			try {
				this.LOGGER.log(`Reading service location config ${dirFile.name}...`);
				out[0].push(serviceLocationSchema.parse(jsonfile.readFileSync(dirFile.name)));
			} catch (e) {
				if (!(e instanceof Error)) throw e;

				this.LOGGER.error(`Failed to read config file ${dirFile.name}!`);
				out[1].push(e);
			}
		}

		return out;
	}

	/**
	 * Gets a reeadonly reference to the {@linkcode GlobalConfigFile} structure
	 *
	 * @returns A readonly reference to the {@linkcode GlobalConfigFile} structure
	 *
	 * @throws Throws {@linkcode UninitializedClassError} if the {@linkcode GlobalConfigFile} structure is not
	 * loaded yet. See {@linkcode ConfigManager.init}, {@linkcode ConfigManager.loadGlobalConfig}, and
	 * {@linkcode ConfigManager.setGlobalConfig}.
	 */
	public static getGlobalConfig(): Readonly<GlobalConfigFile> {
		if (!this.GLOBAL_CONFIG) throw new UninitializedClassError(this.name, nameof(() => this.GLOBAL_CONFIG));
		return this.GLOBAL_CONFIG;
	}

	/**
	 * Gets a readonly reference to the {@linkcode ServiceLocation} configs
	 *
	 * @returns A readonly reference to the {@linkcode ServiceLocation} configs
	 *
	 * @throws Throws {@linkcode UninitializedClassError} if the {@linkcode ServiceLocation} configs have not been
	 * loaded yet. See {@linkcode ConfigManager.init}, {@linkcode ConfigManager.loadConfigs}, and
	 * {@linkcode ConfigManager.setConfigs}.
	 */
	public static getServiceLocations(): readonly ServiceLocation[] {
		if (!this.CONFIGS) throw new UninitializedClassError(this.name, nameof(() => this.CONFIGS));
		return this.CONFIGS.values().toArray();
	}
}
