"use strict";

class AcConvert {
	static tryPostProcessAc (mon, cbMan, cbErr) {
		if (this._tryPostProcessAc_special(mon, cbMan, cbErr)) return;

		const nuAc = [];

		const parts = mon.ac.trim().split(StrUtil.COMMAS_NOT_IN_PARENTHESES_REGEX).map(it => it.trim()).filter(Boolean);
		parts.forEach(pt => {
			// Use two expressions to ensure parentheses are paired
			const mAc = /^(\d+)(?: \((.*?)\))?$/.exec(pt) || /^(\d+)(?: (.*?))?$/.exec(pt);

			if (!mAc) {
				if (cbErr) cbErr(pt, `${`${mon.name} ${mon.source} p${mon.page}`.padEnd(48)} => ${pt}`);
				nuAc.push(pt);
				return;
			}

			const [_, acRaw, fromRaw] = mAc;

			const acNum = Number(acRaw);

			// Plain number
			if (!fromRaw) return nuAc.push(acNum);

			const nuAcTail = [];
			const cur = {ac: acNum};
			const froms = [];

			// region Handle "in ... form" parts
			let fromClean = fromRaw
				// FIXME(Future) Find an example of a creature with this AC form to check accuracy of this parse
				.replace(/ \(in .*? form\)$/i, (...m) => {
					if (cur.condition) throw new Error(`Multiple AC conditions! "${cur.condition}" and "${m[0]}"`);
					cur.condition = m[0].trim().toLowerCase();
					return "";
				})
				.trim()
				.replace(/ in .*? form$/i, (...m) => {
					if (cur.condition) throw new Error(`Multiple AC conditions! "${cur.condition}" and "${m[0]}"`);
					cur.condition = m[0].trim().toLowerCase();
					return "";
				})
				.trim();
			// endregion

			// region Handle "while ..." parts
			fromClean = fromClean
				.replace(/^while .*$/, (...m) => {
					if (cur.condition) throw new Error(`Multiple AC conditions! "${cur.condition}" and "${m[0]}"`);
					cur.condition = m[0].trim().toLowerCase();
					return "";
				});
			// endregion

			fromClean
				.toLowerCase()
				.replace(/^\(|\)$/g, "")
				.split(",")
				.map(it => it.trim())
				.filter(Boolean)
				.forEach(fromLow => {
					switch (fromLow) {
						// literally nothing
						case "unarmored": break;

						// everything else
						default: {
							const simpleFrom = this._getSimpleFrom(fromLow);
							if (simpleFrom) return froms.push(simpleFrom);

							// Special parsing for barding, as the pre-barding armor type might not exactly match our known
							//   barding names (e.g. "chainmail barding")
							const mWithBarding = /^(?<ac>\d+) with (?<name>(?<type>.*?) barding)$/.exec(fromLow);
							if (mWithBarding) {
								let simpleFromBarding = this._getSimpleFrom(mWithBarding.groups.type);
								if (simpleFromBarding) {
									simpleFromBarding = simpleFromBarding
										.replace(/{@item ([^}]+)}/, (...m) => {
											let [name, source, displayName] = m[1].split("|");
											name = `${name.replace(/ armor$/i, "")} barding`;

											if (mWithBarding.groups.name === name) return `{@item ${name}${source ? `|${source}` : ""}}`;
											return `{@item ${name}${source ? `|${source}` : "|"}|${mWithBarding.groups.name}}`;
										});

									nuAcTail.push({
										ac: Number(mWithBarding.groups.ac),
										condition: `with ${simpleFromBarding}`,
										braces: true,
									});

									return;
								}
							}

							if (fromLow.endsWith("with mage armor") || fromLow.endsWith("with barkskin")) {
								const numMatch = /(\d+) with (.*)/.exec(fromLow);
								if (!numMatch) throw new Error("Spell AC but no leading number?");

								let spell = null;
								if (numMatch[2] === "mage armor") spell = `{@spell mage armor}`;
								else if (numMatch[2] === "barkskin") spell = `{@spell barkskin}`;
								else throw new Error(`Unhandled spell! ${numMatch[2]}`);

								nuAcTail.push({
									ac: Number(numMatch[1]),
									condition: `with ${spell}`,
									braces: true,
								});

								return;
							}

							if (/^in .*? form$/i.test(fromLow)) {
								// If there's an existing condition, flag a warning
								if (cur.condition && cbMan) cbMan(fromLow, `AC requires manual checking: ${mon.name} ${mon.source} p${mon.page}`);
								cur.condition = `${cur.condition ? `${cur.condition} ` : ""}${fromLow}`;

								return;
							}

							if (cbMan) cbMan(fromLow, `AC requires manual checking: ${mon.name} ${mon.source} p${mon.page}`);
							froms.push(fromLow);
						}
					}
				});

			if (froms.length || cur.condition) {
				if (froms.length) {
					cur.from = froms
						// Ensure "Unarmored Defense" is always properly capitalized
						.map(it => it.toLowerCase() === "unarmored defense" ? "Unarmored Defense" : it);
				}
				nuAc.push(cur);
			} else {
				nuAc.push(cur.ac);
			}

			if (nuAcTail.length) nuAc.push(...nuAcTail);
		});

