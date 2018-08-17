import { delay } from '../util/async'
import classes from './style.less'

const LOADING_CLASSNAME = 'loading'
const LOADING_COMPLETED_CLASSNAME = classes['loading-completed']

const FADEOUT_DURATION = 1000

/**
 * A loading screen.
 */
export default class LoadingScreen {

	private static _showTime = window.performance.timing.navigationStart
	private static _isLoading = document.body.classList.contains(LOADING_CLASSNAME)

	/** Is the loading screen currently visible? */
	public static get isLoading(): boolean {
		return this._isLoading
	}

	/** Show the loading screen. */
	public static show(): void {
		if (!this._isLoading) {
			document.body.classList.add(LOADING_CLASSNAME)
			document.body.classList.remove(LOADING_COMPLETED_CLASSNAME)
			
			LoadingScreen._showTime = Date.now()
		}

		this._isLoading = true
	}

	/** Hide the loading screen. */
	public static hide(): void {
		this._hide()
	}

	private static async _hide() {
		this._isLoading = false

		// if page loaded in less than one second, hide loading screen immediately
		if (Date.now() - this._showTime < 1000) {
			document.body.classList.remove(LOADING_CLASSNAME)
		}

		// else fade out loading screen
		else {
			document.body.classList.add(LOADING_COMPLETED_CLASSNAME)
			await delay(FADEOUT_DURATION)

			if (!this._isLoading) {
				// if the loading screen is still closed, remove classes
				document.body.classList.remove(LOADING_CLASSNAME, LOADING_COMPLETED_CLASSNAME)
			}
		}
	}
} 
