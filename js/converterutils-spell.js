"use strict";

class DamageTagger {
	static _addDamageTypeToArray (arr, str, options) {
		str = str.toLowerCase().trim();
		if (str === "all" || str === "one" || str === "a") arr.push(...Parser.DMG_TYPES);
		else if (Parser.DMG_TYPES.includes(str)) arr.push(str);
		else options.cbWarning(`Unknown damage type "${str}"`);
	}
}

class DamageInflictTagger extends DamageTagger {
	static tryRun (sp, options) {
		sp.damageInflict = [];
		JSON.stringify([sp.entries, sp.entriesHigherLevel]).replace(/(?:{@damage [^}]+}|\d+) (\w+)((?:, \w+)*)(,? or \w+)? damage/ig, (...m) => {
			if (m[1]) this._addDamageTypeToArray(sp.damageInflict, m[1], options);
			if (m[2]) m[2].split(",").map(it => it.trim()).filter(Boolean).forEach(str => this._addDamageTypeToArray(sp.damageInflict, str, options));
			if (m[3]) this._addDamageTypeToArray(sp.damageInflict, m[3].split(" ").last(), options);
		});
		if (!sp.damageInflict.length) delete sp.damageInflict;
		else sp.damageInflict = [...new Set(sp.damageInflict)].sort(SortUtil.ascSort);
	}
}

class DamageResVulnImmuneTagger extends DamageTagger {
	static tryRun (sp, prop, options) {
		sp[prop] = [];
		JSON.stringify([sp.entries, sp.entriesHigherLevel]).replace(/resistance to (\w+)((?:, \w+)*)(,? or \w+)? damage/ig, (...m) => {
			if (m[1]) this._addDamageTypeToArray(sp[prop], m[1], options);
			if (m[2]) m[2].split(",").map(it => it.trim()).filter(Boolean).forEach(str => this._addDamageTypeToArray(sp[prop], str, options));
			if (m[3]) this._addDamageTypeToArray(sp[prop], m[3].split(" ").last(), options);
		});
		if (!sp[prop].length) delete sp[prop];
		else sp[prop] = [...new Set(sp[prop])].sort(SortUtil.ascSort);
	}
}

class ConditionInflictTagger {
	static tryRun (sp, options) {
		sp.conditionInflict = [];
		JSON.stringify([sp.entries, sp.entriesHigherLevel]).replace(/{@condition ([^}]+)}/ig, (...m) => sp.conditionInflict.push(m[1].toLowerCase()));
		if (!sp.conditionInflict.length) delete sp.conditionInflict;
		else sp.conditionInflict = [...new Set(sp.conditionInflict)].sort(SortUtil.ascSort);
	}
}

class SavingThrowTagger {
	static tryRun (sp, options) {
		sp.savingThrow = [];
		JSON.stringify([sp.entries, sp.entriesHigherLevel]).replace(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/ig, (...m) => sp.savingThrow.push(m[1].toLowerCase()));
		if (!sp.savingThrow.length) delete sp.savingThrow;
		else sp.savingThrow = [...new Set(sp.savingThrow)].sort(SortUtil.ascSort);
	}
}

class AbilityCheckTagger {
	static tryRun (sp, options) {
		sp.abilityCheck = [];
		JSON.stringify([sp.entries, sp.entriesHigherLevel]).replace(/a (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) check/ig, (...m) => sp.abilityCheck.push(m[1].toLowerCase()));
		if (!sp.abilityCheck.length) delete sp.abilityCheck;
		else sp.abilityCheck = [...new Set(sp.abilityCheck)].sort(SortUtil.ascSort);
	}
}

class SpellAttackTagger {
	static tryRun (sp, options) {
		sp.spellAttack = [];
		JSON.stringify([sp.entries, sp.entriesHigherLevel]).replace(/make (?:a|up to [^ ]+) (ranged|melee) spell attack/ig, (...m) => sp.spellAttack.push(m[1][0].toUpperCase()));
		if (!sp.spellAttack.length) delete sp.spellAttack;
		else sp.spellAttack = [...new Set(sp.spellAttack)].sort(SortUtil.ascSort);
	}
}

// TODO areaTags

class MiscTagsTagger {
	static _addTag ({tags, tag, options}) {
		if (options?.allowlistTags && !options?.allowlistTags.has(tag)) return;
		tags.add(tag);
	}

