
export interface IDictionarySettings<K, V> {
	getHashCode?(key: K): string|number
	isEqual?(key1: K, key2: K): boolean
}

export default class Dictionary<K, V> implements Iterable<{ key: K, value: V }> {

	private readonly buckets: { [hash: string]: { key: K, value: V }[] } = {}
	private readonly getHashCode: (key: K) => string
	private readonly isEqual: (key1: K, key2: K) => boolean

	public get keys(): IterableIterator<K> {
		return this._keys();
	}

	public get values(): IterableIterator<V> {
		return this._values();
	}

	constructor(settings?: IDictionarySettings<K, V>) {
		const getHashCode = settings && settings.getHashCode
		this.getHashCode = getHashCode ? key => `${getHashCode(key)}` : key => `${key}`
		this.isEqual = (settings && settings.isEqual) || ((k1, k2) => k1 === k2)
	}

	public *[Symbol.iterator]() {
		for (const kvp of this._getKeyValuePairs())
			yield { ...kvp }
	}

	public get(key: K): { key: K, value: V }|undefined {
		const keyHash = this.getHashCode(key)
		const bucket = this.buckets[keyHash]
		if (!bucket)
			return undefined

		for (let i = 0; i < bucket.length; i++)
			if (this.isEqual(bucket[i].key, key))
				return { ...bucket[i] }

		return undefined
	}

	public set(key: K, value: V): void {
		const keyHash = this.getHashCode(key)
		const bucket = this.buckets[keyHash]
		if (!bucket)
			return void(this.buckets[keyHash] = [{ key, value }])

		for (let i = 0; i < bucket.length; i++)
			if (this.isEqual(bucket[i].key, key))
				return void(bucket[i] = { key, value })

		return undefined
	}

	public remove(key: K): boolean {
		const keyHash = this.getHashCode(key)
		const bucket = this.buckets[keyHash]
		if (!bucket)
			return false

		for (let i = 0; i < bucket.length; i++) {
			if (this.isEqual(bucket[i].key, key)) {
				bucket.splice(i, 1)

				if (!bucket.length)
					delete this.buckets[keyHash]

				return true
			}
		}

		return false
	}

	private *_getKeyValuePairs(): IterableIterator<{ key: K, value: V }> {
		for (const keyHash in this.buckets)
			for (const keyValuePair of this.buckets[keyHash])
				yield keyValuePair
	}

	private *_keys(): IterableIterator<K> {
		for (const kvp of this._getKeyValuePairs())
			yield kvp.key
	}

	private *_values(): IterableIterator<V> {
		for (const kvp of this._getKeyValuePairs())
			yield kvp.value
	}
}
