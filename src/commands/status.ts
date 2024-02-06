import {
	ApplicationCommandOptionType,
	ChatInputApplicationCommandData,
	ChatInputCommandInteraction,
	EmbedBuilder,
	GuildMember
} from "discord.js";
import { DateTime } from "luxon";

import { Logger } from "../logger";
import { ICommandHandler } from "../structures";
import * as Util from "../util";

export class StatusCommandHandler implements ICommandHandler {
	private static readonly INSTANCE = new StatusCommandHandler();
	private static readonly LOGGER = Logger.get("StatusCommandHandler");

	private constructor() {}

	public static getInstance() {
		return this.INSTANCE;
	}

	public getSignature(): ChatInputApplicationCommandData {
		return {
			name: "status",
			description: "Queries the bot's status",
			options: [
				{
					name: "gift",
					description: "A gift for me??? UwU",
					type: ApplicationCommandOptionType.Boolean,
					required: false
				}
			]
		};
	}

	public async handle(interaction: ChatInputCommandInteraction) {
		const executor = interaction.member as GuildMember;
		StatusCommandHandler.LOGGER.log(`${executor.id} requested bot status!`);

		await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(Util.getRandomColor())
					.setTitle("**Bot Status**")
					.addFields(
						{
							name: "Online",
							value: "Yes! No... Maybe?"
						},
						{
							name: "Time",
							value: `It _was_ <t:${DateTime.utc().toUnixInteger()}:f>... This ain't instant messaging, though!`
						},
						{
							name: "Emotion",
							value: (interaction.options.getBoolean("gift") ? "OMG GIFT!!! :mafuyulilguy:" : ":enajiiempty:")
						}
					)
			],
			ephemeral: true
		});
	}
}
