import * as MIDI from 'midi-json-parser';
import { TMidiEvent, IMidiNoteOnEvent, IMidiNoteOffEvent, IMidiSetTempoEvent, IMidiPitchBendEvent } from 'midi-json-parser-worker';
import KeyManager from '../isomorphic-keyboard/KeyManager';
import { IKey } from '../isomorphic-keyboard/IKey';
import { delay } from '../util/async';
import pachelbelUrl from './shionari.mid'

export async function miditest(keyManager: KeyManager, keys: { [keyId: number]: IKey }) {
	const midiRequest = await fetch(pachelbelUrl)
	const midiBinary = await midiRequest.arrayBuffer()
	const midi = await MIDI.parseArrayBuffer(midiBinary)

	const getKey = (x: number, y: number): IKey => {
		for (const keyId in keys)
			if (keys[keyId].x == x && keys[keyId].y == y)
				return keys[keyId]

		console.error(`Key not found: [${x}, ${y}]`)
		return undefined as never
	}

	const NOTENUMBER_TO_KEYID: { [noteNumber: number]: number } = {
		// TODO <
		35: 115,
		36: 141,
		37: 167,
		38: 102,
		39: 128,
		40: 154,
		41: 180,
		42: 114,
		43: 140,
		44: 166,
		45: 101,
		46: 127,
		47: 153,
		48: 179,  // C2
		49: 205,
		50: 139,  // D2
		51: 165,
		52: 191,
		53: 217,
		54: 243,
		55: 178,  // G2
		56: 204,
		57: 230,
		58: 164,
		59: 190,
		60: 216,  // C3
		61: 242,
		62: 177,  // D3
		63: 203,
		64: 229,
		65: 163,
		66: 189,
		67: 215,
		68: 241,
		69: 176,
		70: 202,
		71: 228,
		72: 162,
		73: 188,
		74: 214,
		75: 149,
		76: 175,
		77: 201,
		78: 227,
		79: 161,
		80: 187,
		81: 213,
		82: 239,
		83: 174,
		84: 200,
		85: 226,
		86: 160,
		87: 186,
		88: 212,
		// TODO >
	}

	console.log(midi)

	let isPaused = true

	;(window as any).midiplay = () => isPaused = false
	;(window as any).midipause = () => isPaused = true
	;(window as any).miditoggle = () => isPaused = !isPaused

	window.addEventListener('keydown', e => {
		if(e.keyCode == 32)
			isPaused = !isPaused
	})

	let division = midi.division

	const channels: { [channel: number]: { pitchBend: number, keys: { [keyId: number]: boolean } } } = {}

	for (let track = 0; track < midi.tracks.length; track++) {

		let tempo = 240000

		//if (track != 1)
	//		continue

		const playTrack = async () => {

			for (const note of midi.tracks[track]) {
				while (isPaused)
					await delay(100)

				if (!channels[note.channel])
					channels[note.channel] = { pitchBend: 1, keys: {} }

				const channel = channels[note.channel]

				if (isNoteOff(note)) {
					const keyId = NOTENUMBER_TO_KEYID[note.noteOff.noteNumber]

					if (keyId != null) {
						channel.keys[keyId] = true
						keyManager.activate(`midi_${track}`, keyId, channel.pitchBend)
					}
					else {
						console.log('out of range:', note.noteOff.noteNumber)
					}

					await delay(Math.min(note.delta * tempo / division / 1000 * 3, 120))

					if (keyId != null) {
						channel.keys[keyId] = false
						keyManager.deactivate(`midi_${track}`, keyId)
					}
					await delay(Math.max(0, note.delta * tempo / division / 1000 * 3 - 120))
				}
				else
				{
					if (isSetTempo(note)) {
						tempo = note.setTempo.microsecondsPerBeat
					}
					else if (isNoteOn(note)) {
						const keyId = NOTENUMBER_TO_KEYID[note.noteOn.noteNumber]

						if (keyId != null) {
							channel.keys[keyId] = true
							keyManager.activate(`midi_${track}`, keyId, channel.pitchBend)
						}
						else {
							console.log('out of range:', note.noteOn.noteNumber)
						}
					}
					else if (isPitchBend(note)) {
						channel.pitchBend = Math.pow(2, ((note.pitchBend - 0x2000) / 0x2000) / 6)

						for (const keyId in channel.keys)
							if (channel.keys[keyId])
								keyManager.pitchBend(`midi_${track}`, +keyId, channel.pitchBend)
					}

					await delay(note.delta * tempo / division / 1000 * 3)
				}
			}
		}

		playTrack()  // no await
	}
}

function isNoteOn(e: TMidiEvent): e is IMidiNoteOnEvent {
	return !!e.noteOn
}

function isNoteOff(e: TMidiEvent): e is IMidiNoteOffEvent {
	return !!e.noteOff
}

function isSetTempo(e: TMidiEvent): e is IMidiSetTempoEvent {
	return !!e.setTempo
}

function isPitchBend(e: TMidiEvent): e is IMidiPitchBendEvent {
	return !!e.pitchBend
}
