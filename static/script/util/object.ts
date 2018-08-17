
export function map<TSource, T>(object: TSource, transform: (key: keyof TSource, value: TSource[keyof TSource]) => T): Record<keyof TSource, T> {
	const mapped: Partial<Record<keyof TSource, T>> = {}
	for (const key in object)
		mapped[key] = transform(key, object[key])
	
	return mapped as Record<keyof TSource, T>
}
