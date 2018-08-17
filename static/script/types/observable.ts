
// https://github.com/tc39/proposal-observable/blob/bf4d87144b6189e793593868e3c022eb51a7d292/README.md

declare global {

	export interface SymbolConstructor {

		readonly observable: symbol;
	}

	export interface Subscription {

		/** Cancels the subscription. */
		unsubscribe(): void;

		/** A boolean value indicating whether the subscription is closed. */
		readonly closed: boolean;
	}

	export class Observable<T> {

		constructor(subscriber: (observer: SubscriptionObserver<T>) => (() => void)|Subscription);

		/** Subscribes to the sequence with an observer. */
		subscribe(observer: Observer<T>): Subscription;

		/** Subscribes to the sequence with callbacks. */
		subscribe(onNext: (value: T) => void, onError?: (errorValue: any) => void, onComplete?: () => void): Subscription;

		/** Returns itself. */
		[Symbol.observable](): Observable<T>;

		/** Converts items to an Observable. */
		static of<T>(...items: T[]): Observable<T>;

		/** Converts an observable or iterable to an Observable. */
		static from<T>(observable: Observable<T>|Iterable<T>): Observable<T>;
	}

	export interface Observer<T> {

		/** Receives the subscription object when `subscribe` is called. */
		start(subscription: Subscription): void;

		/** Receives the next value in the sequence. */
		next(value: T): void;

		/** Receives the sequence error. */
		error(errorValue: any): void;

		/** Receives a completion notification. */
		complete(): void;
	}

	export interface SubscriptionObserver<T> {

		/** Sends the next value in the sequence. */
		next(value: T): void;

		/** Sends the sequence error. */
		error(errorValue: any): void;

		/** Sends the completion notification. */
		complete(): void;

		/** A boolean value indicating whether the subscription is closed. */
		readonly closed: boolean;
	}
}

export { };

declare let Observable: any;
declare let Subscription: any;
declare let SubscriptionObserver: any;
declare let Object: any;
declare let TypeError: any;

if (typeof((window as any).Observable) == 'undefined')
	(window as any).Observable = undefined

if (typeof((window as any).Subscription) == 'undefined')
	(window as any).Subscription = undefined

if (typeof((window as any).SubscriptionObserver) == 'undefined')
	(window as any).SubscriptionObserver = undefined

if (typeof((window as any).Object) == 'undefined')
	(window as any).Object = undefined

if (typeof((window as any).TypeError) == 'undefined')
	(window as any).TypeError = undefined

