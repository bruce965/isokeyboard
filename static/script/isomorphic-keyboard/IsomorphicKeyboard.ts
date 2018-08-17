import { ObservableSource } from '../util/observable';
import { intersect, except } from '../util/collections';
import classes from './style.less'

const ISOMORPHIC_KEYBOARD_CLASSNAME = classes['isomorphic-keyboard']
const HEXAGON_KEY_CLASSNAME = classes['hexagon-key']
const LABEL_CLASSNAME = classes['label']
const ACTIVE_CLASSNAME = classes['active']

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const SQRT_3 = Math.sqrt(3)

const KEYBOARD_SIZE_X = 1000
const KEYBOARD_SIZE_Y = KEYBOARD_SIZE_X * 9 / 16

const HEXAGON_SIZE = 100
const HEXAGON_SIZE_X = HEXAGON_SIZE * 0.75
const HEXAGON_SIZE_Y = HEXAGON_SIZE * SQRT_3 / 2
const HEXAGON_OFFSET_X = 0
const HEXAGON_OFFSET_Y = HEXAGON_SIZE_Y / 2

/**
 * Isomorphic keyboard layout generator settings.
 */
export interface IIsomorphicKeyboardSettings<TKeyData> {
	keys: IKey<TKeyData>[]
}

/**
 * Informations about a key.
 */
export interface IKey<TData> {
	row: number
	column: number
	label: string,
	color: string
	data: TData
}

export interface IKeyEvent<TData> {
	eventId: number
	data: TData
}

/**
 * Isomorphic keyboard layout generator.
 */
export default class IsomorphicKeyboard<TKeyData> {

	public readonly el: SVGSVGElement

	public readonly keyActivated: Observable<IKeyEvent<TKeyData>> = new ObservableSource<IKeyEvent<TKeyData>>()
	public readonly keyDeactivated: Observable<IKeyEvent<TKeyData>> = new ObservableSource<IKeyEvent<TKeyData>>()

	constructor(settings: IIsomorphicKeyboardSettings<TKeyData>) {
		this.el = document.createElementNS(SVG_NAMESPACE, 'svg')
		this.el.setAttribute('viewBox', '0 0 0 0')  // give this element a `viewBox`, is there a better way?
		this.el.viewBox.baseVal.width = KEYBOARD_SIZE_X
		this.el.viewBox.baseVal.height = KEYBOARD_SIZE_Y
		this.el.classList.add(ISOMORPHIC_KEYBOARD_CLASSNAME)

		const keys = document.createElementNS(SVG_NAMESPACE, 'g')
		this.el.appendChild(keys)

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
		keys.transform.baseVal.initialize(transform)

		const allKeys: { polygon: SVGPolygonElement, keyActivated: () => void, keyDeactivated: () => void }[] = []

		let nextEventId = 0

		for (const key of settings.keys) {
			let activateEventId: number

			allKeys.push({
				polygon: addKey(this.el, keys, key.row, key.column, key.color, key.label, rotation),
				keyActivated: () => (this.keyActivated as ObservableSource<IKeyEvent<TKeyData>>).next({ eventId: activateEventId = nextEventId++, data: key.data }),
				keyDeactivated: () => (this.keyDeactivated as ObservableSource<IKeyEvent<TKeyData>>).next({ eventId: activateEventId, data: key.data })
			})
		}

		this._handleInput(allKeys);
	}

