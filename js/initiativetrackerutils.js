"use strict";
class InitiativeTrackerUtil {
	static getWoundLevel (pctHp) {
		pctHp = Math.round(Math.max(Math.min(pctHp, 100), 0));
		if (pctHp === 100) return 0; // healthy
		if (pctHp > 50) return 1; // injured
		if (pctHp > 0) return 2; // bloody
		if (pctHp === 0) return 3; // defeated
		return -1; // unknown
	}

	static getWoundMeta (woundLevel) { return InitiativeTrackerUtil._WOUND_META[woundLevel] || InitiativeTrackerUtil._WOUND_META[-1]; }

	/**
	 * @param opts Options, which include:
	 *   `name` Condition name.
	 *   `color` Condition color.
	 *   `turns` Condition duration in turns.
	 *   `onStateChange` Function to be called on state change.
	 *   `readonly` If the marker is read-only.
	 *   `width` Width of the marker.
	 *   `height` Height of the marker.
	 * @return {JQuery} A condition marker.
	 */
	static get$condition (opts) {
		const fnOnStateChange = opts.onStateChange;

		const state = {
			name: opts.name,
			color: opts.color,
			turns: opts.turns ? Number(opts.turns) : null,
		};

		const tickDown = (fromClick) => {
			if (opts.readonly) return;
			if (fromClick && state.turns == null) doRemove(); // remove permanent conditions
			if (state.turns == null) return fnOnStateChange && fnOnStateChange();
			else state.turns--;
			if (state.turns <= 0) doRemove();
			else doRender();
			fnOnStateChange && fnOnStateChange();
		};

		const tickUp = (fromClick) => {
			if (opts.readonly) return;
			if (fromClick && state.turns == null) state.turns = 0; // convert permanent condition
			if (state.turns == null) return fnOnStateChange && fnOnStateChange();
			else state.turns++;
			doRender();
			fnOnStateChange && fnOnStateChange();
		};

		const doRemove = () => $cond.remove();

		const doRender = () => {
			const turnsText = `${state.turns} turn${state.turns > 1 ? "s" : ""} remaining`;
			const ttpText = state.name && state.turns ? `${state.name.escapeQuotes()} (${turnsText})` : state.name ? state.name.escapeQuotes() : state.turns ? turnsText : "";
			const getBar = () => {
				const styleStack = [
					state.turns == null || state.turns > 3
						? `background-image: linear-gradient(135deg, ${state.color} 41.67%, transparent 41.67%, transparent 50%, ${state.color} 50%, ${state.color} 91.67%, transparent 91.67%, transparent 100%); background-size: 8.49px 8.49px;`
						: `background: ${state.color};`,
				];
				if (opts.width) styleStack.push(`width: ${opts.width}px;`);
				return `<div class="init__cond_bar" style="${styleStack.join(" ")}"/>`;
			};

			const inner = state.turns
				? [...new Array(Math.min(state.turns, 3))].map(() => getBar()).join("")
				: getBar();

			$cond.title(ttpText);

			$cond.html(inner);
			fnOnStateChange && fnOnStateChange();
		};

		const styleStack = [];
		if (opts.width) styleStack.push(`width: ${opts.width}px;`);
		if (opts.height) styleStack.push(`height: ${opts.height}px;`);

		const $cond = $$`<div class="init__cond relative" ${styleStack.length ? `style="${styleStack.join(" ")}"` : ""}></div>`
			.data("doTickDown", tickDown)
			.data("getState", () => JSON.parse(JSON.stringify(state)))
			.on("contextmenu", (e) => e.preventDefault() || tickDown(true))
			.click(() => tickUp(true));

		if (opts.name) {
			const cond = InitiativeTrackerUtil.CONDITIONS.find(it => it.condName !== null && it.name.toLowerCase() === opts.name.toLowerCase().trim());
			if (cond) {
				const ele = $cond[0];
				$cond.on("mouseover", (evt) => {
					if (evt.shiftKey) {
						evt.shiftKey = false;
						const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CONDITIONS_DISEASES]({name: cond.condName || cond.name, source: SRC_PHB});
						Renderer.hover.pHandleLinkMouseOver(evt, ele, {page: UrlUtil.PG_CONDITIONS_DISEASES, source: SRC_PHB, hash});
					}
				});
				$cond.on("mousemove", (evt) => Renderer.hover.handleLinkMouseMove(evt, ele));
				$cond.on("mouseleave", (evt) => Renderer.hover.handleLinkMouseLeave(evt, ele));
			}
		}

