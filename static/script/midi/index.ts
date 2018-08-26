import * as MIDI from 'midi-json-parser';
import pachelbelUrl from './pachelbel.mid'

async function test() {
	const midiRequest = await fetch(pachelbelUrl)
	const midiBinary = await midiRequest.arrayBuffer()
	const midi = await MIDI.parseArrayBuffer(midiBinary)

	console.log(midi)
}

test()
