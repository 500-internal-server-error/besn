import * as fs from "fs";
import * as path from "path";

export function random(minInclusive: number, maxInclusive: number) {
	// Evenly distributed random javascript integer
	// https://stackoverflow.com/a/1527820

	return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

export function getRandomColor() {
	return random(0, 2**24 - 1);
}

export function openLogFileHandle(fileName: string): fs.WriteStream {
	fs.mkdirSync(path.dirname(fileName), { recursive: true });
	return fs.createWriteStream(fileName, { flags: "a+", mode: 0o644, flush: true });
}
