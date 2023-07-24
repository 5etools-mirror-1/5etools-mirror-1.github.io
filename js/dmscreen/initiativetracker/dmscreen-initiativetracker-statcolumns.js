import {InitiativeTrackerConst} from "./dmscreen-initiativetracker-consts.js";
import {
	InitiativeTrackerRowStatsColDataSerializer,
	InitiativeTrackerStatColumnDataSerializer,
} from "./dmscreen-initiativetracker-serial.js";
import {InitiativeTrackerUtil} from "../../initiativetracker/initiativetracker-utils.js";

export const GROUP_BASE_STATS = "baseStats";
export const GROUP_SAVES = "saves";
export const GROUP_ABILITY_BONUS = "abilityBonus";
export const GROUP_ABILITY_SCORE = "abilityScore";
export const GROUP_SKILL = "skill";
export const GROUP_CHECKBOX = "checkbox";
export const GROUP_CUSTOM = "custom";

export const GROUP_DISPLAY_NAMES = {
	[GROUP_BASE_STATS]: "General",
	[GROUP_SAVES]: "Saving Throw",
	[GROUP_ABILITY_BONUS]: "Ability Bonus",
	[GROUP_ABILITY_SCORE]: "Ability Score",
	[GROUP_SKILL]: "Skill",
	[GROUP_CHECKBOX]: "Checkbox",
	[GROUP_CUSTOM]: "Custom",
};

export const IS_PLAYER_VISIBLE_NONE = 0;
export const IS_PLAYER_VISIBLE_ALL = 1;
export const IS_PLAYER_VISIBLE_PLAYER_UNITS_ONLY = 2;

export const INITIATIVE_APPLICABILITY_NOT_APPLICABLE = 0;
const _INITIATIVE_APPLICABILITY_APPLICABLE = 1;
const _INITIATIVE_APPLICABILITY_EXACT = 2;

/** @abstract */
class _InitiativeTrackerStatColumnBase {
	static _SERIALIZER_MAPPINGS = {
		"entity.value": "v",
	};

	static _registerSerializerMappings () {
		Object.entries(this._SERIALIZER_MAPPINGS)
			.forEach(([kFull, kSerial]) => InitiativeTrackerRowStatsColDataSerializer.registerMapping({kFull, kSerial, isAllowDuplicates: true}));
		return null;
	}

	static _ = this._registerSerializerMappings();

	/* -------------------------------------------- */

	/** Functions as an ID for the column type. */
	static get POPULATE_WITH () { throw new Error("Unimplemented!"); }

	/** UI group the column type belongs to. */
	static GROUP;

	static NAME;
	static ABV_DEFAULT = "";

	constructor (
		{
			id,
			isEditable,
			isPlayerVisible,
			abbreviation,
		} = {},
	) {
		this._id = id ?? CryptUtil.uid();
		this._isEditable = isEditable ?? true;
		this._isPlayerVisible = isPlayerVisible ?? false;
		this._abbreviation = abbreviation ?? this.constructor.ABV_DEFAULT;
	}

	/**
	 * @param {?object} mon
	 * @param {?object} fluff
	 * @return {?*}
	 * @abstract
	 */
	_getInitialCellObj ({mon, fluff}) { throw new Error("Unimplemented!"); }

	_getAsData () {
		return {
			id: this._id,
			isEditable: this._isEditable,
			isPlayerVisible: this._isPlayerVisible,
			populateWith: this.constructor.POPULATE_WITH,
			abbreviation: this._abbreviation,
		};
	}

	getAsStateData () {
		return this._getAsData();
	}

	getAsCollectionRowStateData () {
		const data = this._getAsData();
		const out = {
			id: data.id,
			entity: {
				...data,
			},
		};
		delete out.entity.id;
		return out;
	}

	getPlayerFriendlyState ({cell}) {
		return {id: cell.id, entity: cell.entity};
	}

	/* -------------------------------------------- */

	/**
	 * @return {?object} `undefined` if the column should not auto-set at the start of the turn, or, a value the column should
	 *         be auto-set to at the start of the turn.
	 */
	_getAutoTurnStartObject ({state, mon}) { return undefined; }