		mon.ac = nuAc;
	}

	static _tryPostProcessAc_special (mon, cbMan, cbErr) {
		mon.ac = mon.ac.trim();

		const mPlusSpecial = /^(\d+) (plus|\+) (?:PB|the level of the spell|your [^ ]+ modifier)(?: \([^)]+\))?$/i.exec(mon.ac);
		if (mPlusSpecial) {
			mon.ac = [{special: mon.ac}];
			return true;
		}

		return false;
	}

	static _getSimpleFrom (fromLow) {
		switch (fromLow) {
			// region unhandled/other
			case "unarmored defense":
			case "suave defense":
			case "armor scraps":
			case "barding scraps":
			case "patchwork armor":
			case "see natural armor feature":
			case "barkskin trait":
			case "sylvan warrior":
			case "cage":
			case "chains":
			case "coin mail":
			case "crude armored coat":
			case "improvised armor":
			case "magic robes":
			case "makeshift armor":
			case "natural and mystic armor":
			case "padded armor":
			case "padded leather":
			case "parrying dagger":
			case "plant fiber armor":
			case "plus armor worn":
			case "rag armor":
			case "ring of protection +2":
			case "see below":
			case "wicker armor":
			case "bone armor":
			case "deflection":
			case "mental defense":
			case "blood aegis":
			case "psychic defense":
			case "glory": // BAM :: Reigar
			case "mountain tattoo": // KftGV :: Prisoner 13
			case "disarming charm": // TG :: Forge Fitzwilliam
				return fromLow;
				// endregion

			case "graz'zt's gift": // KftGV :: Sythian Skalderang
				return fromLow.uppercaseFirst();

			// region au naturel
			case "natural armor":
			case "natural armour":
			case "natural":
				return "natural armor";
				// endregion

			// region spells
			case "foresight bonus": return `{@spell foresight} bonus`;
			case "natural barkskin": return `natural {@spell barkskin}`;
			case "mage armor": return "{@spell mage armor}";
			case "intellect fortress": return "{@spell intellect fortress|tce}";
			// endregion

			// region armor (mostly handled by the item lookup; these are mis-named exceptions (usually for homebrew))
			case "chainmail":
			case "chain armor":
				return "{@item chain mail|phb}";

			case "plate mail":
			case "platemail":
			case "full plate":
				return "{@item plate armor|phb}";

			case "half-plate": return "{@item half plate armor|phb}";

			case "scale armor": return "{@item scale mail|phb}";
			case "splint armor": return "{@item splint mail|phb}";
			case "chain shirt": return "{@item chain shirt|phb}";
			case "shields": return "{@item shield|phb|shields}";

			case "spiked shield": return "{@item shield|phb|spiked shield}";
			// endregion

			// region magic items
			case "dwarven plate": return "{@item dwarven plate}";
			case "elven chain": return "{@item elven chain}";
			case "glamoured studded leather": return "{@item glamoured studded leather}";
			case "bracers of defense": return "{@item bracers of defense}";
			case "badge of the watch": return "{@item Badge of the Watch|wdh}";
			case "cloak of protection": return "{@item cloak of protection}";
			case "ring of protection": return "{@item ring of protection}";
			case "robe of the archmagi": return "{@item robe of the archmagi}";
			case "robe of the archmage": return "{@item robe of the archmagi}";
			case "staff of power": return "{@item staff of power}";
			// endregion

			default: {
				if (AcConvert._ITEM_LOOKUP[fromLow]) {
					const itemMeta = AcConvert._ITEM_LOOKUP[fromLow];

					if (itemMeta.isExact) return `{@item ${fromLow}${itemMeta.source === Parser.SRC_DMG ? "" : `|${itemMeta.source}`}}`;
					return `{@item ${itemMeta.name}${itemMeta.source === Parser.SRC_DMG ? "|" : `|${itemMeta.source}`}|${fromLow}}`;
				}

				if (/scraps of .*?armor/i.test(fromLow)) { // e.g. "scraps of hide armor"
					return fromLow;
				}
			}
		}
	}

	static init (items) {
		const handlePlusName = (item, lowName) => {
			const mBonus = /^(.+) (\+\d+)$/.exec(lowName);
			if (mBonus) {
				const plusFirstName = `${mBonus[2]} ${mBonus[1]}`;
				AcConvert._ITEM_LOOKUP[plusFirstName] = {source: item.source, name: lowName};
			}
		};

		AcConvert._ITEM_LOOKUP = {};
		items
			.filter(it => it.type === "HA" || it.type === "MA" || it.type === "LA" || it.type === "S")
			.forEach(it => {
				const lowName = it.name.toLowerCase();
				AcConvert._ITEM_LOOKUP[lowName] = {source: it.source, isExact: true};

				const noArmorName = lowName.replace(/(^|\s)(?:armor|mail)(\s|$)/g, "$1$2").trim().replace(/\s+/g, " ");
				if (noArmorName !== lowName) {
					AcConvert._ITEM_LOOKUP[noArmorName] = {source: it.source, name: lowName};
				}

				handlePlusName(it, lowName);
				handlePlusName(it, noArmorName);
			});
	}
}
AcConvert._ITEM_LOOKUP = null;

globalThis.AcConvert = AcConvert;

class TagAttack {
	static tryTagAttacks (m, cbMan) {
		TagAttack._PROPS.forEach(prop => this._handleProp({m, prop, cbMan}));
	}

	static _handleProp ({m, prop, cbMan}) {
		if (!m[prop]) return;

		m[prop]
			.forEach(it => {
				if (!it.entries) return;

				const str = JSON.stringify(it.entries, null, "\t");
				const out = str.replace(/([\t ]")((?:(?:[A-Z][a-z]*|or) )*Attack:) /g, (...m) => {
					const lower = m[2].toLowerCase();
					if (TagAttack.MAP[lower]) {
						return `${m[1]}${TagAttack.MAP[lower]} `;
					} else {
						if (cbMan) cbMan(m[2]);
						return m[0];
					}
				});
				it.entries = JSON.parse(out);
			});
	}
}
TagAttack._PROPS = ["action", "reaction", "bonus", "trait", "legendary", "mythic", "variant"];
TagAttack.MAP = {
	"melee weapon attack:": "{@atk mw}",
	"ranged weapon attack:": "{@atk rw}",
	"melee attack:": "{@atk m}",
	"ranged attack:": "{@atk r}",
	"area attack:": "{@atk a}",
	"area weapon attack:": "{@atk aw}",
	"melee spell attack:": "{@atk ms}",
	"melee or ranged weapon attack:": "{@atk mw,rw}",
	"ranged spell attack:": "{@atk rs}",
	"melee or ranged spell attack:": "{@atk ms,rs}",
	"melee or ranged attack:": "{@atk m,r}",
};

globalThis.TagAttack = TagAttack;

class TagHit {
	static tryTagHits (m) {
		TagHit._PROPS.forEach(prop => this._handleProp({m, prop}));
	}

	static _handleProp ({m, prop}) {
		if (!m[prop]) return;

		m[prop]
			.forEach(it => {
				if (!it.entries) return;

				const str = JSON.stringify(it.entries, null, "\t");
				const out = str.replace(/Hit: /g, "{@h}");
				it.entries = JSON.parse(out);
			});
	}
}
TagHit._PROPS = ["action", "reaction", "bonus", "trait", "legendary", "mythic", "variant"];

globalThis.TagHit = TagHit;

class TagDc {
	static tryTagDcs (m) {
		TagDc._PROPS.forEach(prop => this._handleProp({m, prop}));
	}

	static _handleProp ({m, prop}) {
		if (!m[prop]) return;

		m[prop] = m[prop]
			.map(it => {
				const str = JSON.stringify(it, null, "\t");
				const out = str.replace(/DC (\d+)(\s+plus PB|\s*\+\s*PB)?/g, "{@dc $1$2}");
				return JSON.parse(out);
			});
	}
}
TagDc._PROPS = ["action", "reaction", "bonus", "trait", "legendary", "mythic", "variant", "spellcasting"];

globalThis.TagDc = TagDc;

