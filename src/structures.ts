import { ChatInputApplicationCommandData, ChatInputCommandInteraction, Snowflake } from "discord.js";

import { EventReminderConfig } from "./eventReminder";

export type ServiceLocation = {
	guildId: Snowflake,
	ioChannelId: Snowflake,
	commandAccessRoleIds: Snowflake[],

	modules: {
		eventReminder: EventReminderConfig
	}
}

export type ConfigFile = {
	ownerId: Snowflake,
	token: string,
	serviceLocationWhitelist: ServiceLocation[],
}

export interface ICommandHandler {
	getSignature(): ChatInputApplicationCommandData;
	handle(interaction: ChatInputCommandInteraction): Promise<void>;
}

// Not comprehensive, only includes details we are interested in

export type VirtualLiveSchedule = {
	virtualLiveId: number,
	seq: number,
	startAt: number,
	endAt: number
}

export type VirtualLive = {
	id: number,
	name: string,
	startAt: number,
	endAt: number,
	virtualLiveSchedules: VirtualLiveSchedule[]
}
