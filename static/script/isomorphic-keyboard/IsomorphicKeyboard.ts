import { ObservableSource } from '../util/observable'
import { except } from '../util/collections'
import { mod } from '../util/math'
import { IKey, IKeyTouchElement, KEY_ID_SYMBOL } from './IKey';
import classes from './style.less'
import KeyManager from './KeyManager';
import { miditest } from '../midi';

const ISOMORPHIC_KEYBOARD_CLASSNAME = classes['isomorphic-keyboard']
const HEXAGON_KEY_CLASSNAME = classes['hexagon-key']
const BORDER_CLASSNAME = classes['border']
const LABEL_CLASSNAME = classes['label']
const ACTIVE_CLASSNAME = classes['active']

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

export interface IPitchBendEvent extends IKeyEvent {
	pitchBend: number
}

/**
 * Isomorphic keyboard layout generator.
 */
export default class IsomorphicKeyboard {

	public readonly el: SVGSVGElement

	private readonly _keyManager = new KeyManager()
	private readonly _keys: { nextId: number, keys: { [keyId: number]: IKey } } = { nextId: 1, keys: {} }

	private readonly _highlightActiveKeys: boolean
	private readonly _mapToKeyboard: boolean

	public readonly keyActivated: Observable<IPitchBendEvent> = new ObservableSource<IPitchBendEvent>()
	public readonly keyDeactivated: Observable<IKeyEvent> = new ObservableSource<IKeyEvent>()
	public readonly pitchBending: Observable<IPitchBendEvent> = new ObservableSource<IPitchBendEvent>()

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

		let nextEventId = 0

		// TODO: only add keys that are visible on the screen.
		for (let x = -Math.floor(KEYBOARD_SIZE_X/HEXAGON_SIZE_X); x < KEYBOARD_SIZE_X/HEXAGON_SIZE_X; x++) {
			for (let y = -Math.floor(KEYBOARD_SIZE_Y/HEXAGON_SIZE_Y); y < KEYBOARD_SIZE_Y/HEXAGON_SIZE_Y; y++) {
				const activateEventIdBySource: { [source: string]: number } = {}

				const diagonal = x
				const vertical = -y + Math.floor(-x/2)

				const semitoneIndex = diagonal * settings.diagonalIncrement + vertical * settings.verticalIncrement

				const { styleEl, touchEl } = addKey(this.el, hexagons, touch, x, y, settings.getKeyColor(semitoneIndex), settings.getKeyLabel(semitoneIndex), rotation)

				const keyId = this._keys.nextId++
				;(touchEl as IKeyTouchElement)[KEY_ID_SYMBOL] = keyId

				this._keys.keys[keyId] = {
					keyId,
					x, y,
					styleEl: styleEl,
					touchEl: touchEl as IKeyTouchElement,
					keyActivated: (source, pitchBend) => {
						(this.keyActivated as ObservableSource<IPitchBendEvent>).next({
							eventId: activateEventIdBySource[source] = nextEventId++,
							semitoneIndex: semitoneIndex,
							pitchBend: pitchBend
						})
					},
					keyDeactivated: source => {
						(this.keyDeactivated as ObservableSource<IKeyEvent>).next({
							eventId: activateEventIdBySource[source],
							semitoneIndex: semitoneIndex
						})
						delete activateEventIdBySource[source]
					},
					pitchBending: (source, pitchBend) => {
						(this.pitchBending as ObservableSource<IPitchBendEvent>).next({
							eventId: activateEventIdBySource[source],
							semitoneIndex: semitoneIndex,
							pitchBend: pitchBend
						})
					}
				}
			}
		}

