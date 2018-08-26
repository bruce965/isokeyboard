
const NOT_IN_DOM_MESSAGE = "Failed to open dialog, the element is not in a document."
const ALREADY_OPEN_NONMODAL_MESSAGE = "Failed to open modal dialog, the dialog is already open as non-modal."

// TODO: event when closing.

const dialogElement = document.createElement('dialog') as HTMLDialogElement
if (!dialogElement.showModal) {

	const style = document.createElement('style')
	style.innerHTML = `
dialog {
	position: absolute;
	background: white;
	color: black;
	border: 3px solid black;
	margin: auto;
	padding: 1em;
	offset-inline-end: 0;
	offset-inline-start: 0;
	z-index: 100;
}

dialog:not([open]) {
	display: none;
}

dialog + _backdrop {
	position: fixed;
	top: 0;
	right: 0;
	bottom: 0;
	left: 0;
	background: rgba(0, 0, 0, .1);
	z-index: 99;
}
`

	document.head.insertBefore(style, document.head.querySelector('style'))

	interface HTMLDialogElementPolyfill extends HTMLDialogElement {
		_isModal: boolean
		_focusGuard: HTMLElement
		_backdrop: HTMLElement
		_focusHandler: (e: FocusEvent) => void
		_keyboardHandler: (e: KeyboardEvent) => void
		_ctor(): void
		_show(modal: boolean): void
	}

	const HTMLDialogElementPrototype: HTMLDialogElementPolyfill = Object.create(HTMLElement.prototype)
	HTMLDialogElementPrototype._isModal = false

	Object.defineProperty(HTMLDialogElementPrototype, 'open', {
		get: function(this: HTMLDialogElementPolyfill) {
			return this.hasAttribute('open')
		},
		set: function(value: boolean) {
			if (value)
				this.show()
			else
				this.close()
		}
	})

	HTMLDialogElementPrototype._ctor = function() {
		// backdrop and focus confiner
		this._focusGuard = document.createElement('_dialog_focusguard')
		this._backdrop = document.createElement('_backdrop')

		this._focusGuard.tabIndex = 0
		this._backdrop.tabIndex = 0

		this._focusGuard.addEventListener('focusout', e => {
			// if focusing out, refocus from the other side
			if (!document.activeElement || (!this.contains(document.activeElement) && document.activeElement != this && document.activeElement != this._focusGuard && document.activeElement != this._backdrop))
				this._backdrop.focus()
		})
		this._backdrop.addEventListener('focusout', e => {
			// if focusing out, refocus from the other side
			if (!document.activeElement || (!this.contains(document.activeElement) && document.activeElement != this && document.activeElement != this._focusGuard && document.activeElement != this._backdrop))
				this._focusGuard.focus()
		})

		this._focusHandler = (e: FocusEvent) => {
			// when focusing the document, we refocus the modal dialog
			if (!document.activeElement || (!this.contains(document.activeElement) && document.activeElement != this && document.activeElement != this._focusGuard && document.activeElement != this._backdrop))
				this._focusGuard.focus()
		}

		this._keyboardHandler = (e: KeyboardEvent) => {
			if (e.keyCode == 27 && !e.defaultPrevented) {
				const event = new CustomEvent('cancel', {
					bubbles: false,
					cancelable: true,
					composed: false
				})

				if (this.dispatchEvent(event))
					this.close()
			}
		}
	}

	HTMLDialogElementPrototype.show = function() {
		this._show(false)
	}

	HTMLDialogElementPrototype.showModal = function() {
		this._show(true)
	}

	HTMLDialogElementPrototype.close = function(returnValue?: string | undefined) {
		if (!this.open)
			return

		this.removeAttribute('open')
		this._backdrop.remove()
		document.removeEventListener('focus', this._focusHandler)
		document.removeEventListener('keydown', this._keyboardHandler)

		if (this.returnValue != null)
			this.returnValue = `${returnValue}`
	}

	HTMLDialogElementPrototype._show = function(modal: boolean) {
		if (this.open) {
			if (modal && !this._isModal)
				throw new Error(ALREADY_OPEN_NONMODAL_MESSAGE)

			return
		}

		// TODO: NOT_IN_DOM_MESSAGE

		this.setAttribute('open', '')

		if (modal) {
			(this.parentElement as HTMLElement).insertBefore(this._focusGuard, this)

			if (this.nextSibling)
				(this.parentElement as HTMLElement).insertBefore(this._backdrop, this.nextSibling)
			else
				(this.parentElement as HTMLElement).appendChild(this._backdrop)

			document.addEventListener('focus', this._focusHandler)
			this._focusGuard.focus()
		}

		document.addEventListener('keydown', this._keyboardHandler)
	}

	const documentPrototype = Object.getPrototypeOf(document)
	const originalCreateElement: typeof document.createElement = documentPrototype.createElement

	documentPrototype.createElement = function(this: Document, tagName: string, options?: ElementCreationOptions) {
		if (tagName.toUpperCase() == 'DIALOG') {
			const dialog: HTMLDialogElementPolyfill = originalCreateElement.call(this, 'dialog')
			;(Object as any).setPrototypeOf(dialog, HTMLDialogElementPrototype)
			dialog._ctor()
			return dialog
		}

		return originalCreateElement.apply(this, arguments)
	} as typeof originalCreateElement
}
