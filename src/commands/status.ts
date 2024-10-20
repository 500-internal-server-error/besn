import {
	ApplicationCommandOptionType,
	ChatInputApplicationCommandData,
	ChatInputCommandInteraction,
	EmbedBuilder,
	GuildMember
} from "discord.js";
import { DateTime } from "luxon";

import { ICommandHandler } from "../commandHandler.js";
import { Logger } from "../logger.js";
import { getRandomColor, MultipleClassInitializationsError, nameof, UninitializedClassError } from "../util.js";

export class StatusCommandHandler implements ICommandHandler {
	private static INSTANCE = new StatusCommandHandler();

	private static LOGGER?: Logger = undefined;

	private constructor() {}

	public static init(logger: Logger) {
		this.setLogger(logger);
	}

	public static setLogger(logger: Logger) {
		if (this.LOGGER) throw new MultipleClassInitializationsError(this.name, nameof(() => this.LOGGER));
		this.LOGGER = logger;
	}

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

	public handle(interaction: ChatInputCommandInteraction) {
		if (!StatusCommandHandler.LOGGER) {
			throw new UninitializedClassError(StatusCommandHandler.name, nameof(() => StatusCommandHandler.LOGGER));
		}

		const executor = interaction.member as GuildMember;
		StatusCommandHandler.LOGGER.log(`${executor.id} requested bot status!`);

		const time = `<t:${DateTime.utc().toUnixInteger()}:f>`;
		const happyEmoji = "<:mafuyulilguy:1119765248828780687>";
		const sadEmoji = "<:enajiiempty:1132921144366878730>";

		void interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(getRandomColor())
					.setTitle("**Bot Status**")
					.addFields(
						{
							name: "Online",
							value: "Yes! No... Maybe?"
						},
						{
							name: "Time",
							value: `It _was_ ${time}... This ain't instant messaging, though!`
						},
						{
							name: "Emotion",
							value: (interaction.options.getBoolean("gift") ? `OMG GIFT!!! ${happyEmoji}` : sadEmoji)
						}
					)
			],
			ephemeral: true
		});
	}
}
