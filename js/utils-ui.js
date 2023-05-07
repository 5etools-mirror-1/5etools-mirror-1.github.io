"use strict";

class Prx {
	static addHook (prop, hook) {
		this.px._hooks[prop] = this.px._hooks[prop] || [];
		this.px._hooks[prop].push(hook);
	}

	static addHookAll (hook) {
		this.px._hooksAll.push(hook);
	}

	static toString () {
		return JSON.stringify(this, (k, v) => k === "px" ? undefined : v);
	}

	static copy () {
		return JSON.parse(Prx.toString.bind(this)());
	}

	static get (toProxy) {
		toProxy.px = {
			addHook: Prx.addHook.bind(toProxy),
			addHookAll: Prx.addHookAll.bind(toProxy),
			toString: Prx.toString.bind(toProxy),
			copy: Prx.copy.bind(toProxy),
			_hooksAll: [],
			_hooks: {},
		};

		return new Proxy(toProxy, {
			set: (object, prop, value) => {
				object[prop] = value;
				toProxy.px._hooksAll.forEach(hook => hook(prop, value));
				if (toProxy.px._hooks[prop]) toProxy.px._hooks[prop].forEach(hook => hook(prop, value));
				return true;
			},
			deleteProperty: (object, prop) => {
				delete object[prop];
				toProxy.px._hooksAll.forEach(hook => hook(prop, null));
				if (toProxy.px._hooks[prop]) toProxy.px._hooks[prop].forEach(hook => hook(prop, null));
				return true;
			},
		});
	}
}

function MixinProxyBase (Cls) {
	class MixedProxyBase extends Cls {
		constructor (...args) {
			super(...args);
			this.__hooks = {};
			this.__hooksAll = {};
			this.__hooksTmp = null;
			this.__hooksAllTmp = null;
		}

		_getProxy (hookProp, toProxy) {
			return new Proxy(toProxy, {
				set: (object, prop, value) => {
					return this._doProxySet(hookProp, object, prop, value);
				},
				deleteProperty: (object, prop) => {
					if (!(prop in object)) return true;
					const prevValue = object[prop];
					Reflect.deleteProperty(object, prop);
					this._doFireHooksAll(hookProp, prop, undefined, prevValue);
					if (this.__hooks[hookProp] && this.__hooks[hookProp][prop]) this.__hooks[hookProp][prop].forEach(hook => hook(prop, undefined, prevValue));
					return true;
				},
			});
		}

		_doProxySet (hookProp, object, prop, value) {
			if (object[prop] === value) return true;
			const prevValue = object[prop];
			Reflect.set(object, prop, value);
			this._doFireHooksAll(hookProp, prop, value, prevValue);
			this._doFireHooks(hookProp, prop, value, prevValue);
			return true;
		}

		/** As per `_doProxySet`, but the hooks are run strictly in serial. */
		async _pDoProxySet (hookProp, object, prop, value) {
			if (object[prop] === value) return true;
			const prevValue = object[prop];
			Reflect.set(object, prop, value);
			if (this.__hooksAll[hookProp]) for (const hook of this.__hooksAll[hookProp]) await hook(prop, value, prevValue);
			if (this.__hooks[hookProp] && this.__hooks[hookProp][prop]) for (const hook of this.__hooks[hookProp][prop]) await hook(prop, value, prevValue);
			return true;
		}

		_doFireHooks (hookProp, prop, value, prevValue) {
			if (this.__hooks[hookProp] && this.__hooks[hookProp][prop]) this.__hooks[hookProp][prop].forEach(hook => hook(prop, value, prevValue));
		}

		_doFireHooksAll (hookProp, prop, value, prevValue) {
			if (this.__hooksAll[hookProp]) this.__hooksAll[hookProp].forEach(hook => hook(prop, undefined, prevValue));
		}

		// ...Not to be confused with...

		_doFireAllHooks (hookProp) {
			if (this.__hooks[hookProp]) Object.entries(this.__hooks[hookProp]).forEach(([prop, hk]) => hk(prop));
		}

		/**
		 * Register a hook versus a root property on the state object. **INTERNAL CHANGES TO CHILD OBJECTS ON THE STATE
		 *   OBJECT ARE NOT TRACKED**.
		 * @param hookProp The state object.
		 * @param prop The root property to track.
		 * @param hook The hook to run. Will be called with two arguments; the property and the value of the property being
		 *   modified.
		 */
		_addHook (hookProp, prop, hook) {
			ProxyBase._addHook_to(this.__hooks, hookProp, prop, hook);
			if (this.__hooksTmp) ProxyBase._addHook_to(this.__hooksTmp, hookProp, prop, hook);
			return hook;
		}

		static _addHook_to (obj, hookProp, prop, hook) {
			((obj[hookProp] = obj[hookProp] || {})[prop] = (obj[hookProp][prop] || [])).push(hook);
		}

		_addHookAll (hookProp, hook) {
			ProxyBase._addHookAll_to(this.__hooksAll, hookProp, hook);
			if (this.__hooksAllTmp) ProxyBase._addHookAll_to(this.__hooksAllTmp, hookProp, hook);
		}

		static _addHookAll_to (obj, hookProp, hook) {
			(obj[hookProp] = obj[hookProp] || []).push(hook);
		}

		_removeHook (hookProp, prop, hook) {
			ProxyBase._removeHook_from(this.__hooks, hookProp, prop, hook);
			if (this.__hooksTmp) ProxyBase._removeHook_from(this.__hooksTmp, hookProp, prop, hook);
		}

		static _removeHook_from (obj, hookProp, prop, hook) {
			if (obj[hookProp] && obj[hookProp][prop]) {
				const ix = obj[hookProp][prop].findIndex(hk => hk === hook);
				if (~ix) obj[hookProp][prop].splice(ix, 1);
			}
		}

		_removeHooks (hookProp, prop) {
			if (this.__hooks[hookProp]) delete this.__hooks[hookProp][prop];
			if (this.__hooksTmp && this.__hooksTmp[hookProp]) delete this.__hooksTmp[hookProp][prop];
		}

		_removeHookAll (hookProp, hook) {
			ProxyBase._removeHookAll_from(this.__hooksAll, hookProp, hook);
			if (this.__hooksAllTmp) ProxyBase._removeHook_from(this.__hooksAllTmp, hookProp, hook);
		}

		static _removeHookAll_from (obj, hookProp, hook) {
			if (obj[hookProp]) {
				const ix = obj[hookProp].findIndex(hk => hk === hook);
				if (~ix) obj[hookProp].splice(ix, 1);
			}
		}

		_resetHooks (hookProp) {
			if (hookProp !== undefined) delete this.__hooks[hookProp];
			else Object.keys(this.__hooks).forEach(prop => delete this.__hooks[prop]);
		}

		_resetHooksAll (hookProp) {
			if (hookProp !== undefined) delete this.__hooksAll[hookProp];
			else Object.keys(this.__hooksAll).forEach(prop => delete this.__hooksAll[prop]);
		}

		_saveHookCopiesTo (obj) { this.__hooksTmp = obj; }
		_saveHookAllCopiesTo (obj) { this.__hooksAllTmp = obj; }

		/**
		 * Object.assign equivalent, overwrites values on the current proxied object with some new values,
		 *   then trigger all the appropriate event handlers.
		 * @param hookProp Hook property, e.g. "state".
		 * @param proxyProp Proxied object property, e.g. "_state".
		 * @param underProp Underlying object property, e.g. "__state".
		 * @param toObj
		 * @param isOverwrite If the overwrite should clean/delete all data from the object beforehand.
		 */
		_proxyAssign (hookProp, proxyProp, underProp, toObj, isOverwrite) {
			const oldKeys = Object.keys(this[proxyProp]);
			const nuKeys = new Set(Object.keys(toObj));
			const dirtyKeyValues = {};

			if (isOverwrite) {
				oldKeys.forEach(k => {
					if (!nuKeys.has(k) && this[underProp] !== undefined) {
						const prevValue = this[proxyProp][k];
						delete this[underProp][k];
						dirtyKeyValues[k] = prevValue;
					}
				});
			}

			nuKeys.forEach(k => {
				if (!CollectionUtil.deepEquals(this[underProp][k], toObj[k])) {
					const prevValue = this[proxyProp][k];
					this[underProp][k] = toObj[k];
					dirtyKeyValues[k] = prevValue;
				}
			});

			Object.entries(dirtyKeyValues)
				.forEach(([k, prevValue]) => {
					this._doFireHooksAll(hookProp, k, this[underProp][k], prevValue);
					if (this.__hooks[hookProp] && this.__hooks[hookProp][k]) this.__hooks[hookProp][k].forEach(hk => hk(k, this[underProp][k], prevValue));
				});
		}

		_proxyAssignSimple (hookProp, toObj, isOverwrite) {
			return this._proxyAssign(hookProp, `_${hookProp}`, `__${hookProp}`, toObj, isOverwrite);
		}
	}

	return MixedProxyBase;
}

class ProxyBase extends MixinProxyBase(class {}) {}

globalThis.ProxyBase = ProxyBase;

class UiUtil {
	/**
	 * @param string String to parse.
	 * @param [fallbackEmpty] Fallback number if string is empty.
	 * @param [opts] Options Object.
	 * @param [opts.max] Max allowed return value.
	 * @param [opts.min] Min allowed return value.
	 * @param [opts.fallbackOnNaN] Return value if not a number.
	 */
	static strToInt (string, fallbackEmpty = 0, opts) { return UiUtil._strToNumber(string, fallbackEmpty, opts, true); }

	/**
	 * @param string String to parse.
	 * @param [fallbackEmpty] Fallback number if string is empty.
	 * @param [opts] Options Object.
	 * @param [opts.max] Max allowed return value.
	 * @param [opts.min] Min allowed return value.
	 * @param [opts.fallbackOnNaN] Return value if not a number.
	 */
	static strToNumber (string, fallbackEmpty = 0, opts) { return UiUtil._strToNumber(string, fallbackEmpty, opts, false); }

	static _strToNumber (string, fallbackEmpty = 0, opts, isInt) {
		opts = opts || {};
		let out;
		string = string.trim();
		if (!string) out = fallbackEmpty;
		else {
			const num = UiUtil._parseStrAsNumber(string, isInt);
			out = isNaN(num) || !isFinite(num)
				? opts.fallbackOnNaN !== undefined ? opts.fallbackOnNaN : 0
				: num;
		}
		if (opts.max != null) out = Math.min(out, opts.max);
		if (opts.min != null) out = Math.max(out, opts.min);
		return out;
	}

	/**
	 * @param string String to parse.
	 * @param [fallbackEmpty] Fallback value if string is empty.
	 * @param [opts] Options Object.
	 * @param [opts.fallbackOnNaB] Return value if not a boolean.
	 */
	static strToBool (string, fallbackEmpty = null, opts) {
		opts = opts || {};
		if (!string) return fallbackEmpty;
		string = string.trim().toLowerCase();
		if (!string) return fallbackEmpty;
		return string === "true" ? true : string === "false" ? false : opts.fallbackOnNaB;
	}

	static intToBonus (int, {isPretty = false} = {}) { return `${int >= 0 ? "+" : int < 0 ? (isPretty ? "\u2012" : "-") : ""}${Math.abs(int)}`; }

	static getEntriesAsText (entryArray) {
		if (!entryArray || !entryArray.length) return "";
		if (!(entryArray instanceof Array)) return UiUtil.getEntriesAsText([entryArray]);

		return entryArray
			.map(it => {
				if (typeof it === "string" || typeof it === "number") return it;

				return JSON.stringify(it, null, 2)
					.split("\n")
					.map(it => `  ${it}`) // Indent non-string content
				;
			})
			.flat()
			.join("\n");
	}

	static getTextAsEntries (text) {
		try {
			const lines = text
				.split("\n")
				.filter(it => it.trim())
				.map(it => {
					if (/^\s/.exec(it)) return it; // keep indented lines as-is
					return `"${it.replace(/"/g, `\\"`)}",`; // wrap strings
				})
				.map(it => {
					if (/[}\]]$/.test(it.trim())) return `${it},`; // Add trailing commas to closing `}`/`]`
					return it;
				});
			const json = `[\n${lines.join("")}\n]`
				// remove trailing commas
				.replace(/(.*?)(,)(:?\s*]|\s*})/g, "$1$3");
			return JSON.parse(json);
		} catch (e) {
			const lines = text.split("\n").filter(it => it.trim());
			const slice = lines.join(" \\ ").substring(0, 30);
			JqueryUtil.doToast({
				content: `Could not parse entries! Error was: ${e.message}<br>Text was: ${slice}${slice.length === 30 ? "..." : ""}`,
				type: "danger",
			});
			return lines;
		}
	}

	/**
	 * @param {Object} [opts] Options object.
	 * @param {string} [opts.title] Modal title.
	 *
	 * @param {string} [opts.title] Modal title.
	 *
	 * @param {string} [opts.window] Browser window.
	 *
	 * @param [opts.isUncappedHeight] {boolean}
	 * @param [opts.isUncappedWidth] {boolean}
	 * @param [opts.isHeight100] {boolean}
	 * @param [opts.isWidth100] {boolean}
	 * @param [opts.isMinHeight0] {boolean}
	 * @param [opts.isMaxWidth640p] {boolean}
	 * @param [opts.isFullscreenModal] {boolean} An alternate mode.
	 * @param [opts.isHeaderBorder] {boolean}
	 *
	 * @param {function} [opts.cbClose] Callback run when the modal is closed.
	 * @param {JQuery} [opts.$titleSplit] Element to have split alongside the title.
	 * @param {int} [opts.zIndex] Z-index of the modal.
	 * @param {number} [opts.overlayColor] Overlay color.
	 * @param {boolean} [opts.isPermanent] If the modal should be impossible to close.
	 * @param {boolean} [opts.isIndestructible] If the modal elements should be detached, not removed.
	 * @param {boolean} [opts.isClosed] If the modal should start off closed.
	 * @param {boolean} [opts.isEmpty] If the modal should contain no content.
	 * @param {boolean} [opts.hasFooter] If the modal has a footer.
	 * @returns {object}
	 */
	static getShowModal (opts) {
		opts = opts || {};

		const doc = (opts.window || window).document;

		UiUtil._initModalEscapeHandler({doc});
		UiUtil._initModalMouseupHandlers({doc});
		if (doc.activeElement) doc.activeElement.blur(); // blur any active element as it will be behind the modal

		let resolveModal;
		const pResolveModal = new Promise(resolve => { resolveModal = resolve; });

		// if the user closed the modal by clicking the "cancel" background, isDataEntered is false
		const pHandleCloseClick = async (isDataEntered, ...args) => {
			if (opts.cbClose) await opts.cbClose(isDataEntered, ...args);
			resolveModal([isDataEntered, ...args]);

			if (opts.isIndestructible) wrpOverlay.detach();
			else wrpOverlay.remove();

			doTeardown();
		};

		const doTeardown = () => {
			UiUtil._popFromModalStack(modalStackMeta);
			if (!UiUtil._MODAL_STACK.length) doc.body.classList.remove(`ui-modal__body-active`);
		};

		const doOpen = () => {
			wrpOverlay.appendTo(doc.body);
			doc.body.classList.add(`ui-modal__body-active`);
		};

		const wrpOverlay = e_({tag: "div", clazz: "ui-modal__overlay"});
		if (opts.zIndex != null) wrpOverlay.style.zIndex = `${opts.zIndex}`;
		if (opts.overlayColor != null) wrpOverlay.style.backgroundColor = `${opts.overlayColor}`;

		// In "fullscreen" mode, blank out the modal background
		const overlayBlind = opts.isFullscreenModal
			? e_({
				tag: "div",
				clazz: `ui-modal__overlay-blind w-100 h-100 ve-flex-col`,
			}).appendTo(wrpOverlay)
			: null;

		const wrpScroller = e_({
			tag: "div",
			clazz: `ui-modal__scroller ve-flex-col`,
		});

		const modalWindowClasses = [
			opts.isWidth100 ? `w-100` : "",
			opts.isHeight100 ? "h-100" : "",
			opts.isUncappedHeight ? "ui-modal__inner--uncap-height" : "",
			opts.isUncappedWidth ? "ui-modal__inner--uncap-width" : "",
			opts.isMinHeight0 ? `ui-modal__inner--no-min-height` : "",
			opts.isMaxWidth640p ? `ui-modal__inner--max-width-640p` : "",
			opts.isFullscreenModal ? `ui-modal__inner--mode-fullscreen my-0 pt-0` : "",
			opts.hasFooter ? `pb-0` : "",
		].filter(Boolean);

		const btnCloseModal = opts.isFullscreenModal ? e_({
			tag: "button",
			clazz: `btn btn-danger btn-xs`,
			html: `<span class="glyphicon glyphicon-remove></span>`,
			click: pHandleCloseClick(false),
		}) : null;

		const modalFooter = opts.hasFooter
			? e_({
				tag: "div",
				clazz: `"no-shrink w-100 ve-flex-col ui-modal__footer ${opts.isFullscreenModal ? `ui-modal__footer--fullscreen mt-1` : ""}`,
			})
			: null;

		const modal = e_({
			tag: "div",
			clazz: `ui-modal__inner ve-flex-col ${modalWindowClasses.join(" ")}`,
			children: [
				!opts.isEmpty && opts.title
					? e_({
						tag: "div",
						clazz: `split-v-center no-shrink ${opts.isHeaderBorder ? `ui-modal__header--border` : ""} ${opts.isFullscreenModal ? `ui-modal__header--fullscreen mb-1` : ""}`,
						children: [
							opts.title
								? e_({
									tag: "h4",
									clazz: `my-2`,
									html: opts.title.qq(),
								})
								: null,

							opts.$titleSplit ? opts.$titleSplit[0] : null,

							btnCloseModal,
						].filter(Boolean),
					})
					: null,

				!opts.isEmpty ? wrpScroller : null,

				modalFooter,
			].filter(Boolean),
		}).appendTo(opts.isFullscreenModal ? overlayBlind : wrpOverlay);

		wrpOverlay
			.addEventListener("mouseup", evt => {
				if (evt.target !== wrpOverlay) return;
				if (evt.target !== UiUtil._MODAL_LAST_MOUSEDOWN) return;
				if (opts.isPermanent) return;
				evt.stopPropagation();
				evt.preventDefault();
				return pHandleCloseClick(false);
			});

		if (!opts.isClosed) doOpen();

		const modalStackMeta = {
			isPermanent: opts.isPermanent,
			pHandleCloseClick,
			doTeardown,
		};
		if (!opts.isClosed) UiUtil._pushToModalStack(modalStackMeta);

		const out = {
			$modal: $(modal),
			$modalInner: $(wrpScroller),
			$modalFooter: $(modalFooter),
			doClose: pHandleCloseClick,
			doTeardown,
			pGetResolved: () => pResolveModal,
		};

		if (opts.isIndestructible || opts.isClosed) {
			out.doOpen = () => {
				UiUtil._pushToModalStack(modalStackMeta);
				doOpen();
			};
		}

		return out;
	}

	/**
	 * Async to support external overrides; should be used in common applications.
	 */
	static async pGetShowModal (opts) {
		return UiUtil.getShowModal(opts);
	}

	static _pushToModalStack (modalStackMeta) {
		if (!UiUtil._MODAL_STACK.includes(modalStackMeta)) {
			UiUtil._MODAL_STACK.push(modalStackMeta);
		}
	}

	static _popFromModalStack (modalStackMeta) {
		const ixStack = UiUtil._MODAL_STACK.indexOf(modalStackMeta);
		if (~ixStack) UiUtil._MODAL_STACK.splice(ixStack, 1);
	}

	static _initModalEscapeHandler ({doc}) {
		if (UiUtil._MODAL_STACK) return;
		UiUtil._MODAL_STACK = [];

		doc.addEventListener("keydown", evt => {
			if (evt.which !== 27) return;
			if (!UiUtil._MODAL_STACK.length) return;
			if (EventUtil.isInInput(evt)) return;

			const outerModalMeta = UiUtil._MODAL_STACK.last();
			if (!outerModalMeta) return;
			evt.stopPropagation();
			if (!outerModalMeta.isPermanent) return outerModalMeta.pHandleCloseClick(false);
		});
	}

	static _initModalMouseupHandlers ({doc}) {
		doc.addEventListener("mousedown", evt => {
			UiUtil._MODAL_LAST_MOUSEDOWN = evt.target;
		});
	}

	static isAnyModalOpen () {
		return !!UiUtil._MODAL_STACK?.length;
	}

	static addModalSep ($modalInner) {
		$modalInner.append(`<hr class="ui-modal__row-sep">`);
	}

	static $getAddModalRow ($modalInner, tag = "div") {
		return $(`<${tag} class="ui-modal__row"></${tag}>`).appendTo($modalInner);
	}

	/**
	 * @param $modalInner Element this row should be added to.
	 * @param headerText Header text.
	 * @param [opts] Options object.
	 * @param [opts.helpText] Help text (title) of select dropdown.
	 * @param [opts.$eleRhs] Element to attach to the right-hand side of the header.
	 */
	static $getAddModalRowHeader ($modalInner, headerText, opts) {
		opts = opts || {};
		const $row = UiUtil.$getAddModalRow($modalInner, "h5").addClass("bold");
		if (opts.$eleRhs) $$`<div class="split ve-flex-v-center w-100 pr-1"><span>${headerText}</span>${opts.$eleRhs}</div>`.appendTo($row);
		else $row.text(headerText);
		if (opts.helpText) $row.title(opts.helpText);
		return $row;
	}

	static $getAddModalRowCb ($modalInner, labelText, objectWithProp, propName, helpText) {
		const $row = UiUtil.$getAddModalRow($modalInner, "label").addClass(`ui-modal__row--cb`);
		if (helpText) $row.title(helpText);
		$row.append(`<span>${labelText}</span>`);
		const $cb = $(`<input type="checkbox">`).appendTo($row)
			.keydown(evt => {
				if (evt.key === "Escape") $cb.blur();
			})
			.prop("checked", objectWithProp[propName])
			.on("change", () => objectWithProp[propName] = $cb.prop("checked"));
		return $cb;
	}

	/**
	 *
	 * @param $modalInner Element this row should be added to.
	 * @param labelText Row label.
	 * @param objectWithProp Object to mutate when changing select values.
	 * @param propName Property to set in `objectWithProp`.
	 * @param values Values to display in select dropdown.
	 * @param [opts] Options object.
	 * @param [opts.helpText] Help text (title) of select dropdown.
	 * @param [opts.fnDisplay] Function used to map values to displayable versions.
	 */
	static $getAddModalRowSel ($modalInner, labelText, objectWithProp, propName, values, opts) {
		opts = opts || {};
		const $row = UiUtil.$getAddModalRow($modalInner, "label").addClass(`ui-modal__row--sel`);
		if (opts.helpText) $row.title(opts.helpText);
		$row.append(`<span>${labelText}</span>`);
		const $sel = $(`<select class="form-control input-xs w-30">`).appendTo($row);
		values.forEach((val, i) => $(`<option value="${i}"></option>`).text(opts.fnDisplay ? opts.fnDisplay(val) : val).appendTo($sel));
		// N.B. this doesn't support null values
		const ix = values.indexOf(objectWithProp[propName]);
		$sel.val(`${~ix ? ix : 0}`)
			.change(() => objectWithProp[propName] = values[$sel.val()]);
		return $sel;
	}

	static _parseStrAsNumber (str, isInt) {
		const wrpTree = Renderer.dice.lang.getTree3(str);
		if (!wrpTree) return NaN;
		const out = wrpTree.tree.evl({});
		if (!isNaN(out) && isInt) return Math.round(out);
		return out;
	}

	static bindTypingEnd ({$ipt, fnKeyup, fnKeypress, fnKeydown, fnClick} = {}) {
		let timerTyping;
		$ipt
			.on("keyup search paste", evt => {
				clearTimeout(timerTyping);
				timerTyping = setTimeout(() => { fnKeyup(evt); }, UiUtil.TYPE_TIMEOUT_MS);
			})
			// Trigger on blur, as tabbing out of a field triggers the keyup on the element which was tabbed into. Our
			//   intent. however, is to trigger on any keyup which began in this field.
			.on("blur", evt => {
				clearTimeout(timerTyping);
				fnKeyup(evt);
			})
			.on("keypress", evt => {
				if (fnKeypress) fnKeypress(evt);
			})
			.on("keydown", evt => {
				if (fnKeydown) fnKeydown(evt);
				clearTimeout(timerTyping);
			})
			.on("click", () => {
				if (fnClick) fnClick();
			})
			.on("instantKeyup", () => {
				clearTimeout(timerTyping);
				fnKeyup();
			})
		;
	}

	/** Brute-force select the input, in case something has delayed the rendering (e.g. a VTT application window) */
	static async pDoForceFocus (ele, {timeout = 250} = {}) {
		if (!ele) return;
		ele.focus();

		const forceFocusStart = Date.now();
		while ((Date.now() < forceFocusStart + timeout) && document.activeElement !== ele) {
			await MiscUtil.pDelay(33);
			ele.focus();
		}
	}
}
UiUtil.SEARCH_RESULTS_CAP = 75;
UiUtil.TYPE_TIMEOUT_MS = 100; // auto-search after 100ms
UiUtil._MODAL_STACK = null;
UiUtil._MODAL_LAST_MOUSEDOWN = null;

class ListSelectClickHandlerBase {
	static _EVT_PASS_THOUGH_TAGS = new Set(["A", "BUTTON"]);

	constructor () {
		this._firstSelection = null;
		this._lastSelection = null;

		this._selectionInitialValue = null;
	}

	/**
	 * @abstract
	 * @return {Array}
	 */
	get _visibleItems () { throw new Error("Unimplemented!"); }

	/**
	 * @abstract
	 * @return {Array}
	 */
	get _allItems () { throw new Error("Unimplemented!"); }

	/** @abstract */
	_getCb (item, opts) { throw new Error("Unimplemented!"); }

	/** @abstract */
	_setCheckbox (item, opts) { throw new Error("Unimplemented!"); }

	/** @abstract */
	_setHighlighted (item, opts) { throw new Error("Unimplemented!"); }

