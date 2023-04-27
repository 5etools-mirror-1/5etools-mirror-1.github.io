"use strict";

class RaceParser extends BaseParser {
	static _StateMd = class {
		constructor ({options, race}) {
			this.options = options;
			this.race = race;
			this.ix = 0;
			this.curLine = null;
			this.stage = "name";
			this.stack = [];
		}
	};

	/**
	 * Parses races from raw markdown pastes
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

		const {toConvert, race} = this._doParseMarkdown_getInitialState(inText, options);
		if (!toConvert) return;

		const state = new this._StateMd({options, race});

		for (; state.ix < toConvert.length; ++state.ix) {
			state.curLine = toConvert[state.ix].trim();

			if (ConverterUtilsMarkdown.isBlankLine(state.curLine)) continue;

			switch (state.stage) {
				case "name": this._doParseMarkdown_stepName(state); state.stage = "entries"; break;
				case "entries": this._doParseMarkdown_stepEntries(state); break;
				default: throw new Error(`Unknown stage "${state.stage}"`);
			}
		}

		if (!race.entries?.length) delete race.entries;

		const raceOut = this._getFinalStats(race, options);

		options.cbOutput(raceOut, options.isAppend);
	}

	static _doParseMarkdown_getInitialState (inText, options) {
		if (!inText || !inText.trim()) {
			options.cbWarning("No input!");
			return {};
		}

		const toConvert = this._getCleanInput(inText, options)
			.split("\n")
			.filter(it => it && it.trim());

		const race = {};
		race.source = options.source;
		// for the user to fill out
		race.page = options.page;

		return {toConvert, race};
	}

	static _doParseMarkdown_stepName (state) {
		state.curLine = ConverterUtilsMarkdown.getNoHashes(state.curLine);
		state.race.name = this._getAsTitle("name", state.curLine, state.options.titleCaseFields, state.options.isTitleCase);
	}

	static _doParseMarkdown_stepEntries (state) {
		state.race.entries = state.race.entries || [];

		if (ConverterUtilsMarkdown.isInlineHeader(state.curLine)) {
			while (state.stack.length) state.stack.pop();

			const nxt = {type: "entries", name: "", entries: []};
			if (state.stack.length) delete nxt.type;
			state.stack.push(nxt);

			state.race.entries.push(nxt);

			const [name, text] = ConverterUtilsMarkdown.getCleanTraitText(state.curLine);
			nxt.name = name;
			nxt.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(text));

			return;
		}

		if (ConverterUtilsMarkdown.isListItem(state.curLine)) {
			if (state.stack.last()?.type !== "list") {
				const lst = {type: "list", items: []};

				if (state.stack.length) {
					state.stack.last().entries.push(lst);
					state.stack.push(lst);
				} else {
					state.race.entries.push(lst);
					state.stack.push(lst);
				}
			}

			state.curLine = ConverterUtilsMarkdown.getNoLeadingListSymbol(state.curLine);

			if (ConverterUtilsMarkdown.isInlineHeader(state.curLine)) {
				state.stack.last().style = "list-hang-notitle";

				const nxt = {type: "item", name: "", entry: ""};

				state.stack.last().items.push(nxt);

				const [name, text] = ConverterUtilsMarkdown.getCleanTraitText(state.curLine);
				nxt.name = `${name}.`;
				nxt.entry = ConverterUtilsMarkdown.getNoLeadingSymbols(text);
			} else {
				state.stack.last().items.push(ConverterUtilsMarkdown.getNoLeadingSymbols(state.curLine));
			}

			return;
		}

		while (state.stack.length && state.stack.last().type === "list") state.stack.pop();

		if (state.stack.length) {
			state.stack.last().entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(state.curLine));
			return;
		}

		state.race.entries.push(ConverterUtilsMarkdown.getNoLeadingSymbols(state.curLine));
	}

	static _getFinalStats (race, options) {
		this._doRacePostProcess(race, options);
		return PropOrder.getOrdered(race, race.__prop || "race");
	}

	// SHARED UTILITY FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////
	static _doRacePostProcess (race, options) {
		if (!race.entries) return;

		// region Tag
		EntryConvert.tryRun(race, "entries");
		ArtifactPropertiesTag.tryRun(race);
		TagJsons.mutTagObject(race, {keySet: new Set(["entries"]), isOptimistic: false});
		// endregion

		// region Race-specific cleanup and generation
		this._doRacePostProcess_size(race, options);
		this._doRacePostProcess_ability(race, options);
		this._doRacePostProcess_speed(race, options);
		this._doRacePostProcess_speedFlight(race, options);
		this._doRacePostProcess_creatureType(race, options);
		this._doRacePostProcess_darkvision(race, options);

		RaceLanguageTag.tryRun(race, options);
		RaceImmResVulnTag.tryRun(race, options);
		RaceTraitTag.tryRun(race, options);
		// endregion
	}

	static _doRacePostProcess_size (race, options) {
		const entry = race.entries.find(it => (it.name || "").toLowerCase() === "size");
		if (entry?.entries?.length !== 1) return options.cbWarning(`Could not convert size\u2014no valid "Size" entry found!`);

		const text = entry.entries[0];

		const mSimple = /^(?:You are|Your size is) (?<size>Medium|Small)\.?$/.exec(text);
		if (mSimple) {
			race.size = [
				mSimple.groups.size.toUpperCase()[0],
			];
			// Filter out "redundant" size info, as it will be displayed in subtitle
			race.entries = race.entries.filter(it => it !== entry);
			return;
		}

		const mChoose = /^(?:You are|Your size is) Medium or Small\b/.exec(text);
		if (mChoose) {
			race.size = [
				"S",
				"M",
			];
			return;
		}

		options.cbWarning(`Size text "${text}" requires manual conversion!`);
	}

	static _doRacePostProcess_ability (race, options) {
		const entry = race.entries.find(it => (it.name || "").toLowerCase() === "ability score increase");
		if (entry) return options.cbWarning(`Ability Score Increase requires manual conversion!`);

		// If there is no ASI info, we assume ~~the worst~~ it's a post-VRGR "lineage" race
		race.lineage = "VRGR";
	}

	static _doRacePostProcess_speed (race, options) {
		const entry = race.entries.find(it => (it.name || "").toLowerCase() === "speed");
		if (entry?.entries?.length !== 1) return options.cbWarning(`Could not convert speed\u2014no valid "Speed" entry found!`);

		const text = entry.entries[0];

		const mSimple = /^Your walking speed is (?<speed>\d+) feet\.?$/.exec(text);
		if (mSimple) {
			race.speed = Number(mSimple.groups.speed);
			// Filter out "redundant" speed info, as it will be displayed in subtitle
			race.entries = race.entries.filter(it => it !== entry);
			return;
		}

		const mAltEqual = /Your walking speed is (?<speed>\d+) feet, and you have a (?<modeAlt>swimming|climbing) speed equal to your walking speed\./.exec(text);
		if (mAltEqual) {
			const propAlt = mAltEqual.groups.modeAlt === "swimming" ? "swim" : "climb";
			race.speed = {
				walk: Number(mAltEqual.groups.speed),
				[propAlt]: true,
			};
			return;
		}

		options.cbWarning(`Size text "${text}" requires manual conversion!`);
	}

	static _doRacePostProcess_speedFlight (race, options) {
		if (race.speed == null) return;

		let found = false;

		const walker = MiscUtil.getWalker({isNoModification: true, isBreakOnReturn: true});

		for (const entry of race.entries) {
			walker.walk(
				entry.entries,
				{
					string: (str) => {
						found = /\byou have a flying speed equal to your walking speed\b/i.test(str)
							&& !/\b(?:temporarily|temporary)\b/i.test(str)
							&& !/\buntil [^.]+ ends\b/i.test(str);

						if (found) return true;
					},
				},
			);
			if (found) break;
		}

		if (!found) return;

		if (typeof race.speed === "number") {
			race.speed = {walk: race.speed, fly: true};
		} else {
			race.speed.fly = true;
		}
	}

	static _RE_CREATURE_TYPES = new RegExp(`You are(?: an?)? (?<type>${Parser.MON_TYPES.map(it => it.uppercaseFirst()).join("|")})(?:\\.|$)`);
	static _doRacePostProcess_creatureType (race, options) {
		const entry = race.entries.find(it => (it.name || "").toLowerCase() === "creature type");
		if (entry?.entries?.length !== 1) return options.cbWarning(`Could not convert creature type\u2014no valid "Creature Type" entry found!`);

		let text = entry.entries[0];

		const types = [];
		text = text
			.replace(/^You are a Humanoid(?:\.|$)/i, () => {
				types.push(Parser.TP_HUMANOID);
				return "";
			})
			.trim()
			.replace(this._RE_CREATURE_TYPES, (...m) => {
				types.push(m.last().type.toLowerCase());
				return "";
			})
			.trim()
			.replace(/You are also considered an? (?<tag>[-a-z]+) for any prerequisite or effect that requires you to be an? \k<tag>\./, (...m) => {
				race.creatureTypeTags = [m.last().tag.toLowerCase()];
				return "";
			})
		;

		// Filter out "redundant" creature type info, as we assume "undefined" = "humanoid"
		if (types.length === 1 && types[0] === Parser.TP_HUMANOID && !race.creatureTypeTags?.length) {
			race.entries = race.entries.filter(it => it !== entry);
		} else {
			race.creatureTypes = types;
		}

		if (text) {
			options.cbWarning(`Creature Type "${text}" requires manual conversion!`);
		}
	}

	static _doRacePostProcess_darkvision (race, options) {
		const entry = race.entries.find(it => (it.name || "").toLowerCase() === "darkvision");
		if (!entry?.entries?.length) return;

		const walker = MiscUtil.getWalker({isNoModification: true, isBreakOnReturn: true});
		walker.walk(
			entry,
			{
				string: (str) => {
					const mDarkvision = /\bsee [^.]+ dim light [^.]+ (?<radius>\d+) feet [^.]+ bright light/i.exec(str);
					if (!mDarkvision) return;

					race.darkvision = Number(mDarkvision.groups.radius);

					return true;
				},
			},
		);
	}

	// SHARED PARSING FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////
	static _setX (race, options, curLine) {

	}
}

globalThis.RaceParser = RaceParser;
