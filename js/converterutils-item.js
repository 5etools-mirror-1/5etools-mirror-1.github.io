"use strict";

if (typeof module !== "undefined") {
	const cv = require("./converterutils.js");
	Object.assign(global, cv);
}

class ConverterUtilsItem {}
ConverterUtilsItem.BASIC_WEAPONS = [
	"club",
	"dagger",
	"greatclub",
	"handaxe",
	"javelin",
	"light hammer",
	"mace",
	"quarterstaff",
	"sickle",
	"spear",
	"light crossbow",
	"dart",
	"shortbow",
	"sling",
	"battleaxe",
	"flail",
	"glaive",
	"greataxe",
	"greatsword",
	"halberd",
	"lance",
	"longsword",
	"maul",
	"morningstar",
	"pike",
	"rapier",
	"scimitar",
	"shortsword",
	"trident",
	"war pick",
	"warhammer",
	"whip",
	"blowgun",
	"hand crossbow",
	"heavy crossbow",
	"longbow",
	"net",
];
ConverterUtilsItem.BASIC_ARMORS = [
	"padded armor",
	"leather armor",
	"studded leather armor",
	"hide armor",
	"chain shirt",
	"scale mail",
	"breastplate",
	"half plate armor",
	"ring mail",
	"chain mail",
	"splint armor",
	"plate armor",
	"shield",
];

class ChargeTag {
	static _checkAndTag (obj, opts) {
		opts = opts || {};

		const strEntries = JSON.stringify(obj.entries);
		const mCharges = /(?:have|has|with) (\d+|{@dice .*?}) charge/gi.exec(strEntries);
		if (!mCharges) return;

		const ix = mCharges.index;
		obj.charges = isNaN(Number(mCharges[1])) ? mCharges[1] : Number(mCharges[1]);

		if (opts.cbInfo) {
			const ixMin = Math.max(0, ix - 10);
			const ixMax = Math.min(strEntries.length, ix + 10);
			opts.cbInfo(obj, strEntries, ixMin, ixMax);
		}
	}

	static tryRun (it, opts) {
		if (it.entries) this._checkAndTag(it, opts);
		if (it.inherits && it.inherits.entries) this._checkAndTag(it.inherits, opts);
	}
}

class RechargeTypeTag {
	static _checkAndTag (obj, opts) {
		if (!obj.entries) return;

		const strEntries = JSON.stringify(obj.entries, null, 2);

		const mDawn = /charges? at dawn|charges? daily at dawn|charges? each day at dawn|charges and regains all of them at dawn|charges and regains[^.]+each dawn|recharging them all each dawn|charges that are replenished each dawn/gi.exec(strEntries);
		if (mDawn) return obj.recharge = "dawn";

		const mDusk = /charges? daily at dusk|charges? each day at dusk/gi.exec(strEntries);
		if (mDusk) return obj.recharge = "dusk";

		const mMidnight = /charges? daily at midnight|Each night at midnight[^.]+charges/gi.exec(strEntries);
		if (mMidnight) return obj.recharge = "midnight";

		if (opts.cbMan) opts.cbMan(obj.name, obj.source);
	}

	static tryRun (it, opts) {
		if (it.charges) this._checkAndTag(it, opts);
		if (it.inherits && it.inherits.charges) this._checkAndTag(it.inherits, opts);
	}
}

