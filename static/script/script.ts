import './polyfill'

import { mod } from './util/math';
import LoadingScreen from './loading-screen'
import SamplePlayer, { ISamplePlayback } from './sample-player'
import IsomorphicKeyboard from './isomorphic-keyboard'
import LayoutGenerator from './layout-generator'

// DEBUG
import './midi'

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
		highlightActiveKeys: true,
		mapToKeyboard: true,
		verticalIncrement: 7,
		diagonalIncrement: 4,
		getKeyLabel: semitoneIndex => getNoteName(semitoneIndex),
		getKeyColor: semitoneIndex => getKeyColor(semitoneIndex)
	})

	const settings = new LayoutGenerator()

	const currentKeys: { [eventId: number]: ISamplePlayback } = {}

	keyboard.keyActivated.subscribe(e => {
		currentKeys[e.eventId] = player.play('piano', getNoteFrequency(e.semitoneIndex), 0.5)
	})

	keyboard.keyDeactivated.subscribe(e => {
		currentKeys[e.eventId].stop()
		delete currentKeys[e.eventId]
	})

	document.body.appendChild(keyboard.el)
	document.body.appendChild(settings.el)

	// loading is completed, hide loading screen
	LoadingScreen.hide()

	// focus (to enable keyboard input)
	;(keyboard.el as Element as HTMLElement).focus()
}

async function loadAudioBuffer(audioContext: AudioContext, url: string): Promise<AudioBuffer> {
	const response = await fetch(url)
	const arrayBuffer = await response.arrayBuffer()
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
	return audioBuffer
}

function getNoteName(semitoneIndex: number) {
	let noteName: string
	switch (mod(semitoneIndex, 12)) {
		case 0:
			noteName = 'A'
			break
		case 1:
			noteName = 'A♯'
			break
		case 2:
			noteName = 'B'
			break
		case 3:
			noteName = 'C'
			break
		case 4:
			noteName = 'C♯'
			break
		case 5:
			noteName = 'D'
			break
		case 6:
			noteName = 'D♯'
			break
		case 7:
			noteName = 'E'
			break
		case 8:
			noteName = 'F'
			break
		case 9:
			noteName = 'F♯'
			break
		case 10:
			noteName = 'G'
			break
		case 11:
			noteName = 'G♯'
			break
		default:
			noteName = '?' as never
			break
	}

	const LOOKUP = '₀₁₂₃₄₅₆₇₈₉'

	const octaveIndex = Math.floor(semitoneIndex / 12) + 4

	let octaveName = ''
	let partialOctaveIndex = Math.abs(octaveIndex)
	while (partialOctaveIndex > 0 || octaveName == '') {
		octaveName = LOOKUP[partialOctaveIndex % 10] + octaveName
		partialOctaveIndex = Math.floor(partialOctaveIndex / 10)
	}

	if (octaveIndex < 0)
		octaveName = '₋' + octaveName

	return noteName + octaveName
}

function getKeyColor(semitoneIndex: number) {
	switch (mod(semitoneIndex, 12)) {
		case 0:
		case 2:
		case 3:
		case 7:
		case 8:
		case 10:
			return { bg: 'white', fg: 'black' }
		case 1:
		case 4:
		case 6:
		case 9:
			return { bg: '#444', fg: 'white' }
		case 5:
			return { bg: 'paleturquoise', fg: 'black' }
		case 11:
			return { bg: 'cornflowerblue', fg: 'black' }
		default:
			return { bg: 'black', fg: 'black' } as never
	}
}

function getNoteFrequency(semitoneIndex: number): number {
	// https://en.wikipedia.org/wiki/Musical_note#Note_frequency_(hertz)
	return Math.pow(2, semitoneIndex / 12) * 440
}

main()
