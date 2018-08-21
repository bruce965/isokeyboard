
/** Wait `delay` milliseconds before resolving. */
export function delay(delay: number): Promise<void> {
	return new Promise<void>(resolve => void setTimeout(resolve, delay))
}

/** Wait for the next animation frame. */
export function animationFrame(): Promise<number> {
	return new Promise<number>(resolve => void requestAnimationFrame(resolve))
}

/** Wait for the next CSS update. */
export async function cssUpdate(): Promise<number> {
	return await animationFrame() + await animationFrame()
}
