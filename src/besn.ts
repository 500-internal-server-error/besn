import { Client } from "discord.js";

import { MasterCommandHandler } from "./commandHandler2.js";
import { ConfigManager } from "./configManager2.js";
import { Logger } from "./logger2.js";

export class Besn {
	private readonly logger: Logger;

	private readonly client: Client;

	private readonly configManager: ConfigManager;
	private readonly commandHandler: MasterCommandHandler;

	public constructor(
		logger: Logger,
		client: Client,

		configManager: ConfigManager,
		commandHandler: MasterCommandHandler
	) {
		this.logger = logger;
		this.client = client;
		void this.client.login(configManager.getGlobalConfig()?.token);

		this.configManager = configManager;
		this.commandHandler = commandHandler;
	}

	public registerCommands() {
		this.logger.debug("Registering commands...");
		void this.commandHandler.registerCommands();
		this.logger.debug("Finished registering commands");
	}

	public login(token: string) {
		return this.client.login(token);
	}
}
