import './types/lib'  // types and polyfills

import LoadingScreen from './loading-screen/lib'
import SamplePlayer, { ISamplePlayback } from './sample-player/lib'
import IsomorphicKeyboard from './isomorphic-keyboard/lib'

async function main() {
	const audioCtx = new AudioContext({ latencyHint: 'interactive' })
	const piano110 = loadAudioBuffer(audioCtx, 'https://s3.amazonaws.com/terpstra-pwa-test-temp/sounds/piano110.mp3')
	const piano220 = loadAudioBuffer(audioCtx, 'https://s3.amazonaws.com/terpstra-pwa-test-temp/sounds/piano220.mp3')
	const piano440 = loadAudioBuffer(audioCtx, 'https://s3.amazonaws.com/terpstra-pwa-test-temp/sounds/piano440.mp3')
	const piano880 = loadAudioBuffer(audioCtx, 'https://s3.amazonaws.com/terpstra-pwa-test-temp/sounds/piano880.mp3')

	const player = new SamplePlayer({
		audioContext: audioCtx,
		instruments: {
			'piano': {
				loop: false,
				decay: 500,
				samples: [
					{ frequency: 110, buffer: await piano110 },
					{ frequency: 220, buffer: await piano220 },
					{ frequency: 440, buffer: await piano440 },
					{ frequency: 880, buffer: await piano880 }
				]
			}
		}
	})

	const keyboard = new IsomorphicKeyboard({
		keys: [
			{ row: 1, column: 1, label: 'D₄', color: 'lightblue', data: { frequency: getNoteFrequency('D4') } },
			{ row: 2, column: 1, label: 'F♯₄', color: 'cornflowerblue', data: { frequency: getNoteFrequency('F#4') } },
			{ row: 3, column: 1, label: 'D♯₄', color: 'cornflowerblue', data: { frequency: getNoteFrequency('D#4') } },
			{ row: 4, column: 1, label: 'G₄', color: 'white', data: { frequency: getNoteFrequency('G4') } },
			{ row: 5, column: 1, label: 'E₄', color: 'white', data: { frequency: getNoteFrequency('E4') } },
			{ row: 6, column: 1, label: 'G♯₄', color: 'darkseagreen', data: { frequency: getNoteFrequency('G#4') } },
			{ row: 7, column: 1, label: 'F₄', color: 'white', data: { frequency: getNoteFrequency('F4') } },
			{ row: 8, column: 1, label: 'A₄', color: 'white', data: { frequency: getNoteFrequency('A4') } },
		]
	})

	const currentKeys: { [eventId: number]: ISamplePlayback } = {}

	keyboard.keyActivated.subscribe(e => {
		currentKeys[e.eventId] = player.play('piano', e.data.frequency, 0.5)
	})

	keyboard.keyDeactivated.subscribe(e => {
		currentKeys[e.eventId].stop()
		delete currentKeys[e.eventId]
	})

	document.body.appendChild(keyboard.el)

	// loading is completed, hide loading screen
	LoadingScreen.hide()
}

async function loadAudioBuffer(audioContext: AudioContext, url: string): Promise<AudioBuffer> {
	const response = await fetch(url)
	const arrayBuffer = await response.arrayBuffer()
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
	return audioBuffer
}

function getNoteFrequency(name: string): number {
	const baseLength = (name[1] == 'b' || name[1] == '#') ? 2 : 1

	// name = C#4
	// note = C#
	// octave = 4
	const note = name.substr(0, baseLength)
	const octave = parseInt(name.substr(baseLength))

	let noteOffset: number = 0
	switch (note) {
		case 'C':
			noteOffset = 0
			break
		case 'C#':
		case 'Db':
			noteOffset = 1
			break
		case 'D':
			noteOffset = 2
			break
		case 'D#':
		case 'Eb':
			noteOffset = 3
			break
		case 'E':
			noteOffset = 4
			break
		case 'F':
			noteOffset = 5
			break
		case 'F#':
		case 'Gb':
			noteOffset = 6
			break
		case 'G':
			noteOffset = 7
			break
		case 'G#':
		case 'Ab':
			noteOffset = 8
			break
		case 'A':
			noteOffset = 9
			break
		case 'A#':
		case 'Bb':
			noteOffset = 10
			break
		case 'B':
			noteOffset = 11
			break
		default:
			console.warn(`Invalid note name “${note}”.`)
			noteOffset = 0
	}

	const A4_INDEX = 9 + 12 * 4

	const noteIndex = noteOffset + 12 * octave

	// https://en.wikipedia.org/wiki/Musical_note#Note_frequency_(hertz)
	return Math.pow(2, (noteIndex - A4_INDEX) / 12) * 440
}

main()
