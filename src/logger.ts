import * as fs from "fs";
import { DateTime } from "luxon";

import { Colorizer } from "./colorizer.js";
import { Enum, openLogFileHandle } from "./util.js";

export class LogLevel extends Enum<string> {
	private static INSTANCE_COUNT = 0;

	public static readonly Debug = new LogLevel("DEBUG");
	public static readonly Log = new LogLevel("LOG");
	public static readonly Warn = new LogLevel("WARN");
	public static readonly Error = new LogLevel("ERROR");

	private constructor(value: string) {
		super(LogLevel.INSTANCE_COUNT++, value);
	}
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
		const formattedMessage = `[${this.source} ${this.level.toString()}]: ${this.message}`;
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
		const result = openLogFileHandle(file);
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
	/**
	 * Minimum log level to actually log, e.g.: if set to warn, then log and
	 * debug messages won't be saved, only warn and error
	 */
	private minLogLevel: LogLevel;

	public constructor(prefix: string, logWriter: ILogWriter, minLogLevel: LogLevel) {
		this.prefix = prefix;
		this.logWriter = logWriter;
		this.minLogLevel = minLogLevel;
	}

	public setLogWriter(logWriter: ILogWriter) {
		this.logWriter = logWriter;
	}

	public setMinLogLevel(minLogLevel: LogLevel) {
		this.minLogLevel = minLogLevel;
	}

	public fork(prefix: string): Logger {
		return new Logger(prefix, this.logWriter, this.minLogLevel);
	}

	public debug(message: string) {
		if (this.minLogLevel > LogLevel.Debug) return;
		this.logWriter.write(new LogEvent(DateTime.utc().toMillis(), this.prefix, LogLevel.Debug, message));
	}

	public log(message: string) {
		if (this.minLogLevel > LogLevel.Log) return;
		this.logWriter.write(new LogEvent(DateTime.utc().toMillis(), this.prefix, LogLevel.Log, message));
	}

	public warn(message: string) {
		if (this.minLogLevel > LogLevel.Warn) return;
		this.logWriter.write(new LogEvent(DateTime.utc().toMillis(), this.prefix, LogLevel.Warn, message));
	}

	public error(message: string) {
		if (this.minLogLevel > LogLevel.Error) return;
		this.logWriter.write(new LogEvent(DateTime.utc().toMillis(), this.prefix, LogLevel.Error, message));
	}
}

export class LoggerFactory {
	private static DEFAULT_PREFIX: string = `${this.name} (default)`;
	private static DEFAULT_LOG_WRITER: ILogWriter = new ConsoleLogWriter();
	private static DEFAULT_MIN_LOG_LEVEL: LogLevel = LogLevel.Debug;
	private static DEFAULT_LOGGER: Logger = new Logger(
		this.DEFAULT_PREFIX,
		this.DEFAULT_LOG_WRITER,
		this.DEFAULT_MIN_LOG_LEVEL
	);

	private constructor() {}

	public static init(logFilePath: string, minLogLevel: LogLevel): Error | void {
		const consoleLogWriter = new ConsoleLogWriter();
		let fileBasedLogWriter: FileBasedLogWriter;
		try {
			fileBasedLogWriter = FileBasedLogWriter.openFile(logFilePath);
		} catch (e) {
			if (!(e instanceof Error)) throw e;

			this.DEFAULT_LOGGER.error(`Failed to open log file! ${e.name}: ${e.message}`);
			return e;
		}
		const compositeLogWriter = new CompositeLogWriter([consoleLogWriter, fileBasedLogWriter]);

		this.setDefaultLogWriter(compositeLogWriter);
		this.setDefaultMinLogLevel(minLogLevel);
		this.DEFAULT_LOGGER = new Logger(this.DEFAULT_PREFIX, this.DEFAULT_LOG_WRITER, this.DEFAULT_MIN_LOG_LEVEL);
	}

	public static setDefaultMinLogLevel(minLogLevel: LogLevel) {
		this.DEFAULT_MIN_LOG_LEVEL = minLogLevel;
	}

	public static setDefaultLogWriter(defaultLogWriter: ILogWriter) {
		this.DEFAULT_LOG_WRITER = defaultLogWriter;
	}

	public static get(prefix: string, logWriter?: ILogWriter, minLogLevel?: LogLevel) {
		if (!logWriter) return this.DEFAULT_LOGGER.fork(prefix);
		return new Logger(prefix, logWriter, minLogLevel ?? this.DEFAULT_MIN_LOG_LEVEL);
	}
}