	/**
	 * @return {?object} `undefined` if the column should not auto-set at the start of the round, or, a value the column should
	 *         be auto-set to at the start of the round.
	 */
	_getAutoRoundStartObject ({state, mon}) { return undefined; }

	_isNonNegativeDirection ({direction}) {
		return ![InitiativeTrackerConst.DIR_FORWARDS, InitiativeTrackerConst.DIR_NEUTRAL].includes(direction);
	}

	onTurnStart ({state, direction, mon}) {
		if (this._isNonNegativeDirection({direction})) return;

		const obj = this._getAutoTurnStartObject({state, mon});
		if (obj !== undefined) Object.assign(state.entity, obj);
	}

	onRoundStart ({state, direction, mon}) {
		if (this._isNonNegativeDirection({direction})) return;

		const obj = this._getAutoRoundStartObject({state, mon});
		if (obj !== undefined) Object.assign(state.entity, obj);
	}

	$getRenderedHeader () {
		return $(`<div class="dm-init__stat_head" ${this.constructor.NAME ? `title="${this.constructor.NAME}"` : ""}>${this._abbreviation}</div>`);
	}

	$getRendered ({comp, mon, networking = null}) {
		const $ipt = ComponentUiUtil.$getIptStr(comp, "value")
			.removeClass("input-xs")
			.addClass("input-sm")
			.addClass("dm-init__stat_ipt")
			.addClass("ve-text-center")
			.on("click", () => $ipt.select());

		if (mon) {
			comp._addHookBase("isEditable", () => {
				$ipt.prop("disabled", !comp._state.isEditable);
			})();
		}

		return $$`<div class="ve-flex-vh-center">${$ipt}</div>`;
	}

	/* -------------------------------------------- */

	/**
	 * @param {?object} mon
	 * @param {?object} fluff
	 * @param {?object} obj
	 */
	getInitialCellStateData ({mon = null, fluff = null, obj = null} = {}) {
		return {
			id: this._id,
			entity: {
				...(obj ?? (this._getInitialCellObj({mon, fluff}) || {})),
				isEditable: this._isEditable,
			},
		};
	}

	/* -------------------------------------------- */

	getInitiativeInfo ({state}) {
		return {
			applicability: INITIATIVE_APPLICABILITY_NOT_APPLICABLE,
			initiative: null,
		};
	}
}

class InitiativeTrackerStatColumn_HpFormula extends _InitiativeTrackerStatColumnBase {
	static get POPULATE_WITH () { return "hpFormula"; }
	static GROUP = GROUP_BASE_STATS;
	static NAME = "HP Formula";

	_getInitialCellObj ({mon, fluff}) {
		if (!mon) return {value: null};
		return {value: (mon.hp || {}).formula || ""};
	}
}

class InitiativeTrackerStatColumn_ArmorClass extends _InitiativeTrackerStatColumnBase {
	static get POPULATE_WITH () { return "armorClass"; }
	static GROUP = GROUP_BASE_STATS;
	static NAME = "Armor Class";
	static ABV_DEFAULT = "AC";

	_getInitialCellObj ({mon, fluff}) {
		if (!mon) return {value: null};
		return {value: mon.ac[0] ? (mon.ac[0].ac || mon.ac[0]) : null};
	}
}

class InitiativeTrackerStatColumn_PassivePerception extends _InitiativeTrackerStatColumnBase {
	static get POPULATE_WITH () { return "passivePerception"; }
	static GROUP = GROUP_BASE_STATS;
	static NAME = "Passive Perception";
	static ABV_DEFAULT = "PP";

	_getInitialCellObj ({mon, fluff}) {
		if (!mon) return {value: null};
		return {value: mon.passive};
	}
}

class InitiativeTrackerStatColumn_Speed extends _InitiativeTrackerStatColumnBase {
	static get POPULATE_WITH () { return "speed"; }
	static GROUP = GROUP_BASE_STATS;
	static NAME = "Speed";
	static ABV_DEFAULT = "SPD";

	_getInitialCellObj ({mon, fluff}) {
		if (!mon) return {value: null};
		return {
			value: Math.max(0, ...Object.values(mon.speed || {})
				.map(it => it.number ? it.number : it)
				.filter(it => typeof it === "number")),
		};
	}
}

