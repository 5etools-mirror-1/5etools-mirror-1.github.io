"use strict";

class StyleSwitcher {
	constructor () {
		this.currentStylesheet = StyleSwitcher._STYLE_DAY;

		// If the user has never manually specified a style, always load the default from their OS
		const isManualMode = StyleSwitcher.storage.getItem(StyleSwitcher._STORAGE_IS_MANUAL_MODE);
		if (isManualMode) {
			this._setActiveDayNight(StyleSwitcher.storage.getItem(StyleSwitcher._STORAGE_DAY_NIGHT) || StyleSwitcher._getDefaultStyleDayNight());
		} else {
			this._setActiveDayNight(StyleSwitcher._getDefaultStyleDayNight());
		}

		this._setActiveWide(StyleSwitcher.storage.getItem(StyleSwitcher._STORAGE_WIDE) === "true");
	}

	static _setButtonText (btnClassName, text) {
		[...document.getElementsByClassName(btnClassName)].forEach(ele => ele.innerHTML = text);
	}

	// region Night Mode
	_setActiveDayNight (style) {
		this.currentStylesheet = style;

		switch (style) {
			case StyleSwitcher._STYLE_DAY: {
				document.documentElement.classList.remove(StyleSwitcher._NIGHT_CLASS);
				document.documentElement.classList.remove(StyleSwitcher._NIGHT_CLASS_ALT);
				break;
			}
			case StyleSwitcher._STYLE_NIGHT: {
				document.documentElement.classList.add(StyleSwitcher._NIGHT_CLASS);
				document.documentElement.classList.remove(StyleSwitcher._NIGHT_CLASS_ALT);
				break;
			}
			case StyleSwitcher._STYLE_NIGHT_ALT: {
				document.documentElement.classList.add(StyleSwitcher._NIGHT_CLASS);
				document.documentElement.classList.add(StyleSwitcher._NIGHT_CLASS_ALT);
				break;
			}
		}

		StyleSwitcher._setButtonText("nightModeToggle", this.getDayNightButtonText(style));

		StyleSwitcher.storage.setItem(StyleSwitcher._STORAGE_DAY_NIGHT, this.currentStylesheet);
	}

	getDayNightClassNames () {
		switch (this.currentStylesheet) {
			case StyleSwitcher._STYLE_DAY: return "";
			case StyleSwitcher._STYLE_NIGHT: return StyleSwitcher._NIGHT_CLASS;
			case StyleSwitcher._STYLE_NIGHT_ALT: return [StyleSwitcher._NIGHT_CLASS, StyleSwitcher._NIGHT_CLASS_ALT].join(" ");
		}
	}

	getDayNightButtonText () {
		switch (this.currentStylesheet) {
			case StyleSwitcher._STYLE_NIGHT_ALT: return "Day Mode";
			case StyleSwitcher._STYLE_DAY: return "Night Mode";
			case StyleSwitcher._STYLE_NIGHT: return "Night Mode (Alt)";
		}
	}

	static _getDefaultStyleDayNight () {
		if (window.matchMedia("(prefers-color-scheme: dark)").matches) return StyleSwitcher._STYLE_NIGHT;
		return StyleSwitcher._STYLE_DAY;
	}

	cycleDayNightMode (direction) {
		const newStyle = direction === -1
			? this.currentStylesheet === StyleSwitcher._STYLE_DAY ? StyleSwitcher._STYLE_NIGHT_ALT : this.currentStylesheet === StyleSwitcher._STYLE_NIGHT ? StyleSwitcher._STYLE_DAY : StyleSwitcher._STYLE_NIGHT
			: this.currentStylesheet === StyleSwitcher._STYLE_DAY ? StyleSwitcher._STYLE_NIGHT : this.currentStylesheet === StyleSwitcher._STYLE_NIGHT ? StyleSwitcher._STYLE_NIGHT_ALT : StyleSwitcher._STYLE_DAY;
		this._setActiveDayNight(newStyle);
		StyleSwitcher.storage.setItem(StyleSwitcher._STORAGE_IS_MANUAL_MODE, true);
	}
	// endregion

	// region Wide Mode
	_setActiveWide (isActive) {
		const existing = document.getElementById(StyleSwitcher._WIDE_ID);
		if (!isActive) {
			document.documentElement.classList.remove(StyleSwitcher._WIDE_ID);
			if (existing) existing.parentNode.removeChild(existing);
		} else {
			document.documentElement.classList.add(StyleSwitcher._WIDE_ID);
			if (!existing) {
				const eleScript = document.createElement(`style`);
				eleScript.id = StyleSwitcher._WIDE_ID;
				eleScript.innerHTML = `
				/* region Book/Adventure pages */
				@media only screen and (min-width: 1600px) {
					#listcontainer.book-contents {
						position: relative;
					}

					.book-contents .contents {
						position: sticky;
					}
				}
				/* endregion */

				/* region Overwrite Bootstrap containers */
				@media (min-width: 768px) {
					.container {
						width: 100%;
					}
				}

				@media (min-width: 992px) {
					.container {
						width: 100%;
					}
				}

				@media (min-width: 1200px) {
					.container {
						width: 100%;
					}
				}
				/* endregion */`;
				document.documentElement.appendChild(eleScript);
			}
		}
		StyleSwitcher._setButtonText("wideModeToggle", isActive ? "Disable Wide Mode" : "Enable Wide Mode (Experimental)");
		StyleSwitcher.storage.setItem(StyleSwitcher._STORAGE_WIDE, isActive);
	}

	toggleWide () {
		if (this.getActiveWide()) this._setActiveWide(false);
		else this._setActiveWide(true);
	}

	getActiveWide () { return document.getElementById(StyleSwitcher._WIDE_ID) != null; }
	// endregion
}
StyleSwitcher._STORAGE_DAY_NIGHT = "StyleSwitcher_style";
StyleSwitcher._STORAGE_IS_MANUAL_MODE = "StyleSwitcher_style-is-manual-mode";
StyleSwitcher._STORAGE_WIDE = "StyleSwitcher_style-wide";
StyleSwitcher._STYLE_DAY = "day";
StyleSwitcher._STYLE_NIGHT = "night";
StyleSwitcher._STYLE_NIGHT_ALT = "nightAlt";
StyleSwitcher._NIGHT_CLASS = "night-mode";
StyleSwitcher._NIGHT_CLASS_ALT = "night-mode--alt";
StyleSwitcher._WIDE_ID = "style-switch__wide";

try {
	StyleSwitcher.storage = window.localStorage;
} catch (e) { // cookies are disabled
	StyleSwitcher.storage = {
		getItem () {
			return StyleSwitcher._STYLE_DAY;
		},

		setItem (k, v) {},
	};
}

const styleSwitcher = new StyleSwitcher();