class AttachedSpellTag {
	static _checkAndTag (obj, opts) {
		const strEntries = JSON.stringify(obj.entries);

		const outSet = new Set();

		const regexps = [ // uses m[1]
			/duplicate the effect of the {@spell ([^}]*)} spell/gi,
			/a creature is under the effect of a {@spell ([^}]*)} spell/gi,
			/(?:gain(?:s)?|under|produces) the (?:[a-zA-Z\\"]+ )?effect of (?:the|a|an) {@spell ([^}]*)} spell/gi,
			/functions as the {@spell ([^}]*)} spell/gi,
			/as with the {@spell ([^}]*)} spell/gi,
			/as if using a(?:n)? {@spell ([^}]*)} spell/gi,
			/cast a(?:n)? {@spell ([^}]*)} spell/gi,
			/as a(?:n)? \d..-level {@spell ([^}]*)} spell/gi,
			/cast(?:(?: a version of)? the)? {@spell ([^}]*)}/gi,
			/cast the \d..-level version of {@spell ([^}]*)}/gi,
			/{@spell ([^}]*)} \([^)]*\d+ charge(?:s)?\)/gi,
		];

		const regexpsSeries = [ // uses m[0]
			/emanate the [^.]* spell/gi,
			/cast one of the following [^.]*/gi,
			/can be used to cast [^.]*/gi,
			/you can([^.]*expend[^.]*)? cast [^.]* (and|or) [^.]*/gi,
			/you can([^.]*)? cast [^.]* (and|or) [^.]* from the weapon/gi,
		];

		const addTaggedSpells = str => str.replace(/{@spell ([^}]*)}/gi, (...m) => outSet.add(m[1].toSpellCase()));

		regexps.forEach(re => {
			strEntries.replace(re, (...m) => outSet.add(m[1].toSpellCase()));
		});

		regexpsSeries.forEach(re => {
			strEntries.replace(re, (...m) => addTaggedSpells(m[0]));
		});

		// region Tag spells in tables
		const walker = MiscUtil.getWalker();
		const walkerHandlers = {
			obj: [
				(obj) => {
					if (obj.type !== "table") return obj;

					// Require the table to have the string "spell" somewhere in its caption/column labels
					const hasSpellInCaption = obj.caption && /spell/i.test(obj.caption);
					const hasSpellInColLabels = obj.colLabels && obj.colLabels.some(it => /spell/i.test(it));
					if (!hasSpellInCaption && !hasSpellInColLabels) return obj;

					(obj.rows || []).forEach(r => {
						r.forEach(c => addTaggedSpells(c));
					});

					return obj;
				},
			],
		};
		const cpy = MiscUtil.copy(obj);
		walker.walk(cpy, walkerHandlers);
		// endregion

		obj.attachedSpells = [...outSet];
		if (!obj.attachedSpells.length) delete obj.attachedSpells;
	}

	static tryRun (it, opts) {
		if (it.entries) this._checkAndTag(it, opts);
		if (it.inherits && it.inherits.entries) this._checkAndTag(it.inherits, opts);
	}
}