class AlignmentConvert {
	static tryConvertAlignment (stats, cbMan) {
		const {alignmentPrefix, alignment} = AlignmentUtil.tryGetConvertedAlignment(stats.alignment, {cbMan});

		stats.alignment = alignment;
		if (!stats.alignment) delete stats.alignment;

		stats.alignmentPrefix = alignmentPrefix;
		if (!stats.alignmentPrefix) delete stats.alignmentPrefix;
	}
}

globalThis.AlignmentConvert = AlignmentConvert;

class TraitActionTag {
	static _doTag ({m, cbMan, prop, outProp}) {
		if (!m[prop]) return;

		m[prop]
			.forEach(t => {
				if (!t.name) return;
				t.name = t.name.trim();

				const cleanName = Renderer.stripTags(t.name)
					.toLowerCase()
					.replace(/\([^)]+\)/g, "") // Remove parentheses
					.trim();

				const mapped = TraitActionTag.tags[prop][cleanName];
				if (mapped) {
					if (mapped === true) return m[outProp].add(t.name);
					return m[outProp].add(mapped);
				}

				if (this._isTraits(prop)) {
					if (cleanName.startsWith("keen ")) return m[outProp].add("Keen Senses");
					if (cleanName.endsWith(" absorption")) return m[outProp].add("Damage Absorption");
				}

				if (this._isActions(prop)) {
					if (/\bbreath\b/.test(cleanName)) return m[outProp].add("Breath Weapon");
				}

				if (cbMan) cbMan(prop, outProp, cleanName);
			});
	}

	static _doTagDeep ({m, prop, outProp}) {
		if (!TraitActionTag.tagsDeep[prop]) return;
		if (!m[prop]) return;

		m[prop].forEach(t => {
			if (!t.entries) return;
			const strEntries = JSON.stringify(t.entries);

			Object.entries(TraitActionTag.tagsDeep[prop])
				.forEach(([tagName, fnShouldTag]) => {
					if (fnShouldTag(strEntries)) m[outProp].add(tagName);
				});
		});
	}

	static _isTraits (prop) { return prop === "trait"; }
	static _isActions (prop) { return prop === "action"; }

	static tryRun (m, cbMan) {
		m.traitTags = new Set(m.traitTags || []);
		m.actionTags = new Set(m.actionTags || []);

		this._doTag({m, cbMan, prop: "trait", outProp: "traitTags"});
		this._doTag({m, cbMan, prop: "action", outProp: "actionTags"});
		this._doTag({m, cbMan, prop: "reaction", outProp: "actionTags"});
		this._doTag({m, cbMan, prop: "bonus", outProp: "actionTags"});

		this._doTagDeep({m, prop: "action", outProp: "actionTags"});

		if (!m.traitTags.size) delete m.traitTags;
		else m.traitTags = [...m.traitTags].sort(SortUtil.ascSortLower);

		if (!m.actionTags.size) delete m.actionTags;
		else m.actionTags = [...m.actionTags].sort(SortUtil.ascSortLower);
	}
}
TraitActionTag.tags = { // true = map directly; string = map to this string
	trait: {
		"turn immunity": "Turn Immunity",
		"brute": "Brute",
		"antimagic susceptibility": "Antimagic Susceptibility",
		"sneak attack": "Sneak Attack",
		"reckless": "Reckless",
		"web sense": "Web Sense",
		"flyby": "Flyby",
		"pounce": "Pounce",
		"water breathing": "Water Breathing",

		"turn resistance": "Turn Resistance",
		"turn defiance": "Turn Resistance",
		"turning defiance": "Turn Resistance",
		"turn resistance aura": "Turn Resistance",
		"undead fortitude": "Undead Fortitude",

		"aggressive": "Aggressive",
		"illumination": "Illumination",
		"rampage": "Rampage",
		"rejuvenation": "Rejuvenation",
		"web walker": "Web Walker",
		"incorporeal movement": "Incorporeal Movement",
		"incorporeal passage": "Incorporeal Movement",

		"keen hearing and smell": "Keen Senses",
		"keen sight and smell": "Keen Senses",
		"keen hearing and sight": "Keen Senses",
		"keen hearing": "Keen Senses",
		"keen smell": "Keen Senses",
		"keen senses": "Keen Senses",

		"hold breath": "Hold Breath",

		"charge": "Charge",

		"fey ancestry": "Fey Ancestry",

		"siege monster": "Siege Monster",

		"pack tactics": "Pack Tactics",

		"regeneration": "Regeneration",

		"shapechanger": "Shapechanger",

		"false appearance": "False Appearance",

		"spider climb": "Spider Climb",

		"sunlight sensitivity": "Sunlight Sensitivity",
		"sunlight hypersensitivity": "Sunlight Sensitivity",
		"light sensitivity": "Light Sensitivity",
		"vampire weaknesses": "Sunlight Sensitivity",

		"amphibious": "Amphibious",

		"legendary resistance": "Legendary Resistances",

		"magic weapon": "Magic Weapons",
		"magic weapons": "Magic Weapons",

		"magic resistance": "Magic Resistance",

		"spell immunity": "Spell Immunity",

		"ambush": "Ambusher",
		"ambusher": "Ambusher",

		"amorphous": "Amorphous",
		"amorphous form": "Amorphous",

		"death burst": "Death Burst",
		"death throes": "Death Burst",

		"devil's sight": "Devil's Sight",
		"devil sight": "Devil's Sight",

		"immutable form": "Immutable Form",

		"tree stride": "Tree Stride",

		"unusual nature": "Unusual Nature",

		"tunneler": "Tunneler",
	},
	action: {
		"multiattack": "Multiattack",
		"frightful presence": "Frightful Presence",
		"teleport": "Teleport",
		"swallow": "Swallow",
		"tentacle": "Tentacles",
		"tentacles": "Tentacles",
		"change shape": "Shapechanger",
	},
	reaction: {
		"parry": "Parry",
	},
	bonus: {
		"change shape": "Shapechanger",
	},
	legendary: {
		// unused
	},
	mythic: {
		// unused
	},
};
TraitActionTag.tagsDeep = {
	action: {
		"Swallow": strEntries => /\bswallowed\b/i.test(strEntries),
	},
};

globalThis.TraitActionTag = TraitActionTag;

