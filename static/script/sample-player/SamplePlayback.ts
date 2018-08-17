import ISamplePlayback from "./ISamplePlayback"
import { delay } from "../util/async"

export default class SamplePlayback implements ISamplePlayback {

	private readonly _audioCtx: AudioContext
	private readonly _source: AudioBufferSourceNode
	private readonly _gain: GainNode

	private readonly _basePlaybackRate: number
	private readonly _decay: number

	private _isActive: boolean = true
	public get isActive(): boolean {
		return this._isActive
	}

	public get vibrato(): number {
		return this._source.playbackRate.value / this._basePlaybackRate
	}
	public set vibrato(value: number) {
		this._source.playbackRate.setTargetAtTime(value * this._basePlaybackRate, this._audioCtx.currentTime, 0.01)
	}

	public get strength(): number {
		return this._gain.gain.value
	}
	public set strength(value: number) {
		if (this._isActive)
			this._gain.gain.setTargetAtTime(value, this._audioCtx.currentTime, 0.01)
	}

	constructor(settings: {
		audioContext: AudioContext,
		sampleFrequency: number,
		sampleBuffer: AudioBuffer,
		frequency: number,
		strength: number,
		loop: boolean,
		decay: number
	}) {
		this._audioCtx = settings.audioContext

		this._basePlaybackRate = settings.frequency / settings.sampleFrequency
		this._decay = settings.decay

		this._source = this._audioCtx.createBufferSource()
		this._source.buffer = settings.sampleBuffer
		this._source.playbackRate.value = this._basePlaybackRate
		this._source.loop = settings.loop

		this._gain = this._audioCtx.createGain()
		this._gain.gain.value = settings.strength

		// source -> gain -> destination
		this._source.connect(this._gain)
		this._gain.connect(this._audioCtx.destination)

		this._source.start()
	}

	public stop(): void {
		this._stop()
	}

	private async _stop(): Promise<void> {
		this._isActive = false

		this._gain.gain.setTargetAtTime(0, this._audioCtx.currentTime, this._decay / 1000 / 3)
		
		await delay(this._decay * 2)  // after this delay, we are at 0.0025% the inizial gain; silent enough to stop the playback
		this._source.stop()

		this._gain.disconnect()
		this._source.disconnect()
	}
}