class BonusTag {
	static _runOn (obj, prop, opts) {
		opts = opts || {};
		let strEntries = JSON.stringify(obj.entries);

		// Clean the root--"inherits" data may have specific bonuses as per the variant (e.g. +3 weapon -> +3) that
		//   we don't want to remove.
		// Legacy "bonus" data will be cleaned up if an updated bonus type is found.
		if (prop !== "inherits") {
			delete obj.bonusWeapon;
			delete obj.bonusWeaponAttack;
			delete obj.bonusAc;
			delete obj.bonusSavingThrow;
			delete obj.bonusSpellAttack;
			delete obj.bonusSpellSaveDc;
		}

		strEntries = strEntries.replace(/\+\s*(\d)([^.]+(?:bonus )?(?:to|on) [^.]*(?:attack|hit) and damage rolls)/ig, (...m) => {
			if (m[0].toLowerCase().includes("spell")) return m[0];

			obj.bonusWeapon = `+${m[1]}`;
			return opts.isVariant ? `{=bonusWeapon}${m[2]}` : m[0];
		});

		strEntries = strEntries.replace(/\+\s*(\d)([^.]+(?:bonus )?(?:to|on) [^.]*(?:attack rolls|hit))/ig, (...m) => {
			if (obj.bonusWeapon) return m[0];
			if (m[0].toLowerCase().includes("spell")) return m[0];

			obj.bonusWeaponAttack = `+${m[1]}`;
			return opts.isVariant ? `{=bonusWeaponAttack}${m[2]}` : m[0];
		});

		strEntries = strEntries.replace(/\+\s*(\d)([^.]+(?:bonus )?(?:to|on)(?: your)? [^.]*(?:AC|Armor Class|armor class))/g, (...m) => {
			obj.bonusAc = `+${m[1]}`;
			return opts.isVariant ? `{=bonusAc}${m[2]}` : m[0];
		});

		// FIXME(Future) false positives:
		//   - Black Dragon Scale Mail
		strEntries = strEntries.replace(/\+\s*(\d)([^.]+(?:bonus )?(?:to|on) [^.]*saving throws)/g, (...m) => {
			obj.bonusSavingThrow = `+${m[1]}`;
			return opts.isVariant ? `{=bonusSavingThrow}${m[2]}` : m[0];
		});

		// FIXME(Future) false negatives:
		//   - Robe of the Archmagi
		strEntries = strEntries.replace(/\+\s*(\d)([^.]+(?:bonus )?(?:to|on) [^.]*spell attack rolls)/g, (...m) => {
			obj.bonusSpellAttack = `+${m[1]}`;
			return opts.isVariant ? `{=bonusSpellAttack}${m[2]}` : m[0];
		});

		// FIXME(Future) false negatives:
		//   - Robe of the Archmagi
		strEntries = strEntries.replace(/\+\s*(\d)([^.]+(?:bonus )?(?:to|on) [^.]*saving throw DCs)/g, (...m) => {
			obj.bonusSpellSaveDc = `+${m[1]}`;
			return opts.isVariant ? `{=bonusSpellSaveDc}${m[2]}` : m[0];
		});

		strEntries = strEntries.replace(BonusTag._RE_BASIC_WEAPONS, (...m) => {
			obj.bonusWeapon = `+${m[1]}`;
			return opts.isVariant ? `{=bonusWeapon}${m[2]}` : m[0];
		});

		strEntries = strEntries.replace(BonusTag._RE_BASIC_ARMORS, (...m) => {
			obj.bonusAc = `+${m[1]}`;
			return opts.isVariant ? `{=bonusAc}${m[2]}` : m[0];
		});

		// region Homebrew
		// "this weapon is a {@i dagger +1}"
		strEntries = strEntries.replace(/({@i(?:tem)? )([^}]+ )\+(\d+)((?:|[^}]+)?})/, (...m) => {
			const ptItem = m[2].trim().toLowerCase();
			if (ConverterUtilsItem.BASIC_WEAPONS.includes(ptItem)) {
				obj.bonusWeapon = `+${m[3]}`;
				return opts.isVariant ? `${m[1]}${m[2]}{=bonusWeapon}${m[2]}` : m[0];
			} else if (ConverterUtilsItem.BASIC_ARMORS.includes(ptItem)) {
				obj.bonusAc = `+${m[3]}`;
				return opts.isVariant ? `${m[1]}${m[2]}{=bonusAc}${m[2]}` : m[0];
			}
			return m[0];
		});

		// Damage roll with no attack roll
		strEntries = strEntries.replace(/\+\s*(\d)([^.]+(?:bonus )?(?:to|on) [^.]*damage rolls)/ig, (...m) => {
			if (obj.bonusWeapon) return m[0];

			obj.bonusWeaponDamage = `+${m[1]}`;
			return opts.isVariant ? `{=bonusWeaponDamage}${m[2]}` : m[0];
		});

		strEntries = strEntries.replace(/(grants )\+\s*(\d)((?: to| on)?(?: your)? [^.]*(?:AC|Armor Class|armor class))/g, (...m) => {
			obj.bonusAc = `+${m[2]}`;
			return opts.isVariant ? `${m[1]}{=bonusAc}${m[3]}` : m[0];
		});
		// endregion

		// If the bonus weapon attack and damage are identical, combine them
		if (obj.bonusWeaponAttack && obj.bonusWeaponDamage && obj.bonusWeaponAttack === obj.bonusWeaponDamage) {
			obj.bonusWeapon = obj.bonusWeaponAttack;
			delete obj.bonusWeaponAttack;
			delete obj.bonusWeaponDamage;
		}

		// TODO(Future) expand this?
		strEntries.replace(/scores? a critical hit on a (?:(?:{@dice )?d20}? )?roll of 19 or 20/gi, () => {
			obj.critThreshold = 19;
		});

		// TODO(Future) `.bonusWeaponCritDamage` (these are relatively uncommon)

		// region Speed bonus
		this._mutSpeedBonus({obj, strEntries});
		// endregion

		obj.entries = JSON.parse(strEntries);
	}

	static _mutSpeedBonus ({obj, strEntries}) {
		strEntries.replace(BonusTag._RE_SPEED_MULTIPLE, (...m) => {
			const {mode, factor} = m.last();
			obj.modifySpeed = {multiplier: {[this._getSpeedKey(mode)]: Parser.textToNumber(factor)}};
		});

		[BonusTag._RE_SPEED_BECOMES, BonusTag._RE_SPEED_GAIN, BonusTag._RE_SPEED_GAIN__EXPEND_CHARGE, BonusTag._RE_SPEED_GIVE_YOU].forEach(re => {
			strEntries.replace(re, (...m) => {
				const {mode, value} = m.last();
				obj.modifySpeed = MiscUtil.merge(obj.modifySpeed || {}, {static: {[this._getSpeedKey(mode)]: Number(value)}});
			});
		});

		strEntries.replace(BonusTag._RE_SPEED_EQUAL_WALKING, (...m) => {
			const {mode} = m.last();
			obj.modifySpeed = MiscUtil.merge(obj.modifySpeed || {}, {equal: {[this._getSpeedKey(mode)]: "walk"}});
		});

		strEntries.replace(BonusTag._RE_SPEED_BONUS_ALL, (...m) => {
			const {value} = m.last();
			obj.modifySpeed = MiscUtil.merge(obj.modifySpeed || {}, {bonus: {"*": Number(value)}});
		});

		strEntries.replace(BonusTag._RE_SPEED_BONUS_SPECIFIC, (...m) => {
			const {mode, value} = m.last();
			obj.modifySpeed = MiscUtil.merge(obj.modifySpeed || {}, {bonus: {[this._getSpeedKey(mode)]: Number(value)}});
		});
	}

	static _getSpeedKey (speedText) {
		speedText = speedText.toLowerCase().trim();
		switch (speedText) {
			case "walking":
			case "burrowing":
			case "climbing":
			case "flying": return speedText.replace(/ing$/, "");
			case "swimming": return "swim";
			default: throw new Error(`Unhandled speed text "${speedText}"`);
		}
	}

	static tryRun (it, opts) {
		if (it.inherits && it.inherits.entries) this._runOn(it.inherits, "inherits", opts);
		else if (it.entries) this._runOn(it, null, opts);
	}
}
BonusTag._RE_BASIC_WEAPONS = new RegExp(`\\+\\s*(\\d)(\\s+(?:${ConverterUtilsItem.BASIC_WEAPONS.join("|")}|weapon))`);
BonusTag._RE_BASIC_ARMORS = new RegExp(`\\+\\s*(\\d)(\\s+(?:${ConverterUtilsItem.BASIC_ARMORS.join("|")}|armor))`);
BonusTag._PT_SPEEDS = `(?<mode>walking|flying|swimming|climbing|burrowing)`;
BonusTag._PT_SPEED_VALUE = `(?<value>\\d+)`;
BonusTag._RE_SPEED_MULTIPLE = new RegExp(`(?<factor>double|triple|quadruple) your ${BonusTag._PT_SPEEDS} speed`, "gi");
BonusTag._RE_SPEED_BECOMES = new RegExp(`your ${BonusTag._PT_SPEEDS} speed becomes ${BonusTag._PT_SPEED_VALUE} feet`, "gi");
BonusTag._RE_SPEED_GAIN = new RegExp(`you (?:gain|have) a ${BonusTag._PT_SPEEDS} speed of ${BonusTag._PT_SPEED_VALUE} feet`, "gi");
BonusTag._RE_SPEED_GAIN__EXPEND_CHARGE = new RegExp(`expend (?:a|\\d+) charges? to gain a ${BonusTag._PT_SPEEDS} speed of ${BonusTag._PT_SPEED_VALUE} feet`, "gi");
BonusTag._RE_SPEED_GIVE_YOU = new RegExp(`give you a ${BonusTag._PT_SPEEDS} speed of ${BonusTag._PT_SPEED_VALUE} feet`, "gi");
BonusTag._RE_SPEED_EQUAL_WALKING = new RegExp(`you (?:gain|have) a ${BonusTag._PT_SPEEDS} speed equal to your walking speed`, "gi");
BonusTag._RE_SPEED_BONUS_ALL = new RegExp(`you (?:gain|have) a bonus to speed of ${BonusTag._PT_SPEED_VALUE} feet`, "gi");
BonusTag._RE_SPEED_BONUS_SPECIFIC = new RegExp(`increas(?:ing|e) your ${BonusTag._PT_SPEEDS} by ${BonusTag._PT_SPEED_VALUE} feet`, "gi");

