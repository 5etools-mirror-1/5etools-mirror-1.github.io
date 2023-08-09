import {InitiativeTrackerUtil, RenderableCollectionConditions} from "./initiativetracker-utils.js";

export class InitiativeTrackerPlayerUiV1 {
	constructor (view, playerName, serverToken) {
		this._view = view;
		this._playerName = playerName;
		this._serverToken = serverToken;
		this._clientPeer = new PeerVeClient();
	}

	async pInit () {
		try {
			await this._clientPeer.pConnectToServer(
				this._serverToken,
				data => this._view.handleMessage(data),
				{
					label: this._playerName,
					serialization: "json",
				},
			);
		} catch (e) {
			JqueryUtil.doToast({
				content: `Failed to create client! Are you sure the token was valid? (See the log for more details.)`,
				type: "danger",
			});
			throw e;
		}
	}
}

export class InitiativeTrackerPlayerUiV0 {
	constructor (view, $iptServerToken, $btnGenClientToken, $iptClientToken) {
		this._view = view;
		this._$iptServerToken = $iptServerToken;
		this._$btnGenClientToken = $btnGenClientToken;
		this._$iptClientToken = $iptClientToken;
	}

	init () {
		this._$iptServerToken.keydown(evt => {
			this._$iptServerToken.removeClass("error-background");
			if (evt.which === 13) this._$btnGenClientToken.click();
		});

		this._$btnGenClientToken.click(async () => {
			this._$iptServerToken.removeClass("error-background");
			const serverToken = this._$iptServerToken.val();

			if (PeerUtilV0.isValidToken(serverToken)) {
				try {
					this._$iptServerToken.attr("disabled", true);
					this._$btnGenClientToken.attr("disabled", true);
					const clientData = await PeerUtilV0.pInitialiseClient(
						serverToken,
						msg => this._view.handleMessage(msg),
						function (err) {
							if (!this.isClosed) {
								JqueryUtil.doToast({
									content: `Server error:\n${err ? err.message || err : "(Unknown error)"}`,
									type: "danger",
								});
							}
						},
					);

					if (!clientData) {
						this._$iptServerToken.attr("disabled", false);
						this._$btnGenClientToken.attr("disabled", false);
						JqueryUtil.doToast({
							content: `Failed to create client. Are you sure the token was valid?`,
							type: "warning",
						});
					} else {
						this._view.clientData = clientData;

						// -- This has no effect; the client doesn't error on sending when there's no connection --
						// const livenessCheck = setInterval(async () => {
						// 	try {
						// 		await clientData.client.sendMessage({})
						// 	} catch (e) {
						// 		JqueryUtil.doToast({
						// 			content: `Could not reach server! You might need to reconnect.`,
						// 			type: "danger"
						// 		});
						// 		clearInterval(livenessCheck);
						// 	}
						// }, 5000);

						this._$iptClientToken.val(clientData.textifiedSdp).attr("disabled", false);
					}
				} catch (e) {
					JqueryUtil.doToast({
						content: `Failed to create client! Are you sure the token was valid? (See the log for more details.)`,
						type: "danger",
					});
					setTimeout(() => { throw e; });
				}
			} else this._$iptServerToken.addClass("error-background");
		});

		this._$iptClientToken.click(async () => {
			await MiscUtil.pCopyTextToClipboard(this._$iptClientToken.val());
			JqueryUtil.showCopiedEffect(this._$iptClientToken);
		});
	}
}

export class InitiativeTrackerPlayerMessageHandlerV1 {
	constructor (isCompact) {
		this._isCompact = isCompact;
		this._isUiInit = false;

		this._$meta = null;
		this._$head = null;
		this._$rows = null;
	}

	get isActive () { return this._isUiInit; }

	setElements ($meta, $head, $rows) {
		this._$meta = $meta;
		this._$head = $head;
		this._$rows = $rows;
	}

	initUi () {} // to be overridden as required

	handleMessage (msg) {
		const {data: {type, payload}} = msg;

		switch (type) {
			case "state": return this._handleMessage_state({payload: payload});
			case "showImage": return this._handleMessage_showImage({payload: payload});

			default: throw new Error(`Unhandled message type "${type}"!`);
		}
	}

	/* -------------------------------------------- */

	_handleMessage_state ({payload}) {
		this.initUi();

		const data = payload || {};

		this._$meta.empty();
		this._$head.empty();
		this._$rows.empty();

		if (data.round) {
			this._$meta.append(`
				<div class="${this._isCompact ? "ve-flex-vh-center" : "ve-flex-v-center"}${this._isCompact ? " mb-3" : ""}">
					<div class="mr-2">Round: </div>
					<div class="bold">${data.round}</div>
				</div>
			`);
		}

		this._$head.append(`
			<div class="w-100 split-v-center min-w-100p ${this._isCompact ? "ve-text-center" : ""}">Creature/Status</div>
			<div class="min-w-100p ${this._isCompact ? "ve-text-center" : ""}">Health</div>
			${(data.statsCols || []).map(statCol => `<div class="initp__h_stat">${statCol.abbreviation || ""}</div>`).join("")}
			<div class="initp__h_score${this._isCompact ? " initp__h_score--compact" : ""}">${this._isCompact ? "#" : "Init."}</div>
		`);

		(data.rows || []).forEach(rowData => {
			this._$rows.append(this._$getRow(rowData));
		});
	}

