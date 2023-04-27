"use strict";

class SpellParser extends BaseParser {
	static _RE_START_RANGE = "Range";
	static _RE_START_COMPONENTS = "Components?";
	static _RE_START_DURATION = "Duration";
	static _RE_START_CLASS = "Class(?:es)?";

	/**
	 * Parses spells from raw text pastes
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

		if (!inText || !inText.trim()) return options.cbWarning("No input!");
		const toConvert = this._getCleanInput(inText, options)
			.split("\n")
			.filter(it => it && it.trim());
		const spell = {};
		spell.source = options.source;
		// for the user to fill out
		spell.page = options.page;

		let prevLine = null;
		let curLine = null;
		let i;
		for (i = 0; i < toConvert.length; i++) {
			prevLine = curLine;
			curLine = toConvert[i].trim();

			if (curLine === "") continue;

			// name of spell
			if (i === 0) {
				spell.name = this._getAsTitle("name", curLine, options.titleCaseFields, options.isTitleCase);
				continue;
			}

			// spell level, and school plus ritual
			if (i === 1) {
				this._setCleanLevelSchoolRitual(spell, curLine, options);
				continue;
			}

			// casting time
			if (i === 2) {
				this._setCleanCastingTime(spell, curLine, options);
				continue;
			}

			// range
			if (ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_RANGE, line: curLine})) {
				this._setCleanRange(spell, curLine, options);
				continue;
			}

			// components
			if (
				ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_COMPONENTS, line: curLine})
			) {
				this._setCleanComponents(spell, curLine, options);
				continue;
			}

			// duration
			if (ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_DURATION, line: curLine})) {
				// avoid absorbing main body text
				this._setCleanDuration(spell, curLine, options);
				continue;
			}

			// class spell lists (alt)
			if (ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_CLASS, line: curLine})) {
				// avoid absorbing main body text
				this._setCleanClasses(spell, curLine, options);
				continue;
			}

			const ptrI = {_: i};
			spell.entries = EntryConvert.coalesceLines(
				ptrI,
				toConvert,
				{
					fnStop: (curLine) => /^(?:At Higher Levels|Class(?:es)?)/gi.test(curLine),
				},
			);
			i = ptrI._;

			spell.entriesHigherLevel = EntryConvert.coalesceLines(
				ptrI,
				toConvert,
				{
					fnStop: (curLine) => /^Classes/gi.test(curLine),
				},
			);
			i = ptrI._;

			// class spell lists
			if (i < toConvert.length) {
				curLine = toConvert[i].trim();
				if (ConvertUtil.isStatblockLineHeaderStart({reStartStr: this._RE_START_CLASS, line: curLine})) {
					this._setCleanClasses(spell, curLine, options);
				}
			}
		}

		if (!spell.entriesHigherLevel || !spell.entriesHigherLevel.length) delete spell.entriesHigherLevel;

		const statsOut = this._getFinalState(spell, options);

		options.cbOutput(statsOut, options.isAppend);
	}

	static _getCleanInput (ipt, options = null) {
		let txt = super._getCleanInput(ipt, options);

		const titles = [
			"Casting Time",
			"Range",
			"Components?",
			"Duration",
		];

		for (let i = 0; i < titles.length - 1; ++i) {
			const start = titles[i];
			const end = titles[i + 1];
			const re = new RegExp(`(?<line>\\n${start}.*?)(?<suffix>\\n${end})`, "is");

			txt = txt.replace(re, (...m) => {
				return `\n${m.last().line.replace(/\n/g, " ").trim().replace(/ +/g, " ")}${m.last().suffix}`;
			});
		}

		return txt;
	}

	// SHARED UTILITY FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////
	static _tryConvertSchool (s, cbMan) {
		const school = (s.school || "").toLowerCase().trim();
		if (!school) return cbMan ? cbMan(s.school, "Spell school requires manual conversion") : null;

		const out = SpellParser._RES_SCHOOL.find(it => it.regex.test(school));
		if (out) {
			s.school = out.output;
			return;
		}
		if (cbMan) cbMan(s.school, "Spell school requires manual conversion");
	}

	static _doSpellPostProcess (stats, options) {
		const doCleanup = () => {
			// remove any empty arrays
			Object.keys(stats).forEach(k => {
				if (stats[k] instanceof Array && stats[k].length === 0) {
					delete stats[k];
				}
			});
		};
		TagCondition.tryTagConditions(stats, {isTagInflicted: true});
		if (stats.entries) {
			stats.entries = stats.entries.map(it => DiceConvert.getTaggedEntry(it));
			EntryConvert.tryRun(stats, "entries");
			stats.entries = SkillTag.tryRun(stats.entries);
			stats.entries = ActionTag.tryRun(stats.entries);
			stats.entries = SenseTag.tryRun(stats.entries);
		}
		if (stats.entriesHigherLevel) {
			stats.entriesHigherLevel = stats.entriesHigherLevel.map(it => DiceConvert.getTaggedEntry(it));
			EntryConvert.tryRun(stats, "entriesHigherLevel");
			stats.entriesHigherLevel = SkillTag.tryRun(stats.entriesHigherLevel);
			stats.entriesHigherLevel = ActionTag.tryRun(stats.entriesHigherLevel);
			stats.entriesHigherLevel = SenseTag.tryRun(stats.entriesHigherLevel);
		}
		this._addTags(stats, options);
		doCleanup();
	}

	static _addTags (stats, options) {
		DamageInflictTagger.tryRun(stats, options);
		DamageResVulnImmuneTagger.tryRun(stats, "damageResist", options);
		DamageResVulnImmuneTagger.tryRun(stats, "damageImmune", options);
		DamageResVulnImmuneTagger.tryRun(stats, "damageVulnerable", options);
		ConditionInflictTagger.tryRun(stats, options);
		SavingThrowTagger.tryRun(stats, options);
		AbilityCheckTagger.tryRun(stats, options);
		SpellAttackTagger.tryRun(stats, options);
		// TODO areaTags
		MiscTagsTagger.tryRun(stats, options);
		ScalingLevelDiceTagger.tryRun(stats, options);
	}

	// SHARED PARSING FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////
	static _setCleanLevelSchoolRitual (stats, line, options) {
		const rawLine = line;
		line = ConvertUtil.cleanDashes(line).toLowerCase().trim();

		const mCantrip = /cantrip/i.exec(line);
		const mSpellLevel = /^(\d+)(?:st|nd|rd|th)?-level/i.exec(line);

		if (mCantrip) {
			const trailing = line.slice(mCantrip.index + "cantrip".length, line.length);
			line = line.slice(0, mCantrip.index).trim();

			// TODO implement as required (see at e.g. Deep Magic series)
			if (trailing) {
				options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Level/school/ritual trailing part "${trailing}" requires manual conversion`);
			}

			stats.level = 0;
			stats.school = line;

			this._tryConvertSchool(stats);
		} else if (mSpellLevel) {
			line = line.slice(mSpellLevel.index + mSpellLevel[0].length);

			let isRitual = false;
			line = line.replace(/\((.*?)(?:[,;]\s*)?ritual(?:[,;]\s*)?(.*?)\)/i, (...m) => {
				isRitual = true;
				// preserve any extra info inside the brackets
				return m[1] || m[2] ? `(${m[1]}${m[2]})` : "";
			}).trim();

			if (isRitual) {
				stats.meta = stats.meta || {};
				stats.meta.ritual = true;
			}

			stats.level = Number(mSpellLevel[1]);

			// TODO further handling of non-school text (see e.g. Deep Magic series)
			stats.school = line.trim();

			this._tryConvertSchool(stats);
		} else {
			options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Level/school/ritual part "${rawLine}" requires manual conversion`);
		}
	}

	static _setCleanRange (stats, line, options) {
		const getUnit = (str) => str.toLowerCase().includes("mile") ? "miles" : "feet";

		const range = ConvertUtil.cleanDashes(ConvertUtil.getStatblockLineHeaderText({reStartStr: this._RE_START_RANGE, line}));

		if (range.toLowerCase() === "self") return stats.range = {type: "point", distance: {type: "self"}};
		if (range.toLowerCase() === "special") return stats.range = {type: "special"};
		if (range.toLowerCase() === "unlimited") return stats.range = {type: "point", distance: {type: "unlimited"}};
		if (range.toLowerCase() === "unlimited on the same plane") return stats.range = {type: "point", distance: {type: "plane"}};
		if (range.toLowerCase() === "sight") return stats.range = {type: "point", distance: {type: "sight"}};
		if (range.toLowerCase() === "touch") return stats.range = {type: "point", distance: {type: "touch"}};

		const cleanRange = range.replace(/(\d),(\d)/g, "$1$2");

		const mFeetMiles = /^(\d+) (feet|foot|miles?)$/i.exec(cleanRange);
		if (mFeetMiles) return stats.range = {type: "point", distance: {type: getUnit(mFeetMiles[2]), amount: Number(mFeetMiles[1])}};

		const mSelfRadius = /^self \((\d+)-(foot|mile) radius\)$/i.exec(cleanRange);
		if (mSelfRadius) return stats.range = {type: "radius", distance: {type: getUnit(mSelfRadius[2]), amount: Number(mSelfRadius[1])}};

		const mSelfSphere = /^self \((\d+)-(foot|mile)-radius sphere\)$/i.exec(cleanRange);
		if (mSelfSphere) return stats.range = {type: "sphere", distance: {type: getUnit(mSelfSphere[2]), amount: Number(mSelfSphere[1])}};

		const mSelfCone = /^self \((\d+)-(foot|mile) cone\)$/i.exec(cleanRange);
		if (mSelfCone) return stats.range = {type: "cone", distance: {type: getUnit(mSelfCone[2]), amount: Number(mSelfCone[1])}};

		const mSelfLine = /^self \((\d+)-(foot|mile) line\)$/i.exec(cleanRange);
		if (mSelfLine) return stats.range = {type: "line", distance: {type: getUnit(mSelfLine[2]), amount: Number(mSelfLine[1])}};

		const mSelfCube = /^self \((\d+)-(foot|mile) cube\)$/i.exec(cleanRange);
		if (mSelfCube) return stats.range = {type: "cube", distance: {type: getUnit(mSelfCube[2]), amount: Number(mSelfCube[1])}};

		const mSelfHemisphere = /^self \((\d+)-(foot|mile)-radius hemisphere\)$/i.exec(cleanRange);
		if (mSelfHemisphere) return stats.range = {type: "hemisphere", distance: {type: getUnit(mSelfHemisphere[2]), amount: Number(mSelfHemisphere[1])}};

		// region Homebrew
		const mPointCube = /^(?<point>\d+) (?<unit>feet|foot|miles?) \((\d+)-(foot|mile) cube\)$/i.exec(cleanRange);
		if (mPointCube) return stats.range = {type: "point", distance: {type: getUnit(mPointCube.groups.unit), amount: Number(mPointCube.groups.point)}};
		// endregion

		options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Range part "${range}" requires manual conversion`);
	}

	static _getCleanTimeUnit (unit, isDuration, options) {
		unit = unit.toLowerCase().trim();
		switch (unit) {
			case "days":
			case "years":
			case "hours":
			case "minutes":
			case "actions":
			case "rounds": return unit.slice(0, -1);

			case "day":
			case "year":
			case "hour":
			case "minute":
			case "action":
			case "round":
			case "reaction": return unit;

			case "bonus action": return "bonus";

			default:
				options.cbWarning(`Unit part "${unit}" requires manual conversion`);
				return unit;
		}
	}

	static _setCleanCastingTime (stats, line, options) {
		const allParts = ConvertUtil.getStatblockLineHeaderText({reStartStr: "Casting Time", line});
		const parts = /\b(?:reaction|which you (?:take|use))\b/.test(allParts)
			? [allParts]
			: allParts.split(/; | or /gi);

		stats.time = parts
			.map(it => it.trim())
			.filter(Boolean)
			.map(str => {
				const mNumber = /^(?<count>\d+)?(?<rest>.*?)$/.exec(str);

				if (!mNumber) {
					options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Casting time part "${str}" requires manual conversion`);
					return str;
				}

				const amount = mNumber.groups.count ? Number(mNumber.groups.count.trim()) : null;
				const [unit, ...conditionParts] = mNumber.groups.rest.split(", ");
				const out = {
					number: amount ?? 1,
					unit: this._getCleanTimeUnit(unit, false, options),
					condition: conditionParts.join(", "),
				};
				if (!out.condition) delete out.condition;
				return out;
			})
		;
	}

	static _setCleanComponents (stats, line, options) {
		const components = ConvertUtil.getStatblockLineHeaderText({reStartStr: this._RE_START_COMPONENTS, line});
		const parts = components.split(StrUtil.COMMAS_NOT_IN_PARENTHESES_REGEX);

		stats.components = {};

		parts
			.map(it => it.trim())
			.filter(Boolean)
			.forEach(pt => {
				const lowerPt = pt.toLowerCase();
				switch (lowerPt) {
					case "v": stats.components.v = true; break;
					case "s": stats.components.s = true; break;
					default: {
						if (lowerPt.startsWith("m ")) {
							const materialText = pt.replace(/^m\s*\((.*)\)$/i, "$1").trim();
							const mCost = /(\d*,?\d+)\s?(cp|sp|ep|gp|pp)/gi.exec(materialText);
							const isConsumed = pt.toLowerCase().includes("consume");

							if (mCost) {
								const valueMult = Parser.COIN_CONVERSIONS[Parser.COIN_ABVS.indexOf(mCost[2].toLowerCase())];
								const valueNum = Number(mCost[1].replace(/,/g, ""));

								stats.components.m = {
									text: materialText,
									cost: valueNum * valueMult,
								};
								if (isConsumed) stats.components.m.consume = true;
							} else if (isConsumed) {
								stats.components.m = {
									text: materialText,
									consume: true,
								};
							} else {
								stats.components.m = materialText;
							}
						} else if (lowerPt.startsWith("r ")) stats.components.r = true;
						else options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Components part "${pt}" requires manual conversion`);
					}
				}
			});
	}

	static _setCleanDuration (stats, line, options) {
		const dur = ConvertUtil.getStatblockLineHeaderText({reStartStr: this._RE_START_DURATION, line});

		if (dur.toLowerCase() === "instantaneous") return stats.duration = [{type: "instant"}];
		if (dur.toLowerCase() === "instantaneous (see text)") return stats.duration = [{type: "instant", condition: "see text"}];
		if (dur.toLowerCase() === "special") return stats.duration = [{type: "special"}];
		if (dur.toLowerCase() === "permanent") return stats.duration = [{type: "permanent"}];

		const mConcOrUpTo = /^(concentration, )?up to (\d+|an?) (hour|minute|turn|round|week|day|year)(?:s)?$/i.exec(dur);
		if (mConcOrUpTo) {
			const amount = mConcOrUpTo[2].toLowerCase().startsWith("a") ? 1 : Number(mConcOrUpTo[2]);
			const out = {type: "timed", duration: {type: this._getCleanTimeUnit(mConcOrUpTo[3], true, options), amount}, concentration: true};
			if (mConcOrUpTo[1]) out.concentration = true;
			else out.upTo = true;
			return stats.duration = [out];
		}

		const mTimed = /^(\d+) (hour|minute|turn|round|week|day|year)(?:s)?$/i.exec(dur);
		if (mTimed) return stats.duration = [{type: "timed", duration: {type: this._getCleanTimeUnit(mTimed[2], true, options), amount: Number(mTimed[1])}}];

		const mDispelledTriggered = /^until dispelled( or triggered)?$/i.exec(dur);
		if (mDispelledTriggered) {
			const out = {type: "permanent", ends: ["dispel"]};
			if (mDispelledTriggered[1]) out.ends.push("trigger");
			return stats.duration = [out];
		}

		const mPermDischarged = /^permanent until discharged$/i.exec(dur);
		if (mPermDischarged) {
			const out = {type: "permanent", ends: ["discharge"]};
			return stats.duration = [out];
		}

		// TODO handle splitting "or"'d durations up as required

		options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Duration part "${dur}" requires manual conversion`);
	}

	static _setCleanClasses (stats, line, options) {
		const classLine = ConvertUtil.getStatblockLineHeaderText({reStartStr: this._RE_START_CLASS, line});
		const classes = classLine.split(StrUtil.COMMAS_NOT_IN_PARENTHESES_REGEX);

		stats.classes = {fromClassList: []};

		classes
			.map(it => it.trim())
			.filter(Boolean)
			.forEach(pt => {
				const lowerPt = pt.toLowerCase();
				switch (lowerPt) {
					case "artificer":
					case "artificers": stats.classes.fromClassList.push({"name": "Artificer", "source": "TCE"}); break;
					case "bard":
					case "bards": stats.classes.fromClassList.push({"name": "Bard", "source": "PHB"}); break;
					case "cleric":
					case "clerics": stats.classes.fromClassList.push({"name": "Cleric", "source": "PHB"}); break;
					case "druid":
					case "druids": stats.classes.fromClassList.push({"name": "Druid", "source": "PHB"}); break;
					case "paladin":
					case "paladins": stats.classes.fromClassList.push({"name": "Paladin", "source": "PHB"}); break;
					case "ranger":
					case "rangers": stats.classes.fromClassList.push({"name": "Ranger", "source": "PHB"}); break;
					case "sorcerer":
					case "sorcerers": stats.classes.fromClassList.push({"name": "Sorcerer", "source": "PHB"}); break;
					case "warlock":
					case "warlocks": stats.classes.fromClassList.push({"name": "Warlock", "source": "PHB"}); break;
					case "wizard":
					case "wizards": stats.classes.fromClassList.push({"name": "Wizard", "source": "PHB"}); break;
					default: options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Class "${lowerPt}" requires manual conversion`); break;
				}
			});

		if (!stats.classes.fromClassList.length) delete stats.classes;
	}

	static _getFinalState (spell, options) {
		this._doSpellPostProcess(spell, options);
		return PropOrder.getOrdered(spell, "spell");
	}
}
SpellParser._RES_SCHOOL = [];
Object.entries({
	"transmutation": "T",
	"necromancy": "N",
	"conjuration": "C",
	"abjuration": "A",
	"enchantment": "E",
	"evocation": "V",
	"illusion": "I",
	"divination": "D",
}).forEach(([k, v]) => {
	SpellParser._RES_SCHOOL.push({
		output: v,
		regex: RegExp(k, "i"),
	});
});

globalThis.SpellParser = SpellParser;
