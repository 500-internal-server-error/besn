import { Snowflake } from "discord.js";
import EventEmitter from "events";
import * as fs from "fs";
import jsonfile from "jsonfile";
import { z } from "zod";

import { Logger } from "./logger.js";
import { nameof, MultipleClassInitializationsError, UninitializedClassError } from "./util.js";

export const serviceLocationSchema = z.object({
	guildId: z.string(),
	primaryIoChannelId: z.string(),
	commandAccessRoleIds: z.array(z.string()),
	modules: z.object({
		eventReminder: z.object({
			storyPingRoleId: z.string(),
			showPingRoleId: z.union([
				z.string(),
				z.object({
					UTC06: z.string(),
					UTC07: z.string(),
					UTC08: z.string(),
					UTC09: z.string(),
					UTC11: z.string(),
					UTC15: z.string(),
					UTC19: z.string(),
					UTC21: z.string(),
					UTC01: z.string(),
					UTC02: z.string(),
					UTC04: z.string()
				})
			]),
			ioChannelId: z.string()
		}),
		boostNotifier: z.object({
			boostRole: z.string(),
			ioChannelId: z.union([
				z.string(),
				z.object({
					boost: z.string(),
					deboost: z.string()
				})
			]),
			boostMessage: z.object({
				userKey: z.string(),
				formatMessage: z.string()
			}),
			deboostMessage: z.object({
				userKey: z.string(),
				formatMessage: z.string()
			})
		})
	})
});

export type ServiceLocation = z.infer<typeof serviceLocationSchema>;

export const globalConfigFileSchema = z.object({
	ownerId: z.string(),
	ownerGuildId: z.string(),
	ownerIoChannelId: z.string(),

	token: z.string()
});

export type GlobalConfigFile = z.infer<typeof globalConfigFileSchema>;

export const enum ConfigManagerEvent {
	ConfigsReloaded = "configsReloaded"
}

/* eslint-disable @stylistic/max-statements-per-line */
export class GlobalConfigLoadError extends Error { public constructor(e: Error) { super(e.message); } }
export class ConfigDirLoadError extends Error { public constructor(e: Error) { super(e.message); } }
/* eslint-enable @stylistic/max-statements-per-line */

export class ConfigManager {
	private static LOGGER?: Logger = undefined;

	private static EVENT_EMITTER?: EventEmitter;

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
	public static init(
		logger: Logger,
		globalConfigFilePath: string,
		configsDirPath: string
	): GlobalConfigLoadError | ConfigDirLoadError | Error[] | void {
		this.setLogger(logger);

		if (this.EVENT_EMITTER) {
			throw new MultipleClassInitializationsError(this.name, nameof(() => this.EVENT_EMITTER));
		}
		this.EVENT_EMITTER = new EventEmitter();

		const globalConfigLoadResult = this.loadGlobalConfig(globalConfigFilePath);
		if (globalConfigLoadResult instanceof Error) return new GlobalConfigLoadError(globalConfigLoadResult);
		this.setGlobalConfig(globalConfigLoadResult);

		const configsLoadResult = this.loadConfigs(configsDirPath);
		if (configsLoadResult instanceof Error) return new ConfigDirLoadError(configsLoadResult);
		const [configs, configLoadErrors] = configsLoadResult;
		this.setConfigs(configs);
		if (configLoadErrors.length > 0) return configLoadErrors;
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
		if (!this.EVENT_EMITTER) throw new UninitializedClassError(this.name, nameof(() => this.EVENT_EMITTER));

		if (!this.CONFIGS) this.CONFIGS = new Map<Snowflake, ServiceLocation>();
		this.CONFIGS.clear();
		for (const serviceLocation of serviceLocations) this.CONFIGS.set(serviceLocation.guildId, serviceLocation);
		this.EVENT_EMITTER.emit(ConfigManagerEvent.ConfigsReloaded, serviceLocations);
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
				out[0].push(serviceLocationSchema.parse(jsonfile.readFileSync(`${configsDirPath}/${dirFile.name}`)));
			} catch (e) {
				if (!(e instanceof Error)) throw e;

				this.LOGGER.error(`Failed to read config file ${dirFile.name}! ${e.name}: ${e.message}`);
				out[1].push(e);
			}
		}

		return out;
	}

	public static on(
		eventName: ConfigManagerEvent.ConfigsReloaded,
		listener: (serviceLocations: readonly ServiceLocation[]) => void
	): void;

	public static on(eventName: ConfigManagerEvent, listener: (...args: any[]) => any): void {
		if (!this.EVENT_EMITTER) throw new UninitializedClassError(this.name, nameof(() => this.EVENT_EMITTER));
		this.EVENT_EMITTER.on(eventName, listener);
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

	/**
	 * Gets a readonly reference to a {@linkcode ServiceLocation}'s config
	 *
	 * @param guildId The requested service location config's guild ID
	 *
	 * @returns A readonly reference to the requested service 's config if it exists, none otherwise
	 *
	 * @throws Throws {@linkcode UninitializedClassError} if the {@linkcode ServiceLocation} configs have not been
	 * loaded yet. See {@linkcode ConfigManager.init}, {@linkcode ConfigManager.loadConfigs}, and
	 * {@linkcode ConfigManager.setConfigs}
	 */
	public static getConfig(guildId: Snowflake): Readonly<ServiceLocation> | undefined {
		if (!this.CONFIGS) throw new UninitializedClassError(this.name, nameof(() => this.CONFIGS));
		return this.CONFIGS.get(guildId);
	}
}