class InitiativeTrackerStatColumn_SpellDc extends _InitiativeTrackerStatColumnBase {
	static get POPULATE_WITH () { return "spellDc"; }
	static GROUP = GROUP_BASE_STATS;
	static NAME = "Spell DC";
	static ABV_DEFAULT = "DC";

	_getInitialCellObj ({mon, fluff}) {
		if (!mon) return {value: null};
		return {
			value: Math.max(
				0,
				...(mon.spellcasting || [])
					.filter(it => it.headerEntries)
					.map(it => {
						return it.headerEntries
							.map(it => {
								const found = [0];
								it
									.replace(/DC (\d+)/g, (...m) => found.push(Number(m[1])))
									.replace(/{@dc (\d+)}/g, (...m) => found.push(Number(m[1])));
								return Math.max(...found);
							})
							.filter(Boolean);
					})
					.flat(),
			),
		};
	}
}

class InitiativeTrackerStatColumn_Initiative extends _InitiativeTrackerStatColumnBase {
	static get POPULATE_WITH () { return "initiative"; }
	static GROUP = GROUP_BASE_STATS;
	static NAME = "Initiative";
	static ABV_DEFAULT = "INIT";

	_getInitialCellObj ({mon, fluff}) {
		if (!mon) return {value: null};
		return {
			value: Parser.getAbilityModifier(mon.dex),
		};
	}

	/* -------------------------------------------- */

	getInitiativeInfo ({state}) {
		return {
			applicability: _INITIATIVE_APPLICABILITY_EXACT,
			initiative: isNaN(state.entity?.value) ? 0 : Number(state.entity.value),
		};
	}
}

class InitiativeTrackerStatColumn_LegendaryActions extends _InitiativeTrackerStatColumnBase {
	static _SERIALIZER_MAPPINGS = {
		"entity.current": "cur",
		"entity.max": "max",
	};

	static _ = this._registerSerializerMappings();

	/* -------------------------------------------- */

	static get POPULATE_WITH () { return "legendaryActions"; }
	static GROUP = GROUP_BASE_STATS;
	static NAME = "Legendary Actions";
	static ABV_DEFAULT = "LA";

	getPlayerFriendlyState ({cell}) {
		return {
			...super.getPlayerFriendlyState({cell}),
			entity: {
				value: `${cell.entity.current || 0}/${cell.entity.max || 0}`,
			},
		};
	}

	_getInitialCellObj ({mon, fluff}) {
		if (!mon) return {current: null, max: null};
		const cnt = mon.legendaryActions ?? (mon.legendary ? 3 : null);
		return {
			current: cnt,
			max: cnt,
		};
	}

	_getAutoRoundStartObject ({state, mon}) {
		return {current: state.entity.max};
	}

	$getRenderedHeader () {
		return super.$getRenderedHeader()
			.addClass("w-48p");
	}

	$getRendered ({comp, mon}) {
		const $iptCurrent = ComponentUiUtil.$getIptNumber(
			comp,
			"current",
			null,
			{
				isAllowNull: true,
				fallbackOnNaN: null,
				html: `<input class="form-control input-sm hp dm-init__row-input text-right w-24p mr-0 br-0">`,
			},
		)
			.on("click", () => $iptCurrent.select());

		const $iptMax = ComponentUiUtil.$getIptNumber(
			comp,
			"max",
			null,
			{
				isAllowNull: true,
				fallbackOnNaN: null,
				html: `<input class="form-control input-sm hp-max dm-init__row-input w-24p mr-0 bl-0">`,
			},
		)
			.on("click", () => $iptMax.select());

		if (mon) {
			comp._addHookBase("isEditable", () => {
				$iptCurrent.prop("disabled", !comp._state.isEditable);
				$iptMax.prop("disabled", !comp._state.isEditable);
			})();
		}

		return $$`<div class="ve-flex relative mr-3p">
			<div class="text-right">${$iptCurrent}</div>
			<div class="dm-init__sep-fields-slash ve-flex-vh-center">/</div>
			<div class="text-left">${$iptMax}</div>
		</div>`;
	}
}

class InitiativeTrackerStatColumn_Image extends _InitiativeTrackerStatColumnBase {
	static _SERIALIZER_MAPPINGS = {
		"entity.tokenUrl": "urlt",
		"entity.imageHref": "hrefi",
	};

	static _ = this._registerSerializerMappings();

