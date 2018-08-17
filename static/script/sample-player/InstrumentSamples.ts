
/**
 * Contains samples for a single instrument.
 */
export default class InstrumentSamples {

	private readonly _samples: { frequency: number, buffer: AudioBuffer }[] = []

	/** Register a sample. */
	public register(frequency: number, buffer: AudioBuffer): void {
		for (let i = 0; i < this._samples.length; i++) {
			const sample = this._samples[i]

			// same frequency, replace
			if (sample.frequency == frequency) {
				sample.buffer = buffer
				break
			}

			// frequency higher, insert before
			else if (sample.frequency > frequency) {
				this._samples.splice(i, 0, { frequency, buffer })
				break
			}
		}

		// no sample with higher frequency registered, push to end
		this._samples.push({ frequency, buffer })
	}

	/** Get the sample with the frequency closest to the requested `frequency`. */
	public find(frequency: number): { frequency: number, buffer: AudioBuffer }|null {
		// TODO: binary search

		let previousSample: { frequency: number, buffer: AudioBuffer }|undefined
		for (let i = 0; i < this._samples.length; i++) {
			const sample = this._samples[i]

			// if we passed the target frequency, we return the sample with the closest available frequency
			if (sample.frequency >= frequency) {
				// if this is the sample with the lowest available frequency, we return it
				if (!previousSample)
					return { frequency: sample.frequency, buffer: sample.buffer }

				// if the current sample has a frequency closer to the target frequency than the previous one, we return it
				if (sample.frequency - frequency < frequency - previousSample.frequency)
					return { frequency: sample.frequency, buffer: sample.buffer }

				// else we return the previous sample
				return { frequency: previousSample.frequency, buffer: previousSample.buffer }
			}

			previousSample = sample
		}

		// if no sample has a frequency higher than the target frequency, we return the sample with the highest available frequency
		if (this._samples.length) {
			const lastSample = this._samples[this._samples.length - 1]
			return { frequency: lastSample.frequency, buffer: lastSample.buffer }
		}

		// no sample available
		return null
	}
}
