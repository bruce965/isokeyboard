
export default interface ISamplePlayback {

	/** Is this sample currently sustained? */
	readonly isActive: boolean

	/** Frequency multiplier relative to base frequency. */
	pitchBend: number

	/** Playback strength. */
	strength: number

	/** Stop sustaining, activate decay. */
	stop(): void
}
