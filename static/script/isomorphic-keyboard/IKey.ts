
export const KEY_ID_SYMBOL = Symbol()

export interface IKey {
	keyId: number
	x: number
	y: number
	styleEl: SVGElement
	touchEl: SVGElement & IKeyTouchElement
	keyActivated(): void
	keyDeactivated(): void
}

export interface IKeyTouchElement extends SVGElement {
	[KEY_ID_SYMBOL]: number
}
