"use strict";

if (typeof module !== "undefined") {
	const cv = require("./converterutils.js");
	Object.assign(global, cv);
}

class RaceTraitTag {
	static _RE_ITEMS_BASE_WEAPON = null;

	static init ({itemsRaw}) {
		const itemsBaseWeapon = itemsRaw.baseitem.filter(it => ["R", "M"].includes(it.type));
		this._RE_ITEMS_BASE_WEAPON = new RegExp(`\\b(${itemsBaseWeapon.map(it => it.name)})\\b`, "gi");
	}

	static tryRun (race, {cbWarning}) {
		if (!race.entries?.length) return;

		const traitTags = new Set();

		const walker = MiscUtil.getWalker({isNoModification: true, isBreakOnReturn: true});

		race.entries
			.forEach(ent => {
				let isNaturalWeapon = false;

				// Natural weapons are a specific class of proficiency, so pull these out first
				walker.walk(
					ent,
					{
						string: (str) => {
							if (
								/\bnatural weapon\b/i.test(str)
								|| /\bcan use to make unarmed strikes\b/i.test(str)
							) {
								isNaturalWeapon = true;
								traitTags.add("Natural Weapon");
								return true;
							}
						},
					},
				);

				walker.walk(
					ent,
					{
						string: (str) => {
							if (/\barmor class\b/i.test(str) || /\bac\b/i.test(str)) {
								traitTags.add("Natural Armor");
							}

							if (
								!isNaturalWeapon
								&& /\bproficiency\b/i.test(str)
								&& !/\bproficiency bonus\b/i.test(str)
							) {
								let found = false;

								if (/\bskills?\b/i.test(str)) {
									traitTags.add("Skill Proficiency");
									found = true;
								}

								if (/\b(?:tool|poisoner's kit)\b/i.test(str)) {
									traitTags.add("Tool Proficiency");
									found = true;
								}

								if (/\b(light|medium|heavy) armor\b/i.test(str)) {
									traitTags.add("Armor Proficiency");
									found = true;
								}

								if (this._RE_ITEMS_BASE_WEAPON.test(str)) {
									traitTags.add("Weapon Proficiency");
									found = true;
								}

								if (!found) {
									cbWarning(`Could not determine proficiency tags from "${str}"`);
								}
							}

							if (/\blarger\b/i.test(str) && /\bsize\b/i.test(str) && /\bcapacity\b/i.test(str)) {
								traitTags.add("Powerful Build");
							}

							if (
								(/\bmeditate\b/i.test(str) || /\btrance\b/i.test(str) || /\bsleep\b/i.test(str))
								&& /\bfey ancestry\b/i.test(ent.name || "")
							) {
								traitTags.add("Improved Resting");
							}

							if (/\bbreathe\b/i.test(str) || /\bwater\b/i.test(str)) {
								traitTags.add("Amphibious");
							}

							if (/\bmagic resistance\b/i.test(str)) {
								traitTags.add("Magic Resistance");
							}

							if (/\bblindsight\b/i.test(str)) {
								traitTags.add("Blindsight");
							}

							if (/\bsunlight sensitivity\b/i.test(str) || /\bdisadvantage [^.?!]+ direct sunlight\b/i.test(str)) {
								traitTags.add("Sunlight Sensitivity");
							}
						},
					},
				);
			});

		if (traitTags.size) race.traitTags = [...traitTags].sort(SortUtil.ascSortLower);
	}
}

class RaceLanguageTag {
	static tryRun (race, {cbWarning, cbError}) {
		if (!race.entries?.length) return;

		const entry = race.entries.find(it => /^language/i.test(it.name || ""));
		if (!entry || !entry.entries?.length) return;

		const langProfs = this._getLanguages(entry, {cbWarning, cbError});
		if (langProfs.length) race.languageProficiencies = langProfs;
	}

