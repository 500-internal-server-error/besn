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

	public static setLogger(logger: Logger) {
		if (this.LOGGER) throw new MultipleClassInitializationsError(this.name, nameof(() => this.LOGGER));
		this.LOGGER = logger;
	}

	public static setGlobalConfig(globalConfig: Readonly<GlobalConfigFile>) {
		this.GLOBAL_CONFIG = globalConfig;
	}

	public static setConfigs(serviceLocations: readonly ServiceLocation[]) {
		if (!this.EVENT_EMITTER) throw new UninitializedClassError(this.name, nameof(() => this.EVENT_EMITTER));

		if (!this.CONFIGS) this.CONFIGS = new Map<Snowflake, ServiceLocation>();
		this.CONFIGS.clear();
		for (const serviceLocation of serviceLocations) this.CONFIGS.set(serviceLocation.guildId, serviceLocation);
		this.EVENT_EMITTER.emit(ConfigManagerEvent.ConfigsReloaded, serviceLocations);
	}

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

	public static getGlobalConfig(): Readonly<GlobalConfigFile> {
		if (!this.GLOBAL_CONFIG) throw new UninitializedClassError(this.name, nameof(() => this.GLOBAL_CONFIG));
		return this.GLOBAL_CONFIG;
	}

	public static getServiceLocations(): readonly ServiceLocation[] {
		if (!this.CONFIGS) throw new UninitializedClassError(this.name, nameof(() => this.CONFIGS));
		return this.CONFIGS.values().toArray();
	}

	public static getConfig(guildId: Snowflake): Readonly<ServiceLocation> | undefined {
		if (!this.CONFIGS) throw new UninitializedClassError(this.name, nameof(() => this.CONFIGS));
		return this.CONFIGS.get(guildId);
	}
}