	/* -------------------------------------------- */

	static get POPULATE_WITH () { return "image"; }
	static GROUP = GROUP_BASE_STATS;
	static NAME = "Image";
	static ABV_DEFAULT = "IMG";

	getPlayerFriendlyState ({cell}) {
		return {
			...super.getPlayerFriendlyState({cell}),
			entity: {
				type: "image",
				tokenUrl: cell.entity.tokenUrl,
				imageHref: cell.entity.imageHref,
			},
		};
	}

	_getInitialCellObj ({mon, fluff}) {
		if (!mon) {
			return {
				tokenUrl: UrlUtil.link(`${Renderer.get().baseMediaUrls["img"] || Renderer.get().baseUrl}img/blank-friendly.png`),
				imageHref: null,
			};
		}

		return {
			tokenUrl: Renderer.monster.getTokenUrl(mon),
			imageHref: fluff?.images?.[0].href,
		};
	}

	$getRendered ({comp, mon, networking = null}) {
		const $ele = $$`<div class="mr-3p ve-flex-vh-center w-40p">
			<img src="${comp._state.tokenUrl}" class="w-30p h-30p" alt="Token Image">
		</div>`;

		if (networking != null) {
			$ele.title("Click to Show to Connected Players");

			$ele
				.on("click", () => {
					networking.sendShowImageMessageToClients({
						imageHref: InitiativeTrackerUtil.getImageOrTokenHref({imageHref: comp._state.imageHref, tokenUrl: comp._state.tokenUrl}),
					});
				});

			// If no networking, assume this is an "edit" modal, and avoid binding events
			Renderer.monster.hover.bindFluffImageMouseover({mon, $ele});
		}

		return $ele;
	}
}

class InitiativeTrackerStatColumn_Save extends _InitiativeTrackerStatColumnBase {
	static _ATT;

	static get POPULATE_WITH () { return `${this._ATT}Save`; }
	static GROUP = GROUP_SAVES;
	static get NAME () { return `${Parser.attAbvToFull(this._ATT)} Save`; }
	static get ABV_DEFAULT () { return this._ATT.toUpperCase(); }

	_getInitialCellObj ({mon, fluff}) {
		if (!mon) return {value: null};
		return {
			value: mon.save?.[this.constructor._ATT] ? mon.save[this.constructor._ATT] : Parser.getAbilityModifier(mon[this.constructor._ATT]),
		};
	}
}

class InitiativeTrackerStatColumn_AbilityBonus extends _InitiativeTrackerStatColumnBase {
	static _ATT;

	static get POPULATE_WITH () { return `${this._ATT}Bonus`; }
	static GROUP = GROUP_ABILITY_BONUS;
	static get NAME () { return `${Parser.attAbvToFull(this._ATT)} Bonus`; }
	static get ABV_DEFAULT () { return this._ATT.toUpperCase(); }

	_getInitialCellObj ({mon, fluff}) {
		if (!mon) return {value: null};
		return {
			value: Parser.getAbilityModifier(mon[this.constructor._ATT]),
		};
	}

	/* -------------------------------------------- */

	getInitiativeInfo ({state}) {
		if (this.constructor._ATT !== "dex") return super.getInitiativeInfo({state});
		return {
			applicability: _INITIATIVE_APPLICABILITY_APPLICABLE,
			initiative: isNaN(state.entity?.value) ? 0 : Number(state.entity.value),
		};
	}
}

class InitiativeTrackerStatColumn_AbilityScore extends _InitiativeTrackerStatColumnBase {
	static _ATT;

	static get POPULATE_WITH () { return `${this._ATT}Score`; }
	static GROUP = GROUP_ABILITY_SCORE;
	static get NAME () { return `${Parser.attAbvToFull(this._ATT)} Score`; }
	static get ABV_DEFAULT () { return this._ATT.toUpperCase(); }

	_getInitialCellObj ({mon, fluff}) {
		if (!mon) return {value: null};
		return {
			value: mon[this.constructor._ATT],
		};
	}

	/* -------------------------------------------- */

	getInitiativeInfo ({state}) {
		if (this.constructor._ATT !== "dex") return super.getInitiativeInfo({state});
		return {
			applicability: _INITIATIVE_APPLICABILITY_APPLICABLE,
			initiative: isNaN(state.entity?.value) ? 0 : Parser.getAbilityModifier(Number(state.entity.value)),
		};
	}
}