	static _getLanguages (entry, {cbWarning, cbError}) {
		const outStack = [];

		const walker = MiscUtil.getWalker({isNoModification: true});

		entry.entries.forEach(ent => {
			walker.walk(
				ent,
				{
					string: (str) => {
						this._handleString({str, outStack, cbWarning, cbError});
					},
				},
			);
		});

		return outStack;
	}

	static _LANGUAGES = new Set(["Abyssal", "Aquan", "Auran", "Celestial", "Common", "Draconic", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Ignan", "Infernal", "Orc", "Primordial", "Sylvan", "Terran", "Undercommon"]);
	static _STOPWORDS = new Set(["Almost", "Elven", "Gifted", "It", "Languages", "Many", "Mimicry", "Only", "Or", "The", "Their", "They", "You", "Humans", "Conclave", "Kryta", "Hyperium", "Ithean", "Illyrian", "Speak"]);

	static _isCaps (str) { return /^[A-Z]/.test(str); }

	static _handleString ({str, outStack, cbWarning, cbError}) {
		// Remove the first word of each sentence, as it has non-title-based caps
		str = str.trim().replace(/(^\w+|[.?!]\s*\w+)/g, "");

		str = str
			// Combine tokens from any languages that has spaces in the name (this will be converted to "Other" later)
			.replace(/\bCoalition pidgin\b/gi, "Coalitionpidgin")
			// Remove anything that is not a language, but is uppercase'd
			.replace(/\bBrazen Coalition\b/gi, "brazen coalition")
			.replace(/\bSun Empire\b/gi, "sun empire")
			.replace(/\bLegion of Dusk\b/gi, "legion of dusk")
			// (Handle homebrew)
			.replace(/\bother language you knew in life\b/gi, "choose")
		;

		// Tokenize, removing anything that we don't care about
		const reChoose = /^(?:choice|choose|choosing|chosen|chooses|chose)$/;
		const tokens = str.split(" ")
			// replace all non-word characters (i.e. remove punctuation from tokens)
			.map(it => it.replace(/\W/g, "").trim())
			.filter(t => {
				if (!t) return false;

				if (this._isCaps(t)) return true; // keep all caps-words
				if (/^(?:one|two|three|four|five|six|seven|eight|nine|ten)$/.test(t)) return true; // keep any numbers
				if (reChoose.test(t)) return true; // keep any "choose" words
			})
			.map(it => {
				// Map any "choose" flavors to a base string
				if (reChoose.test(it)) return "choose";
				return it;
			});

		// De-duplicate caps words
		const reducedTokens = [];
		tokens.forEach(t => {
			if (this._isCaps(t)) {
				if (!reducedTokens.includes(t)) reducedTokens.push(t);
				return;
			}
			reducedTokens.push(t);
		});
		const reducedTokensCleaned = reducedTokens
			// Filter out junk
			.filter(t => !this._STOPWORDS.has(t));

		if (!reducedTokensCleaned.length) return;

		// Sort tokens so that any adjacent "<number>" + "choose" tokens are always ordered thus
		const sortedTokens = [];
		for (let i = 0; i < reducedTokensCleaned.length; ++i) {
			const t0 = reducedTokensCleaned[i];
			const t1 = reducedTokensCleaned[i + 1];

			if (this._isCaps(t0)) {
				sortedTokens.push(t0);
				continue;
			}

			if (t0 === "choose" && t1 === "choose") {
				return cbError(`Two language "choose" tokens in a row!`);
			}

			if (t0 === "choose") {
				if (this._isCaps(t1)) {
					sortedTokens.push("one");
					sortedTokens.push(t0);
				} else {
					// flip the order so the number is first
					sortedTokens.push(t1);
					sortedTokens.push(t0);
					++i;
				}
				continue;
			}

			if (t1 === "choose") {
				if (this._isCaps(t0)) {
					sortedTokens.push("one");
					sortedTokens.push(t1);
				} else {
					sortedTokens.push(t0);
					sortedTokens.push(t1);
					++i;
				}
				continue;
			}

			return cbError(`Mismatched language token in: ${reducedTokensCleaned.join(" ")} (current output is ${sortedTokens.join(" ")})`);
		}

		let out = {};
		let lastNum = null;

		sortedTokens.forEach(t => {
			if (this._isCaps(t)) {
				out[(this._LANGUAGES.has(t) ? t : "Other").toLowerCase()] = true;
				return;
			}

			// A meta-token
			switch (t) {
				case "choose": {
					out.anyStandard = lastNum;
					outStack.push(out);
					out = {};
					lastNum = null;
					break;
				}
				default: {
					const n = Parser.textToNumber(t);
					if (isNaN(n)) return cbError(`Could not parse language token "${t}" as number`);
					lastNum = n;
				}
			}
		});

		if (Object.keys(out).length) outStack.push(out);
	}
}

class RaceImmResVulnTag {
	static _RE_DAMAGE_TYPES = new RegExp(`(${Parser.DMG_TYPES.join("|")})`, "gi");
	static _WALKER = null;

	static tryRun (race, {cbWarning, cbError} = {}) {
		if (!race.entries?.length) return;

		this._WALKER = this._WALKER || MiscUtil.getWalker({keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST, isNoModification: true});

		this._handleResist(race);
		this._handleImmune(race);
		this._handleConditionImmune(race);
	}

	static _handleResist (race) {
		if (!race.entries) return;

		const out = new Set();

		race.entries.forEach(ent => {
			this._WALKER.walk(
				ent.entries,
				{
					string: (str) => {
						str.replace(/(?:resistance|resistant) (?:to|against) ([^.!?]+)/gi, (...m) => {
							m[1].replace(this._RE_DAMAGE_TYPES, (...n) => {
								out.add(n[1].toLowerCase());
							});
						});
					},
				},
			);
		});

		// region Special cases
		if (race.name === "Dragonborn" && race.source === SRC_PHB) {
			out.add({"choose": {"from": ["acid", "cold", "fire", "lightning", "poison"]}});
		} else if (race.name === "Revenant" && race.source === "UAGothicHeroes") {
			out.add("necrotic");
		}
		// endregion

		if (out.size) race.resist = [...out];
		else delete race.resist;
	}

	static _handleImmune (race) {
		if (!race.entries) return;

		const out = new Set();

		race.entries.forEach(ent => {
			this._WALKER.walk(
				ent.entries,
				{
					string: (str) => {
						str = Renderer.stripTags(str);

						const sents = str.split(/[.?!]/g);
						sents.forEach(sent => {
							if (!sent.toLowerCase().includes("immune ") || !sent.toLowerCase().includes(" damage")) return;

							const tokens = sent.replace(/[^A-z0-9 ]/g, "").split(" ").map(it => it.trim().toLowerCase());
							Parser.DMG_TYPES.filter(typ => tokens.includes(typ)).forEach(it => out.add(it));
						});
					},
				},
			);
		});

		if (out.size) race.immune = [...out];
		else delete race.immune;
	}

	static _handleConditionImmune (race) {
		if (!race.entries) return;

		const out = new Set();

		race.entries.forEach(ent => {
			this._WALKER.walk(
				ent.entries,
				{
					string: (str) => {
						str.replace(/immune to disease/gi, () => {
							out.add("disease");
						});

						str.replace(/immune ([^.!?]+)/, (...m) => {
							m[1].replace(/{@condition ([^}]+)}/gi, (...n) => {
								out.add(n[1].toLowerCase());
							});
						});
					},
				},
			);
		});

		if (out.size) race.conditionImmune = [...out];
		else delete race.conditionImmune;
	}
}

if (typeof module !== "undefined") {
	module.exports = {
		RaceTraitTag,
		RaceLanguageTag,
		RaceImmResVulnTag,
	};
}
