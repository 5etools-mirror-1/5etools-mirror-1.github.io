"use strict";

class _ParseMeta {
	constructor (
		{
			toConvert,
		},
	) {
		this.curLine = null;
		this.ixToConvert = 0;
		this.toConvert = toConvert;

		this.additionalTypeTags = [];
	}

	addAdditionalTypeTag (val) {
		const toFind = val.toLowerCase();
		if (this.additionalTypeTags.some(it => it.toLowerCase() === toFind)) return;
		this.additionalTypeTags.push(val);
	}
}

// TODO easy improvements to be made:
//    - improve "broken line" fixing:
//      - across lines that end with: "Melee Weapon Attack:"
//      - creature's name breaking across multiple lines
//      - lines starting "DC" breaking across multiple lines
//      - lines starting with attack range e.g. "100/400 ft."
class CreatureParser extends BaseParser {
	static _NO_ABSORB_SUBTITLES = [
		"SAVING THROWS",
		"SKILLS",
		"DAMAGE VULNERABILITIES",
		"DAMAGE RESISTANCE",
		"DAMAGE IMMUNITIES",
		"CONDITION IMMUNITIES",
		"SENSES",
		"LANGUAGES",
		"CHALLENGE",
		"PROFICIENCY BONUS",
	];

	static _NO_ABSORB_TITLES = [
		"ACTION",
		"LEGENDARY ACTION",
		"VILLAIN ACTION",
		"MYTHIC ACTION",
		"REACTION",
		"BONUS ACTION",
	];

	static _RE_START_SAVING_THROWS = "(?:Saving Throw|Save)s?";
	static _RE_START_SKILLS = "Skills?";
	static _RE_START_DAMAGE_VULN = "Damage Vulnerabilit(?:y|ies)";
	static _RE_START_DAMAGE_RES = "Damage Resistances?";
	static _RE_START_DAMAGE_IMM = "Damage Immunit(?:y|ies)";
	static _RE_START_CONDITION_IMM = "Condition Immunit(?:y|ies)";
	static _RE_START_SENSES = "Senses?";
	static _RE_START_LANGUAGES = "Languages?";
	static _RE_START_CHALLENGE = "Challenge";
	static _RE_START_PROF_BONUS = "Proficiency Bonus(?: \\(PB\\))?";

	/**
	 * If the current line ends in a comma, we can assume the next line is a broken/wrapped part of the current line
	 */
	static _absorbBrokenLine (
		{
			isCrLine,
			meta,
		},
	) {
		if (!meta.curLine) return false;

		if (isCrLine) return false; // avoid absorbing past the CR line

		const nxtLine = meta.toConvert[meta.ixToConvert + 1];
		if (!nxtLine) return false;

		if (ConvertUtil.isNameLine(nxtLine)) return false; // avoid absorbing the start of traits
		if (this._NO_ABSORB_TITLES.some(it => nxtLine.toUpperCase().includes(it))) return false;
		if (this._NO_ABSORB_SUBTITLES.some(it => nxtLine.toUpperCase().startsWith(it))) return false;

		meta.ixToConvert++;
		meta.curLine = `${meta.curLine.trim()} ${nxtLine.trim()}`;

		return true;
	}

	/**
	 * Parses statblocks from raw text pastes
	 * @param inText Input text.
	 * @param options Options object.
	 * @param options.cbWarning Warning callback.
	 * @param options.cbOutput Output callback.
	 * @param options.isAppend Default output append mode.
	 * @param options.source Entity source.
	 * @param options.page Entity page.
	 * @param options.titleCaseFields Array of fields to be title-cased in this entity (if enabled).
	 * @param options.isTitleCase Whether title-case fields should be title-cased in this entity.
	 */
	static doParseText (inText, options) {
		options = this._getValidOptions(options);

		function startNextPhase (cur) {
			return /^(?:action|legendary action|villain action|mythic action|reaction|bonus action)s?(?:\s+\([^)]+\))?$/i.test(cur);
		}

		if (!inText || !inText.trim()) return options.cbWarning("No input!");
		const toConvert = this._getLinesToConvert({inText, options});

		const stats = {};
		stats.source = options.source || "";
		// for the user to fill out
		stats.page = options.page;

		const meta = new _ParseMeta({toConvert});

