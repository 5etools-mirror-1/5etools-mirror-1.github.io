"use strict";

const LAST_KEY_ALLOWLIST = new Set([
	"entries",
	"entry",
	"items",
	"entriesHigherLevel",
	"rows",
	"row",
	"fluff",
]);

class TagJsons {
	static async pInit ({spells}) {
		SpellTag.init(spells);
		await ItemTag.pInit();
	}

	static mutTagObject (json, {keySet, isOptimistic = true, creaturesToTag = null} = {}) {
		TagJsons.OPTIMISTIC = isOptimistic;

		const fnCreatureTagSpecific = CreatureTag.getFnTryRunSpecific(creaturesToTag);

		Object.keys(json)
			.forEach(k => {
				if (keySet != null && !keySet.has(k)) return;

				json[k] = TagJsons.WALKER.walk(
					{_: json[k]},
					{
						object: (obj, lastKey) => {
							if (lastKey != null && !LAST_KEY_ALLOWLIST.has(lastKey)) return obj;

							obj = TagCondition.tryRunBasic(obj);
							obj = SkillTag.tryRun(obj);
							obj = ActionTag.tryRun(obj);
							obj = SenseTag.tryRun(obj);
							obj = SpellTag.tryRun(obj);
							obj = ItemTag.tryRun(obj);
							obj = TableTag.tryRun(obj);
							obj = TrapTag.tryRun(obj);
							obj = HazardTag.tryRun(obj);
							obj = ChanceTag.tryRun(obj);
							obj = DiceConvert.getTaggedEntry(obj);
							obj = QuickrefTag.tryRun(obj);

							if (fnCreatureTagSpecific) obj = fnCreatureTagSpecific(obj);

							return obj;
						},
					},
				)._;
			});
	}
}

TagJsons.OPTIMISTIC = true;

TagJsons._BLOCKLIST_FILE_PREFIXES = null;

TagJsons.WALKER_KEY_BLOCKLIST = new Set([
	...MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST,
]);

TagJsons.WALKER = MiscUtil.getWalker({
	keyBlocklist: TagJsons.WALKER_KEY_BLOCKLIST,
});

globalThis.TagJsons = TagJsons;

class SpellTag {
	static _NON_STANDARD = new Set([
		// Skip "Divination" to avoid tagging occurrences of the school
		"Divination",
		// Skip spells we specifically handle
		"Antimagic Field",
		"Dispel Magic",
	].map(it => it.toLowerCase()));

	static init (spells) {
		spells
			.forEach(sp => SpellTag._SPELL_NAMES[sp.name.toLowerCase()] = {name: sp.name, source: sp.source});

		const spellnamesFiltered = Object.keys(SpellTag._SPELL_NAMES)
			.filter(n => !SpellTag._NON_STANDARD.has(n));

		SpellTag._SPELL_NAME_REGEX = new RegExp(`\\b(${spellnamesFiltered.map(it => it.escapeRegexp()).join("|")})\\b`, "gi");
		SpellTag._SPELL_NAME_REGEX_SPELL = new RegExp(`\\b(${spellnamesFiltered.map(it => it.escapeRegexp()).join("|")}) (spell|cantrip)`, "gi");
		SpellTag._SPELL_NAME_REGEX_AND = new RegExp(`\\b(${spellnamesFiltered.map(it => it.escapeRegexp()).join("|")}) (and {@spell)`, "gi");
		SpellTag._SPELL_NAME_REGEX_CAST = new RegExp(`(?<prefix>casts? (?:the )?)(?<spell>${spellnamesFiltered.map(it => it.escapeRegexp()).join("|")})\\b`, "gi");
	}

	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@spell"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag,
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		if (TagJsons.OPTIMISTIC) {
			strMod = strMod
				.replace(SpellTag._SPELL_NAME_REGEX_SPELL, (...m) => {
					const spellMeta = SpellTag._SPELL_NAMES[m[1].toLowerCase()];
					return `{@spell ${m[1]}${spellMeta.source !== Parser.SRC_PHB ? `|${spellMeta.source}` : ""}} ${m[2]}`;
				});
		}

		// Tag common spells which often don't have e.g. the word "spell" nearby
		strMod = strMod
			.replace(/\b(antimagic field|dispel magic)\b/gi, (...m) => {
				const spellMeta = SpellTag._SPELL_NAMES[m[1].toLowerCase()];
				return `{@spell ${m[1]}${spellMeta.source !== Parser.SRC_PHB ? `|${spellMeta.source}` : ""}}`;
			});