	static tryRun (sp, options) {
		const tags = new Set(sp.miscTags || []);

		MiscTagsTagger._WALKER = MiscTagsTagger._WALKER || MiscUtil.getWalker({isNoModification: true, keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST});
		MiscTagsTagger._WALKER.walk(
			[sp.entries, sp.entriesHigherLevel],
			{
				string: (str) => {
					if (/becomes permanent/ig.test(str)) this._addTag({tags, tag: "PRM", options});
					if (/when you reach/ig.test(str)) this._addTag({tags, tag: "SCL", options});
					if ((/regain|restore/ig.test(str) && /hit point/ig.test(str)) || /heal/ig.test(str)) this._addTag({tags, tag: "HL", options});
					if (/temporary hit points/ig.test(str)) this._addTag({tags, tag: "THP", options});
					if (/you summon/ig.test(str) || /creature shares your initiative count/ig.test(str)) this._addTag({tags, tag: "SMN", options});
					if (/you can see/ig.test(str)) this._addTag({tags, tag: "SGT", options});
					if (/you (?:can then )?teleport/i.test(str) || /instantly (?:transports you|teleport)/i.test(str) || /enters(?:[^.]+)portal instantly/i.test(str) || /entering the portal exits from the other portal/i.test(str)) this._addTag({tags, tag: "TP", options});

					if ((str.includes("bonus") || str.includes("penalty")) && str.includes("AC")) this._addTag({tags, tag: "MAC", options});
					if (/target's (?:base )?AC becomes/.exec(str)) this._addTag({tags, tag: "MAC", options});
					if (/target's AC can't be less than/.exec(str)) this._addTag({tags, tag: "MAC", options});

					if (/(?:^|\W)(?:pull(?:|ed|s)|push(?:|ed|s)) [^.!?:]*\d+\s+(?:ft|feet|foot|mile|square)/ig.test(str)) this._addTag({tags, tag: "FMV", options});

					if (/rolls? (?:a )?{@dice [^}]+} and consults? the table/.test(str)) this._addTag({tags, tag: "RO", options});

					if ((/\bbright light\b/i.test(str) || /\bdim light\b/i.test(str)) && /\b\d+[- ]foot[- ]radius\b/i.test(str)) {
						if (/\bsunlight\b/.test(str)) this._addTag({tags, tag: "LGTS", options});
						else this._addTag({tags, tag: "LGT", options});
					}

					if (/\bbonus action\b/i.test(str)) this._addTag({tags, tag: "UBA", options});

					if (/\b(?:lightly|heavily) obscured\b/i.test(str)) this._addTag({tags, tag: "OBS", options});

					if (/\bis difficult terrain\b/i.test(Renderer.stripTags(str)) || /spends? \d+ (?:feet|foot) of movement for every 1 foot/.test(str)) this._addTag({tags, tag: "DFT", options});

					if (
						/\battacks? deals? an extra\b[^.!?]+\bdamage\b/.test(str)
						|| /\bdeals? an extra\b[^.!?]+\bdamage\b[^.!?]+\b(?:weapon attack|when it hits)\b/.test(str)
						|| /weapon attacks?\b[^.!?]+\b(?:takes an extra|deal an extra)\b[^.!?]+\bdamage/.test(str)
					) this._addTag({tags, tag: "AAD", options});

					if (
						/\b(?:any|one|a) creatures? or objects?\b/i.test(str)
						|| /\b(?:flammable|nonmagical|metal|unsecured) objects?\b/.test(str)
						|| /\bobjects?\b[^.!?]+\b(?:created by magic|(?:that )?you touch|that is neither held nor carried)\b/.test(str)
						|| /\bobject\b[^.!?]+\bthat isn't being worn or carried\b/.test(str)
						|| /\bobjects? (?:of your choice|that is familiar to you|of (?:Tiny|Small|Medium|Large|Huge|Gargantuan) size)\b/.test(str)
						|| /\b(?:Tiny|Small|Medium|Large|Huge|Gargantuan) or smaller object\b/.test(str)
						|| /\baffected by this spell, the object is\b/.test(str)
						|| /\ball creatures and objects\b/i.test(str)
						|| /\ba(?:ny|n)? (?:(?:willing|visible|affected) )?(?:creature|place) or an object\b/i.test(str)
						|| /\bone creature, object, or magical effect\b/i.test(str)
						|| /\ba person, place, or object\b/i.test(str)
						|| /\b(choose|touch|manipulate|soil) (an|one) object\b/i.test(str)
					) this._addTag({tags, tag: "OBJ", options});
				},
				object: (obj) => {
					if (obj.type !== "table") return;

					const rollMode = Renderer.table.getAutoConvertedRollMode(obj);
					if (rollMode !== RollerUtil.ROLL_COL_NONE) this._addTag({tags, tag: "RO", options});
				},
			},
		);

		sp.miscTags = [...tags].sort(SortUtil.ascSortLower);
		if (!sp.miscTags.length) delete sp.miscTags;
	}
}
MiscTagsTagger._WALKER = null;

