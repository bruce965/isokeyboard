import { map } from "../util/object"
import ISamplePlayback from "./ISamplePlayback"
import SamplePlayback from "./SamplePlayback"
import NoSamplePlayback from "./NoSamplePlayback"
import InstrumentSamples from "./InstrumentSamples"

export interface ISamplePlayerSettings<KInstrument extends string> {

	/** Audio context to be used for playback. */
	audioContext: AudioContext

	/** List of supported instruments. */
	instruments: Record<KInstrument, {
		/** Number of milliseconds required for the sound to become inaudible since playback is stopped. */
		decay: number,
		/** Do these samples loop? */
		loop: boolean,
		/** Samples for this instrument. */
		samples: { frequency: number, buffer: AudioBuffer }[]
	}>
}

/**
 * Allows to play samples, automatically adjusting the pitch.
 */
export default class SamplePlayer<KInstrument extends string> {

	private readonly _audioCtx: AudioContext
	private readonly _instruments: Record<KInstrument, { samples: InstrumentSamples, decay: number, loop: boolean }>

	constructor(settings: ISamplePlayerSettings<KInstrument>) {
		this._audioCtx = settings.audioContext
		this._instruments = map(settings.instruments, (instrument, data) => {
			const samples = new InstrumentSamples()
			for (const sample of data.samples)
				samples.register(sample.frequency, sample.buffer)

			return { samples, loop: data.loop, decay: data.decay }
		})
	}

	/** Play the best sample at the specified frequency. */
	public play(instrument: KInstrument, frequency: number, strength: number): ISamplePlayback {
		const instrumentData = this._instruments[instrument]
		const sample = instrumentData.samples.find(frequency)
		if (!sample) {
			console.warn(new Error(`No sample available for the “${instrument}” instrument.`))
			return new NoSamplePlayback()
		}

		return new SamplePlayback({
			audioContext: this._audioCtx,
			sampleFrequency: sample.frequency,
			sampleBuffer: sample.buffer,
			frequency: frequency,
			strength: strength,
			loop: instrumentData.loop,
			decay: instrumentData.decay
		})
	}
}