	private _handleInput(allKeys: { polygon: SVGPolygonElement, keyActivated: () => void, keyDeactivated: () => void }[]): void {
		const allPolygons = allKeys.map(key => key.polygon)
		const getPolygonKey = (polygon: SVGPolygonElement) => {
			for (const key of allKeys)
				if (key.polygon == polygon)
					return key

			return undefined as never
		}

		const mouseActiveKeys: SVGPolygonElement[] = []
		const touchActiveKeys: { [touchId: number]: SVGPolygonElement[] } = {}
		const allTouchActiveKeys = () => {
			const keys: SVGPolygonElement[] = []
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
				const keys = intersect(allPolygons, document.elementsFromPoint(e.clientX, e.clientY))
				
				// activate keys that are not already active
				for (const key of except(keys, allActiveKeys())) {
					mouseActiveKeys.push(key)
					key.classList.add(ACTIVE_CLASSNAME)
					getPolygonKey(key).keyActivated()
				}
			}
		})
		this.el.addEventListener('mousemove', e => {
			if (e.buttons & 1) {
				e.preventDefault()

				// get keys under the cursor
				const keys = intersect(allPolygons, document.elementsFromPoint(e.clientX, e.clientY))
				
				// deactivate keys that are not under the cursor anymore, unless under a touch
				for (const key of except(mouseActiveKeys, keys, allTouchActiveKeys())) {
					const index = mouseActiveKeys.indexOf(key)
					mouseActiveKeys.splice(index, 1)

					key.classList.remove(ACTIVE_CLASSNAME)
					getPolygonKey(key).keyDeactivated()
				}

				// activate keys that are under the cursor, unless already active
				for (const key of except(keys, allActiveKeys())) {
					mouseActiveKeys.push(key)
					key.classList.add(ACTIVE_CLASSNAME)
					getPolygonKey(key).keyActivated()
				}
			}
		})
		this.el.addEventListener('mouseup', e => {
			if (!(e.buttons & 1)) {
				e.preventDefault()

				// deactivate all keys under the cursor, unless also under a touch
				for (const key of except(mouseActiveKeys, allTouchActiveKeys())) {
					key.classList.remove(ACTIVE_CLASSNAME)
					getPolygonKey(key).keyDeactivated()
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
				const keys = intersect(allPolygons, document.elementsFromPoint(touch.clientX, touch.clientY))
				
				// activate keys that are not already active
				for (const key of except(keys, allActiveKeys())) {
					touchActiveKeys[touch.identifier].push(key)
					key.classList.add(ACTIVE_CLASSNAME)
					getPolygonKey(key).keyActivated()
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
				const keys = intersect(allPolygons, document.elementsFromPoint(touch.clientX, touch.clientY))
				
				// deactivate keys that are not under the touch anymore, unless under the cursor or another touch
				for (const key of except(touchActiveKeys[touch.identifier], keys, allActiveKeysExceptTouch(touch.identifier))) {
					const index = touchActiveKeys[touch.identifier].indexOf(key)
					touchActiveKeys[touch.identifier].splice(index, 1)

					key.classList.remove(ACTIVE_CLASSNAME)
					getPolygonKey(key).keyDeactivated()
				}

				// activate keys that are under the touch, unless already active
				for (const key of except(keys, allActiveKeys())) {
					touchActiveKeys[touch.identifier].push(key)
					key.classList.add(ACTIVE_CLASSNAME)
					getPolygonKey(key).keyActivated()
				}
			}
		})
		this.el.addEventListener('touchend', e => {
			e.preventDefault()
			
			for (let i = 0; i < e.changedTouches.length; i++) {
				const touch = e.changedTouches.item(i) as Touch

				// deactivate all keys under the touch, unless also under the cursor or another touch
				for (const key of except(touchActiveKeys[touch.identifier], allActiveKeysExceptTouch(touch.identifier))) {
					key.classList.remove(ACTIVE_CLASSNAME)
					getPolygonKey(key).keyDeactivated()
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

function addKey(svg: SVGSVGElement, keys: SVGGElement, row: number, column: number, color: string, label: string, rotation: number): SVGPolygonElement {
	const transform = svg.createSVGTransform()
	transform.setTranslate(
		row * HEXAGON_SIZE_X + (row % 2) * HEXAGON_OFFSET_X,
		column * HEXAGON_SIZE_Y + (row % 2) * HEXAGON_OFFSET_Y
	)

	const labelTransformTranslate = svg.createSVGTransform()
	labelTransformTranslate.setTranslate(HEXAGON_SIZE/2, HEXAGON_SIZE_Y/2)
	
	const labelTransformRotate = svg.createSVGTransform()
	labelTransformRotate.setRotate(-rotation * 180 / Math.PI, 0, 0)

	const g = document.createElementNS(SVG_NAMESPACE, 'g')
	g.transform.baseVal.initialize(transform)
	keys.appendChild(g)

	const hexagon = makeHexagonPolygon(svg, HEXAGON_SIZE)
	hexagon.classList.add(HEXAGON_KEY_CLASSNAME)
	hexagon.style.fill = color
	g.appendChild(hexagon)

	const text = document.createElementNS(SVG_NAMESPACE, 'text')
	text.transform.baseVal.initialize(labelTransformTranslate)
	text.transform.baseVal.appendItem(labelTransformRotate)
	text.classList.add(LABEL_CLASSNAME)
	text.dy.baseVal.initialize(svgLength(svg, '.3em'))
	g.appendChild(text)

	const labelText = document.createTextNode(label)
	text.appendChild(labelText)

	return hexagon
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