	/**
	 * (Public method for Plutonium use)
	 * Handle doing a checkbox-based selection toggle on a list.
	 * @param item List item.
	 * @param evt Click event.
	 * @param [opts] Options object.
	 * @param [opts.isNoHighlightSelection] If highlighting selected rows should be skipped.
	 * @param [opts.fnOnSelectionChange] Function to call when selection status of an item changes.
	 * @param [opts.fnGetCb] Function which gets the checkbox from a list item.
	 * @param [opts.isPassThroughEvents] If e.g. click events to links/buttons in the list item should be allowed/ignored.
	 */
	handleSelectClick (item, evt, opts) {
		opts = opts || {};

		if (opts.isPassThroughEvents) {
			const evtPath = evt.composedPath();
			const subEles = evtPath.slice(0, evtPath.indexOf(evt.currentTarget));
			if (subEles.some(ele => this.constructor._EVT_PASS_THOUGH_TAGS.has(ele?.tagName))) return;
		}

		evt.preventDefault();
		evt.stopPropagation();

		const cb = this._getCb(item, opts);
		if (cb.disabled) return true;

		if (evt && evt.shiftKey && this._firstSelection) {
			if (this._lastSelection === item) {
				// on double-tapping the end of the selection, toggle it on/off

				this._setCheckbox(item, {...opts, toVal: !cb.checked});
			} else if (this._firstSelection === item && this._lastSelection) {
				// If the item matches the last clicked, clear all checkboxes from our last selection

				const ix1 = this._visibleItems.indexOf(this._firstSelection);
				const ix2 = this._visibleItems.indexOf(this._lastSelection);

				const [ixStart, ixEnd] = [ix1, ix2].sort(SortUtil.ascSort);
				for (let i = ixStart; i <= ixEnd; ++i) {
					const it = this._visibleItems[i];
					this._setCheckbox(it, {...opts, toVal: false});
				}

				this._setCheckbox(item, opts);
			} else {
				// on a shift-click, toggle all the checkboxes to the value of the initial item...
				this._selectionInitialValue = this._getCb(this._firstSelection, opts).checked;

				const ix1 = this._visibleItems.indexOf(this._firstSelection);
				const ix2 = this._visibleItems.indexOf(item);
				const ix2Prev = this._lastSelection ? this._visibleItems.indexOf(this._lastSelection) : null;

				const [ixStart, ixEnd] = [ix1, ix2].sort(SortUtil.ascSort);
				const nxtOpts = {...opts, toVal: this._selectionInitialValue};
				for (let i = ixStart; i <= ixEnd; ++i) {
					const it = this._visibleItems[i];
					this._setCheckbox(it, nxtOpts);
				}

				// ...except when selecting; for those between the last selection and this selection, those to unchecked
				if (this._selectionInitialValue && ix2Prev != null) {
					if (ix2Prev > ixEnd) {
						const nxtOpts = {...opts, toVal: !this._selectionInitialValue};
						for (let i = ixEnd + 1; i <= ix2Prev; ++i) {
							const it = this._visibleItems[i];
							this._setCheckbox(it, nxtOpts);
						}
					} else if (ix2Prev < ixStart) {
						const nxtOpts = {...opts, toVal: !this._selectionInitialValue};
						for (let i = ix2Prev; i < ixStart; ++i) {
							const it = this._visibleItems[i];
							this._setCheckbox(it, nxtOpts);
						}
					}
				}
			}

			this._lastSelection = item;
		} else {
			// on a normal click, or if there's been no initial selection, just toggle the checkbox

			const cbMaster = this._getCb(item, opts);
			if (cbMaster) {
				cbMaster.checked = !cbMaster.checked;

				if (opts.fnOnSelectionChange) opts.fnOnSelectionChange(item, cbMaster.checked);

				if (!opts.isNoHighlightSelection) {
					this._setHighlighted(item, cbMaster.checked);
				}
			} else {
				if (!opts.isNoHighlightSelection) {
					this._setHighlighted(item, false);
				}
			}

			this._firstSelection = item;
			this._lastSelection = null;
			this._selectionInitialValue = null;
		}
	}

	/**
	 * Handle doing a radio-based selection toggle on a list.
	 * @param item List item.
	 * @param evt Click event.
	 */
	handleSelectClickRadio (item, evt) {
		evt.preventDefault();
		evt.stopPropagation();

		this._allItems.forEach(itemOther => {
			const cb = this._getCb(itemOther);

			if (itemOther === item) {
				// Setting this to true *should* cause the browser to update the rest for us, but since list items can
				//   be filtered/hidden, the browser won't necessarily update them all. Therefore, forcibly set
				//   `checked = false` below.
				cb.checked = true;
				this._setHighlighted(itemOther, true);
			} else {
				cb.checked = false;
				this._setHighlighted(itemOther, false);
			}
		});
	}
}

globalThis.ListSelectClickHandlerBase = ListSelectClickHandlerBase;

class ListSelectClickHandler extends ListSelectClickHandlerBase {
	constructor ({list}) {
		super();
		this._list = list;
	}

	get _visibleItems () { return this._list.visibleItems; }

	get _allItems () { return this._list.items; }

	_getCb (item, opts = {}) { return opts.fnGetCb ? opts.fnGetCb(item) : item.data.cbSel; }

	_setCheckbox (item, opts = {}) { return this.setCheckbox(item, opts); }

	_setHighlighted (item, isHighlighted) {
		if (isHighlighted) item.ele instanceof $ ? item.ele.addClass("list-multi-selected") : item.ele.classList.add("list-multi-selected");
		else item.ele instanceof $ ? item.ele.removeClass("list-multi-selected") : item.ele.classList.remove("list-multi-selected");
	}

	/* -------------------------------------------- */

	setCheckbox (item, {fnGetCb, fnOnSelectionChange, isNoHighlightSelection, toVal = true} = {}) {
		const cbSlave = this._getCb(item, {fnGetCb, fnOnSelectionChange, isNoHighlightSelection});

		if (cbSlave?.disabled) return;

		if (cbSlave) {
			cbSlave.checked = toVal;
			if (fnOnSelectionChange) fnOnSelectionChange(item, toVal);
		}

		if (isNoHighlightSelection) return;

		this._setHighlighted(item, toVal);
	}

	/**
	 * (Public method for Plutonium use)
	 */
	bindSelectAllCheckbox ($cbAll) {
		$cbAll.change(() => {
			const isChecked = $cbAll.prop("checked");
			this.setCheckboxes({isChecked});
		});
	}

	setCheckboxes ({isChecked, isIncludeHidden}) {
		(isIncludeHidden ? this._list.items : this._list.visibleItems)
			.forEach(item => {
				if (item.data.cbSel?.disabled) return;

				if (item.data.cbSel) item.data.cbSel.checked = isChecked;

				this._setHighlighted(item, isChecked);
			});
	}
}

globalThis.ListSelectClickHandler = ListSelectClickHandler;

class ListUiUtil {
	static bindPreviewButton (page, allData, item, btnShowHidePreview, {$fnGetPreviewStats} = {}) {
		btnShowHidePreview.addEventListener("click", evt => {
			const entity = allData[item.ix];
			page = page || entity?.__prop;

			const elePreviewWrp = this.getOrAddListItemPreviewLazy(item);

			this.handleClickBtnShowHideListPreview(evt, page, entity, btnShowHidePreview, elePreviewWrp, {$fnGetPreviewStats});
		});
	}

	static handleClickBtnShowHideListPreview (evt, page, entity, btnShowHidePreview, elePreviewWrp, {nxtText = null, $fnGetPreviewStats} = {}) {
		evt.stopPropagation();
		evt.preventDefault();

		nxtText = nxtText ?? btnShowHidePreview.innerHTML.trim() === this.HTML_GLYPHICON_EXPAND ? this.HTML_GLYPHICON_CONTRACT : this.HTML_GLYPHICON_EXPAND;
		const isHidden = nxtText === this.HTML_GLYPHICON_EXPAND;
		const isFluff = !!evt.shiftKey;

		elePreviewWrp.classList.toggle("ve-hidden", isHidden);
		btnShowHidePreview.innerHTML = nxtText;

		const elePreviewWrpInner = elePreviewWrp.lastElementChild;

		const isForce = (elePreviewWrp.dataset.dataType === "stats" && isFluff) || (elePreviewWrp.dataset.dataType === "fluff" && !isFluff);
		if (!isForce && elePreviewWrpInner.innerHTML) return;

		$(elePreviewWrpInner).empty().off("click").on("click", evt => { evt.stopPropagation(); });

		if (isHidden) return;

		elePreviewWrp.dataset.dataType = isFluff ? "fluff" : "stats";

		const doAppendStatView = () => ($fnGetPreviewStats || Renderer.hover.$getHoverContent_stats)(page, entity, {isStatic: true}).appendTo(elePreviewWrpInner);

		if (!evt.shiftKey || !UrlUtil.URL_TO_HASH_BUILDER[page]) {
			doAppendStatView();
			return;
		}

		Renderer.hover.pGetHoverableFluff(page, entity.source, UrlUtil.URL_TO_HASH_BUILDER[page](entity))
			.then(fluffEntity => {
				// Avoid clobbering existing elements, as other events might have updated the preview area while we were
				//  loading the fluff.
				if (elePreviewWrpInner.innerHTML) return;

				if (!fluffEntity) return doAppendStatView();
				Renderer.hover.$getHoverContent_fluff(page, fluffEntity).appendTo(elePreviewWrpInner);
			});
	}

	static getOrAddListItemPreviewLazy (item) {
		// We lazily add the preview UI, to mitigate rendering performance issues
		let elePreviewWrp;
		if (item.ele.children.length === 1) {
			elePreviewWrp = e_({
				ag: "div",
				clazz: "ve-hidden ve-flex",
				children: [
					e_({tag: "div", clazz: "col-0-5"}),
					e_({tag: "div", clazz: "col-11-5 ui-list__wrp-preview py-2 pr-2"}),
				],
			}).appendTo(item.ele);
		} else elePreviewWrp = item.ele.lastElementChild;
		return elePreviewWrp;
	}

	static bindPreviewAllButton ($btnAll, list) {
		$btnAll
			.click(async () => {
				const nxtHtml = $btnAll.html() === ListUiUtil.HTML_GLYPHICON_EXPAND
					? ListUiUtil.HTML_GLYPHICON_CONTRACT
					: ListUiUtil.HTML_GLYPHICON_EXPAND;

				if (nxtHtml === ListUiUtil.HTML_GLYPHICON_CONTRACT && list.visibleItems.length > 500) {
					const isSure = await InputUiUtil.pGetUserBoolean({
						title: "Are You Sure?",
						htmlDescription: `You are about to expand ${list.visibleItems.length} rows. This may seriously degrade performance.<br>Are you sure you want to continue?`,
					});
					if (!isSure) return;
				}

				$btnAll.html(nxtHtml);

				list.visibleItems.forEach(listItem => {
					if (listItem.data.btnShowHidePreview.innerHTML !== nxtHtml) listItem.data.btnShowHidePreview.click();
				});
			});
	}

	// ==================

	static ListSyntax = class {
		static _READONLY_WALKER = null;

		constructor (
			{
				fnGetDataList,
				pFnGetFluff,
			},
		) {
			this._fnGetDataList = fnGetDataList;
			this._pFnGetFluff = pFnGetFluff;
		}

		get _dataList () { return this._fnGetDataList(); }

		build () {
			return {
				stats: {
					help: `"stats:<text>" ("/text/" for regex) to search within stat blocks.`,
					fn: (listItem, searchTerm) => {
						if (listItem.data._textCacheStats == null) listItem.data._textCacheStats = this._getSearchCacheStats(this._dataList[listItem.ix]);
						return this._listSyntax_isTextMatch(listItem.data._textCacheStats, searchTerm);
					},
				},
				info: {
					help: `"info:<text>" ("/text/" for regex) to search within info.`,
					fn: async (listItem, searchTerm) => {
						if (listItem.data._textCacheFluff == null) listItem.data._textCacheFluff = await this._pGetSearchCacheFluff(this._dataList[listItem.ix]);
						return this._listSyntax_isTextMatch(listItem.data._textCacheFluff, searchTerm);
					},
					isAsync: true,
				},
				text: {
					help: `"text:<text>" ("/text/" for regex) to search within stat blocks plus info.`,
					fn: async (listItem, searchTerm) => {
						if (listItem.data._textCacheAll == null) {
							const {textCacheStats, textCacheFluff, textCacheAll} = await this._pGetSearchCacheAll(this._dataList[listItem.ix], {textCacheStats: listItem.data._textCacheStats, textCacheFluff: listItem.data._textCacheFluff});
							listItem.data._textCacheStats = listItem.data._textCacheStats || textCacheStats;
							listItem.data._textCacheFluff = listItem.data._textCacheFluff || textCacheFluff;
							listItem.data._textCacheAll = textCacheAll;
						}
						return this._listSyntax_isTextMatch(listItem.data._textCacheAll, searchTerm);
					},
					isAsync: true,
				},
			};
		}

		_listSyntax_isTextMatch (str, searchTerm) {
			if (!str) return false;
			if (searchTerm instanceof RegExp) return searchTerm.test(str);
			return str.includes(searchTerm);
		}

		// TODO(Future) the ideal solution to this is to render every entity to plain text (or failing that, Markdown) and
		//   indexing that text with e.g. elasticlunr.
		_getSearchCacheStats (entity) {
			return this._getSearchCache_entries(entity);
		}

		static _INDEXABLE_PROPS_ENTRIES = [
			"entries",
		];

		_getSearchCache_entries (entity, {indexableProps = null} = {}) {
			if ((indexableProps || this.constructor._INDEXABLE_PROPS_ENTRIES).every(it => !entity[it])) return "";
			const ptrOut = {_: ""};
			(indexableProps || this.constructor._INDEXABLE_PROPS_ENTRIES).forEach(it => this._getSearchCache_handleEntryProp(entity, it, ptrOut));
			return ptrOut._;
		}

		_getSearchCache_handleEntryProp (entity, prop, ptrOut) {
			if (!entity[prop]) return;

			this.constructor._READONLY_WALKER = this.constructor._READONLY_WALKER || MiscUtil.getWalker({
				keyBlocklist: new Set(["type", "colStyles", "style"]),
				isNoModification: true,
			});

			this.constructor._READONLY_WALKER.walk(
				entity[prop],
				{
					string: (str) => this._getSearchCache_handleString(ptrOut, str),
				},
			);
		}

		_getSearchCache_handleString (ptrOut, str) {
			ptrOut._ += `${Renderer.stripTags(str).toLowerCase()} -- `;
		}

		async _pGetSearchCacheFluff (entity) {
			const fluff = this._pFnGetFluff ? await this._pFnGetFluff(entity) : null;
			return fluff ? this._getSearchCache_entries(fluff, {indexableProps: ["entries"]}) : "";
		}

		async _pGetSearchCacheAll (entity, {textCacheStats = null, textCacheFluff = null}) {
			textCacheStats = textCacheStats || this._getSearchCacheStats(entity);
			textCacheFluff = textCacheFluff || await this._pGetSearchCacheFluff(entity);
			return {
				textCacheStats,
				textCacheFluff,
				textCacheAll: [textCacheStats, textCacheFluff].filter(Boolean).join(" -- "),
			};
		}
	};

	// ==================
}
ListUiUtil.HTML_GLYPHICON_EXPAND = `[+]`;
ListUiUtil.HTML_GLYPHICON_CONTRACT = `[\u2012]`;

globalThis.ListUiUtil = ListUiUtil;

class ProfUiUtil {
	/**
	 * @param state Initial state.
	 * @param [opts] Options object.
	 * @param [opts.isSimple] If the cycler only has "not proficient" and "proficient" options
	 */
	static getProfCycler (state = 0, opts) {
		opts = opts || {};

		const STATES = opts.isSimple ? Object.keys(ProfUiUtil.PROF_TO_FULL).slice(0, 2) : Object.keys(ProfUiUtil.PROF_TO_FULL);

		const NUM_STATES = Object.keys(STATES).length;

		// validate initial state
		state = Number(state) || 0;
		if (state >= NUM_STATES) state = NUM_STATES - 1;
		else if (state < 0) state = 0;

		const $btnCycle = $(`<button class="ui-prof__btn-cycle"></button>`)
			.click(() => {
				$btnCycle
					.attr("data-state", ++state >= NUM_STATES ? state = 0 : state)
					.title(ProfUiUtil.PROF_TO_FULL[state].name)
					.trigger("change");
			})
			.contextmenu(evt => {
				evt.preventDefault();
				$btnCycle
					.attr("data-state", --state < 0 ? state = NUM_STATES - 1 : state)
					.title(ProfUiUtil.PROF_TO_FULL[state].name)
					.trigger("change");
			});
		const setState = (nuState) => {
			state = nuState;
			if (state > NUM_STATES) state = 0;
			else if (state < 0) state = NUM_STATES - 1;
			$btnCycle.attr("data-state", state).title(ProfUiUtil.PROF_TO_FULL[state].name);
		};
		return {
			$ele: $btnCycle,
			setState,
			getState: () => state,
		};
	}
}
ProfUiUtil.PROF_TO_FULL = {
	"0": {
		name: "No proficiency",
		mult: 0,
	},
	"1": {
		name: "Proficiency",
		mult: 1,
	},
	"2": {
		name: "Expertise",
		mult: 2,
	},
	"3": {
		name: "Half proficiency",
		mult: 0.5,
	},
};

class TabUiUtilBase {
	static decorate (obj, {isInitMeta = false} = {}) {
		if (isInitMeta) {
			obj.__meta = {};
			obj._meta = obj._getProxy("meta", obj.__meta);
		}

		obj.__tabState = {};

		obj._getTabProps = function ({propProxy = TabUiUtilBase._DEFAULT_PROP_PROXY, tabGroup = TabUiUtilBase._DEFAULT_TAB_GROUP} = {}) {
			return {
				propProxy,
				_propProxy: `_${propProxy}`,
				__propProxy: `__${propProxy}`,
				propActive: `ixActiveTab__${tabGroup}`,
			};
		};

		/** Render a collection of tabs. */
		obj._renderTabs = function (tabMetas, {$parent, propProxy = TabUiUtilBase._DEFAULT_PROP_PROXY, tabGroup = TabUiUtilBase._DEFAULT_TAB_GROUP, cbTabChange, additionalClassesWrpHeads} = {}) {
			if (!tabMetas.length) throw new Error(`One or more tab meta must be specified!`);
			obj._resetTabs({tabGroup});

			const isSingleTab = tabMetas.length === 1;

			const {propActive, _propProxy, __propProxy} = obj._getTabProps({propProxy, tabGroup});

			this[__propProxy][propActive] = this[__propProxy][propActive] || 0;

			const $dispTabTitle = obj.__$getDispTabTitle({isSingleTab});

			const renderTabMetas_standard = (it, i) => {
				const $btnTab = obj.__$getBtnTab({
					isSingleTab,
					tabMeta: it,
					_propProxy,
					propActive,
					ixTab: i,
				});

				const $wrpTab = obj.__$getWrpTab({tabMeta: it, ixTab: i});

				return {
					...it,
					ix: i,
					$btnTab,
					$wrpTab,
				};
			};

			const tabMetasOut = tabMetas.map((it, i) => {
				if (it.type) return obj.__renderTypedTabMeta({tabMeta: it, ixTab: i});
				return renderTabMetas_standard(it, i);
			}).filter(Boolean);

			if ($parent) obj.__renderTabs_addToParent({$dispTabTitle, $parent, tabMetasOut, additionalClassesWrpHeads});

			const hkActiveTab = () => {
				tabMetasOut.forEach(it => {
					if (it.type) return; // For specially typed tabs (e.g. buttons), do nothing

					const isActive = it.ix === this[_propProxy][propActive];
					if (isActive && $dispTabTitle) $dispTabTitle.text(isSingleTab ? "" : it.name);
					if (it.$btnTab) it.$btnTab.toggleClass("active", isActive);
					it.$wrpTab.toggleVe(isActive);
				});

				if (cbTabChange) cbTabChange();
			};
			this._addHook(propProxy, propActive, hkActiveTab);
			hkActiveTab();

			obj.__tabState[tabGroup] = {
				fnReset: () => {
					this._removeHook(propProxy, propActive, hkActiveTab);
				},
				tabMetasOut,
			};

			return tabMetasOut;
		};

		obj.__renderTabs_addToParent = function ({$dispTabTitle, $parent, tabMetasOut, additionalClassesWrpHeads}) {
			const hasBorder = tabMetasOut.some(it => it.hasBorder);
			$$`<div class="ve-flex-col w-100 h-100">
				${$dispTabTitle}
				<div class="ve-flex-col w-100 h-100 min-h-0">
					<div class="ve-flex ${hasBorder ? `ui-tab__wrp-tab-heads--border` : ""} ${additionalClassesWrpHeads || ""}">${tabMetasOut.map(it => it.$btnTab)}</div>
					<div class="ve-flex w-100 h-100 min-h-0">${tabMetasOut.map(it => it.$wrpTab).filter(Boolean)}</div>
				</div>
			</div>`.appendTo($parent);
		};

		obj._resetTabs = function ({tabGroup = TabUiUtilBase._DEFAULT_TAB_GROUP} = {}) {
			if (!obj.__tabState[tabGroup]) return;
			obj.__tabState[tabGroup].fnReset();
			delete obj.__tabState[tabGroup];
		};

		obj._hasPrevTab = function ({propProxy = TabUiUtilBase._DEFAULT_PROP_PROXY, tabGroup = TabUiUtilBase._DEFAULT_TAB_GROUP} = {}) {
			return obj.__hasTab({propProxy, tabGroup, offset: -1});
		};
		obj._hasNextTab = function ({propProxy = TabUiUtilBase._DEFAULT_PROP_PROXY, tabGroup = TabUiUtilBase._DEFAULT_TAB_GROUP} = {}) {
			return obj.__hasTab({propProxy, tabGroup, offset: 1});
		};

		obj.__hasTab = function ({propProxy = TabUiUtilBase._DEFAULT_PROP_PROXY, tabGroup = TabUiUtilBase._DEFAULT_TAB_GROUP, offset}) {
			const {propActive, _propProxy} = obj._getTabProps({propProxy, tabGroup});
			const ixActive = obj[_propProxy][propActive];
			return !!(obj.__tabState[tabGroup]?.tabMetasOut && obj.__tabState[tabGroup]?.tabMetasOut[ixActive + offset]);
		};

		obj._doSwitchToPrevTab = function ({propProxy = TabUiUtilBase._DEFAULT_PROP_PROXY, tabGroup = TabUiUtilBase._DEFAULT_TAB_GROUP} = {}) {
			return obj.__doSwitchToTab({propProxy, tabGroup, offset: -1});
		};
		obj._doSwitchToNextTab = function ({propProxy = TabUiUtilBase._DEFAULT_PROP_PROXY, tabGroup = TabUiUtilBase._DEFAULT_TAB_GROUP} = {}) {
			return obj.__doSwitchToTab({propProxy, tabGroup, offset: 1});
		};

		obj.__doSwitchToTab = function ({propProxy = TabUiUtilBase._DEFAULT_PROP_PROXY, tabGroup = TabUiUtilBase._DEFAULT_TAB_GROUP, offset}) {
			if (!obj.__hasTab({propProxy, tabGroup, offset})) return;
			const {propActive, _propProxy} = obj._getTabProps({propProxy, tabGroup});
			obj[_propProxy][propActive] = obj[_propProxy][propActive] + offset;
		};

		obj._addHookActiveTab = function (hook, {propProxy = TabUiUtilBase._DEFAULT_PROP_PROXY, tabGroup = TabUiUtilBase._DEFAULT_TAB_GROUP} = {}) {
			const {propActive} = obj._getTabProps({propProxy, tabGroup});
			this._addHook(propProxy, propActive, hook);
		};

		obj._getIxActiveTab = function ({propProxy = TabUiUtilBase._DEFAULT_PROP_PROXY, tabGroup = TabUiUtilBase._DEFAULT_TAB_GROUP} = {}) {
			const {propActive, _propProxy} = obj._getTabProps({propProxy, tabGroup});
			return obj[_propProxy][propActive];
		};

		obj._setIxActiveTab = function ({propProxy = TabUiUtilBase._DEFAULT_PROP_PROXY, tabGroup = TabUiUtilBase._DEFAULT_TAB_GROUP, ixActiveTab} = {}) {
			const {propActive, _propProxy} = obj._getTabProps({propProxy, tabGroup});
			obj[_propProxy][propActive] = ixActiveTab;
		};

		obj._getActiveTab = function ({propProxy = TabUiUtilBase._DEFAULT_PROP_PROXY, tabGroup = TabUiUtilBase._DEFAULT_TAB_GROUP} = {}) {
			const tabState = obj.__tabState[tabGroup];
			const ixActiveTab = obj._getIxActiveTab({propProxy, tabGroup});
			return tabState.tabMetasOut[ixActiveTab];
		};

		obj._setActiveTab = function ({propProxy = TabUiUtilBase._DEFAULT_PROP_PROXY, tabGroup = TabUiUtilBase._DEFAULT_TAB_GROUP, tab}) {
			const tabState = obj.__tabState[tabGroup];
			const ix = tabState.tabMetasOut.indexOf(tab);
			obj._setIxActiveTab({propProxy, tabGroup, ixActiveTab: ix});
		};

		obj.__$getBtnTab = function () { throw new Error("Unimplemented!"); };
		obj.__$getWrpTab = function () { throw new Error("Unimplemented!"); };
		obj.__renderTypedTabMeta = function () { throw new Error("Unimplemented!"); };
		obj.__$getDispTabTitle = function () { throw new Error("Unimplemented!"); };
	}
}
TabUiUtilBase._DEFAULT_TAB_GROUP = "_default";
TabUiUtilBase._DEFAULT_PROP_PROXY = "meta";

TabUiUtilBase.TabMeta = class {
	constructor ({name, icon = null, type = null, buttons = null} = {}) {
		this.name = name;
		this.icon = icon;
		this.type = type;
		this.buttons = buttons;
	}
};

class TabUiUtil extends TabUiUtilBase {
	static decorate (obj, {isInitMeta = false} = {}) {
		super.decorate(obj, {isInitMeta});

		obj.__$getBtnTab = function ({tabMeta, _propProxy, propActive, ixTab}) {
			return $(`<button class="btn btn-default ui-tab__btn-tab-head ${tabMeta.isHeadHidden ? "ve-hidden" : ""}">${tabMeta.name.qq()}</button>`)
				.click(() => obj[_propProxy][propActive] = ixTab);
		};

		obj.__$getWrpTab = function ({tabMeta}) {
			return $(`<div class="ui-tab__wrp-tab-body ve-flex-col ve-hidden ${tabMeta.hasBorder ? "ui-tab__wrp-tab-body--border" : ""} ${tabMeta.hasBackground ? "ui-tab__wrp-tab-body--background" : ""}"></div>`);
		};

		obj.__renderTypedTabMeta = function ({tabMeta, ixTab}) {
			switch (tabMeta.type) {
				case "buttons": return obj.__renderTypedTabMeta_buttons({tabMeta, ixTab});
				default: throw new Error(`Unhandled tab type "${tabMeta.type}"`);
			}
		};

		obj.__renderTypedTabMeta_buttons = function ({tabMeta, ixTab}) {
			const $btns = tabMeta.buttons.map((meta, j) => {
				const $btn = $(`<button class="btn ui-tab__btn-tab-head ${meta.type ? `btn-${meta.type}` : "btn-primary"}" ${meta.title ? `title="${meta.title.qq()}"` : ""}>${meta.html}</button>`)
					.click(evt => meta.pFnClick(evt, $btn));
				return $btn;
			});

			const $btnTab = $$`<div class="btn-group ve-flex-v-right ve-flex-h-right ml-2 w-100">${$btns}</div>`;

			return {
				...tabMeta,
				ix: ixTab,
				$btns,
				$btnTab,
			};
		};

		obj.__$getDispTabTitle = function () { return null; };
	}
}

globalThis.TabUiUtil = TabUiUtil;

TabUiUtil.TabMeta = class extends TabUiUtilBase.TabMeta {
	constructor (opts) {
		super(opts);
		this.hasBorder = !!opts.hasBorder;
		this.hasBackground = !!opts.hasBackground;
		this.isHeadHidden = !!opts.isHeadHidden;
		this.isNoPadding = !!opts.isNoPadding;
	}
};