class BasicTextClean {
	static tryRun (it, opts) {
		const walker = MiscUtil.getWalker({keyBlacklist: new Set(["type"])});
		walker.walk(it, {
			array: (arr) => {
				return arr.filter(it => {
					if (typeof it !== "string") return true;

					if (/^\s*Proficiency with .*? allows you to add your proficiency bonus to the attack roll for any attack you make with it\.\s*$/i.test(it)) return false;
					if (/^\s*A shield is made from wood or metal and is carried in one hand\. Wielding a shield increases your Armor Class by 2. You can benefit from only one shield at a time\.\s*$/i.test(it)) return false;
					if (/^\s*This armor consists of a coat and leggings \(and perhaps a separate skirt\) of leather covered with overlapping pieces of metal, much like the scales of a fish\. The suit includes gauntlets\.\s*$/i.test(it)) return false;

					return true;
				});
			},
		});
	}
}

class ItemMiscTag {
	static tryRun (it, opts) {
		if (!(it.entries || (it.inherits && it.inherits.entries))) return;

		const isInherits = !it.entries && it.inherits.entries;
		const tgt = it.entries ? it : it.inherits;

		const strEntries = JSON.stringify(it.entries || it.inherits.entries);

		strEntries.replace(/"Sentience"/, (...m) => tgt.sentient = true);
		strEntries.replace(/"Curse"/, (...m) => tgt.curse = true);

		strEntries.replace(/you[^.]* (gain|have)? proficiency/gi, (...m) => tgt.grantsProficiency = true);
		strEntries.replace(/you gain[^.]* following proficiencies/gi, (...m) => tgt.grantsProficiency = true);
		strEntries.replace(/you are[^.]* considered proficient/gi, (...m) => tgt.grantsProficiency = true);
		strEntries.replace(/[Yy]ou can speak( and understand)? [A-Z]/g, (...m) => tgt.grantsProficiency = true);
	}
}