class LanguageTag {
	/**
	 * @param m A creature statblock.
	 * @param [opt] Options object.
	 * @param [opt.cbAll] Callback to run on every parsed language.
	 * @param [opt.cbTracked] Callback to run on every tracked language.
	 * @param [opt.isAppendOnly] If tags should only be added, not removed.
	 */
	static tryRun (m, opt) {
		opt = opt || {};

		const tags = new Set();

		if (m.languages) {
			m.languages = m.languages.map(it => it.trim()).filter(it => !TagUtil.isNoneOrEmpty(it));
			if (!m.languages.length) {
				delete m.languages;
				return;
			} else {
				m.languages = m.languages.map(it => it.replace(/but can(not|'t) speak/ig, "but can't speak"));
			}

			m.languages.forEach(l => {
				if (opt.cbAll) opt.cbAll(l);

				Object.keys(LanguageTag.LANGUAGE_MAP).forEach(k => {
					const v = LanguageTag.LANGUAGE_MAP[k];

					const re = new RegExp(`(^|[^-a-zA-Z])${k}([^-a-zA-Z]|$)`, "g");

					if (re.exec(l)) {
						if ((v === "XX" || v === "X") && (l.includes("knew in life") || l.includes("spoke in life"))) return;
						if (v !== "CS" && /(one|the) languages? of its creator/i.exec(l)) return;

						if (opt.cbTracked) opt.cbTracked(v);
						tags.add(v);
					}
				});
			});
		}

		if (tags.size) {
			if (!opt.isAppendOnly) m.languageTags = [...tags];
			else {
				(m.languageTags || []).forEach(t => tags.add(t));
				m.languageTags = [...tags];
			}
		} else if (!opt.isAppendOnly) delete m.languageTags;
	}
}
LanguageTag.LANGUAGE_MAP = {
	"Abyssal": "AB",
	"Aquan": "AQ",
	"Auran": "AU",
	"Celestial": "CE",
	"Common": "C",
	"can't speak": "CS",
	"Draconic": "DR",
	"Dwarvish": "D",
	"Elvish": "E",
	"Giant": "GI",
	"Gnomish": "G",
	"Goblin": "GO",
	"Halfling": "H",
	"Infernal": "I",
	"Orc": "O",
	"Primordial": "P",
	"Sylvan": "S",
	"Terran": "T",
	"Undercommon": "U",
	"Aarakocra": "OTH",
	"one additional": "X",
	"Blink Dog": "OTH",
	"Bothii": "OTH",
	"Bullywug": "OTH",
	"one other language": "X",
	"plus six more": "X",
	"plus two more languages": "X",
	"up to five other languages": "X",
	"Druidic": "DU",
	"Giant Eagle": "OTH",
	"Giant Elk": "OTH",
	"Giant Owl": "OTH",
	"Gith": "GTH",
	"Grell": "OTH",
	"Grung": "OTH",
	"Homarid": "OTH",
	"Hook Horror": "OTH",
	"Ice Toad": "OTH",
	"Ixitxachitl": "OTH",
	"Kruthik": "OTH",
	"Netherese": "OTH",
	"Olman": "OTH",
	"Otyugh": "OTH",
	"Primal": "OTH",
	"Sahuagin": "OTH",
	"Sphinx": "OTH",
	"Thayan": "OTH",
	"Thri-kreen": "OTH",
	"Tlincalli": "OTH",
	"Troglodyte": "OTH",
	"Umber Hulk": "OTH",
	"Vegepygmy": "OTH",
	"Winter Wolf": "OTH",
	"Worg": "OTH",
	"Yeti": "OTH",
	"Yikaria": "OTH",
	"all": "XX",
	"all but rarely speaks": "XX",
	"any one language": "X",
	"any two languages": "X",
	"any three languages": "X",
	"any four languages": "X",
	"any five languages": "X",
	"any six languages": "X",
	"one language of its creator's choice": "X",
	"two other languages": "X",
	"telepathy": "TP",
	"thieves' cant": "TC",
	"Thieves' cant": "TC",
	"Deep Speech": "DS",
	"Gnoll": "OTH",
	"Ignan": "IG",
	"Modron": "OTH",
	"Slaad": "OTH",
	"all languages": "XX",
	"any language": "X",
	"knew in life": "LF",
	"spoke in life": "LF",
};

globalThis.LanguageTag = LanguageTag;

class SenseFilterTag {
	static tryRun (m, cbAll) {
		if (m.senses) {
			m.senses = m.senses.filter(it => !TagUtil.isNoneOrEmpty(it));
			if (!m.senses.length) delete m.senses;
			else {
				const senseTags = new Set();
				m.senses.map(it => it.trim().toLowerCase())
					.forEach(s => {
						Object.entries(SenseFilterTag.TAGS).forEach(([k, v]) => {
							if (s.includes(k)) {
								if (v === "D" && /\d\d\d ft/.exec(s)) senseTags.add("SD");
								else senseTags.add(v);
							}
						});

						if (cbAll) cbAll(s);
					});

				if (senseTags.size === 0) delete m.senseTags;
				else m.senseTags = [...senseTags];
			}
		} else delete m.senseTags;
	}
}
SenseFilterTag.TAGS = {
	"blindsight": "B",
	"darkvision": "D",
	"tremorsense": "T",
	"truesight": "U",
};

globalThis.SenseFilterTag = SenseFilterTag;

class SpellcastingTypeTag {
	static tryRun (m, cbAll) {
		if (!m.spellcasting) {
			delete m.spellcastingTags;
		} else {
			const tags = new Set();
			m.spellcasting.forEach(sc => {
				if (!sc.name) return;

				let isAdded = false;

				if (/(^|[^a-zA-Z])psionics([^a-zA-Z]|$)/gi.exec(sc.name)) { tags.add("P"); isAdded = true; }
				if (/(^|[^a-zA-Z])innate([^a-zA-Z]|$)/gi.exec(sc.name)) { tags.add("I"); isAdded = true; }
				if (/(^|[^a-zA-Z])form([^a-zA-Z]|$)/gi.exec(sc.name)) { tags.add("F"); isAdded = true; }
				if (/(^|[^a-zA-Z])shared([^a-zA-Z]|$)/gi.exec(sc.name)) { tags.add("S"); isAdded = true; }

				if (sc.headerEntries) {
					const strHeader = JSON.stringify(sc.headerEntries);
					Object.entries(SpellcastingTypeTag.CLASSES).forEach(([tag, regex]) => {
						regex.lastIndex = 0;
						const match = regex.exec(strHeader);
						if (match) {
							tags.add(tag);
							isAdded = true;
							if (cbAll) cbAll(match[0]);
						}
					});
				}

				if (!isAdded) tags.add("O");

				if (cbAll) cbAll(sc.name);
			});
			if (tags.size) m.spellcastingTags = [...tags];
			else delete m.spellcastingTags;
		}
	}
}
SpellcastingTypeTag.CLASSES = {
	"CA": /(^|[^a-zA-Z])artificer([^a-zA-Z]|$)/gi,
	"CB": /(^|[^a-zA-Z])bard([^a-zA-Z]|$)/gi,
	"CC": /(^|[^a-zA-Z])cleric([^a-zA-Z]|$)/gi,
	"CD": /(^|[^a-zA-Z])druid([^a-zA-Z]|$)/gi,
	"CP": /(^|[^a-zA-Z])paladin([^a-zA-Z]|$)/gi,
	"CR": /(^|[^a-zA-Z])ranger([^a-zA-Z]|$)/gi,
	"CS": /(^|[^a-zA-Z])sorcerer([^a-zA-Z]|$)/gi,
	"CL": /(^|[^a-zA-Z])warlock([^a-zA-Z]|$)/gi,
	"CW": /(^|[^a-zA-Z])wizard([^a-zA-Z]|$)/gi,
};

globalThis.SpellcastingTypeTag = SpellcastingTypeTag;

class DamageTypeTag {
	static _init () {
		if (DamageTypeTag._isInit) return;

		DamageTypeTag._isInit = true;
		DamageTypeTag._WALKER = MiscUtil.getWalker({isNoModification: true, keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST});
		Object.entries(Parser.DMGTYPE_JSON_TO_FULL).forEach(([k, v]) => DamageTypeTag._TYPE_LOOKUP[v] = k);
	}

	static _PROPS_PRIMARY = ["action", "reaction", "bonus", "trait", "legendary", "mythic", "variant"];
	static tryRun (m) {
		this._init();

		const typeSet = new Set();
		this._PROPS_PRIMARY.forEach(prop => DamageTypeTag._handleProp({m, prop, typeSet}));
		if (typeSet.size) m.damageTags = [...typeSet].sort(SortUtil.ascSortLower);
	}

	static tryRunSpells (m, {cbMan} = {}) {
		if (!m.spellcasting) return;

		this._init();

		const typeSet = new Set();

		const spells = TaggerUtils.getSpellsFromString(JSON.stringify(m.spellcasting), {cbMan});
		spells.forEach(spell => {
			if (!spell.damageInflict) return;
			spell.damageInflict.forEach(it => typeSet.add(DamageTypeTag._TYPE_LOOKUP[it]));
		});

		if (typeSet.size) m.damageTagsSpell = [...typeSet].sort(SortUtil.ascSortLower);
	}

	static tryRunRegionalsLairs (m, {cbMan} = {}) {
		if (!m.legendaryGroup) return;

		this._init();

		const meta = TaggerUtils.findLegendaryGroup({name: m.legendaryGroup.name, source: m.legendaryGroup.source});
		if (!meta) return;

		const typeSet = new Set();
		this._handleEntries({entries: meta, typeSet});

		// region Also add damage types from spells contained in the legendary group
		const spells = TaggerUtils.getSpellsFromString(JSON.stringify(meta), {cbMan});
		spells.forEach(spell => {
			if (!spell.damageInflict) return;
			spell.damageInflict.forEach(it => typeSet.add(DamageTypeTag._TYPE_LOOKUP[it]));
		});
		// endregion

		if (typeSet.size) m.damageTagsLegendary = [...typeSet].sort(SortUtil.ascSortLower);
	}

	static _handleProp ({m, prop, typeSet}) {
		if (!m[prop]) return;

		m[prop].forEach(it => {
			if (
				it.name
				&& DamageTypeTag._BLOCKLIST_NAMES.has(it.name.toLowerCase().trim().replace(/\([^)]+\)/g, ""))
			) return;

			if (!it.entries) return;

			this._handleEntries({m, entries: it.entries, typeSet});
		});
	}

	static _handleEntries ({m = null, entries, typeSet}) {
		DamageTypeTag._WALKER.walk(
			entries,
			{
				string: (str) => {
					str.replace(RollerUtil.REGEX_DAMAGE_DICE, (m0, average, prefix, diceExp, suffix) => {
						suffix.replace(ConverterConst.RE_DAMAGE_TYPE, (m0, type) => typeSet.add(DamageTypeTag._TYPE_LOOKUP[type]));
					});

					str.replace(DamageTypeTag._STATIC_DAMAGE_REGEX, (m0, type) => {
						typeSet.add(DamageTypeTag._TYPE_LOOKUP[type]);
					});

					str.replace(DamageTypeTag._TARGET_TASKES_DAMAGE_REGEX, (m0, type) => {
						typeSet.add(DamageTypeTag._TYPE_LOOKUP[type]);
					});

					if (DamageTypeTag._isSummon(m)) {
						str.split(/[.?!]/g)
							.forEach(sentence => {
								let isSentenceMatch = DamageTypeTag._SUMMON_DAMAGE_REGEX.test(sentence);
								if (!isSentenceMatch) return;

								sentence.replace(ConverterConst.RE_DAMAGE_TYPE, (m0, type) => {
									typeSet.add(DamageTypeTag._TYPE_LOOKUP[type]);
								});
							});
					}
				},
			},
		);
	}

	/** Attempt to detect an e.g. TCE summon creature. */
	static _isSummon (m) {
		if (!m) return false;

		let isSummon = false;

		const reProbableSummon = /level of the spell|spell level|\+\s*PB(?:\W|$)|your (?:[^?!.]+)?level/g;

		DamageTypeTag._WALKER.walk(
			m.ac,
			{
				string: (str) => {
					if (isSummon) return;
					if (reProbableSummon.test(str)) isSummon = true;
				},
			},
		);
		if (isSummon) return true;

		DamageTypeTag._WALKER.walk(
			m.hp,
			{
				string: (str) => {
					if (isSummon) return;
					if (reProbableSummon.test(str)) isSummon = true;
				},
			},
		);
		if (isSummon) return true;
	}
}
DamageTypeTag._isInit = false;
DamageTypeTag._WALKER = null;
DamageTypeTag._STATIC_DAMAGE_REGEX = new RegExp(`\\d+ ${ConverterConst.STR_RE_DAMAGE_TYPE} damage`, "gi");
DamageTypeTag._TARGET_TASKES_DAMAGE_REGEX = new RegExp(`(?:a|the) target takes (?:{@dice |{@damage )[^}]+} ?${ConverterConst.STR_RE_DAMAGE_TYPE} damage`, "gi");
DamageTypeTag._SUMMON_DAMAGE_REGEX = /(?:{@dice |{@damage )[^}]+}(?:\s*\+\s*the spell's level)? ([a-z]+( \([-a-zA-Z0-9 ]+\))?( or [a-z]+( \([-a-zA-Z0-9 ]+\))?)? damage)/gi;
DamageTypeTag._TYPE_LOOKUP = {};
// Avoid parsing these, as they commonly have e.g. "self-damage" sections
//   Note that these names should exclude parenthetical parts (as these are removed before lookup)
DamageTypeTag._BLOCKLIST_NAMES = new Set([
	"vampire weaknesses",
]);

globalThis.DamageTypeTag = DamageTypeTag;

class MiscTag {
	/** @return empty string for easy use in `.replace` */
	static _addTag ({tagSet, allowlistTags, tag}) {
		if (allowlistTags != null && !allowlistTags.has(tag)) return "";
		tagSet.add(tag);
		return "";
	}

	static _handleProp ({m, prop, tagSet, allowlistTags}) {
		if (!m[prop]) return;

		m[prop].forEach(it => {
			let hasRangedAttack = false;

			const strEntries = it.entries ? JSON.stringify(it.entries, null, "\t") : null;

			if (strEntries) {
				// Weapon attacks
				// - any melee/ranged attack
				strEntries.replace(/{@atk ([^}]+)}/g, (...mx) => {
					const spl = mx[1].split(",");
					if (spl.includes("rw")) {
						this._addTag({tagSet, allowlistTags, tag: "RW"});
						hasRangedAttack = true;
					}
					if (spl.includes("mw")) this._addTag({tagSet, allowlistTags, tag: "MW"});
				});

				// - reach
				strEntries.replace(/reach (\d+) ft\./g, (...m) => {
					if (Number(m[1]) > 5) this._addTag({tagSet, allowlistTags, tag: "RCH"});
				});

				// AoE effects
				strEntries.replace(/\d+-foot[- ](line|cube|cone|radius|sphere|hemisphere|cylinder)/g, () => this._addTag({tagSet, allowlistTags, tag: "AOE"}));
				strEntries.replace(/each creature within \d+ feet/gi, () => this._addTag({tagSet, allowlistTags, tag: "AOE"}));

				strEntries.replace(/\bhit point maximum is reduced\b/gi, () => this._addTag({tagSet, allowlistTags, tag: "HPR"}));
			}

			if (it.name) {
				// thrown weapon (PHB only)
				if (hasRangedAttack) MiscTag._THROWN_WEAPON_MATCHERS.forEach(r => it.name.replace(r, () => this._addTag({tagSet, allowlistTags, tag: "THW"})));

				// other ranged weapon (PHB only)
				MiscTag._RANGED_WEAPON_MATCHERS.forEach(r => it.name.replace(r, () => {
					const mAtk = /{@atk ([^}]+)}/.exec(strEntries || "");
					if (mAtk) {
						const spl = mAtk[1].split(",");
						// Avoid adding the "ranged attack" tag for spell attacks
						if (spl.includes("rs")) return;
					}
					this._addTag({tagSet, allowlistTags, tag: "RNG"});
				}));
			}
		});
	}

	static tryRun (m, {isAdditiveOnly = false, allowlistTags = null} = {}) {
		const tagSet = new Set(isAdditiveOnly ? m.miscTags || [] : []);
		MiscTag._handleProp({m, prop: "action", tagSet, allowlistTags});
		MiscTag._handleProp({m, prop: "trait", tagSet, allowlistTags});
		MiscTag._handleProp({m, prop: "reaction", tagSet, allowlistTags});
		MiscTag._handleProp({m, prop: "bonus", tagSet, allowlistTags});
		MiscTag._handleProp({m, prop: "legendary", tagSet, allowlistTags});
		MiscTag._handleProp({m, prop: "mythic", tagSet, allowlistTags});
		if (tagSet.size) m.miscTags = [...tagSet];
		else delete m.miscTags;
	}
}
MiscTag._THROWN_WEAPONS = [
	"dagger",
	"handaxe",
	"javelin",
	"light hammer",
	"spear",
	"trident",
	"dart",
	"net",
];
MiscTag._THROWN_WEAPON_MATCHERS = MiscTag._THROWN_WEAPONS.map(it => new RegExp(`(^|[^\\w])(${it})([^\\w]|$)`, "gi"));
MiscTag._RANGED_WEAPONS = [
	"light crossbow",
	"shortbow",
	"sling",
	"blowgun",
	"hand crossbow",
	"heavy crossbow",
	"longbow",
];
MiscTag._RANGED_WEAPON_MATCHERS = MiscTag._RANGED_WEAPONS.map(it => new RegExp(`(^|[^\\w])(${it})([^\\w]|$)`, "gi"));

globalThis.MiscTag = MiscTag;

class SpellcastingTraitConvert {
	static init (spellData) {
		// reversed so official sources take precedence over 3pp
		spellData.forEach(s => SpellcastingTraitConvert.SPELL_SRC_MAP[s.name.toLowerCase()] = s.source);
	}