class InitiativeTrackerStatColumn_Skill extends _InitiativeTrackerStatColumnBase {
	static _SKILL;

	static get POPULATE_WITH () { return this._SKILL.toCamelCase(); }
	static GROUP = GROUP_SKILL;
	static get NAME () { return this._SKILL.toTitleCase(); }
	static get ABV_DEFAULT () { return Parser.skillToShort(this._SKILL).toUpperCase(); }

	_getInitialCellObj ({mon, fluff}) {
		if (!mon) return {value: null};
		return {
			value: mon.skill?.[this.constructor._SKILL]
				? mon.skill[this.constructor._SKILL]
				: Parser.getAbilityModifier(mon[Parser.skillToAbilityAbv(this.constructor._SKILL)]),
		};
	}
}

class _InitiativeTrackerStatColumnCheckboxBase extends _InitiativeTrackerStatColumnBase {
	static GROUP = GROUP_CHECKBOX;

	static _AUTO_VALUE = undefined;

	_getInitialCellObj ({mon, fluff}) { return {value: false}; }

	$getRendered ({comp, mon}) {
		const $cb = ComponentUiUtil.$getCbBool(comp, "value")
			.addClass("dm-init__stat_ipt");

		if (mon) {
			comp._addHookBase("isEditable", () => {
				$cb.prop("disabled", !comp._state.isEditable);
			})();
		}

		return $$`<label class="dm-init__wrp-stat-cb h-100 ve-flex-vh-center">${$cb}</label>`;
	}
}

class _InitiativeTrackerStatColumnCheckboxTurnBase extends _InitiativeTrackerStatColumnCheckboxBase {
	_getAutoTurnStartObject ({state, mon}) { return {value: this.constructor._AUTO_VALUE}; }
}

class _InitiativeTrackerStatColumnCheckboxRoundBase extends _InitiativeTrackerStatColumnCheckboxBase {
	_getAutoRoundStartObject ({state, mon}) { return {value: this.constructor._AUTO_VALUE}; }
}

class InitiativeTrackerStatColumn_Checkbox extends _InitiativeTrackerStatColumnCheckboxBase {
	static get POPULATE_WITH () { return "cbNeutral"; }
	static NAME = "Checkbox";
}

class InitiativeTrackerStatColumn_CheckboxAutoTurnLow extends _InitiativeTrackerStatColumnCheckboxTurnBase {
	static get POPULATE_WITH () { return "cbAutoLow"; }
	static NAME = "Checkbox; clears at start of turn";

	static _AUTO_VALUE = false;
}

class InitiativeTrackerStatColumn_CheckboxAutoTurnHigh extends _InitiativeTrackerStatColumnCheckboxTurnBase {
	static get POPULATE_WITH () { return "cbAutoHigh"; }
	static NAME = "Checkbox; ticks at start of turn";

	static _AUTO_VALUE = true;

	_getInitialCellObj ({mon, fluff}) { return {value: true}; }
}

class InitiativeTrackerStatColumn_CheckboxAutoRoundLow extends _InitiativeTrackerStatColumnCheckboxRoundBase {
	static get POPULATE_WITH () { return "cbAutoRoundLow"; }
	static NAME = "Checkbox; clears at start of round";

	static _AUTO_VALUE = false;
}

class InitiativeTrackerStatColumn_CheckboxAutoRoundHigh extends _InitiativeTrackerStatColumnCheckboxRoundBase {
	static get POPULATE_WITH () { return "cbAutoRoundHigh"; }
	static NAME = "Checkbox; ticks at start of round";

	static _AUTO_VALUE = true;

	_getInitialCellObj ({mon, fluff}) { return {value: true}; }
}

export class InitiativeTrackerStatColumn_Custom extends _InitiativeTrackerStatColumnBase {
	static get POPULATE_WITH () { return ""; }
	static GROUP = GROUP_CUSTOM;
	static NAME = "(Custom)";

	_getInitialCellObj ({mon, fluff}) { return {value: ""}; }
}

export class InitiativeTrackerStatColumnFactory {
	static _COL_CLS_LOOKUP = {};