class TabUiUtilSide extends TabUiUtilBase {
	static decorate (obj, {isInitMeta = false} = {}) {
		super.decorate(obj, {isInitMeta});

		obj.__$getBtnTab = function ({isSingleTab, tabMeta, _propProxy, propActive, ixTab}) {
			return isSingleTab ? null : $(`<button class="btn btn-default btn-sm ui-tab-side__btn-tab mb-2 br-0 btr-0 bbr-0 text-left ve-flex-v-center" title="${tabMeta.name.qq()}"><div class="${tabMeta.icon} ui-tab-side__icon-tab mr-2 mobile-ish__mr-0 text-center"></div><div class="mobile-ish__hidden">${tabMeta.name.qq()}</div></button>`)
				.click(() => this[_propProxy][propActive] = ixTab);
		};

		obj.__$getWrpTab = function ({tabMeta}) {
			return $(`<div class="ve-flex-col w-100 h-100 ui-tab-side__wrp-tab ${tabMeta.isNoPadding ? "" : "px-3 py-2"} overflow-y-auto"></div>`);
		};

		obj.__renderTabs_addToParent = function ({$dispTabTitle, $parent, tabMetasOut}) {
			$$`<div class="ve-flex-col w-100 h-100">
				${$dispTabTitle}
				<div class="ve-flex w-100 h-100 min-h-0">
					<div class="ve-flex-col h-100 pt-2">${tabMetasOut.map(it => it.$btnTab)}</div>
					<div class="ve-flex-col w-100 h-100 min-w-0">${tabMetasOut.map(it => it.$wrpTab).filter(Boolean)}</div>
				</div>
			</div>`.appendTo($parent);
		};

		obj.__renderTypedTabMeta = function ({tabMeta, ixTab}) {
			switch (tabMeta.type) {
				case "buttons": return obj.__renderTypedTabMeta_buttons({tabMeta, ixTab});
				default: throw new Error(`Unhandled tab type "${tabMeta.type}"`);
			}
		};

		obj.__renderTypedTabMeta_buttons = function ({tabMeta, ixTab}) {
			const $btns = tabMeta.buttons.map((meta, j) => {
				const $btn = $(`<button class="btn ${meta.type ? `btn-${meta.type}` : "btn-primary"} btn-sm" ${meta.title ? `title="${meta.title.qq()}"` : ""}>${meta.html}</button>`)
					.click(evt => meta.pFnClick(evt, $btn));

				if (j === tabMeta.buttons.length - 1) $btn.addClass(`br-0 btr-0 bbr-0`);

				return $btn;
			});

			const $btnTab = $$`<div class="btn-group ve-flex-v-center ve-flex-h-right mb-2">${$btns}</div>`;

			return {
				...tabMeta,
				ix: ixTab,
				$btnTab,
			};
		};

		obj.__$getDispTabTitle = function ({isSingleTab}) {
			return $(`<div class="ui-tab-side__disp-active-tab-name ${isSingleTab ? `ui-tab-side__disp-active-tab-name--single` : ""} bold"></div>`);
		};
	}
}

globalThis.TabUiUtilSide = TabUiUtilSide;

// TODO have this respect the blocklist?
class SearchUiUtil {
	static async pDoGlobalInit () {
		elasticlunr.clearStopWords();
		await Renderer.item.pPopulatePropertyAndTypeReference();
	}

	static _isNoHoverCat (cat) {
		return SearchUiUtil.NO_HOVER_CATEGORIES.has(cat);
	}

	static async pGetContentIndices (options) {
		options = options || {};

		const availContent = {};

		const [searchIndexRaw] = await Promise.all([
			DataUtil.loadJSON(`${Renderer.get().baseUrl}search/index.json`),
			ExcludeUtil.pInitialise(),
		]);

		const data = Omnidexer.decompressIndex(searchIndexRaw);

		const additionalData = {};
		if (options.additionalIndices) {
			await Promise.all(options.additionalIndices.map(async add => {
				additionalData[add] = Omnidexer.decompressIndex(await DataUtil.loadJSON(`${Renderer.get().baseUrl}search/index-${add}.json`));
				const maxId = additionalData[add].last().id;

				const prereleaseIndex = await PrereleaseUtil.pGetAdditionalSearchIndices(maxId, add);
				if (prereleaseIndex.length) additionalData[add] = additionalData[add].concat(prereleaseIndex);

				const brewIndex = await BrewUtil2.pGetAdditionalSearchIndices(maxId, add);
				if (brewIndex.length) additionalData[add] = additionalData[add].concat(brewIndex);
			}));
		}

		const alternateData = {};
		if (options.alternateIndices) {
			await Promise.all(options.alternateIndices.map(async alt => {
				alternateData[alt] = Omnidexer.decompressIndex(await DataUtil.loadJSON(`${Renderer.get().baseUrl}search/index-alt-${alt}.json`));
				const maxId = alternateData[alt].last().id;

				const prereleaseIndex = await BrewUtil2.pGetAlternateSearchIndices(maxId, alt);
				if (prereleaseIndex.length) alternateData[alt] = alternateData[alt].concat(prereleaseIndex);

				const brewIndex = await BrewUtil2.pGetAlternateSearchIndices(maxId, alt);
				if (brewIndex.length) alternateData[alt] = alternateData[alt].concat(brewIndex);
			}));
		}

		const fromDeepIndex = (d) => d.d; // flag for "deep indexed" content that refers to the same item

		availContent.ALL = elasticlunr(function () {
			this.addField("n");
			this.addField("s");
			this.setRef("id");
		});
		SearchUtil.removeStemmer(availContent.ALL);

		// Add main site index
		let ixMax = 0;

		const initIndexForFullCat = (doc) => {
			if (!availContent[doc.cf]) {
				availContent[doc.cf] = elasticlunr(function () {
					this.addField("n");
					this.addField("s");
					this.setRef("id");
				});
				SearchUtil.removeStemmer(availContent[doc.cf]);
			}
		};

		const handleDataItem = (d, isAlternate) => {
			if (
				SearchUiUtil._isNoHoverCat(d.c)
				|| fromDeepIndex(d)
				|| ExcludeUtil.isExcluded(d.u, Parser.pageCategoryToProp(d.c), d.s, {isNoCount: true})
			) return;
			d.cf = d.c === Parser.CAT_ID_CREATURE ? "Creature" : Parser.pageCategoryToFull(d.c);
			if (isAlternate) d.cf = `alt_${d.cf}`;
			initIndexForFullCat(d);
			if (!isAlternate) availContent.ALL.addDoc(d);
			availContent[d.cf].addDoc(d);
			ixMax = Math.max(ixMax, d.id);
		};

		data.forEach(d => handleDataItem(d));
		Object.values(additionalData).forEach(arr => arr.forEach(d => handleDataItem(d)));
		Object.values(alternateData).forEach(arr => arr.forEach(d => handleDataItem(d, true)));

		const pAddPrereleaseBrewIndex = async ({brewUtil}) => {
			const brewIndex = await brewUtil.pGetSearchIndex({id: availContent.ALL.documentStore.length});

			brewIndex.forEach(d => {
				if (SearchUiUtil._isNoHoverCat(d.c) || fromDeepIndex(d)) return;
				d.cf = Parser.pageCategoryToFull(d.c);
				d.cf = d.c === Parser.CAT_ID_CREATURE ? "Creature" : Parser.pageCategoryToFull(d.c);
				initIndexForFullCat(d);
				availContent.ALL.addDoc(d);
				availContent[d.cf].addDoc(d);
			});
		};

		await pAddPrereleaseBrewIndex({brewUtil: PrereleaseUtil});
		await pAddPrereleaseBrewIndex({brewUtil: BrewUtil2});

		return availContent;
	}
}
SearchUiUtil.NO_HOVER_CATEGORIES = new Set([
	Parser.CAT_ID_ADVENTURE,
	Parser.CAT_ID_BOOK,
	Parser.CAT_ID_QUICKREF,
	Parser.CAT_ID_PAGE,
]);

// based on DM screen's AddMenuSearchTab
class SearchWidget {
	static getSearchNoResults () {
		return `<div class="ui-search__message"><i>No results.</i></div>`;
	}

	static getSearchLoading () {
		return `<div class="ui-search__message"><i>\u2022\u2022\u2022</i></div>`;
	}

	static getSearchEnter () {
		return `<div class="ui-search__message"><i>Enter a search.</i></div>`;
	}

	/**
	 * @param $iptSearch input element
	 * @param opts Options object.
	 * @param opts.fnSearch Function which runs the search.
	 * @param opts.fnShowWait Function which displays loading dots
	 * @param opts.flags Flags object; modified during user interaction.
	 * @param opts.flags.isWait Flag tracking "waiting for user to stop typing"
	 * @param opts.flags.doClickFirst Flag tracking "should first result get clicked"
	 * @param opts.flags.doClickFirst Flag tracking "should first result get clicked"
	 * @param opts.$ptrRows Pointer to array of rows.
	 */
	static bindAutoSearch ($iptSearch, opts) {
		UiUtil.bindTypingEnd({
			$ipt: $iptSearch,
			fnKeyup: evt => {
				if (evt.type === "blur") return;

				// Handled in `fnKeydown`
				switch (evt.key) {
					case "ArrowDown": {
						evt.preventDefault();
						return;
					}
					case "Enter": return;
				}

				opts.fnSearch && opts.fnSearch();
			},
			fnKeypress: evt => {
				switch (evt.key) {
					case "ArrowDown": {
						evt.preventDefault();
						return;
					}
					case "Enter": {
						opts.flags.doClickFirst = true;
						opts.fnSearch && opts.fnSearch();
					}
				}
			},
			fnKeydown: evt => {
				if (opts.flags.isWait) {
					opts.flags.isWait = false;
					opts.fnShowWait && opts.fnShowWait();
					return;
				}

				switch (evt.key) {
					case "ArrowDown": {
						if (opts.$ptrRows && opts.$ptrRows._[0]) {
							evt.stopPropagation();
							evt.preventDefault();
							opts.$ptrRows._[0][0].focus();
						}
						break;
					}
					case "Enter": {
						if (opts.$ptrRows && opts.$ptrRows._[0]) {
							evt.preventDefault();
							opts.$ptrRows._[0].click();
						}
						break;
					}
				}
			},
			fnClick: () => {
				if (opts.fnSearch && $iptSearch.val() && $iptSearch.val().trim().length) opts.fnSearch();
			},
		});
	}

	static bindRowHandlers ({result, $row, $ptrRows, fnHandleClick, $iptSearch}) {
		return $row
			.keydown(evt => {
				switch (evt.which) {
					case 13: { // enter
						return fnHandleClick(result);
					}
					case 38: { // up
						evt.preventDefault();
						const ixRow = $ptrRows._.indexOf($row);
						const $prev = $ptrRows._[ixRow - 1];
						if ($prev) $prev.focus();
						else $iptSearch.focus();
						break;
					}
					case 40: { // down
						evt.preventDefault();
						const ixRow = $ptrRows._.indexOf($row);
						const $nxt = $ptrRows._[ixRow + 1];
						if ($nxt) $nxt.focus();
						break;
					}
				}
			})
			.click(() => fnHandleClick(result));
	}

	static docToPageSourceHash (doc) {
		const page = UrlUtil.categoryToHoverPage(doc.c);
		const source = doc.s;
		const hash = doc.u;

		return {page, source, hash};
	}

	/**
	 * @param indexes An object with index names (categories) as the keys, and indexes as the values.
	 * @param cbSearch Callback to run on user clicking a search result.
	 * @param options Options object.
	 * @param options.defaultCategory Default search category.
	 * @param options.fnFilterResults Function which takes a document and returns false if it is to be filtered out of the results.
	 * @param options.searchOptions Override for default elasticlunr search options.
	 * @param options.fnTransform Function which transforms the document before passing it back to cbSearch.
	 */
	constructor (indexes, cbSearch, options) {
		options = options || {};

		this._indexes = indexes;
		this._cat = options.defaultCategory || "ALL";
		this._cbSearch = cbSearch;
		this._fnFilterResults = options.fnFilterResults || null;
		this._searchOptions = options.searchOptions || null;
		this._fnTransform = options.fnTransform || null;

		this._flags = {
			doClickFirst: false,
			isWait: false,
		};
		this._$ptrRows = {_: []};

		this._$selCat = null;
		this._$iptSearch = null;
		this._$wrpResults = null;

		this._$rendered = null;
	}

	static pDoGlobalInit () {
		if (!SearchWidget.P_LOADING_CONTENT) {
			SearchWidget.P_LOADING_CONTENT = (async () => {
				Object.assign(SearchWidget.CONTENT_INDICES, await SearchUiUtil.pGetContentIndices({additionalIndices: ["item"], alternateIndices: ["spell"]}));
			})();
		}
		return SearchWidget.P_LOADING_CONTENT;
	}

	__getSearchOptions () {
		return this._searchOptions || {
			fields: {
				n: {boost: 5, expand: true},
				s: {expand: true},
			},
			bool: "AND",
			expand: true,
		};
	}

	__$getRow (r) {
		return $(`<div class="ui-search__row" tabindex="0">
			<span>${r.doc.n}</span>
			<span>${r.doc.s ? `<i title="${Parser.sourceJsonToFull(r.doc.s)}">${Parser.sourceJsonToAbv(r.doc.s)}${r.doc.p ? ` p${r.doc.p}` : ""}</i>` : ""}</span>
		</div>`);
	}

	static __getAllTitle () {
		return "All Categories";
	}

	static __getCatOptionText (it) {
		return it;
	}

	get $wrpSearch () {
		if (!this._$rendered) this._render();
		return this._$rendered;
	}

	__showMsgInputRequired () {
		this._flags.isWait = true;
		this._$wrpResults.empty().append(SearchWidget.getSearchEnter());
	}

	__showMsgWait () {
		this._$wrpResults.empty().append(SearchWidget.getSearchLoading());
	}

	__showMsgNoResults () {
		this._flags.isWait = true;
		this._$wrpResults.empty().append(SearchWidget.getSearchNoResults());
	}

	__doSearch () {
		const searchInput = this._$iptSearch.val().trim();

		const index = this._indexes[this._cat];
		const results = index.search(searchInput, this.__getSearchOptions());

		const {toProcess, resultCount} = (() => {
			if (results.length) {
				if (this._fnFilterResults) {
					const filtered = results.filter(it => this._fnFilterResults(it.doc));
					return {
						toProcess: filtered.slice(0, UiUtil.SEARCH_RESULTS_CAP),
						resultCount: filtered.length,
					};
				} else {
					return {
						toProcess: results.slice(0, UiUtil.SEARCH_RESULTS_CAP),
						resultCount: results.length,
					};
				}
			} else {
				// If the user has entered a search and we found nothing, return no results
				if (searchInput.trim()) {
					return {
						toProcess: [],
						resultCount: 0,
					};
				}

				// Otherwise, we have no search term, so show a default list of results
				if (this._fnFilterResults) {
					const filtered = Object.values(index.documentStore.docs).filter(it => this._fnFilterResults(it)).map(it => ({doc: it}));
					return {
						toProcess: filtered.slice(0, UiUtil.SEARCH_RESULTS_CAP),
						resultCount: filtered.length,
					};
				} else {
					return {
						toProcess: Object.values(index.documentStore.docs).slice(0, UiUtil.SEARCH_RESULTS_CAP).map(it => ({doc: it})),
						resultCount: Object.values(index.documentStore.docs).length,
					};
				}
			}
		})();

		this._$wrpResults.empty();
		this._$ptrRows._ = [];

		if (resultCount) {
			const handleClick = (r) => {
				if (this._fnTransform) this._cbSearch(this._fnTransform(r.doc));
				else this._cbSearch(r.doc);
			};

			if (this._flags.doClickFirst) {
				handleClick(toProcess[0]);
				this._flags.doClickFirst = false;
				return;
			}

			const res = toProcess.slice(0, UiUtil.SEARCH_RESULTS_CAP);

			res.forEach(r => {
				const $row = this.__$getRow(r).appendTo(this._$wrpResults);
				SearchWidget.bindRowHandlers({result: r, $row, $ptrRows: this._$ptrRows, fnHandleClick: handleClick, $iptSearch: this._$iptSearch});
				this._$ptrRows._.push($row);
			});

			if (resultCount > UiUtil.SEARCH_RESULTS_CAP) {
				const diff = resultCount - UiUtil.SEARCH_RESULTS_CAP;
				this._$wrpResults.append(`<div class="ui-search__row ui-search__row--readonly">...${diff} more result${diff === 1 ? " was" : "s were"} hidden. Refine your search!</div>`);
			}
		} else {
			if (!searchInput.trim()) this.__showMsgInputRequired();
			else this.__showMsgNoResults();
		}
	}

	_render () {
		if (!this._$rendered) {
			this._$rendered = $(`<div class="ui-search__wrp-output"></div>`);
			const $wrpControls = $(`<div class="ui-search__wrp-controls"></div>`).appendTo(this._$rendered);

			this._$selCat = $(`<select class="form-control ui-search__sel-category">
				<option value="ALL">${SearchWidget.__getAllTitle()}</option>
				${Object.keys(this._indexes).sort().filter(it => it !== "ALL").map(it => `<option value="${it}">${SearchWidget.__getCatOptionText(it)}</option>`).join("")}
			</select>`)
				.appendTo($wrpControls).toggle(Object.keys(this._indexes).length !== 1)
				.on("change", () => {
					this._cat = this._$selCat.val();
					this.__doSearch();
				});

			this._$iptSearch = $(`<input class="ui-search__ipt-search search form-control" autocomplete="off" placeholder="Search...">`).appendTo($wrpControls);
			this._$wrpResults = $(`<div class="ui-search__wrp-results"></div>`).appendTo(this._$rendered);

			let lastSearchTerm = "";
			SearchWidget.bindAutoSearch(this._$iptSearch, {
				flags: this._flags,
				fnSearch: this.__doSearch.bind(this),
				fnShowWait: this.__showMsgWait.bind(this),
				$ptrRows: this._$ptrRows,
			});

			// On the first keypress, switch to loading dots
			this._$iptSearch.keydown(evt => {
				if (evt.key === "Escape") this._$iptSearch.blur();
				if (!this._$iptSearch.val().trim().length) return;
				if (evt.which !== 13) {
					if (lastSearchTerm === "") this.__showMsgWait();
					lastSearchTerm = this._$iptSearch.val();
				}
			});

			this.__doSearch();
		}
	}

	doFocus () {
		this._$iptSearch.focus();
	}

	static async pAddToIndexes (prop, entry) {
		const nextId = Object.values(SearchWidget.CONTENT_INDICES.ALL.documentStore.docs).length;

		const indexer = new Omnidexer(nextId);

		const toIndex = {[prop]: [entry]};

		const toIndexMultiPart = Omnidexer.TO_INDEX__FROM_INDEX_JSON.filter(it => it.listProp === prop);
		for (const it of toIndexMultiPart) await indexer.pAddToIndex(it, toIndex);

		const toIndexSinglePart = Omnidexer.TO_INDEX.filter(it => it.listProp === prop);
		for (const it of toIndexSinglePart) await indexer.pAddToIndex(it, toIndex);

		const toAdd = Omnidexer.decompressIndex(indexer.getIndex());
		toAdd.forEach(d => {
			d.cf = d.c === Parser.CAT_ID_CREATURE ? "Creature" : Parser.pageCategoryToFull(d.c);
			SearchWidget.CONTENT_INDICES.ALL.addDoc(d);
			SearchWidget.CONTENT_INDICES[d.cf].addDoc(d);
		});
	}

	// region entity searches
	static async pGetUserSpellSearch (opts) {
		opts = opts || {};
		await SearchWidget.P_LOADING_CONTENT;

		const nxtOpts = {
			fnTransform: doc => {
				const cpy = MiscUtil.copyFast(doc);
				Object.assign(cpy, SearchWidget.docToPageSourceHash(cpy));
				cpy.tag = `{@spell ${doc.n.toSpellCase()}${doc.s !== Parser.SRC_PHB ? `|${doc.s}` : ""}}`;
				return cpy;
			},
		};
		if (opts.level != null) nxtOpts.fnFilterResults = result => result.lvl === opts.level;

		const title = opts.level === 0 ? "Select Cantrip" : "Select Spell";
		return SearchWidget.pGetUserEntitySearch(
			title,
			"alt_Spell",
			nxtOpts,
		);
	}

	static async pGetUserLegendaryGroupSearch () {
		await SearchWidget.pLoadCustomIndex({
			contentIndexName: "entity_LegendaryGroups",
			errorName: "legendary groups",
			customIndexSubSpecs: [
				new SearchWidget.CustomIndexSubSpec({
					dataSource: `${Renderer.get().baseUrl}data/bestiary/legendarygroups.json`,
					prop: "legendaryGroup",
					catId: Parser.CAT_ID_LEGENDARY_GROUP,
					page: "legendaryGroup",
				}),
			],
		});

		return SearchWidget.pGetUserEntitySearch(
			"Select Legendary Group",
			"entity_LegendaryGroups",
			{
				fnTransform: doc => {
					const cpy = MiscUtil.copyFast(doc);
					Object.assign(cpy, SearchWidget.docToPageSourceHash(cpy));
					cpy.page = "legendaryGroup";
					return cpy;
				},
			},
		);
	}

	static async pGetUserFeatSearch () {
		// FIXME convert to be more like spell/creature search instead of running custom indexes
		await SearchWidget.pLoadCustomIndex({
			contentIndexName: "entity_Feats",
			errorName: "feats",
			customIndexSubSpecs: [
				new SearchWidget.CustomIndexSubSpec({
					dataSource: `${Renderer.get().baseUrl}data/feats.json`,
					prop: "feat",
					catId: Parser.CAT_ID_FEAT,
					page: UrlUtil.PG_FEATS,
				}),
			],
		});

		return SearchWidget.pGetUserEntitySearch(
			"Select Feat",
			"entity_Feats",
			{
				fnTransform: doc => {
					const cpy = MiscUtil.copyFast(doc);
					Object.assign(cpy, SearchWidget.docToPageSourceHash(cpy));
					cpy.tag = `{@feat ${doc.n}${doc.s !== Parser.SRC_PHB ? `|${doc.s}` : ""}}`;
					return cpy;
				},
			},
		);
	}

	static async pGetUserBackgroundSearch () {
		// FIXME convert to be more like spell/creature search instead of running custom indexes
		await SearchWidget.pLoadCustomIndex({
			contentIndexName: "entity_Backgrounds",
			errorName: "backgrounds",
			customIndexSubSpecs: [
				new SearchWidget.CustomIndexSubSpec({
					dataSource: `${Renderer.get().baseUrl}data/backgrounds.json`,
					prop: "background",
					catId: Parser.CAT_ID_BACKGROUND,
					page: UrlUtil.PG_BACKGROUNDS,
				}),
			],
		});

		return SearchWidget.pGetUserEntitySearch(
			"Select Background",
			"entity_Backgrounds",
			{
				fnTransform: doc => {
					const cpy = MiscUtil.copyFast(doc);
					Object.assign(cpy, SearchWidget.docToPageSourceHash(cpy));
					cpy.tag = `{@background ${doc.n}${doc.s !== Parser.SRC_PHB ? `|${doc.s}` : ""}}`;
					return cpy;
				},
			},
		);
	}

	static async pGetUserRaceSearch () {
		// FIXME convert to be more like spell/creature search instead of running custom indexes
		const dataSource = () => {
			return DataUtil.race.loadJSON();
		};
		await SearchWidget.pLoadCustomIndex({
			contentIndexName: "entity_Races",
			errorName: "races",
			customIndexSubSpecs: [
				new SearchWidget.CustomIndexSubSpec({
					dataSource,
					prop: "race",
					catId: Parser.CAT_ID_RACE,
					page: UrlUtil.PG_RACES,
				}),
			],
		});

		return SearchWidget.pGetUserEntitySearch(
			"Select Race",
			"entity_Races",
			{
				fnTransform: doc => {
					const cpy = MiscUtil.copyFast(doc);
					Object.assign(cpy, SearchWidget.docToPageSourceHash(cpy));
					cpy.tag = `{@race ${doc.n}${doc.s !== Parser.SRC_PHB ? `|${doc.s}` : ""}}`;
					return cpy;
				},
			},
		);
	}

	static async pGetUserOptionalFeatureSearch () {
		// FIXME convert to be more like spell/creature search instead of running custom indexes
		await SearchWidget.pLoadCustomIndex({
			contentIndexName: "entity_OptionalFeatures",
			errorName: "optional features",
			customIndexSubSpecs: [
				new SearchWidget.CustomIndexSubSpec({
					dataSource: `${Renderer.get().baseUrl}data/optionalfeatures.json`,
					prop: "optionalfeature",
					catId: Parser.CAT_ID_OPTIONAL_FEATURE_OTHER,
					page: UrlUtil.PG_OPT_FEATURES,
				}),
			],
		});

		return SearchWidget.pGetUserEntitySearch(
			"Select Optional Feature",
			"entity_OptionalFeatures",
			{
				fnTransform: doc => {
					const cpy = MiscUtil.copyFast(doc);
					Object.assign(cpy, SearchWidget.docToPageSourceHash(cpy));
					cpy.tag = `{@optfeature ${doc.n}${doc.s !== Parser.SRC_PHB ? `|${doc.s}` : ""}}`;
					return cpy;
				},
			},
		);
	}

	static async pGetUserAdventureSearch (opts) {
		await SearchWidget.pLoadCustomIndex({
			contentIndexName: "entity_Adventures",
			errorName: "adventures",
			customIndexSubSpecs: [
				new SearchWidget.CustomIndexSubSpec({
					dataSource: `${Renderer.get().baseUrl}data/adventures.json`,
					prop: "adventure",
					catId: Parser.CAT_ID_ADVENTURE,
					page: UrlUtil.PG_ADVENTURE,
				}),
			],
		});
		return SearchWidget.pGetUserEntitySearch("Select Adventure", "entity_Adventures", opts);
	}

	static async pGetUserBookSearch (opts) {
		await SearchWidget.pLoadCustomIndex({
			contentIndexName: "entity_Books",
			errorName: "books",
			customIndexSubSpecs: [
				new SearchWidget.CustomIndexSubSpec({
					dataSource: `${Renderer.get().baseUrl}data/books.json`,
					prop: "book",
					catId: Parser.CAT_ID_BOOK,
					page: UrlUtil.PG_BOOK,
				}),
			],
		});
		return SearchWidget.pGetUserEntitySearch("Select Book", "entity_Books", opts);
	}

	static async pGetUserAdventureBookSearch (opts) {
		const contentIndexName = opts.contentIndexName || "entity_AdventuresBooks";
		await SearchWidget.pLoadCustomIndex({
			contentIndexName,
			errorName: "adventures/books",
			customIndexSubSpecs: [
				new SearchWidget.CustomIndexSubSpec({
					dataSource: `${Renderer.get().baseUrl}data/adventures.json`,
					prop: "adventure",
					catId: Parser.CAT_ID_ADVENTURE,
					page: UrlUtil.PG_ADVENTURE,
					pFnGetDocExtras: opts.pFnGetDocExtras,
				}),
				new SearchWidget.CustomIndexSubSpec({
					dataSource: `${Renderer.get().baseUrl}data/books.json`,
					prop: "book",
					catId: Parser.CAT_ID_BOOK,
					page: UrlUtil.PG_BOOK,
					pFnGetDocExtras: opts.pFnGetDocExtras,
				}),
			],
		});
		return SearchWidget.pGetUserEntitySearch("Select Adventure or Book", contentIndexName, opts);
	}

	static async pGetUserCreatureSearch () {
		await SearchWidget.P_LOADING_CONTENT;

		const nxtOpts = {
			fnTransform: doc => {
				const cpy = MiscUtil.copyFast(doc);
				Object.assign(cpy, SearchWidget.docToPageSourceHash(cpy));
				cpy.tag = `{@creature ${doc.n}${doc.s !== Parser.SRC_MM ? `|${doc.s}` : ""}}`;
				return cpy;
			},
		};

		return SearchWidget.pGetUserEntitySearch(
			"Select Creature",
			"Creature",
			nxtOpts,
		);
	}