		doRender();

		return $cond;
	}
}
InitiativeTrackerUtil._WOUND_META = {
	[-1]: {
		text: "Unknown",
		color: "#a5a5a5",
	},
	0: {
		text: "Healthy",
		color: MiscUtil.COLOR_HEALTHY,
	},
	1: {
		text: "Hurt",
		color: MiscUtil.COLOR_HURT,
	},
	2: {
		text: "Bloodied",
		color: MiscUtil.COLOR_BLOODIED,
	},
	3: {
		text: "Defeated",
		color: MiscUtil.COLOR_DEFEATED,
	},
};

InitiativeTrackerUtil.CONDITIONS = [
	...Object.keys(Parser.CONDITION_TO_COLOR).map(k => ({
		name: k,
		color: Parser.CONDITION_TO_COLOR[k],
	})),
	{
		name: "Drunk",
		color: "#ffcc00",
		condName: null,
	},
	{
		name: "!!On Fire!!",
		color: "#ff6800",
		condName: null,
	},
].sort((a, b) => SortUtil.ascSortLower(a.name.replace(/\W+/g, ""), b.name.replace(/\W+/g, "")));

class InitiativeTrackerPlayerUi {
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

class InitiativeTrackerPlayerMessageHandler {
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
		this.initUi();
		const data = msg.data || {};

		this._$meta.empty();
		this._$head.empty();
		this._$rows.empty();

		if (data.n) {
			this._$meta.append(`
				<div class="${this._isCompact ? "flex-vh-center" : "flex-v-center"}${this._isCompact ? " mb-3" : ""}">
					<div class="mr-2">Round: </div>
					<div class="bold">${data.n}</div>
				</div>
			`);
		}

		this._$head.append(`
			<div class="initp__h_name${this._isCompact ? " initp__h_name--compact" : ""}">Creature/Status</div>
			<div class="initp__h_hp${this._isCompact ? " initp__h_hp--compact" : ""}">Health</div>
			${(data.c || []).map(statCol => `<div class="initp__h_stat">${statCol.a || ""}</div>`).join("")}
			<div class="initp__h_score${this._isCompact ? " initp__h_score--compact" : ""}">${this._isCompact ? "#" : "Init."}</div>
		`);

		(data.r || []).forEach(rowData => {
			this._$rows.append(this._get$row(rowData));
		});
	}

	_get$row (rowData) {
		const $conds = $(`<div class="init__wrp_conds"/>`);
		(rowData.c || []).forEach(cond => {
			const opts = {
				...cond,
				readonly: true,
			};
			if (!this._isCompact) {
				opts.width = 24;
				opts.height = 24;
			}
			InitiativeTrackerUtil.get$condition(opts).appendTo($conds);
		});

		const getHpContent = () => {
			if (rowData.hh != null) {
				const {text, color} = InitiativeTrackerUtil.getWoundMeta(rowData.hh);
				return {hpText: text, hpColor: color};
			} else {
				const woundLevel = InitiativeTrackerUtil.getWoundLevel(100 * Number(rowData.h) / Number(rowData.g));
				return {hpText: `${rowData.h == null ? "?" : rowData.h}/${rowData.g == null ? "?" : rowData.g}`, hpColor: InitiativeTrackerUtil.getWoundMeta(woundLevel).color};
			}
		};
		const {hpText, hpColor} = getHpContent();

		const $namePart = $(`<div/>`).text(`${(rowData.m || rowData.n || "")}${rowData.o != null ? ` (${rowData.o})` : ""}`);

		return $$`
			<div class="initp__r${rowData.a ? ` initp__r--active` : ""}">
				<div class="initp__r_name">
					${$namePart}
					${$conds}
				</div>
				<div class="initp__r_hp">
					<div class="initp__r_hp_pill" style="background: ${hpColor};">${hpText}</div>
				</div>
				${(rowData.k || []).map(statVal => `<div class="initp__r_stat flex-vh-center">
					${statVal.u ? "?" : statVal.v === true ? `<span class="text-success glyphicon glyphicon-ok"/>` : statVal.v === false ? `<span class="text-danger glyphicon glyphicon-remove"/>` : statVal.v}
				</div>`).join("")}
				<div class="initp__r_score${this._isCompact ? " initp__r_score--compact" : ""}">${rowData.i}</div>
			</div>
		`;
	}
}