class ItemSpellcastingFocusTag {
	static tryRun (it, opts) {
		const focusClasses = new Set(it.focus || []);
		ItemSpellcastingFocusTag._RE_CLASS_NAMES = ItemSpellcastingFocusTag._RE_CLASS_NAMES || new RegExp(`(${Parser.ITEM_SPELLCASTING_FOCUS_CLASSES.join("|")})`, "gi");

		let isMiscFocus = false;
		if (it.entries || (it.inherits && it.inherits.entries)) {
			const tgt = it.entries ? it : it.inherits;

			const walker = MiscUtil.getWalker({keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST, isNoModification: true});
			walker.walk(
				tgt,
				{
					string: (str) => {
						str
							.replace(/spellcasting focus for your([^.?!:]*) spells/, (...m) => {
								if (!m[1].trim()) {
									isMiscFocus = true;
									return;
								}

								m[1].trim().replace(ItemSpellcastingFocusTag._RE_CLASS_NAMES, (...n) => {
									focusClasses.add(n[1].toTitleCase());
								});
							});
						return str;
					},
				},
			);
		}

		// The focus type may be implicitly specified by the attunement requirement
		if (isMiscFocus && it.reqAttune && typeof it.reqAttune === "string" && /^by a /i.test(it.reqAttune)) {
			const validClasses = new Set(Parser.ITEM_SPELLCASTING_FOCUS_CLASSES.map(it => it.toLowerCase()));
			it.reqAttune
				.replace(/^by a/i, "")
				.split(/, | or /gi)
				.map(it => it.trim().replace(/ or | a /gi, "").toLowerCase())
				.filter(Boolean)
				.filter(it => validClasses.has(it))
				.forEach(it => focusClasses.add(it.toTitleCase()));
		}

		if (focusClasses.size) it.focus = [...focusClasses].sort(SortUtil.ascSortLower);
	}
}
ItemSpellcastingFocusTag._RE_CLASS_NAMES = null;