	static tryParseSpellcasting (ent, {isMarkdown, cbErr, displayAs, actions, reactions}) {
		try {
			return this._parseSpellcasting({ent, isMarkdown, displayAs, actions, reactions});
		} catch (e) {
			cbErr && cbErr(`Failed to parse spellcasting: ${e.message}`);
			return null;
		}
	}

	static _parseSpellcasting ({ent, isMarkdown, displayAs, actions, reactions}) {
		let hasAnyHeader = false;
		const spellcastingEntry = {"name": ent.name, "headerEntries": [this._parseToHit(ent.entries[0])]};
		ent.entries.forEach((thisLine, i) => {
			thisLine = thisLine.replace(/,\s*\*/g, ",*"); // put asterisks on the correct side of commas
			if (i === 0) return;

			const perDurations = [
				{re: /\/rest/i, prop: "rest"},
				{re: /\/day/i, prop: "daily"},
				{re: /\/week/i, prop: "weekly"},
				{re: /\/yeark/i, prop: "yearly"},
			];

			const perDuration = perDurations.find(({re}) => re.test(thisLine));

			if (perDuration) {
				hasAnyHeader = true;
				let property = thisLine.substr(0, 1) + (thisLine.includes(" each:") ? "e" : "");
				const value = this._getParsedSpells({thisLine, isMarkdown});
				if (!spellcastingEntry[perDuration.prop]) spellcastingEntry[perDuration.prop] = {};
				spellcastingEntry[perDuration.prop][property] = value;
			} else if (thisLine.startsWith("Constant: ")) {
				hasAnyHeader = true;
				spellcastingEntry.constant = this._getParsedSpells({thisLine, isMarkdown});
			} else if (thisLine.startsWith("At will: ")) {
				hasAnyHeader = true;
				spellcastingEntry.will = this._getParsedSpells({thisLine, isMarkdown});
			} else if (thisLine.includes("Cantrip")) {
				hasAnyHeader = true;
				const value = this._getParsedSpells({thisLine, isMarkdown});
				if (!spellcastingEntry.spells) spellcastingEntry.spells = {"0": {"spells": []}};
				spellcastingEntry.spells["0"].spells = value;
			} else if (thisLine.includes(" level") && thisLine.includes(": ")) {
				hasAnyHeader = true;
				let property = thisLine.substr(0, 1);
				const allSpells = this._getParsedSpells({thisLine, isMarkdown});
				spellcastingEntry.spells = spellcastingEntry.spells || {};

				const out = {};
				if (thisLine.includes(" slot")) {
					const mWarlock = /^(\d)..(?: level)?-(\d).. level \((\d) (\d)..[- ]level slots?\)/.exec(thisLine);
					if (mWarlock) {
						out.lower = parseInt(mWarlock[1]);
						out.slots = parseInt(mWarlock[3]);
						property = mWarlock[4];
					} else {
						const mSlots = /\((\d) slots?\)/.exec(thisLine);
						if (!mSlots) throw new Error(`Could not find slot count!`);
						out.slots = parseInt(mSlots[1]);
					}
				}
				// add these last, to have nicer ordering
				out.spells = allSpells;

				spellcastingEntry.spells[property] = out;
			} else {
				if (hasAnyHeader) {
					if (!spellcastingEntry.footerEntries) spellcastingEntry.footerEntries = [];
					spellcastingEntry.footerEntries.push(this._parseToHit(thisLine));
				} else {
					spellcastingEntry.headerEntries.push(this._parseToHit(thisLine));
				}
			}
		});

		SpellcastingTraitConvert.mutSpellcastingAbility(spellcastingEntry);
		SpellcastingTraitConvert._mutDisplayAs(spellcastingEntry, displayAs);

		this._addSplitOutSpells({spellcastingEntry, arrayOther: actions});
		this._addSplitOutSpells({spellcastingEntry, arrayOther: reactions});

		return spellcastingEntry;
	}