class ScalingLevelDiceTagger {
	static tryRun (sp, options) {
		if (sp.level !== 0) return;

		const strEntries = JSON.stringify(sp.entries);
		const rolls = [];
		strEntries.replace(/{@(?:damage|dice) ([^}]+)}/g, (...m) => {
			rolls.push(m[1].split("|")[0]);
		});

		const getLabel = () => {
			let label;

			const mDamageType = ConverterConst.RE_DAMAGE_TYPE.exec(strEntries);
			if (mDamageType) {
				label = `${mDamageType[1]} damage`;
			}

			ConverterConst.RE_DAMAGE_TYPE.lastIndex = 0;

			if (!label) options.cbWarning(`${sp.name ? `(${sp.name}) ` : ""}Could not create scalingLevelDice label!`);
			return label || "NO_LABEL";
		};

		if ((rolls.length === 4 && strEntries.includes("one die")) || rolls.length === 5) {
			if (rolls.length === 5 && rolls[0] !== rolls[1]) options.cbWarning(`${sp.name ? `(${sp.name}) ` : ""}scalingLevelDice rolls may require manual checking--mismatched roll number of rolls!`);

			sp.scalingLevelDice = {
				label: getLabel(),
				scaling: rolls.length === 4
					? {
						1: rolls[0],
						5: rolls[1],
						11: rolls[2],
						17: rolls[3],
					} : {
						1: rolls[0],
						5: rolls[2],
						11: rolls[3],
						17: rolls[4],
					},
			};
		} else if (sp.entries.length === 2 && sp.entries.filter(it => typeof it === "string").length === 2) {
			const rollsFirstLine = [];
			const rollsSecondLine = [];

			sp.entries[0].replace(/{@(?:damage|dice) ([^}]+)}/g, (...m) => {
				rollsFirstLine.push(m[1].split("|")[0]);
			});

			sp.entries[1].replace(/\({@(?:damage|dice) ([^}]+)}\)/g, (...m) => {
				rollsSecondLine.push(m[1].split("|")[0]);
			});

			if (rollsFirstLine.length >= 1 && rollsSecondLine.length >= 3) {
				if (rollsFirstLine.length > 1 || rollsSecondLine.length > 3) {
					options.cbWarning(`${sp.name ? `(${sp.name}) ` : ""}scalingLevelDice rolls may require manual checking--too many dice parts!`);
				}

				const label = getLabel();
				sp.scalingLevelDice = {
					label: label,
					scaling: {
						1: rollsFirstLine[0],
						5: rollsSecondLine[0],
						11: rollsSecondLine[1],
						17: rollsSecondLine[2],
					},
				};
			}
		}
	}
}

