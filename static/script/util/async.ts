
/** Wait `delay` milliseconds before resolving. */
export function delay(delay: number): Promise<void> {
	return new Promise<void>(resolve => void setTimeout(resolve, delay))
}