class DamageResistanceTag {
	static tryRun (it, opts) {
		DamageResistanceImmunityVulnerabilityTag.tryRun(
			"resist",
			/you (?:have|gain|are) (?:resistance|resistant) (?:to|against) [^?.!]+/ig,
			it,
			opts,
		);
	}
}

class DamageImmunityTag {
	static tryRun (it, opts) {
		DamageResistanceImmunityVulnerabilityTag.tryRun(
			"immune",
			/you (?:have|gain|are) (?:immune|immunity) (?:to|against) [^?.!]+/ig,
			it,
			opts,
		);
	}
}

class DamageVulnerabilityTag {
	static tryRun (it, opts) {
		DamageResistanceImmunityVulnerabilityTag.tryRun(
			"vulnerable",
			/you (?:have|gain|are) (?:vulnerable|vulnerability) (?:to|against) [^?.!]+/ig,
			it,
			opts,
		);
	}
}

class DamageResistanceImmunityVulnerabilityTag {
	static _checkAndTag (prop, reOuter, obj, opts) {
		if (prop === "resist" && obj.hasRefs) return; // Assume these are already tagged

		const all = new Set();
		const outer = [];
		DamageResistanceImmunityVulnerabilityTag._WALKER.walk(
			obj.entries,
			{
				string: (str) => {
					str.replace(reOuter, (full, ..._) => {
						outer.push(full);
						full = full.split(/ except /gi)[0];
						full.replace(ConverterConst.RE_DAMAGE_TYPE, (full, dmgType) => {
							all.add(dmgType);
						});
					});
				},
			},
		);
		if (all.size) obj[prop] = [...all].sort(SortUtil.ascSortLower);
		else delete obj[prop];

		if (outer.length && !all.size) {
			if (opts.cbMan) opts.cbMan(`Could not find damage types in string(s) ${outer.map(it => `"${it}"`).join(", ")}`);
		}
	}

	static tryRun (prop, reOuter, it, opts) {
		DamageResistanceImmunityVulnerabilityTag._WALKER = DamageResistanceImmunityVulnerabilityTag._WALKER || MiscUtil.getWalker({keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST, isNoModification: true});

		if (it.entries) this._checkAndTag(prop, reOuter, it, opts);
		if (it.inherits && it.inherits.entries) this._checkAndTag(prop, reOuter, it.inherits, opts);
	}
}
DamageResistanceImmunityVulnerabilityTag._WALKER = null;

class ConditionImmunityTag {
	static _checkAndTag (obj) {
		const all = new Set();
		ConditionImmunityTag._WALKER.walk(
			obj.entries,
			{
				string: (str) => {
					str.replace(/you (?:have|gain|are) (?:[^.!?]+ )?immun(?:e|ity) to disease/gi, (...m) => {
						all.add("disease");
					});

					str.replace(/you (?:have|gain|are) (?:[^.!?]+ )?(?:immune) ([^.!?]+)/, (...m) => {
						m[1].replace(/{@condition ([^}]+)}/gi, (...n) => {
							all.add(n[1].toLowerCase());
						});
					});
				},
			},
		);
		if (all.size) obj.conditionImmune = [...all].sort(SortUtil.ascSortLower);
		else delete obj.conditionImmune;
	}

	static tryRun (it, opts) {
		ConditionImmunityTag._WALKER = ConditionImmunityTag._WALKER || MiscUtil.getWalker({keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST, isNoModification: true});

		if (it.entries) this._checkAndTag(it, opts);
		if (it.inherits && it.inherits.entries) this._checkAndTag(it.inherits, opts);
	}
}
ConditionImmunityTag._WALKER = null;

