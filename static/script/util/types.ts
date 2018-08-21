

/** Remove types from `T` that are assignable to `U`. */
export type Diff<T, U> = T extends U ? never : T

/** Remove types from `T` that are not assignable to `U`. */
export type Filter<T, U> = T extends U ? T : never

/** Omit fields `K` from type `T`. */
export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>

type OmitFieldsOfType_Object<T, U> = { [P in keyof T]: T[P] extends U ? never : { name: P, type: T[P] } }
type OmitFieldsOfType_NameTypePairs<T, U> = OmitFieldsOfType_Object<T, U>[keyof T];

/** Remove fields from type `T` that are not assignable to type `U`. */
export type OmitFieldsOfType<T, U> = { [P in OmitFieldsOfType_NameTypePairs<T, U>['name']]: OmitFieldsOfType_Object<T, U>[P]['type'] }

// examples to check that everything works
type _TEST = { str: string, num: number, readonly readonlyNum: number, func(): void }
type _TEST_OmitFieldsOfType_Object = OmitFieldsOfType_Object<_TEST, number>
type _TEST_OmitFieldsOfType_NameTypePairs = OmitFieldsOfType_NameTypePairs<_TEST, number>
type _TEST_OmitFieldsOfType = OmitFieldsOfType<_TEST, number>

/** Remove readonly fields from type `T`. (TODO) */
export type OmitReadonly<T> = {
	// TODO: omit readonly fields
	-readonly [P in keyof T]: T[P]  // HACK: make readonly properties non-readonly.
}
