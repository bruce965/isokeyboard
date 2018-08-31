
export const KEY_ID_SYMBOL = Symbol()

export interface IKey {
	keyId: number
	x: number
	y: number
	styleEl: SVGElement
	touchEl: SVGElement & IKeyTouchElement
	keyActivated(source: string, pitchBend: number): void
	keyDeactivated(source: string): void
	pitchBending(source: string, pitchBend: number): void
}

export interface IKeyTouchElement extends SVGElement {
	[KEY_ID_SYMBOL]: number
}
