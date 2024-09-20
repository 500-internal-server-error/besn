export class Colorizer {
	private constructor() {}

	// Color codes obtained from MS docs
	// https://learn.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences

	public static brightRed(message: string = "") {
		return `\x1B[91m${message}`;
	}

	public static brightYellow(message: string = "") {
		return `\x1B[93m${message}`;
	}

	public static brightGreen(message: string = "") {
		return `\x1B[92m${message}`;
	}

	public static brightMagenta(message: string = "") {
		return `\x1B[95m${message}`;
	}

	public static brightWhite(message: string = "") {
		return `\x1B[97m${message}`;
	}

	public static reset(message: string = "") {
		return `\x1B[0m${message}`;
	}
}
