
declare module '*.less' {
	const classes: { [className: string]: string }
	export default classes
}

declare module '*.css' {
	const classes: { [className: string]: string }
	export default classes
}

declare module '*.png' {
	const url: string
	export default url
}

declare module '*.wav' {
	const url: string
	export default url
}
