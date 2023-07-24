import {PANEL_TYP_INITIATIVE_TRACKER} from "./dmscreen-consts.js";
import {
	InitiativeTrackerPlayerMessageHandlerV0,
	InitiativeTrackerPlayerMessageHandlerV1,
	InitiativeTrackerPlayerUiV0,
	InitiativeTrackerPlayerUiV1,
} from "../initiativetracker/initiativetracker-player.js";
import {DmScreenUtil} from "./dmscreen-util.js";

// region v1
export class InitiativeTrackerPlayerV1 {
	static $getPanelElement (board, state) {
		const $meta = $(`<div class="initp__meta"/>`).hide();
		const $head = $(`<div class="initp__header"/>`).hide();
		const $rows = $(`<div class="ve-flex-col"></div>`).hide();

		const $wrpTracker = $$`<div class="initp__wrp_active">
			${$meta}
			${$head}
			${$rows}
		</div>`;

		const view = new InitiativeTrackerPlayerMessageHandlerScreenV1();
		view.setElements($meta, $head, $rows);

		let ui;
		const $btnConnectRemote = $(`<button class="btn btn-primary mb-2 min-w-200p" title="Connect to a tracker outside of this browser tab.">Connect to Remote Tracker</button>`)
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

				const $wrpClient = $$`<div class="ve-flex-col w-100">
					<div class="ve-flex-vh-center px-4 mb-2">
						<span style="min-width: fit-content;" class="mr-2">Player Name</span>
						${$iptPlayerName}
					</div>

					<div class="ve-flex-vh-center px-4 mb-2">
						<span style="min-width: fit-content;" class="mr-2">Server Token</span>
						${$iptServerToken}
					</div>

					<div class="split px-4 ve-flex-vh-center">
						${$btnGenConnect}${$btnCancel}
					</div>
				</div>`.appendTo(view.$wrpInitial);

				$btnGenConnect.click(async () => {
					if (!$iptPlayerName.val().trim()) return $iptPlayerName.addClass("form-control--error");
					if (!$iptServerToken.val().trim()) return $iptServerToken.addClass("form-control--error");

					try {
						$btnGenConnect.attr("disabled", true);

						ui = new InitiativeTrackerPlayerUiV1(view, $iptPlayerName.val(), $iptServerToken.val());
						await ui.pInit();
						InitiativeTrackerPlayerMessageHandlerScreenV1.initUnloadMessage();
					} catch (e) {
						$btnGenConnect.attr("disabled", false);
						JqueryUtil.doToast({content: `Failed to connect. ${VeCt.STR_SEE_CONSOLE}`, type: "danger"});
						setTimeout(() => { throw e; });
					}
				});
			});

		const $btnConnectLocal = $(`<button class="btn btn-primary min-w-200p">Connect to Local Tracker</button>`)
			.click(async () => {
				const $elesData = DmScreenUtil.$getPanelDataElements({board, type: PANEL_TYP_INITIATIVE_TRACKER});

				if (!$elesData.length) return JqueryUtil.doToast({content: "No local trackers detected!", type: "warning"});

				if ($elesData.length === 1) {
					try {
						const token = await $elesData[0].data("pDoConnectLocalV1")(view);
						ui = new InitiativeTrackerPlayerUiV1(view, "Local", token);
						await ui.pInit();
						InitiativeTrackerPlayerMessageHandlerScreenV1.initUnloadMessage();
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
					$elesData.forEach(($e, i) => $selTracker.append(`<option value="${i}">${$e.data("getSummary")()}</option>`));
					$selTracker.val("-1");

					const $btnOk = $(`<button class="btn btn-primary btn-xs">OK</button>`)
						.click(async () => {
							// jQuery reads the disabled value as null
							if ($selTracker.val() == null) return $selTracker.addClass("form-control--error");

							$btnOk.prop("disabled", true);

							try {
								const token = await $elesData[Number($selTracker.val())].data("pDoConnectLocalV1")(view);
								ui = new InitiativeTrackerPlayerUiV1(view, "Local", token);
								await ui.pInit();
								InitiativeTrackerPlayerMessageHandlerScreenV1.initUnloadMessage();
							} catch (e) {
								JqueryUtil.doToast({content: `Failed to connect. ${VeCt.STR_SEE_CONSOLE}`, type: "danger"});
								// restore original state
								$btnCancel.remove(); $wrpSel.remove();
								view.$wrpInitial.append($btnConnectRemote).append($btnConnectLocal);
								setTimeout(() => { throw e; });
							}
						});

					const $wrpSel = $$`<div class="ve-flex-vh-center mb-2">
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

		view.$wrpInitial = $$`<div class="ve-flex-vh-center h-100 ve-flex-col dm__panel-bg">
			${$btnConnectRemote}
			${$btnConnectLocal}
		</div>`.appendTo($wrpTracker);

		return $wrpTracker;
	}
}

class InitiativeTrackerPlayerMessageHandlerScreenV1 extends InitiativeTrackerPlayerMessageHandlerV1 {
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
// endregion

/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// region v0
export class InitiativeTrackerPlayerV0 {
	static $getPanelElement (board, state) {
		const $meta = $(`<div class="initp__meta"/>`).hide();
		const $head = $(`<div class="initp__header"/>`).hide();
		const $rows = $(`<div class="ve-flex-col"></div>`).hide();

		const $wrpTracker = $$`<div class="initp__wrp_active">
			${$meta}
			${$head}
			${$rows}
		</div>`;

		const view = new InitiativeTrackerPlayerMessageHandlerScreenV0();
		view.setElements($meta, $head, $rows);

		const $btnConnectRemote = $(`<button class="btn btn-primary mb-2 min-w-200p" title="Connect to a tracker outside of this browser tab.">Connect to Remote Tracker</button>`)
			.click(() => {
				$btnConnectRemote.detach();
				$btnConnectLocal.detach();

				const $iptServerToken = $(`<input class="form-control input-sm code">`).disableSpellcheck();
				const $btnGenClientToken = $(`<button class="btn btn-primary btn-xs">Generate Client Token</button>`);
				const $iptClientToken = $(`<input class="form-control input-sm code copyable">`).disableSpellcheck();

				const $btnCancel = $(`<button class="btn btn-default btn-xs">Back</button>`)
					.click(() => {
						// restore original state
						$wrpClient.remove();
						view.$wrpInitial.append($btnConnectRemote).append($btnConnectLocal);
					});

				const $wrpClient = $$`<div class="ve-flex-col w-100">
					<div class="ve-flex-vh-center px-4 mb-2">
						<span style="min-width: fit-content;" class="mr-2">Server Token</span>
						${$iptServerToken}
					</div>

					<div class="ve-flex-v-center ve-flex-h-right px-4 mb-2">
						${$btnGenClientToken}
					</div>

					<div class="ve-flex-vh-center px-4 mb-2">
						<span style="min-width: fit-content;" class="mr-2">Client Token</span>
						${$iptClientToken}
					</div>

					<div class="ve-flex-vh-center px-4">
						${$btnCancel}
					</div>
				</div>`.appendTo(view.$wrpInitial);

				const ui = new InitiativeTrackerPlayerUiV0(view, $iptServerToken, $btnGenClientToken, $iptClientToken);
				ui.init();
			});

		const $btnConnectLocal = $(`<button class="btn btn-primary min-w-200p" title="Connect to a tracker in this browser tab.">Connect to Local Tracker</button>`)
			.click(async () => {
				const $elesData = DmScreenUtil.$getPanelDataElements({board, type: PANEL_TYP_INITIATIVE_TRACKER});

				if ($elesData.length) {
					if ($elesData.length === 1) {
						await $elesData[0].data("pDoConnectLocalV0")(view);
					} else {
						$btnConnectRemote.detach();
						$btnConnectLocal.detach();

						const $selTracker = $(`<select class="form-control input-xs mr-1">
							<option value="-1" disabled>Select a local tracker</option>
						</select>`).change(() => $selTracker.removeClass("error-background"));
						$elesData.forEach(($e, i) => $selTracker.append(`<option value="${i}">${$e.data("getSummary")()}</option>`));
						$selTracker.val("-1");

						const $btnOk = $(`<button class="btn btn-primary btn-xs">OK</button>`)
							.click(async () => {
								if ($selTracker.val() === "-1") return $selTracker.addClass("error-background");

								await $elesData[Number($selTracker.val())].data("pDoConnectLocalV0")(view);

								// restore original state
								$btnCancel.remove(); $wrpSel.remove();
								view.$wrpInitial.append($btnConnectRemote).append($btnConnectLocal);
							});

						const $wrpSel = $$`<div class="ve-flex-vh-center mb-2">
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
				} else {
					JqueryUtil.doToast({content: "No local trackers detected!", type: "warning"});
				}
			});

		view.$wrpInitial = $$`<div class="ve-flex-vh-center h-100 ve-flex-col dm__panel-bg">
			${$btnConnectRemote}
			${$btnConnectLocal}
		</div>`.appendTo($wrpTracker);

		return $wrpTracker;
	}
}

class InitiativeTrackerPlayerMessageHandlerScreenV0 extends InitiativeTrackerPlayerMessageHandlerV0 {
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

		$(window).on("beforeunload", evt => {
			if (this._clientData.client.isActive) {
				const message = `The connection will be closed`;
				(evt || window.event).message = message;
				return message;
			}
		});
	}

	set $wrpInitial ($wrpInitial) { this._$wrpInitial = $wrpInitial; }
	get $wrpInitial () { return this._$wrpInitial; }
}
// endregion