	static async __pLoadItemIndex (isBasicIndex) {
		const dataSource = async () => {
			const allItems = (await Renderer.item.pBuildList()).filter(it => !it._isItemGroup);
			return {
				item: allItems.filter(it => {
					if (it.type === "GV") return false;
					if (isBasicIndex == null) return true;
					const isBasic = it.rarity === "none" || it.rarity === "unknown" || it._category === "basic";
					return isBasicIndex ? isBasic : !isBasic;
				}),
			};
		};
		const indexName = isBasicIndex == null ? "entity_Items" : isBasicIndex ? "entity_ItemsBasic" : "entity_ItemsMagic";

		return SearchWidget.pLoadCustomIndex({
			contentIndexName: indexName,
			errorName: "items",
			customIndexSubSpecs: [
				new SearchWidget.CustomIndexSubSpec({
					dataSource,
					prop: "item",
					catId: Parser.CAT_ID_ITEM,
					page: UrlUtil.PG_ITEMS,
				}),
			],
		});
	}

	static async __pGetUserItemSearch (isBasicIndex) {
		const indexName = isBasicIndex == null ? "entity_Items" : isBasicIndex ? "entity_ItemsBasic" : "entity_ItemsMagic";
		return SearchWidget.pGetUserEntitySearch(
			"Select Item",
			indexName,
			{
				fnTransform: doc => {
					const cpy = MiscUtil.copyFast(doc);
					Object.assign(cpy, SearchWidget.docToPageSourceHash(cpy));
					cpy.tag = `{@item ${doc.n}${doc.s !== Parser.SRC_DMG ? `|${doc.s}` : ""}}`;
					return cpy;
				},
			},
		);
	}

	static async pGetUserBasicItemSearch () {
		await SearchWidget.__pLoadItemIndex(true);
		return SearchWidget.__pGetUserItemSearch(true);
	}

	static async pGetUserMagicItemSearch () {
		await SearchWidget.__pLoadItemIndex(false);
		return SearchWidget.__pGetUserItemSearch(false);
	}

	static async pGetUserItemSearch () {
		await SearchWidget.__pLoadItemIndex();
		return SearchWidget.__pGetUserItemSearch();
	}
	// endregion

	/**
	 *
	 * @param title
	 * @param indexName
	 * @param [opts]
	 * @param [opts.fnFilterResults]
	 * @param [opts.fnTransform]
	 */
	static async pGetUserEntitySearch (title, indexName, opts) {
		opts = opts || {};

		return new Promise(resolve => {
			const searchOpts = {defaultCategory: indexName};
			if (opts.fnFilterResults) searchOpts.fnFilterResults = opts.fnFilterResults;
			if (opts.fnTransform) searchOpts.fnTransform = opts.fnTransform;

			const searchWidget = new SearchWidget(
				{[indexName]: SearchWidget.CONTENT_INDICES[indexName]},
				(docOrTransformed) => {
					doClose(false); // "cancel" close
					resolve(docOrTransformed);
				},
				searchOpts,
			);
			const {$modalInner, doClose} = UiUtil.getShowModal({
				title,
				cbClose: (doResolve) => {
					searchWidget.$wrpSearch.detach();
					if (doResolve) resolve(null); // ensure resolution
				},
			});
			$modalInner.append(searchWidget.$wrpSearch);
			searchWidget.doFocus();
		});
	}

	// region custom search indexes
	static CustomIndexSubSpec = class {
		constructor ({dataSource, prop, catId, page, pFnGetDocExtras}) {
			this.dataSource = dataSource;
			this.prop = prop;
			this.catId = catId;
			this.page = page;
			this.pFnGetDocExtras = pFnGetDocExtras;
		}
	};

	static async pLoadCustomIndex ({contentIndexName, customIndexSubSpecs, errorName}) {
		if (SearchWidget.P_LOADING_INDICES[contentIndexName]) await SearchWidget.P_LOADING_INDICES[contentIndexName];
		else {
			const doClose = SearchWidget._showLoadingModal();

			try {
				SearchWidget.P_LOADING_INDICES[contentIndexName] = (SearchWidget.CONTENT_INDICES[contentIndexName] = await SearchWidget._pGetIndex(customIndexSubSpecs));
				SearchWidget.P_LOADING_INDICES[contentIndexName] = null;
			} catch (e) {
				JqueryUtil.doToast({type: "danger", content: `Could not load ${errorName}! ${VeCt.STR_SEE_CONSOLE}`});
				throw e;
			} finally {
				doClose();
			}
		}
	}

	static async _pGetIndex (customIndexSubSpecs) {
		const index = elasticlunr(function () {
			this.addField("n");
			this.addField("s");
			this.setRef("id");
		});

		let id = 0;
		for (const subSpec of customIndexSubSpecs) {
			const [json, prerelease, brew] = await Promise.all([
				typeof subSpec.dataSource === "string"
					? DataUtil.loadJSON(subSpec.dataSource)
					: subSpec.dataSource(),
				PrereleaseUtil.pGetBrewProcessed(),
				BrewUtil2.pGetBrewProcessed(),
			]);

			await [
				...json[subSpec.prop],
				...(prerelease[subSpec.prop] || []),
				...(brew[subSpec.prop] || []),
			]
				.pSerialAwaitMap(async ent => {
					const doc = {
						id: id++,
						c: subSpec.catId,
						cf: Parser.pageCategoryToFull(subSpec.catId),
						h: 1,
						n: ent.name,
						q: subSpec.page,
						s: ent.source,
						u: UrlUtil.URL_TO_HASH_BUILDER[subSpec.page](ent),
					};
					if (subSpec.pFnGetDocExtras) Object.assign(doc, await subSpec.pFnGetDocExtras({ent, doc, subSpec}));
					index.addDoc(doc);
				});
		}

		return index;
	}

	static _showLoadingModal () {
		const {$modalInner, doClose} = UiUtil.getShowModal({isPermanent: true});
		$(`<div class="ve-flex-vh-center w-100 h-100"><span class="dnd-font italic ve-muted">Loading...</span></div>`).appendTo($modalInner);
		return doClose;
	}
	// endregion
}
SearchWidget.P_LOADING_CONTENT = null;
SearchWidget.CONTENT_INDICES = {};
SearchWidget.P_LOADING_INDICES = {};

class InputUiUtil {
	static async _pGetShowModal (getShowModalOpts) {
		return UiUtil.getShowModal(getShowModalOpts);
	}

	static _$getBtnOk ({comp = null, opts, doClose}) {
		return $(`<button class="btn btn-primary mr-2">${opts.buttonText || "OK"}</button>`)
			.click(evt => {
				evt.stopPropagation();
				if (comp && !comp._state.isValid) return JqueryUtil.doToast({content: `Please enter valid input!`, type: "warning"});
				doClose(true);
			});
	}

	static _$getBtnCancel ({comp = null, opts, doClose}) {
		return $(`<button class="btn btn-default">Cancel</button>`)
			.click(evt => {
				evt.stopPropagation();
				doClose(false);
			});
	}

	static _$getBtnSkip ({comp = null, opts, doClose}) {
		return !opts.isSkippable ? null : $(`<button class="btn btn-default ml-3">Skip</button>`)
			.click(evt => {
				evt.stopPropagation();
				doClose(VeCt.SYM_UI_SKIP);
			});
	}

	/**
	 * @param opts Options.
	 * @param opts.min Minimum value.
	 * @param opts.max Maximum value.
	 * @param opts.int If the value returned should be an integer.
	 * @param opts.title Prompt title.
	 * @param opts.default Default value.
	 * @param [opts.$elePre] Element to add before the number input.
	 * @param [opts.$elePost] Element to add after the number input.
	 * @param [opts.isPermanent] If the prompt can only be closed by entering a number.
	 * @param [opts.isSkippable] If the prompt is skippable.
	 * @param [opts.storageKey_default] Storage key for a "default" value override using the user's last/previous input.
	 * @param [opts.isGlobal_default] If the "default" storage key is global (rather than page-specific).
	 * @return {Promise<number>} A promise which resolves to the number if the user entered one, or null otherwise.
	 */
	static async pGetUserNumber (opts) {
		opts = opts || {};

		let defaultVal = opts.default !== undefined ? opts.default : null;
		if (opts.storageKey_default) {
			const prev = await (opts.isGlobal_default ? StorageUtil.pGet(opts.storageKey_default) : StorageUtil.pGetForPage(opts.storageKey_default));
			if (prev != null) defaultVal = prev;
		}

		const $iptNumber = $(`<input class="form-control mb-2 text-right" ${opts.min ? `min="${opts.min}"` : ""} ${opts.max ? `max="${opts.max}"` : ""}>`)
			.keydown(evt => {
				if (evt.key === "Escape") { $iptNumber.blur(); return; }

				evt.stopPropagation();
				if (evt.key === "Enter") {
					evt.preventDefault();
					doClose(true);
				}
			});
		if (defaultVal !== undefined) $iptNumber.val(defaultVal);

		const {$modalInner, doClose, pGetResolved, doAutoResize: doAutoResizeModal} = await InputUiUtil._pGetShowModal({
			title: opts.title || "Enter a Number",
			isMinHeight0: true,
		});

		const $btnOk = this._$getBtnOk({opts, doClose});
		const $btnCancel = this._$getBtnCancel({opts, doClose});
		const $btnSkip = this._$getBtnSkip({opts, doClose});

		if (opts.$elePre) opts.$elePre.appendTo($modalInner);
		$iptNumber.appendTo($modalInner);
		if (opts.$elePost) opts.$elePost.appendTo($modalInner);
		$$`<div class="ve-flex-v-center ve-flex-h-right pb-1 px-1">${$btnOk}${$btnCancel}${$btnSkip}</div>`.appendTo($modalInner);

		if (doAutoResizeModal) doAutoResizeModal();

		$iptNumber.focus();
		$iptNumber.select();

		// region Output
		const [isDataEntered] = await pGetResolved();

		if (typeof isDataEntered === "symbol") return isDataEntered;

		if (!isDataEntered) return null;
		const outRaw = $iptNumber.val();
		if (!outRaw.trim()) return null;
		let out = UiUtil.strToInt(outRaw);
		if (opts.min) out = Math.max(opts.min, out);
		if (opts.max) out = Math.min(opts.max, out);
		if (opts.int) out = Math.round(out);

		if (opts.storageKey_default) {
			opts.isGlobal_default
				? StorageUtil.pSet(opts.storageKey_default, out).then(null)
				: StorageUtil.pSetForPage(opts.storageKey_default, out).then(null);
		}

		return out;
		// endregion
	}

	/**
	 * @param [opts] Options.
	 * @param [opts.title] Prompt title.
	 * @param [opts.textYesRemember] Text for "yes, and remember" button.
	 * @param [opts.textYes] Text for "yes" button.
	 * @param [opts.textNo] Text for "no" button.
	 * @param [opts.textSkip] Text for "skip" button.
	 * @param [opts.htmlDescription] Description HTML for the modal.
	 * @param [opts.storageKey] Storage key to use when "remember" options are passed.
	 * @param [opts.isGlobal] If the stored setting is global when "remember" options are passed.
	 * @param [opts.fnRemember] Custom function to run when saving the "yes and remember" option.
	 * @param [opts.isSkippable] If the prompt is skippable.
	 * @param [opts.isAlert] If this prompt is just a notification/alert.
	 * @return {Promise} A promise which resolves to true/false if the user chose, or null otherwise.
	 */
	static async pGetUserBoolean (opts) {
		opts = opts || {};

		if (opts.storageKey) {
			const prev = await (opts.isGlobal ? StorageUtil.pGet(opts.storageKey) : StorageUtil.pGetForPage(opts.storageKey));
			if (prev != null) return prev;
		}

		const $btnTrueRemember = opts.textYesRemember ? $(`<button class="btn btn-primary ve-flex-v-center mr-2"><span class="glyphicon glyphicon-ok mr-2"></span><span>${opts.textYesRemember}</span></button>`)
			.click(() => {
				doClose(true, true);
				if (opts.fnRemember) {
					opts.fnRemember(true);
				} else {
					opts.isGlobal
						? StorageUtil.pSet(opts.storageKey, true)
						: StorageUtil.pSetForPage(opts.storageKey, true);
				}
			}) : null;

		const $btnTrue = $(`<button class="btn btn-primary ve-flex-v-center mr-3"><span class="glyphicon glyphicon-ok mr-2"></span><span>${opts.textYes || "OK"}</span></button>`)
			.click(evt => {
				evt.stopPropagation();
				doClose(true, true);
			});

		const $btnFalse = opts.isAlert ? null : $(`<button class="btn btn-default btn-sm ve-flex-v-center"><span class="glyphicon glyphicon-remove mr-2"></span><span>${opts.textNo || "Cancel"}</span></button>`)
			.click(evt => {
				evt.stopPropagation();
				doClose(true, false);
			});

		const $btnSkip = !opts.isSkippable ? null : $(`<button class="btn btn-default btn-sm ml-3"><span class="glyphicon glyphicon-forward"></span><span>${opts.textSkip || "Skip"}</span></button>`)
			.click(evt => {
				evt.stopPropagation();
				doClose(VeCt.SYM_UI_SKIP);
			});

		const {$modalInner, doClose, pGetResolved, doAutoResize: doAutoResizeModal} = await InputUiUtil._pGetShowModal({
			title: opts.title || "Choose",
			isMinHeight0: true,
		});

		if (opts.htmlDescription && opts.htmlDescription.trim()) $$`<div class="ve-flex w-100 mb-1">${opts.htmlDescription}</div>`.appendTo($modalInner);
		$$`<div class="ve-flex-v-center ve-flex-h-right py-1 px-1">${$btnTrueRemember}${$btnTrue}${$btnFalse}${$btnSkip}</div>`.appendTo($modalInner);

		if (doAutoResizeModal) doAutoResizeModal();

		$btnTrue.focus();
		$btnTrue.select();

		// region Output
		const [isDataEntered, out] = await pGetResolved();

		if (typeof isDataEntered === "symbol") return isDataEntered;

		if (!isDataEntered) return null;
		if (out == null) throw new Error(`Callback must receive a value!`); // sanity check
		return out;
		// endregion
	}

	/**
	 * @param opts Options.
	 * @param opts.values Array of values.
	 * @param [opts.placeholder] Placeholder text.
	 * @param [opts.title] Prompt title.
	 * @param [opts.default] Default selected index.
	 * @param [opts.fnDisplay] Function which takes a value and returns display text.
	 * @param [opts.isResolveItem] True if the promise should resolve the item instead of the index.
	 * @param [opts.$elePost] Element to add below the select box.
	 * @param [opts.fnGetExtraState] Function which returns additional state from, generally, other elements in the modal.
	 * @param [opts.isAllowNull] If an empty input should be treated as null.
	 * @param [opts.isSkippable] If the prompt is skippable.
	 * @return {Promise} A promise which resolves to the index of the item the user selected (or an object if fnGetExtraState is passed), or null otherwise.
	 */
	static async pGetUserEnum (opts) {
		opts = opts || {};

		const $selEnum = $(`<select class="form-control mb-2"><option value="-1" disabled>${opts.placeholder || "Select..."}</option></select>`)
			.keydown(async evt => {
				evt.stopPropagation();
				if (evt.key === "Enter") {
					evt.preventDefault();
					doClose(true);
				}
			});

		if (opts.isAllowNull) $(`<option value="-1"></option>`).text(opts.fnDisplay ? opts.fnDisplay(null, -1) : "(None)").appendTo($selEnum);

		opts.values.forEach((v, i) => $(`<option value="${i}"></option>`).text(opts.fnDisplay ? opts.fnDisplay(v, i) : v).appendTo($selEnum));
		if (opts.default != null) $selEnum.val(opts.default);
		else $selEnum[0].selectedIndex = 0;

		const {$modalInner, doClose, pGetResolved, doAutoResize: doAutoResizeModal} = await InputUiUtil._pGetShowModal({
			title: opts.title || "Select an Option",
			isMinHeight0: true,
		});

		const $btnOk = this._$getBtnOk({opts, doClose});
		const $btnCancel = this._$getBtnCancel({opts, doClose});
		const $btnSkip = this._$getBtnSkip({opts, doClose});

		$selEnum.appendTo($modalInner);
		if (opts.$elePost) opts.$elePost.appendTo($modalInner);
		$$`<div class="ve-flex-v-center ve-flex-h-right pb-1 px-1">${$btnOk}${$btnCancel}${$btnSkip}</div>`.appendTo($modalInner);

		if (doAutoResizeModal) doAutoResizeModal();

		$selEnum.focus();

		// region Output
		const [isDataEntered] = await pGetResolved();
		if (typeof isDataEntered === "symbol") return isDataEntered;

		if (!isDataEntered) return null;
		const ix = Number($selEnum.val());
		if (!~ix) return null;
		if (opts.fnGetExtraState) {
			const out = {extraState: opts.fnGetExtraState()};
			if (opts.isResolveItem) out.item = opts.values[ix];
			else out.ix = ix;
			return out;
		}

		return opts.isResolveItem ? opts.values[ix] : ix;
		// endregion
	}

	/**
	 * @param opts Options.
	 * @param [opts.values] Array of values. Mutually incompatible with "valueGroups".
	 * @param [opts.valueGroups] Array of value groups (of the form `{name: "Group Name", values: [...]}`). Mutually incompatible with "values".
	 * @param [opts.title] Prompt title.
	 * @param [opts.htmlDescription] Description HTML for the modal.
	 * @param [opts.count] Number of choices the user can make (cannot be used with min/max).
	 * @param [opts.min] Minimum number of choices the user can make (cannot be used with count).
	 * @param [opts.max] Maximum number of choices the user can make (cannot be used with count).
	 * @param [opts.defaults] Array of default-selected indices.
	 * @param [opts.required] Array of always-selected indices.
	 * @param [opts.isResolveItems] True if the promise should resolve to an array of the items instead of the indices.
	 * @param [opts.fnDisplay] Function which takes a value and returns display text.
	 * @param [opts.modalOpts] Options to pass through to the underlying modal class.
	 * @param [opts.isSkippable] If the prompt is skippable.
	 * @param [opts.isSearchable] If a search input should be created.
	 * @param [opts.fnGetSearchText] Function which takes a value and returns search text.
	 * @return {Promise} A promise which resolves to the indices of the items the user selected, or null otherwise.
	 */
	static async pGetUserMultipleChoice (opts) {
		const prop = "formData";

		const initialState = {};
		if (opts.defaults) opts.defaults.forEach(ix => initialState[ComponentUiUtil.getMetaWrpMultipleChoice_getPropIsActive(prop, ix)] = true);
		if (opts.required) {
			opts.required.forEach(ix => {
				initialState[ComponentUiUtil.getMetaWrpMultipleChoice_getPropIsActive(prop, ix)] = true; // "requires" implies "default"
				initialState[ComponentUiUtil.getMetaWrpMultipleChoice_getPropIsRequired(prop, ix)] = true;
			});
		}

		const comp = BaseComponent.fromObject(initialState);

		let title = opts.title;
		if (!title) {
			if (opts.count != null) title = `Choose ${Parser.numberToText(opts.count).uppercaseFirst()}`;
			else if (opts.min != null && opts.max != null) title = `Choose Between ${Parser.numberToText(opts.min).uppercaseFirst()} and ${Parser.numberToText(opts.max).uppercaseFirst()} Options`;
			else if (opts.min != null) title = `Choose At Least ${Parser.numberToText(opts.min).uppercaseFirst()}`;
			else title = `Choose At Most ${Parser.numberToText(opts.max).uppercaseFirst()}`;
		}

		const {$ele: $wrpList, $iptSearch, propIsAcceptable} = ComponentUiUtil.getMetaWrpMultipleChoice(comp, prop, opts);
		$wrpList.addClass(`mb-1`);

		const {$modalInner, doClose, pGetResolved, doAutoResize: doAutoResizeModal} = await InputUiUtil._pGetShowModal({
			...(opts.modalOpts || {}),
			title,
			isMinHeight0: true,
			isUncappedHeight: true,
		});

		const $btnOk = this._$getBtnOk({opts, doClose});
		const $btnCancel = this._$getBtnCancel({opts, doClose});
		const $btnSkip = this._$getBtnSkip({opts, doClose});

		const hkIsAcceptable = () => $btnOk.attr("disabled", !comp._state[propIsAcceptable]);
		comp._addHookBase(propIsAcceptable, hkIsAcceptable);
		hkIsAcceptable();

		if (opts.htmlDescription) $modalInner.append(opts.htmlDescription);
		if ($iptSearch) {
			$$`<label class="mb-1">
				${$iptSearch}
			</label>`.appendTo($modalInner);
		}
		$wrpList.appendTo($modalInner);
		$$`<div class="ve-flex-v-center ve-flex-h-right no-shrink pb-1 px-1">${$btnOk}${$btnCancel}${$btnSkip}</div>`.appendTo($modalInner);

		if (doAutoResizeModal) doAutoResizeModal();

		$wrpList.focus();

		// region Output
		const [isDataEntered] = await pGetResolved();

		if (typeof isDataEntered === "symbol") return isDataEntered;

		if (!isDataEntered) return null;

		const ixs = ComponentUiUtil.getMetaWrpMultipleChoice_getSelectedIxs(comp, prop);

		if (!opts.isResolveItems) return ixs;

		if (opts.values) return ixs.map(ix => opts.values[ix]);

		if (opts.valueGroups) {
			const allValues = opts.valueGroups.map(it => it.values).flat();
			return ixs.map(ix => allValues[ix]);
		}

		throw new Error(`Should never occur!`);
		// endregion
	}

	/**
	 * NOTE: designed to work with FontAwesome.
	 *
	 * @param opts Options.
	 * @param opts.values Array of icon metadata. Items should be of the form: `{name: "<n>", iconClass: "<c>", buttonClass: "<cs>", buttonClassActive: "<cs>"}`
	 * @param opts.title Prompt title.
	 * @param opts.default Default selected index.
	 * @param [opts.isSkippable] If the prompt is skippable.
	 * @return {Promise<number>} A promise which resolves to the index of the item the user selected, or null otherwise.
	 */
	static async pGetUserIcon (opts) {
		opts = opts || {};

		let lastIx = opts.default != null ? opts.default : -1;
		const onclicks = [];

		const {$modalInner, doClose, pGetResolved, doAutoResize: doAutoResizeModal} = await InputUiUtil._pGetShowModal({
			title: opts.title || "Select an Option",
			isMinHeight0: true,
		});

		$$`<div class="ve-flex ve-flex-wrap ve-flex-h-center mb-2">${opts.values.map((v, i) => {
			const $btn = $$`<div class="m-2 btn ${v.buttonClass || "btn-default"} ui__btn-xxl-square ve-flex-col ve-flex-h-center">
					${v.iconClass ? `<div class="ui-icn__wrp-icon ${v.iconClass} mb-1"></div>` : ""}
					${v.iconContent ? v.iconContent : ""}
					<div class="whitespace-normal w-100">${v.name}</div>
				</div>`
				.click(() => {
					lastIx = i;
					onclicks.forEach(it => it());
				})
				.toggleClass(v.buttonClassActive || "active", opts.default === i);
			if (v.buttonClassActive && opts.default === i) {
				$btn.removeClass("btn-default").addClass(v.buttonClassActive);
			}

			onclicks.push(() => {
				$btn.toggleClass(v.buttonClassActive || "active", lastIx === i);
				if (v.buttonClassActive) $btn.toggleClass("btn-default", lastIx !== i);
			});
			return $btn;
		})}</div>`.appendTo($modalInner);

		const $btnOk = this._$getBtnOk({opts, doClose});
		const $btnCancel = this._$getBtnCancel({opts, doClose});
		const $btnSkip = this._$getBtnSkip({opts, doClose});

		$$`<div class="ve-flex-v-center ve-flex-h-right pb-1 px-1">${$btnOk}${$btnCancel}${$btnSkip}</div>`.appendTo($modalInner);

		// region Output
		const [isDataEntered] = await pGetResolved();

		if (typeof isDataEntered === "symbol") return isDataEntered;
		if (!isDataEntered) return null;
		return ~lastIx ? lastIx : null;
		// endregion
	}

	/**
	 * @param [opts] Options.
	 * @param [opts.title] Prompt title.
	 * @param [opts.default] Default value.
	 * @param [opts.autocomplete] Array of autocomplete strings. REQUIRES INCLUSION OF THE TYPEAHEAD LIBRARY.
	 * @param [opts.isCode] If the text is code.
	 * @param [opts.isSkippable] If the prompt is skippable.
	 * @param [opts.fnIsValid] A function which checks if the current input is valid, and prevents the user from
	 *        submitting the value if it is.
	 * @param [opts.$elePre] Element to add before the input.
	 * @param [opts.$elePost] Element to add after the input.
	 * @param [opts.cbPostRender] Callback to call after rendering the modal
	 * @return {Promise<String>} A promise which resolves to the string if the user entered one, or null otherwise.
	 */
	static async pGetUserString (opts) {
		opts = opts || {};

		const propValue = "text";
		const comp = BaseComponent.fromObject({
			[propValue]: opts.default || "",
			isValid: true,
		});

		const $iptStr = ComponentUiUtil.$getIptStr(
			comp,
			propValue,
			{
				html: `<input class="form-control mb-2" type="text">`,
				autocomplete: opts.autocomplete,
			},
		)
			.keydown(async evt => {
				if (evt.key === "Escape") return; // Already handled

				if (opts.autocomplete) {
					// prevent double-binding the return key if we have autocomplete enabled
					await MiscUtil.pDelay(17); // arbitrary delay to allow dropdown to render (~1000/60, i.e. 1 60 FPS frame)
					if ($modalInner.find(`.typeahead.dropdown-menu`).is(":visible")) return;
				}

				evt.stopPropagation();
				if (evt.key === "Enter") {
					evt.preventDefault();
					doClose(true);
				}
			});
		if (opts.isCode) $iptStr.addClass("code");

		if (opts.fnIsValid) {
			const hkText = () => comp._state.isValid = !comp._state.text.trim() || !!opts.fnIsValid(comp._state.text);
			comp._addHookBase(propValue, hkText);
			hkText();

			const hkIsValid = () => $iptStr.toggleClass("form-control--error", !comp._state.isValid);
			comp._addHookBase("isValid", hkIsValid);
			hkIsValid();
		}

		const {$modalInner, doClose, pGetResolved, doAutoResize: doAutoResizeModal} = await InputUiUtil._pGetShowModal({
			title: opts.title || "Enter Text",
			isMinHeight0: true,
		});

		const $btnOk = this._$getBtnOk({comp, opts, doClose});
		const $btnCancel = this._$getBtnCancel({comp, opts, doClose});
		const $btnSkip = this._$getBtnSkip({comp, opts, doClose});

		if (opts.$elePre) opts.$elePre.appendTo($modalInner);
		$iptStr.appendTo($modalInner);
		if (opts.$elePost) opts.$elePost.appendTo($modalInner);
		$$`<div class="ve-flex-v-center ve-flex-h-right pb-1 px-1">${$btnOk}${$btnCancel}${$btnSkip}</div>`.appendTo($modalInner);

		if (doAutoResizeModal) doAutoResizeModal();

		$iptStr.focus();
		$iptStr.select();

		if (opts.cbPostRender) {
			opts.cbPostRender({
				comp,
				$iptStr,
				propValue,
			});
		}

		// region Output
		const [isDataEntered] = await pGetResolved();

		if (typeof isDataEntered === "symbol") return isDataEntered;
		if (!isDataEntered) return null;
		const raw = $iptStr.val();
		return raw;
		// endregion
	}

