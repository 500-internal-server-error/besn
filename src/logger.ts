import * as fs from "fs";
import { DateTime } from "luxon";

export class Logger {
	// Replace `:` with `.` to avoid file name problems on Windows
	private static LOG_FILE_HANDLE: fs.WriteStream = fs.createWriteStream(
		`./run/${DateTime.utc().toISO().replaceAll(":", ".")}.log`,
		{ flags: "a+", mode: 0o644, flush: true }
	);

	private readonly prefix: string;

	private constructor(prefix: string) {
		this.prefix = prefix;
	}

	public static get(prefix: string) {
		return new Logger(prefix);
	}

	public debug(message: string) {
		let out = Logger.reset();

		const timestamp = DateTime.utc().toISO();
		const formattedMessage = `[${this.prefix} DEBUG]: ${message}`

		out += Logger.brightGreen(timestamp);
		out += Logger.reset(" ");

		out += Logger.brightMagenta(formattedMessage);
		out += Logger.reset();

		console.debug(out);
		Logger.LOG_FILE_HANDLE.write(`${timestamp} ${formattedMessage}\n`);
	}

	public log(message: string) {
		let out = Logger.reset();

		const timestamp = DateTime.utc().toISO();
		const formattedMessage = `[${this.prefix} LOG]: ${message}`

		out += Logger.brightGreen(timestamp);
		out += Logger.reset(" ");

		out += Logger.brightWhite(formattedMessage);
		out += Logger.reset();

		console.debug(out);
		Logger.LOG_FILE_HANDLE.write(`${timestamp} ${formattedMessage}\n`);
	}

	public warn(message: string) {
		let out = Logger.reset();

		const timestamp = DateTime.utc().toISO();
		const formattedMessage = `[${this.prefix} WARN]: ${message}`

		out += Logger.brightGreen(timestamp);
		out += Logger.reset(" ");

		out += Logger.brightYellow(formattedMessage);
		out += Logger.reset();

		console.debug(out);
		Logger.LOG_FILE_HANDLE.write(`${timestamp} ${formattedMessage}\n`);
	}

	public error(message: string) {
		let out = Logger.reset();

		const timestamp = DateTime.utc().toISO();
		const formattedMessage = `[${this.prefix} ERROR]: ${message}`

		out += Logger.brightGreen(timestamp);
		out += Logger.reset(" ");

		out += Logger.brightRed(formattedMessage);
		out += Logger.reset();

		console.debug(out);
		Logger.LOG_FILE_HANDLE.write(`${timestamp} ${formattedMessage}\n`);
	}

	// Color codes obtained from MS docs
	// https://learn.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences

	private static brightRed(message: string = "") {
		return `\x1B[91m${message}`;
	}

	private static brightYellow(message: string = "") {
		return `\x1B[93m${message}`;
	}

	private static brightGreen(message: string = "") {
		return `\x1B[92m${message}`;
	}

	private static brightMagenta(message: string = "") {
		return `\x1B[95m${message}`;
	}

	private static brightWhite(message: string = "") {
		return `\x1B[97m${message}`;
	}

	private static reset(message: string = "") {
		return `\x1B[0m${message}`;
	}
}
