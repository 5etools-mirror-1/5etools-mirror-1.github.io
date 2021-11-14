"use strict";

class InitiativeTrackerPlayer {
	static make$tracker (board, state) {
		const $meta = $(`<div class="initp__meta"/>`).hide();
		const $head = $(`<div class="initp__header"/>`).hide();
		const $rows = $(`<div class="initp__rows"/>`).hide();

		const $wrpTracker = $$`<div class="initp__wrp_active">
			${$meta}
			${$head}
			${$rows}
		</div>`;

		const view = new InitiativeTrackerPlayerMessageHandlerScreen();
		view.setElements($meta, $head, $rows);

		let ui;
		const $btnConnectRemote = $(`<button class="btn btn-primary mb-2" style="min-width: 200px;" title="Connect to a tracker outside of this browser tab.">Connect to Remote Tracker</button>`)
			.click(async () => {
				$btnConnectRemote.detach();
				$btnConnectLocal.detach();

				const $iptPlayerName = $(`<input class="form-control input-sm code">`)
					.change(() => $iptPlayerName.removeClass("form-control--error"))
					.disableSpellcheck();
				const $iptServerToken = $(`<input class="form-control input-sm code">`)
					.change(() => $iptServerToken.removeClass("form-control--error"))
					.disableSpellcheck();
				const $btnGenConnect = $(`<button class="btn btn-primary btn-xs mr-2">Connect</button>`);

				const $btnCancel = $(`<button class="btn btn-default btn-xs">Back</button>`)
					.click(() => {
						// restore original state
						$wrpClient.remove();
						view.$wrpInitial.append($btnConnectRemote).append($btnConnectLocal);
					});

				const $wrpClient = $$`<div class="flex-col w-100">
					<div class="flex-vh-center px-4 mb-2">
						<span style="min-width: fit-content;" class="mr-2">Player Name</span>
						${$iptPlayerName}
					</div>

					<div class="flex-vh-center px-4 mb-2">
						<span style="min-width: fit-content;" class="mr-2">Server Token</span>
						${$iptServerToken}
					</div>

					<div class="split px-4 flex-vh-center">
						${$btnGenConnect}${$btnCancel}
					</div>
				</div>`.appendTo(view.$wrpInitial);

				$btnGenConnect.click(async () => {
					if (!$iptPlayerName.val().trim()) return $iptPlayerName.addClass("form-control--error");
					if (!$iptServerToken.val().trim()) return $iptServerToken.addClass("form-control--error");

					try {
						$btnGenConnect.attr("disabled", true);

						ui = new InitiativeTrackerPlayerUi(view, $iptPlayerName.val(), $iptServerToken.val());
						await ui.pInit();
						InitiativeTrackerPlayerMessageHandlerScreen.initUnloadMessage();
					} catch (e) {
						$btnGenConnect.attr("disabled", false);
						JqueryUtil.doToast({content: `Failed to connect. ${VeCt.STR_SEE_CONSOLE}`, type: "danger"});
						setTimeout(() => { throw e; });
					}
				});
			});

		const $btnConnectLocal = $(`<button class="btn btn-primary" style="min-width: 200px;">Connect to Local Tracker</button>`)
			.click(async () => {
				const existingTrackers = board.getPanelsByType(PANEL_TYP_INITIATIVE_TRACKER)
					.map(it => it.tabDatas.filter(td => td.type === PANEL_TYP_INITIATIVE_TRACKER).map(td => td.$content.find(`.dm__data-anchor`)))
					.flat();

				if (!existingTrackers.length) return JqueryUtil.doToast({content: "No local trackers detected!", type: "warning"});

				if (existingTrackers.length === 1) {
					try {
						const token = await existingTrackers[0].data("pDoConnectLocal")(view);
						ui = new InitiativeTrackerPlayerUi(view, "Local", token);
						await ui.pInit();
						InitiativeTrackerPlayerMessageHandlerScreen.initUnloadMessage();
					} catch (e) {
						JqueryUtil.doToast({content: `Failed to connect. ${VeCt.STR_SEE_CONSOLE}`, type: "danger"});
						setTimeout(() => { throw e; });
					}
				} else {
					$btnConnectRemote.detach();
					$btnConnectLocal.detach();

					const $selTracker = $(`<select class="form-control input-xs mr-1">
							<option value="-1" disabled>Select a local tracker</option>
						</select>`).change(() => $selTracker.removeClass("form-control--error"));
					existingTrackers.forEach(($e, i) => $selTracker.append(`<option value="${i}">${$e.data("getSummary")()}</option>`));
					$selTracker.val("-1");

					const $btnOk = $(`<button class="btn btn-primary btn-xs">OK</button>`)
						.click(async () => {
							// jQuery reads the disabled value as null
							if ($selTracker.val() == null) return $selTracker.addClass("form-control--error");

							$btnOk.prop("disabled", true);

							try {
								const token = await existingTrackers[Number($selTracker.val())].data("pDoConnectLocal")(view);
								ui = new InitiativeTrackerPlayerUi(view, "Local", token);
								await ui.pInit();
								InitiativeTrackerPlayerMessageHandlerScreen.initUnloadMessage();
							} catch (e) {
								JqueryUtil.doToast({content: `Failed to connect. ${VeCt.STR_SEE_CONSOLE}`, type: "danger"});
								// restore original state
								$btnCancel.remove(); $wrpSel.remove();
								view.$wrpInitial.append($btnConnectRemote).append($btnConnectLocal);
								setTimeout(() => { throw e; });
							}
						});

					const $wrpSel = $$`<div class="flex-vh-center mb-2">
						${$selTracker}
						${$btnOk}
					</div>`.appendTo(view.$wrpInitial);

					const $btnCancel = $(`<button class="btn btn-default btn-xs">Back</button>`)
						.click(() => {
							// restore original state
							$btnCancel.remove(); $wrpSel.remove();
							view.$wrpInitial.append($btnConnectRemote).append($btnConnectLocal);
						})
						.appendTo(view.$wrpInitial);
				}
			});

		view.$wrpInitial = $$`<div class="flex-vh-center h-100 flex-col dm__panel-bg">
			${$btnConnectRemote}
			${$btnConnectLocal}
		</div>`.appendTo($wrpTracker);

		return $wrpTracker;
	}
}

class InitiativeTrackerPlayerMessageHandlerScreen extends InitiativeTrackerPlayerMessageHandler {
	constructor () {
		super(true);

		this._$wrpInitial = null;
	}

	initUi () {
		if (this._isUiInit) return;
		this._isUiInit = true;

		this._$meta.show();
		this._$head.show();
		this._$rows.show();
		this._$wrpInitial.addClass("hidden");
	}

	set $wrpInitial ($wrpInitial) { this._$wrpInitial = $wrpInitial; }
	get $wrpInitial () { return this._$wrpInitial; }

	static initUnloadMessage () {
		$(window).on("beforeunload", evt => {
			const message = `The connection will be closed`;
			(evt || window.event).message = message;
			return message;
		});
	}
}
