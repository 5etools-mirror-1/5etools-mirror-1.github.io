"use strict";

if (typeof module !== "undefined") {
	const cv = require("./converterutils.js");
	Object.assign(global, cv);
	global.PropOrder = require("./utils-proporder.js");
}

class FeatParser extends BaseParser {
	/**
	 * Parses feats from raw text pastes
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
		const feat = {};
		feat.source = options.source;
		// for the user to fill out
		feat.page = options.page;

		let prevLine = null;
		let curLine = null;
		let i;
		for (i = 0; i < toConvert.length; i++) {
			prevLine = curLine;
			curLine = toConvert[i].trim();

			if (curLine === "") continue;

			// name
			if (i === 0) {
				feat.name = this._getAsTitle("name", curLine, options.titleCaseFields, options.isTitleCase);
				continue;
			}

			// prerequisites
			if (i === 1 && curLine.toLowerCase().includes("prerequisite")) {
				this._setCleanPrerequisites(feat, curLine, options);
				continue;
			}

			const ptrI = {_: i};
			feat.entries = EntryConvert.coalesceLines(
				ptrI,
				toConvert,
			);
			i = ptrI._;
		}

		if (!feat.entries.length) delete feat.entries;
		else this._setAbility(feat, options);

		const statsOut = this._getFinalState(feat, options);

		options.cbOutput(statsOut, options.isAppend);
	}

	static _getFinalState (feat, options) {
		this._doFeatPostProcess(feat, options);
		return PropOrder.getOrdered(feat, feat.__prop || "feat");
	}

	// SHARED UTILITY FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////
	static _doFeatPostProcess (feat, options) {
		TagCondition.tryTagConditions(feat);
		ArtifactPropertiesTag.tryRun(feat);
		if (feat.entries) {
			feat.entries = feat.entries.map(it => DiceConvert.getTaggedEntry(it));
			EntryConvert.tryRun(feat, "entries");
			feat.entries = SkillTag.tryRun(feat.entries);
			feat.entries = ActionTag.tryRun(feat.entries);
			feat.entries = SenseTag.tryRun(feat.entries);
		}
	}

	// SHARED PARSING FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////
	static _setCleanPrerequisites (feat, curLine, options) {
		const pres = [];
		curLine = curLine.trim().replace(/^prerequisite:/i, "").trim();
		const tokens = ConvertUtil.getTokens(curLine);

		let tkStack = [];

		const handleStack = () => {
			if (!tkStack.length) return;

			const joinedStack = tkStack.join(" ").trim();

			const parts = joinedStack.split(StrUtil.COMMA_SPACE_NOT_IN_PARENTHESES_REGEX);

			const pre = {};

			parts.forEach(pt => {
				pt = pt.trim();

				if (/^spellcasting$/i.test(pt)) return pre.spellcasting2020 = true;

				if (/^pact magic feature$/i.test(pt)) return pre.spellcasting2020 = true;

				if (/proficiency with a martial weapon/i.test(pt)) {
					pre.proficiency = pre.proficiency || [{}];
					pre.proficiency[0].weapon = "martial";
					return;
				}

				const mLevel = /^(?<level>\d+).. level$/i.exec(pt);
				if (mLevel) return pre.level = Number(mLevel.groups.level);

				const mFeat = /^(?<feat>.*?) feat$/i.exec(pt);
				if (mFeat) {
					return (pre.feat = pre.feat || []).push(mFeat.groups.feat.toLowerCase().trim());
				}

				const mAlignment = /^(?<align>.*?) alignment/i.exec(pt);
				if (mAlignment) {
					const {alignment} = AlignmentUtil.tryGetConvertedAlignment(mAlignment.groups.align);
					if (alignment) {
						pre.alignment = alignment;
						return;
					}
				}

				pre.other = pt;
				options.cbWarning(`(${feat.name}) Prerequisite "${pt}" requires manual conversion`);
			});

			if (Object.keys(pre).length) pres.push(pre);

			tkStack = [];
		};

		for (const tk of tokens) {
			if (tk === "or") {
				handleStack();
				continue;
			}
			tkStack.push(tk);
		}
		handleStack();

		if (pres.length) feat.prerequisite = pres;
	}

	static _setAbility (feat, options) {
		const walker = MiscUtil.getWalker({
			keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST,
			isNoModification: true,
		});
		walker.walk(
			feat.entries,
			{
				object: (obj) => {
					if (obj.type !== "list") return;

					if (typeof obj.items[0] === "string" && /^increase your/i.test(obj.items[0])) {
						const abils = [];
						obj.items[0].replace(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/g, (...m) => {
							abils.push(m[1].toLowerCase().slice(0, 3));
						});

						if (abils.length === 1) {
							feat.ability = [{[abils[0]]: 1}];
						} else {
							feat.ability = [
								{
									choose: {
										from: abils,
										amount: 1,
									},
								},
							];
						}

						obj.items.shift();
					} else if (typeof obj.items[0] === "string" && /^increase (?:one|an) ability score of your choice by 1/i.test(obj.items[0])) {
						feat.ability = [
							{
								choose: {
									from: [...Parser.ABIL_ABVS],
									amount: 1,
								},
							},
						];

						obj.items.shift();
					}
				},
			},
		);
	}
}

if (typeof module !== "undefined") {
	module.exports = {
		FeatParser,
	};
}
