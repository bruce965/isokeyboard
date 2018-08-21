import { ObservableSource } from '../util/observable'
import { intersect, except } from '../util/collections'
import { mod } from '../util/math'
import classes from './style.less'

const ISOMORPHIC_KEYBOARD_CLASSNAME = classes['isomorphic-keyboard']
const HEXAGON_KEY_CLASSNAME = classes['hexagon-key']
const BORDER_CLASSNAME = classes['border']
const LABEL_CLASSNAME = classes['label']
const ACTIVE_CLASSNAME = classes['active']

const KEY_ID_SYMBOL = Symbol()

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const SQRT_3 = Math.sqrt(3)

const KEYBOARD_SIZE_X = 1024
const KEYBOARD_SIZE_Y = KEYBOARD_SIZE_X * 9 / 16

const HEXAGON_SIZE = 100
const HEXAGON_SIZE_X = HEXAGON_SIZE * 0.75
const HEXAGON_SIZE_Y = HEXAGON_SIZE * SQRT_3 / 2
const HEXAGON_OFFSET_X = 0
const HEXAGON_OFFSET_Y = HEXAGON_SIZE_Y / 2

/**
 * Isomorphic keyboard layout generator settings.
 */
export interface IIsomorphicKeyboardSettings {
	/** Highlight active keys, disable to improve performance. */
	highlightActiveKeys: boolean
	/** Use keyboard to play some keys. */
	mapToKeyboard: boolean
	/** How many semitones to increment for each step upwards. */
	verticalIncrement: number
	/** How many semitones to increment for each step upwards on the right. */
	diagonalIncrement: number
	/** Generate key labels. */
	getKeyLabel: (semitoneIndex: number) => string
	/** Generate key colors. */
	getKeyColor: (semitoneIndex: number) => { bg: string, fg: string }
}

export interface IKeyEvent {
	eventId: number
	semitoneIndex: number
}

interface IKeyTouchElement extends SVGElement {
	[KEY_ID_SYMBOL]: number
}

interface IKey {
	keyId: number
	x: number
	y: number
	styleEl: SVGElement
	touchEl: SVGElement & IKeyTouchElement
	keyActivated(): void
	keyDeactivated(): void
}

/**
 * Isomorphic keyboard layout generator.
 */
export default class IsomorphicKeyboard {

	public readonly el: SVGSVGElement

	private readonly _highlightActiveKeys: boolean
	private readonly _mapToKeyboard: boolean

	public readonly keyActivated: Observable<IKeyEvent> = new ObservableSource<IKeyEvent>()
	public readonly keyDeactivated: Observable<IKeyEvent> = new ObservableSource<IKeyEvent>()

	constructor(settings: IIsomorphicKeyboardSettings) {
		this.el = document.createElementNS(SVG_NAMESPACE, 'svg')
		this.el.setAttribute('tabindex', '0')
		this.el.setAttribute('viewBox', '0 0 0 0')  // give this element a `viewBox`, is there a better way?
		this.el.viewBox.baseVal.width = KEYBOARD_SIZE_X
		this.el.viewBox.baseVal.height = KEYBOARD_SIZE_Y
		this.el.classList.add(ISOMORPHIC_KEYBOARD_CLASSNAME)

		this._highlightActiveKeys = settings.highlightActiveKeys
		this._mapToKeyboard = settings.mapToKeyboard

		const hexagons = document.createElementNS(SVG_NAMESPACE, 'g')
		this.el.appendChild(hexagons)

		const touch = document.createElementNS(SVG_NAMESPACE, 'g')
		this.el.appendChild(touch)

		//                               ___
		//                              / ._\_____
		//       ___     ___     ___    \_|_/     ￪
		//   ___/   \___/   \___/   \___/ | \ 1.5*SIZE_Y
		//  / ._\___/___\___/___\___/___\_|_/_____￬
		//  \_|_/   \___/   \___/   \___/ |
		//    |⟵        7*SIZE_X         ⟶|

		// we rotate the keys so that the two points in the example above lie on the horizontal axis
		const rotation = Math.atan((1.5*HEXAGON_SIZE_Y) / (7*HEXAGON_SIZE_X))

		const transformTranslate = this.el.createSVGTransform()
		transformTranslate.setTranslate(KEYBOARD_SIZE_X/2, KEYBOARD_SIZE_Y/2)

		const transformRotate = this.el.createSVGTransform()
		transformRotate.setRotate(rotation * 180 / Math.PI, 0, 0)

		hexagons.transform.baseVal.initialize(transformTranslate)
		hexagons.transform.baseVal.appendItem(transformRotate)

		touch.transform.baseVal.initialize(transformTranslate)
		touch.transform.baseVal.appendItem(transformRotate)

		const allKeys: IKey[] = []

		let nextEventId = 0

		// TODO: only add keys that are visible on the screen.
		for (let x = -Math.floor(KEYBOARD_SIZE_X/HEXAGON_SIZE_X); x < KEYBOARD_SIZE_X/HEXAGON_SIZE_X; x++) {
			for (let y = -Math.floor(KEYBOARD_SIZE_Y/HEXAGON_SIZE_Y); y < KEYBOARD_SIZE_Y/HEXAGON_SIZE_Y; y++) {
				let activateEventId: number

				const diagonal = x
				const vertical = -y + Math.floor(-x/2)

				const semitoneIndex = diagonal * settings.diagonalIncrement + vertical * settings.verticalIncrement

				const { styleEl, touchEl } = addKey(this.el, hexagons, touch, x, y, settings.getKeyColor(semitoneIndex), settings.getKeyLabel(semitoneIndex), rotation)

				const keyId = allKeys.length
				;(touchEl as IKeyTouchElement)[KEY_ID_SYMBOL] = keyId

				allKeys.push({
					keyId,
					x, y,
					styleEl: styleEl,
					touchEl: touchEl as IKeyTouchElement,
					keyActivated: () => (this.keyActivated as ObservableSource<IKeyEvent>).next({ eventId: activateEventId = nextEventId++, semitoneIndex: semitoneIndex }),
					keyDeactivated: () => (this.keyDeactivated as ObservableSource<IKeyEvent>).next({ eventId: activateEventId, semitoneIndex: semitoneIndex })
				})
			}
		}

		this._handleInput(allKeys)
	}