class ReqAttuneTagTag {
	static _checkAndTag (obj, opts, isAlt) {
		const prop = isAlt ? "reqAttuneAlt" : "reqAttune";

		if (typeof obj[prop] === "boolean" || obj[prop] === "optional") return;

		let req = obj[prop].replace(/^by/i, "");

		const tags = [];

		// "by a creature with the Mark of Finding"
		req = req.replace(/(?:a creature with the )?\bMark of ([A-Z][^ ]+)/g, (...m) => {
			const races = ReqAttuneTagTag._EBERRON_MARK_RACES[`Mark of ${m[1]}`];
			if (!races) return "";
			races.forEach(race => tags.push({race: race.toLowerCase()}));
			return "";
		});

		// "by a member of the Azorius guild"
		req = req.replace(/(?:a member of the )?\b(Azorius|Boros|Dimir|Golgari|Gruul|Izzet|Orzhov|Rakdos|Selesnya|Simic)\b guild/g, (...m) => {
			tags.push({background: ReqAttuneTagTag._RAVNICA_GUILD_BACKGROUNDS[m[1]].toLowerCase()});
			return "";
		});

		// "by a creature with an intelligence score of 3 or higher"
		req = req.replace(/(?:a creature with (?:an|a) )?\b(strength|dexterity|constitution|intelligence|wisdom|charisma)\b score of (\d+)(?: or higher)?/g, (...m) => {
			const abil = m[1].slice(0, 3).toLowerCase();
			tags.push({[abil]: Number(m[2])});
		});

		// "by a creature that can speak Infernal"
		req = req.replace(/(?:a creature that can )?speak \b(Abyssal|Aquan|Auran|Celestial|Common|Deep Speech|Draconic|Druidic|Dwarvish|Elvish|Giant|Gnomish|Goblin|Halfling|Ignan|Infernal|Orc|Primordial|Sylvan|Terran|Thieves' cant|Undercommon)\b/g, (...m) => {
			tags.push({languageProficiency: m[1].toLowerCase()});
			return "";
		});

		// "by a creature that has proficiency in the Arcana skill"
		req = req.replace(/(?:a creature that has )?(?:proficiency|proficient).*?\b(Acrobatics|Animal Handling|Arcana|Athletics|Deception|History|Insight|Intimidation|Investigation|Medicine|Nature|Perception|Performance|Persuasion|Religion|Sleight of Hand|Stealth|Survival)\b skill/g, (...m) => {
			tags.push({skillProficiency: m[1].toLowerCase()});
			return "";
		});

		// "by a dwarf"
		req = req.replace(/(?:(?:a|an) )?\b(Dragonborn|Dwarf|Elf|Gnome|Half-Elf|Half-Orc|Halfling|Human|Tiefling|Warforged)\b/gi, (...m) => {
			const source = m[1].toLowerCase() === "warforged" ? SRC_ERLW : "";
			tags.push({race: `${m[1]}${source ? `|${source}` : ""}`.toLowerCase()});
			return "";
		});

		// "by a humanoid", "by a small humanoid"
		req = req.replace(/a (?:\b(tiny|small|medium|large|huge|gargantuan)\b )?\b(aberration|beast|celestial|construct|dragon|elemental|fey|fiend|giant|humanoid|monstrosity|ooze|plant|undead)\b/gi, (...m) => {
			const size = m[1] ? m[1][0].toUpperCase() : null;
			const out = {creatureType: m[2].toLowerCase()};
			if (size) out.size = size;
			tags.push(out);
			return "";
		});

		// "by a spellcaster"
		req = req.replace(/(?:a )?\bspellcaster\b/gi, (...m) => {
			tags.push({spellcasting: true});
			return "";
		});

		// "by a creature that has psionic ability"
		req = req.replace(/(?:a creature that has )?\bpsionic ability/gi, (...m) => {
			tags.push({psionics: true});
			return "";
		});

		// "by a bard, cleric, druid, sorcerer, warlock, or wizard"
		req = req.replace(/(?:(?:a|an) )?\b(artificer|bard|cleric|druid|paladin|ranger|sorcerer|warlock|wizard|barbarian|fighter|monk|rogue)\b/gi, (...m) => {
			const source = m[1].toLowerCase() === "artificer" ? SRC_TCE : null;
			tags.push({class: `${m[1]}${source ? `|${source}` : ""}`.toLowerCase()});
			return "";
		});

		// region Alignment
		// "by a creature of evil alignment"
		// "by a dwarf, fighter, or paladin of good alignment"
		// "by an elf or half-elf of neutral good alignment"
		// "by an evil cleric or paladin"
		const alignmentParts = req.split(/,| or /gi)
			.map(it => it.trim())
			.filter(it => it && it !== "," && it !== "or");

		alignmentParts.forEach(part => {
			Object.values(AlignmentUtil.ALIGNMENTS)
				.forEach(it => {
					if (it.regexWeak.test(part)) {
						// We assume the alignment modifies all previous entries
						if (tags.length) tags.forEach(by => by.alignment = [...it.output]);
						else tags.push({alignment: [...it.output]});
					}
				});
		});
		// endregion

		const propOut = isAlt ? "reqAttuneAltTags" : "reqAttuneTags";
		if (tags.length) obj[propOut] = tags;
		else delete obj[propOut];
	}