		this._handleInput()
	}

	private *_getTouchedKeyIds(e: MouseEvent|Touch): IterableIterator<number> {
		const keys: IKey[] = []
		for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
			const id = (el as IKeyTouchElement)[KEY_ID_SYMBOL]
			if (id != null)
				yield id
		}

		return keys
	}

	private _handleInput(): void {
		this._keyManager.keyActivated.subscribe(e => {
			const key = this._keys.keys[e.keyId]

			key.keyActivated(e.category, e.pitchBend)

			if (!e.isReactivation)
				key.styleEl.classList.add(ACTIVE_CLASSNAME)
		})

		this._keyManager.keyDeactivated.subscribe(e => {
			const key = this._keys.keys[e.keyId]

			key.keyDeactivated(e.category)

			if (e.isInactive)
				key.styleEl.classList.remove(ACTIVE_CLASSNAME)
		})

		this._keyManager.pitchBending.subscribe(e => {
			const key = this._keys.keys[e.keyId]

			key.pitchBending(e.category, e.pitchBend)
		})

		miditest(this._keyManager, this._keys.keys)

		// handle mouse
		this.el.addEventListener('mousedown', e => {
			if (e.buttons & 1) {
				e.preventDefault()
				;(this.el as Element as HTMLElement).focus()

				const currentKeys = this._getTouchedKeyIds(e)

				// activate keys under the cursor
				for (const keyId of currentKeys) {
					this._keyManager.activate('mouse', keyId)

					console.debug(`PRESSED keyId=${keyId}`)
				}
			}
		})
		this.el.addEventListener('mousemove', e => {
			if (e.buttons & 1) {
				e.preventDefault()

				const previousKeys = [...this._keyManager.getActiveKeyIds('mouse')]
				const currentKeys = [...this._getTouchedKeyIds(e)]

				// deactivate keys that are not under the cursor anymore
				for (const keyId of except(previousKeys, currentKeys))
					this._keyManager.deactivate('mouse', keyId)

				// activate keys under the cursor
				for (const keyId of currentKeys)
					this._keyManager.activate('mouse', keyId)
			}
		})
		this.el.addEventListener('mouseup', e => {
			if (!(e.buttons & 1)) {
				e.preventDefault()

				const previousKeys = [...this._keyManager.getActiveKeyIds('mouse')]

				// deactivate all keys activated with the cursor
				for (const keyId of previousKeys)
					this._keyManager.deactivate('mouse', keyId)
			}
		})

		// handle touch
		this.el.addEventListener('touchstart', e => {
			e.preventDefault()

			for (let i = 0; i < e.changedTouches.length; i++) {
				const touch = e.changedTouches.item(i) as Touch
				;(this.el as Element as HTMLElement).focus()

				const currentKeys = this._getTouchedKeyIds(touch)

				// activate keys under this touch
				for (const keyId of currentKeys)
					this._keyManager.activate(`touch_${touch.identifier}`, keyId)
			}
		})
		this.el.addEventListener('touchmove', e => {
			e.preventDefault()

			for (let i = 0; i < e.changedTouches.length; i++) {
				const touch = e.changedTouches.item(i) as Touch

				const previousKeys = [...this._keyManager.getActiveKeyIds(`touch_${touch.identifier}`)]
				const currentKeys = [...this._getTouchedKeyIds(touch)]

				// deactivate keys that are not under this touch anymore
				for (const keyId of except(previousKeys, currentKeys))
					this._keyManager.deactivate(`touch_${touch.identifier}`, keyId)

				// activate keys under this touch
				for (const keyId of currentKeys)
					this._keyManager.activate(`touch_${touch.identifier}`, keyId)
			}
		})
		this.el.addEventListener('touchend', e => {
			e.preventDefault()

			for (let i = 0; i < e.changedTouches.length; i++) {
				const touch = e.changedTouches.item(i) as Touch

				const previousKeys = [...this._keyManager.getActiveKeyIds(`touch_${touch.identifier}`)]

				// deactivate all keys activated with this touch
				for (const keyId of previousKeys)
					this._keyManager.deactivate('mouse', keyId)
			}
		})

		// handle keyboard
		if (this._mapToKeyboard) {
			const getKey = (x: number, y: number): IKey => {
				for (const keyId in this._keys.keys)
					if (this._keys.keys[keyId].x == x && this._keys.keys[keyId].y == y)
						return this._keys.keys[keyId]

				console.error(`Key not found: [${x}, ${y}]`)
				return undefined as never
			}

			const KEYCODE_TO_KEY: { [keyCode: number]: IKey } = {
				192: getKey(-7,  1),  // `
				 49: getKey(-6,  1),  // 1
				 50: getKey(-5,  0),  // 2
				 51: getKey(-4,  0),  // 3
				 52: getKey(-3, -1),  // 4
				 53: getKey(-2, -1),  // 5
				 54: getKey(-1, -2),  // 6
				 55: getKey( 0, -2),  // 7
				 56: getKey( 1, -3),  // 8
				 57: getKey( 2, -3),  // 9
				 48: getKey( 3, -4),  // 0
				173: getKey( 4, -4),  // -  // Firefox
				189: getKey( 4, -4),  // -  // Chrome
				 61: getKey( 5, -5),  // =  // Firefox
				187: getKey( 5, -5),  // =  // Chrome
				  8: getKey( 6, -5),  // Backspace

				  9: getKey(-6,  2),  // Tab
				 81: getKey(-5,  1),  // Q
				 87: getKey(-4,  1),  // W
				 69: getKey(-3,  0),  // E
				 82: getKey(-2,  0),  // R
				 84: getKey(-1, -1),  // T
				 89: getKey( 0, -1),  // Y
				 85: getKey( 1, -2),  // U
				 73: getKey( 2, -2),  // I
				 79: getKey( 3, -3),  // O
				 80: getKey( 4, -3),  // P
				219: getKey( 5, -4),  // [
				221: getKey( 6, -4),  // ]

				 20: getKey(-5,  2),  // Caps Lock
				 65: getKey(-4,  2),  // A
				 83: getKey(-3,  1),  // S
				 68: getKey(-2,  1),  // D
				 70: getKey(-1,  0),  // F
				 71: getKey( 0,  0),  // G
				 72: getKey( 1, -1),  // H
				 74: getKey( 2, -1),  // J
				 75: getKey( 3, -2),  // K
				 76: getKey( 4, -2),  // L
				 59: getKey( 5, -3),  // ;  // Firefox
				186: getKey( 5, -3),  // ;  // Chrome
				222: getKey( 6, -3),  // '
				//220: getKey( 7, -4),  // \
				//13: getKey( 8, -4),  // Enter

				//16: getKey(-5,  3),  // Shift
				//220: getKey(-4,  3),  // \
				 90: getKey(-3,  2),  // Z
				 88: getKey(-2,  2),  // X
				 67: getKey(-1,  1),  // C
				 86: getKey( 0,  1),  // V
				 66: getKey( 1,  0),  // B
				 78: getKey( 2,  0),  // N
				 77: getKey( 3, -1),  // M
				188: getKey( 4, -1),  // ,
				190: getKey( 5, -2),  // .
				191: getKey( 6, -2),  // /
				//16: getKey( 7, -3),  // Shift
			}

			;(this.el as Element as HTMLElement).addEventListener('keydown', e => {
				const key = KEYCODE_TO_KEY[e.keyCode]
				if (key != null) {
					e.preventDefault()

					// activate corresponding key
					this._keyManager.activate('keyboard', key.keyId)
				}
			})
			;(this.el as Element as HTMLElement).addEventListener('keyup', e => {
				const key = KEYCODE_TO_KEY[e.keyCode]
				if (key != null) {
					e.preventDefault()

					// deactivate corresponding key
					this._keyManager.deactivate('keyboard', key.keyId)
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
