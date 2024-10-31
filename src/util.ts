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

export function openLogFileHandle(fileName: string): fs.WriteStream | Error {
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

export class UninitializedDependencyError extends Error {
	public constructor(dependencyName: string, options?: ErrorOptions) {
		super(`Use of uninitialized dependency ${dependencyName}!`, options);
	}
}

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
			options = propertyNameOrOptions ?? maybeOptions;
		}

		super(message, options);
	}
}

export class MultipleClassInitializationsError extends Error {
	public constructor(className: string, options?: ErrorOptions);
	public constructor(className: string, propertyName?: string, options?: ErrorOptions);
	public constructor(className: string, propertyNameOrOptions?: string | ErrorOptions, maybeOptions?: ErrorOptions) {
		let message: string;
		let options: ErrorOptions | undefined;

		if (typeof propertyNameOrOptions === "string") {
			const propertyName = propertyNameOrOptions;
			message = `Multiple initializations of property ${propertyName} on class ${className}!`;
			options = maybeOptions;
		} else {
			message = `Multiple initializations of class ${className}!`;
			options = propertyNameOrOptions ?? maybeOptions;
		}

		super(message, options);
	}
}

export function nameof(f: () => any) {
	return f.toString().replace(/[ |()=>]/g, "");
}

export abstract class Enum<T> {
	protected readonly instanceId: number;
	protected readonly value: T | undefined;

	protected constructor(instanceId: number, value?: T) {
		this.instanceId = instanceId;
		this.value = value;
	}

	public valueOf(): number {
		return this.instanceId;
	}

	public toJSON(): string {
		return this.value?.toString() ?? this.instanceId.toString();
	}

	public toString(): string {
		return this.value?.toString() ?? this.instanceId.toString();
	}
}