	static tryRun (it, opts) {
		if (it.reqAttune) this._checkAndTag(it, opts);
		if (it.inherits?.reqAttune) this._checkAndTag(it.inherits, opts);

		if (it.reqAttuneAlt) this._checkAndTag(it, opts, true);
		if (it.inherits?.reqAttuneAlt) this._checkAndTag(it.inherits, opts, true);
	}
}
ReqAttuneTagTag._RAVNICA_GUILD_BACKGROUNDS = {
	"Azorius": "Azorius Functionary|GGR",
	"Boros": "Boros Legionnaire|GGR",
	"Dimir": "Dimir Operative|GGR",
	"Golgari": "Golgari Agent|GGR",
	"Gruul": "Gruul Anarch|GGR",
	"Izzet": "Izzet Engineer|GGR",
	"Orzhov": "Orzhov Representative|GGR",
	"Rakdos": "Rakdos Cultist|GGR",
	"Selesnya": "Selesnya Initiate|GGR",
	"Simic": "Simic Scientist|GGR",
};
ReqAttuneTagTag._EBERRON_MARK_RACES = {
	"Mark of Warding": ["Dwarf (Mark of Warding)|ERLW"],
	"Mark of Shadow": ["Elf (Mark of Shadow)|ERLW"],
	"Mark of Scribing": ["Gnome (Mark of Scribing)|ERLW"],
	"Mark of Detection": ["Half-Elf (Variant; Mark of Detection)|ERLW"],
	"Mark of Storm": ["Half-Elf (Variant; Mark of Storm)|ERLW"],
	"Mark of Finding": [
		"Half-Orc (Mark of Finding)|ERLW",
		"Human (Mark of Finding)|ERLW",
	],
	"Mark of Healing": ["Halfling (Mark of Healing)|ERLW"],
	"Mark of Hospitality": ["Halfling (Mark of Hospitality)|ERLW"],
	"Mark of Handling": ["Human (Mark of Handling)|ERLW"],
	"Mark of Making": ["Human (Mark of Making)|ERLW"],
	"Mark of Passage": ["Human (Mark of Passage)|ERLW"],
	"Mark of Sentinel": ["Human (Mark of Sentinel)|ERLW"],
};

if (typeof module !== "undefined") {
	module.exports = {
		ConverterUtilsItem,
		ChargeTag,
		RechargeTypeTag,
		AttachedSpellTag,
		BonusTag,
		BasicTextClean,
		ItemMiscTag,
		ItemSpellcastingFocusTag,
		DamageResistanceTag,
		DamageImmunityTag,
		DamageVulnerabilityTag,
		ConditionImmunityTag,
		ReqAttuneTagTag,
	};
}