	static _initLookup () {
		[
			InitiativeTrackerStatColumn_HpFormula,
			InitiativeTrackerStatColumn_ArmorClass,
			InitiativeTrackerStatColumn_PassivePerception,
			InitiativeTrackerStatColumn_Speed,
			InitiativeTrackerStatColumn_SpellDc,
			InitiativeTrackerStatColumn_Initiative,
			InitiativeTrackerStatColumn_LegendaryActions,
			InitiativeTrackerStatColumn_Image,
		].forEach(Cls => this._initLookup_addCls(Cls));

		Parser.ABIL_ABVS
			.forEach(abv => {
				this._initLookup_addCls(class extends InitiativeTrackerStatColumn_Save { static _ATT = abv; });
			});

		Parser.ABIL_ABVS
			.forEach(abv => {
				this._initLookup_addCls(class extends InitiativeTrackerStatColumn_AbilityBonus { static _ATT = abv; });
			});

		Parser.ABIL_ABVS
			.forEach(abv => {
				this._initLookup_addCls(class extends InitiativeTrackerStatColumn_AbilityScore { static _ATT = abv; });
			});

		Object.keys(Parser.SKILL_TO_ATB_ABV)
			.sort(SortUtil.ascSort)
			.forEach(skill => {
				this._initLookup_addCls(class extends InitiativeTrackerStatColumn_Skill { static _SKILL = skill; });
			});

		[
			InitiativeTrackerStatColumn_Checkbox,
			InitiativeTrackerStatColumn_CheckboxAutoTurnLow,
			InitiativeTrackerStatColumn_CheckboxAutoTurnHigh,
			InitiativeTrackerStatColumn_CheckboxAutoRoundLow,
			InitiativeTrackerStatColumn_CheckboxAutoRoundHigh,
		].forEach(Cls => this._initLookup_addCls(Cls));
	}

	static _initLookup_addCls (Cls) { this._COL_CLS_LOOKUP[Cls.POPULATE_WITH] = Cls; }

	/* -------------------------------------------- */

	static getGroupedByUi () {
		const out = [
			[InitiativeTrackerStatColumn_Custom],
		];

		let groupPrev = GROUP_CUSTOM;
		Object.values(this._COL_CLS_LOOKUP)
			.forEach(Cls => {
				if (groupPrev !== Cls.GROUP) out.push([]);
				out.last().push(Cls);
				groupPrev = Cls.GROUP;
			});

		return out;
	}

	/* -------------------------------------------- */

	/**
	 * @param dataSerial
	 * @param data
	 * @return {_InitiativeTrackerStatColumnBase}
	 */
	static fromStateData ({dataSerial, data}) {
		if (dataSerial && data) throw new Error(`Only one of "dataSerial" and "data" may be provided!`);

		data = data ?? InitiativeTrackerStatColumnDataSerializer.fromSerial(dataSerial);

		const Cls = this._COL_CLS_LOOKUP[data.populateWith] ?? InitiativeTrackerStatColumn_Custom;
		return new Cls(data);
	}

	/**
	 * @param colName
	 * @return {_InitiativeTrackerStatColumnBase}
	 */
	static fromEncounterAdvancedColName ({colName}) {
		colName = colName.toLowerCase().trim();
		const Cls = Object.values(this._COL_CLS_LOOKUP)
			.find(Cls => Cls.ABV_DEFAULT.toLowerCase() === colName)
			|| InitiativeTrackerStatColumn_Custom;

		return new Cls({
			id: CryptUtil.uid(),
			isEditable: true,
			isPlayerVisible: IS_PLAYER_VISIBLE_PLAYER_UNITS_ONLY,
			abbreviation: colName,
		});
	}

	/**
	 * @param populateWith
	 * @return {_InitiativeTrackerStatColumnBase}
	 */
	static fromPopulateWith ({populateWith}) {
		const Cls = this._COL_CLS_LOOKUP[populateWith] ?? InitiativeTrackerStatColumn_Custom;
		return new Cls({});
	}

	/**
	 * @param data
	 * @return {_InitiativeTrackerStatColumnBase}
	 */
	static fromCollectionRowStateData ({data}) {
		const flat = {id: data.id, ...data.entity};
		return this.fromStateData({data: flat});
	}
}

InitiativeTrackerStatColumnFactory._initLookup();