	private _handleInput(allKeys: IKey[]): void {
		const getTouchedKeys = (e: MouseEvent|Touch) => {
			const keys: IKey[] = []
			for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
				const id = (el as IKeyTouchElement)[KEY_ID_SYMBOL]
				if (id != null)
					keys.push(allKeys[id])
			}

			return keys
		}

		const mouseActiveKeys: IKey[] = []
		const touchActiveKeys: { [touchId: number]: IKey[] } = {}
		const keyboardActiveKeys: IKey[] = []
		const allTouchActiveKeys = () => {
			const keys: IKey[] = []
			for (const touchId in touchActiveKeys)
				keys.push(...touchActiveKeys[touchId])
			return keys
		}
		const allActiveKeys = () => {
			const keys = allTouchActiveKeys()
			keys.push(...mouseActiveKeys)
			keys.push(...keyboardActiveKeys)
			return keys
		}
		const allActiveKeysExceptTouch = (touchId: number) => {
			return except(allActiveKeys(), touchActiveKeys[touchId] || [])
		}

		// handle mouse
		this.el.addEventListener('mousedown', e => {
			if (e.buttons & 1) {
				e.preventDefault()
				;(this.el as Element as HTMLElement).focus()

				// get keys under the cursor
				const keys = getTouchedKeys(e)

				// activate keys that are not already active
				for (const key of except(keys, allActiveKeys())) {
					if (this._highlightActiveKeys)
						key.styleEl.classList.add(ACTIVE_CLASSNAME)

					key.keyActivated()
				}

				for (const key of except(keys, mouseActiveKeys))
					mouseActiveKeys.push(key)
			}
		})
		this.el.addEventListener('mousemove', e => {
			if (e.buttons & 1) {
				e.preventDefault()

				// get keys under the cursor
				const keys = getTouchedKeys(e)

				// deactivate keys that are not under the cursor anymore, unless under a touch or active by keyboard
				for (const key of except(mouseActiveKeys, keys, allTouchActiveKeys(), keyboardActiveKeys)) {
					key.styleEl.classList.remove(ACTIVE_CLASSNAME)
					key.keyDeactivated()
				}

				// activate keys that are under the cursor, unless already active
				for (const key of except(keys, allActiveKeys())) {
					if (this._highlightActiveKeys)
						key.styleEl.classList.add(ACTIVE_CLASSNAME)

					key.keyActivated()
				}

				mouseActiveKeys.length = 0
				mouseActiveKeys.push(...keys)
			}
		})
		this.el.addEventListener('mouseup', e => {
			if (!(e.buttons & 1)) {
				e.preventDefault()

				// deactivate all keys under the cursor, unless also under a touch or active by keyboard
				for (const key of except(mouseActiveKeys, allTouchActiveKeys(), keyboardActiveKeys)) {
					key.styleEl.classList.remove(ACTIVE_CLASSNAME)
					key.keyDeactivated()
				}

				mouseActiveKeys.length = 0
			}
		})