	_$getRow (rowData) {
		const comp = BaseComponent.fromObject(
			{
				conditions: rowData.conditions || [],
			},
			"*",
		);

		const $wrpConds = $$`<div class="init__wrp_conds h-100"></div>`;

		const collectionConditions = new RenderableCollectionConditions({
			comp: comp,
			isReadOnly: true,
			barWidth: !this._isCompact ? 24 : null,
			barHeight: !this._isCompact ? 24 : null,
			$wrpRows: $wrpConds,
		});
		collectionConditions.render();

		const getHpContent = () => {
			if (rowData.hpWoundLevel != null) {
				const {text, color} = InitiativeTrackerUtil.getWoundMeta(rowData.hpWoundLevel);
				return {hpText: text, hpColor: color};
			} else {
				const woundLevel = InitiativeTrackerUtil.getWoundLevel(100 * Number(rowData.hpCurrent) / Number(rowData.hpMax));
				return {hpText: `${rowData.hpCurrent == null ? "?" : rowData.hpCurrent}/${rowData.hpMax == null ? "?" : rowData.hpMax}`, hpColor: InitiativeTrackerUtil.getWoundMeta(woundLevel).color};
			}
		};
		const {hpText, hpColor} = getHpContent();

		const $dispName = $(`<div></div>`).text(`${(rowData.customName || rowData.name || "")}${rowData.ordinal != null ? ` (${rowData.ordinal})` : ""}`);

		return $$`
			<div class="initp__r${rowData.isActive ? ` initp__r--active` : ""}">
				<div class="w-100 split-v-center min-w-100p">
					${$dispName}
					${$wrpConds}
				</div>
				<div class="min-w-100p">
					<div class="initp__r_hp_pill" style="background: ${hpColor};">${hpText}</div>
				</div>
				${this._$getRenderedStatsCells({rowData})}
				<div class="initp__r_score${this._isCompact ? " initp__r_score--compact" : ""}">${rowData.initiative}</div>
			</div>
		`;
	}

	_$getRenderedStatsCells ({rowData}) {
		return (rowData.rowStatColData || [])
			.map(cell => {
				return $$`<div class="initp__r_stat ve-flex-vh-center">
				 	${this._$getRenderedStatsCellInner({cell})}
			 	</div>`;
			});
	}

	_$getRenderedStatsCellInner ({cell}) {
		const {isUnknown, value, type} = cell.entity;

		if (isUnknown) return `<span class="ve-muted italic" title="This value is hidden!">?</span>`;

		if (type) {
			switch (type) {
				case "image": return this._$getRenderedStatsCellInner_image({cell});

				default: {
					setTimeout(() => { throw new Error(`Unknown type "${type}"!`); });
					return `<span title="Bug!">🐛</span>`;
				}
			}
		}

		if (value == null) return `<span>\u2012</span>`;

		switch (typeof value) {
			case "boolean": return value === true ? `<span class="text-success glyphicon glyphicon-ok"></span>` : `<span class="text-danger glyphicon glyphicon-remove"></span>`;
			case "number":
			case "string": return value;

			default: {
				setTimeout(() => { throw new Error(`Unhandled value "${value}"!`); });
				return `<span title="Bug!">🐛</span>`;
			}
		}
	}

	_$getRenderedStatsCellInner_image ({cell}) {
		const {tokenUrl, imageHref} = cell.entity;

		const hoverMeta = Renderer.monster.hover.getMakePredefinedFluffImageHoverHasImage({
			imageHref: InitiativeTrackerUtil.getImageOrTokenHref({imageHref, tokenUrl}),
		});

		const $ele = $(`<img src="${tokenUrl}" class="w-24p w-24p" alt="Token Image">`)
			.on("mouseover", evt => hoverMeta.mouseOver(evt, $ele[0]))
			.on("mousemove", evt => hoverMeta.mouseMove(evt, $ele[0]))
			.on("mouseleave", evt => hoverMeta.mouseLeave(evt, $ele[0]));

		return $ele;
	}

	/* -------------------------------------------- */

	_handleMessage_showImage ({payload}) {
		const {imageHref} = payload;

		const hoverMeta = Renderer.monster.hover.getMakePredefinedFluffImageHoverHasImage({imageHref});
		hoverMeta.show();
	}
}

export class InitiativeTrackerPlayerMessageHandlerV0 extends InitiativeTrackerPlayerMessageHandlerV1 {
	constructor (...args) {
		super(...args);

		this._clientData = null;
	}

	set clientData (clientData) { this._clientData = clientData; }
}