		strMod
			.replace(SpellTag._SPELL_NAME_REGEX_CAST, (...m) => {
				const spellMeta = SpellTag._SPELL_NAMES[m.last().spell.toLowerCase()];
				return `${m.last().prefix}{@spell ${m.last().spell}${spellMeta.source !== Parser.SRC_PHB ? `|${spellMeta.source}` : ""}}`;
			});

		return strMod
			.replace(SpellTag._SPELL_NAME_REGEX_AND, (...m) => {
				const spellMeta = SpellTag._SPELL_NAMES[m[1].toLowerCase()];
				return `{@spell ${m[1]}${spellMeta.source !== Parser.SRC_PHB ? `|${spellMeta.source}` : ""}} ${m[2]}`;
			})
			.replace(/(spells(?:|[^.!?:{]*): )([^.!?]+)/gi, (...m) => {
				const spellPart = m[2].replace(SpellTag._SPELL_NAME_REGEX, (...n) => {
					const spellMeta = SpellTag._SPELL_NAMES[n[1].toLowerCase()];
					return `{@spell ${n[1]}${spellMeta.source !== Parser.SRC_PHB ? `|${spellMeta.source}` : ""}}`;
				});
				return `${m[1]}${spellPart}`;
			})
			.replace(SpellTag._SPELL_NAME_REGEX_CAST, (...m) => {
				const spellMeta = SpellTag._SPELL_NAMES[m.last().spell.toLowerCase()];
				return `${m.last().prefix}{@spell ${m.last().spell}${spellMeta.source !== Parser.SRC_PHB ? `|${spellMeta.source}` : ""}}`;
			})
		;
	}
}
SpellTag._SPELL_NAMES = {};
SpellTag._SPELL_NAME_REGEX = null;
SpellTag._SPELL_NAME_REGEX_SPELL = null;
SpellTag._SPELL_NAME_REGEX_AND = null;
SpellTag._SPELL_NAME_REGEX_CAST = null;

globalThis.SpellTag = SpellTag;

class ItemTag {
	static async pInit () {
		const itemArr = await Renderer.item.pBuildList();

		const standardItems = itemArr.filter(it => !SourceUtil.isNonstandardSource(it.source));

		// region Tools
		const toolTypes = new Set(["AT", "GS", "INS", "T"]);
		const tools = standardItems.filter(it => toolTypes.has(it.type) && it.name !== "Horn");
		tools.forEach(tool => {
			ItemTag._ITEM_NAMES[tool.name.toLowerCase()] = {name: tool.name, source: tool.source};
		});

		ItemTag._ITEM_NAMES_REGEX_TOOLS = new RegExp(`\\b(${tools.map(it => it.name.escapeRegexp()).join("|")})\\b`, "gi");
		// endregion

		// region Other items
		const otherItems = standardItems.filter(it => {
			if (toolTypes.has(it.type)) return false;
			// Disallow specific items
			if (it.name === "Wave" && it.source === Parser.SRC_DMG) return false;
			// Allow all non-specific-variant DMG items
			if (it.source === Parser.SRC_DMG && !Renderer.item.isMundane(it) && it._category !== "Specific Variant") return true;
			// Allow "sufficiently complex name" items
			return it.name.split(" ").length > 2;
		});
		otherItems.forEach(it => {
			ItemTag._ITEM_NAMES[it.name.toLowerCase()] = {name: it.name, source: it.source};
		});

		ItemTag._ITEM_NAMES_REGEX_OTHER = new RegExp(`\\b(${otherItems.map(it => it.name.escapeRegexp()).join("|")})\\b`, "gi");
		// endregion
	}

	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@item"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag,
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		return strMod
			.replace(ItemTag._ITEM_NAMES_REGEX_TOOLS, (...m) => {
				const itemMeta = ItemTag._ITEM_NAMES[m[1].toLowerCase()];
				return `{@item ${m[1]}${itemMeta.source !== Parser.SRC_DMG ? `|${itemMeta.source}` : ""}}`;
			})
			.replace(ItemTag._ITEM_NAMES_REGEX_OTHER, (...m) => {
				const itemMeta = ItemTag._ITEM_NAMES[m[1].toLowerCase()];
				return `{@item ${m[1]}${itemMeta.source !== Parser.SRC_DMG ? `|${itemMeta.source}` : ""}}`;
			})
		;
	}
}
ItemTag._ITEM_NAMES = {};
ItemTag._ITEM_NAMES_REGEX_TOOLS = null;