// polyfill
if (typeof(Symbol.observable) == 'undefined') {

	// === Symbol Polyfills ===

	Object.defineProperty(Symbol, 'observable', { value: Symbol('observable') });

	// === Abstract Operations ===

	const nonEnum = (obj: any) => {

		Object.getOwnPropertyNames(obj).forEach((k: any) => {
			Object.defineProperty(obj, k, { enumerable: false });
		});

		return obj;
	}

	const getMethod = (obj: any, key: any) => {

		let value = obj[key];

		if (value == null)
			return undefined;

		if (typeof value !== "function")
			throw new TypeError(value + " is not a function");

		return value;
	}

	const cleanupSubscription = (subscription: any) => {

		// Assert:  observer._observer is undefined

		let cleanup = subscription._cleanup;

		if (!cleanup)
			return;

		// Drop the reference to the cleanup function so that we won't call it
		// more than once
		subscription._cleanup = undefined;

		// Call the cleanup function
		try {
			cleanup();
		}
		catch(e) {
			// HostReportErrors(e);
		}
	}

	const subscriptionClosed = (subscription: any) => {

		return subscription._observer === undefined;
	}

	const closeSubscription = (subscription: any) => {

		if (subscriptionClosed(subscription))
			return;

		subscription._observer = undefined;
		cleanupSubscription(subscription);
	}

	const cleanupFromSubscription = (subscription: any) => {
		return (_: any) => { subscription.unsubscribe() };
	}

	Subscription = function(this: any, observer: any, subscriber: any) {
		// Assert: subscriber is callable
		// The observer must be an object
		this._cleanup = undefined;
		this._observer = observer;

		// If the observer has a start method, call it with the subscription object
		try {
			let start = getMethod(observer, "start");

			if (start) {
				start.call(observer, this);
			}
		}
		catch(e) {
			// HostReportErrors(e);
		}

		// If the observer has unsubscribed from the start method, exit
		if (subscriptionClosed(this))
			return;

		observer = new SubscriptionObserver(this);

		try {

			// Call the subscriber function
			let cleanup = subscriber.call(undefined, observer);

			// The return value must be undefined, null, a subscription object, or a function
			if (cleanup != null) {
				if (typeof cleanup.unsubscribe === "function")
					cleanup = cleanupFromSubscription(cleanup);
				else if (typeof cleanup !== "function")
					throw new TypeError(cleanup + " is not a function");

				this._cleanup = cleanup;
			}

		} catch (e) {

			// If an error occurs during startup, then send the error
			// to the observer.
			observer.error(e);
			return;
		}

		// If the stream is already finished, then perform cleanup
		if (subscriptionClosed(this)) {
			cleanupSubscription(this);
		}
	}

	Subscription.prototype = nonEnum({
		get closed() { return subscriptionClosed(this) },
		unsubscribe() { closeSubscription(this) },
	});

	SubscriptionObserver = function(this: any, subscription: any) {
		this._subscription = subscription;
	}

	SubscriptionObserver.prototype = nonEnum({

		get closed() {

			return subscriptionClosed(this._subscription);
		},

		next(value: any) {

			let subscription = this._subscription;

			// If the stream if closed, then return undefined
			if (subscriptionClosed(subscription))
				return undefined;

			let observer = subscription._observer;

			try {
				let m = getMethod(observer, "next");

				// If the observer doesn't support "next", then return undefined
				if (!m)
					return undefined;

				// Send the next value to the sink
				m.call(observer, value);
			}
			catch(e) {
				// HostReportErrors(e);
			}
			return undefined;
		},

		error(value: any) {

			let subscription = this._subscription;

			// If the stream is closed, throw the error to the caller
			if (subscriptionClosed(subscription)) {
				return undefined;
			}

			let observer = subscription._observer;
			subscription._observer = undefined;

			try {

				let m = getMethod(observer, "error");

				// If the sink does not support "complete", then return undefined
				if (m) {
					m.call(observer, value);
				}
				else {
					// HostReportErrors(e);
				}
			} catch (e) {
				// HostReportErrors(e);
			}

			cleanupSubscription(subscription);

			return undefined;
		},

		complete() {

			let subscription = this._subscription;

			// If the stream is closed, then return undefined
			if (subscriptionClosed(subscription))
				return undefined;

			let observer = subscription._observer;
			subscription._observer = undefined;

			try {

				let m = getMethod(observer, "complete");

				// If the sink does not support "complete", then return undefined
				if (m) {
					m.call(observer);
				}
			} catch (e) {
				// HostReportErrors(e);
			}

			cleanupSubscription(subscription);

			return undefined;
		},

	});

	Observable = class Observable {

		// == Fundamental ==

		_subscriber: any;

		constructor(subscriber: any) {

			// The stream subscriber must be a function
			if (typeof subscriber !== "function")
				throw new
				TypeError("Observable initializer must be a function");

			this._subscriber = subscriber;
		}

		subscribe(observer: any, error: any, complete: any) {
			if (typeof observer === "function") {
				observer = {
					next: observer,
					error: error,
					complete: complete
				};
			}
			else if (typeof observer !== "object") {
				observer = {};
			}

			return new Subscription(observer, this._subscriber);
		}

		[Symbol.observable]() { return this }

		// == Derived ==

		static from(x: any) {

			let C = typeof this === "function" ? this : Observable;

			if (x == null)
				throw new TypeError(x + " is not an object");

			let method = getMethod(x, Symbol.observable);

			if (method) {

				let observable = method.call(x);

				if (Object(observable) !== observable)
					throw new TypeError(observable + " is not an object");

				if (observable.constructor === C)
					return observable;

				return new C((observer: any) => observable.subscribe(observer));
			}

			method = getMethod(x, Symbol.iterator);

			if (!method)
				throw new TypeError(x + " is not observable");

			return new C((observer: any) => {

				for (let item of method.call(x)) {

					observer.next(item);

					if (observer.closed)
						return;
				}

				observer.complete();
			});
		}

		static of(...items: any[]) {

			let C = typeof this === "function" ? this : Observable;

			return new C((observer: any) => {

				for (let i = 0; i < items.length; ++i) {

					observer.next(items[i]);

					if (observer.closed)
						return;
				}

				observer.complete();
			});
		}

	}

}