		// handle touch
		this.el.addEventListener('touchstart', e => {
			e.preventDefault()
			;(this.el as Element as HTMLElement).focus()

			for (let i = 0; i < e.changedTouches.length; i++) {
				const touch = e.changedTouches.item(i) as Touch

				if (!touchActiveKeys[touch.identifier])
					touchActiveKeys[touch.identifier] = []

				// get keys under the touch
				const keys = getTouchedKeys(touch)

				// activate keys that are not already active
				for (const key of except(keys, allActiveKeys())) {
					if (this._highlightActiveKeys)
						key.styleEl.classList.add(ACTIVE_CLASSNAME)

					key.keyActivated()
				}

				for (const key of except(keys, touchActiveKeys[touch.identifier]))
					touchActiveKeys[touch.identifier].push(key)
			}
		})
		this.el.addEventListener('touchmove', e => {
			e.preventDefault()

			for (let i = 0; i < e.changedTouches.length; i++) {
				const touch = e.changedTouches.item(i) as Touch

				if (!touchActiveKeys[touch.identifier])
					touchActiveKeys[touch.identifier] = []

				// get keys under the touch
				const keys = getTouchedKeys(touch)

				// deactivate keys that are not under the touch anymore, unless under the cursor or another touch or active by keyboard
				for (const key of except(touchActiveKeys[touch.identifier], keys, allActiveKeysExceptTouch(touch.identifier), keyboardActiveKeys)) {
					key.styleEl.classList.remove(ACTIVE_CLASSNAME)
					key.keyDeactivated()
				}

				// activate keys that are under the touch, unless already active
				for (const key of except(keys, allActiveKeys())) {
					if (this._highlightActiveKeys)
						key.styleEl.classList.add(ACTIVE_CLASSNAME)

					key.keyActivated()
				}

				touchActiveKeys[touch.identifier].length = 0
				touchActiveKeys[touch.identifier].push(...keys)
			}
		})
		this.el.addEventListener('touchend', e => {
			e.preventDefault()

			for (let i = 0; i < e.changedTouches.length; i++) {
				const touch = e.changedTouches.item(i) as Touch

				// deactivate all keys under the touch, unless also under the cursor or another touch or active by keyboard
				for (const key of except(touchActiveKeys[touch.identifier], allActiveKeysExceptTouch(touch.identifier), keyboardActiveKeys)) {
					key.styleEl.classList.remove(ACTIVE_CLASSNAME)
					key.keyDeactivated()
				}

				delete touchActiveKeys[touch.identifier]
			}
		})