		for (; meta.ixToConvert < meta.toConvert.length; meta.ixToConvert++) {
			meta.curLine = meta.toConvert[meta.ixToConvert].trim();

			if (meta.curLine === "") continue;

			// name of monster
			if (meta.ixToConvert === 0) {
				// region
				const mCr = /^(?<name>.*)\s+(?<cr>CR \d+(?:\/\d+)? .*$)/.exec(meta.curLine);
				if (mCr) {
					meta.curLine = mCr.groups.name;
					meta.toConvert.splice(meta.ixToConvert + 1, 0, mCr.groups.cr);
				}
				// endregion

				stats.name = this._getAsTitle("name", meta.curLine, options.titleCaseFields, options.isTitleCase);
				// If the name is immediately repeated, skip it
				if ((meta.toConvert[meta.ixToConvert + 1] || "").trim() === meta.curLine) meta.toConvert.splice(meta.ixToConvert + 1, 1);
				continue;
			}

			// challenge rating alt
			if (ConvertUtil.isStatblockLineHeaderStart({reStartStr: "CR", line: meta.curLine})) {
				// noinspection StatementWithEmptyBodyJS
				while (this._absorbBrokenLine({isCrLine: true, meta}));

				// Region merge following "<n> XP" line into CR line
				const lineNxt = meta.toConvert[meta.ixToConvert + 1];
				if (lineNxt && /^[\d,]+ XP$/.test(lineNxt)) {
					meta.curLine = `${meta.curLine.trim()} (${lineNxt.trim()})`;
					meta.toConvert[meta.ixToConvert] = meta.curLine;
					meta.toConvert.splice(meta.ixToConvert + 1, 1);
				}
				// endregion

				this._setCleanCr(stats, meta, {header: "CR"});

				// remove the line, as we expect alignment as line 1
				meta.toConvert.splice(meta.ixToConvert, 1);
				meta.ixToConvert--;

				continue;
			}

			// homebrew "role"
			if (meta.curLine.toLowerCase() === "companion" || meta.curLine.toLowerCase() === "retainer") {
				meta.addAdditionalTypeTag(meta.curLine.toTitleCase());

				// remove the line, as we expect alignment as line 1
				meta.toConvert.splice(meta.ixToConvert, 1);
				meta.ixToConvert--;

				continue;
			}

			// homebrew resources: "souls"
			if (this._RE_BREW_RESOURCE_SOULS.test(meta.curLine)) {
				this._brew_setResourceSouls(stats, meta, options);
				meta.toConvert.splice(meta.ixToConvert, 1);
				meta.ixToConvert--;
				continue;
			}

			// size type alignment
			if (meta.ixToConvert === 1) {
				this._setCleanSizeTypeAlignment(stats, meta, options);
				continue;
			}

			// armor class
			if (meta.ixToConvert === 2) {
				stats.ac = ConvertUtil.getStatblockLineHeaderText({reStartStr: "Armor Class", line: meta.curLine});
				continue;
			}

			// hit points
			if (meta.ixToConvert === 3) {
				this._setCleanHp(stats, meta.curLine);
				continue;
			}

			// speed
			if (meta.ixToConvert === 4) {
				this._setCleanSpeed(stats, meta.curLine, options);
				continue;
			}

			// ability scores
			if (/STR\s*DEX\s*CON\s*INT\s*WIS\s*CHA/i.test(meta.curLine)) {
				// skip forward a line and grab the ability scores
				++meta.ixToConvert;
				this._mutAbilityScoresFromSingleLine(stats, meta);
				continue;
			}

			// Alternate ability scores (all six abbreviations followed by all six scores, each on new lines)
			if (this._getSequentialAbilityScoreSectionLineCount(stats, meta) === 6) {
				meta.ixToConvert += this._getSequentialAbilityScoreSectionLineCount(stats, meta);
				this._mutAbilityScoresFromSingleLine(stats, meta);
				continue;
			}

			// Alternate ability scores (alternating lines of abbreviation and score)
			if (Parser.ABIL_ABVS.includes(meta.curLine.toLowerCase())) {
				// skip forward a line and grab the ability score
				++meta.ixToConvert;
				switch (meta.curLine.toLowerCase()) {
					case "str": stats.str = this._tryGetStat(meta.toConvert[meta.ixToConvert]); continue;
					case "dex": stats.dex = this._tryGetStat(meta.toConvert[meta.ixToConvert]); continue;
					case "con": stats.con = this._tryGetStat(meta.toConvert[meta.ixToConvert]); continue;
					case "int": stats.int = this._tryGetStat(meta.toConvert[meta.ixToConvert]); continue;
					case "wis": stats.wis = this._tryGetStat(meta.toConvert[meta.ixToConvert]); continue;
					case "cha": stats.cha = this._tryGetStat(meta.toConvert[meta.ixToConvert]); continue;
				}
			}

			// Alternate ability scores ()
			if (this._handleSpecialAbilityScores({stats, meta})) {
				continue;
			}

			// saves (optional)
			if (ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_SAVING_THROWS, line: meta.curLine})) {
				// noinspection StatementWithEmptyBodyJS
				while (this._absorbBrokenLine({meta}));
				this._setCleanSaves(stats, meta.curLine, options);
				continue;
			}

			// skills (optional)
			if (ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_SKILLS, line: meta.curLine})) {
				// noinspection StatementWithEmptyBodyJS
				while (this._absorbBrokenLine({meta}));
				this._setCleanSkills(stats, meta.curLine);
				continue;
			}

			// damage vulnerabilities (optional)
			if (
				ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_DAMAGE_VULN, line: meta.curLine})
			) {
				// noinspection StatementWithEmptyBodyJS
				while (this._absorbBrokenLine({meta}));
				this._setCleanDamageVuln(stats, meta.curLine, options);
				continue;
			}

			// damage resistances (optional)
			if (
				ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_DAMAGE_RES, line: meta.curLine})
			) {
				// noinspection StatementWithEmptyBodyJS
				while (this._absorbBrokenLine({meta}));
				this._setCleanDamageRes(stats, meta.curLine, options);
				continue;
			}

			// damage immunities (optional)
			if (
				ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_DAMAGE_IMM, line: meta.curLine})
			) {
				// noinspection StatementWithEmptyBodyJS
				while (this._absorbBrokenLine({meta}));
				this._setCleanDamageImm(stats, meta.curLine, options);
				continue;
			}

			// condition immunities (optional)
			if (
				ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_CONDITION_IMM, line: meta.curLine})
			) {
				// noinspection StatementWithEmptyBodyJS
				while (this._absorbBrokenLine({meta}));
				this._setCleanConditionImm(stats, meta.curLine);
				continue;
			}

			// senses
			if (ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_SENSES, line: meta.curLine})) {
				// noinspection StatementWithEmptyBodyJS
				while (this._absorbBrokenLine({meta}));
				this._setCleanSenses(stats, meta.curLine);
				continue;
			}

			// languages
			if (ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_LANGUAGES, line: meta.curLine})) {
				// noinspection StatementWithEmptyBodyJS
				while (this._absorbBrokenLine({meta}));
				this._setCleanLanguages(stats, meta.curLine);
				continue;
			}

			// challenge rating
			if (ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_CHALLENGE, line: meta.curLine})) {
				// noinspection StatementWithEmptyBodyJS
				while (this._absorbBrokenLine({isCrLine: true, meta}));
				this._setCleanCr(stats, meta, {header: this._RE_START_CHALLENGE});
				continue;
			}

			// proficiency bonus
			if (ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_PROF_BONUS, line: meta.curLine})) {
				// noinspection StatementWithEmptyBodyJS
				while (this._absorbBrokenLine({meta}));
				this._setCleanPbNote(stats, meta.curLine);
				continue;
			}

			// traits
			stats.trait = [];
			stats.action = [];
			stats.reaction = [];
			stats.bonus = [];
			stats.legendary = [];
			stats.mythic = [];

			let curTrait = {};

			let isTraits = true;
			let isActions = false;
			let isReactions = false;
			let isBonusActions = false;
			let isLegendaryActions = false;
			let isLegendaryDescription = false;
			let isMythicActions = false;
			let isMythicDescription = false;

			// Join together lines which are probably split over multiple lines of text
			for (let j = meta.ixToConvert; j < meta.toConvert.length; ++j) {
				let line = meta.toConvert[j];
				let lineNxt = meta.toConvert[j + 1];

				if (!lineNxt) continue;
				if (startNextPhase(line) || startNextPhase(lineNxt)) continue;
				if (/[.?!]$/.test(line.trim()) || !/^[A-Z]/.test(lineNxt.trim())) continue;
				if (ConvertUtil.isNameLine(lineNxt, {exceptions: new Set(["cantrips"]), splitterPunc: /(\.)/g})) continue;

				// Avoid eating spellcasting `At Will: ...`
				const splColonNext = lineNxt.split(":");
				if (line.trim().endsWith(":") && splColonNext.length > 1 && /^[A-Z\d][\\/a-z]/.test(splColonNext[0].trim())) continue;

				meta.toConvert[j] = `${line.trim()} ${lineNxt.trim()}`;
				meta.toConvert.splice(j + 1, 1);
				--j;
			}

			// keep going through traits til we hit actions
			while (meta.ixToConvert < meta.toConvert.length) {
				if (startNextPhase(meta.curLine)) {
					isTraits = false;

					isActions = ConvertUtil.isStatblockLineHeaderStart({reStartStr: "ACTIONS?", line: meta.curLine.toUpperCase()});
					if (isActions) {
						const mActionNote = /actions:?\s*\((.*?)\)/gi.exec(meta.curLine);
						if (mActionNote) stats.actionNote = mActionNote[1];
					}

					isReactions = ConvertUtil.isStatblockLineHeaderStart({reStartStr: "REACTIONS?", line: meta.curLine.toUpperCase()});
					isBonusActions = ConvertUtil.isStatblockLineHeaderStart({reStartStr: "BONUS ACTIONS?", line: meta.curLine.toUpperCase()});
					isLegendaryActions = ConvertUtil.isStatblockLineHeaderStart({reStartStr: "LEGENDARY ACTIONS?", line: meta.curLine.toUpperCase()})
						|| ConvertUtil.isStatblockLineHeaderStart({reStartStr: "VILLAIN ACTIONS?", line: meta.curLine.toUpperCase()});
					isLegendaryDescription = isLegendaryActions;
					isMythicActions = ConvertUtil.isStatblockLineHeaderStart({reStartStr: "MYTHIC ACTIONS", line: meta.curLine.toUpperCase()});
					isMythicDescription = isMythicActions;
					meta.ixToConvert++;
					meta.curLine = meta.toConvert[meta.ixToConvert];
				}

				curTrait.name = "";
				curTrait.entries = [];

				const parseFirstLine = line => {
					const {name, entry} = ConvertUtil.splitNameLine(line);
					curTrait.name = name;
					curTrait.entries.push(entry);
				};

				if (isLegendaryDescription || isMythicDescription) {
					const compressed = meta.curLine.replace(/\s*/g, "").toLowerCase();

					if (isLegendaryDescription) {
						// usually the first paragraph is a description of how many legendary actions the creature can make
						// but in the case that it's missing the substring "legendary" and "action" it's probably an action
						if (!(compressed.includes("legendary") || compressed.includes("villain")) && !compressed.includes("action")) isLegendaryDescription = false;
					} else if (isMythicDescription) {
						// as above--mythic action headers include the text "legendary action"
						if (!compressed.includes("legendary") && !compressed.includes("action")) isLegendaryDescription = false;
					}
				}

				if (isLegendaryDescription) {
					curTrait.entries.push(meta.curLine.trim());
					isLegendaryDescription = false;
				} else if (isMythicDescription) {
					if (/mythic\s+trait/i.test(meta.curLine)) {
						stats.mythicHeader = [meta.curLine.trim()];
					} else {
						curTrait.entries.push(meta.curLine.trim());
					}
					isMythicDescription = false;
				} else {
					parseFirstLine(meta.curLine);
				}

				meta.ixToConvert++;
				meta.curLine = meta.toConvert[meta.ixToConvert];

				// collect subsequent paragraphs
				while (meta.curLine && !ConvertUtil.isNameLine(meta.curLine, {exceptions: new Set(["cantrips"]), splitterPunc: /([.?!])/g}) && !startNextPhase(meta.curLine)) {
					if (BaseParser._isContinuationLine(curTrait.entries, meta.curLine)) {
						curTrait.entries.last(`${curTrait.entries.last().trim()} ${meta.curLine.trim()}`);
					} else {
						curTrait.entries.push(meta.curLine.trim());
					}
					meta.ixToConvert++;
					meta.curLine = meta.toConvert[meta.ixToConvert];
				}

				if (curTrait.name || curTrait.entries) {
					// convert dice tags
					DiceConvert.convertTraitActionDice(curTrait);

					if (isTraits && this._hasEntryContent(curTrait)) stats.trait.push(curTrait);
					if (isActions && this._hasEntryContent(curTrait)) stats.action.push(curTrait);
					if (isReactions && this._hasEntryContent(curTrait)) stats.reaction.push(curTrait);
					if (isBonusActions && this._hasEntryContent(curTrait)) stats.bonus.push(curTrait);
					if (isLegendaryActions && this._hasEntryContent(curTrait)) stats.legendary.push(curTrait);
					if (isMythicActions && this._hasEntryContent(curTrait)) stats.mythic.push(curTrait);
				}

				curTrait = {};
			}

			CreatureParser._PROPS_ENTRIES.forEach(prop => this._doMergeBulletedLists(stats, prop));
			CreatureParser._PROPS_ENTRIES.forEach(prop => this._doMergeNumberedLists(stats, prop));
			["action"].forEach(prop => this._doMergeBreathWeaponLists(stats, prop));

			// Remove keys if they are empty
			if (stats.trait.length === 0) delete stats.trait;
			if (stats.action.length === 0) delete stats.action;
			if (stats.bonus.length === 0) delete stats.bonus;
			if (stats.reaction.length === 0) delete stats.reaction;
			if (stats.legendary.length === 0) delete stats.legendary;
			if (stats.mythic.length === 0) delete stats.mythic;
		}

		this._doCleanLegendaryActionHeader(stats);

		this._addExtraTypeTags(stats, meta);

		this._doStatblockPostProcess(stats, false, options);
		const statsOut = PropOrder.getOrdered(stats, "monster");
		options.cbOutput(statsOut, options.isAppend);
	}

	static _getLinesToConvert ({inText, options}) {
		let clean = this._getCleanInput(inText, options);

		// region Handle bad OCR'ing of headers
		[
			"Legendary Actions?",
			"Villain Actions?",
			"Bonus Actions?",
			"Reactions?",
			"Actions?",
		]
			.map(it => ({re: new RegExp(`\\n\\s*${it.split("").join("\\s*")}\\s*\\n`, "g"), original: it.replace(/[^a-zA-Z ]/g, "")}))
			.forEach(({re, original}) => clean = clean.replace(re, `\n${original}\n`));
		// endregion

		// region Handle bad OCR'ing of dice
		clean = clean.replace(/\nl\/(?<unit>day)[.:]\s*/g, (...m) => `\n1/${m.last().unit}: `)
			.replace(/\b(?<num>[liI!]|\d+)?d[1liI!]\s*[oO0]\b/g, (...m) => `${m.last().num ? isNaN(m.last().num) ? "1" : m.last().num : ""}d10`)
			.replace(/\b(?<num>[liI!]|\d+)?d[1liI!]\s*2\b/g, (...m) => `${m.last().num ? isNaN(m.last().num) ? "1" : m.last().num : ""}d12`)
			.replace(/\b[liI!1]\s*d\s*(?<faces>\d+)\b/g, (...m) => `1d${m.last().faces}`)
			.replace(/\b(?<num>\d+)\s*d\s*(?<faces>\d+)\b/g, (...m) => `${m.last().num}d${m.last().faces}`)
			// endregion
			// region Handle misc OCR issues
			.replace(/\bI nt\b/g, "Int")
			.replace(/\(-[lI!]\)/g, "(-1)")
			// endregion
			// Handle pluses split across lines
			.replace(/(\+\s*)\n+(\d+)/g, (...m) => `${m[1]}${m[2]}`)
			// Handle CR XP on separate line
			.replace(/\n(\([\d,]+ XP\)\n)/g, (...m) => m[1])
		;

		clean = clean
			// We don't expect any bare lines starting with parens
			.replace(/ *\n\(/, " (");

		const statsHeadFootSpl = clean.split(/(Challenge|Proficiency Bonus \(PB\))/i);

		statsHeadFootSpl[0] = statsHeadFootSpl[0]
			// collapse multi-line ability scores
			.replace(/(\d\d?\s*\([-—+]?\d+\)\s*)+/gi, (...m) => `${m[0].replace(/\n/g, " ").replace(/\s+/g, " ")}\n`);

		// (re-assemble after cleaning ability scores and) split into lines
		clean = statsHeadFootSpl.join("");

		// Re-clean after applying the above
		clean = this._getCleanInput(clean);

		let cleanLines = clean.split("\n").filter(it => it && it.trim());

		// Split apart "Challenge" and "Proficiency Bonus" if they are on the same line
		const ixChallengePb = cleanLines.findIndex(line => /^Challenge/.test(line.trim()) && /Proficiency Bonus/.test(line));
		if (~ixChallengePb) {
			let line = cleanLines[ixChallengePb];
			const [challengePart, pbLabel, pbRest] = line.split(/(Proficiency Bonus)/);
			cleanLines[ixChallengePb] = challengePart;
			cleanLines.splice(ixChallengePb + 1, 0, [pbLabel, pbRest].join(""));
		}

		return cleanLines;
	}

	static _handleSpecialAbilityScores ({stats, meta}) {
		const matches = [];

		let i = meta.ixToConvert;
		for (; i < meta.toConvert.length; ++i) {
			const l = meta.toConvert[i].trim();
			const m = new RegExp(`^${Parser.ABIL_ABVS.map(ab => `(?<${ab}>${ab.toUpperCase()}(?:, |\\b))?`).join("")}(?<text>.*)$`).exec(l);
			if (!m) break;
			if (!Parser.ABIL_ABVS.some(ab => m.groups[ab])) break;
			matches.push(m);
		}

		if (!matches.length) return false;

		matches
			.forEach(m => {
				Parser.ABIL_ABVS
					.forEach(ab => {
						if (!m.groups[ab]) return;
						stats[ab] = {special: m.groups.text.trim()};
					});
			});

		meta.ixToConvert += i - meta.ixToConvert;
		return true;
	}

	static _doCleanLegendaryActionHeader (stats) {
		if (!stats.legendary?.length) return;

		stats.legendary = stats.legendary
			.map(it => {
				if (!it.name.trim() && !it.entries.length) return null;

				const m = /can take (\d) legendary actions/gi.exec(it.entries[0]);
				if (!it.name.trim() && m) {
					if (m[1] !== "3") stats.legendaryActions = Number(m[1]);
					return null;
				}

				if (!it.name.trim() && it.entries[0].includes("villain")) {
					stats.legendaryHeader = it.entries;
					return null;
				}

				return it;
			})
			.filter(Boolean);
	}

	static _doMergeBulletedLists (stats, prop) {
		if (!stats[prop]) return;

		stats[prop]
			.forEach(block => {
				if (!block?.entries?.length) return;

				for (let i = 0; i < block.entries.length; ++i) {
					const curLine = block.entries[i];

					if (typeof curLine !== "string" || !curLine.trim().endsWith(":")) continue;

					let lst = null;
					let offset = 1;

					while (block.entries.length) {
						let nxtLine = block.entries[i + offset];

						if (typeof nxtLine !== "string" || !/^[•●]/.test(nxtLine.trim())) break;

						nxtLine = nxtLine.replace(/^[•●]\s*/, "");

						if (!lst) {
							lst = {type: "list", items: [nxtLine]};
							block.entries[i + offset] = lst;
							offset++;
						} else {
							lst.items.push(nxtLine);
							block.entries.splice(i + offset, 1);
						}
					}
				}
			});
	}

	static _doMergeNumberedLists (stats, prop) {
		if (!stats[prop]) return;

		for (let i = 0; i < stats[prop].length; ++i) {
			const cur = stats[prop][i];

			if (
				typeof cur?.entries?.last() === "string"
				&& cur?.entries?.last().trim().endsWith(":")
			) {
				let lst = null;

				while (stats[prop].length) {
					const nxt = stats[prop][i + 1];

					if (/^\d+[.!?:] [A-Za-z]/.test(nxt?.name || "")) {
						if (!lst) {
							lst = {type: "list", style: "list-hang-notitle", items: []};
							cur.entries.push(lst);
						}

						nxt.type = "item";
						nxt.name += ".";
						lst.items.push(nxt);
						stats[prop].splice(i + 1, 1);

						continue;
					}

					break;
				}
			}
		}
	}

	static _doMergeBreathWeaponLists (stats, prop) {
		if (!stats[prop]) return;

		for (let i = 0; i < stats[prop].length; ++i) {
			const cur = stats[prop][i];

			if (
				typeof cur?.entries?.last() === "string"
				&& cur?.entries?.last().trim().endsWith(":")
				&& cur?.entries?.last().trim().includes("following breath weapon")
			) {
				let lst = null;

				while (stats[prop].length) {
					const nxt = stats[prop][i + 1];

					if (/\bbreath\b/i.test(nxt?.name || "")) {
						if (!lst) {
							lst = {type: "list", style: "list-hang-notitle", items: []};
							cur.entries.push(lst);
						}

						nxt.type = "item";
						nxt.name += ".";
						lst.items.push(nxt);
						stats[prop].splice(i + 1, 1);

						continue;
					}

					break;
				}
			}
		}
	}

	/**
	 * Parses statblocks from Homebrewery/GM Binder Markdown
	 * @param inText Input text.
	 * @param options Options object.
	 * @param options.cbWarning Warning callback.
	 * @param options.cbOutput Output callback.
	 * @param options.isAppend Default output append mode.
	 * @param options.source Entity source.
	 * @param options.page Entity page.
	 * @param options.titleCaseFields Array of fields to be title-cased in this entity (if enabled).
	 * @param options.isTitleCase Whether title-case fields should be title-cased in this entity.
	 */
	static doParseMarkdown (inText, options) {
		options = this._getValidOptions(options);

		const isInlineLegendaryActionItem = (line) => /^-\s*\*\*\*?[^*]+/gi.test(line.trim());

		if (!inText || !inText.trim()) return options.cbWarning("No input!");
		const toConvert = this._getCleanInput(inText, options).split("\n");
		let stats = null;

		const getNewStatblock = () => {
			return {
				source: options.source,
				page: options.page,
			};
		};

		let step = 0;
		let hasMultipleBlocks = false;
		const doOutputStatblock = () => {
			if (trait != null) doAddFromParsed();
			if (stats) {
				this._addExtraTypeTags(stats, meta);
				this._doStatblockPostProcess(stats, true, options);
				const statsOut = PropOrder.getOrdered(stats, "monster");
				options.cbOutput(statsOut, options.isAppend);
			}
			stats = getNewStatblock();
			if (hasMultipleBlocks) options.isAppend = true; // append any further blocks we find in this parse
			step = 0;
		};

		let isPrevBlank = true;
		let nextPrevBlank = true;
		let trait = null;

		const getCleanLegendaryActionText = (line) => {
			return ConverterUtilsMarkdown.getCleanTraitText(line.trim().replace(/^-\s*/, ""));
		};

		const doAddFromParsed = () => {
			if (step === 9) { // traits
				doAddTrait();
			} else if (step === 10) { // actions
				doAddAction();
			} else if (step === 11) { // reactions
				doAddReaction();
			} else if (step === 12) { // bonus actions
				doAddBonusAction();
			} else if (step === 13) { // legendary actions
				doAddLegendary();
			} else if (step === 14) { // mythic actions
				doAddMythic();
			}
		};

		const _doAddGenericAction = (prop) => {
			if (this._hasEntryContent(trait)) {
				stats[prop] = stats[prop] || [];

				DiceConvert.convertTraitActionDice(trait);
				stats[prop].push(trait);
			}
			trait = null;
		};

		const doAddTrait = () => _doAddGenericAction("trait");
		const doAddAction = () => _doAddGenericAction("action");
		const doAddReaction = () => _doAddGenericAction("reaction");
		const doAddBonusAction = () => _doAddGenericAction("bonus");
		const doAddLegendary = () => _doAddGenericAction("legendary");
		const doAddMythic = () => _doAddGenericAction("mythic");

		const meta = new _ParseMeta({toConvert});

		for (let i = 0; i < meta.toConvert.length; i++) {
			let curLineRaw = ConverterUtilsMarkdown.getCleanRaw(meta.toConvert[i]);
			meta.curLine = curLineRaw;

			if (ConverterUtilsMarkdown.isBlankLine(curLineRaw)) {
				isPrevBlank = true;
				continue;
			} else nextPrevBlank = false;
			meta.curLine = this._stripMarkdownQuote(meta.curLine);

			if (ConverterUtilsMarkdown.isBlankLine(meta.curLine)) continue;
			else if (
				(meta.curLine === "___" && isPrevBlank) // handle nicely separated blocks
				|| curLineRaw === "___" // handle multiple stacked blocks
			) {
				if (stats !== null) hasMultipleBlocks = true;
				doOutputStatblock();
				isPrevBlank = nextPrevBlank;
				continue;
			} else if (meta.curLine === "___") {
				isPrevBlank = nextPrevBlank;
				continue;
			}

			// name of monster
			if (step === 0) {
				meta.curLine = ConverterUtilsMarkdown.getNoHashes(meta.curLine);
				stats.name = this._getAsTitle("name", meta.curLine, options.titleCaseFields, options.isTitleCase);
				step++;
				continue;
			}

			// size type alignment
			if (step === 1) {
				meta.curLine = meta.curLine.replace(/^\**(.*?)\**$/, "$1");
				this._setCleanSizeTypeAlignment(stats, meta, options);
				step++;
				continue;
			}

			// armor class
			if (step === 2) {
				stats.ac = ConverterUtilsMarkdown.getNoDashStarStar(meta.curLine).replace(/Armor Class/g, "").trim();
				step++;
				continue;
			}

			// hit points
			if (step === 3) {
				this._setCleanHp(stats, ConverterUtilsMarkdown.getNoDashStarStar(meta.curLine));
				step++;
				continue;
			}

			// speed
			if (step === 4) {
				this._setCleanSpeed(stats, ConverterUtilsMarkdown.getNoDashStarStar(meta.curLine), options);
				step++;
				continue;
			}

			// ability scores
			if (step === 5 || step === 6 || step === 7) {
				// skip the two header rows
				if (meta.curLine.replace(/\s*/g, "").startsWith("|STR") || meta.curLine.replace(/\s*/g, "").startsWith("|:-")) {
					step++;
					continue;
				}
				const abilities = meta.curLine.split("|").map(it => it.trim()).filter(Boolean);
				Parser.ABIL_ABVS.map((abi, j) => stats[abi] = this._tryGetStat(abilities[j]));
				step++;
				continue;
			}

			if (step === 8) {
				// saves (optional)
				if (~meta.curLine.indexOf("Saving Throws")) {
					this._setCleanSaves(stats, ConverterUtilsMarkdown.getNoDashStarStar(meta.curLine), options);
					continue;
				}

				// skills (optional)
				if (~meta.curLine.indexOf("Skills")) {
					this._setCleanSkills(stats, ConverterUtilsMarkdown.getNoDashStarStar(meta.curLine));
					continue;
				}

				// damage vulnerabilities (optional)
				if (~meta.curLine.indexOf("Damage Vulnerabilities")) {
					this._setCleanDamageVuln(stats, ConverterUtilsMarkdown.getNoDashStarStar(meta.curLine));
					continue;
				}

				// damage resistances (optional)
				if (~meta.curLine.indexOf("Damage Resistance")) {
					this._setCleanDamageRes(stats, ConverterUtilsMarkdown.getNoDashStarStar(meta.curLine));
					continue;
				}

				// damage immunities (optional)
				if (~meta.curLine.indexOf("Damage Immunities")) {
					this._setCleanDamageImm(stats, ConverterUtilsMarkdown.getNoDashStarStar(meta.curLine));
					continue;
				}

				// condition immunities (optional)
				if (~meta.curLine.indexOf("Condition Immunities")) {
					this._setCleanConditionImm(stats, ConverterUtilsMarkdown.getNoDashStarStar(meta.curLine));
					continue;
				}

				// senses
				if (~meta.curLine.indexOf("Senses")) {
					this._setCleanSenses(stats, ConverterUtilsMarkdown.getNoDashStarStar(meta.curLine));
					continue;
				}

				// languages
				if (~meta.curLine.indexOf("Languages")) {
					this._setCleanLanguages(stats, ConverterUtilsMarkdown.getNoDashStarStar(meta.curLine));
					continue;
				}

				// CR
				if (~meta.curLine.indexOf("Challenge")) {
					meta.curLine = ConverterUtilsMarkdown.getNoDashStarStar(meta.curLine);
					this._setCleanCr(stats, meta);
					continue;
				}

				// PB
				if (~meta.curLine.indexOf("Proficiency Bonus")) {
					this._setCleanPbNote(stats, ConverterUtilsMarkdown.getNoDashStarStar(meta.curLine));
					continue;
				}

				const [nextLine1, nextLine2] = this._getNextLinesMarkdown(meta, {ixCur: i, isPrevBlank, nextPrevBlank}, 2);

				// Skip past Giffyglyph builder junk
				if (nextLine1 && nextLine2 && ~nextLine1.indexOf("Attacks") && ~nextLine2.indexOf("Attack DCs")) {
					i = this._advanceLinesMarkdown(meta, {ixCur: i, isPrevBlank, nextPrevBlank}, 2);
				}

				step++;
			}

			const cleanedLine = ConverterUtilsMarkdown.getNoTripleHash(meta.curLine);
			if (cleanedLine.toLowerCase() === "actions") {
				doAddFromParsed();
				step = 10;
				continue;
			} else if (cleanedLine.toLowerCase() === "reactions") {
				doAddFromParsed();
				step = 11;
				continue;
			} else if (cleanedLine.toLowerCase() === "bonus actions") {
				doAddFromParsed();
				step = 12;
				continue;
			} else if (cleanedLine.toLowerCase() === "legendary actions") {
				doAddFromParsed();
				step = 13;
				continue;
			} else if (cleanedLine.toLowerCase() === "mythic actions") {
				doAddFromParsed();
				step = 14;
				continue;
			}

			// traits
			if (step === 9) {
				if (ConverterUtilsMarkdown.isInlineHeader(meta.curLine)) {
					doAddTrait();
					trait = {name: "", entries: []};
					const [name, text] = ConverterUtilsMarkdown.getCleanTraitText(meta.curLine);
					trait.name = name;
					trait.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(text));
				} else {
					trait.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(meta.curLine));
				}
			}

			// actions
			if (step === 10) {
				if (ConverterUtilsMarkdown.isInlineHeader(meta.curLine)) {
					doAddAction();
					trait = {name: "", entries: []};
					const [name, text] = ConverterUtilsMarkdown.getCleanTraitText(meta.curLine);
					trait.name = name;
					trait.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(text));
				} else {
					trait.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(meta.curLine));
				}
			}

			// reactions
			if (step === 11) {
				if (ConverterUtilsMarkdown.isInlineHeader(meta.curLine)) {
					doAddReaction();
					trait = {name: "", entries: []};
					const [name, text] = ConverterUtilsMarkdown.getCleanTraitText(meta.curLine);
					trait.name = name;
					trait.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(text));
				} else {
					trait.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(meta.curLine));
				}
			}

			// bonus actions
			if (step === 12) {
				if (ConverterUtilsMarkdown.isInlineHeader(meta.curLine)) {
					doAddBonusAction();
					trait = {name: "", entries: []};
					const [name, text] = ConverterUtilsMarkdown.getCleanTraitText(meta.curLine);
					trait.name = name;
					trait.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(text));
				} else {
					trait.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(meta.curLine));
				}
			}

			// legendary actions
			if (step === 13) {
				if (isInlineLegendaryActionItem(meta.curLine)) {
					doAddLegendary();
					trait = {name: "", entries: []};
					const [name, text] = getCleanLegendaryActionText(meta.curLine);
					trait.name = name;
					trait.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(text));
				} else if (ConverterUtilsMarkdown.isInlineHeader(meta.curLine)) {
					doAddLegendary();
					trait = {name: "", entries: []};
					const [name, text] = ConverterUtilsMarkdown.getCleanTraitText(meta.curLine);
					trait.name = name;
					trait.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(text));
				} else {
					if (!trait) { // legendary action intro text
						// ignore generic LA intro; the renderer will insert it
						if (!meta.curLine.toLowerCase().includes("can take 3 legendary actions")) {
							trait = {name: "", entries: [ConverterUtilsMarkdown.getNoLeadingSymbols(meta.curLine)]};
						}
					} else trait.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(meta.curLine));
				}
			}

			// mythic actions
			if (step === 14) {
				if (isInlineLegendaryActionItem(meta.curLine)) {
					doAddMythic();
					trait = {name: "", entries: []};
					const [name, text] = getCleanLegendaryActionText(meta.curLine);
					trait.name = name;
					trait.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(text));
				} else if (ConverterUtilsMarkdown.isInlineHeader(meta.curLine)) {
					doAddMythic();
					trait = {name: "", entries: []};
					const [name, text] = ConverterUtilsMarkdown.getCleanTraitText(meta.curLine);
					trait.name = name;
					trait.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(text));
				} else {
					if (!trait) { // mythic action intro text
						if (meta.curLine.toLowerCase().includes("mythic trait is active")) {
							stats.mythicHeader = [ConverterUtilsMarkdown.getNoLeadingSymbols(meta.curLine)];
						}
					} else trait.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(meta.curLine));
				}
			}
		}

		doOutputStatblock();
	}

	static _stripMarkdownQuote (line) {
		return line.replace(/^\s*>\s*/, "").trim();
	}

	static _callOnNextLinesMarkdown (meta, {ixCur, isPrevBlank, nextPrevBlank}, numLines, fn) {
		const len = meta.toConvert.length;

		for (let i = ixCur + 1; i < len; ++i) {
			const line = meta.toConvert[i];

			if (ConverterUtilsMarkdown.isBlankLine(line)) {
				isPrevBlank = true;
				continue;
			} else nextPrevBlank = false;

			const cleanLine = this._stripMarkdownQuote(line);

			if (ConverterUtilsMarkdown.isBlankLine(cleanLine)) continue;
			else if (
				(cleanLine === "___" && isPrevBlank) // handle nicely separated blocks
				|| line === "___" // handle multiple stacked blocks
			) {
				break;
			} else if (cleanLine === "___") {
				isPrevBlank = nextPrevBlank;
				continue;
			}

			fn(cleanLine, i);

			if (!--numLines) break;
		}
	}

	static _getNextLinesMarkdown (meta, {ixCur, isPrevBlank, nextPrevBlank}, numLines) {
		const out = [];
		const fn = cleanLine => out.push(cleanLine);
		this._callOnNextLinesMarkdown(meta, {ixCur, isPrevBlank, nextPrevBlank}, numLines, fn);
		return out;
	}

	static _advanceLinesMarkdown (meta, {ixCur, isPrevBlank, nextPrevBlank}, numLines) {
		let ixOut = ixCur + 1;
		const fn = (_, i) => ixOut = i + 1;
		this._callOnNextLinesMarkdown(meta, {ixCur, isPrevBlank, nextPrevBlank}, numLines, fn);
		return ixOut;
	}

	// SHARED UTILITY FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////
	static _doStatblockPostProcess (stats, isMarkdown, options) {
		this._doFilterAddSpellcasting(stats, "trait", isMarkdown, options);
		this._doFilterAddSpellcasting(stats, "action", isMarkdown, options);
		if (stats.trait) stats.trait.forEach(it => RechargeConvert.tryConvertRecharge(it, () => {}, () => options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Manual recharge tagging required for trait "${it.name}"`)));
		if (stats.action) stats.action.forEach(it => RechargeConvert.tryConvertRecharge(it, () => {}, () => options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Manual recharge tagging required for action "${it.name}"`)));
		if (stats.bonus) stats.bonus.forEach(it => RechargeConvert.tryConvertRecharge(it, () => {}, () => options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Manual recharge tagging required for bonus action "${it.name}"`)));
		CreatureParser._PROPS_ENTRIES.filter(prop => stats[prop]).forEach(prop => SpellTag.tryRun(stats[prop]));
		AcConvert.tryPostProcessAc(
			stats,
			(ac) => options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}AC "${ac}" requires manual conversion`),
			(ac) => options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Failed to parse AC "${ac}"`),
		);
		TagAttack.tryTagAttacks(stats, (atk) => options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Manual attack tagging required for "${atk}"`));
		TagHit.tryTagHits(stats);
		TagDc.tryTagDcs(stats);
		TagCondition.tryTagConditions(stats, {isTagInflicted: true});
		TagCondition.tryTagConditionsSpells(
			stats,
			{
				cbMan: (sp) => options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Spell "${sp}" could not be found during condition tagging`),
				isTagInflicted: true,
			},
		);
		TagCondition.tryTagConditionsRegionalsLairs(
			stats,
			{
				cbMan: (legendaryGroup) => options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Legendary group "${legendaryGroup.name} :: ${legendaryGroup.source}" could not be found during condition tagging`),
				isTagInflicted: true,
			},
		);
		TraitActionTag.tryRun(stats);
		LanguageTag.tryRun(stats);
		SenseFilterTag.tryRun(stats);
		SpellcastingTypeTag.tryRun(stats);
		DamageTypeTag.tryRun(stats);
		DamageTypeTag.tryRunSpells(stats);
		DamageTypeTag.tryRunRegionalsLairs(stats);
		MiscTag.tryRun(stats);
		DetectNamedCreature.tryRun(stats);
		TagImmResVulnConditional.tryRun(stats);
		DragonAgeTag.tryRun(stats);
		this._doStatblockPostProcess_doCleanup(stats, options);
	}

	static _doFilterAddSpellcasting (stats, prop, isMarkdown, options) {
		if (!stats[prop]) return;
		const spellcasting = [];
		stats[prop] = stats[prop].map(ent => {
			if (!ent.name || !ent.name.toLowerCase().includes("spellcasting")) return ent;
			const parsed = SpellcastingTraitConvert.tryParseSpellcasting(ent, {isMarkdown, cbErr: options.cbErr, displayAs: prop, actions: stats.action, reactions: stats.reaction});
			if (!parsed) return ent;
			spellcasting.push(parsed);
			return null;
		}).filter(Boolean);
		if (spellcasting.length) stats.spellcasting = [...stats.spellcasting || [], ...spellcasting];
	}

	static _doStatblockPostProcess_doCleanup (stats, options) {
		// remove any empty arrays
		Object.keys(stats).forEach(k => {
			if (stats[k] instanceof Array && stats[k].length === 0) {
				delete stats[k];
			}
		});
	}

	static _tryConvertNumber (strNumber) {
		try {
			return Number(strNumber.replace(/—/g, "-"));
		} catch (e) {
			return strNumber;
		}
	}

	static _tryParseType ({stats, strType}) {
		strType = strType.trim().toLowerCase();
		const mSwarm = /^(.*)swarm of (\w+) (\w+)$/i.exec(strType);
		if (mSwarm) {
			const swarmTypeSingular = Parser.monTypeFromPlural(mSwarm[3]);

			return { // retain any leading junk, as we'll parse it out in a later step
				type: `${mSwarm[1]}${swarmTypeSingular}`,
				swarmSize: mSwarm[2][0].toUpperCase(),
			};
		}

		const mParens = /^(.*?) (\(.*?\))\s*$/.exec(strType);
		let type, tags, note;

		if (mParens) {
			// If there are multiple sizes, assume bracketed text is a note referring to this
			if (stats.size.length > 1) {
				note = mParens[2];
			} else {
				tags = mParens[2].split(",").map(s => s.replace(/\(/g, "").replace(/\)/g, "").trim());
			}
			strType = mParens[1];
		}

		if (/ or /.test(strType)) {
			const pts = strType.split(/(?:, |,? or )/g);
			type = {
				choose: pts.map(it => it.trim()).filter(Boolean),
			};
		}

		if (!type) type = strType;

		if (typeof type === "string" && !tags && !note) return type;

		const out = {type};
		if (tags) out.tags = tags;
		if (note) out.note = note;

		return out;
	}

	static _getSequentialAbilityScoreSectionLineCount (stats, meta) {
		if (stats.str != null) return false; // Skip if we already have ability scores

		let cntLines = 0;
		const nextSixLines = [];
		for (let i = meta.ixToConvert; nextSixLines.length < 6; ++i) {
			const line = (meta.toConvert[i] || "").toLowerCase();
			if (Parser.ABIL_ABVS.includes(line)) nextSixLines.push(line);
			else break;
			cntLines++;
		}
		return cntLines;
	}

	static _mutAbilityScoresFromSingleLine (stats, meta) {
		const abilities = meta.toConvert[meta.ixToConvert].trim().replace(/[-\u2012\u2013\u2014]+/g, "-").split(/ ?\(([+-])?[0-9]*\) ?/g);
		stats.str = this._tryConvertNumber(abilities[0]);
		stats.dex = this._tryConvertNumber(abilities[2]);
		stats.con = this._tryConvertNumber(abilities[4]);
		stats.int = this._tryConvertNumber(abilities[6]);
		stats.wis = this._tryConvertNumber(abilities[8]);
		stats.cha = this._tryConvertNumber(abilities[10]);
	}

	static _tryGetStat (strLine) {
		try {
			return this._tryConvertNumber(/(\d+) ?\(.*?\)/.exec(strLine)[1]);
		} catch (e) {
			return 0;
		}
	}

	/**
	 * Tries to parse immunities, resistances, and vulnerabilities
	 * @param ipt The string to parse.
	 * @param modProp the output property (e.g. "vulnerable").
	 * @param options
	 * @param options.cbWarning
	 */
	static _tryParseDamageResVulnImmune (ipt, modProp, options) {
		// handle the case where a comma is mistakenly used instead of a semicolon
		if (ipt.toLowerCase().includes(", bludgeoning, piercing, and slashing from")) {
			ipt = ipt.replace(/, (bludgeoning, piercing, and slashing from)/gi, "; $1");
		}

		const splSemi = ipt.toLowerCase().split(";").map(it => it.trim()).filter(Boolean);
		const newDamage = [];
		try {
			splSemi.forEach(section => {
				let note;
				let preNote;
				const newDamageGroup = [];

				section
					.split(/,/g)
					.forEach(pt => {
						pt = pt.trim().replace(/^and /i, "").trim();

						// region `"damage from spells"`
						const mDamageFromThing = /^damage from .*$/i.exec(pt);
						if (mDamageFromThing) return newDamage.push({special: pt});
						// endregion

						pt = pt.replace(/\(from [^)]+\)$/i, (...m) => {
							note = m[0];
							return "";
						}).trim();

						pt = pt.replace(/from [^)]+$/i, (...m) => {
							if (note) throw new Error(`Already has note!`);
							note = m[0];
							return "";
						}).trim();

						pt = pt.replace(/\bthat is nonmagical$/i, (...m) => {
							if (note) throw new Error(`Already has note!`);
							note = m[0];
							return "";
						}).trim();

						const ixFirstDamageType = Math.min(Parser.DMG_TYPES.map(it => pt.toLowerCase().indexOf(it)).filter(ix => ~ix));
						if (ixFirstDamageType > 0) {
							preNote = pt.slice(0, ixFirstDamageType).trim();
							pt = pt.slice(ixFirstDamageType).trim();
						}

						newDamageGroup.push(pt);
					});

				if (note || preNote) {
					newDamage.push({
						[modProp]: newDamageGroup,
						note,
						preNote,
					});
				} else {
					// If there is no group metadata, flatten into the main array
					newDamage.push(...newDamageGroup);
				}
			});

			return newDamage;
		} catch (ignored) {
			options.cbWarning(`Res/imm/vuln ("${modProp}") "${ipt}" requires manual conversion`);
			return ipt;
		}
	}

	/**
	 * Tries to parse immunities, resistances, and vulnerabilities
	 * @param ipt The string to parse.
	 * @param options the output property (e.g. "vulnerable").
	 * TODO(future) this is a stripped-down, outdated version of `_tryParseDamageResVulnImmune`. Consider revising to
	 *   look more like `_tryParseDamageResVulnImmune`.
	 */
	static _tryParseConditionImmune (ipt, options) {
		const splSemi = ipt.toLowerCase().split(";");
		const newDamage = [];
		try {
			splSemi.forEach(section => {
				const tempDamage = {};
				let pushArray = newDamage;
				if (section.includes("from")) {
					tempDamage.conditionImmune = [];
					pushArray = tempDamage.conditionImmune;
					tempDamage["note"] = /from .*/.exec(section)[0];
					section = /(.*) from /.exec(section)[1];
				}
				section = section.replace(/and/g, "");
				section.split(",").forEach(s => pushArray.push(s.trim()));
				if ("note" in tempDamage) newDamage.push(tempDamage);
			});
			return newDamage;
		} catch (ignored) {
			options.cbWarning(`Condition immunity "${ipt}" requires manual conversion`);
			return ipt;
		}
	}

	// SHARED PARSING FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////
	static _setCleanSizeTypeAlignment (stats, meta, options) {
		this._setCleanSizeTypeAlignment_sidekick(stats, meta, options)
			|| this._setCleanSizeTypeAlignment_standard(stats, meta, options);

		stats.type = this._tryParseType({stats, strType: stats.type});

		this._setCleanSizeTypeAlignment_postProcess(stats, meta, options);
	}

	static _setCleanSizeTypeAlignment_sidekick (stats, meta, options) {
		const mSidekick = /^(\d+)(?:st|nd|rd|th)\s*\W+\s*level\s+(.*)$/i.exec(meta.curLine.trim());
		if (!mSidekick) return false;

		// sidekicks
		stats.level = Number(mSidekick[1]);
		stats.size = mSidekick[2].trim()[0].toUpperCase();
		stats.type = mSidekick[2].split(" ").splice(1).join(" ");
	}

	static _setCleanSizeTypeAlignment_standard (stats, meta, options) {
		const ixSwarm = / swarm /.exec(meta.curLine)?.index;

		// regular creatures

		// region Size
		const reSize = new RegExp(`(${Object.values(Parser.SIZE_ABV_TO_FULL).join("|")})`, "i");
		const reSizeGlobal = new RegExp(reSize, "gi");

		const tks = meta.curLine.split(reSizeGlobal);
		let ixSizeLast = -1;
		for (let ixSize = 0; ixSize < tks.length; ++ixSize) {
			if (ixSwarm != null && tks.slice(0, ixSizeLast + 1).join("").length >= ixSwarm) break;

			const tk = tks[ixSize];
			if (reSize.test(tk)) {
				ixSizeLast = ixSize;
				(stats.size = stats.size || []).push(tk[0].toUpperCase());
			}
		}
		stats.size.sort(SortUtil.ascSortSize);
		// endregion

		const tksNoSize = tks.slice(ixSizeLast + 1);

		const spl = tksNoSize.join("").split(StrUtil.COMMAS_NOT_IN_PARENTHESES_REGEX);

		const ptsOtherSizeOrType = spl[0].split(" ").map(it => it.trim()).filter(Boolean);

		stats.type = ptsOtherSizeOrType.join(" ");

		stats.alignment = (spl[1] || "").toLowerCase();
		AlignmentConvert.tryConvertAlignment(stats, (ali) => options.cbWarning(`Alignment "${ali}" requires manual conversion`));
	}

	static _setCleanSizeTypeAlignment_postProcess (stats, meta, options) {
		const validTypes = new Set(Parser.MON_TYPES);
		if (!stats.type.type?.choose && (!validTypes.has(stats.type.type || stats.type))) {
			// check if the last word is a creature type
			const curType = stats.type.type || stats.type;
			let parts = curType.split(/(\W+)/g);
			parts = parts.filter(Boolean);
			if (validTypes.has(parts.last())) {
				const note = parts.slice(0, -1);
				if (stats.type.type) {
					stats.type.type = parts.last();
				} else {
					stats.type = parts.last();
				}
				stats.sizeNote = note.join("").trim();
			}
		}
	}

	static _addExtraTypeTags (stats, meta) {
		if (!meta.additionalTypeTags?.length) return;

		// Transform to complex form if simple
		if (!stats.type.type) stats.type = {type: stats.type};
		if (!stats.type.tags?.length) stats.type.tags = [];
		stats.type.tags.push(...meta.additionalTypeTags);
	}

	static _setCleanHp (stats, line) {
		const rawHp = ConvertUtil.getStatblockLineHeaderText({reStartStr: "Hit Points", line});
		// split HP into average and formula
		const m = /^(\d+)\s*\((.*?)\)$/.exec(rawHp.trim());
		if (!m) stats.hp = {special: rawHp}; // for e.g. Avatar of Death
		else if (!Renderer.dice.lang.getTree3(m[2])) stats.hp = {special: rawHp}; // for e.g. "x (see notes)"
		else {
			stats.hp = {
				average: Number(m[1]),
				formula: m[2],
			};
			DiceConvert.cleanHpDice(stats);
		}
	}

	static _setCleanSpeed (stats, line, options) {
		stats.speed = line;
		SpeedConvert.tryConvertSpeed(stats, options.cbWarning);
	}

	static _setCleanSaves (stats, line, options) {
		stats.save = ConvertUtil.getStatblockLineHeaderText({reStartStr: this._RE_START_SAVING_THROWS, line});
		// convert to object format
		if (stats.save && stats.save.trim()) {
			const spl = stats.save.split(",").map(it => it.trim().toLowerCase()).filter(it => it);
			const nu = {};
			spl.forEach(it => {
				const m = /^(?<abil>\w+)\s*(?<sign>[-+])\s*(?<save>\d+)(?<plusPb>(?:\s+plus\s+|\s*\+\s*)PB)?$/i.exec(it);
				if (m) {
					nu[m.groups.abil] = `${m.groups.sign}${m.groups.save}${m.groups.plusPb ? m.groups.plusPb.replace(/\bpb\b/gi, "PB") : ""}`;
				} else {
					options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Save "${it}" requires manual conversion`);
				}
			});
			stats.save = nu;
		}
	}

	static _setCleanSkills (stats, line) {
		stats.skill = ConvertUtil.getStatblockLineHeaderText({reStartStr: this._RE_START_SKILLS, line}).toLowerCase();
		const split = stats.skill.split(",").map(it => it.trim()).filter(Boolean);

		const reSkill = new RegExp(`^(?<skill>${Object.keys(Parser.SKILL_TO_ATB_ABV).join("|")})\\s+(?<val>.*)$`, "i");

		const newSkills = {};
		try {
			split.forEach(s => {
				const m = reSkill.exec(s);
				if (!m) {
					options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Skill "${s}" requires manual conversion`);
					return;
				}
				newSkills[m.groups.skill] = m.groups.val.replace(/\b\+?pb\b/g, "PB");
			});
			stats.skill = newSkills;
			if (stats.skill[""]) delete stats.skill[""]; // remove empty properties
		} catch (ignored) {
			setTimeout(() => { throw ignored; });
		}
	}

	static _setCleanDamageVuln (stats, line, options) {
		stats.vulnerable = ConvertUtil.getStatblockLineHeaderText({reStartStr: this._RE_START_DAMAGE_VULN, line});
		stats.vulnerable = this._tryParseDamageResVulnImmune(stats.vulnerable, "vulnerable", options);
	}

	static _setCleanDamageRes (stats, line, options) {
		stats.resist = ConvertUtil.getStatblockLineHeaderText({reStartStr: this._RE_START_DAMAGE_RES, line});
		stats.resist = this._tryParseDamageResVulnImmune(stats.resist, "resist", options);
	}

	static _setCleanDamageImm (stats, line, options) {
		stats.immune = ConvertUtil.getStatblockLineHeaderText({reStartStr: this._RE_START_DAMAGE_IMM, line});
		stats.immune = this._tryParseDamageResVulnImmune(stats.immune, "immune", options);
	}

	static _setCleanConditionImm (stats, line, options) {
		stats.conditionImmune = ConvertUtil.getStatblockLineHeaderText({reStartStr: this._RE_START_CONDITION_IMM, line});
		stats.conditionImmune = this._tryParseConditionImmune(stats.conditionImmune, "conditionImmune", options);
	}

	static _setCleanSenses (stats, line) {
		const senses = ConvertUtil.getStatblockLineHeaderText({reStartStr: this._RE_START_SENSES, line}).toLowerCase();
		const tempSenses = [];
		senses.split(StrUtil.COMMA_SPACE_NOT_IN_PARENTHESES_REGEX).forEach(s => {
			s = s.trim();
			if (s) {
				if (s.includes("passive perception")) stats.passive = this._tryConvertNumber(s.split("passive perception")[1].trim());
				else tempSenses.push(s.trim());
			}
		});
		if (tempSenses.length) stats.senses = tempSenses;
		else delete stats.senses;
	}

	static _setCleanLanguages (stats, line) {
		stats.languages = ConvertUtil.getStatblockLineHeaderText({reStartStr: this._RE_START_LANGUAGES, line});
		if (stats.languages && /^([-–‒—]|\\u201\d)+$/.exec(stats.languages.trim())) delete stats.languages;
		else {
			stats.languages = stats.languages
				// Clean caps words
				.split(/(\W)/g)
				.map(s => {
					return s
						.replace(/Telepathy/g, "telepathy")
						.replace(/All/g, "all")
						.replace(/Understands/g, "understands")
						.replace(/Cant/g, "cant")
						.replace(/Can/g, "can");
				})
				.join("")
				.split(StrUtil.COMMA_SPACE_NOT_IN_PARENTHESES_REGEX);
		}
	}

	static _setCleanCr (stats, meta, {header = "Challenge"} = {}) {
		stats.cr = ConvertUtil.getStatblockLineHeaderText({reStartStr: header, line: meta.curLine}).split("(")[0].trim();
		if (!stats.cr) return;

		const reTags = new RegExp(`\\b(?<tag>${Object.keys(this._BREW_CR_LINE_TAGS).map(it => it.escapeRegexp()).join("|")})\\b`, "gi");
		stats.cr = stats.cr
			.replace(reTags, (...m) => {
				meta.addAdditionalTypeTag(this._BREW_CR_LINE_TAGS[m.last().tag.toLowerCase()]);
				return "";
			})
			.trim();

		if (/^[-\u2012-\u2014]$/.test(stats.cr.trim())) delete stats.cr;
	}

	static _BREW_CR_LINE_TAGS = {
		// region MCDM
		"ambusher": "Ambusher",
		"artillery": "Artillery",
		"brute": "Brute",
		"companion": "Companion",
		"controller": "Controller",
		"leader": "Leader",
		"minion": "Minion",
		"retainer": "Retainer",
		"skirmisher": "Skirmisher",
		"soldier": "Soldier",
		"solo": "Solo",
		"support": "Support",
		// endregion
	};

	static _setCleanPbNote (stats, line) {
		stats.pbNote = ConvertUtil.getStatblockLineHeaderText({reStartStr: this._RE_START_PROF_BONUS, line});

		if (stats.pbNote && !isNaN(stats.pbNote) && Parser.crToPb(stats.cr) === Number(stats.pbNote)) delete stats.pbNote;
	}

	// region SHARED HOMEBREW PARSING FUNCTIONS /////////////////////////////////////////////////////////////////////////
	static _RE_BREW_RESOURCE_SOULS = /^Souls (?<value>\d+) \((?<formula>[^)]+)\)$/;

	static _brew_setResourceSouls (stats, meta, options) {
		const m = this._RE_BREW_RESOURCE_SOULS.exec(meta.curLine);
		(stats.resource = stats.resource || [])
			.push({
				name: "Souls",
				value: Number(m.groups.value),
				formula: m.groups.formula,
			});
	}
	// endregion
}
CreatureParser._PROPS_ENTRIES = [
	"trait",
	"action",
	"bonus",
	"reaction",
	"legendary",
	"mythic",
];

globalThis.CreatureParser = CreatureParser;
