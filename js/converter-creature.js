"use strict";

if (typeof module !== "undefined") {
	const cv = require("./converterutils.js");
	Object.assign(global, cv);
	const cvCreature = require("./converterutils-creature.js");
	Object.assign(global, cvCreature);
	global.PropOrder = require("./utils-proporder.js");
}

// TODO easy improvements to be made:
//    - improve "broken line" fixing:
//      - across lines that end with: "Melee Weapon Attack:"
//      - creature's name breaking across multiple lines
//      - lines starting "DC" breaking across multiple lines
//      - lines starting with attack range e.g. "100/400 ft."
class CreatureParser extends BaseParser {
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
			return /^(?:action|legendary action|mythic action|reaction|bonus action)s?(?:\s+\([^)]+\))?$/i.test(cur);
		}

		/**
		 * If the current line ends in a comma, we can assume the next line is a broken/wrapped part of the current line
		 */
		function absorbBrokenLine (isCrLine) {
			const NO_ABSORB_SUBTITLES = [
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
			const NO_ABSORB_TITLES = [
				"ACTION",
				"LEGENDARY ACTION",
				"MYTHIC ACTION",
				"REACTION",
				"BONUS ACTION",
			];

			if (curLine) {
				if (curLine.trim().endsWith(",")) {
					const nxtLine = toConvert[++i];
					if (!nxtLine) return false;
					curLine = `${curLine.trim()} ${nxtLine.trim()}`;
					return true;
				}

				if (isCrLine) return false; // avoid absorbing past the CR line

				const nxtLine = toConvert[i + 1];
				if (!nxtLine) return false;

				if (ConvertUtil.isNameLine(nxtLine)) return false; // avoid absorbing the start of traits
				if (NO_ABSORB_TITLES.some(it => nxtLine.toUpperCase().includes(it))) return false;
				if (NO_ABSORB_SUBTITLES.some(it => nxtLine.toUpperCase().startsWith(it))) return false;

				i++;
				curLine = `${curLine.trim()} ${nxtLine.trim()}`;
				return true;
			}
			return false;
		}

		if (!inText || !inText.trim()) return options.cbWarning("No input!");
		const toConvert = (() => {
			let clean = this._getCleanInput(inText);

			const statsHeadFootSpl = clean.split(/(Challenge|Proficiency Bonus \(PB\))/i);

			statsHeadFootSpl[0] = statsHeadFootSpl[0]
				// collapse multi-line ability scores
				.replace(/(\d\d?\s+\([-—+]?\d+\)\s*)+/gi, (...m) => `${m[0].replace(/\n/g, " ").replace(/\s+/g, " ")}\n`);

			// (re-assemble after cleaning ability scores and) split into lines
			clean = statsHeadFootSpl.join("").split("\n").filter(it => it && it.trim());

			// Split apart "Challenge" and "Proficiency Bonus" if they are on the same line
			const ixChallengePb = clean.findIndex(line => /^Challenge/.test(line.trim()) && /Proficiency Bonus/.test(line));
			if (~ixChallengePb) {
				let line = clean[ixChallengePb];
				const [challengePart, pbLabel, pbRest] = line.split(/(Proficiency Bonus)/);
				clean[ixChallengePb] = challengePart;
				clean.splice(ixChallengePb + 1, 0, [pbLabel, pbRest].join(""));
			}

			return clean;
		})();

		const stats = {};
		stats.source = options.source || "";
		// for the user to fill out
		stats.page = options.page;

		let curLine = null;
		let i;
		for (i = 0; i < toConvert.length; i++) {
			curLine = toConvert[i].trim();

			if (curLine === "") continue;

			// name of monster
			if (i === 0) {
				stats.name = this._getAsTitle("name", curLine, options.titleCaseFields, options.isTitleCase);
				// If the name is immediately repeated, skip it
				if ((toConvert[i + 1] || "").trim() === curLine) toConvert.splice(i + 1, 1);
				continue;
			}

			// size type alignment
			if (i === 1) {
				this._setCleanSizeTypeAlignment(stats, curLine, options);
				continue;
			}

			// armor class
			if (i === 2) {
				stats.ac = ConvertUtil.getStatblockLineHeaderText("Armor Class", curLine);
				continue;
			}

			// hit points
			if (i === 3) {
				this._setCleanHp(stats, curLine);
				continue;
			}

			// speed
			if (i === 4) {
				this._setCleanSpeed(stats, curLine, options);
				continue;
			}

			// ability scores
			if (/STR\s*DEX\s*CON\s*INT\s*WIS\s*CHA/i.test(curLine)) {
				// skip forward a line and grab the ability scores
				++i;
				this._mutAbilityScoresFromSingleLine(stats, toConvert, i);
				continue;
			}

			// Alternate ability scores (all six abbreviations followed by all six scores, each on new lines)
			if (this._getSequentialAbilityScoreSectionLineCount(stats, toConvert, i)) {
				i += this._getSequentialAbilityScoreSectionLineCount(stats, toConvert, i);
				this._mutAbilityScoresFromSingleLine(stats, toConvert, i);
				continue;
			}

			// alternate ability scores (alternating lines of abbreviation and score)
			if (Parser.ABIL_ABVS.includes(curLine.toLowerCase())) {
				// skip forward a line and grab the ability score
				++i;
				switch (curLine.toLowerCase()) {
					case "str": stats.str = this._tryGetStat(toConvert[i]); continue;
					case "dex": stats.dex = this._tryGetStat(toConvert[i]); continue;
					case "con": stats.con = this._tryGetStat(toConvert[i]); continue;
					case "int": stats.int = this._tryGetStat(toConvert[i]); continue;
					case "wis": stats.wis = this._tryGetStat(toConvert[i]); continue;
					case "cha": stats.cha = this._tryGetStat(toConvert[i]); continue;
				}
			}

			// saves (optional)
			if (ConvertUtil.isStatblockLineHeaderStart("Saving Throws", curLine)) {
				// noinspection StatementWithEmptyBodyJS
				while (absorbBrokenLine());
				this._setCleanSaves(stats, curLine, options);
				continue;
			}

			// skills (optional)
			if (ConvertUtil.isStatblockLineHeaderStart("Skills", curLine)) {
				// noinspection StatementWithEmptyBodyJS
				while (absorbBrokenLine());
				this._setCleanSkills(stats, curLine);
				continue;
			}

			// damage vulnerabilities (optional)
			if (
				ConvertUtil.isStatblockLineHeaderStart("Damage Vulnerability", curLine)
				|| ConvertUtil.isStatblockLineHeaderStart("Damage Vulnerabilities", curLine)
			) {
				// noinspection StatementWithEmptyBodyJS
				while (absorbBrokenLine());
				this._setCleanDamageVuln(stats, curLine, options);
				continue;
			}

			// damage resistances (optional)
			if (
				ConvertUtil.isStatblockLineHeaderStart("Damage Resistance", curLine)
				|| ConvertUtil.isStatblockLineHeaderStart("Damage Resistances", curLine)
			) {
				// noinspection StatementWithEmptyBodyJS
				while (absorbBrokenLine());
				this._setCleanDamageRes(stats, curLine, options);
				continue;
			}

			// damage immunities (optional)
			if (
				ConvertUtil.isStatblockLineHeaderStart("Damage Immunity", curLine)
				|| ConvertUtil.isStatblockLineHeaderStart("Damage Immunities", curLine)
			) {
				// noinspection StatementWithEmptyBodyJS
				while (absorbBrokenLine());
				this._setCleanDamageImm(stats, curLine, options);
				continue;
			}

			// condition immunities (optional)
			if (
				ConvertUtil.isStatblockLineHeaderStart("Condition Immunity", curLine)
				|| ConvertUtil.isStatblockLineHeaderStart("Condition Immunities", curLine)
			) {
				// noinspection StatementWithEmptyBodyJS
				while (absorbBrokenLine());
				this._setCleanConditionImm(stats, curLine);
				continue;
			}

			// senses
			if (ConvertUtil.isStatblockLineHeaderStart("Senses", curLine)) {
				// noinspection StatementWithEmptyBodyJS
				while (absorbBrokenLine());
				this._setCleanSenses(stats, curLine);
				continue;
			}

			// languages
			if (ConvertUtil.isStatblockLineHeaderStart("Languages", curLine)) {
				// noinspection StatementWithEmptyBodyJS
				while (absorbBrokenLine());
				this._setCleanLanguages(stats, curLine);
				continue;
			}

			// challenge rating
			if (ConvertUtil.isStatblockLineHeaderStart("Challenge", curLine)) {
				// noinspection StatementWithEmptyBodyJS
				while (absorbBrokenLine(true));
				this._setCleanCr(stats, curLine);
				continue;
			}

			// proficiency bonus
			if (ConvertUtil.isStatblockLineHeaderStart("Proficiency Bonus (PB)", curLine) || ConvertUtil.isStatblockLineHeaderStart("Proficiency Bonus", curLine)) {
				// noinspection StatementWithEmptyBodyJS
				while (absorbBrokenLine());
				this._setCleanPbNote(stats, curLine);
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

			// keep going through traits til we hit actions
			while (i < toConvert.length) {
				if (startNextPhase(curLine)) {
					isTraits = false;

					isActions = ConvertUtil.isStatblockLineHeaderStart("ACTION", curLine.toUpperCase())
						|| ConvertUtil.isStatblockLineHeaderStart("ACTIONS", curLine.toUpperCase());
					if (isActions) {
						const mActionNote = /actions:?\s*\((.*?)\)/gi.exec(curLine);
						if (mActionNote) stats.actionNote = mActionNote[1];
					}

					isReactions = ConvertUtil.isStatblockLineHeaderStart("REACTION", curLine.toUpperCase())
						|| ConvertUtil.isStatblockLineHeaderStart("REACTIONS", curLine.toUpperCase());
					isBonusActions = ConvertUtil.isStatblockLineHeaderStart("BONUS ACTION", curLine.toUpperCase())
						|| ConvertUtil.isStatblockLineHeaderStart("BONUS ACTIONS", curLine.toUpperCase());
					isLegendaryActions = ConvertUtil.isStatblockLineHeaderStart("LEGENDARY ACTION", curLine.toUpperCase())
						|| ConvertUtil.isStatblockLineHeaderStart("LEGENDARY ACTIONS", curLine.toUpperCase());
					isLegendaryDescription = isLegendaryActions;
					isMythicActions = ConvertUtil.isStatblockLineHeaderStart("MYTHIC ACTION", curLine.toUpperCase())
						|| ConvertUtil.isStatblockLineHeaderStart("MYTHIC ACTIONS", curLine.toUpperCase());
					isMythicDescription = isMythicActions;
					i++;
					curLine = toConvert[i];
				}

				curTrait.name = "";
				curTrait.entries = [];

				const parseFirstLine = line => {
					const {name, entry} = ConvertUtil.splitNameLine(line);
					curTrait.name = name;
					curTrait.entries.push(entry);
				};

				if (isLegendaryDescription || isMythicDescription) {
					const compressed = curLine.replace(/\s*/g, "").toLowerCase();

					if (isLegendaryDescription) {
						// usually the first paragraph is a description of how many legendary actions the creature can make
						// but in the case that it's missing the substring "legendary" and "action" it's probably an action
						if (!compressed.includes("legendary") && !compressed.includes("action")) isLegendaryDescription = false;
					} else if (isMythicDescription) {
						// as above--mythic action headers include the text "legendary action"
						if (!compressed.includes("legendary") && !compressed.includes("action")) isLegendaryDescription = false;
					}
				}

				if (isLegendaryDescription) {
					curTrait.entries.push(curLine.trim());
					isLegendaryDescription = false;
				} else if (isMythicDescription) {
					if (/mythic\s+trait/i.test(curLine)) {
						stats.mythicHeader = [curLine.trim()];
					} else {
						curTrait.entries.push(curLine.trim());
					}
					isMythicDescription = false;
				} else {
					parseFirstLine(curLine);
				}

				i++;
				curLine = toConvert[i];

				// collect subsequent paragraphs
				while (curLine && !ConvertUtil.isNameLine(curLine) && !startNextPhase(curLine)) {
					if (BaseParser._isContinuationLine(curTrait.entries, curLine)) {
						curTrait.entries.last(`${curTrait.entries.last().trim()} ${curLine.trim()}`);
					} else {
						curTrait.entries.push(curLine.trim());
					}
					i++;
					curLine = toConvert[i];
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

		(function doCleanLegendaryActionHeader () {
			if (stats.legendary) {
				stats.legendary = stats.legendary.map(it => {
					if (!it.name.trim() && !it.entries.length) return null;
					const m = /can take (\d) legendary actions/gi.exec(it.entries[0]);
					if (!it.name.trim() && m) {
						if (m[1] !== "3") stats.legendaryActions = Number(m[1]);
						return null;
					} else return it;
				}).filter(Boolean);
			}
		})();

		this._doStatblockPostProcess(stats, false, options);
		const statsOut = PropOrder.getOrdered(stats, "monster");
		options.cbOutput(statsOut, options.isAppend);
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

						if (typeof nxtLine !== "string" || !nxtLine.trim().startsWith("•")) break;

						nxtLine = nxtLine.replace(/^•\s*/, "");

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

		const stripDashStarStar = (line) => line.replace(/\**/g, "").replace(/^-/, "").trim();

		const stripTripleHash = (line) => line.replace(/^###/, "").trim();

		const stripLeadingSymbols = (line) => {
			const removeFirstInnerStar = line.trim().startsWith("*");
			const clean = line.replace(/^[^A-Za-z0-9]*/, "").trim();
			return removeFirstInnerStar ? clean.replace(/\*/, "") : clean;
		};

		// it should really start with "***" but, homebrew
		const isInlineHeader = (line) => line.trim().startsWith("**");

		const isInlineLegendaryActionItem = (line) => /^-\s*\*\*\*?[^*]+/gi.test(line.trim());

		if (!inText || !inText.trim()) return options.cbWarning("No input!");
		const toConvert = this._getCleanInput(inText).split("\n");
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
				this._doStatblockPostProcess(stats, true, options);
				const statsOut = PropOrder.getOrdered(stats, "monster");
				options.cbOutput(statsOut, options.isAppend);
			}
			stats = getNewStatblock();
			if (hasMultipleBlocks) options.isAppend = true; // append any further blocks we find in this parse
			step = 0;
		};

		let curLineRaw = null;
		let curLine = null;
		let isPrevBlank = true;
		let nextPrevBlank = true;
		let trait = null;

		const getCleanTraitText = (line) => {
			const [name, text] = line.replace(/^\*\*\*?/, "").split(/.\s*\*\*\*?/).map(it => it.trim());
			return [
				ConvertUtil.getCleanTraitActionName(name),
				text.replace(/\*Hit(\*:|:\*) /g, "Hit: "), // clean hit tags for later replacement
			];
		};

		const getCleanLegendaryActionText = (line) => {
			return getCleanTraitText(line.trim().replace(/^-\s*/, ""));
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

		const getCleanedRaw = (str) => {
			return str.trim()
				.replace(/<br\s*(\/)?>/gi, ""); // remove <br>
		};

		let i = 0;
		for (; i < toConvert.length; i++) {
			curLineRaw = getCleanedRaw(toConvert[i]);
			curLine = curLineRaw;

			if (this._isBlankLineMarkdown(curLineRaw)) {
				isPrevBlank = true;
				continue;
			} else nextPrevBlank = false;
			curLine = this._stripMarkdownQuote(curLine);

			if (this._isBlankLineMarkdown(curLine)) continue;
			else if (
				(curLine === "___" && isPrevBlank) // handle nicely separated blocks
				|| curLineRaw === "___" // handle multiple stacked blocks
			) {
				if (stats !== null) hasMultipleBlocks = true;
				doOutputStatblock();
				isPrevBlank = nextPrevBlank;
				continue;
			} else if (curLine === "___") {
				isPrevBlank = nextPrevBlank;
				continue;
			}

			// name of monster
			if (step === 0) {
				curLine = curLine.replace(/^\s*##/, "").trim();
				stats.name = this._getAsTitle("name", curLine, options.titleCaseFields, options.isTitleCase);
				step++;
				continue;
			}

			// size type alignment
			if (step === 1) {
				curLine = curLine.replace(/^\**(.*?)\**$/, "$1");
				this._setCleanSizeTypeAlignment(stats, curLine, options);
				step++;
				continue;
			}

			// armor class
			if (step === 2) {
				stats.ac = stripDashStarStar(curLine).replace(/Armor Class/g, "").trim();
				step++;
				continue;
			}

			// hit points
			if (step === 3) {
				this._setCleanHp(stats, stripDashStarStar(curLine));
				step++;
				continue;
			}

			// speed
			if (step === 4) {
				this._setCleanSpeed(stats, stripDashStarStar(curLine), options);
				step++;
				continue;
			}

			// ability scores
			if (step === 5 || step === 6 || step === 7) {
				// skip the two header rows
				if (curLine.replace(/\s*/g, "").startsWith("|STR") || curLine.replace(/\s*/g, "").startsWith("|:-")) {
					step++;
					continue;
				}
				const abilities = curLine.split("|").map(it => it.trim()).filter(Boolean);
				Parser.ABIL_ABVS.map((abi, j) => stats[abi] = this._tryGetStat(abilities[j]));
				step++;
				continue;
			}

			if (step === 8) {
				// saves (optional)
				if (~curLine.indexOf("Saving Throws")) {
					this._setCleanSaves(stats, stripDashStarStar(curLine), options);
					continue;
				}

				// skills (optional)
				if (~curLine.indexOf("Skills")) {
					this._setCleanSkills(stats, stripDashStarStar(curLine));
					continue;
				}

				// damage vulnerabilities (optional)
				if (~curLine.indexOf("Damage Vulnerabilities")) {
					this._setCleanDamageVuln(stats, stripDashStarStar(curLine));
					continue;
				}

				// damage resistances (optional)
				if (~curLine.indexOf("Damage Resistance")) {
					this._setCleanDamageRes(stats, stripDashStarStar(curLine));
					continue;
				}

				// damage immunities (optional)
				if (~curLine.indexOf("Damage Immunities")) {
					this._setCleanDamageImm(stats, stripDashStarStar(curLine));
					continue;
				}

				// condition immunities (optional)
				if (~curLine.indexOf("Condition Immunities")) {
					this._setCleanConditionImm(stats, stripDashStarStar(curLine));
					continue;
				}

				// senses
				if (~curLine.indexOf("Senses")) {
					this._setCleanSenses(stats, stripDashStarStar(curLine));
					continue;
				}

				// languages
				if (~curLine.indexOf("Languages")) {
					this._setCleanLanguages(stats, stripDashStarStar(curLine));
					continue;
				}

				// CR
				if (~curLine.indexOf("Challenge")) {
					this._setCleanCr(stats, stripDashStarStar(curLine));
					continue;
				}

				// PB
				if (~curLine.indexOf("Proficiency Bonus")) {
					this._setCleanPbNote(stats, stripDashStarStar(curLine));
					continue;
				}

				const [nextLine1, nextLine2] = this._getNextLinesMarkdown(toConvert, {ixCur: i, isPrevBlank, nextPrevBlank}, 2);

				// Skip past Giffyglyph builder junk
				if (nextLine1 && nextLine2 && ~nextLine1.indexOf("Attacks") && ~nextLine2.indexOf("Attack DCs")) {
					i = this._advanceLinesMarkdown(toConvert, {ixCur: i, isPrevBlank, nextPrevBlank}, 2);
				}

				step++;
			}

			const cleanedLine = stripTripleHash(curLine);
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
				if (isInlineHeader(curLine)) {
					doAddTrait();
					trait = {name: "", entries: []};
					const [name, text] = getCleanTraitText(curLine);
					trait.name = name;
					trait.entries.push(stripLeadingSymbols(text));
				} else {
					trait.entries.push(stripLeadingSymbols(curLine));
				}
			}

			// actions
			if (step === 10) {
				if (isInlineHeader(curLine)) {
					doAddAction();
					trait = {name: "", entries: []};
					const [name, text] = getCleanTraitText(curLine);
					trait.name = name;
					trait.entries.push(stripLeadingSymbols(text));
				} else {
					trait.entries.push(stripLeadingSymbols(curLine));
				}
			}

			// reactions
			if (step === 11) {
				if (isInlineHeader(curLine)) {
					doAddReaction();
					trait = {name: "", entries: []};
					const [name, text] = getCleanTraitText(curLine);
					trait.name = name;
					trait.entries.push(stripLeadingSymbols(text));
				} else {
					trait.entries.push(stripLeadingSymbols(curLine));
				}
			}

			// bonus actions
			if (step === 12) {
				if (isInlineHeader(curLine)) {
					doAddBonusAction();
					trait = {name: "", entries: []};
					const [name, text] = getCleanTraitText(curLine);
					trait.name = name;
					trait.entries.push(stripLeadingSymbols(text));
				} else {
					trait.entries.push(stripLeadingSymbols(curLine));
				}
			}

			// legendary actions
			if (step === 13) {
				if (isInlineLegendaryActionItem(curLine)) {
					doAddLegendary();
					trait = {name: "", entries: []};
					const [name, text] = getCleanLegendaryActionText(curLine);
					trait.name = name;
					trait.entries.push(stripLeadingSymbols(text));
				} else if (isInlineHeader(curLine)) {
					doAddLegendary();
					trait = {name: "", entries: []};
					const [name, text] = getCleanTraitText(curLine);
					trait.name = name;
					trait.entries.push(stripLeadingSymbols(text));
				} else {
					if (!trait) { // legendary action intro text
						// ignore generic LA intro; the renderer will insert it
						if (!curLine.toLowerCase().includes("can take 3 legendary actions")) {
							trait = {name: "", entries: [stripLeadingSymbols(curLine)]};
						}
					} else trait.entries.push(stripLeadingSymbols(curLine));
				}
			}

			// mythic actions
			if (step === 14) {
				if (isInlineLegendaryActionItem(curLine)) {
					doAddMythic();
					trait = {name: "", entries: []};
					const [name, text] = getCleanLegendaryActionText(curLine);
					trait.name = name;
					trait.entries.push(stripLeadingSymbols(text));
				} else if (isInlineHeader(curLine)) {
					doAddMythic();
					trait = {name: "", entries: []};
					const [name, text] = getCleanTraitText(curLine);
					trait.name = name;
					trait.entries.push(stripLeadingSymbols(text));
				} else {
					if (!trait) { // mythic action intro text
						if (curLine.toLowerCase().includes("mythic trait is active")) {
							stats.mythicHeader = [stripLeadingSymbols(curLine)];
						}
					} else trait.entries.push(stripLeadingSymbols(curLine));
				}
			}
		}

		doOutputStatblock();
	}

	static _isBlankLineMarkdown (line) {
		return line === "" || line.toLowerCase() === "\\pagebreak" || line.toLowerCase() === "\\columnbreak";
	}

	static _isStatblockTransitionMarkdown (line, cleanLine, isPrevBlank) {
		return (cleanLine === "___" && isPrevBlank) // handle nicely separated blocks
		|| line === "___";
	}

	static _stripMarkdownQuote (line) {
		return line.replace(/^\s*>\s*/, "").trim();
	}

	static _callOnNextLinesMarkdown (toConvert, {ixCur, isPrevBlank, nextPrevBlank}, numLines, fn) {
		const len = toConvert.length;

		for (let i = ixCur + 1; i < len; ++i) {
			const line = toConvert[i];

			if (this._isBlankLineMarkdown(line)) {
				isPrevBlank = true;
				continue;
			} else nextPrevBlank = false;

			const cleanLine = this._stripMarkdownQuote(line);

			if (this._isBlankLineMarkdown(cleanLine)) continue;
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

	static _getNextLinesMarkdown (toConvert, {ixCur, isPrevBlank, nextPrevBlank}, numLines) {
		const out = [];
		const fn = cleanLine => out.push(cleanLine);
		this._callOnNextLinesMarkdown(toConvert, {ixCur, isPrevBlank, nextPrevBlank}, numLines, fn);
		return out;
	}

	static _advanceLinesMarkdown (toConvert, {ixCur, isPrevBlank, nextPrevBlank}, numLines) {
		let ixOut = ixCur + 1;
		const fn = (_, i) => ixOut = i + 1;
		this._callOnNextLinesMarkdown(toConvert, {ixCur, isPrevBlank, nextPrevBlank}, numLines, fn);
		return ixOut;
	}

	// SHARED UTILITY FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////
	static _doStatblockPostProcess (stats, isMarkdown, options) {
		this._doFilterAddSpellcasting(stats, "trait", isMarkdown, options);
		this._doFilterAddSpellcasting(stats, "action", isMarkdown, options);
		if (stats.trait) stats.trait.forEach(trait => RechargeConvert.tryConvertRecharge(trait, () => {}, () => options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Manual recharge tagging required for trait "${trait.name}"`)));
		if (stats.action) stats.action.forEach(action => RechargeConvert.tryConvertRecharge(action, () => {}, () => options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Manual recharge tagging required for action "${action.name}"`)));
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
		MiscTag.tryRun(stats);
		DetectNamedCreature.tryRun(stats);
		TagImmResVulnConditional.tryRun(stats);
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

	static _tryParseType (strType) {
		try {
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
			if (mParens) {
				return {type: mParens[1], tags: mParens[2].split(",").map(s => s.replace(/\(/g, "").replace(/\)/g, "").trim())};
			}

			return strType;
		} catch (e) {
			setTimeout(() => { throw e; });
			return strType;
		}
	}

	static _getSequentialAbilityScoreSectionLineCount (stats, toConvert, iCur) {
		if (stats.str != null) return false; // Skip if we already have ability scores

		let cntLines = 0;
		const nextSixLines = [];
		for (let i = iCur; nextSixLines.length < 6; ++i) {
			const line = (toConvert[i] || "").toLowerCase();
			if (Parser.ABIL_ABVS.includes(line)) nextSixLines.push(line);
			else break;
			cntLines++;
		}
		return cntLines;
	}

	static _mutAbilityScoresFromSingleLine (stats, toConvert, iCur) {
		const abilities = toConvert[iCur].trim().replace(/[-\u2012\u2013\u2014]+/g, "-").split(/ ?\(([+-])?[0-9]*\) ?/g);
		stats.str = this._tryConvertNumber(abilities[0]);
		stats.dex = this._tryConvertNumber(abilities[2]);
		stats.con = this._tryConvertNumber(abilities[4]);
		stats.int = this._tryConvertNumber(abilities[6]);
		stats.wis = this._tryConvertNumber(abilities[8]);
		stats.cha = this._tryConvertNumber(abilities[10]);
	}

	static _tryGetStat (strLine) {
		try {
			return this._tryConvertNumber(/(\d+) \(.*?\)/.exec(strLine)[1]);
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
	static _setCleanSizeTypeAlignment (stats, line, options) {
		const mSidekick = /^(\d+)(?:st|nd|rd|th)\s*\W+\s*level\s+(.*)$/i.exec(line.trim());
		if (mSidekick) {
			// sidekicks
			stats.level = Number(mSidekick[1]);
			stats.size = mSidekick[2].trim()[0].toUpperCase();
			stats.type = mSidekick[2].split(" ").splice(1).join(" ");
		} else {
			// regular creatures
			stats.size = line[0].toUpperCase();

			const spl = line.split(StrUtil.COMMAS_NOT_IN_PARENTHESES_REGEX);

			stats.type = spl[0].split(" ").splice(1).join(" ");

			stats.alignment = (spl[1] || "").toLowerCase();
			AlignmentConvert.tryConvertAlignment(stats, (ali) => options.cbWarning(`Alignment "${ali}" requires manual conversion`));
		}

		stats.type = this._tryParseType(stats.type);

		const validTypes = new Set(Parser.MON_TYPES);
		if (!validTypes.has(stats.type.type || stats.type)) {
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

	static _setCleanHp (stats, line) {
		const rawHp = ConvertUtil.getStatblockLineHeaderText("Hit Points", line);
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
		stats.save = ConvertUtil.getStatblockLineHeaderText("Saving Throws", line);
		// convert to object format
		if (stats.save && stats.save.trim()) {
			const spl = stats.save.split(",").map(it => it.trim().toLowerCase()).filter(it => it);
			const nu = {};
			spl.forEach(it => {
				const m = /(\w+)\s*([-+])\s*(\d+)/.exec(it);
				if (m) {
					nu[m[1]] = `${m[2]}${m[3]}`;
				} else {
					options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Save "${it}" requires manual conversion`);
				}
			});
			stats.save = nu;
		}
	}

	static _setCleanSkills (stats, line) {
		stats.skill = ConvertUtil.getStatblockLineHeaderText("Skills", line).toLowerCase();
		const split = stats.skill.split(",").map(it => it.trim()).filter(Boolean);
		const newSkills = {};
		try {
			split.forEach(s => {
				const splSpace = s.split(" ");
				const val = splSpace.pop().trim();
				let name = splSpace.join(" ").toLowerCase().trim().replace(/ /g, "");
				name = this.SKILL_SPACE_MAP[name] || name;
				newSkills[name] = val;
			});
			stats.skill = newSkills;
			if (stats.skill[""]) delete stats.skill[""]; // remove empty properties
		} catch (ignored) {
			setTimeout(() => { throw ignored; });
		}
	}

	static _setCleanDamageVuln (stats, line, options) {
		stats.vulnerable = ConvertUtil.getStatblockLineHeaderText("Vulnerabilities", line);
		stats.vulnerable = this._tryParseDamageResVulnImmune(stats.vulnerable, "vulnerable", options);
	}

	static _setCleanDamageRes (stats, line, options) {
		stats.resist = line.toLowerCase().includes("resistances")
			? ConvertUtil.getStatblockLineHeaderText("Resistances", line)
			: ConvertUtil.getStatblockLineHeaderText("Resistance", line);
		stats.resist = this._tryParseDamageResVulnImmune(stats.resist, "resist", options);
	}

	static _setCleanDamageImm (stats, line, options) {
		stats.immune = ConvertUtil.getStatblockLineHeaderText("Immunities", line);
		stats.immune = this._tryParseDamageResVulnImmune(stats.immune, "immune", options);
	}

	static _setCleanConditionImm (stats, line, options) {
		stats.conditionImmune = ConvertUtil.getStatblockLineHeaderText("Condition Immunities", line);
		stats.conditionImmune = this._tryParseConditionImmune(stats.conditionImmune, "conditionImmune", options);
	}

	static _setCleanSenses (stats, line) {
		const senses = ConvertUtil.getStatblockLineHeaderText("senses", line).toLowerCase();
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
		stats.languages = ConvertUtil.getStatblockLineHeaderText("Languages", line);
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

	static _setCleanCr (stats, line) {
		stats.cr = ConvertUtil.getStatblockLineHeaderText("Challenge", line).split("(")[0].trim();
		if (stats.cr && /^[-\u2012-\u2014]$/.test(stats.cr.trim())) delete stats.cr;
	}

	static _setCleanPbNote (stats, line) {
		if (line.includes("Proficiency Bonus (PB)")) stats.pbNote = ConvertUtil.getStatblockLineHeaderText("Proficiency Bonus (PB)", line);
		else stats.pbNote = ConvertUtil.getStatblockLineHeaderText("Proficiency Bonus", line);

		if (stats.pbNote && !isNaN(stats.pbNote) && Parser.crToPb(stats.cr) === Number(stats.pbNote)) delete stats.pbNote;
	}
}
CreatureParser.SKILL_SPACE_MAP = {
	"sleightofhand": "sleight of hand",
	"animalhandling": "animal handling",
};
CreatureParser._PROPS_ENTRIES = [
	"trait",
	"action",
	"bonus",
	"reaction",
	"legendary",
	"mythic",
];

if (typeof module !== "undefined") {
	module.exports = {
		CreatureParser,
	};
}
