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
ConverterConst.RE_DAMAGE_TYPE = new RegExp(`\\b${ConverterConst.STR_RE_DAMAGE_TYPE}\\b`, "g");

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

	static _getCleanInput (ipt, options = null) {
		let iptClean = ipt
			.replace(/\n\r/g, "\n")
			.replace(/\r\n/g, "\n")
			.replace(/\r/g, "\n")
			.replace(/­\s*\n\s*/g, "")
			.replace(/[−–‒]/g, "-") // convert minus signs to hyphens
		;

		iptClean = CleanUtil.getCleanString(iptClean, {isFast: false})
			// Ensure CR always has a space before the dash
			.replace(/(Challenge)([-\u2012-\u2014])/, "$1 $2");

		// Connect together words which are divided over two lines
		iptClean = iptClean
			.replace(/((?: | ")[A-Za-z][a-z]+)- *\n([a-z])/g, "$1$2");

		// Connect line-broken parentheses
		iptClean = this._getCleanInput_parens(iptClean, "(", ")");
		iptClean = this._getCleanInput_parens(iptClean, "[", "]");
		iptClean = this._getCleanInput_parens(iptClean, "{", "}");

		// Connect lines ending in, or starting in, a comma
		iptClean = iptClean
			.replace(/, *\n+ */g, ", ")
			.replace(/ *\n+, */g, ", ");

		iptClean = iptClean
			// Connect together e.g. `5d10\nForce damage`
			.replace(new RegExp(`(?<start>\\d+) *\\n+(?<end>${ConverterConst.STR_RE_DAMAGE_TYPE} damage)\\b`, "gi"), (...m) => `${m.last().start} ${m.last().end}`)
			// Connect together likely determiners/conjunctions
			.replace(/(?<start>\b(the|a|an|this|that|these|those|its|his|her|their|have|extra|and|or) *)\n+\s*/g, (...m) => `${m.last().start} `)
			// Connect together e.g.:
			//  - `+5\nto hit`, `your Spell Attack Modifier\nto hit`
			//  - `your Wisdom\nmodifier`
			.replace(/(?<start>[a-z0-9]) *\n+ *(?<end>to hit|modifier)\b/g, (...m) => `${m.last().start} ${m.last().end}`)
			// Connect together `<ability> (<skill>)`
			.replace(new RegExp(`\\b(?<start>${Object.values(Parser.ATB_ABV_TO_FULL).join("|")}) *\\n+ *(?<end>\\((?:${Object.keys(Parser.SKILL_TO_ATB_ABV).join("|")})\\))`, "gi"), (...m) => `${m.last().start.trim()} ${m.last().end.trim()}`)
		;

		if (options) {
			// Apply `PAGE=...`
			iptClean = iptClean
				.replace(/(?:\n|^)PAGE=(?<page>\d+)(?:\n|$)/gi, (...m) => {
					options.page = Number(m.last().page);
					return "";
				});
		}

		return iptClean;
	}

	static _getCleanInput_parens (iptClean, cOpen, cClose) {
		const lines = iptClean
			.split("\n");

		for (let i = 0; i < lines.length; ++i) {
			const line = lines[i];
			const lineNxt = lines[i + 1];
			if (!lineNxt) continue;

			const cntOpen = line.split(cOpen).length - 1;
			const cntClose = line.split(cClose).length - 1;

			if (cntOpen <= cntClose) continue;

			lines[i] = `${line} ${lineNxt}`.replace(/ {2}/g, " ");
			lines.splice(i + 1, 1);
			i--;
		}

		return lines.join("\n");
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
	 * @param [opts.noDc] Disable "DC" checking
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
		// If the current string ends in a conjunction
		if (/ (?:and|or)\s*$/.test(lastEntry)) return true;

		const cleanLine = curLine.trim();

		if (/^\d..-\d.. level\s+\(/.test(cleanLine) && !opts.noSpellcastingWarlockSlotLevel) return false;

		// Start of a list item
		if (/^[•●]/.test(cleanLine)) return false;

		// A lowercase word
		if (/^[a-z]/.test(cleanLine) && !opts.noLowercase) return true;
		// An ordinal (e.g. "3rd"), but not a spell level (e.g. "1st level")
		if (/^\d[a-z][a-z]/.test(cleanLine) && !/^\d[a-z][a-z] level/gi.test(cleanLine)) return true;
		// A number (e.g. damage; "5 (1d6 + 2)"), optionally with slash-separated parts (e.g. "30/120 ft.")
		if (/^\d+(\/\d+)*\s+/.test(cleanLine) && !opts.noNumber) return true;
		// Opening brackets (e.g. damage; "(1d6 + 2)")
		if (/^\(/.test(cleanLine) && !opts.noParenthesis) return true;
		// An ability score name followed by "saving throw"
		if (/^(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/.test(cleanLine) && !opts.noSavingThrow) return true;
		// An ability score name
		if (/^(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s/.test(cleanLine) && !opts.noAbilityName) return true;
		// "Hit:" e.g. inside creature attacks
		if (/^Hit:/.test(cleanLine) && !opts.noHit) return true;
		if (/^(Intelligence|Wisdom|Charisma)\s+\(/.test(cleanLine) && !opts.noSpellcastingAbility) return true;
		if (/^DC\s+/.test(cleanLine) && !opts.noDc) return true;

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
	static _ALL_LEGENDARY_GROUPS = null;
	static _ALL_SPELLS = null;
	static init ({legendaryGroups, spells}) {
		this._ALL_LEGENDARY_GROUPS = legendaryGroups;
		this._ALL_SPELLS = spells;
	}

	static findLegendaryGroup ({name, source}) {
		name = name.toLowerCase();
		source = source.toLowerCase();

		const doFind = arr => arr.find(it => it.name.toLowerCase() === name && it.source.toLowerCase() === source);

		const fromPrerelease = typeof PrereleaseUtil !== "undefined" ? doFind(PrereleaseUtil.getBrewProcessedFromCache("legendaryGroup")) : null;
		if (fromPrerelease) return fromPrerelease;

		const fromBrew = typeof BrewUtil2 !== "undefined" ? doFind(BrewUtil2.getBrewProcessedFromCache("legendaryGroup")) : null;
		if (fromBrew) return fromBrew;

		return doFind(this._ALL_LEGENDARY_GROUPS);
	}

	static findSpell ({name, source}) {
		name = name.toLowerCase();
		source = source.toLowerCase();

		const doFind = arr => arr.find(s => (s.name.toLowerCase() === name || (typeof s.srd === "string" && s.srd.toLowerCase() === name)) && s.source.toLowerCase() === source);

		const fromPrerelease = typeof PrereleaseUtil !== "undefined" ? doFind(PrereleaseUtil.getBrewProcessedFromCache("spell")) : null;
		if (fromPrerelease) return fromPrerelease;

		const fromBrew = typeof BrewUtil2 !== "undefined" ? doFind(BrewUtil2.getBrewProcessedFromCache("spell")) : null;
		if (fromBrew) return fromBrew;

		return doFind(this._ALL_SPELLS);
	}

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

	static getSpellsFromString (str, {cbMan} = {}) {
		const strSpellcasting = str;
		const knownSpells = {};
		strSpellcasting.replace(/{@spell ([^}]+)}/g, (...m) => {
			let [spellName, spellSource] = m[1].split("|").map(it => it.toLowerCase());
			spellSource = spellSource || Parser.SRC_PHB.toLowerCase();

			(knownSpells[spellSource] = knownSpells[spellSource] || new Set()).add(spellName);
		});

		const out = [];

		Object.entries(knownSpells)
			.forEach(([source, spellSet]) => {
				spellSet.forEach(it => {
					const spell = TaggerUtils.findSpell({name: it, source});
					if (!spell) return cbMan ? cbMan(`${it} :: ${source}`) : null;

					out.push(spell);
				});
			});

		return out;
	}
}

class TagCondition {
	static _getConvertedEntry (mon, entry, {inflictedSet, inflictedAllowlist} = {}) {
		const walker = MiscUtil.getWalker({keyBlocklist: TagCondition._KEY_BLOCKLIST});
		const nameStack = [];
		const walkerHandlers = {
			preObject: (obj) => nameStack.push(obj.name),
			postObject: () => nameStack.pop(),
			string: [
				(str) => {
					if (nameStack.includes("Antimagic Susceptibility")) return str;
					if (nameStack.includes("Sneak Attack (1/Turn)")) return str;
					const ptrStack = {_: ""};
					return TagCondition._walkerStringHandler(ptrStack, 0, 0, str, {inflictedSet, inflictedAllowlist});
				},
			],
		};
		entry = MiscUtil.copy(entry);
		return walker.walk(entry, walkerHandlers);
	}

	static _getModifiedString (str) {
		return str
			.replace(TagCondition._CONDITION_MATCHER, (...m) => `{@condition ${m[1]}}`)
			.replace(TagCondition._STATUS_MATCHER, (...m) => `{@status ${m[1]}}`)
			.replace(TagCondition._STATUS_MATCHER_ALT, (...m) => `{@status ${TagCondition._STATUS_MATCHER_ALT_REPLACEMENTS[m[1].toLowerCase()]}${m[1]}}`)
		;
	}

	static _walkerStringHandler (ptrStack, depth, conditionCount, str, {inflictedSet, inflictedAllowlist} = {}) {
		TaggerUtils.walkerStringHandler(
			["@condition", "@status"],
			ptrStack,
			depth,
			conditionCount,
			str,
			{
				fnTag: this._getModifiedString.bind(this),
			},
		);

		// Only the outermost loop needs return the final string
		if (depth !== 0) return;

		// Collect inflicted conditions for tagging
		if (inflictedSet) this._collectInflictedConditions(ptrStack._, {inflictedSet, inflictedAllowlist});

		return ptrStack._;
	}

	static _handleProp (m, prop, {inflictedSet, inflictedAllowlist} = {}) {
		if (!m[prop]) return;

		m[prop] = m[prop].map(entry => this._getConvertedEntry(m, entry, {inflictedSet, inflictedAllowlist}));
	}

	static tryTagConditions (m, {isTagInflicted = false, isInflictedAddOnly = false, inflictedAllowlist = null} = {}) {
		const inflictedSet = isTagInflicted ? new Set() : null;

		this._handleProp(m, "action", {inflictedSet, inflictedAllowlist});
		this._handleProp(m, "reaction", {inflictedSet, inflictedAllowlist});
		this._handleProp(m, "bonus", {inflictedSet, inflictedAllowlist});
		this._handleProp(m, "trait", {inflictedSet, inflictedAllowlist});
		this._handleProp(m, "legendary", {inflictedSet, inflictedAllowlist});
		this._handleProp(m, "mythic", {inflictedSet, inflictedAllowlist});
		this._handleProp(m, "variant", {inflictedSet, inflictedAllowlist});
		this._handleProp(m, "entries", {inflictedSet, inflictedAllowlist});
		this._handleProp(m, "entriesHigherLevel", {inflictedSet, inflictedAllowlist});

		this._mutAddInflictedSet({m, inflictedSet, isInflictedAddOnly, prop: "conditionInflict"});
	}

	static _collectInflictedConditions (str, {inflictedSet, inflictedAllowlist} = {}) {
		if (!inflictedSet) return;

		TagCondition._CONDITION_INFLICTED_MATCHERS.forEach(re => str.replace(re, (...m) => {
			this._collectInflictedConditions_withAllowlist({inflictedSet, inflictedAllowlist, cond: m[1]});

			// ", {@condition ...}, ..."
			if (m[2]) m[2].replace(/{@condition ([^}]+)}/g, (...n) => this._collectInflictedConditions_withAllowlist({inflictedSet, inflictedAllowlist, cond: n[1]}));

			// " and {@condition ...}
			if (m[3]) m[3].replace(/{@condition ([^}]+)}/g, (...n) => this._collectInflictedConditions_withAllowlist({inflictedSet, inflictedAllowlist, cond: n[1]}));
		}));
	}

	static _collectInflictedConditions_withAllowlist ({inflictedAllowlist, inflictedSet, cond}) {
		if (!inflictedAllowlist || inflictedAllowlist.has(cond)) inflictedSet.add(cond);
		return "";
	}

	static tryTagConditionsSpells (m, {cbMan, isTagInflicted, isInflictedAddOnly, inflictedAllowlist} = {}) {
		if (!m.spellcasting) return false;

		const inflictedSet = isTagInflicted ? new Set() : null;

		const spells = TaggerUtils.getSpellsFromString(JSON.stringify(m.spellcasting), {cbMan});
		spells.forEach(spell => {
			if (spell.conditionInflict) spell.conditionInflict.filter(c => !inflictedAllowlist || inflictedAllowlist.has(c)).forEach(c => inflictedSet.add(c));
		});

		this._mutAddInflictedSet({m, inflictedSet, isInflictedAddOnly, prop: "conditionInflictSpell"});
	}

	static tryTagConditionsRegionalsLairs (m, {cbMan, isTagInflicted, isInflictedAddOnly, inflictedAllowlist} = {}) {
		if (!m.legendaryGroup) return;

		const inflictedSet = isTagInflicted ? new Set() : null;

		const meta = TaggerUtils.findLegendaryGroup({name: m.legendaryGroup.name, source: m.legendaryGroup.source});
		if (!meta) return cbMan ? cbMan(m.legendaryGroup) : null;
		this._collectInflictedConditions(JSON.stringify(meta), {inflictedSet, inflictedAllowlist});

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
		const walker = MiscUtil.getWalker({keyBlocklist: TagCondition._KEY_BLOCKLIST});

		return walker.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@condition", "@status"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._getModifiedString.bind(this),
						},
					);
					return ptrStack._
						.replace(/{@condition (prone)} (to)\b/gi, "$1 $2")
					;
				},
			},
		);
	}
	// endregion
}
TagCondition._KEY_BLOCKLIST = new Set([
	...MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST,
	"conditionImmune",
]);
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
TagCondition._CONDITION_MATCHER = new RegExp(`\\b(${TagCondition._CONDITIONS.join("|")})\\b`, "g");
TagCondition._STATUS_MATCHER = new RegExp(`\\b(concentration)\\b`, "g");
TagCondition._STATUS_MATCHER_ALT = new RegExp(`\\b(concentrating)\\b`, "g");
TagCondition._STATUS_MATCHER_ALT_REPLACEMENTS = {
	"concentrating": "concentration||",
};
// Each should have one group which matches the condition name.
//   A comma/and part is appended to the end to handle chains of conditions.
TagCondition.__TGT = `(?:target|wielder)`;
TagCondition._CONDITION_INFLICTED_MATCHERS = [
	`(?:creature|enemy|target) is \\w+ {@condition ([^}]+)}`, // "is knocked prone"
	`(?:creature|enemy|target) becomes (?:\\w+ )?{@condition ([^}]+)}`,
	`saving throw (?:by \\d+ or more, it )?is (?:\\w+ )?{@condition ([^}]+)}`, // MM :: Sphinx :: First Roar
	`(?:the save|fails) by \\d+ or more, [^.!?]+?{@condition ([^}]+)}`, // VGM :: Fire Giant Dreadnought :: Shield Charge
	`(?:${TagCondition.__TGT}|creatures?|humanoid|undead|other creatures|enemy) [^.!?]+?(?:succeed|make|pass)[^.!?]+?saving throw[^.!?]+?or (?:fall|be(?:come)?|is) (?:\\w+ )?{@condition ([^}]+)}`,
	`and then be (?:\\w+ )?{@condition ([^}]+)}`,
	`(?:be|is) knocked (?:\\w+ )?{@condition (prone|unconscious)}`,
	`a (?:\\w+ )?{@condition [^}]+} (?:creature|enemy) is (?:\\w+ )?{@condition ([^}]+)}`, // e.g. `a frightened creature is paralyzed`
	`(?<!if )the[^.!?]+?${TagCondition.__TGT} is [^.!?]*?(?<!that isn't ){@condition ([^}]+)}`,
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
	`(?<!if the )(?:creature|${TagCondition.__TGT}) (?:also becomes|is) {@condition ([^}]+)}`, // MTF :: Eidolon :: Divine Dread
	`magically (?:become|turn)s? {@condition (invisible)}`, // MM :: Will-o'-Wisp :: Invisibility
	{re: `The (?!(?:[^.]+) can sense)(?:[^.]+) is {@condition (invisible)}`, flags: "g"}, // MM :: Invisible Stalker :: Invisibility
	`succeed\\b[^.!?]+\\bsaving throw\\b[^.!?]+\\. (?:It|The (?:creature|target)) is {@condition ([^}]+)}`, // MM :: Beholder :: 6. Telekinetic Ray
]
	.map(it => typeof it === "object" ? it : ({re: it, flags: "gi"}))
	.map(({re, flags}) => new RegExp(`${re}((?:, {@condition [^}]+})*)(,? (?:and|or) {@condition [^}]+})?`, flags));

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
				keyBlocklist: new Set([
					...MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST,
					"dmg1",
					"dmg2",
					"area",
				]),
			});
			DiceConvert._walkerHandlers = {
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@dice", "@hit", "@damage", "@scaledice", "@scaledamage", "@d20"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._walkerStringHandler.bind(this, isTagHits),
						},
					);
					return ptrStack._;
				},
			};
		}
		entry = MiscUtil.copy(entry);
		return DiceConvert._walker.walk(entry, DiceConvert._walkerHandlers);
	}

	static _walkerStringHandler (isTagHits, str) {
		if (isTagHits) {
			// replace e.g. "+X to hit"
			str = str.replace(/(?<op>[-+])?(?<bonus>\d+)(?= to hit)\b/g, (...m) => {
				return `{@hit ${m.last().op === "-" ? "-" : ""}${m.last().bonus}}`;
			});
		}

		// re-tag + format dice
		str = str.replace(/\b(\s*[-+]\s*)?(([1-9]\d*)?d([1-9]\d*)(\s*?[-+×x*÷/]\s*?(\d,\d|\d)+(\.\d+)?)?)+(?:\s*\+\s*\bPB\b)?\b/gi, (...m) => {
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
		const walker = MiscUtil.getWalker({keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST});
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
		const walker = MiscUtil.getWalker({keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST});
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
		return strMod.replace(/\b(Acrobatics|Animal Handling|Arcana|Athletics|Deception|History|Insight|Intimidation|Investigation|Medicine|Nature|Perception|Performance|Persuasion|Religion|Sleight of Hand|Stealth|Survival)\b/g, (...m) => `{@skill ${m[1]}}`);
	}
}

class ActionTag {
	static tryRun (it) {
		const walker = MiscUtil.getWalker({keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST});
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

		const reAction = /\b(Attack|Dash|Disengage|Dodge|Help|Hide|Ready|Search|Use an Object|shove a creature)\b/g;
		let mAction;

		while ((mAction = reAction.exec(strMod))) {
			const ixMatchEnd = mAction.index + mAction[0].length;

			const ptTag = mAction[1] === "shove a creature" ? "shove" : mAction[1];
			const ptTrailing = mAction[1] === "shove a creature" ? ` a creature` : "";
			const replaceAs = `{@action ${ptTag}}${ptTrailing}`;

			strMod = `${strMod.slice(0, mAction.index)}${replaceAs}${strMod.slice(ixMatchEnd, strMod.length)}`
				.replace(/{@action Attack} (and|or) damage roll/g, "Attack $1 damage roll")
			;

			reAction.lastIndex += replaceAs.length - 1;
		}

		strMod = strMod
			.replace(/(Extra|Sneak) {@action Attack}/g, (...m) => `${m[1]} Attack`)
		;

		return strMod;
	}
}

class SenseTag {
	static tryRun (it) {
		const walker = MiscUtil.getWalker({keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST});
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
		return strMod.replace(/(tremorsense|blindsight|truesight|darkvision)/ig, (...m) => `{@sense ${m[0]}${m[0].toLowerCase() === "tremorsense" ? "|MM" : ""}}`);
	}
}

class EntryConvert {
	static tryRun (stats, prop) {
		if (!stats[prop]) return;
		const walker = MiscUtil.getWalker({keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST});
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

						const mBullet = /^\s*[-•●]\s*(.*)$/.exec(it);
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

				curLine = curLine.replace(/^\s*[•●]\s*/, "");
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
	 * @param line
	 * @param {Set} exceptions A set of (lowercase) exceptions which should always be treated as "not a name" (e.g. "cantrips")
	 * @param {RegExp} splitterPunc Regexp to use when splitting by punctuation.
	 * @returns {boolean}
	 */
	static isNameLine (line, {exceptions = null, splitterPunc = null} = {}) {
		const spl = this._getMergedSplitName({line, splitterPunc});
		if (spl.map(it => it.trim()).filter(Boolean).length === 1) return false;

		// ignore everything inside parentheses
		const namePart = ConvertUtil.getWithoutParens(spl[0]);
		if (!namePart) return false; // (If this is _everything_ cancel)

		const reStopwords = new RegExp(`^(${StrUtil.TITLE_LOWER_WORDS.join("|")})$`, "i");
		const tokens = namePart.split(/([ ,;:]+)/g);
		const cleanTokens = tokens.filter(it => {
			const isStopword = reStopwords.test(it.trim());
			reStopwords.lastIndex = 0;
			return !isStopword;
		});

		const namePartNoStopwords = cleanTokens.join("").trim();

		// if it's an ability score, it's not a name
		if (Object.values(Parser.ATB_ABV_TO_FULL).includes(namePartNoStopwords)) return false;

		// if it's a dice, it's not a name
		if (/^\d*d\d+\b/.test(namePartNoStopwords)) return false;

		if (exceptions && exceptions.has(namePartNoStopwords.toLowerCase())) return false;

		// if it's in title case after removing all stopwords, it's a name
		return namePartNoStopwords.toTitleCase() === namePartNoStopwords;
	}

	static isTitleLine (line) {
		line = line.trim();
		if (/[.!?:]/.test(line)) return false;
		return line.toTitleCase() === line;
	}

	static isListItemLine (line) { return /^[•●]/.test(line.trim()); }

	static splitNameLine (line, isKeepPunctuation) {
		const spl = this._getMergedSplitName({line});
		const rawName = spl[0];
		const entry = line.substring(rawName.length + spl[1].length, line.length).trim();
		const name = this.getCleanTraitActionName(rawName);
		const out = {name, entry};

		if (
			isKeepPunctuation
			// If the name ends with something besides ".", maintain it
			|| /^[?!:]"?$/.test(spl[1])
		) out.name += spl[1].trim();

		return out;
	}

	static _getMergedSplitName ({line, splitterPunc}) {
		let spl = line.split(splitterPunc || /([.!?:])/g);

		if (
			spl.length > 3
			&& (
				// Handle e.g. "1. Freezing Ray. ..."
				/^\d+$/.test(spl[0])
				// Handle e.g. "1-10: "All Fine Here!" ..."
				|| /^\d+-\d+:?$/.test(spl[0])
				// Handle e.g. "Action 1: Close In. ...
				|| /^Action \d+$/.test(spl[0])
			)
		) {
			spl = [
				`${spl[0]}${spl[1]}${spl[2]}`,
				...spl.slice(3),
			];
		}

		// Handle e.g. "Mr. Blue" or "If Mr. Blue"
		for (let i = 0; i < spl.length - 2; ++i) {
			const toCheck = `${spl[i]}${spl[i + 1]}`;
			if (!toCheck.split(" ").some(it => ConvertUtil._CONTRACTIONS.has(it))) continue;
			spl[i] = `${spl[i]}${spl[i + 1]}${spl[i + 2]}`;
			spl.splice(i + 1, 2);
		}

		if (spl.length >= 3 && spl[0].includes(`"`) && spl[2].startsWith(`"`)) {
			spl = [
				`${spl[0]}${spl[1]}${spl[2].slice(0, 1)}`,
				"",
				spl[2].slice(1),
				...spl.slice(3),
			];
		}

		return spl;
	}

	static getCleanTraitActionName (name) {
		return name
			// capitalize unit in e.g. "(3/Day)"
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

	static isStatblockLineHeaderStart ({reStartStr, line}) {
		const m = this._getStatblockLineHeaderRegExp({reStartStr}).exec(line);
		return m?.index === 0;
	}

	static getStatblockLineHeaderText ({reStartStr, line}) {
		const m = this._getStatblockLineHeaderRegExp({reStartStr}).exec(line);
		if (!m) return line;
		return line.slice(m.index + m[0].length).trim();
	}

	static _getStatblockLineHeaderRegExp ({reStartStr}) {
		return new RegExp(`\\s*${reStartStr}\\s*?(?::|\\.|\\b)\\s*`, "i");
	}
}
ConvertUtil._CONTRACTIONS = new Set(["Mr.", "Mrs.", "Ms.", "Dr."]);

class AlignmentUtil {
	static tryGetConvertedAlignment (align, {cbMan = null} = {}) {
		if (!(align || "").trim()) return {};

		let alignmentPrefix;

		// region Support WBtW and onwards formatting
		align = align.trim().replace(/^typically\s+/, () => {
			alignmentPrefix = "typically ";
			return "";
		});
		// endregion

		const orParts = (align || "").split(/ or /g).map(it => it.trim().replace(/[.,;]$/g, "").trim());
		const out = [];

		orParts.forEach(part => {
			Object.values(AlignmentUtil.ALIGNMENTS).forEach(it => {
				if (it.regex.test(part)) return out.push({alignment: it.output});

				const mChange = it.regexChance.exec(part);
				if (mChange) out.push({alignment: it.output, chance: Number(mChange[1])});
			});
		});

		if (out.length === 1) return {alignmentPrefix, alignment: out[0].alignment};
		if (out.length) return {alignmentPrefix, alignment: out};

		if (cbMan) cbMan(align);

		return {alignmentPrefix, alignment: align};
	}
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

globalThis.ConvertUtil = ConvertUtil;
globalThis.ConverterConst = ConverterConst;
globalThis.BaseParser = BaseParser;
globalThis.TagCondition = TagCondition;
globalThis.SenseTag = SenseTag;
globalThis.DiceConvert = DiceConvert;
globalThis.ArtifactPropertiesTag = ArtifactPropertiesTag;
globalThis.EntryConvert = EntryConvert;
globalThis.SkillTag = SkillTag;
globalThis.ActionTag = ActionTag;
globalThis.TaggerUtils = TaggerUtils;
globalThis.TagUtil = TagUtil;
globalThis.AlignmentUtil = AlignmentUtil;
