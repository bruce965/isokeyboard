import { Dictionary } from "../util/collections";
import { ObservableSource } from "../util/observable";

export interface IKeyEvent {
	/** Unique id of the event. */
	eventId: number
	/** Id of the key. */
	keyId: number
	/** The category that triggered this event. */
	category: string
}

export interface IKeyActivatedEvent extends IKeyEvent {
	pitchBend: number
	/** `true` if key was already active in another category. */
	isReactivation: boolean
}

export interface IKeyDeactivatedEvent extends IKeyEvent {
	/** `true` if key not active in other categories. */
	isInactive: boolean
}

export interface IPitchBendEvent extends IKeyEvent {
	pitchBend: number
}

/**
 * Track the status of the keys in the keyboard.
 */
export default class KeyManager {

	// category = 'mouse', 'keyboard', 'touch_1', 'touch_2', etc...
	private readonly _category: Dictionary<string, { activeKeysCount: number, active: { [keyId: number]: boolean } }> = new Dictionary({ getHashCode: k => k, isEqual: (a, b) => a == b })

	private static _nextEventId = 1

	public readonly keyActivated: Observable<IKeyActivatedEvent> = new ObservableSource<IKeyActivatedEvent>()
	public readonly keyDeactivated: Observable<IKeyDeactivatedEvent> = new ObservableSource<IKeyDeactivatedEvent>()
	public readonly pitchBending: Observable<IPitchBendEvent> = new ObservableSource<IPitchBendEvent>()

	/** Check if a key is currently active. */
	public isActive(keyId: number): boolean {
		// the key is considered active if it's active on at least one category
		for (const category of this._category.values)
			if (category.active[keyId])
				return true

		return false
	}

	public *getActiveKeyIds(category: string): IterableIterator<number> {
		const x = this._category.get(category)
		if (!x)
			return

		for (const keyId in x.value.active)
			if (x.value.active[keyId])
				yield +keyId
	}

	public activate(category: string, keyId: number, pitchBend: number = 1): boolean {
		let categoryKeys
		const x = this._category.get(category)
		if (x)
			categoryKeys = x.value
		else
			this._category.set(category, categoryKeys = { activeKeysCount: 0, active: {} })  // if this is the first key activated in this category, create it

		// if the key was already active on this category, nothing to do
		if (categoryKeys.active[keyId])
			return false

		// check if the key is already active in another category
		const isReactivation = this.isActive(keyId)

		// activate the key in this category
		categoryKeys.active[keyId] = true

		// fire event
		;(this.keyActivated as ObservableSource<IKeyActivatedEvent>).next({ eventId: KeyManager._nextEventId++, keyId, category, pitchBend, isReactivation })

		return true
	}

	public deactivate(category: string, keyId: number): boolean {
		let categoryKeys
		const x = this._category.get(category)
		if (x)
			categoryKeys = x.value
		else
			return false  // already inactive

		// if the key was already inactive on this category, nothing to do
		if (!categoryKeys.active[keyId])
			return false

		// if there are no more active keys in this category, remove it
		if (--categoryKeys.activeKeysCount == 0)
			this._category.remove(category)

		// deactivate the key in this category
		categoryKeys.active[keyId] = false

		// check if the key is still active in another category
		const isActive = this.isActive(keyId)

		// fire event
		;(this.keyDeactivated as ObservableSource<IKeyDeactivatedEvent>).next({ eventId: KeyManager._nextEventId++, keyId, category, isInactive: !isActive })

		return true
	}

	public pitchBend(category: string, keyId: number, pitchBend: number): void {
		// fire event
		;(this.pitchBending as ObservableSource<IPitchBendEvent>).next({ eventId: KeyManager._nextEventId++, keyId, category, pitchBend })
	}
}
