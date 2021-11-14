"use strict";

/*
 * Various utilities to assist in statblock parse/conversion. Formatted as a Node module, to allow external use.
 *
 * In all cases, the first argument, `m`, is a monster statblock.
 * Additionally, `cbMan` is a callback which should accept up to two arguments representing part of the statblock which
 * require manual consideration/tagging, and an error message, respectively.
 * Where available, `cbErr` accepts the same arguments, and may be called when an error occurs (the parser encounters
 * something too far from acceptable to be solved with manual conversion; for instance, in the case of completely junk
 * data, or common errors which should be corrected prior to running the parser).
 */

class ConverterConst {}
ConverterConst.STR_RE_DAMAGE_TYPE = "(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)";
ConverterConst.RE_DAMAGE_TYPE = new RegExp(`(^|\\W)${ConverterConst.STR_RE_DAMAGE_TYPE}(\\W|$)`, "g");

class BaseParser {
	static _getValidOptions (options) {
		options = options || {};
		if (!options.cbWarning || !options.cbOutput) throw new Error(`Missing required callback options!`);
		return options;
	}

	// region conversion
	static _getAsTitle (prop, line, titleCaseFields, isTitleCase) {
		return titleCaseFields && titleCaseFields.includes(prop) && isTitleCase
			? line.toLowerCase().toTitleCase()
			: line;
	}

