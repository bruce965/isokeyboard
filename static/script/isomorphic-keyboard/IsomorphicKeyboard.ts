import { ObservableSource } from '../util/observable';
import { intersect, except } from '../util/collections';
import { mod } from '../util/math';
import classes from './style.less'

const ISOMORPHIC_KEYBOARD_CLASSNAME = classes['isomorphic-keyboard']
const HEXAGON_KEY_CLASSNAME = classes['hexagon-key']
const BORDER_CLASSNAME = classes['border']
const LABEL_CLASSNAME = classes['label']
const ACTIVE_CLASSNAME = classes['active']

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const SQRT_3 = Math.sqrt(3)

const KEYBOARD_SIZE_X = 2000
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
	/** How many semitones to increment for each step upwards. */
	verticalIncrement: number
	/** How many semitones to increment for each step upwards on the right. */
	diagonalIncrement: number
	/** Generate key labels. */
	getKeyLabel: (semitoneIndex: number) => string
	/** Generate key colors. */
	getKeyColor: (semitoneIndex: number) => string
}

export interface IKeyEvent {
	eventId: number
	semitoneIndex: number
}

/**
 * Isomorphic keyboard layout generator.
 */
export default class IsomorphicKeyboard {

	public readonly el: SVGSVGElement

	public readonly keyActivated: Observable<IKeyEvent> = new ObservableSource<IKeyEvent>()
	public readonly keyDeactivated: Observable<IKeyEvent> = new ObservableSource<IKeyEvent>()

	constructor(settings: IIsomorphicKeyboardSettings) {
		this.el = document.createElementNS(SVG_NAMESPACE, 'svg')
		this.el.setAttribute('viewBox', '0 0 0 0')  // give this element a `viewBox`, is there a better way?
		this.el.viewBox.baseVal.width = KEYBOARD_SIZE_X
		this.el.viewBox.baseVal.height = KEYBOARD_SIZE_Y
		this.el.classList.add(ISOMORPHIC_KEYBOARD_CLASSNAME)

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

		const transform = this.el.createSVGTransform()
		transform.setRotate(rotation * 180 / Math.PI, 0, 0)
		hexagons.transform.baseVal.initialize(transform)
		touch.transform.baseVal.initialize(transform)

		const allKeys: { styleEl: SVGElement, touchEl: SVGElement, keyActivated: () => void, keyDeactivated: () => void }[] = []

		let nextEventId = 0

		// TODO: only add keys that are visible on the screen.
		for (let x = -Math.floor(KEYBOARD_SIZE_X/HEXAGON_SIZE_X); x < 2*KEYBOARD_SIZE_X/HEXAGON_SIZE_X; x++) {
			for (let y = -Math.floor(KEYBOARD_SIZE_Y/HEXAGON_SIZE_Y); y < 2*KEYBOARD_SIZE_Y/HEXAGON_SIZE_Y; y++) {
				let activateEventId: number

				const diagonal = x
				const vertical = -y + Math.floor(-x/2)

				const semitoneIndex = diagonal * settings.diagonalIncrement + vertical * settings.verticalIncrement

				const { styleEl, touchEl } = addKey(this.el, hexagons, touch, x, y, settings.getKeyColor(semitoneIndex), settings.getKeyLabel(semitoneIndex), rotation)

				allKeys.push({
					styleEl: styleEl,
					touchEl: touchEl,
					keyActivated: () => (this.keyActivated as ObservableSource<IKeyEvent>).next({ eventId: activateEventId = nextEventId++, semitoneIndex: semitoneIndex }),
					keyDeactivated: () => (this.keyDeactivated as ObservableSource<IKeyEvent>).next({ eventId: activateEventId, semitoneIndex: semitoneIndex })
				})
			}
		}

		this._handleInput(allKeys);
	}

