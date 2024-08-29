import { ChatInputApplicationCommandData, ChatInputCommandInteraction } from "discord.js";
import { z } from "zod";

export const serviceLocationSchema = z.object({
	guildId: z.string(),
	ioChannelId: z.string(),
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
			])
		}),
		boostNotifier: z.object({
			boostRole: z.string(),
			ioChannelId: z.string()
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

export interface ICommandHandler {
	getSignature(): ChatInputApplicationCommandData;
	handle(interaction: ChatInputCommandInteraction): Promise<void> | void;
}

// Not comprehensive, only includes details we are interested in

export const enum StoryType {
	Marathon = "marathon",
	CheerfulCarnival = "cheerful_carnival"
}

export type Story = {
	id: number;
	name: string;
	eventType: StoryType;
	startAt: number;
};

export type VirtualLiveSchedule = {
	virtualLiveId: number;
	seq: number;
	startAt: number;
	endAt: number;
};

export type VirtualLive = {
	id: number;
	name: string;
	startAt: number;
	endAt: number;
	virtualLiveSchedules: VirtualLiveSchedule[];
};