	static _getCleanInput (ipt) {
		let iptClean = ipt
			.replace(/\n\r/g, "\n")
			.replace(/\r\n/g, "\n")
			.replace(/\r/g, "\n")
			.replace(/[−–‒]/g, "-") // convert minus signs to hyphens
		;

		iptClean = CleanUtil.getCleanString(iptClean)
			// Ensure CR always has a space before the dash
			.replace(/(Challenge)([-\u2012-\u2014])/, "$1 $2");

		// Connect together words which are divided over two lines
		iptClean = iptClean
			.replace(/((?: | ")[A-Za-z][a-z]+)- *\n([a-z])/g, "$1$2");

		return iptClean;
	}

	static _hasEntryContent (trait) {
		return trait && (trait.name || (trait.entries.length === 1 && trait.entries[0]) || trait.entries.length > 1);
	}

	/**
	 * Check if a line is likely to be a badly-newline'd continuation of the previous line.
	 * @param entryArray
	 * @param curLine
	 * @param [opts]
	 * @param [opts.noLowercase] Disable lowercase-word checking.
	 * @param [opts.noNumber] Disable number checking.
	 * @param [opts.noParenthesis] Disable parenthesis ("(") checking.
	 * @param [opts.noSavingThrow] Disable saving throw checking.
	 * @param [opts.noAbilityName] Disable ability checking.
	 * @param [opts.noHit] Disable "Hit:" checking.
	 * @param [opts.noSpellcastingAbility] Disable spellcasting ability checking.
	 * @param [opts.noSpellcastingWarlockSlotLevel] Disable spellcasting warlock slot checking.
	 */
	static _isContinuationLine (entryArray, curLine, opts) {
		opts = opts || {};

		// If there is no previous entry to add to, do not continue
		const lastEntry = entryArray.last();
		if (typeof lastEntry !== "string") return false;

		// If the current string ends in a comma
		if (/,\s*$/.test(lastEntry)) return true;
		// If the current string ends in a dash
		if (/[-\u2014]\s*$/.test(lastEntry)) return true;

		const cleanLine = curLine.trim();

		if (/^\d..-\d.. level\s+\(/.test(cleanLine) && !opts.noSpellcastingWarlockSlotLevel) return false;

		// A lowercase word
		if (/^[a-z]/.test(cleanLine) && !opts.noLowercase) return true;
		// An ordinal (e.g. "3rd"), but not a spell level (e.g. "1st level")
		if (/^\d[a-z][a-z]/.test(cleanLine) && !/^\d[a-z][a-z] level/gi.test(cleanLine)) return true;
		// A number (e.g. damage; "5 (1d6 + 2)")
		if (/^\d+\s+/.test(cleanLine) && !opts.noNumber) return true;
		// Opening brackets (e.g. damage; "(1d6 + 2)")
		if (/^\(/.test(cleanLine) && !opts.noParenthesis) return true;
		// An ability score name followed by "saving throw"
		if (/^(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/.test(cleanLine) && !opts.noSavingThrow) return true;
		// An ability score name
		if (/^(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s/.test(cleanLine) && !opts.noAbilityName) return true;
		// "Hit:" e.g. inside creature attacks
		if (/^Hit:/.test(cleanLine) && !opts.noHit) return true;
		if (/^(Intelligence|Wisdom|Charisma)\s+\(/.test(cleanLine) && !opts.noSpellcastingAbility) return true;

		return false;
	}

	static _isJsonLine (curLine) { return curLine.startsWith(`__VE_JSON__`); }
	static _getJsonFromLine (curLine) {
		curLine = curLine.replace(/^__VE_JSON__/, "");
		return JSON.parse(curLine);
	}
	// endregion
}

class TaggerUtils {
	/**
	 *
	 * @param targetTags e.g. `["@condition"]`
	 * @param ptrStack
	 * @param depth
	 * @param str
	 * @param tagCount
	 * @param meta
	 * @param meta.fnTag
	 * @param [meta.isAllowTagsWithinTags]
	 */
	static walkerStringHandler (targetTags, ptrStack, depth, tagCount, str, meta) {
		const tagSplit = Renderer.splitByTags(str);
		const len = tagSplit.length;
		for (let i = 0; i < len; ++i) {
			const s = tagSplit[i];
			if (!s) continue;
			if (s.startsWith("{@")) {
				const [tag, text] = Renderer.splitFirstSpace(s.slice(1, -1));

				ptrStack._ += `{${tag}${text.length ? " " : ""}`;
				if (!meta.isAllowTagsWithinTags) {
					// Never tag anything within an existing tag
					this.walkerStringHandler(targetTags, ptrStack, depth + 1, tagCount + 1, text, meta);
				} else {
					// Tag something within an existing tag only if it doesn't match our tag(s)
					if (targetTags.includes(tag)) {
						this.walkerStringHandler(targetTags, ptrStack, depth + 1, tagCount + 1, text, meta);
					} else {
						this.walkerStringHandler(targetTags, ptrStack, depth + 1, tagCount, text, meta);
					}
				}
				ptrStack._ += `}`;
			} else {
				// avoid tagging things wrapped in existing tags
				if (tagCount) {
					ptrStack._ += s;
				} else {
					let sMod = s;
					sMod = meta.fnTag(sMod);
					ptrStack._ += sMod;
				}
			}
		}
	}
}

class TagCondition {
	static init (legendaryGroups, spells) {
		TagCondition._ALL_LEGENDARY_GROUPS = legendaryGroups;
		TagCondition._ALL_SPELLS = spells;
	}

	static _getConvertedEntry (mon, entry, {inflictedSet, inflictedWhitelist} = {}) {
		const walker = MiscUtil.getWalker({keyBlacklist: TagCondition._KEY_BLACKLIST});
		const nameStack = [];
		const walkerHandlers = {
			preObject: (obj) => nameStack.push(obj.name),
			postObject: () => nameStack.pop(),
			string: [
				(str) => {
					if (nameStack.includes("Antimagic Susceptibility")) return str;
					if (nameStack.includes("Sneak Attack (1/Turn)")) return str;
					const ptrStack = {_: ""};
					return TagCondition._walkerStringHandler(ptrStack, 0, 0, str, {inflictedSet, inflictedWhitelist});
				},
			],
		};
		entry = MiscUtil.copy(entry);
		return walker.walk(entry, walkerHandlers);
	}

	static _walkerStringHandler (ptrStack, depth, conditionCount, str, {inflictedSet, inflictedWhitelist} = {}) {
		TaggerUtils.walkerStringHandler(
			"@condition",
			ptrStack,
			depth,
			conditionCount,
			str,
			{
				fnTag: sMod => {
					TagCondition._CONDITION_MATCHERS.forEach(r => sMod = sMod.replace(r, (...mt) => `{@condition ${mt[1]}}`));
					return sMod;
				},
			},
		);

		// Only the outermost loop needs return the final string
		if (depth !== 0) return;

		// Collect inflicted conditions for tagging
		if (inflictedSet) this._collectInflictedConditions(ptrStack._, {inflictedSet, inflictedWhitelist});

		return ptrStack._;
	}

	static _handleProp (m, prop, {inflictedSet, inflictedWhitelist} = {}) {
		if (!m[prop]) return;

		m[prop] = m[prop].map(entry => this._getConvertedEntry(m, entry, {inflictedSet, inflictedWhitelist}));
	}

	static tryTagConditions (m, {isTagInflicted = false, isInflictedAddOnly = false, inflictedWhitelist = null} = {}) {
		const inflictedSet = isTagInflicted ? new Set() : null;

		this._handleProp(m, "action", {inflictedSet, inflictedWhitelist});
		this._handleProp(m, "reaction", {inflictedSet, inflictedWhitelist});
		this._handleProp(m, "bonus", {inflictedSet, inflictedWhitelist});
		this._handleProp(m, "trait", {inflictedSet, inflictedWhitelist});
		this._handleProp(m, "legendary", {inflictedSet, inflictedWhitelist});
		this._handleProp(m, "mythic", {inflictedSet, inflictedWhitelist});
		this._handleProp(m, "variant", {inflictedSet, inflictedWhitelist});
		this._handleProp(m, "entries", {inflictedSet, inflictedWhitelist});
		this._handleProp(m, "entriesHigherLevel", {inflictedSet, inflictedWhitelist});

		this._mutAddInflictedSet({m, inflictedSet, isInflictedAddOnly, prop: "conditionInflict"});
	}

	static _collectInflictedConditions (str, {inflictedSet, inflictedWhitelist} = {}) {
		if (!inflictedSet) return;

		TagCondition._CONDITION_INFLICTED_MATCHERS.forEach(re => str.replace(re, (...m) => {
			const cond = m[1];
			if (!inflictedWhitelist || inflictedWhitelist.has(cond)) inflictedSet.add(m[1]);

			// ", {@condition ...}, ..."
			if (m[2]) m[2].replace(/{@condition ([^}]+)}/g, (...n) => inflictedSet.add(n[1]));

			// " and {@condition ...}
			if (m[3]) m[3].replace(/{@condition ([^}]+)}/g, (...n) => inflictedSet.add(n[1]));
		}));
	}

	static tryTagConditionsSpells (m, {cbMan, isTagInflicted, isInflictedAddOnly, inflictedWhitelist} = {}) {
		if (!m.spellcasting) return false;

		const inflictedSet = isTagInflicted ? new Set() : null;

		// Collect known spells
		const strSpellcasting = JSON.stringify(m.spellcasting);
		const knownSpells = {};
		strSpellcasting.replace(/{@spell ([^}]+)}/g, (...m) => {
			let [spellName, spellSource] = m[1].split("|").map(it => it.toLowerCase());
			spellSource = spellSource || SRC_PHB.toLowerCase();

			(knownSpells[spellSource] = knownSpells[spellSource] || new Set()).add(spellName);
		});

		Object.entries(knownSpells)
			.forEach(([source, spellSet]) => {
				spellSet.forEach(it => {
					const spell = TagCondition._ALL_SPELLS.find(s => (s.name.toLowerCase() === it || (typeof s.srd === "string" && s.srd.toLowerCase() === it)) && s.source.toLowerCase() === source);
					if (!spell) return cbMan ? cbMan(`${it} :: ${source}`) : null;
					if (spell.conditionInflict) spell.conditionInflict.filter(c => !inflictedWhitelist || inflictedWhitelist.has(c)).forEach(c => inflictedSet.add(c));
				});
			});

		this._mutAddInflictedSet({m, inflictedSet, isInflictedAddOnly, prop: "conditionInflictSpell"});
	}

	static tryTagConditionsRegionalsLairs (m, {cbMan, isTagInflicted, isInflictedAddOnly, inflictedWhitelist} = {}) {
		if (!m.legendaryGroup) return;

		const inflictedSet = isTagInflicted ? new Set() : null;

		const meta = TagCondition._ALL_LEGENDARY_GROUPS.find(it => it.name === m.legendaryGroup.name && it.source === m.legendaryGroup.source);
		if (!meta) return cbMan ? cbMan(m.legendaryGroup) : null;
		this._collectInflictedConditions(JSON.stringify(meta), {inflictedSet, inflictedWhitelist});

		this._mutAddInflictedSet({m, inflictedSet, isInflictedAddOnly, prop: "conditionInflictLegendary"});
	}

	static _mutAddInflictedSet ({m, inflictedSet, isInflictedAddOnly, prop}) {
		if (!inflictedSet) return;

		if (isInflictedAddOnly) {
			(m[prop] || []).forEach(it => inflictedSet.add(it));
			if (inflictedSet.size) m[prop] = [...inflictedSet].sort(SortUtil.ascSortLower);
			return;
		}

		if (inflictedSet.size) m[prop] = [...inflictedSet].sort(SortUtil.ascSortLower);
		else delete m[prop];
	}

	// region Run basic tagging
	static tryRunBasic (it) {
		const walker = MiscUtil.getWalker({keyBlacklist: TagCondition._KEY_BLACKLIST});
		return walker.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@condition"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: strMod => strMod.replace(TagCondition._CONDITION_MATCHER_WORD, (...m) => `${m[1]}{@condition ${m[2]}}${m[3]}`),
						},
					);
					return ptrStack._
						.replace(/\b{@condition (prone)} (to)\b/gi, "$1 $2");
				},
			},
		);
	}
	// endregion
}
TagCondition._KEY_BLACKLIST = new Set([
	...MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST,
	"conditionImmune",
]);
TagCondition._ALL_LEGENDARY_GROUPS = null;
TagCondition._ALL_SPELLS = null;
TagCondition._CONDITIONS = [
	"blinded",
	"charmed",
	"deafened",
	"exhaustion",
	"frightened",
	"grappled",
	"incapacitated",
	"invisible",
	"paralyzed",
	"petrified",
	"poisoned",
	"prone",
	"restrained",
	"stunned",
	"unconscious",
];
TagCondition._CONDITION_MATCHERS = TagCondition._CONDITIONS.map(it => new RegExp(`(${it})`, "g"));
TagCondition._CONDITION_MATCHER_WORD = new RegExp(`(^|[ "(\\u2013\\u2014])(${TagCondition._CONDITIONS.join("|")})([ "',.:;)\\u2013\\u2014]|$)`, "g");
// Each should have one group which matches the condition name.
//   A comma/and part is appended to the end to handle chains of conditions.
TagCondition.__TGT = `(?:target|wielder)`;
TagCondition._CONDITION_INFLICTED_MATCHERS = [
	`(?:creature|enemy|target) (?:is|becomes) (?:\\w+ )?{@condition ([^}]+)}`,
	`saving throw (?:by \\d+ or more, it )?is (?:\\w+ )?{@condition ([^}]+)}`, // MM :: Sphinx :: First Roar
	`(?:the save|fails) by \\d+ or more, [^.!?]+?{@condition ([^}]+)}`, // VGM :: Fire Giant Dreadnought :: Shield Charge
	`(?:${TagCondition.__TGT}|creatures?|humanoid|undead|other creatures|enemy) [^.!?]+?(?:succeed|make|pass)[^.!?]+?saving throw[^.!?]+?or (?:fall|be(?:come)?|is) (?:\\w+ )?{@condition ([^}]+)}`,
	`and then be (?:\\w+ )?{@condition ([^}]+)}`,
	`(?:be|is) knocked (?:\\w+ )?{@condition (prone|unconscious)}`,
	`a (?:\\w+ )?{@condition [^}]+} (?:creature|enemy) is (?:\\w+ )?{@condition ([^}]+)}`, // e.g. `a frightened creature is paralyzed`
	`the[^.!?]+?${TagCondition.__TGT} is[^.!?]+?{@condition ([^}]+)}`,
	`the[^.!?]+?${TagCondition.__TGT} is [^.!?]+?, it is {@condition ([^}]+)}(?: \\(escape [^\\)]+\\))?`,
	`begins to [^.!?]+? and is {@condition ([^}]+)}`, // e.g. `begins to turn to stone and is restrained`
	`saving throw[^.!?]+?or [^.!?]+? and remain {@condition ([^}]+)}`, // e.g. `or fall asleep and remain unconscious`
	`saving throw[^.!?]+?or be [^.!?]+? and land {@condition (prone)}`, // MM :: Cloud Giant :: Fling
	`saving throw[^.!?]+?or be (?:pushed|pulled) [^.!?]+? and (?:\\w+ )?{@condition ([^}]+)}`, // MM :: Dragon Turtle :: Tail
	`the engulfed (?:creature|enemy) [^.!?]+? {@condition ([^}]+)}`, // MM :: Gelatinous Cube :: Engulf
	`the ${TagCondition.__TGT} is [^.!?]+? and (?:is )?{@condition ([^}]+)} while`, // MM :: Giant Centipede :: Bite
	`on a failed save[^.!?]+?the (?:${TagCondition.__TGT}|creature) [^.!?]+? {@condition ([^}]+)}`, // MM :: Jackalwere :: Sleep Gaze
	`on a failure[^.!?]+?${TagCondition.__TGT}[^.!?]+?(?:pushed|pulled)[^.!?]+?and (?:\\w+ )?{@condition ([^}]+)}`, // MM :: Marid :: Water Jet
	`a[^.!?]+?(?:creature|enemy)[^.!?]+?to the[^.!?]+?is (?:also )?{@condition ([^}]+)}`, // MM :: Mimic :: Adhesive
	`(?:creature|enemy) gains? \\w+ levels? of {@condition (exhaustion)}`, // MM :: Myconid Adult :: Euphoria Spores
	`(?:saving throw|failed save)[^.!?]+? gains? \\w+ levels? of {@condition (exhaustion)}`, // ERLW :: Belashyrra :: Rend Reality
	`(?:on a successful save|if the saving throw is successful), (?:the ${TagCondition.__TGT} |(?:a|the )creature |(?:an |the )enemy )[^.!?]*?isn't {@condition ([^}]+)}`,
	`or take[^.!?]+?damage and (?:becomes?|is|be) {@condition ([^}]+)}`, // MM :: Quasit || Claw
	`the (?:${TagCondition.__TGT}|creature|enemy) [^.!?]+? and is {@condition ([^}]+)}`, // MM :: Satyr :: Gentle Lullaby
	`${TagCondition.__TGT}\\. [^.!?]+?damage[^.!?]+?and[^.!?]+?${TagCondition.__TGT} is {@condition ([^}]+)}`, // MM :: Vine Blight :: Constrict
	`on a failure[^.!?]+?${TagCondition.__TGT} [^.!?]+?\\. [^.!?]+?is also {@condition ([^}]+)}`, // MM :: Water Elemental :: Whelm
	`(?:(?:a|the|each) ${TagCondition.__TGT}|(?:a|the|each) creature|(?:an|each) enemy)[^.!?]+?takes?[^.!?]+?damage[^.!?]+?and [^.!?]+? {@condition ([^}]+)}`, // AI :: Keg Robot :: Hot Oil Spray
	`(?:creatures|enemies) within \\d+ feet[^.!?]+must succeed[^.!?]+saving throw or be {@condition ([^}]+)}`, // VGM :: Deep Scion :: Psychic Screech
	`creature that fails the save[^.!?]+?{@condition ([^}]+)}`, // VGM :: Gauth :: Stunning Gaze
	`if the ${TagCondition.__TGT} is a creature[^.!?]+?saving throw[^.!?]*?\\. On a failed save[^.!?]+?{@condition ([^}]+)}`, // VGM :: Mindwitness :: Eye Rays
	`while {@condition (?:[^}]+)} in this way, an? (?:${TagCondition.__TGT}|creature|enemy) [^.!?]+{@condition ([^}]+)}`, // VGM :: Vargouille :: Stunning Shriek
	`${TagCondition.__TGT} must succeed[^.!?]+?saving throw[^.!?]+?{@condition ([^}]+)}`, // VGM :: Yuan-ti Pit Master :: Merrshaulk's Slumber
	`fails the saving throw[^.!?]+?is instead{@condition ([^}]+)}`, // ERLW :: Sul Khatesh :: Maddening Secrets
	`on a failure, the [^.!?]+? can [^.!?]+?{@condition ([^}]+)}`, // ERLW :: Zakya Rakshasa :: Martial Prowess
	`the {@condition ([^}]+)} creature can repeat the saving throw`, // GGR :: Archon of the Triumvirate :: Pacifying Presence
	`if the (?:${TagCondition.__TGT}|creature) is already {@condition [^}]+}, it becomes {@condition ([^}]+)}`,
	`(?:creature|${TagCondition.__TGT}) (?:also becomes|is) {@condition ([^}]+)}`, // MTF :: Eidolon :: Divine Dread
	`magically (?:become|turn)s? {@condition (invisible)}`, // MM :: Will-o'-Wisp :: Invisibility
	`The (?:[^.]+) is {@condition (invisible)}`, // MM :: Invisible Stalker :: Invisibility
].map(it => new RegExp(`${it}((?:, {@condition [^}]+})*)(,? (?:and|or) {@condition [^}]+})?`, "gi"));

