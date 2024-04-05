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