		// handle keyboard
		if (this._mapToKeyboard) {
			const KEYCODE_TO_KEY: { [keyCode: number]: IKey } = {
				192: allKeys.filter(k => k.x == -7 && k.y ==  1)[0],  // `
				 49: allKeys.filter(k => k.x == -6 && k.y ==  1)[0],  // 1
				 50: allKeys.filter(k => k.x == -5 && k.y ==  0)[0],  // 2
				 51: allKeys.filter(k => k.x == -4 && k.y ==  0)[0],  // 3
				 52: allKeys.filter(k => k.x == -3 && k.y == -1)[0],  // 4
				 53: allKeys.filter(k => k.x == -2 && k.y == -1)[0],  // 5
				 54: allKeys.filter(k => k.x == -1 && k.y == -2)[0],  // 6
				 55: allKeys.filter(k => k.x ==  0 && k.y == -2)[0],  // 7
				 56: allKeys.filter(k => k.x ==  1 && k.y == -3)[0],  // 8
				 57: allKeys.filter(k => k.x ==  2 && k.y == -3)[0],  // 9
				 48: allKeys.filter(k => k.x ==  3 && k.y == -4)[0],  // 0
				173: allKeys.filter(k => k.x ==  4 && k.y == -4)[0],  // -  // Firefox
				189: allKeys.filter(k => k.x ==  4 && k.y == -4)[0],  // -  // Chrome
				 61: allKeys.filter(k => k.x ==  5 && k.y == -5)[0],  // =  // Firefox
				187: allKeys.filter(k => k.x ==  5 && k.y == -5)[0],  // =  // Chrome
				  8: allKeys.filter(k => k.x ==  6 && k.y == -5)[0],  // Backspace

				  9: allKeys.filter(k => k.x == -6 && k.y ==  2)[0],  // Tab
				 81: allKeys.filter(k => k.x == -5 && k.y ==  1)[0],  // Q
				 87: allKeys.filter(k => k.x == -4 && k.y ==  1)[0],  // W
				 69: allKeys.filter(k => k.x == -3 && k.y ==  0)[0],  // E
				 82: allKeys.filter(k => k.x == -2 && k.y ==  0)[0],  // R
				 84: allKeys.filter(k => k.x == -1 && k.y == -1)[0],  // T
				 89: allKeys.filter(k => k.x ==  0 && k.y == -1)[0],  // Y
				 85: allKeys.filter(k => k.x ==  1 && k.y == -2)[0],  // U
				 73: allKeys.filter(k => k.x ==  2 && k.y == -2)[0],  // I
				 79: allKeys.filter(k => k.x ==  3 && k.y == -3)[0],  // O
				 80: allKeys.filter(k => k.x ==  4 && k.y == -3)[0],  // P
				219: allKeys.filter(k => k.x ==  5 && k.y == -4)[0],  // [
				221: allKeys.filter(k => k.x ==  6 && k.y == -4)[0],  // ]

				 20: allKeys.filter(k => k.x == -5 && k.y ==  2)[0],  // Caps Lock
				 65: allKeys.filter(k => k.x == -4 && k.y ==  2)[0],  // A
				 83: allKeys.filter(k => k.x == -3 && k.y ==  1)[0],  // S
				 68: allKeys.filter(k => k.x == -2 && k.y ==  1)[0],  // D
				 70: allKeys.filter(k => k.x == -1 && k.y ==  0)[0],  // F
				 71: allKeys.filter(k => k.x ==  0 && k.y ==  0)[0],  // G
				 72: allKeys.filter(k => k.x ==  1 && k.y == -1)[0],  // H
				 74: allKeys.filter(k => k.x ==  2 && k.y == -1)[0],  // J
				 75: allKeys.filter(k => k.x ==  3 && k.y == -2)[0],  // K
				 76: allKeys.filter(k => k.x ==  4 && k.y == -2)[0],  // L
				 59: allKeys.filter(k => k.x ==  5 && k.y == -3)[0],  // ;  // Firefox
				186: allKeys.filter(k => k.x ==  5 && k.y == -3)[0],  // ;  // Chrome
				222: allKeys.filter(k => k.x ==  6 && k.y == -3)[0],  // '
				//220: allKeys.filter(k => k.x ==  7 && k.y == -4)[0],  // \
				//13: allKeys.filter(k => k.x ==  8 && k.y == -4)[0],  // Enter

				//16: allKeys.filter(k => k.x == -5 && k.y ==  3)[0],  // Shift
				//220: allKeys.filter(k => k.x == -4 && k.y ==  3)[0],  // \
				 90: allKeys.filter(k => k.x == -3 && k.y ==  2)[0],  // Z
				 88: allKeys.filter(k => k.x == -2 && k.y ==  2)[0],  // X
				 67: allKeys.filter(k => k.x == -1 && k.y ==  1)[0],  // C
				 86: allKeys.filter(k => k.x ==  0 && k.y ==  1)[0],  // V
				 66: allKeys.filter(k => k.x ==  1 && k.y ==  0)[0],  // B
				 78: allKeys.filter(k => k.x ==  2 && k.y ==  0)[0],  // N
				 77: allKeys.filter(k => k.x ==  3 && k.y == -1)[0],  // M
				188: allKeys.filter(k => k.x ==  4 && k.y == -1)[0],  // ,
				190: allKeys.filter(k => k.x ==  5 && k.y == -2)[0],  // .
				191: allKeys.filter(k => k.x ==  6 && k.y == -2)[0],  // /
				//16: allKeys.filter(k => k.x ==  7 && k.y == -3)[0],  // Shift
			}

			;(this.el as Element as HTMLElement).addEventListener('keydown', e => {
				const key = KEYCODE_TO_KEY[e.keyCode]
				if (key != null) {
					e.preventDefault()

					// activate key, unless already active
					if (allActiveKeys().indexOf(key) == -1) {
						if (this._highlightActiveKeys)
							key.styleEl.classList.add(ACTIVE_CLASSNAME)

						key.keyActivated()
					}

					if (keyboardActiveKeys.indexOf(key) == -1)
						keyboardActiveKeys.push(key)
				}
			})
			;(this.el as Element as HTMLElement).addEventListener('keyup', e => {
				const key = KEYCODE_TO_KEY[e.keyCode]
				if (key != null) {
					e.preventDefault()

					// deactivate key, unless under the cursor or under a touch
					if (mouseActiveKeys.indexOf(key) == -1 && allTouchActiveKeys().indexOf(key) == -1) {
						key.styleEl.classList.remove(ACTIVE_CLASSNAME)
						key.keyDeactivated()
					}

					const index = keyboardActiveKeys.indexOf(key)
					keyboardActiveKeys.splice(index, 1)
				}
			})
		}
	}
}

