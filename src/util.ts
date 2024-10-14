import * as fs from "fs";
import * as path from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";

export function random(minInclusive: number, maxInclusive: number) {
	// Evenly distributed random javascript integer
	// https://stackoverflow.com/a/1527820

	return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

export function getRandomColor() {
	return random(0, 2 ** 24 - 1);
}

export function openLogFileHandle(fileName: string): fs.WriteStream {
	fs.mkdirSync(path.dirname(fileName), { recursive: true });
	return fs.createWriteStream(fileName, { flags: "a+", mode: 0o644, flush: true });
}

export function openLogFileHandleV2(fileName: string): fs.WriteStream | Error {
	fs.mkdirSync(path.dirname(fileName), { recursive: true });
	const flags = "as";
	const mode = 0o644;
	try {
		const fd = fs.openSync(fileName, flags, mode);
		if (fs.fstatSync(fd).isDirectory()) return new Error(`File '${fileName}' exists and is a directory!`);
		return fs.createWriteStream("", { fd: fd, flags: flags, mode: mode, flush: true });
	} catch (_e: any) {
		const e = _e as Error;
		return e;
	}
}

export async function downloadFile(url: string, out: string) {
	const response = await fetch(url);
	if (!response.ok) return;
	if (!response.body) return;

	await finished(
		Readable
			.fromWeb(response.body)
			.pipe(fs.createWriteStream(out, { flags: "w", mode: 0o644, autoClose: true }))
	);
}

export function clamp(min: number, value: number, max: number) {
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

export function getConfigHome() {
	const xdgDir = process.env["XDG_CONFIG_HOME"];
	if (xdgDir) return `${xdgDir}/besn`;

	const home = process.env["HOME"];
	if (home) return `${home}/.config/besn`;

	const userprofile = process.env["USERPROFILE"];
	if (userprofile) return `${userprofile}/.config/besn`;

	throw new Error("Unable to determine config directory");
}

export function getStateHome() {
	const xdgDir = process.env["XDG_STATE_HOME"];
	if (xdgDir) return `${xdgDir}/besn`;

	const home = process.env["HOME"];
	if (home) return `${home}/.local/state/besn`;

	const userprofile = process.env["USERPROFILE"];
	if (userprofile) return `${userprofile}/.local/state/besn`;

	throw new Error("Unable to determine log directory");
}

/**
 * Convenience class for use in runtime "asserts"
 */
export class UninitializedClassError extends Error {
	public constructor(className: string, options?: ErrorOptions);
	public constructor(className: string, propertyName?: string, options?: ErrorOptions);
	public constructor(className: string, propertyNameOrOptions?: string | ErrorOptions, maybeOptions?: ErrorOptions) {
		let message: string;
		let options: ErrorOptions | undefined;

		if (typeof propertyNameOrOptions === "string") {
			const propertyName = propertyNameOrOptions;
			message = `Use of uninitialized property ${propertyName} on class ${className}!`;
			options = maybeOptions;
		} else {
			message = `Use of uninitialized class ${className}!`;
			if (propertyNameOrOptions) options = propertyNameOrOptions;
			options = maybeOptions;
		}

		super(message, options);
	}
}