	/**
	 * @param [opts] Options.
	 * @param [opts.title] Prompt title.
	 * @param [opts.buttonText] Prompt title.
	 * @param [opts.default] Default value.
	 * @param [opts.disabled] If the text area is disabled.
	 * @param [opts.isCode] If the text is code.
	 * @param [opts.isSkippable] If the prompt is skippable.
	 * @return {Promise<String>} A promise which resolves to the string if the user entered one, or null otherwise.
	 */
	static async pGetUserText (opts) {
		opts = opts || {};

		const $iptStr = $(`<textarea class="form-control mb-2 resize-vertical w-100" ${opts.disabled ? "disabled" : ""}></textarea>`)
			.val(opts.default);
		if (opts.isCode) $iptStr.addClass("code");

		const {$modalInner, doClose, pGetResolved, doAutoResize: doAutoResizeModal} = await InputUiUtil._pGetShowModal({
			title: opts.title || "Enter Text",
			isMinHeight0: true,
		});

		const $btnOk = this._$getBtnOk({opts, doClose});
		const $btnCancel = this._$getBtnCancel({opts, doClose});
		const $btnSkip = this._$getBtnSkip({opts, doClose});

		$iptStr.appendTo($modalInner);
		$$`<div class="ve-flex-v-center ve-flex-h-right pb-1 px-1">${$btnOk}${$btnCancel}${$btnSkip}</div>`.appendTo($modalInner);

		if (doAutoResizeModal) doAutoResizeModal();

		$iptStr.focus();
		$iptStr.select();

		// region Output
		const [isDataEntered] = await pGetResolved();

		if (typeof isDataEntered === "symbol") return isDataEntered;
		if (!isDataEntered) return null;
		const raw = $iptStr.val();
		if (!raw.trim()) return null;
		else return raw;
		// endregion
	}

	/**
	 * @param opts Options.
	 * @param opts.title Prompt title.
	 * @param opts.default Default value.
	 * @param [opts.isSkippable] If the prompt is skippable.
	 * @return {Promise<String>} A promise which resolves to the color if the user entered one, or null otherwise.
	 */
	static async pGetUserColor (opts) {
		opts = opts || {};

		const $iptRgb = $(`<input class="form-control mb-2" ${opts.default != null ? `value="${opts.default}"` : ""} type="color">`);

		const {$modalInner, doClose, pGetResolved, doAutoResize: doAutoResizeModal} = await InputUiUtil._pGetShowModal({
			title: opts.title || "Choose Color",
			isMinHeight0: true,
		});

		const $btnOk = this._$getBtnOk({opts, doClose});
		const $btnCancel = this._$getBtnCancel({opts, doClose});
		const $btnSkip = this._$getBtnSkip({opts, doClose});

		$iptRgb.appendTo($modalInner);
		$$`<div class="ve-flex-v-center ve-flex-h-right pb-1 px-1">${$btnOk}${$btnCancel}${$btnSkip}</div>`.appendTo($modalInner);

		if (doAutoResizeModal) doAutoResizeModal();

		$iptRgb.focus();
		$iptRgb.select();

		// region Output
		const [isDataEntered] = await pGetResolved();

		if (typeof isDataEntered === "symbol") return isDataEntered;
		if (!isDataEntered) return null;
		const raw = $iptRgb.val();
		if (!raw.trim()) return null;
		else return raw;
		// endregion
	}

	/**
	 *
	 * @param [opts] Options object.
	 * @param [opts.title] Modal title.
	 * @param [opts.default] Default angle.
	 * @param [opts.stepButtons] Array of labels for quick-set buttons, which will be evenly spread around the clock.
	 * @param [opts.step] Number of steps in the gauge (default 360; would be e.g. 12 for a "clock").
	 * @param [opts.isSkippable] If the prompt is skippable.
	 * @returns {Promise<number>} A promise which resolves to the number of degrees if the user pressed "Enter," or null otherwise.
	 */
	static async pGetUserDirection (opts) {
		const X = 0;
		const Y = 1;
		const DEG_CIRCLE = 360;

		opts = opts || {};
		const step = Math.max(2, Math.min(DEG_CIRCLE, opts.step || DEG_CIRCLE));
		const stepDeg = DEG_CIRCLE / step;

		function getAngle (p1, p2) {
			return Math.atan2(p2[Y] - p1[Y], p2[X] - p1[X]) * 180 / Math.PI;
		}

		let active = false;
		let curAngle = Math.min(DEG_CIRCLE, opts.default) || 0;

		const $arm = $(`<div class="ui-dir__arm"></div>`);
		const handleAngle = () => $arm.css({transform: `rotate(${curAngle + 180}deg)`});
		handleAngle();

		const $pad = $$`<div class="ui-dir__face">${$arm}</div>`.on("mousedown touchstart", evt => {
			active = true;
			handleEvent(evt);
		});

		const $document = $(document);
		const evtId = `ui_user_dir_${CryptUtil.uid()}`;
		$document.on(`mousemove.${evtId} touchmove${evtId}`, evt => {
			handleEvent(evt);
		}).on(`mouseup.${evtId} touchend${evtId} touchcancel${evtId}`, evt => {
			evt.preventDefault();
			evt.stopPropagation();
			active = false;
		});
		const handleEvent = (evt) => {
			if (!active) return;

			const coords = [EventUtil.getClientX(evt), EventUtil.getClientY(evt)];

			const {top, left} = $pad.offset();
			const center = [left + ($pad.width() / 2), top + ($pad.height() / 2)];
			curAngle = getAngle(center, coords) + 90;
			if (step !== DEG_CIRCLE) curAngle = Math.round(curAngle / stepDeg) * stepDeg;
			else curAngle = Math.round(curAngle);
			handleAngle();
		};

		const BTN_STEP_SIZE = 26;
		const BORDER_PAD = 16;
		const CONTROLS_RADIUS = (92 + BTN_STEP_SIZE + BORDER_PAD) / 2;
		const $padOuter = opts.stepButtons ? (() => {
			const steps = opts.stepButtons;
			const SEG_ANGLE = 360 / steps.length;

			const $btns = [];

			for (let i = 0; i < steps.length; ++i) {
				const theta = (SEG_ANGLE * i * (Math.PI / 180)) - (1.5708); // offset by -90 degrees
				const x = CONTROLS_RADIUS * Math.cos(theta);
				const y = CONTROLS_RADIUS * Math.sin(theta);
				$btns.push(
					$(`<button class="btn btn-default btn-xxs absolute">${steps[i]}</button>`)
						.css({
							top: y + CONTROLS_RADIUS - (BTN_STEP_SIZE / 2),
							left: x + CONTROLS_RADIUS - (BTN_STEP_SIZE / 2),
							width: BTN_STEP_SIZE,
							height: BTN_STEP_SIZE,
							zIndex: 1002,
						})
						.click(() => {
							curAngle = SEG_ANGLE * i;
							handleAngle();
						}),
				);
			}

			const $wrpInner = $$`<div class="ve-flex-vh-center relative">${$btns}${$pad}</div>`
				.css({
					width: CONTROLS_RADIUS * 2,
					height: CONTROLS_RADIUS * 2,
				});

			return $$`<div class="ve-flex-vh-center">${$wrpInner}</div>`
				.css({
					width: (CONTROLS_RADIUS * 2) + BTN_STEP_SIZE + BORDER_PAD,
					height: (CONTROLS_RADIUS * 2) + BTN_STEP_SIZE + BORDER_PAD,
				});
		})() : null;

		const {$modalInner, doClose, pGetResolved, doAutoResize: doAutoResizeModal} = await InputUiUtil._pGetShowModal({
			title: opts.title || "Select Direction",
			isMinHeight0: true,
		});

		const $btnOk = this._$getBtnOk({opts, doClose});
		const $btnCancel = this._$getBtnCancel({opts, doClose});
		const $btnSkip = this._$getBtnSkip({opts, doClose});

		$$`<div class="ve-flex-vh-center mb-3">
				${$padOuter || $pad}
			</div>`.appendTo($modalInner);
		$$`<div class="ve-flex-v-center ve-flex-h-right pb-1 px-1">${$btnOk}${$btnCancel}${$btnSkip}</div>`.appendTo($modalInner);

		if (doAutoResizeModal) doAutoResizeModal();

		// region Output
		const [isDataEntered] = await pGetResolved();

		if (typeof isDataEntered === "symbol") return isDataEntered;
		$document.off(`mousemove.${evtId} touchmove${evtId} mouseup.${evtId} touchend${evtId} touchcancel${evtId}`);
		if (!isDataEntered) return null;
		if (curAngle < 0) curAngle += 360;
		return curAngle; // TODO returning the step number is more useful if step is specified?
		// endregion
	}

	/**
	 * @param [opts] Options.
	 * @param [opts.title] Prompt title.
	 * @param [opts.default] Default values. Should be an object of the form `{num, faces, bonus}`.
	 * @param [opts.isSkippable] If the prompt is skippable.
	 * @return {Promise<String>} A promise which resolves to a dice string if the user entered values, or null otherwise.
	 */
	static async pGetUserDice (opts) {
		opts = opts || {};

		const comp = BaseComponent.fromObject({
			num: (opts.default && opts.default.num) || 1,
			faces: (opts.default && opts.default.faces) || 6,
			bonus: (opts.default && opts.default.bonus) || null,
		});

		comp.render = function ($parent) {
			$parent.empty();

			const $iptNum = ComponentUiUtil.$getIptInt(this, "num", 0, {$ele: $(`<input class="form-control input-xs form-control--minimal text-center mr-1">`)})
				.appendTo($parent)
				.keydown(evt => {
					if (evt.key === "Escape") { $iptNum.blur(); return; }
					// return key
					if (evt.which === 13) doClose(true);
					evt.stopPropagation();
				});
			const $selFaces = ComponentUiUtil.$getSelEnum(this, "faces", {values: Renderer.dice.DICE})
				.addClass("mr-2").addClass("text-center").css("textAlignLast", "center");

			const $iptBonus = $(`<input class="form-control input-xs form-control--minimal text-center">`)
				.change(() => this._state.bonus = UiUtil.strToInt($iptBonus.val(), null, {fallbackOnNaN: null}))
				.keydown(evt => {
					if (evt.key === "Escape") { $iptBonus.blur(); return; }
					// return key
					if (evt.which === 13) doClose(true);
					evt.stopPropagation();
				});
			const hook = () => $iptBonus.val(this._state.bonus != null ? UiUtil.intToBonus(this._state.bonus) : this._state.bonus);
			comp._addHookBase("bonus", hook);
			hook();

			$$`<div class="ve-flex-vh-center">${$iptNum}<div class="mr-1">d</div>${$selFaces}${$iptBonus}</div>`.appendTo($parent);
		};

		comp.getAsString = function () {
			return `${this._state.num}d${this._state.faces}${this._state.bonus ? UiUtil.intToBonus(this._state.bonus) : ""}`;
		};

		const {$modalInner, doClose, pGetResolved, doAutoResize: doAutoResizeModal} = await InputUiUtil._pGetShowModal({
			title: opts.title || "Enter Dice",
			isMinHeight0: true,
		});

		const $btnOk = this._$getBtnOk({opts, doClose});
		const $btnCancel = this._$getBtnCancel({opts, doClose});
		const $btnSkip = this._$getBtnSkip({opts, doClose});

		comp.render($modalInner);

		$$`<div class="ve-flex-v-center ve-flex-h-right pb-1 px-1 mt-2">${$btnOk}${$btnCancel}${$btnSkip}</div>`.appendTo($modalInner);

		if (doAutoResizeModal) doAutoResizeModal();

		// region Output
		const [isDataEntered] = await pGetResolved();

		if (typeof isDataEntered === "symbol") return isDataEntered;
		if (!isDataEntered) return null;
		return comp.getAsString();
		// endregion
	}
}

class DragReorderUiUtil {
	/**
	 * Create a draggable pad capable of re-ordering rendered components. This requires to components to have:
	 *  - an `id` getter
	 *  - a `pos` getter and setter
	 *  - a `height` getter
	 *
	 * @param opts Options object.
	 * @param opts.$parent The parent element containing the rendered components.
	 * @param opts.componentsParent The object which has the array of components as a property.
	 * @param opts.componentsProp The property name of the components array.
	 * @param opts.componentId This component ID.
	 * @param [opts.marginSide] The margin side; "r" or "l" (defaults to "l").
	 */
	static $getDragPad (opts) {
		opts = opts || {};

		const getComponentById = (id) => opts.componentsParent[opts.componentsProp].find(it => it.id === id);

		const dragMeta = {};
		const doDragCleanup = () => {
			dragMeta.on = false;
			dragMeta.$wrap.remove();
			dragMeta.$dummies.forEach($d => $d.remove());
			$(document.body).off(`mouseup.drag__stop`);
		};

		const doDragRender = () => {
			if (dragMeta.on) doDragCleanup();

			$(document.body).on(`mouseup.drag__stop`, () => {
				if (dragMeta.on) doDragCleanup();
			});

			dragMeta.on = true;
			dragMeta.$wrap = $(`<div class="ve-flex-col ui-drag__wrp-drag-block"></div>`).appendTo(opts.$parent);
			dragMeta.$dummies = [];

			const ids = opts.componentsParent[opts.componentsProp].map(it => it.id);

			ids.forEach(id => {
				const $dummy = $(`<div class="w-100 ${id === opts.componentId ? "ui-drag__wrp-drag-dummy--highlight" : "ui-drag__wrp-drag-dummy--lowlight"}"></div>`)
					.height(getComponentById(id).height)
					.mouseup(() => {
						if (dragMeta.on) doDragCleanup();
					})
					.appendTo(dragMeta.$wrap);
				dragMeta.$dummies.push($dummy);

				if (id !== opts.componentId) { // on entering other areas, swap positions
					$dummy.mouseenter(() => {
						const cachedPos = getComponentById(id).pos;

						getComponentById(id).pos = getComponentById(opts.componentId).pos;
						getComponentById(opts.componentId).pos = cachedPos;

						doDragRender();
					});
				}
			});
		};

		return $(`<div class="m${opts.marginSide || "l"}-2 ui-drag__patch" title="Drag to Reorder">
		<div class="ui-drag__patch-col"><div>&#8729</div><div>&#8729</div><div>&#8729</div></div>
		<div class="ui-drag__patch-col"><div>&#8729</div><div>&#8729</div><div>&#8729</div></div>
		</div>`).mousedown(() => doDragRender());
	}

	/**
	 * @param $fnGetRow Function which returns a $row element. Is a function instead of a value so it can be lazy-loaded later.
	 * @param opts Options object.
	 * @param opts.$parent
	 * @param opts.swapRowPositions
	 * @param [opts.$children] An array of row elements.
	 * @param [opts.$getChildren] Should return an array as described in the "$children" option.
	 * @param [opts.fnOnDragComplete] A function to run when dragging is completed.
	 */
	static $getDragPadOpts ($fnGetRow, opts) {
		if (!opts.$parent || !opts.swapRowPositions || (!opts.$children && !opts.$getChildren)) throw new Error("Missing required option(s)!");

		const dragMeta = {};
		const doDragCleanup = () => {
			dragMeta.on = false;
			dragMeta.$wrap.remove();
			dragMeta.$dummies.forEach($d => $d.remove());
			$(document.body).off(`mouseup.drag__stop`);
			if (opts.fnOnDragComplete) opts.fnOnDragComplete();
		};

		const doDragRender = () => {
			if (dragMeta.on) doDragCleanup();

			$(document.body).on(`mouseup.drag__stop`, () => {
				if (dragMeta.on) doDragCleanup();
			});

			dragMeta.on = true;
			dragMeta.$wrap = $(`<div class="ve-flex-col ui-drag__wrp-drag-block"></div>`).appendTo(opts.$parent);
			dragMeta.$dummies = [];

			const $children = opts.$getChildren ? opts.$getChildren() : opts.$children;
			const ixRow = $children.indexOf($fnGetRow());

			$children.forEach(($child, i) => {
				const dimensions = {w: $child.outerWidth(true), h: $child.outerHeight(true)};
				const $dummy = $(`<div class="no-shrink ${i === ixRow ? "ui-drag__wrp-drag-dummy--highlight" : "ui-drag__wrp-drag-dummy--lowlight"}"></div>`)
					.width(dimensions.w).height(dimensions.h)
					.mouseup(() => {
						if (dragMeta.on) doDragCleanup();
					})
					.appendTo(dragMeta.$wrap);
				dragMeta.$dummies.push($dummy);

				if (i !== ixRow) { // on entering other areas, swap positions
					$dummy.mouseenter(() => {
						opts.swapRowPositions(i, ixRow);
						doDragRender();
					});
				}
			});
		};

		return $(`<div class="mr-2 ui-drag__patch" title="Drag to Reorder">
		<div class="ui-drag__patch-col"><div>&#8729</div><div>&#8729</div><div>&#8729</div></div>
		<div class="ui-drag__patch-col"><div>&#8729</div><div>&#8729</div><div>&#8729</div></div>
		</div>`).mousedown(() => doDragRender());
	}

	/**
	 * @param $fnGetRow Function which returns a $row element. Is a function instead of a value so it can be lazy-loaded later.
	 * @param $parent Parent elements to attach row elements to. Should have (e.g.) "relative" CSS positioning.
	 * @param parent Parent component which has a pod decomposable as {swapRowPositions, <$children|$getChildren>}.
	 * @return jQuery
	 */
	static $getDragPad2 ($fnGetRow, $parent, parent) {
		const {swapRowPositions, $children, $getChildren} = parent;
		const nxtOpts = {$parent, swapRowPositions, $children, $getChildren};
		return this.$getDragPadOpts($fnGetRow, nxtOpts);
	}
}

class SourceUiUtil {
	static _getValidOptions (options) {
		if (!options) throw new Error(`No options were specified!`);
		if (!options.$parent || !options.cbConfirm || !options.cbConfirmExisting || !options.cbCancel) throw new Error(`Missing options!`);
		options.mode = options.mode || "add";
		return options;
	}

	/**
	 * @param options Options object.
	 * @param options.$parent Parent element.
	 * @param options.cbConfirm Confirmation callback for inputting new sources.
	 * @param options.cbConfirmExisting Confirmation callback for selecting existing sources.
	 * @param options.cbCancel Cancellation callback.
	 * @param options.mode (Optional) Mode to build in, "select", "edit" or "add". Defaults to "select".
	 * @param options.source (Optional) Homebrew source object.
	 * @param options.isRequired (Optional) True if a source must be selected.
	 */
	static render (options) {
		options = SourceUiUtil._getValidOptions(options);
		options.$parent.empty();
		options.mode = options.mode || "select";

		const isEditMode = options.mode === "edit";

		let jsonDirty = false;
		const $iptName = $(`<input class="form-control ui-source__ipt-named">`)
			.keydown(evt => { if (evt.key === "Escape") $iptName.blur(); })
			.change(() => {
				if (!jsonDirty && !isEditMode) $iptJson.val($iptName.val().replace(/[^-_a-zA-Z]/g, ""));
				$iptName.removeClass("form-control--error");
			});
		if (options.source) $iptName.val(options.source.full);
		const $iptAbv = $(`<input class="form-control ui-source__ipt-named">`)
			.keydown(evt => { if (evt.key === "Escape") $iptAbv.blur(); })
			.change(() => {
				$iptAbv.removeClass("form-control--error");
			});
		if (options.source) $iptAbv.val(options.source.abbreviation);
		const $iptJson = $(`<input class="form-control ui-source__ipt-named" ${isEditMode ? "disabled" : ""}>`)
			.keydown(evt => { if (evt.key === "Escape") $iptJson.blur(); })
			.change(() => {
				jsonDirty = true;
				$iptJson.removeClass("form-control--error");
			});
		if (options.source) $iptJson.val(options.source.json);
		let hasColor = false;
		const $iptColor = $(`<input type="color" class="w-100 b-0">`)
			.keydown(evt => { if (evt.key === "Escape") $iptColor.blur(); })
			.change(() => hasColor = true);
		if (options.source?.color != null) (hasColor = true) && $iptColor.val(options.source.color);
		const $iptUrl = $(`<input class="form-control ui-source__ipt-named">`)
			.keydown(evt => { if (evt.key === "Escape") $iptUrl.blur(); });
		if (options.source) $iptUrl.val(options.source.url);
		const $iptAuthors = $(`<input class="form-control ui-source__ipt-named">`)
			.keydown(evt => { if (evt.key === "Escape") $iptAuthors.blur(); });
		if (options.source) $iptAuthors.val((options.source.authors || []).join(", "));
		const $iptConverters = $(`<input class="form-control ui-source__ipt-named">`)
			.keydown(evt => { if (evt.key === "Escape") $iptConverters.blur(); });
		if (options.source) $iptConverters.val((options.source.convertedBy || []).join(", "));

		const $btnOk = $(`<button class="btn btn-primary">OK</button>`)
			.click(async () => {
				let incomplete = false;
				[$iptName, $iptAbv, $iptJson].forEach($ipt => {
					const val = $ipt.val();
					if (!val || !val.trim()) (incomplete = true) && $ipt.addClass("form-control--error");
				});
				if (incomplete) return;

				const jsonVal = $iptJson.val().trim();
				if (!isEditMode && BrewUtil2.hasSourceJson(jsonVal)) {
					$iptJson.addClass("form-control--error");
					JqueryUtil.doToast({content: `The JSON identifier "${jsonVal}" already exists!`, type: "danger"});
					return;
				}

				const source = {
					json: jsonVal,
					abbreviation: $iptAbv.val().trim(),
					full: $iptName.val().trim(),
					url: $iptUrl.val().trim(),
					authors: $iptAuthors.val().trim().split(",").map(it => it.trim()).filter(Boolean),
					convertedBy: $iptConverters.val().trim().split(",").map(it => it.trim()).filter(Boolean),
				};
				if (hasColor) source.color = $iptColor.val().trim();

				await options.cbConfirm(source, options.mode !== "edit");
			});

		const $btnCancel = options.isRequired && !isEditMode
			? null
			: $(`<button class="btn btn-default ml-2">Cancel</button>`).click(() => options.cbCancel());

		const $btnUseExisting = $(`<button class="btn btn-default">Use an Existing Source</button>`)
			.click(() => {
				$stageInitial.hideVe();
				$stageExisting.showVe();

				// cleanup
				[$iptName, $iptAbv, $iptJson].forEach($ipt => $ipt.removeClass("form-control--error"));
			});

		const $stageInitial = $$`<div class="h-100 w-100 ve-flex-vh-center"><div class="ve-flex-col">
			<h3 class="text-center">${isEditMode ? "Edit Homebrew Source" : "Add a Homebrew Source"}</h3>
			<div class="ui-source__row mb-2"><div class="col-12 ve-flex-v-center">
				<span class="mr-2 ui-source__name help" title="The name or title for the homebrew you wish to create. This could be the name of a book or PDF; for example, 'Monster Manual'">Title</span>
				${$iptName}
			</div></div>
			<div class="ui-source__row mb-2"><div class="col-12 ve-flex-v-center">
				<span class="mr-2 ui-source__name help" title="An abbreviated form of the title. This will be shown in lists on the site, and in the top-right corner of stat blocks or data entries; for example, 'MM'">Abbreviation</span>
				${$iptAbv}
			</div></div>
			<div class="ui-source__row mb-2"><div class="col-12 ve-flex-v-center">
				<span class="mr-2 ui-source__name help" title="This will be used to identify your homebrew universally, so should be unique to you and you alone">JSON Identifier</span>
				${$iptJson}
			</div></div>
			<div class="ui-source__row mb-2"><div class="col-12 ve-flex-v-center">
				<span class="mr-2 ui-source__name help" title="A color which should be used when displaying the source abbreviation">Color</span>
				${$iptColor}
			</div></div>
			<div class="ui-source__row mb-2"><div class="col-12 ve-flex-v-center">
				<span class="mr-2 ui-source__name help" title="A link to the original homebrew, e.g. a GM Binder page">Source URL</span>
				${$iptUrl}
			</div></div>
			<div class="ui-source__row mb-2"><div class="col-12 ve-flex-v-center">
				<span class="mr-2 ui-source__name help" title="A comma-separated list of authors, e.g. 'John Doe, Joe Bloggs'">Author(s)</span>
				${$iptAuthors}
			</div></div>
			<div class="ui-source__row mb-2"><div class="col-12 ve-flex-v-center">
				<span class="mr-2 ui-source__name help" title="A comma-separated list of people who converted the homebrew to 5etools' format, e.g. 'John Doe, Joe Bloggs'">Converted By</span>
				${$iptConverters}
			</div></div>
			<div class="text-center mb-2">${$btnOk}${$btnCancel}</div>

			${!isEditMode && BrewUtil2.getMetaLookup("sources")?.length ? $$`<div class="ve-flex-vh-center mb-3 mt-3"><span class="ui-source__divider"></span>or<span class="ui-source__divider"></span></div>
			<div class="ve-flex-vh-center">${$btnUseExisting}</div>` : ""}
		</div></div>`.appendTo(options.$parent);

		const $selExisting = $$`<select class="form-control input-sm">
			<option disabled>Select</option>
			${(BrewUtil2.getMetaLookup("sources") || []).sort((a, b) => SortUtil.ascSortLower(a.full, b.full)).map(s => `<option value="${s.json.escapeQuotes()}">${s.full.escapeQuotes()}</option>`)}
		</select>`.change(() => $selExisting.removeClass("form-control--error"));
		$selExisting[0].selectedIndex = 0;

		const $btnConfirmExisting = $(`<button class="btn btn-default btn-sm">Confirm</button>`)
			.click(async () => {
				if ($selExisting[0].selectedIndex === 0) {
					$selExisting.addClass("form-control--error");
					return;
				}

				const sourceJson = $selExisting.val();
				const source = BrewUtil2.sourceJsonToSource(sourceJson);
				await options.cbConfirmExisting(source);

				// cleanup
				$selExisting[0].selectedIndex = 0;
				$stageExisting.hideVe();
				$stageInitial.showVe();
			});

		const $btnBackExisting = $(`<button class="btn btn-default btn-sm mr-2">Back</button>`)
			.click(() => {
				$selExisting[0].selectedIndex = 0;
				$stageExisting.hideVe();
				$stageInitial.showVe();
			});

		const $stageExisting = $$`<div class="h-100 w-100 ve-flex-vh-center ve-hidden"><div>
			<h3 class="text-center">Select a Homebrew Source</h3>
			<div class="mb-2"><div class="col-12 ve-flex-vh-center">${$selExisting}</div></div>
			<div class="col-12 ve-flex-vh-center">${$btnBackExisting}${$btnConfirmExisting}</div>
		</div></div>`.appendTo(options.$parent);
	}
}

