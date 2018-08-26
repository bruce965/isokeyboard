import { OmitReadonly, OmitFieldsOfType, Omit } from "../util/types"

export namespace JSX {

	/** Omit from type `T` all methods and readonly fields. */
	type OmitMethodsAndReadonly<T> = OmitReadonly<OmitFieldsOfType<T, Function>>

	/** Get an element type from its tag name `K`. */
	type ElementByTag<K> = K extends keyof HTMLElementTagNameMapExtended ? HTMLElementTagNameMapExtended[K] : HTMLElement

	/** Get the list of properties assignable to an element with tag name `K`. */
	type Properties<K extends TagName> =
		Omit<OmitMethodsAndReadonly<ElementByTag<K>>, 'style'> &
		{ style: Partial<OmitMethodsAndReadonly<CSSStyleDeclaration>> }

	type PropertiesAndAttributesByTag<K extends TagName> = Partial<Properties<K>> & { [attribute: string]: any }

	type TagName = keyof HTMLElementTagNameMapExtended

	interface HTMLElementTagNameMapExtended extends HTMLElementTagNameMap {
		'dialog': HTMLDialogElement
		//[tagName: string]: HTMLElement
	}

	function flatten<T>(array: any[]): T[] {
		function _flatten(array: any[], destination: any[]) {
			for (const el of array) {
				if (Array.isArray(el))
					_flatten(array, destination)
				else
					destination.push(el)
			}
		}

		const flattened: T[] = []
		_flatten(array, flattened)
		return flattened
	}

	export type Element = ElementByTag<string>

	export type IntrinsicElements = {
		[P in TagName]: PropertiesAndAttributesByTag<P>
	}

	export function createElement<K extends TagName>(
		tagName: K,
		props?: PropertiesAndAttributesByTag<K>,
		...children: (Node | string | any)[]
	): ElementByTag<K> {
		const el = document.createElement(tagName)

		if (props) {
			for (const key in props) {
				if (key == 'style') {
					// style is handled as a special case
					const style = props[key] as CSSStyleDeclaration
					for (const styleKey in style)
						el.style[styleKey] = style[styleKey]
				}
				else if (key.indexOf('on') == 0 && key[2]) {
					// registering an event
					el.addEventListener(key.substr(2), props[key] as any)
				}
				else if (key in el) {
					// setting a property
					(el as any)[key] = props[key]
				}
				else if (props[key] == false && props[key] == null) {
					// removing an attribute
					el.removeAttribute(key)  // does it really make sense?
				}
				else if (props[key] == true) {
					// adding an attribute
					el.setAttribute(key, '')
				}
				else {
					// setting an attribute
					el.setAttribute(key, `${props[key]}`)
				}
			}
		}

		if (children) {
			for (const child of flatten(children)) {
				if (child instanceof Node)
					el.appendChild(child)
				else if (child != null)  // not `null` or `undefined`
					el.appendChild(document.createTextNode(`${child}`))
			}
		}

		return el as ElementByTag<K>
	}
}

// HACK: https://github.com/parcel-bundler/parcel/issues/1095
const createElement = JSX.createElement
export { createElement }