	static _getParsedSpells ({thisLine, isMarkdown}) {
		let spellPart = thisLine.substring(thisLine.indexOf(": ") + 2).trim();
		if (isMarkdown) {
			const cleanPart = (part) => {
				part = part.trim();
				while (part.startsWith("*") && part.endsWith("*")) {
					part = part.replace(/^\*(.*)\*$/, "$1");
				}
				return part;
			};

			const cleanedInner = spellPart.split(StrUtil.COMMAS_NOT_IN_PARENTHESES_REGEX).map(it => cleanPart(it)).filter(it => it);
			spellPart = cleanedInner.join(", ");

			while (spellPart.startsWith("*") && spellPart.endsWith("*")) {
				spellPart = spellPart.replace(/^\*(.*)\*$/, "$1");
			}
		}

		// move asterisks before commas (e.g. "chaos bolt,*" -> "chaos bolt*,")
		spellPart = spellPart.replace(/,\s*\*/g, "*,");

		return spellPart.split(StrUtil.COMMAS_NOT_IN_PARENTHESES_REGEX).map(it => this._parseSpell(it));
	}

	static _parseSpell (name) {
		name = name.trim();
		let asterisk = name.indexOf("*");
		let brackets = name.indexOf(" (");
		if (asterisk !== -1) {
			const trueName = name.substr(0, asterisk);
			return `{@spell ${trueName}${this._parseSpell_getSourcePart(trueName)}}*`;
		} else if (brackets !== -1) {
			const trueName = name.substr(0, brackets);
			return `{@spell ${trueName}${this._parseSpell_getSourcePart(trueName)}}${name.substring(brackets)}`;
		}
		return `{@spell ${name}${this._parseSpell_getSourcePart(name)}}`;
	}

