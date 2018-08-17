
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}

export function mod(value: number, m: number) {
	return ((value % m) + m) % m
}