class AffectedCreatureTypeTagger {
	static tryRun (sp, options) {
		const setAffected = new Set();
		const setNotAffected = new Set();

		const walker = MiscUtil.getWalker({isNoModification: true});

		walker.walk(
			sp.entries,
			{
				string: (str) => {
					str = Renderer.stripTags(str);

					const sens = str.split(/[.!?]/g);
					sens.forEach(sen => {
						// region Not affected
						sen
							// Blight :: PHB
							.replace(/This spell has no effect on (.+)/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setNotAffected, type: n[1]}));
							})
							// Command :: PHB
							.replace(/The spell has no effect if the target is (.*)/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setNotAffected, type: n[1]}));
							})
							// Raise Dead :: PHB
							.replace(/The spell can't return an (.*?) creature/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setNotAffected, type: n[1]}));
							})
							// Shapechange :: PHB
							.replace(/The creature can't be (.*)/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setNotAffected, type: n[1]}));
							})
							// Sleep :: PHB
							.replace(/(.*?) aren't affected by this spell/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setNotAffected, type: n[1]}));
							})
							// Speak with Dead :: PHB
							.replace(/The corpse\b.*?\bcan't be (.*)/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setNotAffected, type: n[1]}));
							})

							// Cause Fear :: XGE
							.replace(/A (.*?) is immune to this effect/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setNotAffected, type: n[1]}));
							})
							// Healing Spirit :: XGE
							.replace(/can't heal (.*)/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setNotAffected, type: n[1]}));
							})
						;
						// endregion

						// region Affected
						sen
							// Awaken :: PHB
							.replace(/you touch a [^ ]+ or (?:smaller|larger) (.+)/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Calm Emotions :: PHB
							.replace(/Each (.+) in a \d+-foot/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Charm Person :: PHB
							.replace(/One (.*?) of your choice/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Crown of Madness :: PHB
							.replace(/You attempt to .* a (.+) you can see/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Detect Evil and Good :: PHB
							.replace(/you know if there is an? (.*)/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Dispel Evil and Good :: PHB
							.replace(/For the duration, (.*?) have disadvantage/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Hold Person :: PHB
							.replace(/Choose (.+)/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Locate Animals or Plants :: PHB
							.replace(/name a specific kind of (.*)/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Magic Jar :: PHB
							.replace(/You can attempt to possess any (.*?) that you can see/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Planar Binding :: PHB
							.replace(/you attempt to bind a (.*)/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Protection from Evil and Good :: PHB
							.replace(/types of creatures: (.*)/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Reincarnate :: PHB
							.replace(/You touch a dead (.*)/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Simulacrum :: PHB
							.replace(/You shape an illusory duplicate of one (.*)/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Speak with Animals :: PHB
							.replace(/communicate with (.*?) for the duration/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})

							// Fast Friends :: AI
							.replace(/choose one (.*?) within range/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})

							// Beast Bond :: XGE
							.replace(/telepathic link with one (.*?) you touch/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Ceremony :: XGE
							.replace(/You touch one (.*?) who/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
							// Soul Cage :: XGE
							.replace(/\bsoul of (.*?) as it dies/g, (...m) => {
								m[1].replace(AffectedCreatureTypeTagger._RE_TYPES, (...n) => this._doAddType({set: setAffected, type: n[1]}));
							})
						;
						// endregion
					});
				},
			},
		);

		if (!setAffected.size && !setNotAffected.size) return;

		const setAffectedOut = new Set([
			...(sp.affectsCreatureType || []),
			...setAffected,
		]);
		if (!setAffectedOut.size) Parser.MON_TYPES.forEach(it => setAffectedOut.add(it));

		sp.affectsCreatureType = [...CollectionUtil.setDiff(setAffectedOut, setNotAffected)].sort(SortUtil.ascSortLower);
		if (!sp.affectsCreatureType.length) delete sp.affectsCreatureType;
	}

	static _doAddType ({set, type}) {
		type = Parser._parse_bToA(Parser.MON_TYPE_TO_PLURAL, type, type);
		set.add(type);
		return "";
	}
}
AffectedCreatureTypeTagger._RE_TYPES = new RegExp(`\\b(${[...Parser.MON_TYPES, ...Object.values(Parser.MON_TYPE_TO_PLURAL)].map(it => it.escapeRegexp()).join("|")})\\b`, "gi");

globalThis.DamageInflictTagger = DamageInflictTagger;
globalThis.DamageResVulnImmuneTagger = DamageResVulnImmuneTagger;
globalThis.ConditionInflictTagger = ConditionInflictTagger;
globalThis.SavingThrowTagger = SavingThrowTagger;
globalThis.AbilityCheckTagger = AbilityCheckTagger;
globalThis.SpellAttackTagger = SpellAttackTagger;
globalThis.MiscTagsTagger = MiscTagsTagger;
globalThis.ScalingLevelDiceTagger = ScalingLevelDiceTagger;
globalThis.AffectedCreatureTypeTagger = AffectedCreatureTypeTagger;
