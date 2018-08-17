
const CLOSED_SEQUENCE_MESSAGE = "Cannot emit from a closed sequence."

export interface IObservableSourceSettings<T> {
	rethrow?: boolean
}

export class ObservableSource<T> extends Observable<T> {

	private readonly _rethrows: boolean
	private readonly _subscribers: { id: number, observer: SubscriptionObserver<T> }[] = []
	private _nextSubscriptionId = 0
	private _completed = false
	private _errored?: { errorValue: any }

	constructor(settings?: IObservableSourceSettings<T>) {
		super(observer => this._subscribing(observer))

		this._rethrows = (settings && settings.rethrow) || false
	}

	public next(value: T): void {
		if (this._completed || this._errored)
			throw new Error(CLOSED_SEQUENCE_MESSAGE)

		for (const subscriber of this._subscribers) {
			try {
				subscriber.observer.next(value)
			}
			catch (e) {
				if (this._rethrows)
					throw e
				
				console.error(e)
			}
		}
	}

	public complete(): void {
		if (this._completed || this._errored)
			throw new Error(CLOSED_SEQUENCE_MESSAGE)

		try {
			for (const subscriber of this._subscribers) {
				try {
					subscriber.observer.complete()
				}
				catch (e) {
					if (this._rethrows)
						throw e
					
					console.error(e)
				}
			}
		}
		finally {
			this._completed = true
			this._subscribers.length = 0
		}
	}

	public error(errorValue: any): void {
		if (this._completed || this._errored)
			throw new Error(CLOSED_SEQUENCE_MESSAGE)

		try {
			for (const subscriber of this._subscribers) {
				try {
					subscriber.observer.error(errorValue)
				}
				catch (e) {
					if (this._rethrows)
						throw e
					
					console.error(e)
				}
			}
		}
		finally {
			this._errored = { errorValue }
			this._subscribers.length = 0
		}
	}

	private _subscribing(observer: SubscriptionObserver<T>): Subscription {
		if (this._errored) {
			observer.error(this._errored.errorValue)
			return new ObservableSourceSubscription(() => {})
		}
		
		if (this._completed) {
			observer.complete()
			return new ObservableSourceSubscription(() => {})
		}

		const id = this._nextSubscriptionId++
		this._subscribers.push({ id, observer })

		return new ObservableSourceSubscription(() => {
			// remove the subscription with the same id
			for (let i = 0; i < this._subscribers.length; i++) {
				if (this._subscribers[i].id == id) {
					this._subscribers.splice(i, 1)
					break
				}
			}
		})
	}
}

class ObservableSourceSubscription implements Subscription {

	private _ubsubscribe?: () => void

	public get closed(): boolean {
		// `_ubsubscribe` is unset when unsubscribing
		return !this._ubsubscribe
	}

	constructor(unsubscribe: () => void) {
		this._ubsubscribe = unsubscribe
	}

	public unsubscribe(): void {
		const ubsubscribe = this._ubsubscribe
		if (ubsubscribe) {
			// unset `_ubsubscribe` when unsubscribing 
			this._ubsubscribe = undefined
			ubsubscribe()
		}
	}
}