	static _parseSpell_getSourcePart (spellName) {
		const source = SpellcastingTraitConvert._getSpellSource(spellName);
		return `${source && source !== Parser.SRC_PHB ? `|${source}` : ""}`;
	}

	static _parseToHit (line) {
		return line.replace(/ ([-+])(\d+)( to hit with spell)/g, (m0, m1, m2, m3) => ` {@hit ${m1 === "-" ? "-" : ""}${m2}}${m3}`);
	}

	static mutSpellcastingAbility (spellcastingEntry) {
		if (spellcastingEntry.headerEntries) {
			const m = /strength|dexterity|constitution|charisma|intelligence|wisdom/gi.exec(JSON.stringify(spellcastingEntry.headerEntries));
			if (m) spellcastingEntry.ability = m[0].substring(0, 3).toLowerCase();
		}
	}

	static _mutDisplayAs (spellcastingEntry, displayAs) {
		if (!displayAs || displayAs === "trait") return;
		spellcastingEntry.displayAs = displayAs;
	}

	static _getSpellSource (spellName) {
		if (spellName && SpellcastingTraitConvert.SPELL_SRC_MAP[spellName.toLowerCase()]) return SpellcastingTraitConvert.SPELL_SRC_MAP[spellName.toLowerCase()];
		return null;
	}

	/**
	 * Add other actions/reactions with names such as:
	 * - "Fire Storm (7th-Level Spell; 1/Day)"
	 * - "Shocking Grasp (Cantrip)"
	 * - "Shield (1st-Level Spell; 3/Day)"
	 * as hidden spells (if they don't already exist). */
	static _addSplitOutSpells ({spellcastingEntry, arrayOther}) {
		if (!arrayOther?.length) return;
		arrayOther.forEach(ent => {
			if (!ent.name) return;
			const mName = /^(.*?) \((\d(?:st|nd|rd|th)-level spell; (\d+\/day)|cantrip)\)/i.exec(ent.name);
			if (!mName) return;

			const [, spellName, spellLevelRecharge, spellRecharge] = mName;

			const spellTag = this._parseSpell(spellName);
			const uids = this._getSpellUids(spellTag);

			if (spellLevelRecharge.toLowerCase() === "cantrip") {
				spellcastingEntry.will = spellcastingEntry.will || [];
				if (this._isExistingSpell(spellcastingEntry.will, uids)) return;
				spellcastingEntry.will.push({entry: spellTag, hidden: true});
				return;
			}

			const [numCharges, rechargeDuration] = spellRecharge.toLowerCase().split("/").map(it => it.trim()).filter(Boolean);
			switch (rechargeDuration) {
				case "day": {
					const chargeKey = `${numCharges}e`;
					const tgt = MiscUtil.getOrSet(spellcastingEntry, "daily", chargeKey, []);
					if (this._isExistingSpell(tgt, uids)) return;
					tgt.push({entry: spellTag, hidden: true});
					break;
				}

				// (expand this as required)

				default: throw new Error(`Unhandled recharge duration "${rechargeDuration}"`);
			}
		});
	}

	static _getSpellUids (str) {
		const uids = [];
		str.replace(/{@spell ([^}]+)}/gi, (...m) => {
			const [name, source = Parser.SRC_PHB.toLowerCase()] = m[1].toLowerCase().split("|").map(it => it.trim());
			uids.push(`${name}|${source}`);
		});
		return uids;
	}

	static _isExistingSpell (spellArray, uids) {
		return spellArray.some(it => {
			const str = (it.entry || it).toLowerCase().trim();
			const existingUids = this._getSpellUids(str);
			return existingUids.some(it => uids.includes(it));
		});
	}
}
SpellcastingTraitConvert.SPELL_SRC_MAP = {};