ItemTag._WALKER = MiscUtil.getWalker({
	keyBlocklist: new Set([
		...TagJsons.WALKER_KEY_BLOCKLIST,
		"packContents", // Avoid tagging item pack contents
		"items", // Avoid tagging item group item lists
	]),
});

class TableTag {
	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@table"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag,
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		return strMod
			.replace(/Wild Magic Surge table/g, `{@table Wild Magic Surge|PHB} table`)
		;
	}
}

class TrapTag {
	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@trap"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag,
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		return strMod
			.replace(TrapTag._RE_TRAP_SEE, (...m) => `{@trap ${m[1]}}${m[2]}`)
		;
	}
}
TrapTag._RE_TRAP_SEE = /\b(Fire-Breathing Statue|Sphere of Annihilation|Collapsing Roof|Falling Net|Pits|Poison Darts|Poison Needle|Rolling Sphere)( \(see)/gi;

class HazardTag {
	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@hazard"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag,
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		return strMod
			.replace(HazardTag._RE_HAZARD_SEE, (...m) => `{@hazard ${m[1]}}${m[2]}`)
		;
	}
}
HazardTag._RE_HAZARD_SEE = /\b(High Altitude|Brown Mold|Green Slime|Webs|Yellow Mold|Extreme Cold|Extreme Heat|Heavy Precipitation|Strong Wind|Desecrated Ground|Frigid Water|Quicksand|Razorvine|Slippery Ice|Thin Ice)( \(see)/gi;

class CreatureTag {
	/**
	 * Dynamically create a walker which can be re-used.
	 */
	static getFnTryRunSpecific (creaturesToTag) {
		if (!creaturesToTag?.length) return null;

		// region Create a regular expression per source
		const bySource = {};
		creaturesToTag.forEach(({name, source}) => {
			(bySource[source] = bySource[source] || []).push(name);
		});
		const res = Object.entries(bySource)
			.mergeMap(([source, names]) => {
				const re = new RegExp(`\\b(${names.map(it => it.escapeRegexp()).join("|")})\\b`, "gi");
				return {[source]: re};
			});
		// endregion

		const fnTag = strMod => {
			Object.entries(res)
				.forEach(([source, re]) => {
					strMod = strMod.replace(re, (...m) => `{@creature ${m[0]}${source !== Parser.SRC_DMG ? `|${source}` : ""}}`);
				});
			return strMod;
		};

		return (it) => {
			return TagJsons.WALKER.walk(
				it,
				{
					string: (str) => {
						const ptrStack = {_: ""};
						TaggerUtils.walkerStringHandler(
							["@creature"],
							ptrStack,
							0,
							0,
							str,
							{
								fnTag,
							},
						);
						return ptrStack._;
					},
				},
			);
		};
	}
}

class ChanceTag {
	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@chance"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag,
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		return strMod
			.replace(/\b(\d+)( percent)( chance)/g, (...m) => `{@chance ${m[1]}|${m[1]}${m[2]}}${m[3]}`)
		;
	}
}

class QuickrefTag {
	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@quickref"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag.bind(this),
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		return strMod
			.replace(QuickrefTag._RE_BASIC, (...m) => `{@quickref ${QuickrefTag._LOOKUP_BASIC[m[0].toLowerCase()]}}`)
			.replace(QuickrefTag._RE_VISION, (...m) => `{@quickref ${QuickrefTag._LOOKUP_VISION[m[0].toLowerCase()]}||${m[0]}}`)
		;
	}
}
QuickrefTag._RE_BASIC = /\b([Dd]ifficult [Tt]errain|Vision and Light)\b/g;
QuickrefTag._RE_VISION = /\b(dim light|bright light|lightly obscured|heavily obscured)\b/gi;
QuickrefTag._LOOKUP_BASIC = {
	"difficult terrain": "difficult terrain||3",
	"vision and light": "Vision and Light||2",
};
QuickrefTag._LOOKUP_VISION = {
	"bright light": "Vision and Light||2",
	"dim light": "Vision and Light||2",
	"lightly obscured": "Vision and Light||2",
	"heavily obscured": "Vision and Light||2",
};
