import * as JSX from "../jsx";
import { cssUpdate, delay } from "../util/async";
import classes from './style.less';

const BUTTONS_CLASSNAME = classes['buttons']
const BUTTON_CLASSNAME = classes['button']
const SETTINGS_DIALOG_CLASSNAME = classes['settings-dialog']
const PANEL_CLASSNAME = classes['panel']
const FADE_IN_CLASSNAME = classes['fade-in']

export default class LayoutGenerator {

	public readonly el: HTMLElement

	private readonly _settingsDialog: HTMLDialogElement

	constructor() {
		this.el = (
			<div className={BUTTONS_CLASSNAME}>
				<button className={BUTTON_CLASSNAME} onclick={e => void this._toggleFullscreen()}>Fullscreen</button>
				<button className={BUTTON_CLASSNAME} onclick={e => void this._openSettings()}>Settings</button>
			</div>
		)

		this._settingsDialog = (
			<dialog className={SETTINGS_DIALOG_CLASSNAME}>
				<div className={PANEL_CLASSNAME}>
					<div>No settings available in current version. {/* TODO */}</div>
					<button onclick={e => void this._closeSettings()}>OK</button>
				</div>
			</dialog>
		) as HTMLDialogElement

		this._settingsDialog.addEventListener('cancel', e => void(e.preventDefault(), this._closeSettings()))
	}

	private _toggleFullscreen(): void {
		if (document.fullscreenElement || document.webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement) {
			(
				document.exitFullscreen ||
				document.webkitExitFullscreen ||
				(document as any).mozCancelFullScreen ||
				(document as any).msExitFullscreen
			).call(document)
		}
		else {
			(
				(document.documentElement as any).requestFullScreen ||
				(document.documentElement).webkitRequestFullScreen ||
				(document.documentElement as any).mozRequestFullScreen ||
				(document.documentElement as any).msRequestFullScreen
			).call(document.documentElement)
		}
	}

	private async _openSettings(): Promise<void> {
		document.body.appendChild(this._settingsDialog)
		this._settingsDialog.showModal()

		this._settingsDialog.classList.remove(FADE_IN_CLASSNAME)
		await cssUpdate()
		this._settingsDialog.classList.add(FADE_IN_CLASSNAME)
	}

	private async _closeSettings(): Promise<void> {
		this._settingsDialog.classList.remove(FADE_IN_CLASSNAME)
		await delay(500)

		this._settingsDialog.close()
		this._settingsDialog.remove()
	}
}