	private _handleInput(allKeys: { styleEl: SVGElement, touchEl: SVGElement, keyActivated: () => void, keyDeactivated: () => void }[]): void {
		const allTouchElements = allKeys.map(key => key.touchEl)
		const getElementKey = (touchEl: SVGElement) => {
			for (const key of allKeys)
				if (key.touchEl == touchEl)
					return key

			return undefined as never
		}

		const mouseActiveKeys: SVGElement[] = []
		const touchActiveKeys: { [touchId: number]: SVGElement[] } = {}
		const allTouchActiveKeys = () => {
			const keys: SVGElement[] = []
			for (const touchId in touchActiveKeys)
				keys.push(...touchActiveKeys[touchId])
			return keys
		}
		const allActiveKeys = () => {
			const keys = allTouchActiveKeys()
			keys.push(...mouseActiveKeys)
			return keys
		}
		const allActiveKeysExceptTouch = (touchId: number) => {
			return except(allActiveKeys(), touchActiveKeys[touchId] || [])
		}

		// handle mouse
		this.el.addEventListener('mousedown', e => {
			if (e.buttons & 1) {
				e.preventDefault()

				// get keys under the cursor
				const keys = intersect(allTouchElements, document.elementsFromPoint(e.clientX, e.clientY))

				// activate keys that are not already active
				for (const touchEl of except(keys, allActiveKeys())) {
					mouseActiveKeys.push(touchEl)

					const key = getElementKey(touchEl)
					key.styleEl.classList.add(ACTIVE_CLASSNAME)
					key.keyActivated()
				}
			}
		})
		this.el.addEventListener('mousemove', e => {
			if (e.buttons & 1) {
				e.preventDefault()

				// get keys under the cursor
				const keys = intersect(allTouchElements, document.elementsFromPoint(e.clientX, e.clientY))

				// deactivate keys that are not under the cursor anymore, unless under a touch
				for (const touchEl of except(mouseActiveKeys, keys, allTouchActiveKeys())) {
					const index = mouseActiveKeys.indexOf(touchEl)
					mouseActiveKeys.splice(index, 1)

					const key = getElementKey(touchEl)
					key.styleEl.classList.remove(ACTIVE_CLASSNAME)
					key.keyDeactivated()
				}

				// activate keys that are under the cursor, unless already active
				for (const touchEl of except(keys, allActiveKeys())) {
					mouseActiveKeys.push(touchEl)

					const key = getElementKey(touchEl)
					key.styleEl.classList.add(ACTIVE_CLASSNAME)
					key.keyActivated()
				}
			}
		})
		this.el.addEventListener('mouseup', e => {
			if (!(e.buttons & 1)) {
				e.preventDefault()

				// deactivate all keys under the cursor, unless also under a touch
				for (const touchEl of except(mouseActiveKeys, allTouchActiveKeys())) {
					const key = getElementKey(touchEl)
					key.styleEl.classList.remove(ACTIVE_CLASSNAME)
					key.keyDeactivated()
				}

				mouseActiveKeys.length = 0
			}
		})

		// handle touch
		this.el.addEventListener('touchstart', e => {
			e.preventDefault()

			for (let i = 0; i < e.changedTouches.length; i++) {
				const touch = e.changedTouches.item(i) as Touch

				if (!touchActiveKeys[touch.identifier])
					touchActiveKeys[touch.identifier] = []

				// get keys under the touch
				const keys = intersect(allTouchElements, document.elementsFromPoint(touch.clientX, touch.clientY))

				// activate keys that are not already active
				for (const touchEl of except(keys, allActiveKeys())) {
					touchActiveKeys[touch.identifier].push(touchEl)

					const key = getElementKey(touchEl)
					key.styleEl.classList.add(ACTIVE_CLASSNAME)
					key.keyActivated()
				}
			}
		})
		this.el.addEventListener('touchmove', e => {
			e.preventDefault()

			for (let i = 0; i < e.changedTouches.length; i++) {
				const touch = e.changedTouches.item(i) as Touch

				if (!touchActiveKeys[touch.identifier])
					touchActiveKeys[touch.identifier] = []

				// get keys under the touch
				const keys = intersect(allTouchElements, document.elementsFromPoint(touch.clientX, touch.clientY))

				// deactivate keys that are not under the touch anymore, unless under the cursor or another touch
				for (const touchEl of except(touchActiveKeys[touch.identifier], keys, allActiveKeysExceptTouch(touch.identifier))) {
					const index = touchActiveKeys[touch.identifier].indexOf(touchEl)
					touchActiveKeys[touch.identifier].splice(index, 1)

					const key = getElementKey(touchEl)
					key.styleEl.classList.remove(ACTIVE_CLASSNAME)
					key.keyDeactivated()
				}

				// activate keys that are under the touch, unless already active
				for (const touchEl of except(keys, allActiveKeys())) {
					touchActiveKeys[touch.identifier].push(touchEl)

					const key = getElementKey(touchEl)
					key.touchEl.classList.add(ACTIVE_CLASSNAME)
					key.keyActivated()
				}
			}
		})
		this.el.addEventListener('touchend', e => {
			e.preventDefault()

			for (let i = 0; i < e.changedTouches.length; i++) {
				const touch = e.changedTouches.item(i) as Touch

				// deactivate all keys under the touch, unless also under the cursor or another touch
				for (const touchEl of except(touchActiveKeys[touch.identifier], allActiveKeysExceptTouch(touch.identifier))) {
					const key = getElementKey(touchEl)
					touchEl.classList.remove(ACTIVE_CLASSNAME)
					key.keyDeactivated()
				}

				delete touchActiveKeys[touch.identifier]
			}
		})
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

function addKey(svg: SVGSVGElement, hexagons: SVGGElement, touch: SVGGElement, row: number, column: number, color: string, label: string, rotation: number): { styleEl: SVGElement, touchEl: SVGElement } {
	const transform = svg.createSVGTransform()
	transform.setTranslate(
		row * HEXAGON_SIZE_X + mod(row, 2) * HEXAGON_OFFSET_X,
		column * HEXAGON_SIZE_Y + mod(row, 2) * HEXAGON_OFFSET_Y
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
	hexagon.style.fill = color
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
