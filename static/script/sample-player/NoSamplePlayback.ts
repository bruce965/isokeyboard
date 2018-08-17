import ISamplePlayback from "./ISamplePlayback";

export default class NoSamplePlayback implements ISamplePlayback {

	public readonly isActive: boolean = false

	public vibrato = 1
	
	public get strength(): number {
		return 0
	}
	public set strength(value: number) { }

	public stop(): void { }
}