globalThis.SpellcastingTraitConvert = SpellcastingTraitConvert;

class RechargeConvert {
	static tryConvertRecharge (traitOrAction, cbAll, cbMan) {
		if (traitOrAction.name) {
			traitOrAction.name = traitOrAction.name.replace(/\((Recharge )(\d.*?)\)$/gi, (...m) => {
				if (cbAll) cbAll(m[2]);
				const num = m[2][0];
				if (num === "6") return `{@recharge}`;
				if (isNaN(Number(num))) {
					if (cbMan) cbMan(traitOrAction.name);
					return m[0];
				}
				return `{@recharge ${num}}`;
			});
		}
	}
}

globalThis.RechargeConvert = RechargeConvert;

class SpeedConvert {
	static _splitSpeed (str) {
		let c;
		let ret = [];
		let stack = "";
		let para = 0;
		for (let i = 0; i < str.length; ++i) {
			c = str.charAt(i);
			switch (c) {
				case ",":
					if (para === 0) {
						ret.push(stack);
						stack = "";
					}
					break;
				case "(": para++; stack += c; break;
				case ")": para--; stack += c; break;
				default: stack += c;
			}
		}
		if (stack) ret.push(stack);
		return ret.map(it => it.trim()).filter(it => it);
	}

	static _tagHover (m) {
		if (m.speed && m.speed.fly && m.speed.fly.condition) {
			m.speed.fly.condition = m.speed.fly.condition.trim();

			if (m.speed.fly.condition.toLowerCase().includes("hover")) m.speed.canHover = true;
		}
	}

	static tryConvertSpeed (m, cbMan) {
		if (typeof m.speed === "string") {
			let line = m.speed.toLowerCase().trim().replace(/^speed[:.]?\s*/, "");

			const out = {};
			let byHand = false;
			let prevSpeed = null;

			SpeedConvert._splitSpeed(line.toLowerCase()).map(it => it.trim()).forEach(s => {
				// For e.g. shapechanger speeds, store them behind a "condition" on the previous speed
				const mParens = /^\((\w+?\s+)?(\d+)\s*ft\.?( .*)?\)$/.exec(s);
				if (mParens && prevSpeed) {
					if (typeof out[prevSpeed] === "number") out[prevSpeed] = {number: out[prevSpeed], condition: s};
					else out[prevSpeed].condition = s;
					return;
				}

				const m = /^(\w+?\s+)?(\d+)\s*ft\.?( .*)?$/.exec(s);
				if (!m) {
					byHand = true;
					return;
				}

				let [_, mode, feet, condition] = m;
				feet = Number(feet);

				if (mode) mode = mode.trim().toLowerCase();
				else mode = "walk";

				if (SpeedConvert._SPEED_TYPES.has(mode)) {
					if (condition) {
						out[mode] = {
							number: Number(feet),
							condition: condition.trim(),
						};
					} else out[mode] = Number(feet);
					prevSpeed = mode;
				} else {
					byHand = true;
					prevSpeed = null;
				}
			});

			// flag speed as invalid
			if (Object.values(out).filter(s => (s.number != null ? s.number : s) % 5 !== 0).length) out.INVALID_SPEED = true;

			// flag speed as needing hand-parsing
			if (byHand) {
				out.UNPARSED_SPEED = line;
				if (cbMan) cbMan(`${m.name ? `(${m.name}) ` : ""}Speed requires manual conversion: "${line}"`);
			}

			m.speed = out;
			SpeedConvert._tagHover(m);
		}
	}
}
SpeedConvert._SPEED_TYPES = new Set(Parser.SPEED_MODES);

globalThis.SpeedConvert = SpeedConvert;

class DetectNamedCreature {
	static tryRun (mon) {
		const totals = {yes: 0, no: 0};
		this._doCheckProp(mon, totals, "trait");
		this._doCheckProp(mon, totals, "spellcasting");
		this._doCheckProp(mon, totals, "action");
		this._doCheckProp(mon, totals, "reaction");
		this._doCheckProp(mon, totals, "bonus");
		this._doCheckProp(mon, totals, "legendary");
		this._doCheckProp(mon, totals, "mythic");

		if (totals.yes && totals.yes > totals.no) mon.isNamedCreature = true;
	}

	static _doCheckProp (mon, totals, prop) {
		if (!mon.name) return;
		if (mon.isNamedCreature) return;
		if (!mon[prop]) return;

		mon[prop].forEach(it => {
			const prop = it.entries?.length ? "entries" : it.headerEntries?.length ? "headerEntries" : null;
			if (!prop) return;
			if (typeof it[prop][0] !== "string") return;

			const namePart = (mon.name.split(/[ ,:.!;]/g)[0] || "").trim().escapeRegexp();

			const isNotNamedCreature = new RegExp(`^The ${namePart}`).test(it[prop][0]);
			const isNamedCreature = new RegExp(`^${namePart}`).test(it[prop][0]);

			if (isNotNamedCreature && isNamedCreature) return;
			if (isNamedCreature) totals.yes++;
			if (isNotNamedCreature) totals.no++;
		});
	}
}

globalThis.DetectNamedCreature = DetectNamedCreature;

class TagImmResVulnConditional {
	static tryRun (mon) {
		this._handleProp(mon, "resist");
		this._handleProp(mon, "immune");
		this._handleProp(mon, "vulnerable");
	}

	static _handleProp (mon, prop) {
		if (!mon[prop] || !(mon[prop] instanceof Array)) return;
		mon[prop].forEach(it => this._handleProp_recurse(it, prop));
	}

	static _handleProp_recurse (obj, prop) {
		if (obj.note) {
			const note = obj.note.toLowerCase().trim().replace(/^\(/, "").replace(/^damage/, "").trim();
			if (
				note.startsWith("while ")
				|| note.startsWith("from ")
				|| note.startsWith("from ")
				|| note.startsWith("if ")
				|| note.startsWith("against ")
				|| note.startsWith("except ")
				|| note.startsWith("with ")
				|| note.startsWith("that is ")
			) {
				obj.cond = true;
			}
		}

		if (obj[prop]) obj[prop].forEach(it => this._handleProp_recurse(it, prop));
	}
}

globalThis.TagImmResVulnConditional = TagImmResVulnConditional;

class DragonAgeTag {
	static tryRun (mon) {
		const type = mon.type?.type ?? mon.type;
		if (type !== "dragon") return;

		mon.name.replace(/\b(?<age>young|adult|wyrmling|greatwyrm|ancient|aspect)\b/i, (...m) => {
			mon.dragonAge = m.last().age.toLowerCase();
		});
	}
}

globalThis.DragonAgeTag = DragonAgeTag;
