"use strict";

window.addEventListener("load", () => {
	ExcludeUtil.pInitialise(); // don't await, as this is only used for search

	const view = new InitiativeTrackerPlayerMessageHandlerPage();

	const $iptPlayerName = $(`#initp__ipt_player_name`)
		.change(() => $iptServerToken.removeClass("form-control--error"))
		.disableSpellcheck();

	const $iptServerToken = $(`#initp__ipt_server_token`)
		.change(() => $iptPlayerName.removeClass("form-control--error"))
		.disableSpellcheck();

	$iptServerToken.val(window.location.hash.slice(1));
	Hist.replaceHistoryHash("");

	const $btnConnect = $(`#initp__btn_connect`)
		.click(async () => {
			if (!$iptPlayerName.val().trim()) return $iptPlayerName.addClass("form-control--error");
			if (!$iptServerToken.val().trim()) return $iptServerToken.addClass("form-control--error");

			try {
				$btnConnect.attr("disabled", true);
				const ui = new InitiativeTrackerPlayerUi(view, $iptPlayerName.val(), $iptServerToken.val());
				await ui.pInit();
				InitiativeTrackerPlayerMessageHandlerPage.initUnloadMessage();
				view.initUi();
			} catch (e) {
				$btnConnect.attr("disabled", false);
				throw e;
			}
		});

	const $body = $(`body`);
	$body.on("keypress", (evt) => {
		if (EventUtil.getKeyIgnoreCapsLock(evt) === "f" && EventUtil.noModifierKeys(evt) && !EventUtil.isInInput(evt)) {
			evt.preventDefault();

			if (view.isActive) $body.toggleClass("is-fullscreen");
		}
	});

	window.dispatchEvent(new Event("toolsLoaded"));
});

class InitiativeTrackerPlayerMessageHandlerPage extends InitiativeTrackerPlayerMessageHandler {
	constructor () {
		super(false);
	}

	initUi () {
		if (this._isUiInit) return;

		this._isUiInit = true;
		$(`.initp__initial`).remove();
		$(`.initp__wrp_active`).show();

		this._$meta = $(`.initp__meta`);
		this._$head = $(`.initp__header`);
		this._$rows = $(`.initp__rows`);
	}

	static initUnloadMessage () {
		$(window).on("beforeunload", evt => {
			const message = `The connection will be closed`;
			(evt || window.event).message = message;
			return message;
		});
	}
}