function svgPoint(svg: SVGSVGElement, x: number, y: number): SVGPoint {
	const point = svg.createSVGPoint()
	point.x = x
	point.y = y
	return point
}

function svgLength(svg: SVGSVGElement, value: string): SVGLength {
	const length = svg.createSVGLength()
	length.valueAsString = value
	return length
}

function addKey(svg: SVGSVGElement, hexagons: SVGGElement, touch: SVGGElement, row: number, column: number, color: { bg: string, fg: string }, label: string, rotation: number): { styleEl: SVGElement, touchEl: SVGElement } {
	const transform = svg.createSVGTransform()
	transform.setTranslate(
		   row * HEXAGON_SIZE_X + mod(row, 2) * HEXAGON_OFFSET_X - HEXAGON_SIZE/2,
		column * HEXAGON_SIZE_Y + mod(row, 2) * HEXAGON_OFFSET_Y - HEXAGON_SIZE_Y/2
	)

	const labelTransformTranslate = svg.createSVGTransform()
	labelTransformTranslate.setTranslate(HEXAGON_SIZE/2, HEXAGON_SIZE_Y/2)

	const labelTransformRotate = svg.createSVGTransform()
	labelTransformRotate.setRotate(-rotation * 180 / Math.PI, 0, 0)

	const g = document.createElementNS(SVG_NAMESPACE, 'g')
	g.transform.baseVal.initialize(transform)
	hexagons.appendChild(g)

	const hexagon = makeHexagonPolygon(svg, HEXAGON_SIZE)
	hexagon.classList.add(HEXAGON_KEY_CLASSNAME)
	hexagon.style.fill = color.bg
	g.appendChild(hexagon)

	const border = makeHexagonPolygon(svg, HEXAGON_SIZE)
	border.transform.baseVal.initialize(transform)
	border.classList.add(BORDER_CLASSNAME)
	touch.appendChild(border)

	const text = document.createElementNS(SVG_NAMESPACE, 'text')
	text.transform.baseVal.initialize(labelTransformTranslate)
	text.transform.baseVal.appendItem(labelTransformRotate)
	text.classList.add(LABEL_CLASSNAME)
	text.dy.baseVal.initialize(svgLength(svg, '.3em'))
	text.style.fill = color.fg
	g.appendChild(text)

	const labelText = document.createTextNode(label)
	text.appendChild(labelText)

	return { styleEl: hexagon, touchEl: border }
}

function makeHexagonPolygon(svg: SVGSVGElement, size: number): SVGPolygonElement {

	// ^  |⟵     2x    ⟶|
	// |  |             |
	// y2⎯|⎯ E-------D ⎯|⎯⎯⎯
	// |  | /         \ |  ￪
	// |  |/           \|
	// y1 F  |⟵  x  ⟶|  C x√3
	// |  |\ |       | /|
	// |  | \|       |/ |  ￬
	// y0⎯|⎯ A-------B ⎯⎯⎯⎯⎯
	// |  |  |       |  |
	// o⎯⎯x0⎯x1⎯⎯⎯⎯⎯⎯x2⎯x3⎯⎯>

	const x0 = 0
	const x1 = .25
	const x2 = .75
	const x3 = 1
	const y0 = SQRT_3 / 2
	const y1 = SQRT_3 / 4
	const y2 = 0

	const a = svgPoint(svg, x1 * size, y0 * size)
	const b = svgPoint(svg, x2 * size, y0 * size)
	const c = svgPoint(svg, x3 * size, y1 * size)
	const d = svgPoint(svg, x2 * size, y2 * size)
	const e = svgPoint(svg, x1 * size, y2 * size)
	const f = svgPoint(svg, x0 * size, y1 * size)

	const hexagon = document.createElementNS(SVG_NAMESPACE, 'polygon')
	hexagon.points.appendItem(a)
	hexagon.points.appendItem(b)
	hexagon.points.appendItem(c)
	hexagon.points.appendItem(d)
	hexagon.points.appendItem(e)
	hexagon.points.appendItem(f)

	return hexagon
}
