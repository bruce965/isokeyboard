
export function intersect<TSource extends T, T>(source: TSource[], ...others: T[][]): TSource[] {
	const els: TSource[] = []
	for (const el of source)
		if (others.every(arr => arr.indexOf(el) != -1))
			els.push(el)

	return els
}

export function except<TSource extends T, T>(source: TSource[], ...others: T[][]): TSource[] {
	const els: TSource[] = []
	for (const el of source)
		if (others.every(arr => arr.indexOf(el) == -1))
			els.push(el)

	return els
}