function MixinBaseComponent (Cls) {
	class MixedBaseComponent extends Cls {
		constructor (...args) {
			super(...args);

			this.__locks = {};
			this.__rendered = {};

			// state
			this.__state = {...this._getDefaultState()};
			this._state = this._getProxy("state", this.__state);
		}

		_addHookBase (prop, hook) {
			return this._addHook("state", prop, hook);
		}

		_removeHookBase (prop, hook) {
			return this._removeHook("state", prop, hook);
		}

		_removeHooksBase (prop) {
			return this._removeHooks("state", prop);
		}

		_addHookAllBase (hook) {
			return this._addHookAll("state", hook);
		}

		_removeHookAllBase (hook) {
			return this._removeHookAll("state", hook);
		}

		_setState (toState) {
			this._proxyAssign("state", "_state", "__state", toState, true);
		}

		_setStateValue (prop, value, {isForceTriggerHooks = true} = {}) {
			if (this._state[prop] === value && !isForceTriggerHooks) return value;
			// If the value is new, hooks will be run automatically
			if (this._state[prop] !== value) return this._state[prop] = value;

			this._doFireHooksAll("state", prop, value, value);
			this._doFireHooks("state", prop, value, value);
			return value;
		}

		_getState () { return MiscUtil.copyFast(this.__state); }

		getPod () {
			this.__pod = this.__pod || {
				get: (prop) => this._state[prop],
				set: (prop, val) => this._state[prop] = val,
				delete: (prop) => delete this._state[prop],
				addHook: (prop, hook) => this._addHookBase(prop, hook),
				addHookAll: (hook) => this._addHookAllBase(hook),
				removeHook: (prop, hook) => this._removeHookBase(prop, hook),
				removeHookAll: (hook) => this._removeHookAllBase(hook),
				triggerCollectionUpdate: (prop) => this._triggerCollectionUpdate(prop),
				setState: (state) => this._setState(state),
				getState: () => this._getState(),
				assign: (toObj, isOverwrite) => this._proxyAssign("state", "_state", "__state", toObj, isOverwrite),
				pLock: lockName => this._pLock(lockName),
				unlock: lockName => this._unlock(lockName),
				component: this,
			};
			return this.__pod;
		}

		// to be overridden as required
		_getDefaultState () { return {}; }

		getBaseSaveableState () {
			return {
				state: MiscUtil.copyFast(this.__state),
			};
		}

		setBaseSaveableStateFrom (toLoad, isOverwrite = false) {
			toLoad?.state && this._proxyAssignSimple("state", toLoad.state, isOverwrite);
		}

		/**
		 * @param opts Options object.
		 * @param opts.prop The state property.
		 * @param [opts.namespace] The render namespace.
		 */
		_getRenderedCollection (opts) {
			opts = opts || {};
			const renderedLookupProp = opts.namespace ? `${opts.namespace}.${opts.prop}` : opts.prop;
			return (this.__rendered[renderedLookupProp] = this.__rendered[renderedLookupProp] || {});
		}

		/**
		 * Asynchronous version available below.
		 * @param opts Options object.
		 * @param opts.prop The state property.
		 * @param [opts.fnDeleteExisting] Function to run on deleted render meta. Arguments are `rendered, item`.
		 * @param [opts.fnReorderExisting] Function to run on all meta, as a final step. Useful for re-ordering elements.
		 * @param opts.fnUpdateExisting Function to run on existing render meta. Arguments are `rendered, item`.
		 * @param opts.fnGetNew Function to run which generates existing render meta. Arguments are `item`.
		 * @param [opts.isDiffMode] If a diff of the state should be taken/checked before updating renders.
		 * @param [opts.namespace] A namespace to store these renders under. Useful if multiple renders are being made from
		 *        the same collection.
		 */
		_renderCollection (opts) {
			opts = opts || {};

			const rendered = this._getRenderedCollection(opts);
			const toDelete = new Set(Object.keys(rendered));

			(this._state[opts.prop] || []).forEach((it, i) => {
				if (it.id == null) throw new Error(`Collection item did not have an ID!`);
				const meta = rendered[it.id];

				toDelete.delete(it.id);
				if (meta) {
					if (opts.isDiffMode) {
						// Hashing the stringified JSON relies on the property order remaining consistent, but this is fine
						const nxtHash = CryptUtil.md5(JSON.stringify(it));
						if (nxtHash !== meta.__hash) {
							meta.__hash = nxtHash;
						} else return;
					}

					meta.data = it; // update any existing pointers
					opts.fnUpdateExisting(meta, it, i);
				} else {
					const meta = opts.fnGetNew(it, i);

					// If the "get new" function returns null, skip rendering this entity
					if (meta == null) return;

					meta.data = it;
					if (!meta.$wrpRow && !meta.fmRemoveEles) throw new Error(`A "$wrpRow" or a "fmRemoveEles" property is required for deletes!`);

					if (opts.isDiffMode) meta.hash = CryptUtil.md5(JSON.stringify(it));

					rendered[it.id] = meta;
				}
			});

			toDelete.forEach(id => {
				const meta = rendered[id];
				if (meta.$wrpRow) meta.$wrpRow.remove();
				if (meta.fmRemoveEles) meta.fmRemoveEles();
				delete rendered[id];
				if (opts.fnDeleteExisting) opts.fnDeleteExisting(meta);
			});

			if (opts.fnReorderExisting) {
				(this._state[opts.prop] || []).forEach((it, i) => {
					const meta = rendered[it.id];
					opts.fnReorderExisting(meta, it, i);
				});
			}
		}

		/**
		 * Synchronous version available above.
		 * @param [opts] Options object.
		 * @param opts.prop The state property.
		 * @param [opts.pFnDeleteExisting] Function to run on deleted render meta. Arguments are `rendered, item`.
		 * @param opts.pFnUpdateExisting Function to run on existing render meta. Arguments are `rendered, item`.
		 * @param opts.pFnGetNew Function to run which generates existing render meta. Arguments are `item`.
		 * @param [opts.isDiffMode] If updates should be run in "diff" mode (i.e. no update is run if nothing has changed).
		 * @param [opts.isMultiRender] If multiple renders will be produced.
		 * @param [opts.additionalCaches] Additional cache objects to be cleared on entity delete. Should be objects with
		 *        entity IDs as keys.
		 * @param [opts.namespace] A namespace to store these renders under. Useful if multiple renders are being made from
		 *        the same collection.
		 */
		async _pRenderCollection (opts) {
			opts = opts || {};

			const rendered = this._getRenderedCollection(opts);
			const entities = this._state[opts.prop];
			return this._pRenderCollection_doRender(rendered, entities, opts);
		}

		async _pRenderCollection_doRender (rendered, entities, opts) {
			opts = opts || {};

			const toDelete = new Set(Object.keys(rendered));

			// Run the external functions in serial, to prevent element re-ordering
			for (let i = 0; i < entities.length; ++i) {
				const it = entities[i];

				if (!it.id) throw new Error(`Collection item did not have an ID!`);
				// N.B.: Meta can be an array, if one item maps to multiple renders (e.g. the same is shown in two places)
				const meta = rendered[it.id];

				toDelete.delete(it.id);
				if (meta) {
					if (opts.isDiffMode) {
						// Hashing the stringified JSON relies on the property order remaining consistent, but this is fine
						const nxtHash = CryptUtil.md5(JSON.stringify(it));
						if (nxtHash !== meta.__hash) meta.__hash = nxtHash;
						else continue;
					}

					const nxtMeta = await opts.pFnUpdateExisting(meta, it);
					// Overwrite the existing renders in multi-render mode
					//    Otherwise, just ignore the result--single renders never modify their render
					if (opts.isMultiRender) rendered[it.id] = nxtMeta;
				} else {
					const meta = await opts.pFnGetNew(it);
					// If the generator decides there's nothing to render, skip this item
					if (meta == null) continue;

					if (opts.isMultiRender && meta.some(it => !it.$wrpRow && !it.fmRemoveEles)) throw new Error(`A "$wrpRow" or a "fmRemoveEles" property is required for deletes!`);
					if (!opts.isMultiRender && !meta.$wrpRow && !meta.fmRemoveEles) throw new Error(`A "$wrpRow" or a "fmRemoveEles" property is required for deletes!`);

					if (opts.isDiffMode) meta.__hash = CryptUtil.md5(JSON.stringify(it));

					rendered[it.id] = meta;
				}
			}

			const doRemoveELements = meta => {
				if (meta.$wrpRow) meta.$wrpRow.remove();
				if (meta.fmRemoveEles) meta.fmRemoveEles();
			};

			for (const id of toDelete) {
				const meta = rendered[id];
				if (opts.isMultiRender) meta.forEach(it => doRemoveELements(it));
				else doRemoveELements(meta);
				if (opts.additionalCaches) opts.additionalCaches.forEach(it => delete it[id]);
				delete rendered[id];
				if (opts.pFnDeleteExisting) await opts.pFnDeleteExisting(meta);
			}
		}

		/**
		 * Detach (and thus preserve) rendered collection elements so they can be re-used later.
		 * @param prop The state property.
		 * @param [namespace] A namespace to store these renders under. Useful if multiple renders are being made from
		 *        the same collection.
		 */
		_detachCollection (prop, namespace = null) {
			const renderedLookupProp = namespace ? `${namespace}.${prop}` : prop;
			const rendered = (this.__rendered[renderedLookupProp] = this.__rendered[renderedLookupProp] || {});
			Object.values(rendered).forEach(it => it.$wrpRow.detach());
		}

		/**
		 * Wipe any rendered collection elements, and reset the render cache.
		 * @param prop The state property.
		 * @param [namespace] A namespace to store these renders under. Useful if multiple renders are being made from
		 *        the same collection.
		 */
		_resetCollectionRenders (prop, namespace = null) {
			const renderedLookupProp = namespace ? `${namespace}.${prop}` : prop;
			const rendered = (this.__rendered[renderedLookupProp] = this.__rendered[renderedLookupProp] || {});
			Object.values(rendered).forEach(it => it.$wrpRow.remove());
			delete this.__rendered[renderedLookupProp];
		}

		render () { throw new Error("Unimplemented!"); }

		// to be overridden as required
		getSaveableState () { return {...this.getBaseSaveableState()}; }
		setStateFrom (toLoad, isOverwrite = false) { this.setBaseSaveableStateFrom(toLoad, isOverwrite); }

		async _pLock (lockName) {
			while (this.__locks[lockName]) await this.__locks[lockName].lock;
			let unlock = null;
			const lock = new Promise(resolve => unlock = resolve);
			this.__locks[lockName] = {
				lock,
				unlock,
			};
		}

		async _pGate (lockName) {
			while (this.__locks[lockName]) await this.__locks[lockName].lock;
		}

		_unlock (lockName) {
			const lockMeta = this.__locks[lockName];
			if (lockMeta) {
				delete this.__locks[lockName];
				lockMeta.unlock();
			}
		}

		async _pDoProxySetBase (prop, value) { return this._pDoProxySet("state", this.__state, prop, value); }

		_triggerCollectionUpdate (prop) {
			if (!this._state[prop]) return;
			this._state[prop] = [...this._state[prop]];
		}

		static _toCollection (array) {
			if (array) return array.map(it => ({id: CryptUtil.uid(), entity: it}));
		}

		static _fromCollection (array) {
			if (array) return array.map(it => it.entity);
		}

		static fromObject (obj, ...noModCollections) {
			const comp = new this();
			Object.entries(MiscUtil.copyFast(obj)).forEach(([k, v]) => {
				if (v == null) comp.__state[k] = v;
				else if (noModCollections.includes(k) || noModCollections.includes("*")) comp.__state[k] = v;
				else if (typeof v === "object" && v instanceof Array) comp.__state[k] = BaseComponent._toCollection(v);
				else comp.__state[k] = v;
			});
			return comp;
		}

		static fromObjectNoMod (obj) { return this.fromObject(obj, "*"); }

		toObject (...noModCollections) {
			const cpy = MiscUtil.copyFast(this.__state);
			Object.entries(cpy).forEach(([k, v]) => {
				if (v == null) return;

				if (noModCollections.includes(k) || noModCollections.includes("*")) cpy[k] = v;
				else if (v instanceof Array && v.every(it => it && it.id)) cpy[k] = BaseComponent._fromCollection(v);
			});
			return cpy;
		}

		toObjectNoMod () { return this.toObject("*"); }
	}

	return MixedBaseComponent;
}

class BaseComponent extends MixinBaseComponent(ProxyBase) {}

globalThis.BaseComponent = BaseComponent;

class RenderableCollectionBase {
	/**
	 * @param comp
	 * @param prop
	 * @param [opts]
	 * @param [opts.namespace]
	 * @param [opts.isDiffMode]
	 */
	constructor (comp, prop, opts) {
		opts = opts || {};
		this._comp = comp;
		this._prop = prop;
		this._namespace = opts.namespace;
		this._isDiffMode = opts.isDiffMode;
	}

	getNewRender (entity, i) {
		throw new Error(`Unimplemented!`);
	}

	doUpdateExistingRender (renderedMeta, entity, i) {
		throw new Error(`Unimplemented!`);
	}

	doDeleteExistingRender (renderedMeta) {
		// No-op
	}

	doReorderExistingComponent (renderedMeta, entity, i) {
		// No-op
	}

	_getCollectionItem (id) {
		return this._comp._state[this._prop].find(it => it.id === id);
	}

	/**
	 * @param [opts] Temporary override options.
	 * @param [opts.isDiffMode]
	 */
	render (opts) {
		opts = opts || {};
		this._comp._renderCollection({
			prop: this._prop,
			fnUpdateExisting: (rendered, ent, i) => this.doUpdateExistingRender(rendered, ent, i),
			fnGetNew: (entity, i) => this.getNewRender(entity, i),
			fnDeleteExisting: (rendered) => this.doDeleteExistingRender(rendered),
			fnReorderExisting: (rendered, ent, i) => this.doReorderExistingComponent(rendered, ent, i),
			namespace: this._namespace,
			isDiffMode: opts.isDiffMode != null ? opts.isDiffMode : this._isDiffMode,
		});
	}
}

class RenderableCollectionAsyncBase {
	/**
	 * @param comp
	 * @param prop
	 * @param [opts]
	 * @param [opts.namespace]
	 * @param [opts.isDiffMode]
	 * @param [opts.isMultiRender]
	 * @param [opts.additionalCaches]
	 */
	constructor (comp, prop, opts) {
		opts = opts || {};
		this._comp = comp;
		this._prop = prop;
		this._namespace = opts.namespace;
		this._isDiffMode = opts.isDiffMode;
		this._isMultiRender = opts.isMultiRender;
		this._additionalCaches = opts.additionalCaches;
	}

	pGetNewRender (entity, i) {
		throw new Error(`Unimplemented!`);
	}

	pDoUpdateExistingRender (renderedMeta, entity, i) {
		throw new Error(`Unimplemented!`);
	}

	/**
	 * @param [opts] Temporary override options.
	 * @param [opts.isDiffMode]
	 */
	render (opts) {
		opts = opts || {};
		this._comp._pRenderCollection({
			prop: this._prop,
			fnUpdateExisting: (rendered, source, i) => this.pDoUpdateExistingRender(rendered, source, i),
			fnGetNew: (entity, i) => this.pGetNewRender(entity, i),
			namespace: this._namespace,
			isDiffMode: opts.isDiffMode != null ? opts.isDiffMode : this._isDiffMode,
			isMultiRender: this._isMultiRender,
			additionalCaches: this._additionalCaches,
		});
	}
}

class BaseLayeredComponent extends BaseComponent {
	constructor () {
		super();

		// layers
		this._layers = [];
		this.__layerMeta = {};
		this._layerMeta = this._getProxy("layerMeta", this.__layerMeta);
	}

	_addHookDeep (prop, hook) {
		this._addHookBase(prop, hook);
		this._addHook("layerMeta", prop, hook);
	}

	_removeHookDeep (prop, hook) {
		this._removeHookBase(prop, hook);
		this._removeHook("layerMeta", prop, hook);
	}

	_getBase (prop) {
		return this._state[prop];
	}

	_get (prop) {
		if (this._layerMeta[prop]) {
			for (let i = this._layers.length - 1; i >= 0; --i) {
				const val = this._layers[i].data[prop];
				if (val != null) return val;
			}
			// this should never fall through, but if it does, returning the base value is fine
		}
		return this._state[prop];
	}

	_addLayer (layer) {
		this._layers.push(layer);
		this._addLayer_addLayerMeta(layer);
	}

	_addLayer_addLayerMeta (layer) {
		Object.entries(layer.data).forEach(([k, v]) => this._layerMeta[k] = v != null);
	}

	_removeLayer (layer) {
		const ix = this._layers.indexOf(layer);
		if (~ix) {
			this._layers.splice(ix, 1);

			// regenerate layer meta
			Object.keys(this._layerMeta).forEach(k => delete this._layerMeta[k]);
			this._layers.forEach(l => this._addLayer_addLayerMeta(l));
		}
	}

	updateLayersActive (prop) {
		// this uses the fact that updating a proxy value to the same value still triggers hooks
		//   anything listening to changes in this flag will be forced to recalculate from base + all layers
		this._layerMeta[prop] = this._layers.some(l => l.data[prop] != null);
	}

	getBaseSaveableState () {
		return {
			state: MiscUtil.copyFast(this.__state),
			layers: MiscUtil.copyFast(this._layers.map(l => l.getSaveableState())),
		};
	}

	setBaseSaveableStateFrom (toLoad) {
		toLoad.state && Object.assign(this._state, toLoad.state);
		if (toLoad.layers) toLoad.layers.forEach(l => this._addLayer(CompLayer.fromSavedState(this, l)));
	}

	getPod () {
		this.__pod = this.__pod || {
			...super.getPod(),

			addHookDeep: (prop, hook) => this._addHookDeep(prop, hook),
			removeHookDeep: (prop, hook) => this._removeHookDeep(prop, hook),
			addHookAll: (hook) => this._addHookAll("state", hook),
			getBase: (prop) => this._getBase(prop),
			get: (prop) => this._get(prop),
			addLayer: (name, data) => {
				// FIXME
				const l = new CompLayer(this, name, data);
				this._addLayer(l);
				return l;
			},
			removeLayer: (layer) => this._removeLayer(layer),
			layers: this._layers, // FIXME avoid passing this directly to the child
		};
		return this.__pod;
	}
}

/**
 * A "layer" of state which is applied over the base state.
 *  This allows e.g. a temporary stat reduction to modify a statblock, without actually
 *  modifying the underlying component.
 */
class CompLayer extends ProxyBase {
	constructor (component, layerName, data) {
		super();

		this._name = layerName;
		this.__data = data;

		this.data = this._getProxy("data", this.__data);

		this._addHookAll("data", prop => component.updateLayersActive(prop));
	}

	getSaveableState () {
		return {
			name: this._name,
			data: MiscUtil.copyFast(this.__data),
		};
	}

	static fromSavedState (component, savedState) { return new CompLayer(component, savedState.name, savedState.data); }
}

function MixinComponentHistory (Cls) {
	class MixedComponentHistory extends Cls {
		constructor () {
			super(...arguments);
			this._histStackUndo = [];
			this._histStackRedo = [];
			this._isHistDisabled = true;
			this._histPropBlocklist = new Set();
			this._histPropAllowlist = null;

			this._histInitialState = null;
		}

		set isHistDisabled (val) { this._isHistDisabled = val; }
		addBlocklistProps (...props) { props.forEach(p => this._histPropBlocklist.add(p)); }
		addAllowlistProps (...props) {
			this._histPropAllowlist = this._histPropAllowlist || new Set();
			props.forEach(p => this._histPropAllowlist.add(p));
		}

		/**
		 * This should be initialised after all other hooks have been added
		 */
		initHistory () {
			// Track the initial state, and watch for further modifications
			this._histInitialState = MiscUtil.copyFast(this._state);
			this._isHistDisabled = false;

			this._addHookAll("state", prop => {
				if (this._isHistDisabled) return;
				if (this._histPropBlocklist.has(prop)) return;
				if (this._histPropAllowlist && !this._histPropAllowlist.has(prop)) return;

				this.recordHistory();
			});
		}

		recordHistory () {
			const stateCopy = MiscUtil.copyFast(this._state);

			// remove any un-tracked properties
			this._histPropBlocklist.forEach(prop => delete stateCopy[prop]);
			if (this._histPropAllowlist) Object.keys(stateCopy).filter(k => !this._histPropAllowlist.has(k)).forEach(k => delete stateCopy[k]);

			this._histStackUndo.push(stateCopy);
			this._histStackRedo = [];
		}

		_histAddExcludedProperties (stateCopy) {
			Object.entries(this._state).forEach(([k, v]) => {
				if (this._histPropBlocklist.has(k)) return stateCopy[k] = v;
				if (this._histPropAllowlist && !this._histPropAllowlist.has(k)) stateCopy[k] = v;
			});
		}

		undo () {
			if (this._histStackUndo.length) {
				const lastHistDisabled = this._isHistDisabled;
				this._isHistDisabled = true;

				const curState = this._histStackUndo.pop();
				this._histStackRedo.push(curState);
				const toApply = MiscUtil.copyFast(this._histStackUndo.last() || this._histInitialState);
				this._histAddExcludedProperties(toApply);
				this._setState(toApply);

				this._isHistDisabled = lastHistDisabled;
			} else {
				const lastHistDisabled = this._isHistDisabled;
				this._isHistDisabled = true;

				const toApply = MiscUtil.copyFast(this._histInitialState);
				this._histAddExcludedProperties(toApply);
				this._setState(toApply);

				this._isHistDisabled = lastHistDisabled;
			}
		}

		redo () {
			if (!this._histStackRedo.length) return;

			const lastHistDisabled = this._isHistDisabled;
			this._isHistDisabled = true;

			const toApplyRaw = this._histStackRedo.pop();
			this._histStackUndo.push(toApplyRaw);
			const toApply = MiscUtil.copyFast(toApplyRaw);
			this._histAddExcludedProperties(toApply);
			this._setState(toApply);

			this._isHistDisabled = lastHistDisabled;
		}
	}
	return MixedComponentHistory;
}

// region Globally-linked state components
function MixinComponentGlobalState (Cls) {
	class MixedComponentGlobalState extends Cls {
		constructor (...args) {
			super(...args);

			// Point our proxy at the singleton `__stateGlobal` object
			this._stateGlobal = this._getProxy("stateGlobal", MixinComponentGlobalState._Singleton.__stateGlobal);

			// Load the singleton's state, then fire all our hooks once it's ready
			MixinComponentGlobalState._Singleton._pLoadState()
				.then(() => {
					this._doFireHooksAll("stateGlobal");
					this._doFireAllHooks("stateGlobal");
					this._addHookAll("stateGlobal", MixinComponentGlobalState._Singleton._pSaveStateDebounced);
				});
		}

		get __stateGlobal () { return MixinComponentGlobalState._Singleton.__stateGlobal; }

		_addHookGlobal (prop, hook) {
			return this._addHook("stateGlobal", prop, hook);
		}
	}
	return MixedComponentGlobalState;
}

MixinComponentGlobalState._Singleton = class {
	static async _pSaveState () {
		return StorageUtil.pSet(VeCt.STORAGE_GLOBAL_COMPONENT_STATE, MiscUtil.copyFast(MixinComponentGlobalState._Singleton.__stateGlobal));
	}

	static async _pLoadState () {
		if (MixinComponentGlobalState._Singleton._pLoadingState) return MixinComponentGlobalState._Singleton._pLoadingState;
		return MixinComponentGlobalState._Singleton._pLoadingState = MixinComponentGlobalState._Singleton._pLoadState_();
	}

	static async _pLoadState_ () {
		Object.assign(MixinComponentGlobalState._Singleton.__stateGlobal, (await StorageUtil.pGet(VeCt.STORAGE_GLOBAL_COMPONENT_STATE)) || {});
	}

	static _getDefaultStateGlobal () {
		return {
			isUseSpellPoints: false,
		};
	}
};
MixinComponentGlobalState._Singleton.__stateGlobal = {...MixinComponentGlobalState._Singleton._getDefaultStateGlobal()};
MixinComponentGlobalState._Singleton._pSaveStateDebounced = MiscUtil.debounce(MixinComponentGlobalState._Singleton._pSaveState.bind(MixinComponentGlobalState._Singleton), 100);
MixinComponentGlobalState._Singleton._pLoadingState = null;

// endregion

class ComponentUiUtil {
	static trackHook (hooks, prop, hook) {
		hooks[prop] = hooks[prop] || [];
		hooks[prop].push(hook);
	}

	static $getDisp (comp, prop, {html, $ele, fnGetText} = {}) {
		$ele = ($ele || $(html || `<div></div>`));

		const hk = () => $ele.text(fnGetText ? fnGetText(comp._state[prop]) : comp._state[prop]);
		comp._addHookBase(prop, hk);
		hk();

		return $ele;
	}

	/**
	 * @param component An instance of a class which extends BaseComponent.
	 * @param prop Component to hook on.
	 * @param [fallbackEmpty] Fallback number if string is empty.
	 * @param [opts] Options Object.
	 * @param [opts.$ele] Element to use.
	 * @param [opts.html] HTML to convert to element to use.
	 * @param [opts.max] Max allowed return value.
	 * @param [opts.min] Min allowed return value.
	 * @param [opts.offset] Offset to add to value displayed.
	 * @param [opts.padLength] Number of digits to pad the number to.
	 * @param [opts.fallbackOnNaN] Return value if not a number.
	 * @param [opts.isAllowNull] If an empty input should be treated as null.
	 * @param [opts.asMeta] If a meta-object should be returned containing the hook and the checkbox.
	 * @param [opts.hookTracker] Object in which to track hook.
	 * @param [opts.decorationLeft] Decoration to be added to the left-hand-side of the input. Can be `"ticker"` or `"clear"`. REQUIRES `asMeta` TO BE SET.
	 * @param [opts.decorationRight] Decoration to be added to the right-hand-side of the input. Can be `"ticker"` or `"clear"`. REQUIRES `asMeta` TO BE SET.
	 * @return {JQuery}
	 */
	static $getIptInt (component, prop, fallbackEmpty = 0, opts) {
		return ComponentUiUtil._$getIptNumeric(component, prop, UiUtil.strToInt, fallbackEmpty, opts);
	}

	/**
	 * @param component An instance of a class which extends BaseComponent.
	 * @param prop Component to hook on.
	 * @param [fallbackEmpty] Fallback number if string is empty.
	 * @param [opts] Options Object.
	 * @param [opts.$ele] Element to use.
	 * @param [opts.html] HTML to convert to element to use.
	 * @param [opts.max] Max allowed return value.
	 * @param [opts.min] Min allowed return value.
	 * @param [opts.offset] Offset to add to value displayed.
	 * @param [opts.padLength] Number of digits to pad the number to.
	 * @param [opts.fallbackOnNaN] Return value if not a number.
	 * @param [opts.isAllowNull] If an empty input should be treated as null.
	 * @param [opts.asMeta] If a meta-object should be returned containing the hook and the checkbox.
	 * @param [opts.decorationLeft] Decoration to be added to the left-hand-side of the input. Can be `"ticker"` or `"clear"`. REQUIRES `asMeta` TO BE SET.
	 * @param [opts.decorationRight] Decoration to be added to the right-hand-side of the input. Can be `"ticker"` or `"clear"`. REQUIRES `asMeta` TO BE SET.
	 * @return {JQuery}
	 */
	static $getIptNumber (component, prop, fallbackEmpty = 0, opts) {
		return ComponentUiUtil._$getIptNumeric(component, prop, UiUtil.strToNumber, fallbackEmpty, opts);
	}