class TagUtil {
	static isNoneOrEmpty (str) {
		if (!str || !str.trim()) return false;
		return !!TagUtil.NONE_EMPTY_REGEX.exec(str);
	}
}
TagUtil.NONE_EMPTY_REGEX = /^(([-\u2014\u2013\u2221])+|none)$/gi;

class DiceConvert {
	static convertTraitActionDice (traitOrAction) {
		if (traitOrAction.entries) {
			traitOrAction.entries = traitOrAction.entries
				.filter(it => it.trim ? it.trim() : true)
				.map(entry => this._getConvertedEntry(entry, true));
		}
	}

	static getTaggedEntry (entry) {
		return this._getConvertedEntry(entry);
	}

	static _getConvertedEntry (entry, isTagHits = false) {
		if (!DiceConvert._walker) {
			DiceConvert._walker = MiscUtil.getWalker({
				keyBlacklist: new Set([
					...MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST,
					"dmg1",
					"dmg2",
				]),
			});
			DiceConvert._walkerHandlers = {string: DiceConvert._walkerStringHandler.bind(DiceConvert, isTagHits)};
		}
		entry = MiscUtil.copy(entry);
		return DiceConvert._walker.walk(entry, DiceConvert._walkerHandlers);
	}

	static _walkerStringHandler (isTagHits, str) {
		if (isTagHits) {
			// replace e.g. "+X to hit"
			str = str.replace(/([-+])?\d+(?= to hit)/g, function (match) {
				const cleanMatch = match.startsWith("+") ? match.replace("+", "") : match;
				return `{@hit ${cleanMatch}}`;
			});
		}

		// re-tag + format dice
		str = str.replace(/(\s*[-+]\s*)?(([1-9]\d*)?d([1-9]\d*)(\s*?[-+×x*÷/]\s*?(\d,\d|\d)+(\.\d+)?)?)+(?:\s*\+\s*\bPB\b)?/gi, (...m) => {
			const expanded = m[0].replace(/([^0-9d.,PB])/gi, " $1 ").replace(/\s+/g, " ");
			return `{@dice ${expanded}}`;
		});

		// unwrap double-tagged
		let last;
		do {
			last = str;
			str = str.replace(/{@(dice|damage|scaledice|scaledamage|d20) ([^}]*){@(dice|damage|scaledice|scaledamage|d20) ([^}]*)}([^}]*)}/gi, (...m) => {
				// Choose the strongest dice type we have
				const nxtType = [
					m[1] === "scaledamage" || m[3] === "scaledamage" ? "scaledamage" : null,
					m[1] === "damage" || m[3] === "damage" ? "damage" : null,
					m[1] === "d20" || m[3] === "d20" ? "d20" : null,
					m[1] === "scaledice" || m[3] === "scaledice" ? "scaledice" : null,
					m[1] === "dice" || m[3] === "dice" ? "dice" : null,
				].filter(Boolean)[0];
				return `{@${nxtType} ${m[2]}${m[4]}${m[5]}}`;
			});
		} while (last !== str);

		do {
			last = str;
			str = str.replace(/{@b ({@(?:dice|damage|scaledice|scaledamage|d20) ([^}]*)})}/gi, "$1");
		} while (last !== str);

		// tag @damage (creature style)
		str = str.replace(/\d+ \({@dice (?:[-+0-9d PB]*)}\)(?:\s+[-+]\s+[-+a-zA-Z0-9 ]*?)?(?: [a-z]+(?:(?:, |, or | or )[a-z]+)*)? damage/ig, (...m) => m[0].replace(/{@dice /gi, "{@damage "));

		// tag @damage (spell/etc style)
		str = str.replace(/{@dice (?:[-+0-9d PB]*)}(?:\s+[-+]\s+[-+a-zA-Z0-9 ]*?)?(?:\s+[-+]\s+the spell's level)?(?: [a-z]+(?:(?:, |, or | or )[a-z]+)*)? damage/ig, (...m) => m[0].replace(/{@dice /gi, "{@damage "));

		return str;
	}

	static cleanHpDice (m) {
		if (m.hp && m.hp.formula) {
			m.hp.formula = m.hp.formula
				.replace(/\s+/g, "") // crush spaces
				.replace(/([^0-9d])/gi, " $1 "); // add spaces
		}
	}
}
DiceConvert._walker = null;

class ArtifactPropertiesTag {
	static tryRun (it, opts) {
		const walker = MiscUtil.getWalker({keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST});
		walker.walk(it, {
			string: (str) => str.replace(/major beneficial|minor beneficial|major detrimental|minor detrimental/gi, (...m) => {
				const mode = m[0].trim().toLowerCase();

				switch (mode) {
					case "major beneficial": return `{@table Artifact Properties; Major Beneficial Properties|dmg|${m[0]}}`;
					case "minor beneficial": return `{@table Artifact Properties; Minor Beneficial Properties|dmg|${m[0]}}`;
					case "major detrimental": return `{@table Artifact Properties; Major Detrimental Properties|dmg|${m[0]}}`;
					case "minor detrimental": return `{@table Artifact Properties; Minor Detrimental Properties|dmg|${m[0]}}`;
				}
			}),
		});
	}
}

class SkillTag {
	static tryRun (it) {
		const walker = MiscUtil.getWalker({keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST});
		return walker.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@skill"],
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
		return strMod.replace(/(^|[ "(\u2013\u2014])(Acrobatics|Animal Handling|Arcana|Athletics|Deception|History|Insight|Intimidation|Investigation|Medicine|Nature|Perception|Performance|Persuasion|Religion|Sleight of Hand|Stealth|Survival)([ "',.:;)\u2013\u2014]|$)/g, (...m) => `${m[1]}{@skill ${m[2]}}${m[3]}`);
	}
}

class ActionTag {
	static tryRun (it) {
		const walker = MiscUtil.getWalker({keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST});
		return walker.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@action"],
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
		// Avoid tagging text within titles
		if (strMod.toTitleCase() === strMod) return strMod;

		const reAction = /(^|[ "(\u2013\u2014])(Attack|Dash|Disengage|Dodge|Help|Hide|Ready|Search|Use an Object|shove a creature)([ "',.:;)\u2013\u2014]|$)/g;
		let mAction;

		while ((mAction = reAction.exec(strMod))) {
			const ixMatchEnd = mAction.index + mAction[0].length;

			const ptTag = mAction[2] === "shove a creature" ? "shove" : mAction[2];
			const ptTrailing = mAction[2] === "shove a creature" ? ` a creature${mAction[3]}` : mAction[3];
			const replaceAs = `${mAction[1]}{@action ${ptTag}}${ptTrailing}`;

			strMod = `${strMod.slice(0, mAction.index)}${replaceAs}${strMod.slice(ixMatchEnd, strMod.length)}`
				.replace(/{@action Attack} (and|or) damage roll/g, "Attack $1 damage roll")
			;

			mAction.index += replaceAs.length - 1;
		}

		return strMod;
	}
}

class SenseTag {
	static tryRun (it) {
		const walker = MiscUtil.getWalker({keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST});
		return walker.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@sense"],
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
		return strMod.replace(/(tremorsense|blindsight|truesight|darkvision)/g, (...m) => `{@sense ${m[0]}}`);
	}
}

class EntryConvert {
	static tryRun (stats, prop) {
		if (!stats[prop]) return;
		const walker = MiscUtil.getWalker({keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST});
		walker.walk(
			stats,
			{
				array: (arr, objProp) => {
					if (objProp !== prop) return arr;

					const getNewList = () => ({type: "list", items: []});
					const checkFinalizeList = () => {
						if (tmpList.items.length) {
							out.push(tmpList);
							tmpList = getNewList();
						}
					};

					const out = [];
					let tmpList = getNewList();

					for (let i = 0; i < arr.length; ++i) {
						const it = arr[i];

						if (typeof it !== "string") {
							checkFinalizeList();
							out.push(it);
							continue;
						}

						const mBullet = /^\s*[-•]\s*(.*)$/.exec(it);
						if (!mBullet) {
							checkFinalizeList();
							out.push(it);
							continue;
						}

						tmpList.items.push(mBullet[1].trim());
					}

					checkFinalizeList();

					return out;
				},
			},
		);
	}

	/**
	 *
	 * @param ptrI
	 * @param toConvert
	 * @param [opts]
	 * @param [opts.fnStop] Function which should return true for the current line if it is to stop coalescing.
	 */
	static coalesceLines (ptrI, toConvert, opts) {
		opts = opts || {};

		if (toConvert[ptrI._] == null) return [];

		let curLine = toConvert[ptrI._].trim();

		const entries = [];
		const stack = [
			entries,
		];

		const popList = () => { while (stack.last().type === "list") stack.pop(); };
		const popNestedEntries = () => { while (stack.length > 1) stack.pop(); };

		const addEntry = (entry, canCombine) => {
			canCombine = canCombine && typeof entry === "string";

			const target = stack.last();
			if (target instanceof Array) {
				if (canCombine && typeof target.last() === "string") {
					target.last(`${target.last().trimRight()} ${entry.trimLeft()}`);
				} else {
					target.push(entry);
				}
			} else if (target.type === "list") {
				if (canCombine && typeof target.items.last() === "string") {
					target.items.last(`${target.items.last().trimRight()} ${entry.trimLeft()}`);
				} else {
					target.items.push(entry);
				}
			} else if (target.type === "entries") {
				if (canCombine && typeof target.entries.last() === "string") {
					target.entries.last(`${target.entries.last().trimRight()} ${entry.trimLeft()}`);
				} else {
					target.entries.push(entry);
				}
			}

			if (typeof entry !== "string") stack.push(entry);
		};

		const getCurrentEntryArray = () => {
			if (stack.last().type === "list") return stack.last().items;
			if (stack.last().type === "entries") return stack.last().entries;
			return stack.last();
		};

		while (ptrI._ < toConvert.length) {
			if (opts.fnStop && opts.fnStop(curLine)) break;

			if (BaseParser._isJsonLine(curLine)) {
				popNestedEntries(); // this implicitly pops nested lists

				addEntry(BaseParser._getJsonFromLine(curLine));
			} else if (ConvertUtil.isListItemLine(curLine)) {
				if (stack.last().type !== "list") {
					const list = {
						type: "list",
						items: [],
					};
					addEntry(list);
				}

				curLine = curLine.replace(/^\s*•\s*/, "");
				addEntry(curLine.trim());
			} else if (ConvertUtil.isNameLine(curLine)) {
				popNestedEntries(); // this implicitly pops nested lists

				const {name, entry} = ConvertUtil.splitNameLine(curLine);

				const parentEntry = {
					type: "entries",
					name,
					entries: [entry],
				};

				addEntry(parentEntry);
			} else if (ConvertUtil.isTitleLine(curLine)) {
				popNestedEntries(); // this implicitly pops nested lists

				const entry = {
					type: "entries",
					name: curLine.trim(),
					entries: [],
				};

				addEntry(entry);
			} else if (BaseParser._isContinuationLine(getCurrentEntryArray(), curLine)) {
				addEntry(curLine.trim(), true);
			} else {
				popList();

				addEntry(curLine.trim());
			}

			ptrI._++;
			curLine = toConvert[ptrI._];
		}

		return entries;
	}
}

class ConvertUtil {
	static getTokens (str) { return str.split(/[ \n\u2013\u2014]/g).map(it => it.trim()).filter(Boolean); }

	/**
	 * (Inline titles)
	 * Checks if a line of text starts with a name, e.g.
	 * "Big Attack. Lorem ipsum..." vs "Lorem ipsum..."
	 */
	static isNameLine (line) {
		const spl = line.split(/[.!?]/);
		if (spl.map(it => it.trim()).filter(Boolean).length === 1) return false;

		// ignore everything inside parentheses
		const namePart = ConvertUtil.getWithoutParens(spl[0]);

		const reStopwords = new RegExp(`^(${StrUtil.TITLE_LOWER_WORDS.join("|")})$`, "i");
		const tokens = namePart.split(/([ ,;:]+)/g);
		const cleanTokens = tokens.filter(it => {
			const isStopword = reStopwords.test(it.trim());
			reStopwords.lastIndex = 0;
			return !isStopword;
		});

		const namePartNoStopwords = cleanTokens.join("");

		// if it's an ability score, it's not a name
		if (Object.values(Parser.ATB_ABV_TO_FULL).includes(namePartNoStopwords.trim())) return false;

		// if it's in title case after removing all stopwords, it's a name
		return namePartNoStopwords.toTitleCase() === namePartNoStopwords;
	}

	static isTitleLine (line) {
		line = line.trim();
		if (/[.!?:]/.test(line)) return false;
		return line.toTitleCase() === line;
	}

	static isListItemLine (line) { return line.trim().startsWith("•"); }

	static splitNameLine (line, isKeepPunctuation) {
		let spl = line.split(/([.!?:])/g);

		// Handle e.g. "1. Freezing Ray. ..."
		if (/^\d+$/.test(spl[0]) && spl.length > 3) {
			spl = [
				`${spl[0]}${spl[1]}${spl[2]}`,
				...spl.slice(3),
			];
		}

		const rawName = spl[0];
		const entry = line.substring(rawName.length + 1, line.length).trim();
		const name = this.getCleanTraitActionName(rawName);
		const out = {name, entry};
		if (isKeepPunctuation) out.name += spl[1].trim();
		return out;
	}

	static getCleanTraitActionName (name) {
		return name
			// capitalise unit in e.g. "(3/Day)"
			.replace(/(\(\d+\/)([a-z])([^)]+\))/g, (...m) => `${m[1]}${m[2].toUpperCase()}${m[3]}`)
		;
	}

	/**
	 * Takes a string containing parenthesized parts, and removes them.
	 */
	static getWithoutParens (string) {
		let skipSpace = false;
		let char;
		let cleanString = "";

		const len = string.length;
		for (let i = 0; i < len; ++i) {
			char = string[i];

			switch (char) {
				case ")": {
					// scan back through the stack, remove last parens
					let foundOpen = -1;
					for (let j = cleanString.length - 1; j >= 0; --j) {
						if (cleanString[j] === "(") {
							foundOpen = j;
							break;
						}
					}

					if (~foundOpen) {
						cleanString = cleanString.substring(0, foundOpen);
						skipSpace = true;
					} else {
						cleanString += ")";
					}
					break;
				}
				case " ":
					if (skipSpace) skipSpace = false;
					else cleanString += " ";
					break;
				default:
					skipSpace = false;
					cleanString += char;
					break;
			}
		}

		return cleanString;
	}

	static cleanDashes (str) { return str.replace(/[-\u2011-\u2015]/g, "-"); }

	static isStatblockLineHeaderStart (start, line) {
		const m = this._getStatblockLineHeaderRegExp(start).exec(line);
		return m?.index === 0;
	}

	static getStatblockLineHeaderText (start, line) {
		const m = this._getStatblockLineHeaderRegExp(start).exec(line);
		if (!m) return line;
		return line.slice(m.index + m[0].length).trim();
	}

	static _getStatblockLineHeaderRegExp (start) {
		return new RegExp(`\\s*${start.escapeRegexp()}\\s*?(?::|\\.|\\b)\\s*`, "i");
	}
}

class AlignmentUtil {

}
// These are arranged in order of preferred precedence
AlignmentUtil.ALIGNMENTS_RAW = {
	"lawful good": ["L", "G"],
	"neutral good": ["N", "G"],
	"chaotic good": ["C", "G"],
	"chaotic neutral": ["C", "N"],
	"lawful evil": ["L", "E"],
	"lawful neutral": ["L", "N"],
	"neutral evil": ["N", "E"],
	"chaotic evil": ["C", "E"],

	"(?:any )?non-good( alignment)?": ["L", "NX", "C", "NY", "E"],
	"(?:any )?non-lawful( alignment)?": ["NX", "C", "G", "NY", "E"],
	"(?:any )?non-evil( alignment)?": ["L", "NX", "C", "NY", "G"],
	"(?:any )?non-chaotic( alignment)?": ["NX", "L", "G", "NY", "E"],

	"(?:any )?chaotic( alignment)?": ["C", "G", "NY", "E"],
	"(?:any )?evil( alignment)?": ["L", "NX", "C", "E"],
	"(?:any )?lawful( alignment)?": ["L", "G", "NY", "E"],
	"(?:any )?good( alignment)?": ["L", "NX", "C", "G"],

	"good": ["G"],
	"lawful": ["L"],
	"neutral": ["N"],
	"chaotic": ["C"],
	"evil": ["E"],

	"any neutral( alignment)?": ["NX", "NY", "N"],

	"unaligned": ["U"],

	"any alignment": ["A"],
};
AlignmentUtil.ALIGNMENTS = {};
Object.entries(AlignmentUtil.ALIGNMENTS_RAW).forEach(([k, v]) => {
	AlignmentUtil.ALIGNMENTS[k] = {
		output: v,
		regex: RegExp(`^${k}$`, "i"),
		regexChance: RegExp(`^${k}\\s*\\((\\d+)\\s*%\\)$`, "i"),
		regexWeak: RegExp(k, "i"),
	};
});

if (typeof module !== "undefined") {
	module.exports = {
		ConvertUtil,
		ConverterConst,
		BaseParser,
		TagCondition,
		SenseTag,
		DiceConvert,
		ArtifactPropertiesTag,
		EntryConvert,
		SkillTag,
		ActionTag,
		TaggerUtils,
		TagUtil,
		AlignmentUtil,
	};
}
