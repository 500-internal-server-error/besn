import * as fs from "fs";
import { DateTime } from "luxon";

import { Colorizer } from "./colorizer.js";
import * as util from "./util.js";

export const enum LogLevel {
	Debug = "DEBUG",
	Log = "LOG",
	Warn = "WARN",
	Error = "ERROR"
}

export class LogEvent {
	public readonly timestamp: number;
	public readonly source: string;
	public readonly level: LogLevel;
	public readonly message: string;

	public constructor(timestamp: number, source: string, level: LogLevel, message: string) {
		this.timestamp = timestamp;
		this.source = source;
		this.level = level;
		this.message = message;
	}

	public toJsonString() {
		return JSON.stringify(this);
	}

	public toHumanString() {
		let out = Colorizer.reset();

		out += Colorizer.brightGreen(DateTime.fromMillis(this.timestamp).toFormat("dd/MM/yyyy, HH:mm:ss.SSS"));
		out += Colorizer.reset(" ");

		/* eslint-disable @stylistic/max-statements-per-line */
		const formattedMessage = `[${this.source} ${this.level}]: ${this.message}`;
		switch (this.level) {
			case LogLevel.Debug: out += Colorizer.brightMagenta(formattedMessage); break;
			case LogLevel.Log: out += Colorizer.brightWhite(formattedMessage); break;
			case LogLevel.Warn: out += Colorizer.brightYellow(formattedMessage); break;
			case LogLevel.Error: out += Colorizer.brightRed(formattedMessage); break;
		}
		/* eslint-enable @stylistic/max-statements-per-line */

		out += Colorizer.reset();

		return out;
	}
}

export interface ILogWriter {
	write(logEvent: LogEvent): void;
}

export class FileBasedLogWriter implements ILogWriter {
	private file: fs.WriteStream;

	private constructor(file: fs.WriteStream) {
		this.file = file;
	}

	public static openFile(file: string) {
		const result = util.openLogFileHandleV2(file);
		if (result instanceof Error) {
			throw new Error(`Attempted to write to bad file handle! Error: ${result.message}`);
		} else {
			return new FileBasedLogWriter(result);
		}
	}

	public write(logEvent: LogEvent) {
		this.file.write(`${logEvent.toJsonString()}\n`);
	}
}

export class ConsoleLogWriter implements ILogWriter {
	public write(logEvent: LogEvent) {
		/* eslint-disable @stylistic/max-statements-per-line */
		switch (logEvent.level) {
			case LogLevel.Debug: console.debug(logEvent.toHumanString()); break;
			case LogLevel.Log: console.info(logEvent.toHumanString()); break;
			case LogLevel.Warn: console.warn(logEvent.toHumanString()); break;
			case LogLevel.Error: console.error(logEvent.toHumanString()); break;
		}
		/* eslint-enable @stylistic/max-statements-per-line */
	}
}

export class CompositeLogWriter implements ILogWriter {
	public readonly logWriters: ILogWriter[];

	public constructor(logWriters: ILogWriter[]) {
		this.logWriters = logWriters;
	}

	public write(logEvent: LogEvent) {
		for (const logWriter of this.logWriters) {
			logWriter.write(logEvent);
		}
	}
}

export class Logger {
	private readonly prefix: string;
	private logWriter: ILogWriter;

	public constructor(prefix: string, logWriter: ILogWriter) {
		this.prefix = prefix;
		this.logWriter = logWriter;
	}

	public setLogWriter(logWriter: ILogWriter) {
		this.logWriter = logWriter;
	}

	/**
	 * Creates a new {@linkcode Logger} with the same {@linkcode ILogWriter}
	 * @param prefix New {@linkcode Logger}'s prefix
	 * @returns New {@linkcode Logger} with the requested name and the same {@linkcode ILogWriter}
	 */
	public fork(prefix: string): Logger {
		return new Logger(prefix, this.logWriter);
	}

	public debug(message: string) {
		this.logWriter.write(new LogEvent(DateTime.utc().toMillis(), this.prefix, LogLevel.Debug, message));
	}

	public log(message: string) {
		this.logWriter.write(new LogEvent(DateTime.utc().toMillis(), this.prefix, LogLevel.Log, message));
	}

	public warn(message: string) {
		this.logWriter.write(new LogEvent(DateTime.utc().toMillis(), this.prefix, LogLevel.Warn, message));
	}

	public error(message: string) {
		this.logWriter.write(new LogEvent(DateTime.utc().toMillis(), this.prefix, LogLevel.Error, message));
	}
}