	static _$getIptNumeric (component, prop, fnConvert, fallbackEmpty = 0, opts) {
		opts = opts || {};
		opts.offset = opts.offset || 0;

		const setIptVal = () => {
			if (opts.isAllowNull && component._state[prop] == null) {
				return $ipt.val(null);
			}

			const num = (component._state[prop] || 0) + opts.offset;
			const val = opts.padLength ? `${num}`.padStart(opts.padLength, "0") : num;
			$ipt.val(val);
		};

		const $ipt = (opts.$ele || $(opts.html || `<input class="form-control input-xs form-control--minimal text-right">`)).disableSpellcheck()
			.keydown(evt => { if (evt.key === "Escape") $ipt.blur(); })
			.change(() => {
				const raw = $ipt.val().trim();
				const cur = component._state[prop];

				if (opts.isAllowNull && !raw) return component._state[prop] = null;

				if (raw.startsWith("=")) {
					// if it starts with "=", force-set to the value provided
					component._state[prop] = fnConvert(raw.slice(1), fallbackEmpty, opts) - opts.offset;
				} else {
					// otherwise, try to modify the previous value
					const mUnary = prevValue != null && prevValue < 0
						? /^[+/*^]/.exec(raw) // If the previous value was `-X`, then treat minuses as normal values
						: /^[-+/*^]/.exec(raw);
					if (mUnary) {
						let proc = raw;
						proc = proc.slice(1).trim();
						const mod = fnConvert(proc, fallbackEmpty, opts);
						const full = `${cur}${mUnary[0]}${mod}`;
						component._state[prop] = fnConvert(full, fallbackEmpty, opts) - opts.offset;
					} else {
						component._state[prop] = fnConvert(raw, fallbackEmpty, opts) - opts.offset;
					}
				}

				// Ensure the input visually reflects the state
				if (cur === component._state[prop]) setIptVal();
			});

		let prevValue;
		const hook = () => {
			prevValue = component._state[prop];
			setIptVal();
		};
		if (opts.hookTracker) ComponentUiUtil.trackHook(opts.hookTracker, prop, hook);
		component._addHookBase(prop, hook);
		hook();

		if (opts.asMeta) return this._getIptDecoratedMeta(component, prop, $ipt, hook, opts);
		else return $ipt;
	}

	/**
	 * @param component An instance of a class which extends BaseComponent.
	 * @param prop Component to hook on.
	 * @param [opts] Options Object.
	 * @param [opts.$ele] Element to use.
	 * @param [opts.html] HTML to convert to element to use.
	 * @param [opts.isNoTrim] If the text should not be trimmed.
	 * @param [opts.isAllowNull] If null should be allowed (and preferred) for empty inputs
	 * @param [opts.asMeta] If a meta-object should be returned containing the hook and the checkbox.
	 * @param [opts.autocomplete] Array of autocomplete strings. REQUIRES INCLUSION OF THE TYPEAHEAD LIBRARY.
	 * @param [opts.decorationLeft] Decoration to be added to the left-hand-side of the input. Can be `"search"` or `"clear"`. REQUIRES `asMeta` TO BE SET.
	 * @param [opts.decorationRight] Decoration to be added to the right-hand-side of the input. Can be `"search"` or `"clear"`. REQUIRES `asMeta` TO BE SET.
	 * @param [opts.placeholder] Placeholder for the input.
	 */
	static $getIptStr (component, prop, opts) {
		opts = opts || {};

		// Validate options
		if ((opts.decorationLeft || opts.decorationRight) && !opts.asMeta) throw new Error(`Input must be created with "asMeta" option`);

		const $ipt = (opts.$ele || $(opts.html || `<input class="form-control input-xs form-control--minimal">`))
			.keydown(evt => { if (evt.key === "Escape") $ipt.blur(); })
			.disableSpellcheck();
		UiUtil.bindTypingEnd({
			$ipt,
			fnKeyup: () => {
				const nxtVal = opts.isNoTrim ? $ipt.val() : $ipt.val().trim();
				component._state[prop] = opts.isAllowNull && !nxtVal ? null : nxtVal;
			},
		});

		if (opts.placeholder) $ipt.attr("placeholder", opts.placeholder);

		if (opts.autocomplete && opts.autocomplete.length) $ipt.typeahead({source: opts.autocomplete});
		const hook = () => {
			if (component._state[prop] == null) $ipt.val(null);
			else {
				// If the only difference is start/end whitespace, leave it; otherwise, adding spaces is frustrating
				if ($ipt.val().trim() !== component._state[prop]) $ipt.val(component._state[prop]);
			}
		};
		component._addHookBase(prop, hook);
		hook();

		if (opts.asMeta) return this._getIptDecoratedMeta(component, prop, $ipt, hook, opts);
		else return $ipt;
	}

	static _getIptDecoratedMeta (component, prop, $ipt, hook, opts) {
		const out = {$ipt, unhook: () => component._removeHookBase(prop, hook)};

		if (opts.decorationLeft || opts.decorationRight) {
			let $decorLeft;
			let $decorRight;

			if (opts.decorationLeft) {
				$ipt.addClass(`ui-ideco__ipt ui-ideco__ipt--left`);
				$decorLeft = ComponentUiUtil._$getDecor(component, prop, $ipt, opts.decorationLeft, "left", opts);
			}

			if (opts.decorationRight) {
				$ipt.addClass(`ui-ideco__ipt ui-ideco__ipt--right`);
				$decorRight = ComponentUiUtil._$getDecor(component, prop, $ipt, opts.decorationRight, "right", opts);
			}

			out.$wrp = $$`<div class="relative w-100">${$ipt}${$decorLeft}${$decorRight}</div>`;
		}

		return out;
	}

	static _$getDecor (component, prop, $ipt, decorType, side, opts) {
		switch (decorType) {
			case "search": {
				return $(`<div class="ui-ideco__wrp ui-ideco__wrp--${side} no-events ve-flex-vh-center"><span class="glyphicon glyphicon-search"></span></div>`);
			}
			case "clear": {
				return $(`<div class="ui-ideco__wrp ui-ideco__wrp--${side} ve-flex-vh-center clickable" title="Clear"><span class="glyphicon glyphicon-remove"></span></div>`)
					.click(() => $ipt.val("").change().keydown().keyup());
			}
			case "ticker": {
				const isValidValue = val => {
					if (opts.max != null && val > opts.max) return false;
					if (opts.min != null && val < opts.min) return false;
					return true;
				};

				const handleClick = (delta) => {
					// TODO(future) this should be run first to evaluate any lingering expressions in the input, but it
					//  breaks when the number is negative, as we need to add a "=" to the front of the input before
					//  evaluating
					// $ipt.change();
					const nxt = component._state[prop] + delta;
					if (!isValidValue(nxt)) return;
					component._state[prop] = nxt;
					$ipt.focus();
				};

				const $btnUp = $(`<button class="btn btn-default ui-ideco__btn-ticker bold no-select">+</button>`)
					.click(() => handleClick(1));

				const $btnDown = $(`<button class="btn btn-default ui-ideco__btn-ticker bold no-select">\u2012</button>`)
					.click(() => handleClick(-1));

				return $$`<div class="ui-ideco__wrp ui-ideco__wrp--${side} ve-flex-vh-center ve-flex-col">
					${$btnUp}
					${$btnDown}
				</div>`;
			}
			case "spacer": {
				return "";
			}
			default: throw new Error(`Unimplemented!`);
		}
	}

	/**
	 * @param component An instance of a class which extends BaseComponent.
	 * @param prop Component to hook on.
	 * @param [opts] Options Object.
	 * @param [opts.$ele] Element to use.
	 * @return {$}
	 */
	static $getIptEntries (component, prop, opts) {
		opts = opts || {};

		const $ipt = (opts.$ele || $(`<textarea class="form-control input-xs form-control--minimal resize-vertical"></textarea>`))
			.keydown(evt => { if (evt.key === "Escape") $ipt.blur(); })
			.change(() => component._state[prop] = UiUtil.getTextAsEntries($ipt.val().trim()));
		const hook = () => $ipt.val(UiUtil.getEntriesAsText(component._state[prop]));
		component._addHookBase(prop, hook);
		hook();
		return $ipt;
	}

	/**
	 * @param component An instance of a class which extends BaseComponent.
	 * @param prop Component to hook on.
	 * @param [opts] Options Object.
	 * @param [opts.$ele] Element to use.
	 * @return {JQuery}
	 */
	static $getIptColor (component, prop, opts) {
		opts = opts || {};

		const $ipt = (opts.$ele || $(`<input class="form-control input-xs form-control--minimal ui__ipt-color" type="color">`))
			.change(() => component._state[prop] = $ipt.val());
		const hook = () => $ipt.val(component._state[prop]);
		component._addHookBase(prop, hook);
		hook();
		return $ipt;
	}

	/**
	 * @param component An instance of a class which extends BaseComponent.
	 * @param prop Component to hook on.
	 * @param [opts] Options Object.
	 * @param [opts.ele] Element to use.
	 * @param [opts.html] HTML to convert to element to use.
	 * @param [opts.text] Button text, if element is not specified.
	 * @param [opts.fnHookPost] Function to run after primary hook.
	 * @param [opts.stateName] State name.
	 * @param [opts.stateProp] State prop.
	 * @param [opts.isInverted] If the toggle display should be inverted.
	 * @param [opts.activeClass] CSS class to use when setting the button as "active."
	 * @param [opts.title]
	 * @param [opts.activeTitle] Title to use when setting the button as "active."
	 * @param [opts.inactiveTitle] Title to use when setting the button as "active."
	 * @return *
	 */
	static getBtnBool (component, prop, opts) {
		opts = opts || {};

		let ele = opts.ele;
		if (opts.html) ele = e_({outer: opts.html});

		const activeClass = opts.activeClass || "active";
		const stateName = opts.stateName || "state";
		const stateProp = opts.stateProp || `_${stateName}`;

		const btn = (ele ? e_({ele}) : e_({
			ele: ele,
			tag: "button",
			clazz: "btn btn-xs btn-default",
			text: opts.text || "Toggle",
		}))
			.onClick(() => component[stateProp][prop] = !component[stateProp][prop])
			.onContextmenu(evt => {
				evt.preventDefault();
				component[stateProp][prop] = !component[stateProp][prop];
			});

		const hk = () => {
			btn.toggleClass(activeClass, opts.isInverted ? !component[stateProp][prop] : !!component[stateProp][prop]);
			if (opts.activeTitle || opts.inactiveTitle) btn.title(component[stateProp][prop] ? (opts.activeTitle || opts.title || "") : (opts.inactiveTitle || opts.title || ""));
			if (opts.fnHookPost) opts.fnHookPost(component[stateProp][prop]);
		};
		component._addHook(stateName, prop, hk);
		hk();

		return btn;
	}

	/**
	 * @param component An instance of a class which extends BaseComponent.
	 * @param prop Component to hook on.
	 * @param [opts] Options Object.
	 * @param [opts.$ele] Element to use.
	 * @param [opts.html] HTML to convert to element to use.
	 * @param [opts.text] Button text, if element is not specified.
	 * @param [opts.fnHookPost] Function to run after primary hook.
	 * @param [opts.stateName] State name.
	 * @param [opts.stateProp] State prop.
	 * @param [opts.isInverted] If the toggle display should be inverted.
	 * @param [opts.activeClass] CSS class to use when setting the button as "active."
	 * @param [opts.title]
	 * @param [opts.activeTitle] Title to use when setting the button as "active."
	 * @param [opts.inactiveTitle] Title to use when setting the button as "active."
	 * @return {JQuery}
	 */
	static $getBtnBool (component, prop, opts) {
		const nxtOpts = {...opts};
		if (nxtOpts.$ele) {
			nxtOpts.ele = nxtOpts.$ele[0];
			delete nxtOpts.$ele;
		}
		return $(this.getBtnBool(component, prop, nxtOpts));
	}

	/**
	 * @param component An instance of a class which extends BaseComponent.
	 * @param prop Component to hook on.
	 * @param [opts] Options Object.
	 * @param [opts.$ele] Element to use.
	 * @param [opts.asMeta] If a meta-object should be returned containing the hook and the input.
	 * @param [opts.displayNullAsIndeterminate]
	 * @param [opts.stateName] State name.
	 * @param [opts.stateProp] State prop.
	 * @return {JQuery}
	 */
	static $getCbBool (component, prop, opts) {
		opts = opts || {};

		const stateName = opts.stateName || "state";
		const stateProp = opts.stateProp || `_${stateName}`;

		const cb = e_({
			tag: "input",
			type: "checkbox",
			keydown: evt => {
				if (evt.key === "Escape") cb.blur();
			},
			change: () => {
				component[stateProp][prop] = cb.checked;
			},
		});

		const hook = () => {
			cb.checked = !!component[stateProp][prop];
			if (opts.displayNullAsIndeterminate) cb.indeterminate = component[stateProp][prop] == null;
		};
		component._addHook(stateName, prop, hook);
		hook();

		const $cb = $(cb);

		return opts.asMeta ? ({$cb, unhook: () => component._removeHook(stateName, prop, hook)}) : $cb;
	}

	/**
	 * A select2-style dropdown.
	 * @param comp An instance of a class which extends BaseComponent.
	 * @param prop Component to hook on.
	 * @param opts Options Object.
	 * @param opts.values Values to display.
	 * @param [opts.isHiddenPerValue]
	 * @param [opts.$ele] Element to use.
	 * @param [opts.html] HTML to convert to element to use.
	 * @param [opts.isAllowNull] If null is allowed.
	 * @param [opts.fnDisplay] Value display function.
	 * @param [opts.displayNullAs] If null values are allowed, display them as this string.
	 * @param [opts.fnGetAdditionalStyleClasses] Function which converts an item into CSS classes.
	 * @param [opts.asMeta] If a meta-object should be returned containing the hook and the select.
	 * @param [opts.isDisabled] If the selector should be display-only
	 * @return {JQuery}
	 */
	static $getSelSearchable (comp, prop, opts) {
		opts = opts || {};

		const $iptDisplay = (opts.$ele || $(opts.html || `<input class="form-control input-xs form-control--minimal">`))
			.addClass("ui-sel2__ipt-display")
			.attr("tabindex", "-1")
			.click(() => {
				if (opts.isDisabled) return;
				$iptSearch.focus().select();
			})
			.prop("disabled", !!opts.isDisabled)
			.disableSpellcheck();

		const handleSearchChange = () => {
			const cleanTerm = this._$getSelSearchable_getSearchString($iptSearch.val());
			metaOptions.forEach(it => {
				it.isVisible = it.searchTerm.includes(cleanTerm);
				it.$ele.toggleVe(it.isVisible && !it.isForceHidden);
			});
		};
		const handleSearchChangeDebounced = MiscUtil.debounce(handleSearchChange, 30);

		const $iptSearch = (opts.$ele || $(opts.html || `<input class="form-control input-xs form-control--minimal">`))
			.addClass("absolute ui-sel2__ipt-search")
			.keydown(evt => {
				if (opts.isDisabled) return;

				switch (evt.key) {
					case "Escape": evt.stopPropagation(); return $iptSearch.blur();

					case "ArrowDown": {
						evt.preventDefault();
						const visibleMetaOptions = metaOptions.filter(it => it.isVisible && !it.isForceHidden);
						if (!visibleMetaOptions.length) return;
						visibleMetaOptions[0].$ele.focus();
						break;
					}

					case "Enter":
					case "Tab": {
						const visibleMetaOptions = metaOptions.filter(it => it.isVisible && !it.isForceHidden);
						if (!visibleMetaOptions.length) return;
						comp._state[prop] = visibleMetaOptions[0].value;
						$iptSearch.blur();
						break;
					}

					default: handleSearchChangeDebounced();
				}
			})
			.change(() => handleSearchChangeDebounced())
			.click(() => {
				if (opts.isDisabled) return;
				$iptSearch.focus().select();
			})
			.prop("disabled", !!opts.isDisabled)
			.disableSpellcheck();

		const $wrpChoices = $(`<div class="absolute ui-sel2__wrp-options overflow-y-scroll"></div>`);

		const $wrp = $$`<div class="ve-flex relative ui-sel2__wrp w-100">
			${$iptDisplay}
			${$iptSearch}
			${$wrpChoices}
			<div class="ui-sel2__disp-arrow absolute no-events bold"><span class="glyphicon glyphicon-menu-down"></span></div>
		</div>`;

		const procValues = opts.isAllowNull ? [null, ...opts.values] : opts.values;
		const metaOptions = procValues.map((v, i) => {
			const display = v == null ? (opts.displayNullAs || "\u2014") : opts.fnDisplay ? opts.fnDisplay(v) : v;
			const additionalStyleClasses = opts.fnGetAdditionalStyleClasses ? opts.fnGetAdditionalStyleClasses(v) : null;

			const $ele = $(`<div class="ve-flex-v-center py-1 px-1 clickable ui-sel2__disp-option ${v == null ? `italic` : ""} ${additionalStyleClasses ? additionalStyleClasses.join(" ") : ""}" tabindex="0">${display}</div>`)
				.click(() => {
					if (opts.isDisabled) return;

					comp._state[prop] = v;
					$(document.activeElement).blur();
					// Temporarily remove pointer events from the dropdown, so it collapses thanks to its :hover CSS
					$wrp.addClass("no-events");
					setTimeout(() => $wrp.removeClass("no-events"), 50);
				})
				.keydown(evt => {
					if (opts.isDisabled) return;

					switch (evt.key) {
						case "Escape": evt.stopPropagation(); return $ele.blur();

						case "ArrowDown": {
							evt.preventDefault();
							const visibleMetaOptions = metaOptions.filter(it => it.isVisible && !it.isForceHidden);
							if (!visibleMetaOptions.length) return;
							const ixCur = visibleMetaOptions.indexOf(out);
							const nxt = visibleMetaOptions[ixCur + 1];
							if (nxt) nxt.$ele.focus();
							break;
						}

						case "ArrowUp": {
							evt.preventDefault();
							const visibleMetaOptions = metaOptions.filter(it => it.isVisible && !it.isForceHidden);
							if (!visibleMetaOptions.length) return;
							const ixCur = visibleMetaOptions.indexOf(out);
							const prev = visibleMetaOptions[ixCur - 1];
							if (prev) return prev.$ele.focus();
							$iptSearch.focus();
							break;
						}

						case "Enter": {
							comp._state[prop] = v;
							$ele.blur();
							break;
						}
					}
				})
				.appendTo($wrpChoices);

			const isForceHidden = opts.isHiddenPerValue && !!(opts.isAllowNull ? opts.isHiddenPerValue[i - 1] : opts.isHiddenPerValue[i]);
			if (isForceHidden) $ele.hideVe();

			const out = {
				value: v,
				isVisible: true,
				isForceHidden,
				searchTerm: this._$getSelSearchable_getSearchString(display),
				$ele,
			};
			return out;
		});

		const fnUpdateHidden = (isHiddenPerValue, isHideNull = false) => {
			let metaOptions_ = metaOptions;

			if (opts.isAllowNull) {
				metaOptions_[0].isForceHidden = isHideNull;
				metaOptions_ = metaOptions_.slice(1);
			}

			metaOptions_.forEach((it, i) => it.isForceHidden = !!isHiddenPerValue[i]);
			handleSearchChange();
		};

		const hk = () => {
			if (comp._state[prop] == null) $iptDisplay.addClass("italic").addClass("ve-muted").val(opts.displayNullAs || "\u2014");
			else $iptDisplay.removeClass("italic").removeClass("ve-muted").val(opts.fnDisplay ? opts.fnDisplay(comp._state[prop]) : comp._state[prop]);

			metaOptions.forEach(it => it.$ele.removeClass("active"));
			const metaActive = metaOptions.find(it => it.value == null ? comp._state[prop] == null : it.value === comp._state[prop]);
			if (metaActive) metaActive.$ele.addClass("active");
		};
		comp._addHookBase(prop, hk);
		hk();

		return opts.asMeta
			? ({
				$wrp,
				unhook: () => comp._removeHookBase(prop, hk),
				$iptDisplay,
				$iptSearch,
				fnUpdateHidden,
			})
			: $wrp;
	}

	static _$getSelSearchable_getSearchString (str) {
		if (str == null) return "";
		return str.trim().toLowerCase().replace(/\s+/g, " ");
	}

	/**
	 * @param component An instance of a class which extends BaseComponent.
	 * @param prop Component to hook on.
	 * @param opts Options Object.
	 * @param opts.values Values to display.
	 * @param [opts.$ele] Element to use.
	 * @param [opts.html] HTML to convert to element to use.
	 * @param [opts.isAllowNull] If null is allowed.
	 * @param [opts.fnDisplay] Value display function.
	 * @param [opts.displayNullAs] If null values are allowed, display them as this string.
	 * @param [opts.asMeta] If a meta-object should be returned containing the hook and the select.
	 * @param [opts.propProxy] Proxy prop.
	 * @param [opts.isSetIndexes] If the index of the selected item should be set as state, rather than the item itself.
	 */
	static $getSelEnum (component, prop, {values, $ele, html, isAllowNull, fnDisplay, displayNullAs, asMeta, propProxy = "state", isSetIndexes = false} = {}) {
		const _propProxy = `_${propProxy}`;

		let values_;

		let $sel = $ele || (html ? $(html) : null);
		// Use native API, if we can, for performance
		if (!$sel) { const sel = document.createElement("select"); sel.className = "form-control input-xs"; $sel = $(sel); }

		$sel.change(() => {
			const ix = Number($sel.val());
			if (~ix) return void (component[_propProxy][prop] = isSetIndexes ? ix : values_[ix]);

			if (isAllowNull) return void (component[_propProxy][prop] = null);
			component[_propProxy][prop] = isSetIndexes ? 0 : values_[0];
		});

		// If the new value list doesn't contain our current value, reset our current value
		const setValues_handleResetOnMissing = ({isResetOnMissing, nxtValues}) => {
			if (!isResetOnMissing) return;

			if (component[_propProxy][prop] == null) return;

			if (isSetIndexes) {
				if (component[_propProxy][prop] >= 0 && component[_propProxy][prop] < nxtValues.length) {
					if (isAllowNull) return component[_propProxy][prop] = null;
					return component[_propProxy][prop] = 0;
				}

				return;
			}

			if (!nxtValues.includes(component[_propProxy][prop])) {
				if (isAllowNull) return component[_propProxy][prop] = null;
				return component[_propProxy][prop] = nxtValues[0];
			}
		};

		const setValues = (nxtValues, {isResetOnMissing = false, isForce = false} = {}) => {
			if (!isForce && CollectionUtil.deepEquals(values_, nxtValues)) return;
			values_ = nxtValues;
			$sel.empty();
			// Use native API for performance
			if (isAllowNull) { const opt = document.createElement("option"); opt.value = "-1"; opt.text = displayNullAs || "\u2014"; $sel.append(opt); }
			values_.forEach((it, i) => { const opt = document.createElement("option"); opt.value = `${i}`; opt.text = fnDisplay ? fnDisplay(it) : it; $sel.append(opt); });

			setValues_handleResetOnMissing({isResetOnMissing, nxtValues});

			hook();
		};

		const hook = () => {
			if (isSetIndexes) {
				const ix = component[_propProxy][prop] == null ? -1 : component[_propProxy][prop];
				$sel.val(`${ix}`);
				return;
			}

			const searchFor = component[_propProxy][prop] === undefined ? null : component[_propProxy][prop];
			// Null handling is done in change handler
			const ix = values_.indexOf(searchFor);
			$sel.val(`${ix}`);
		};
		component._addHookBase(prop, hook);

		setValues(values);

		if (!asMeta) return $sel;

		return {
			$sel,
			unhook: () => component._removeHookBase(prop, hook),
			setValues,
		};
	}

	/**
	 * @param component An instance of a class which extends BaseComponent.
	 * @param prop Component to hook on.
	 * @param opts Options Object.
	 * @param opts.values Values to display.
	 * @param [opts.fnDisplay] Value display function.
	 */
	static $getPickEnum (component, prop, opts) {
		return this._$getPickEnumOrString(component, prop, opts);
	}

	/**
	 * @param component An instance of a class which extends BaseComponent.
	 * @param prop Component to hook on.
	 * @param [opts] Options Object.
	 * @param [opts.values] Values to display.
	 * @param [opts.isCaseInsensitive] If the values should be case insensitive.
	 */
	static $getPickString (component, prop, opts) {
		return this._$getPickEnumOrString(component, prop, {...opts, isFreeText: true});
	}

	/**
	 * @param component An instance of a class which extends BaseComponent.
	 * @param prop Component to hook on.
	 * @param opts Options Object.
	 * @param [opts.values] Values to display.
	 * @param [opts.fnDisplay] Value display function.
	 * @param [opts.isFreeText] If the picker should accept free text.
	 * @param [opts.isCaseInsensitive] If the picker should accept free text.
	 */
	static _$getPickEnumOrString (component, prop, opts) {
		opts = opts || {};

		const getSubcompValues = () => {
			const initialValuesArray = (opts.values || []).concat(opts.isFreeText ? MiscUtil.copyFast((component._state[prop] || [])) : []);
			const initialValsCompWith = opts.isCaseInsensitive ? component._state[prop].map(it => it.toLowerCase()) : component._state[prop];
			return initialValuesArray
				.map(v => opts.isCaseInsensitive ? v.toLowerCase() : v)
				.mergeMap(v => ({[v]: component._state[prop] && initialValsCompWith.includes(v)}));
		};

		const initialVals = getSubcompValues();

		let $btnAdd;
		if (opts.isFreeText) {
			$btnAdd = $(`<button class="btn btn-xxs btn-default ui-pick__btn-add ml-auto">+</button>`)
				.click(async () => {
					const input = await InputUiUtil.pGetUserString();
					if (input == null || input === VeCt.SYM_UI_SKIP) return;
					const inputClean = opts.isCaseInsensitive ? input.trim().toLowerCase() : input.trim();
					pickComp.getPod().set(inputClean, true);
				});
		} else {
			const menu = ContextUtil.getMenu(opts.values.map(it => new ContextUtil.Action(
				opts.fnDisplay ? opts.fnDisplay(it) : it,
				() => pickComp.getPod().set(it, true),
			)));

			$btnAdd = $(`<button class="btn btn-xxs btn-default ui-pick__btn-add">+</button>`)
				.click(evt => ContextUtil.pOpenMenu(evt, menu));
		}

		const pickComp = BaseComponent.fromObject(initialVals);
		pickComp.render = function ($parent) {
			$parent.empty();

			Object.entries(this._state).forEach(([k, v]) => {
				if (v === false) return;

				const $btnRemove = $(`<button class="btn btn-danger ui-pick__btn-remove text-center">×</button>`)
					.click(() => this._state[k] = false);
				const txt = `${opts.fnDisplay ? opts.fnDisplay(k) : k}`;
				$$`<div class="ve-flex mx-1 mb-1 ui-pick__disp-pill max-w-100 min-w-0"><div class="px-1 ui-pick__disp-text ve-flex-v-center text-clip-ellipsis" title="${txt.qq()}">${txt}</div>${$btnRemove}</div>`.appendTo($parent);
			});
		};

		const $wrpPills = $(`<div class="ve-flex ve-flex-wrap max-w-100 min-w-0"></div>`);
		const $wrp = $$`<div class="ve-flex-v-center w-100">${$btnAdd}${$wrpPills}</div>`;
		pickComp._addHookAll("state", () => {
			component._state[prop] = Object.keys(pickComp._state).filter(k => pickComp._state[k]);
			pickComp.render($wrpPills);
		});
		pickComp.render($wrpPills);

		const hkParent = () => pickComp._proxyAssignSimple("state", getSubcompValues(), true);
		component._addHookBase(prop, hkParent);

		return $wrp;
	}

	/**
	 * @param component An instance of a class which extends BaseComponent.
	 * @param prop Component to hook on.
	 * @param opts Options Object.
	 * @param opts.values Values to display.
	 * @param [opts.fnDisplay] Value display function.
	 * @param [opts.isDisallowNull] True if null is not an allowed value.
	 * @param [opts.asMeta] If a meta-object should be returned containing the hook and the wrapper.
	 * @param [opts.isIndent] If the checkboxes should be indented.
	 * @return {JQuery}
	 */
	static $getCbsEnum (component, prop, opts) {
		opts = opts || {};

		const $wrp = $(`<div class="ve-flex-col w-100"></div>`);
		const metas = opts.values.map(it => {
			const $cb = $(`<input type="checkbox">`)
				.keydown(evt => {
					if (evt.key === "Escape") $cb.blur();
				})
				.change(() => {
					let didUpdate = false;
					const ix = (component._state[prop] || []).indexOf(it);
					if (~ix) component._state[prop].splice(ix, 1);
					else {
						if (component._state[prop]) component._state[prop].push(it);
						else {
							didUpdate = true;
							component._state[prop] = [it];
						}
					}
					if (!didUpdate) component._state[prop] = [...component._state[prop]];
				});

			$$`<label class="split-v-center my-1 stripe-odd ${opts.isIndent ? "ml-4" : ""}"><div class="no-wrap ve-flex-v-center">${opts.fnDisplay ? opts.fnDisplay(it) : it}</div>${$cb}</label>`.appendTo($wrp);

			return {$cb, value: it};
		});

		const hook = () => metas.forEach(meta => meta.$cb.prop("checked", component._state[prop] && component._state[prop].includes(meta.value)));
		component._addHookBase(prop, hook);
		hook();

		return opts.asMeta ? {$wrp, unhook: () => component._removeHookBase(prop, hook)} : $wrp;
	}

	// region Multi Choice
	/**
	 * @param comp
	 * @param prop Base prop. This will be expanded with `__...`-suffixed sub-props as required.
	 * @param opts Options.
	 * @param [opts.values] Array of values. Mutually incompatible with "valueGroups".
	 * @param [opts.valueGroups] Array of value groups (of the form
	 *   `{name: "Group Name", text: "Optional group hint text", values: [...]}` ).
	 *   Mutually incompatible with "values".
	 * @param [opts.valueGroupSplitControlsLookup] A lookup of `<value group name> -> header controls` to embed in the UI.
	 * @param [opts.count] Number of choices the user can make (cannot be used with min/max).
	 * @param [opts.min] Minimum number of choices the user can make (cannot be used with count).
	 * @param [opts.max] Maximum number of choices the user can make (cannot be used with count).
	 * @param [opts.isResolveItems] True if the promise should resolve to an array of the items instead of the indices. // TODO maybe remove?
	 * @param [opts.fnDisplay] Function which takes a value and returns display text.
	 * @param [opts.required] Values which are required.
	 * @param [opts.ixsRequired] Indexes of values which are required.
	 * @param [opts.isSearchable] If a search input should be created.
	 * @param [opts.fnGetSearchText] Function which takes a value and returns search text.
	 */
	static getMetaWrpMultipleChoice (comp, prop, opts) {
		opts = opts || {};
		this._getMetaWrpMultipleChoice_doValidateOptions(opts);

		const rowMetas = [];
		const $eles = [];
		const ixsSelectionOrder = [];
		const $elesSearchable = {};

		const propIsAcceptable = this.getMetaWrpMultipleChoice_getPropIsAcceptable(prop);
		const propPulse = this.getMetaWrpMultipleChoice_getPropPulse(prop);
		const propIxMax = this._getMetaWrpMultipleChoice_getPropValuesLength(prop);

		const cntRequired = ((opts.required || []).length) + ((opts.ixsRequired || []).length);
		const count = opts.count != null ? opts.count - cntRequired : null;
		const countIncludingRequired = opts.count != null ? count + cntRequired : null;
		const min = opts.min != null ? opts.min - cntRequired : null;
		const max = opts.max != null ? opts.max - cntRequired : null;

		const valueGroups = opts.valueGroups || [{values: opts.values}];

		let ixValue = 0;
		valueGroups.forEach((group, i) => {
			if (i !== 0) $eles.push($(`<hr class="w-100 hr-2 hr--dotted">`));

			if (group.name) {
				const $wrpName = $$`<div class="split-v-center py-1">
					<div class="ve-flex-v-center"><span class="mr-2">‒</span><span>${group.name}</span></div>
					${opts.valueGroupSplitControlsLookup?.[group.name]}
				</div>`;
				$eles.push($wrpName);
			}

			if (group.text) $eles.push($(`<div class="ve-flex-v-center py-1"><div class="ml-1 mr-3"></div><i>${group.text}</i></div>`));

			group.values.forEach(v => {
				const ixValueFrozen = ixValue;

				const propIsActive = this.getMetaWrpMultipleChoice_getPropIsActive(prop, ixValueFrozen);
				const propIsRequired = this.getMetaWrpMultipleChoice_getPropIsRequired(prop, ixValueFrozen);

				const isHardRequired = (opts.required && opts.required.includes(v))
					|| (opts.ixsRequired && opts.ixsRequired.includes(ixValueFrozen));
				const isRequired = isHardRequired || comp._state[propIsRequired];

				// In the case of pre-existing selections, add these to our selection order tracking as they appear
				if (comp._state[propIsActive] && !comp._state[propIsRequired]) ixsSelectionOrder.push(ixValueFrozen);

				let hk;
				const $cb = isRequired
					? $(`<input type="checkbox" disabled checked title="This option is required.">`)
					: ComponentUiUtil.$getCbBool(comp, propIsActive);

				if (isRequired) comp._state[propIsActive] = true;

				if (!isRequired) {
					hk = () => {
						// region Selection order
						const ixIx = ixsSelectionOrder.findIndex(it => it === ixValueFrozen);
						if (~ixIx) ixsSelectionOrder.splice(ixIx, 1);
						if (comp._state[propIsActive]) ixsSelectionOrder.push(ixValueFrozen);
						// endregion

						// region Enable/disable
						const activeRows = rowMetas.filter(it => comp._state[it.propIsActive]);

						if (count != null) {
							// If we're above the max allowed count, deselect a checkbox in FIFO order
							if (activeRows.length > countIncludingRequired) {
								// FIFO (`.shift`) makes logical sense, but FILO (`.splice` second-from-last) _feels_ better
								const ixFirstSelected = ixsSelectionOrder.splice(ixsSelectionOrder.length - 2, 1)[0];
								if (ixFirstSelected != null) {
									const propIsActiveOther = this.getMetaWrpMultipleChoice_getPropIsActive(prop, ixFirstSelected);
									comp._state[propIsActiveOther] = false;

									comp._state[propPulse] = !comp._state[propPulse];
								}
								return;
							}
						}

						let isAcceptable = false;
						if (count != null) {
							if (activeRows.length === countIncludingRequired) isAcceptable = true;
						} else {
							if (activeRows.length >= (min || 0) && activeRows.length <= (max || Number.MAX_SAFE_INTEGER)) isAcceptable = true;
						}

						// Save this to a flag in the state object that external code can read
						comp._state[propIsAcceptable] = isAcceptable;
						// endregion

						comp._state[propPulse] = !comp._state[propPulse];
					};
					comp._addHookBase(propIsActive, hk);
					hk();
				}

				const displayValue = opts.fnDisplay ? opts.fnDisplay(v, ixValueFrozen) : v;

				rowMetas.push({
					$cb,
					displayValue,
					value: v,
					propIsActive,
					unhook: () => {
						if (hk) comp._removeHookBase(propIsActive, hk);
					},
				});

				const $ele = $$`<label class="ve-flex-v-center py-1 stripe-even">
					<div class="col-1 ve-flex-vh-center">${$cb}</div>
					<div class="col-11 ve-flex-v-center">${displayValue}</div>
				</label>`;
				$eles.push($ele);

				if (opts.isSearchable) {
					const searchText = `${opts.fnGetSearchText ? opts.fnGetSearchText(v, ixValueFrozen) : v}`.toLowerCase().trim();
					($elesSearchable[searchText] = $elesSearchable[searchText] || []).push($ele);
				}

				ixValue++;
			});
		});

		// Sort the initial selection order (i.e. that from defaults) by lowest to highest, such that new clicks
		//   will remove from the first element in visual order
		ixsSelectionOrder.sort((a, b) => SortUtil.ascSort(a, b));

		comp.__state[propIxMax] = ixValue;

		let $iptSearch;
		if (opts.isSearchable) {
			const compSub = BaseComponent.fromObject({search: ""});
			$iptSearch = ComponentUiUtil.$getIptStr(compSub, "search");
			const hkSearch = () => {
				const cleanSearch = compSub._state.search.trim().toLowerCase();
				if (!cleanSearch) {
					Object.values($elesSearchable).forEach($eles => $eles.forEach($ele => $ele.removeClass("ve-hidden")));
					return;
				}

				Object.entries($elesSearchable)
					.forEach(([searchText, $eles]) => $eles.forEach($ele => $ele.toggleVe(searchText.includes(cleanSearch))));
			};
			compSub._addHookBase("search", hkSearch);
			hkSearch();
		}

		// Always return this as a "meta" object
		const unhook = () => rowMetas.forEach(it => it.unhook());
		return {
			$ele: $$`<div class="ve-flex-col w-100 overflow-y-auto">${$eles}</div>`,
			$iptSearch,
			rowMetas, // Return this to allow for creating custom UI
			propIsAcceptable,
			propPulse,
			unhook,
			cleanup: () => {
				unhook();
				// This will trigger a final "pulse"
				Object.keys(comp._state)
					.filter(it => it.startsWith(`${prop}__`))
					.forEach(it => delete comp._state[it]);
			},
		};
	}

	static getMetaWrpMultipleChoice_getPropIsAcceptable (prop) { return `${prop}__isAcceptable`; }
	static getMetaWrpMultipleChoice_getPropPulse (prop) { return `${prop}__pulse`; }
	static _getMetaWrpMultipleChoice_getPropValuesLength (prop) { return `${prop}__length`; }
	static getMetaWrpMultipleChoice_getPropIsActive (prop, ixValue) { return `${prop}__isActive_${ixValue}`; }
	static getMetaWrpMultipleChoice_getPropIsRequired (prop, ixValue) { return `${prop}__isRequired_${ixValue}`; }

	static getMetaWrpMultipleChoice_getSelectedIxs (comp, prop) {
		const out = [];
		const len = comp._state[this._getMetaWrpMultipleChoice_getPropValuesLength(prop)] || 0;
		for (let i = 0; i < len; ++i) {
			if (comp._state[this.getMetaWrpMultipleChoice_getPropIsActive(prop, i)]) out.push(i);
		}
		return out;
	}

	static getMetaWrpMultipleChoice_getSelectedValues (comp, prop, {values, valueGroups}) {
		const selectedIxs = this.getMetaWrpMultipleChoice_getSelectedIxs(comp, prop);
		if (values) return selectedIxs.map(ix => values[ix]);

		const selectedIxsSet = new Set(selectedIxs);
		const out = [];
		let ixValue = 0;
		valueGroups.forEach(group => {
			group.values.forEach(v => {
				if (selectedIxsSet.has(ixValue)) out.push(v);
				ixValue++;
			});
		});
		return out;
	}

	static _getMetaWrpMultipleChoice_doValidateOptions (opts) {
		if ((Number(!!opts.values) + Number(!!opts.valueGroups)) !== 1) throw new Error(`Exactly one of "values" and "valueGroups" must be specified!`);

		if (opts.count != null && (opts.min != null || opts.max != null)) throw new Error(`Chooser must be either in "count" mode or "min/max" mode!`);
		// If no mode is specified, default to a "count 1" chooser
		if (opts.count == null && opts.min == null && opts.max == null) opts.count = 1;
	}
	// endregion

	/**
	 * @param comp An instance of a class which extends BaseComponent.
	 * @param opts Options Object.
	 * @param opts.propMin
	 * @param opts.propMax
	 * @param opts.propCurMin
	 * @param [opts.propCurMax]
	 * @param [opts.fnDisplay] Value display function.
	 * @param [opts.fnDisplayTooltip]
	 * @param [opts.sparseValues]
	 */
	static $getSliderRange (comp, opts) {
		opts = opts || {};
		const slider = new ComponentUiUtil.RangeSlider({comp, ...opts});
		return slider.$get();
	}

	static $getSliderNumber (
		comp,
		prop,
		{
			min,
			max,
			step,
			$ele,
			asMeta,
		} = {},
	) {
		const $slider = ($ele || $(`<input type="range">`))
			.change(() => comp._state[prop] = Number($slider.val()));

		if (min != null) $slider.attr("min", min);
		if (max != null) $slider.attr("max", max);
		if (step != null) $slider.attr("step", step);

		const hk = () => $slider.val(comp._state[prop]);
		comp._addHookBase(prop, hk);
		hk();

		return asMeta ? ({$slider, unhook: () => comp._removeHookBase(prop, hk)}) : $slider;
	}
}
ComponentUiUtil.RangeSlider = class {
	constructor (
		{
			comp,
			propMin,
			propMax,
			propCurMin,
			propCurMax,
			fnDisplay,
			fnDisplayTooltip,
			sparseValues,
		},
	) {
		this._comp = comp;
		this._propMin = propMin;
		this._propMax = propMax;
		this._propCurMin = propCurMin;
		this._propCurMax = propCurMax;
		this._fnDisplay = fnDisplay;
		this._fnDisplayTooltip = fnDisplayTooltip;
		this._sparseValues = sparseValues;

		this._isSingle = !this._propCurMax;

		// region Make a copy of the interesting bits of the parent component, so we can freely change them without
		//   outside performance implications
		const compCpyState = {
			[this._propMin]: this._comp._state[this._propMin],
			[this._propCurMin]: this._comp._state[this._propCurMin],
			[this._propMax]: this._comp._state[this._propMax],
		};
		if (!this._isSingle) compCpyState[this._propCurMax] = this._comp._state[this._propCurMax];
		this._compCpy = BaseComponent.fromObject(compCpyState);

		// Sync parent changes to our state
		this._comp._addHook("state", this._propMin, () => this._compCpy._state[this._propMin] = this._comp._state[this._propMin]);
		this._comp._addHook("state", this._propCurMin, () => this._compCpy._state[this._propCurMin] = this._comp._state[this._propCurMin]);
		this._comp._addHook("state", this._propMax, () => this._compCpy._state[this._propMax] = this._comp._state[this._propMax]);

		if (!this._isSingle) this._comp._addHook("state", this._propCurMax, () => this._compCpy._state[this._propCurMax] = this._comp._state[this._propCurMax]);
		// endregion

		this._cacheRendered = null;
		this._dispTrackOuter = null;
		this._dispTrackInner = null;
		this._thumbLow = null;
		this._thumbHigh = null;
		this._dragMeta = null;
	}

	$get () {
		const out = this.get();
		return $(out);
	}

	get () {
		this.constructor._init();
		this.constructor._ALL_SLIDERS.add(this);

		if (this._cacheRendered) return this._cacheRendered;

		// region Top part
		const dispValueLeft = this._isSingle ? this._getSpcSingleValue() : this._getDispValue({isVisible: true, side: "left"});
		const dispValueRight = this._getDispValue({isVisible: true, side: "right"});

		this._dispTrackInner = this._isSingle ? null : e_({
			tag: "div",
			clazz: "ui-slidr__track-inner h-100 absolute",
		});

		this._thumbLow = this._getThumb();
		this._thumbHigh = this._isSingle ? null : this._getThumb();

		this._dispTrackOuter = e_({
			tag: "div",
			clazz: `relative w-100 ui-slidr__track-outer`,
			children: [
				this._dispTrackInner,
				this._thumbLow,
				this._thumbHigh,
			].filter(Boolean),
		});

		const wrpTrack = e_({
			tag: "div",
			clazz: `ve-flex-v-center w-100 h-100 ui-slidr__wrp-track clickable`,
			mousedown: evt => {
				const thumb = this._getClosestThumb(evt);
				this._handleMouseDown(evt, thumb);
			},
			children: [
				this._dispTrackOuter,
			],
		});

		const wrpTop = e_({
			tag: "div",
			clazz: "ve-flex-v-center w-100 ui-slidr__wrp-top",
			children: [
				dispValueLeft,
				wrpTrack,
				dispValueRight,
			].filter(Boolean),
		});
		// endregion

		// region Bottom part
		const wrpPips = e_({
			tag: "div",
			clazz: `w-100 ve-flex relative clickable h-100 ui-slidr__wrp-pips`,
			mousedown: evt => {
				const thumb = this._getClosestThumb(evt);
				this._handleMouseDown(evt, thumb);
			},
		});

		const wrpBottom = e_({
			tag: "div",
			clazz: "w-100 ve-flex-vh-center ui-slidr__wrp-bottom",
			children: [
				this._isSingle ? this._getSpcSingleValue() : this._getDispValue({side: "left"}), // Pad the start
				wrpPips,
				this._getDispValue({side: "right"}), // and the end
			].filter(Boolean),
		});
		// endregion

		// region Hooks
		const hkChangeValue = () => {
			const curMin = this._compCpy._state[this._propCurMin];
			const pctMin = this._getLeftPositionPercentage({value: curMin});
			this._thumbLow.style.left = `calc(${pctMin}% - ${this.constructor._W_THUMB_PX / 2}px)`;
			const toDisplayLeft = this._fnDisplay ? `${this._fnDisplay(curMin)}`.qq() : curMin;
			const toDisplayLeftTooltip = this._fnDisplayTooltip ? `${this._fnDisplayTooltip(curMin)}`.qq() : null;
			if (!this._isSingle) {
				dispValueLeft
					.html(toDisplayLeft)
					.tooltip(toDisplayLeftTooltip);
			}

			if (!this._isSingle) {
				this._dispTrackInner.style.left = `${pctMin}%`;

				const curMax = this._compCpy._state[this._propCurMax];
				const pctMax = this._getLeftPositionPercentage({value: curMax});
				this._dispTrackInner.style.right = `${100 - pctMax}%`;
				this._thumbHigh.style.left = `calc(${pctMax}% - ${this.constructor._W_THUMB_PX / 2}px)`;
				dispValueRight
					.html(this._fnDisplay ? `${this._fnDisplay(curMax)}`.qq() : curMax)
					.tooltip(this._fnDisplayTooltip ? `${this._fnDisplayTooltip(curMax)}`.qq() : null);
			} else {
				dispValueRight
					.html(toDisplayLeft)
					.tooltip(toDisplayLeftTooltip);
			}
		};

		const hkChangeLimit = () => {
			const pips = [];

			if (!this._sparseValues) {
				const numPips = this._compCpy._state[this._propMax] - this._compCpy._state[this._propMin];
				let pipIncrement = 1;
				// Cap the number of pips
				if (numPips > ComponentUiUtil.RangeSlider._MAX_PIPS) pipIncrement = Math.ceil(numPips / ComponentUiUtil.RangeSlider._MAX_PIPS);

				let i, len;
				for (
					i = this._compCpy._state[this._propMin], len = this._compCpy._state[this._propMax] + 1;
					i < len;
					i += pipIncrement
				) {
					pips.push(this._getWrpPip({
						isMajor: i === this._compCpy._state[this._propMin] || i === (len - 1),
						value: i,
					}));
				}

				// Ensure the last pip is always rendered, even if we're reducing pips
				if (i !== this._compCpy._state[this._propMax]) pips.push(this._getWrpPip({isMajor: true, value: this._compCpy._state[this._propMax]}));
			} else {
				const len = this._sparseValues.length;
				this._sparseValues.forEach((val, i) => {
					pips.push(this._getWrpPip({
						isMajor: i === 0 || i === (len - 1),
						value: val,
					}));
				});
			}

			wrpPips.empty();
			e_({
				ele: wrpPips,
				children: pips,
			});

			hkChangeValue();
		};

		this._compCpy._addHook("state", this._propMin, hkChangeLimit);
		this._compCpy._addHook("state", this._propMax, hkChangeLimit);
		this._compCpy._addHook("state", this._propCurMin, hkChangeValue);
		if (!this._isSingle) this._compCpy._addHook("state", this._propCurMax, hkChangeValue);

		hkChangeLimit();
		// endregion

		const wrp = e_({
			tag: "div",
			clazz: "ve-flex-col w-100 ui-slidr__wrp",
			children: [
				wrpTop,
				wrpBottom,
			],
		});

		return this._cacheRendered = wrp;
	}

	destroy () {
		this.constructor._ALL_SLIDERS.delete(this);
		if (this._cacheRendered) this._cacheRendered.remove();
	}

	_getDispValue ({isVisible, side}) {
		return e_({
			tag: "div",
			clazz: `overflow-hidden ui-slidr__disp-value no-shrink no-grow ve-flex-vh-center bold no-select ${isVisible ? `ui-slidr__disp-value--visible` : ""} ui-slidr__disp-value--${side}`,
		});
	}

	_getSpcSingleValue () {
		return e_({
			tag: "div",
			clazz: `px-2`,
		});
	}

	_getThumb () {
		const thumb = e_({
			tag: "div",
			clazz: "ui-slidr__thumb absolute clickable",
			mousedown: evt => this._handleMouseDown(evt, thumb),
		}).attr("draggable", true);

		return thumb;
	}

	_getWrpPip ({isMajor, value} = {}) {
		const style = this._getWrpPip_getStyle({value});

		const pip = e_({
			tag: "div",
			clazz: `ui-slidr__pip ${isMajor ? `ui-slidr__pip--major` : `absolute`}`,
		});

		const dispLabel = e_({
			tag: "div",
			clazz: "absolute ui-slidr__pip-label ve-flex-vh-center ve-small no-wrap",
			html: isMajor ? this._fnDisplay ? `${this._fnDisplay(value)}`.qq() : value : "",
			title: isMajor && this._fnDisplayTooltip ? `${this._fnDisplayTooltip(value)}`.qq() : null,
		});

		return e_({
			tag: "div",
			clazz: "ve-flex-col ve-flex-vh-center absolute no-select",
			children: [
				pip,
				dispLabel,
			],
			style,
		});
	}

	_getWrpPip_getStyle ({value}) {
		return `left: ${this._getLeftPositionPercentage({value})}%`;
	}

	_getLeftPositionPercentage ({value}) {
		if (this._sparseValues) {
			const ix = this._sparseValues.sort(SortUtil.ascSort).indexOf(value);
			if (!~ix) throw new Error(`Value "${value}" was not in the list of sparse values!`);
			return (ix / (this._sparseValues.length - 1)) * 100;
		}

		const min = this._compCpy._state[this._propMin]; const max = this._compCpy._state[this._propMax];
		return ((value - min) / (max - min)) * 100;
	}

	/**
	 * Convert pixel-space to track-space.
	 * Example usage:
	 * ```
	 * click: evt => {
	 *   const {x: trackOriginX, width: trackWidth} = this._dispTrackOuter.getBoundingClientRect();
	 *   const value = this._getRelativeValue(evt, {trackOriginX, trackWidth});
	 *   this._handleClick(evt, value);
	 * }
	 * ```
	 */
	_getRelativeValue (evt, {trackOriginX, trackWidth}) {
		const xEvt = EventUtil.getClientX(evt) - trackOriginX;

		if (this._sparseValues) {
			const ixMax = this._sparseValues.length - 1;
			const rawVal = Math.round((xEvt / trackWidth) * ixMax);
			return this._sparseValues[Math.min(ixMax, Math.max(0, rawVal))];
		}

		const min = this._compCpy._state[this._propMin]; const max = this._compCpy._state[this._propMax];

		const rawVal = min
			+ Math.round(
				(xEvt / trackWidth) * (max - min),
			);

		return Math.min(max, Math.max(min, rawVal)); // Clamp eet
	}

	_getClosestThumb (evt) {
		if (this._isSingle) return this._thumbLow;

		const {x: trackOriginX, width: trackWidth} = this._dispTrackOuter.getBoundingClientRect();
		const value = this._getRelativeValue(evt, {trackOriginX, trackWidth});

		if (value < this._compCpy._state[this._propCurMin]) return this._thumbLow;
		if (value > this._compCpy._state[this._propCurMax]) return this._thumbHigh;

		const {distToMin, distToMax} = this._getDistsToCurrentMinAndMax(value);
		if (distToMax < distToMin) return this._thumbHigh;
		return this._thumbLow;
	}

	_getDistsToCurrentMinAndMax (value) {
		if (this._isSingle) throw new Error(`Can not get distance to max value for singleton slider!`);

		// Move the closest slider to this pip's location
		const distToMin = Math.abs(this._compCpy._state[this._propCurMin] - value);
		const distToMax = Math.abs(this._compCpy._state[this._propCurMax] - value);
		return {distToMin, distToMax};
	}

	_handleClick (evt, value) {
		evt.stopPropagation();
		evt.preventDefault();

		// If lower than the lowest value, set the low value
		if (value < this._compCpy._state[this._propCurMin]) this._compCpy._state[this._propCurMin] = value;

		// If higher than the highest value, set the high value
		if (value > this._compCpy._state[this._propCurMax]) this._compCpy._state[this._propCurMax] = value;

		// Move the closest slider to this pip's location
		const {distToMin, distToMax} = this._getDistsToCurrentMinAndMax(value);

		if (distToMax < distToMin) this._compCpy._state[this._propCurMax] = value;
		else this._compCpy._state[this._propCurMin] = value;
	}

	_handleMouseDown (evt, thumb) {
		evt.preventDefault();
		evt.stopPropagation();

		// region Set drag metadata
		const {x: trackOriginX, width: trackWidth} = this._dispTrackOuter.getBoundingClientRect();

		thumb.addClass(`ui-slidr__thumb--hover`);

		this._dragMeta = {
			trackOriginX,
			trackWidth,
			thumb,
		};
		// endregion

		this._handleMouseMove(evt);
	}

	_handleMouseUp () {
		const wasActive = this._doDragCleanup();

		// On finishing a slide, push our state to the parent comp
		if (wasActive) {
			const nxtState = {
				[this._propMin]: this._compCpy._state[this._propMin],
				[this._propMax]: this._compCpy._state[this._propMax],
				[this._propCurMin]: this._compCpy._state[this._propCurMin],
			};
			if (!this._isSingle) nxtState[this._propCurMax] = this._compCpy._state[this._propCurMax];

			this._comp._proxyAssignSimple("state", nxtState);
		}
	}

	_handleMouseMove (evt) {
		if (!this._dragMeta) return;

		const val = this._getRelativeValue(evt, this._dragMeta);

		if (this._dragMeta.thumb === this._thumbLow) {
			if (val > this._compCpy._state[this._propCurMax]) return;
			this._compCpy._state[this._propCurMin] = val;
		} else if (this._dragMeta.thumb === this._thumbHigh) {
			if (val < this._compCpy._state[this._propCurMin]) return;
			this._compCpy._state[this._propCurMax] = val;
		}
	}

	_doDragCleanup () {
		const isActive = this._dragMeta != null;

		if (this._dragMeta?.thumb) this._dragMeta.thumb.removeClass(`ui-slidr__thumb--hover`);

		this._dragMeta = null;

		return isActive;
	}

	static _init () {
		if (this._isInit) return;
		document.addEventListener("mousemove", evt => {
			for (const slider of this._ALL_SLIDERS) {
				slider._handleMouseMove(evt);
			}
		});

		document.addEventListener("mouseup", evt => {
			for (const slider of this._ALL_SLIDERS) {
				slider._handleMouseUp(evt);
			}
		});
	}
};
ComponentUiUtil.RangeSlider._isInit = false;
ComponentUiUtil.RangeSlider._ALL_SLIDERS = new Set();
ComponentUiUtil.RangeSlider._W_THUMB_PX = 16;
ComponentUiUtil.RangeSlider._W_LABEL_PX = 24;
ComponentUiUtil.RangeSlider._MAX_PIPS = 40;

class SettingsUtil {
	static Setting = class {
		constructor (
			{
				type,
				name,
				help,
				defaultVal,
			},
		) {
			this.type = type;
			this.name = name;
			this.help = help;
			this.defaultVal = defaultVal;
		}
	};

	static EnumSetting = class extends SettingsUtil.Setting {
		constructor (
			{
				enumVals,
				...rest
			},
		) {
			super(rest);
			this.enumVals = enumVals;
		}
	};

	static getDefaultSettings (settings) {
		return Object.entries(settings)
			.mergeMap(([prop, {defaultVal}]) => ({[prop]: defaultVal}));
	}
}

globalThis.ProxyBase = ProxyBase;
globalThis.UiUtil = UiUtil;
globalThis.ListUiUtil = ListUiUtil;
globalThis.ProfUiUtil = ProfUiUtil;
globalThis.TabUiUtil = TabUiUtil;
globalThis.SearchUiUtil = SearchUiUtil;
globalThis.SearchWidget = SearchWidget;
globalThis.InputUiUtil = InputUiUtil;
globalThis.DragReorderUiUtil = DragReorderUiUtil;
globalThis.SourceUiUtil = SourceUiUtil;
globalThis.BaseComponent = BaseComponent;
globalThis.ComponentUiUtil = ComponentUiUtil;
globalThis.RenderableCollectionBase = RenderableCollectionBase;
