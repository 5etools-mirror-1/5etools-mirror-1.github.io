"use strict";

const LAST_KEY_WHITELIST = new Set([
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

	static mutTagObject (json, {keySet, isOptimistic = true} = {}) {
		TagJsons.OPTIMISTIC = isOptimistic;

		Object.keys(json)
			.forEach(k => {
				if (keySet != null && !keySet.has(k)) return;

				json[k] = TagJsons.WALKER.walk(
					{_: json[k]},
					{
						object: (obj, lastKey) => {
							if (lastKey != null && !LAST_KEY_WHITELIST.has(lastKey)) return obj;

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

							return obj;
						},
					},
				)._;
			});
	}
}

TagJsons.OPTIMISTIC = true;

TagJsons._BLACKLIST_FILE_PREFIXES = null;

TagJsons.WALKER_KEY_BLACKLIST = new Set([
	...MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST,
	"dataCreature",
	"dataObject",
]);

TagJsons.WALKER = MiscUtil.getWalker({
	keyBlacklist: TagJsons.WALKER_KEY_BLACKLIST,
});

class SpellTag {
	static init (spells) {
		spells.forEach(sp => SpellTag._SPELL_NAMES[sp.name.toLowerCase()] = {name: sp.name, source: sp.source});

		SpellTag._SPELL_NAME_REGEX = new RegExp(`(${Object.keys(SpellTag._SPELL_NAMES).map(it => it.escapeRegexp()).join("|")})`, "gi");
		SpellTag._SPELL_NAME_REGEX_SPELL = new RegExp(`(${Object.keys(SpellTag._SPELL_NAMES).map(it => it.escapeRegexp()).join("|")}) (spell)`, "gi");
		SpellTag._SPELL_NAME_REGEX_AND = new RegExp(`(${Object.keys(SpellTag._SPELL_NAMES).map(it => it.escapeRegexp()).join("|")}) (and {@spell)`, "gi");
		SpellTag._SPELL_NAME_REGEX_CAST = new RegExp(`(?<prefix>casts? )(?<spell>${Object.keys(SpellTag._SPELL_NAMES).map(it => it.escapeRegexp()).join("|")})`, "gi");
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
					return `{@spell ${m[1]}${spellMeta.source !== SRC_PHB ? `|${spellMeta.source}` : ""}} ${m[2]}`;
				});
		}

		strMod
			.replace(SpellTag._SPELL_NAME_REGEX_CAST, (...m) => {
				const spellMeta = SpellTag._SPELL_NAMES[m.last().spell.toLowerCase()];
				return `${m.last().prefix}{@spell ${m.last().spell}${spellMeta.source !== SRC_PHB ? `|${spellMeta.source}` : ""}}`;
			});

		return strMod
			.replace(SpellTag._SPELL_NAME_REGEX_AND, (...m) => {
				const spellMeta = SpellTag._SPELL_NAMES[m[1].toLowerCase()];
				return `{@spell ${m[1]}${spellMeta.source !== SRC_PHB ? `|${spellMeta.source}` : ""}} ${m[2]}`;
			})
			.replace(/(spells(?:|[^.!?:{]*): )([^.!?]+)/gi, (...m) => {
				const spellPart = m[2].replace(SpellTag._SPELL_NAME_REGEX, (...n) => {
					const spellMeta = SpellTag._SPELL_NAMES[n[1].toLowerCase()];
					return `{@spell ${n[1]}${spellMeta.source !== SRC_PHB ? `|${spellMeta.source}` : ""}}`;
				});
				return `${m[1]}${spellPart}`;
			})
			.replace(SpellTag._SPELL_NAME_REGEX_CAST, (...m) => {
				const spellMeta = SpellTag._SPELL_NAMES[m.last().spell.toLowerCase()];
				return `${m.last().prefix}{@spell ${m.last().spell}${spellMeta.source !== SRC_PHB ? `|${spellMeta.source}` : ""}}`;
			})
		;
	}
}
SpellTag._SPELL_NAMES = {};
SpellTag._SPELL_NAME_REGEX = null;
SpellTag._SPELL_NAME_REGEX_SPELL = null;
SpellTag._SPELL_NAME_REGEX_AND = null;
SpellTag._SPELL_NAME_REGEX_CAST = null;

class ItemTag {
	static async pInit () {
		const itemArr = await Renderer.item.pBuildList({isAddGroups: true});

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
			// Allow all non-specific-variant DMG items
			if (it.source === SRC_DMG && !Renderer.item.isMundane(it) && it._category !== "Specific Variant") return true;
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
				return `{@item ${m[1]}${itemMeta.source !== SRC_DMG ? `|${itemMeta.source}` : ""}}`;
			})
			.replace(ItemTag._ITEM_NAMES_REGEX_OTHER, (...m) => {
				const itemMeta = ItemTag._ITEM_NAMES[m[1].toLowerCase()];
				return `{@item ${m[1]}${itemMeta.source !== SRC_DMG ? `|${itemMeta.source}` : ""}}`;
			})
		;
	}
}
ItemTag._ITEM_NAMES = {};
ItemTag._ITEM_NAMES_REGEX_TOOLS = null;

ItemTag._WALKER = MiscUtil.getWalker({
	keyBlacklist: new Set([
		...TagJsons.WALKER_KEY_BLACKLIST,
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

if (typeof module !== "undefined") {
	module.exports = {
		TagJsons,
	};
}
