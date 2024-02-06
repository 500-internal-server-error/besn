export function random(minInclusive: number, maxInclusive: number) {
	// Evenly distributed random javascript integer
	// https://stackoverflow.com/a/1527820

	return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

export function getRandomColor() {
	return random(0, 2**24 - 1);
}
