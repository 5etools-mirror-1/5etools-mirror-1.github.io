// PARSING =============================================================================================================
Parser = {};
Parser._parse_aToB = function (abMap, a, fallback) {
	if (a === undefined || a === null) throw new TypeError("undefined or null object passed to parser");
	if (typeof a === "string") a = a.trim();
	if (abMap[a] !== undefined) return abMap[a];
	return fallback !== undefined ? fallback : a;
};

Parser._parse_bToA = function (abMap, b, fallback) {
	if (b === undefined || b === null) throw new TypeError("undefined or null object passed to parser");
	if (typeof b === "string") b = b.trim();
	for (const v in abMap) {
		if (!abMap.hasOwnProperty(v)) continue;
		if (abMap[v] === b) return v;
	}
	return fallback !== undefined ? fallback : b;
};

Parser.attrChooseToFull = function (attList) {
	if (attList.length === 1) return `${Parser.attAbvToFull(attList[0])} modifier`;
	else {
		const attsTemp = [];
		for (let i = 0; i < attList.length; ++i) {
			attsTemp.push(Parser.attAbvToFull(attList[i]));
		}
		return `${attsTemp.join(" or ")} modifier (your choice)`;
	}
};

Parser.numberToText = function (number) {
	if (number == null) throw new TypeError(`undefined or null object passed to parser`);
	if (Math.abs(number) >= 100) return `${number}`;

	function getAsText (num) {
		const abs = Math.abs(num);
		switch (abs) {
			case 0: return "zero";
			case 1: return "one";
			case 2: return "two";
			case 3: return "three";
			case 4: return "four";
			case 5: return "five";
			case 6: return "six";
			case 7: return "seven";
			case 8: return "eight";
			case 9: return "nine";
			case 10: return "ten";
			case 11: return "eleven";
			case 12: return "twelve";
			case 13: return "thirteen";
			case 14: return "fourteen";
			case 15: return "fifteen";
			case 16: return "sixteen";
			case 17: return "seventeen";
			case 18: return "eighteen";
			case 19: return "nineteen";
			case 20: return "twenty";
			case 30: return "thirty";
			case 40: return "forty";
			case 50: return "fiddy"; // :^)
			case 60: return "sixty";
			case 70: return "seventy";
			case 80: return "eighty";
			case 90: return "ninety";
			default: {
				const str = String(abs);
				return `${getAsText(Number(`${str[0]}0`))}-${getAsText(Number(str[1]))}`;
			}
		}
	}
	return `${number < 0 ? "negative " : ""}${getAsText(number)}`;
};

Parser.textToNumber = function (str) {
	str = str.trim().toLowerCase();
	if (!isNaN(str)) return Number(str);
	switch (str) {
		case "zero": return 0;
		case "one": case "a": case "an": return 1;
		case "two": case "double": return 2;
		case "three": case "triple": return 3;
		case "four": case "quadruple": return 4;
		case "five": return 5;
		case "six": return 6;
		case "seven": return 7;
		case "eight": return 8;
		case "nine": return 9;
		case "ten": return 10;
		case "eleven": return 11;
		case "twelve": return 12;
		case "thirteen": return 13;
		case "fourteen": return 14;
		case "fifteen": return 15;
		case "sixteen": return 16;
		case "seventeen": return 17;
		case "eighteen": return 18;
		case "nineteen": return 19;
		case "twenty": return 20;
		case "thirty": return 30;
		case "forty": return 40;
		case "fifty": case "fiddy": return 50;
		case "sixty": return 60;
		case "seventy": return 70;
		case "eighty": return 80;
		case "ninety": return 90;
	}
	return NaN;
};

Parser.numberToVulgar = function (number) {
	const isNeg = number < 0;
	const spl = `${number}`.replace(/^-/, "").split(".");
	if (spl.length === 1) return number;

	let preDot = spl[0] === "0" ? "" : spl[0];
	if (isNeg) preDot = `-${preDot}`;

	switch (spl[1]) {
		case "125": return `${preDot}⅛`;
		case "25": return `${preDot}¼`;
		case "375": return `${preDot}⅜`;
		case "5": return `${preDot}½`;
		case "625": return `${preDot}⅝`;
		case "75": return `${preDot}¾`;
		case "875": return `${preDot}⅞`;

		default: {
			// Handle recursive
			const asNum = Number(`0.${spl[1]}`);

			if (asNum.toFixed(2) === (1 / 3).toFixed(2)) return `${preDot}⅓`;
			if (asNum.toFixed(2) === (2 / 3).toFixed(2)) return `${preDot}⅔`;

			if (asNum.toFixed(2) === (1 / 6).toFixed(2)) return `${preDot}⅙`;
			if (asNum.toFixed(2) === (5 / 6).toFixed(2)) return `${preDot}⅚`;
		}
	}

	return Parser.numberToFractional(number);
};

Parser.vulgarToNumber = function (str) {
	const [, leading = "0", vulgar = ""] = /^(\d+)?([⅛¼⅜½⅝¾⅞⅓⅔⅙⅚])?$/.exec(str) || [];
	let out = Number(leading);
	switch (vulgar) {
		case "⅛": out += 0.125; break;
		case "¼": out += 0.25; break;
		case "⅜": out += 0.375; break;
		case "½": out += 0.5; break;
		case "⅝": out += 0.625; break;
		case "¾": out += 0.75; break;
		case "⅞": out += 0.875; break;
		case "⅓": out += 1 / 3; break;
		case "⅔": out += 2 / 3; break;
		case "⅙": out += 1 / 6; break;
		case "⅚": out += 5 / 6; break;
		case "": break;
		default: throw new Error(`Unhandled vulgar part "${vulgar}"`);
	}
	return out;
};

Parser.numberToSuperscript = function (number) {
	return `${number}`.split("").map(c => isNaN(c) ? c : Parser._NUMBERS_SUPERSCRIPT[Number(c)]).join("");
};
Parser._NUMBERS_SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

Parser.numberToSubscript = function (number) {
	return `${number}`.split("").map(c => isNaN(c) ? c : Parser._NUMBERS_SUBSCRIPT[Number(c)]).join("");
};
Parser._NUMBERS_SUBSCRIPT = "₀₁₂₃₄₅₆₇₈₉";

Parser._greatestCommonDivisor = function (a, b) {
	if (b < Number.EPSILON) return a;
	return Parser._greatestCommonDivisor(b, Math.floor(a % b));
};
Parser.numberToFractional = function (number) {
	const len = number.toString().length - 2;
	let denominator = 10 ** len;
	let numerator = number * denominator;
	const divisor = Parser._greatestCommonDivisor(numerator, denominator);
	numerator = Math.floor(numerator / divisor);
	denominator = Math.floor(denominator / divisor);

	return denominator === 1 ? String(numerator) : `${Math.floor(numerator)}/${Math.floor(denominator)}`;
};

Parser.ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

Parser.attAbvToFull = function (abv) {
	return Parser._parse_aToB(Parser.ATB_ABV_TO_FULL, abv);
};

Parser.attFullToAbv = function (full) {
	return Parser._parse_bToA(Parser.ATB_ABV_TO_FULL, full);
};

Parser.sizeAbvToFull = function (abv) {
	return Parser._parse_aToB(Parser.SIZE_ABV_TO_FULL, abv);
};

Parser.getAbilityModNumber = function (abilityScore) {
	return Math.floor((abilityScore - 10) / 2);
};

Parser.getAbilityModifier = function (abilityScore) {
	let modifier = Parser.getAbilityModNumber(abilityScore);
	if (modifier >= 0) modifier = `+${modifier}`;
	return `${modifier}`;
};

Parser.getSpeedString = (it) => {
	if (it.speed == null) return "\u2014";

	function procSpeed (propName) {
		function addSpeed (s) {
			stack.push(`${propName === "walk" ? "" : `${propName} `}${getVal(s)} ft.${getCond(s)}`);
		}

		if (it.speed[propName] || propName === "walk") addSpeed(it.speed[propName] || 0);
		if (it.speed.alternate && it.speed.alternate[propName]) it.speed.alternate[propName].forEach(addSpeed);
	}

	function getVal (speedProp) {
		return speedProp.number != null ? speedProp.number : speedProp;
	}

	function getCond (speedProp) {
		return speedProp.condition ? ` ${Renderer.get().render(speedProp.condition)}` : "";
	}

	const stack = [];
	if (typeof it.speed === "object") {
		let joiner = ", ";
		Parser.SPEED_MODES.forEach(mode => procSpeed(mode));
		if (it.speed.choose) {
			joiner = "; ";
			stack.push(`${it.speed.choose.from.sort().joinConjunct(", ", " or ")} ${it.speed.choose.amount} ft.${it.speed.choose.note ? ` ${it.speed.choose.note}` : ""}`);
		}
		return stack.join(joiner) + (it.speed.note ? ` ${it.speed.note}` : "");
	} else {
		return it.speed + (it.speed === "Varies" ? "" : " ft. ");
	}
};

Parser.SPEED_MODES = ["walk", "burrow", "climb", "fly", "swim"];

Parser.SPEED_TO_PROGRESSIVE = {
	"walk": "walking",
	"burrow": "burrowing",
	"climb": "climbing",
	"fly": "flying",
	"swim": "swimming",
};

Parser.speedToProgressive = function (prop) {
	return Parser._parse_aToB(Parser.SPEED_TO_PROGRESSIVE, prop);
};

Parser._addCommas = function (intNum) {
	return `${intNum}`.replace(/(\d)(?=(\d{3})+$)/g, "$1,");
};

Parser.raceCreatureTypesToFull = function (creatureTypes) {
	const hasSubOptions = creatureTypes.some(it => it.choose);
	return creatureTypes
		.map(it => {
			if (!it.choose) return Parser.monTypeToFullObj(it).asText.toTitleCase();
			return [...it.choose]
				.sort(SortUtil.ascSortLower)
				.map(sub => Parser.monTypeToFullObj(sub).asText.toTitleCase())
				.joinConjunct(", ", " or ");
		})
		.joinConjunct(hasSubOptions ? "; " : ", ", " and ")
};

Parser.crToXp = function (cr, {isDouble = false} = {}) {
	if (cr != null && cr.xp) return Parser._addCommas(`${isDouble ? cr.xp * 2 : cr.xp}`);

	const toConvert = cr ? (cr.cr || cr) : null;
	if (toConvert === "Unknown" || toConvert == null || !Parser.XP_CHART_ALT[toConvert]) return "Unknown";
	if (toConvert === "0") return "0 or 10";
	const xp = Parser.XP_CHART_ALT[toConvert];
	return Parser._addCommas(`${isDouble ? 2 * xp : xp}`);
};

Parser.crToXpNumber = function (cr) {
	if (cr != null && cr.xp) return cr.xp;
	const toConvert = cr ? (cr.cr || cr) : cr;
	if (toConvert === "Unknown" || toConvert == null) return null;
	return Parser.XP_CHART_ALT[toConvert] ?? null;
};

LEVEL_TO_XP_EASY = [0, 25, 50, 75, 125, 250, 300, 350, 450, 550, 600, 800, 1000, 1100, 1250, 1400, 1600, 2000, 2100, 2400, 2800];
LEVEL_TO_XP_MEDIUM = [0, 50, 100, 150, 250, 500, 600, 750, 900, 1100, 1200, 1600, 2000, 2200, 2500, 2800, 3200, 3900, 4100, 4900, 5700];
LEVEL_TO_XP_HARD = [0, 75, 150, 225, 375, 750, 900, 1100, 1400, 1600, 1900, 2400, 3000, 3400, 3800, 4300, 4800, 5900, 6300, 7300, 8500];
LEVEL_TO_XP_DEADLY = [0, 100, 200, 400, 500, 1100, 1400, 1700, 2100, 2400, 2800, 3600, 4500, 5100, 5700, 6400, 7200, 8800, 9500, 10900, 12700];
LEVEL_TO_XP_DAILY = [0, 300, 600, 1200, 1700, 3500, 4000, 5000, 6000, 7500, 9000, 10500, 11500, 13500, 15000, 18000, 20000, 25000, 27000, 30000, 40000];

Parser.LEVEL_XP_REQUIRED = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

Parser.CRS = ["0", "1/8", "1/4", "1/2", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30"];

Parser.levelToXpThreshold = function (level) {
	return [LEVEL_TO_XP_EASY[level], LEVEL_TO_XP_MEDIUM[level], LEVEL_TO_XP_HARD[level], LEVEL_TO_XP_DEADLY[level]];
};

Parser.isValidCr = function (cr) {
	return Parser.CRS.includes(cr);
};

Parser.crToNumber = function (cr) {
	if (cr === "Unknown" || cr === "\u2014" || cr == null) return VeCt.CR_UNKNOWN;
	if (cr.cr) return Parser.crToNumber(cr.cr);

	const parts = cr.trim().split("/");

	if (parts.length === 1) {
		if (isNaN(parts[0])) return VeCt.CR_CUSTOM;
		return Number(parts[0]);
	} else if (parts.length === 2) {
		if (isNaN(parts[0]) || isNaN(Number(parts[1]))) return VeCt.CR_CUSTOM;
		return Number(parts[0]) / Number(parts[1]);
	} else return 0;
};

Parser.numberToCr = function (number, safe) {
	// avoid dying if already-converted number is passed in
	if (safe && typeof number === "string" && Parser.CRS.includes(number)) return number;

	if (number == null) return "Unknown";

	return Parser.numberToFractional(number);
};

Parser.crToPb = function (cr) {
	if (cr === "Unknown" || cr == null) return 0;
	cr = cr.cr || cr;
	if (Parser.crToNumber(cr) < 5) return 2;
	return Math.ceil(cr / 4) + 1;
};

Parser.levelToPb = function (level) {
	if (!level) return 2;
	return Math.ceil(level / 4) + 1;
};

Parser.SKILL_TO_ATB_ABV = {
	"athletics": "str",
	"acrobatics": "dex",
	"sleight of hand": "dex",
	"stealth": "dex",
	"arcana": "int",
	"history": "int",
	"investigation": "int",
	"nature": "int",
	"religion": "int",
	"animal handling": "wis",
	"insight": "wis",
	"medicine": "wis",
	"perception": "wis",
	"survival": "wis",
	"deception": "cha",
	"intimidation": "cha",
	"performance": "cha",
	"persuasion": "cha",
};

Parser.skillToAbilityAbv = function (skill) {
	return Parser._parse_aToB(Parser.SKILL_TO_ATB_ABV, skill);
};

Parser.SKILL_TO_SHORT = {
	"athletics": "ath",
	"acrobatics": "acro",
	"sleight of hand": "soh",
	"stealth": "slth",
	"arcana": "arc",
	"history": "hist",
	"investigation": "invn",
	"nature": "natr",
	"religion": "reli",
	"animal handling": "hndl",
	"insight": "ins",
	"medicine": "med",
	"perception": "perp",
	"survival": "surv",
	"deception": "decp",
	"intimidation": "intm",
	"performance": "perf",
	"persuasion": "pers",
};

Parser.skillToShort = function (skill) {
	return Parser._parse_aToB(Parser.SKILL_TO_SHORT, skill);
};

Parser.LANGUAGES_STANDARD = [
	"Common",
	"Dwarvish",
	"Elvish",
	"Giant",
	"Gnomish",
	"Goblin",
	"Halfling",
	"Orc",
];

Parser.LANGUAGES_EXOTIC = [
	"Abyssal",
	"Aquan",
	"Auran",
	"Celestial",
	"Draconic",
	"Deep Speech",
	"Ignan",
	"Infernal",
	"Primordial",
	"Sylvan",
	"Terran",
	"Undercommon",
];

Parser.LANGUAGES_SECRET = [
	"Druidic",
	"Thieves' cant",
];

Parser.LANGUAGES_ALL = [
	...Parser.LANGUAGES_STANDARD,
	...Parser.LANGUAGES_EXOTIC,
	...Parser.LANGUAGES_SECRET,
].sort();

Parser.dragonColorToFull = function (c) {
	return Parser._parse_aToB(Parser.DRAGON_COLOR_TO_FULL, c);
};

Parser.DRAGON_COLOR_TO_FULL = {
	B: "black",
	U: "blue",
	G: "green",
	R: "red",
	W: "white",
	A: "brass",
	Z: "bronze",
	C: "copper",
	O: "gold",
	S: "silver",
};

Parser.acToFull = function (ac, renderer) {
	if (typeof ac === "string") return ac; // handle classic format

	renderer = renderer || Renderer.get();

	let stack = "";
	let inBraces = false;
	for (let i = 0; i < ac.length; ++i) {
		const cur = ac[i];
		const nxt = ac[i + 1];

		if (cur.special != null) {
			if (inBraces) inBraces = false;

			stack += cur.special;
		} else if (cur.ac) {
			const isNxtBraces = nxt && nxt.braces;

			if (!inBraces && cur.braces) {
				stack += "(";
				inBraces = true;
			}

			stack += cur.ac;

			if (cur.from) {
				// always brace nested braces
				if (cur.braces) {
					stack += " (";
				} else {
					stack += inBraces ? "; " : " (";
				}

				inBraces = true;

				stack += cur.from.map(it => renderer.render(it)).join(", ");

				if (cur.braces) {
					stack += ")";
				} else if (!isNxtBraces) {
					stack += ")";
					inBraces = false;
				}
			}

			if (cur.condition) stack += ` ${renderer.render(cur.condition)}`;

			if (inBraces && !isNxtBraces) {
				stack += ")";
				inBraces = false;
			}
		} else {
			stack += cur;
		}

		if (nxt) {
			if (nxt.braces) {
				stack += inBraces ? "; " : " (";
				inBraces = true;
			} else stack += ", ";
		}
	}
	if (inBraces) stack += ")";

	return stack.trim();
};

MONSTER_COUNT_TO_XP_MULTIPLIER = [1, 1.5, 2, 2, 2, 2, 2.5, 2.5, 2.5, 2.5, 3, 3, 3, 3, 4];
Parser.numMonstersToXpMult = function (num, playerCount = 3) {
	const baseVal = (() => {
		if (num >= MONSTER_COUNT_TO_XP_MULTIPLIER.length) return 4;
		return MONSTER_COUNT_TO_XP_MULTIPLIER[num - 1];
	})();

	if (playerCount < 3) return baseVal >= 3 ? baseVal + 1 : baseVal + 0.5;
	else if (playerCount > 5) {
		return baseVal === 4 ? 3 : baseVal - 0.5;
	} else return baseVal;
};

Parser.armorFullToAbv = function (armor) {
	return Parser._parse_bToA(Parser.ARMOR_ABV_TO_FULL, armor);
};

Parser.weaponFullToAbv = function (weapon) {
	return Parser._parse_bToA(Parser.WEAPON_ABV_TO_FULL, weapon);
};

Parser._getSourceStringFromSource = function (source) {
	if (source && source.source) return source.source;
	return source;
};
Parser._buildSourceCache = function (dict) {
	const out = {};
	Object.entries(dict).forEach(([k, v]) => out[k.toLowerCase()] = v);
	return out;
};
Parser._sourceFullCache = null;
Parser.hasSourceFull = function (source) {
	Parser._sourceFullCache = Parser._sourceFullCache || Parser._buildSourceCache(Parser.SOURCE_JSON_TO_FULL);
	return !!Parser._sourceFullCache[source.toLowerCase()];
};
Parser._sourceAbvCache = null;
Parser.hasSourceAbv = function (source) {
	Parser._sourceAbvCache = Parser._sourceAbvCache || Parser._buildSourceCache(Parser.SOURCE_JSON_TO_ABV);
	return !!Parser._sourceAbvCache[source.toLowerCase()];
};
Parser._sourceDateCache = null;
Parser.hasSourceDate = function (source) {
	Parser._sourceDateCache = Parser._sourceDateCache || Parser._buildSourceCache(Parser.SOURCE_JSON_TO_DATE);
	return !!Parser._sourceDateCache[source.toLowerCase()];
};
Parser.sourceJsonToFull = function (source) {
	source = Parser._getSourceStringFromSource(source);
	if (Parser.hasSourceFull(source)) return Parser._sourceFullCache[source.toLowerCase()].replace(/'/g, "\u2019");
	if (BrewUtil.hasSourceJson(source)) return BrewUtil.sourceJsonToFull(source).replace(/'/g, "\u2019");
	return Parser._parse_aToB(Parser.SOURCE_JSON_TO_FULL, source).replace(/'/g, "\u2019");
};
Parser.sourceJsonToFullCompactPrefix = function (source) {
	return Parser.sourceJsonToFull(source)
		.replace(UA_PREFIX, UA_PREFIX_SHORT)
		.replace(AL_PREFIX, AL_PREFIX_SHORT)
		.replace(PS_PREFIX, PS_PREFIX_SHORT);
};
Parser.sourceJsonToAbv = function (source) {
	source = Parser._getSourceStringFromSource(source);
	if (Parser.hasSourceAbv(source)) return Parser._sourceAbvCache[source.toLowerCase()];
	if (BrewUtil.hasSourceJson(source)) return BrewUtil.sourceJsonToAbv(source);
	return Parser._parse_aToB(Parser.SOURCE_JSON_TO_ABV, source);
};
Parser.sourceJsonToDate = function (source) {
	source = Parser._getSourceStringFromSource(source);
	if (Parser.hasSourceDate(source)) return Parser._sourceDateCache[source.toLowerCase()];
	if (BrewUtil.hasSourceJson(source)) return BrewUtil.sourceJsonToDate(source);
	return Parser._parse_aToB(Parser.SOURCE_JSON_TO_DATE, source, null);
};

Parser.sourceJsonToColor = function (source) {
	return `source${Parser.sourceJsonToAbv(source)}`;
};

Parser.stringToSlug = function (str) {
	return str.trim().toLowerCase().replace(/[^\w ]+/g, "").replace(/ +/g, "-");
};

Parser.stringToCasedSlug = function (str) {
	return str.replace(/[^\w ]+/g, "").replace(/ +/g, "-");
};

Parser.ITEM_SPELLCASTING_FOCUS_CLASSES = ["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];

Parser.itemValueToFull = function (item, opts = {isShortForm: false, isSmallUnits: false}) {
	return Parser._moneyToFull(item, "value", "valueMult", opts);
};

Parser.itemValueToFullMultiCurrency = function (item, opts = {isShortForm: false, isSmallUnits: false, multiplier: 1}) {
	return Parser._moneyToFullMultiCurrency(item, "value", "valueMult", opts);
};

Parser.itemVehicleCostsToFull = function (item, isShortForm) {
	return {
		travelCostFull: Parser._moneyToFull(item, "travelCost", "travelCostMult", {isShortForm}),
		shippingCostFull: Parser._moneyToFull(item, "shippingCost", "shippingCostMult", {isShortForm}),
	};
};

Parser.spellComponentCostToFull = function (item, isShortForm) {
	return Parser._moneyToFull(item, "cost", "costMult", {isShortForm});
};

Parser._moneyToFull = function (it, prop, propMult, opts = {isShortForm: false, isSmallUnits: false}) {
	if (it[prop] == null && it[propMult] == null) return "";
	if (it[prop] != null) {
		const {coin, mult} = Parser.getCurrencyAndMultiplier(it[prop], it.currencyConversion);
		return `${(it[prop] * mult).toLocaleString(undefined, {maximumFractionDigits: 5})}${opts.isSmallUnits ? `<span class="small ml-1">${coin}</span>` : ` ${coin}`}`;
	} else if (it[propMult] != null) return opts.isShortForm ? `×${it[propMult]}` : `base value ×${it[propMult]}`;
	return "";
};

Parser._moneyToFullMultiCurrency = function (it, prop, propMult, {isShortForm, multiplier} = {}) {
	if (it[prop]) {
		const simplified = CurrencyUtil.doSimplifyCoins(
			{
				cp: it[prop] * (multiplier ?? 1),
			},
			{
				currencyConversionId: it.currencyConversion,
			},
		);

		const conversionTable = Parser.getCurrencyConversionTable(it.currencyConversion);

		return [...conversionTable]
			.reverse()
			.filter(meta => simplified[meta.coin])
			.map(meta => `${simplified[meta.coin].toLocaleString(undefined, {maximumFractionDigits: 5})} ${meta.coin}`)
			.join(", ");
	} else if (it[propMult]) return isShortForm ? `×${it[propMult]}` : `base value ×${it[propMult]}`;
	return "";
};

Parser.DEFAULT_CURRENCY_CONVERSION_TABLE = [
	{
		coin: "cp",
		mult: 1,
	},
	{
		coin: "sp",
		mult: 0.1,
	},
	{
		coin: "gp",
		mult: 0.01,
		isFallback: true,
	},
];
Parser.FULL_CURRENCY_CONVERSION_TABLE = [
	{
		coin: "cp",
		mult: 1,
	},
	{
		coin: "sp",
		mult: 0.1,
	},
	{
		coin: "ep",
		mult: 0.02,
	},
	{
		coin: "gp",
		mult: 0.01,
		isFallback: true,
	},
	{
		coin: "pp",
		mult: 0.001,
	},
];
Parser.getCurrencyConversionTable = function (currencyConversionId) {
	const fromBrew = currencyConversionId ? MiscUtil.get(BrewUtil.homebrewMeta, "currencyConversions", currencyConversionId) : null;
	const conversionTable = fromBrew && fromBrew.length ? fromBrew : Parser.DEFAULT_CURRENCY_CONVERSION_TABLE;
	if (conversionTable !== Parser.DEFAULT_CURRENCY_CONVERSION_TABLE) conversionTable.sort((a, b) => SortUtil.ascSort(b.mult, a.mult));
	return conversionTable;
};
Parser.getCurrencyAndMultiplier = function (value, currencyConversionId) {
	const conversionTable = Parser.getCurrencyConversionTable(currencyConversionId);

	if (!value) return conversionTable.find(it => it.isFallback) || conversionTable[0];
	if (conversionTable.length === 1) return conversionTable[0];
	if (!Number.isInteger(value) && value < conversionTable[0].mult) return conversionTable[0];

	for (let i = conversionTable.length - 1; i >= 0; --i) {
		if (Number.isInteger(value * conversionTable[i].mult)) return conversionTable[i];
	}

	return conversionTable.last();
};

Parser.COIN_ABVS = ["cp", "sp", "ep", "gp", "pp"];
Parser.COIN_ABV_TO_FULL = {
	"cp": "copper pieces",
	"sp": "silver pieces",
	"ep": "electrum pieces",
	"gp": "gold pieces",
	"pp": "platinum pieces",
};
Parser.COIN_CONVERSIONS = [1, 10, 50, 100, 1000];

Parser.coinAbvToFull = function (coin) {
	return Parser._parse_aToB(Parser.COIN_ABV_TO_FULL, coin);
};

/**
 * @param currency Object of the form `{pp: <n>, gp: <m>, ... }`.
 * @param isDisplayEmpty If "empty" values (i.e., those which are 0) should be displayed.
 */
Parser.getDisplayCurrency = function (currency, {isDisplayEmpty = false} = {}) {
	return [...Parser.COIN_ABVS]
		.reverse()
		.filter(abv => isDisplayEmpty ? currency[abv] != null : currency[abv])
		.map(abv => `${currency[abv].toLocaleString()} ${abv}`)
		.join(", ");
};

Parser.itemWeightToFull = function (item, isShortForm) {
	if (item.weight) {
		// Handle pure integers
		if (Math.round(item.weight) === item.weight) return `${item.weight} lb.${(item.weightNote ? ` ${item.weightNote}` : "")}`;

		// Attempt to render the amount as (a number +) a vulgar
		const weightOunces = item.weight * 16;
		const integerPart = Math.floor(item.weight);
		const vulgarPart = weightOunces % 16;

		let vulgarGlyph;
		switch (vulgarPart) {
			case 2: vulgarGlyph = "⅛"; break;
			case 4: vulgarGlyph = "¼"; break;
			case 6: vulgarGlyph = "⅜"; break;
			case 8: vulgarGlyph = "½"; break;
			case 10: vulgarGlyph = "⅝"; break;
			case 12: vulgarGlyph = "¾"; break;
			case 14: vulgarGlyph = "⅞"; break;
		}
		if (vulgarGlyph) return `${integerPart || ""}${vulgarGlyph} lb.${(item.weightNote ? ` ${item.weightNote}` : "")}`

		// Fall back on decimal pounds or ounces
		return `${item.weight < 1 ? item.weight * 16 : item.weight} ${item.weight < 1 ? "oz" : "lb"}.${(item.weightNote ? ` ${item.weightNote}` : "")}`
	}
	if (item.weightMult) return isShortForm ? `×${item.weightMult}` : `base weight ×${item.weightMult}`;
	return "";
};

Parser.ITEM_RECHARGE_TO_FULL = {
	round: "Every Round",
	restShort: "Short Rest",
	restLong: "Long Rest",
	dawn: "Dawn",
	dusk: "Dusk",
	midnight: "Midnight",
	special: "Special",
}
Parser.itemRechargeToFull = function (recharge) {
	return Parser._parse_aToB(Parser.ITEM_RECHARGE_TO_FULL, recharge);
};

Parser._decimalSeparator = (0.1).toLocaleString().substring(1, 2);
Parser._numberCleanRegexp = Parser._decimalSeparator === "." ? new RegExp(/[\s,]*/g, "g") : new RegExp(/[\s.]*/g, "g");
Parser._costSplitRegexp = Parser._decimalSeparator === "." ? new RegExp(/(\d+(\.\d+)?)([csegp]p)/) : new RegExp(/(\d+(,\d+)?)([csegp]p)/);

/** input e.g. "25 gp", "1,000pp" */
Parser.coinValueToNumber = function (value) {
	if (!value) return 0;
	// handle oddities
	if (value === "Varies") return 0;

	value = value
		.replace(/\s*/, "")
		.replace(Parser._numberCleanRegexp, "")
		.toLowerCase();
	const m = Parser._costSplitRegexp.exec(value);
	if (!m) throw new Error(`Badly formatted value "${value}"`);
	const ixCoin = Parser.COIN_ABVS.indexOf(m[3]);
	if (!~ixCoin) throw new Error(`Unknown coin type "${m[3]}"`);
	return Number(m[1]) * Parser.COIN_CONVERSIONS[ixCoin];
};

Parser.weightValueToNumber = function (value) {
	if (!value) return 0;

	if (Number(value)) return Number(value);
	else throw new Error(`Badly formatted value ${value}`);
};

Parser.dmgTypeToFull = function (dmgType) {
	return Parser._parse_aToB(Parser.DMGTYPE_JSON_TO_FULL, dmgType);
};

Parser.skillToExplanation = function (skillType) {
	const fromBrew = MiscUtil.get(BrewUtil.homebrewMeta, "skills", skillType);
	if (fromBrew) return fromBrew;
	return Parser._parse_aToB(Parser.SKILL_JSON_TO_FULL, skillType);
};

Parser.senseToExplanation = function (senseType) {
	senseType = senseType.toLowerCase();
	const fromBrew = MiscUtil.get(BrewUtil.homebrewMeta, "senses", senseType);
	if (fromBrew) return fromBrew;
	return Parser._parse_aToB(Parser.SENSE_JSON_TO_FULL, senseType, ["No explanation available."]);
};

Parser.skillProficienciesToFull = function (skillProficiencies) {
	function renderSingle (skProf) {
		if (skProf.any) {
			skProf = MiscUtil.copy(skProf);
			skProf.choose = {"from": Object.keys(Parser.SKILL_TO_ATB_ABV), "count": skProf.any};
			delete skProf.any;
		}

		const keys = Object.keys(skProf).sort(SortUtil.ascSortLower);

		const ixChoose = keys.indexOf("choose");
		if (~ixChoose) keys.splice(ixChoose, 1);

		const baseStack = [];
		keys.filter(k => skProf[k]).forEach(k => baseStack.push(Renderer.get().render(`{@skill ${k.toTitleCase()}}`)));

		const chooseStack = [];
		if (~ixChoose) {
			const chObj = skProf.choose;
			if (chObj.from.length === 18) {
				chooseStack.push(`choose any ${!chObj.count || chObj.count === 1 ? "skill" : chObj.count}`);
			} else {
				chooseStack.push(`choose ${chObj.count || 1} from ${chObj.from.map(it => Renderer.get().render(`{@skill ${it.toTitleCase()}}`)).joinConjunct(", ", " and ")}`);
			}
		}

		const base = baseStack.joinConjunct(", ", " and ");
		const choose = chooseStack.join(""); // this should currently only ever be 1-length

		if (baseStack.length && chooseStack.length) return `${base}; and ${choose}`;
		else if (baseStack.length) return base;
		else if (chooseStack.length) return choose;
	}

	return skillProficiencies.map(renderSingle).join(" <i>or</i> ");
};

// sp-prefix functions are for parsing spell data, and shared with the roll20 script
Parser.spSchoolAndSubschoolsAbvsToFull = function (school, subschools) {
	if (!subschools || !subschools.length) return Parser.spSchoolAbvToFull(school);
	else return `${Parser.spSchoolAbvToFull(school)} (${subschools.map(sub => Parser.spSchoolAbvToFull(sub)).join(", ")})`;
};

Parser.spSchoolAbvToFull = function (schoolOrSubschool) {
	const out = Parser._parse_aToB(Parser.SP_SCHOOL_ABV_TO_FULL, schoolOrSubschool);
	if (Parser.SP_SCHOOL_ABV_TO_FULL[schoolOrSubschool]) return out;
	if (BrewUtil.homebrewMeta && BrewUtil.homebrewMeta.spellSchools && BrewUtil.homebrewMeta.spellSchools[schoolOrSubschool]) return BrewUtil.homebrewMeta.spellSchools[schoolOrSubschool].full;
	return out;
};

Parser.spSchoolAndSubschoolsAbvsShort = function (school, subschools) {
	if (!subschools || !subschools.length) return Parser.spSchoolAbvToShort(school);
	else return `${Parser.spSchoolAbvToShort(school)} (${subschools.map(sub => Parser.spSchoolAbvToShort(sub)).join(", ")})`;
};

Parser.spSchoolAbvToShort = function (school) {
	const out = Parser._parse_aToB(Parser.SP_SCHOOL_ABV_TO_SHORT, school);
	if (Parser.SP_SCHOOL_ABV_TO_SHORT[school]) return out;
	if (BrewUtil.homebrewMeta && BrewUtil.homebrewMeta.spellSchools && BrewUtil.homebrewMeta.spellSchools[school]) return BrewUtil.homebrewMeta.spellSchools[school].short;
	return out;
};

Parser.spSchoolAbvToStyle = function (school) { // For homebrew
	const stylePart = Parser.spSchoolAbvToStylePart(school);
	if (!stylePart) return stylePart;
	return `style="${stylePart}"`;
};

Parser.spSchoolAbvToStylePart = function (school) { // For homebrew
	const rawColor = MiscUtil.get(BrewUtil, "homebrewMeta", "spellSchools", school, "color");
	if (!rawColor || !rawColor.trim()) return "";
	const validColor = BrewUtil.getValidColor(rawColor);
	if (validColor.length) return `color: #${validColor};`;
	return "";
};

Parser.getOrdinalForm = function (i) {
	i = Number(i);
	if (isNaN(i)) return "";
	const j = i % 10; const k = i % 100;
	if (j === 1 && k !== 11) return `${i}st`;
	if (j === 2 && k !== 12) return `${i}nd`;
	if (j === 3 && k !== 13) return `${i}rd`;
	return `${i}th`;
};

Parser.spLevelToFull = function (level) {
	if (level === 0) return "Cantrip";
	else return Parser.getOrdinalForm(level);
};

Parser.getArticle = function (str) {
	str = `${str}`;
	str = str.replace(/\d+/g, (...m) => Parser.numberToText(m[0]));
	return /^[aeiou]/i.test(str) ? "an" : "a";
};

Parser.spLevelToFullLevelText = function (level, dash) {
	return `${Parser.spLevelToFull(level)}${(level === 0 ? "s" : `${dash ? "-" : " "}level`)}`;
};

Parser.spLevelToSpellPoints = function (lvl) {
	lvl = Number(lvl);
	if (isNaN(lvl) || lvl === 0) return 0;
	return Math.ceil(1.34 * lvl);
};

Parser.spMetaToArr = function (meta) {
	if (!meta) return [];
	return Object.entries(meta)
		.filter(([_, v]) => v)
		.sort(SortUtil.ascSort)
		.map(([k]) => k);
};

Parser.spMetaToFull = function (meta) {
	if (!meta) return "";
	const metaTags = Parser.spMetaToArr(meta);
	if (metaTags.length) return ` (${metaTags.join(", ")})`;
	return "";
};

Parser.spLevelSchoolMetaToFull = function (level, school, meta, subschools) {
	const levelPart = level === 0 ? Parser.spLevelToFull(level).toLowerCase() : `${Parser.spLevelToFull(level)}-level`;
	const levelSchoolStr = level === 0 ? `${Parser.spSchoolAbvToFull(school)} ${levelPart}` : `${levelPart} ${Parser.spSchoolAbvToFull(school).toLowerCase()}`;

	const metaArr = Parser.spMetaToArr(meta);
	if (metaArr.length || (subschools && subschools.length)) {
		const metaAndSubschoolPart = [
			(subschools || []).map(sub => Parser.spSchoolAbvToFull(sub)).join(", "),
			metaArr.join(", "),
		].filter(Boolean).join("; ").toLowerCase();
		return `${levelSchoolStr} (${metaAndSubschoolPart})`;
	}
	return levelSchoolStr;
};

Parser.spTimeListToFull = function (times, isStripTags) {
	return times.map(t => `${Parser.getTimeToFull(t)}${t.condition ? `, ${isStripTags ? Renderer.stripTags(t.condition) : Renderer.get().render(t.condition)}` : ""}`).join(" or ");
};

Parser.getTimeToFull = function (time) {
	return `${time.number ? `${time.number} ` : ""}${time.unit === "bonus" ? "bonus action" : time.unit}${time.number > 1 ? "s" : ""}`;
};

RNG_SPECIAL = "special";
RNG_POINT = "point";
RNG_LINE = "line";
RNG_CUBE = "cube";
RNG_CONE = "cone";
RNG_RADIUS = "radius";
RNG_SPHERE = "sphere";
RNG_HEMISPHERE = "hemisphere";
RNG_CYLINDER = "cylinder"; // homebrew only
RNG_SELF = "self";
RNG_SIGHT = "sight";
RNG_UNLIMITED = "unlimited";
RNG_UNLIMITED_SAME_PLANE = "plane";
RNG_TOUCH = "touch";
Parser.SP_RANGE_TYPE_TO_FULL = {
	[RNG_SPECIAL]: "Special",
	[RNG_POINT]: "Point",
	[RNG_LINE]: "Line",
	[RNG_CUBE]: "Cube",
	[RNG_CONE]: "Cone",
	[RNG_RADIUS]: "Radius",
	[RNG_SPHERE]: "Sphere",
	[RNG_HEMISPHERE]: "Hemisphere",
	[RNG_CYLINDER]: "Cylinder",
	[RNG_SELF]: "Self",
	[RNG_SIGHT]: "Sight",
	[RNG_UNLIMITED]: "Unlimited",
	[RNG_UNLIMITED_SAME_PLANE]: "Unlimited on the same plane",
	[RNG_TOUCH]: "Touch",
};

Parser.spRangeTypeToFull = function (range) {
	return Parser._parse_aToB(Parser.SP_RANGE_TYPE_TO_FULL, range);
};

UNT_FEET = "feet";
UNT_MILES = "miles";
Parser.SP_DIST_TYPE_TO_FULL = {
	[UNT_FEET]: "Feet",
	[UNT_MILES]: "Miles",
	[RNG_SELF]: Parser.SP_RANGE_TYPE_TO_FULL[RNG_SELF],
	[RNG_TOUCH]: Parser.SP_RANGE_TYPE_TO_FULL[RNG_TOUCH],
	[RNG_SIGHT]: Parser.SP_RANGE_TYPE_TO_FULL[RNG_SIGHT],
	[RNG_UNLIMITED]: Parser.SP_RANGE_TYPE_TO_FULL[RNG_UNLIMITED],
	[RNG_UNLIMITED_SAME_PLANE]: Parser.SP_RANGE_TYPE_TO_FULL[RNG_UNLIMITED_SAME_PLANE],
};

Parser.spDistanceTypeToFull = function (range) {
	return Parser._parse_aToB(Parser.SP_DIST_TYPE_TO_FULL, range);
};

Parser.SP_RANGE_TO_ICON = {
	[RNG_SPECIAL]: "fa-star",
	[RNG_POINT]: "",
	[RNG_LINE]: "fa-grip-lines-vertical",
	[RNG_CUBE]: "fa-cube",
	[RNG_CONE]: "fa-traffic-cone",
	[RNG_RADIUS]: "fa-hockey-puck",
	[RNG_SPHERE]: "fa-globe",
	[RNG_HEMISPHERE]: "fa-globe",
	[RNG_CYLINDER]: "fa-database",
	[RNG_SELF]: "fa-street-view",
	[RNG_SIGHT]: "fa-eye",
	[RNG_UNLIMITED_SAME_PLANE]: "fa-globe-americas",
	[RNG_UNLIMITED]: "fa-infinity",
	[RNG_TOUCH]: "fa-hand-paper",
};

Parser.spRangeTypeToIcon = function (range) {
	return Parser._parse_aToB(Parser.SP_RANGE_TO_ICON, range);
};

Parser.spRangeToShortHtml = function (range) {
	switch (range.type) {
		case RNG_SPECIAL: return `<span class="fas fa-fw ${Parser.spRangeTypeToIcon(range.type)} help-subtle" title="Special"></span>`;
		case RNG_POINT: return Parser.spRangeToShortHtml._renderPoint(range);
		case RNG_LINE:
		case RNG_CUBE:
		case RNG_CONE:
		case RNG_RADIUS:
		case RNG_SPHERE:
		case RNG_HEMISPHERE:
		case RNG_CYLINDER:
			return Parser.spRangeToShortHtml._renderArea(range);
	}
};
Parser.spRangeToShortHtml._renderPoint = function (range) {
	const dist = range.distance;
	switch (dist.type) {
		case RNG_SELF:
		case RNG_SIGHT:
		case RNG_UNLIMITED:
		case RNG_UNLIMITED_SAME_PLANE:
		case RNG_SPECIAL:
		case RNG_TOUCH: return `<span class="fas fa-fw ${Parser.spRangeTypeToIcon(dist.type)} help-subtle" title="${Parser.spRangeTypeToFull(dist.type)}"></span>`;
		case UNT_FEET:
		case UNT_MILES:
		default:
			return `${dist.amount} <span class="ve-small">${Parser.getSingletonUnit(dist.type, true)}</span>`;
	}
};
Parser.spRangeToShortHtml._renderArea = function (range) {
	const size = range.distance;
	return `<span class="fas fa-fw ${Parser.spRangeTypeToIcon(RNG_SELF)} help-subtle" title="Self"></span> ${size.amount}<span class="ve-small">-${Parser.getSingletonUnit(size.type, true)}</span> ${Parser.spRangeToShortHtml._getAreaStyleString(range)}`;
};
Parser.spRangeToShortHtml._getAreaStyleString = function (range) {
	return `<span class="fas fa-fw ${Parser.spRangeTypeToIcon(range.type)} help-subtle" title="${Parser.spRangeTypeToFull(range.type)}"></span>`
};

Parser.spRangeToFull = function (range) {
	switch (range.type) {
		case RNG_SPECIAL: return Parser.spRangeTypeToFull(range.type);
		case RNG_POINT: return Parser.spRangeToFull._renderPoint(range);
		case RNG_LINE:
		case RNG_CUBE:
		case RNG_CONE:
		case RNG_RADIUS:
		case RNG_SPHERE:
		case RNG_HEMISPHERE:
		case RNG_CYLINDER:
			return Parser.spRangeToFull._renderArea(range);
	}
};
Parser.spRangeToFull._renderPoint = function (range) {
	const dist = range.distance;
	switch (dist.type) {
		case RNG_SELF:
		case RNG_SIGHT:
		case RNG_UNLIMITED:
		case RNG_UNLIMITED_SAME_PLANE:
		case RNG_SPECIAL:
		case RNG_TOUCH: return Parser.spRangeTypeToFull(dist.type);
		case UNT_FEET:
		case UNT_MILES:
		default:
			return `${dist.amount} ${dist.amount === 1 ? Parser.getSingletonUnit(dist.type) : dist.type}`;
	}
};
Parser.spRangeToFull._renderArea = function (range) {
	const size = range.distance;
	return `Self (${size.amount}-${Parser.getSingletonUnit(size.type)}${Parser.spRangeToFull._getAreaStyleString(range)}${range.type === RNG_CYLINDER ? `${size.amountSecondary != null && size.typeSecondary != null ? `, ${size.amountSecondary}-${Parser.getSingletonUnit(size.typeSecondary)}-high` : ""} cylinder` : ""})`;
};
Parser.spRangeToFull._getAreaStyleString = function (range) {
	switch (range.type) {
		case RNG_SPHERE: return " radius";
		case RNG_HEMISPHERE: return `-radius ${range.type}`;
		case RNG_CYLINDER: return "-radius";
		default: return ` ${range.type}`;
	}
};

Parser.getSingletonUnit = function (unit, isShort) {
	switch (unit) {
		case UNT_FEET:
			return isShort ? "ft." : "foot";
		case UNT_MILES:
			return isShort ? "mi." : "mile";
		default: {
			const fromBrew = MiscUtil.get(BrewUtil.homebrewMeta, "spellDistanceUnits", unit, "singular");
			if (fromBrew) return fromBrew;
			if (unit.charAt(unit.length - 1) === "s") return unit.slice(0, -1);
			return unit;
		}
	}
};

Parser.RANGE_TYPES = [
	{type: RNG_POINT, hasDistance: true, isRequireAmount: false},

	{type: RNG_LINE, hasDistance: true, isRequireAmount: true},
	{type: RNG_CUBE, hasDistance: true, isRequireAmount: true},
	{type: RNG_CONE, hasDistance: true, isRequireAmount: true},
	{type: RNG_RADIUS, hasDistance: true, isRequireAmount: true},
	{type: RNG_SPHERE, hasDistance: true, isRequireAmount: true},
	{type: RNG_HEMISPHERE, hasDistance: true, isRequireAmount: true},
	{type: RNG_CYLINDER, hasDistance: true, isRequireAmount: true},

	{type: RNG_SPECIAL, hasDistance: false, isRequireAmount: false},
];

Parser.DIST_TYPES = [
	{type: RNG_SELF, hasAmount: false},
	{type: RNG_TOUCH, hasAmount: false},

	{type: UNT_FEET, hasAmount: true},
	{type: UNT_MILES, hasAmount: true},

	{type: RNG_SIGHT, hasAmount: false},
	{type: RNG_UNLIMITED_SAME_PLANE, hasAmount: false},
	{type: RNG_UNLIMITED, hasAmount: false},
];

Parser.spComponentsToFull = function (comp, level) {
	if (!comp) return "None";
	const out = [];
	if (comp.v) out.push("V");
	if (comp.s) out.push("S");
	if (comp.m != null) out.push(`M${comp.m !== true ? ` (${comp.m.text != null ? comp.m.text : comp.m})` : ""}`);
	if (comp.r) out.push(`R (${level} gp)`);
	return out.join(", ") || "None";
};

Parser.SP_END_TYPE_TO_FULL = {
	"dispel": "dispelled",
	"trigger": "triggered",
	"discharge": "discharged",
};
Parser.spEndTypeToFull = function (type) {
	return Parser._parse_aToB(Parser.SP_END_TYPE_TO_FULL, type);
};

Parser.spDurationToFull = function (dur) {
	let hasSubOr = false;
	const outParts = dur.map(d => {
		switch (d.type) {
			case "special":
				return "Special";
			case "instant":
				return `Instantaneous${d.condition ? ` (${d.condition})` : ""}`;
			case "timed":
				return `${d.concentration ? "Concentration, " : ""}${d.concentration ? "u" : d.duration.upTo ? "U" : ""}${d.concentration || d.duration.upTo ? "p to " : ""}${d.duration.amount} ${d.duration.amount === 1 ? d.duration.type : `${d.duration.type}s`}`;
			case "permanent": {
				if (d.ends) {
					const endsToJoin = d.ends.map(m => Parser.spEndTypeToFull(m));
					hasSubOr = hasSubOr || endsToJoin.length > 1;
					return `Until ${endsToJoin.joinConjunct(", ", " or ")}`;
				} else {
					return "Permanent";
				}
			}
		}
	});
	return `${outParts.joinConjunct(hasSubOr ? "; " : ", ", " or ")}${dur.length > 1 ? " (see below)" : ""}`;
};

Parser.DURATION_TYPES = [
	{type: "instant", full: "Instantaneous"},
	{type: "timed", hasAmount: true},
	{type: "permanent", hasEnds: true},
	{type: "special"},
];

Parser.DURATION_AMOUNT_TYPES = [
	"turn",
	"round",
	"minute",
	"hour",
	"day",
	"week",
	"year",
];

Parser.spClassesToFull = function (sp, isTextOnly, subclassLookup = {}) {
	const fromSubclassList = Renderer.spell.getCombinedClasses(sp, "fromSubclass");
	const fromSubclasses = Parser.spSubclassesToFull(fromSubclassList, isTextOnly, subclassLookup);
	const fromClassList = Renderer.spell.getCombinedClasses(sp, "fromClassList");
	return `${Parser.spMainClassesToFull(fromClassList, isTextOnly)}${fromSubclasses ? `, ${fromSubclasses}` : ""}`
};

Parser.spMainClassesToFull = function (fromClassList, textOnly = false) {
	return fromClassList
		.map(c => ({hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](c), c}))
		.filter(it => !ExcludeUtil.isInitialised || !ExcludeUtil.isExcluded(it.hash, "class", it.c.source))
		.sort((a, b) => SortUtil.ascSort(a.c.name, b.c.name))
		.map(it => textOnly ? it.c.name : `<a title="${it.c.definedInSource ? `Class source` : "Source"}: ${Parser.sourceJsonToFull(it.c.source)}${it.c.definedInSource ? `. Spell list defined in: ${Parser.sourceJsonToFull(it.c.definedInSource)}.` : ""}" href="${UrlUtil.PG_CLASSES}#${it.hash}">${it.c.name}</a>`)
		.join(", ") || "";
};

Parser.spSubclassesToFull = function (fromSubclassList, textOnly, subclassLookup = {}) {
	return fromSubclassList
		.filter(mt => {
			if (!ExcludeUtil.isInitialised) return true;
			const excludeClass = ExcludeUtil.isExcluded(UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](mt.class), "class", mt.class.source);
			if (excludeClass) return false;
			const fromLookup = MiscUtil.get(subclassLookup, mt.class.source, mt.class.name, mt.subclass.source, mt.subclass.name);
			if (!fromLookup) return true;
			const excludeSubclass = ExcludeUtil.isExcluded(
				UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES]({name: fromLookup.name || mt.subclass.name, source: mt.subclass.source}),
				"subclass",
				mt.subclass.source,
			);
			return !excludeSubclass;
		})
		.sort((a, b) => {
			const byName = SortUtil.ascSort(a.class.name, b.class.name);
			return byName || SortUtil.ascSort(a.subclass.name, b.subclass.name);
		})
		.map(c => Parser._spSubclassItem({fromSubclass: c, textOnly, subclassLookup}))
		.join(", ") || "";
};

Parser._spSubclassItem = function ({fromSubclass, textOnly, subclassLookup}) {
	const c = fromSubclass.class;
	const sc = fromSubclass.subclass;
	const text = `${sc.name}${sc.subSubclass ? ` (${sc.subSubclass})` : ""}`;
	if (textOnly) return text;
	const classPart = `<a href="${UrlUtil.PG_CLASSES}#${UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](c)}" title="Source: ${Parser.sourceJsonToFull(c.source)}${c.definedInSource ? ` From a class spell list defined in: ${Parser.sourceJsonToFull(c.definedInSource)}` : ""}">${c.name}</a>`;
	const fromLookup = subclassLookup ? MiscUtil.get(subclassLookup, c.source, c.name, sc.source, sc.name) : null;
	if (fromLookup) return `<a class="italic" href="${UrlUtil.PG_CLASSES}#${UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](c)}${HASH_PART_SEP}${UrlUtil.getClassesPageStatePart({subclass: {shortName: sc.name, source: sc.source}})}" title="Source: ${Parser.sourceJsonToFull(fromSubclass.subclass.source)}">${text}</a> ${classPart}`;
	else return `<span class="italic" title="Source: ${Parser.sourceJsonToFull(fromSubclass.subclass.source)}">${text}</span> ${classPart}`;
};

Parser.SPELL_ATTACK_TYPE_TO_FULL = {};
Parser.SPELL_ATTACK_TYPE_TO_FULL["M"] = "Melee";
Parser.SPELL_ATTACK_TYPE_TO_FULL["R"] = "Ranged";
Parser.SPELL_ATTACK_TYPE_TO_FULL["O"] = "Other/Unknown";

Parser.spAttackTypeToFull = function (type) {
	return Parser._parse_aToB(Parser.SPELL_ATTACK_TYPE_TO_FULL, type);
};

Parser.SPELL_AREA_TYPE_TO_FULL = {
	ST: "Single Target",
	MT: "Multiple Targets",
	C: "Cube",
	N: "Cone",
	Y: "Cylinder",
	S: "Sphere",
	R: "Circle",
	Q: "Square",
	L: "Line",
	H: "Hemisphere",
	W: "Wall",
};
Parser.spAreaTypeToFull = function (type) {
	return Parser._parse_aToB(Parser.SPELL_AREA_TYPE_TO_FULL, type);
};

Parser.SP_MISC_TAG_TO_FULL = {
	HL: "Healing",
	THP: "Grants Temporary Hit Points",
	SGT: "Requires Sight",
	PRM: "Permanent Effects",
	SCL: "Scaling Effects",
	SMN: "Summons Creature",
	MAC: "Modifies AC",
	TP: "Teleportation",
	FMV: "Forced Movement",
};
Parser.spMiscTagToFull = function (type) {
	return Parser._parse_aToB(Parser.SP_MISC_TAG_TO_FULL, type);
};

Parser.SP_CASTER_PROGRESSION_TO_FULL = {
	full: "Full",
	"1/2": "Half",
	"1/3": "One-Third",
	"pact": "Pact Magic",
};
Parser.spCasterProgressionToFull = function (type) {
	return Parser._parse_aToB(Parser.SP_CASTER_PROGRESSION_TO_FULL, type);
};

// mon-prefix functions are for parsing monster data, and shared with the roll20 script
Parser.monTypeToFullObj = function (type) {
	const out = {type: "", tags: [], asText: ""};

	if (typeof type === "string") {
		// handles e.g. "fey"
		out.type = type;
		out.asText = type;
		return out;
	}

	const tempTags = [];
	if (type.tags) {
		for (const tag of type.tags) {
			if (typeof tag === "string") {
				// handles e.g. "fiend (devil)"
				out.tags.push(tag);
				tempTags.push(tag);
			} else {
				// handles e.g. "humanoid (Chondathan human)"
				out.tags.push(tag.tag);
				tempTags.push(`${tag.prefix} ${tag.tag}`);
			}
		}
	}
	out.type = type.type;
	if (type.swarmSize) {
		out.tags.push("swarm");
		out.asText = `swarm of ${Parser.sizeAbvToFull(type.swarmSize).toLowerCase()} ${Parser.monTypeToPlural(type.type)}`;
		out.swarmSize = type.swarmSize;
	} else {
		out.asText = `${type.type}`;
	}
	if (tempTags.length) out.asText += ` (${tempTags.join(", ")})`;
	return out;
};

Parser.monTypeToPlural = function (type) {
	return Parser._parse_aToB(Parser.MON_TYPE_TO_PLURAL, type);
};

Parser.monTypeFromPlural = function (type) {
	return Parser._parse_bToA(Parser.MON_TYPE_TO_PLURAL, type);
};

Parser.monCrToFull = function (cr, {xp = null, isMythic = false} = {}) {
	if (cr == null) return "";

	if (typeof cr === "string") {
		if (Parser.crToNumber(cr) >= VeCt.CR_CUSTOM) return `${cr}${xp != null ? ` (${xp} XP)` : ""}`;

		xp = xp != null ? Parser._addCommas(xp) : Parser.crToXp(cr);
		return `${cr} (${xp} XP${isMythic ? `, or ${Parser.crToXp(cr, {isDouble: true})} XP as a mythic encounter` : ""})`;
	} else {
		const stack = [Parser.monCrToFull(cr.cr, {xp: cr.xp, isMythic})];
		if (cr.lair) stack.push(`${Parser.monCrToFull(cr.lair)} when encountered in lair`);
		if (cr.coven) stack.push(`${Parser.monCrToFull(cr.coven)} when part of a coven`);
		return stack.joinConjunct(", ", " or ");
	}
};

Parser.getFullImmRes = function (toParse) {
	if (!toParse.length) return "";

	let maxDepth = 0;

	function toString (it, depth = 0) {
		maxDepth = Math.max(maxDepth, depth);
		if (typeof it === "string") {
			return it;
		} else if (it.special) {
			return it.special;
		} else {
			const stack = [];

			if (it.preNote) stack.push(it.preNote);

			const prop = it.immune ? "immune" : it.resist ? "resist" : it.vulnerable ? "vulnerable" : null;
			if (prop) {
				const toJoin = it[prop].map(nxt => toString(nxt, depth + 1));
				stack.push(depth ? toJoin.join(maxDepth ? "; " : ", ") : toJoin.joinConjunct(", ", " and "));
			}

			if (it.note) stack.push(it.note);

			return stack.join(" ");
		}
	}

	const arr = toParse.map(it => toString(it));

	if (arr.length <= 1) return arr.join("");

	let out = "";
	for (let i = 0; i < arr.length - 1; ++i) {
		const it = arr[i];
		const nxt = arr[i + 1];

		const orig = toParse[i];
		const origNxt = toParse[i + 1];

		out += it;
		out += (it.includes(",") || nxt.includes(",") || (orig && orig.cond) || (origNxt && origNxt.cond)) ? "; " : ", ";
	}
	out += arr.last();
	return out;
};

Parser.getFullCondImm = function (condImm, isPlainText) {
	function render (condition) {
		return isPlainText ? condition : Renderer.get().render(`{@condition ${condition}}`);
	}
	return condImm.map(it => {
		if (it.special) return it.special;
		if (it.conditionImmune) return `${it.preNote ? `${it.preNote} ` : ""}${it.conditionImmune.map(render).join(", ")}${it.note ? ` ${it.note}` : ""}`;
		return render(it);
	}).sort(SortUtil.ascSortLower).join(", ");
};

Parser.MON_SENSE_TAG_TO_FULL = {
	"B": "blindsight",
	"D": "darkvision",
	"SD": "superior darkvision",
	"T": "tremorsense",
	"U": "truesight",
};
Parser.monSenseTagToFull = function (tag) {
	return Parser._parse_aToB(Parser.MON_SENSE_TAG_TO_FULL, tag);
};

Parser.MON_SPELLCASTING_TAG_TO_FULL = {
	"P": "Psionics",
	"I": "Innate",
	"F": "Form Only",
	"S": "Shared",
	"CA": "Class, Artificer",
	"CB": "Class, Bard",
	"CC": "Class, Cleric",
	"CD": "Class, Druid",
	"CP": "Class, Paladin",
	"CR": "Class, Ranger",
	"CS": "Class, Sorcerer",
	"CL": "Class, Warlock",
	"CW": "Class, Wizard",
};
Parser.monSpellcastingTagToFull = function (tag) {
	return Parser._parse_aToB(Parser.MON_SPELLCASTING_TAG_TO_FULL, tag);
};

Parser.MON_MISC_TAG_TO_FULL = {
	"AOE": "Has Areas of Effect",
	"MW": "Has Weapon Attacks, Melee",
	"RW": "Has Weapon Attacks, Ranged",
	"RNG": "Has Ranged Weapons",
	"RCH": "Has Reach Attacks",
	"THW": "Has Thrown Weapons",
};
Parser.monMiscTagToFull = function (tag) {
	return Parser._parse_aToB(Parser.MON_MISC_TAG_TO_FULL, tag);
};

Parser.MON_LANGUAGE_TAG_TO_FULL = {
	"AB": "Abyssal",
	"AQ": "Aquan",
	"AU": "Auran",
	"C": "Common",
	"CE": "Celestial",
	"CS": "Can't Speak Known Languages",
	"D": "Dwarvish",
	"DR": "Draconic",
	"DS": "Deep Speech",
	"DU": "Druidic",
	"E": "Elvish",
	"G": "Gnomish",
	"GI": "Giant",
	"GO": "Goblin",
	"GTH": "Gith",
	"H": "Halfling",
	"I": "Infernal",
	"IG": "Ignan",
	"LF": "Languages Known in Life",
	"O": "Orc",
	"OTH": "Other",
	"P": "Primordial",
	"S": "Sylvan",
	"T": "Terran",
	"TC": "Thieves' cant",
	"TP": "Telepathy",
	"U": "Undercommon",
	"X": "Any (Choose)",
	"XX": "All",
};
Parser.monLanguageTagToFull = function (tag) {
	return Parser._parse_aToB(Parser.MON_LANGUAGE_TAG_TO_FULL, tag);
};

Parser.ENVIRONMENTS = ["arctic", "coastal", "desert", "forest", "grassland", "hill", "mountain", "swamp", "underdark", "underwater", "urban"];

// psi-prefix functions are for parsing psionic data, and shared with the roll20 script
Parser.PSI_ABV_TYPE_TALENT = "T";
Parser.PSI_ABV_TYPE_DISCIPLINE = "D";
Parser.PSI_ORDER_NONE = "None";
Parser.psiTypeToFull = type => Parser.psiTypeToMeta(type).full;

Parser.psiTypeToMeta = type => {
	let out = {};
	if (type === Parser.PSI_ABV_TYPE_TALENT) out = {hasOrder: false, full: "Talent"};
	else if (type === Parser.PSI_ABV_TYPE_DISCIPLINE) out = {hasOrder: true, full: "Discipline"};
	else if (BrewUtil.homebrewMeta && BrewUtil.homebrewMeta.psionicTypes && BrewUtil.homebrewMeta.psionicTypes[type]) out = BrewUtil.homebrewMeta.psionicTypes[type];
	out.full = out.full || "Unknown";
	out.short = out.short || out.full;
	return out;
};

Parser.psiOrderToFull = (order) => {
	return order === undefined ? Parser.PSI_ORDER_NONE : order;
};

Parser.prereqSpellToFull = function (spell, {isTextOnly = false} = {}) {
	if (spell) {
		const [text, suffix] = spell.split("#");
		if (!suffix) return isTextOnly ? spell : Renderer.get().render(`{@spell ${spell}}`);
		else if (suffix === "c") return (isTextOnly ? Renderer.stripTags : Renderer.get().render.bind(Renderer.get()))(`{@spell ${text}} cantrip`);
		else if (suffix === "x") return (isTextOnly ? Renderer.stripTags : Renderer.get().render.bind(Renderer.get()))("{@spell hex} spell or a warlock feature that curses");
	} else return VeCt.STR_NONE;
};

Parser.prereqPactToFull = function (pact) {
	if (pact === "Chain") return "Pact of the Chain";
	if (pact === "Tome") return "Pact of the Tome";
	if (pact === "Blade") return "Pact of the Blade";
	if (pact === "Talisman") return "Pact of the Talisman";
	return pact;
};

Parser.prereqPatronToShort = function (patron) {
	if (patron === "Any") return patron;
	const mThe = /^The (.*?)$/.exec(patron);
	if (mThe) return mThe[1];
	return patron;
};

// NOTE: These need to be reflected in omnidexer.js to be indexed
Parser.OPT_FEATURE_TYPE_TO_FULL = {
	AI: "Artificer Infusion",
	ED: "Elemental Discipline",
	EI: "Eldritch Invocation",
	MM: "Metamagic",
	"MV": "Maneuver",
	"MV:B": "Maneuver, Battle Master",
	"MV:C2-UA": "Maneuver, Cavalier V2 (UA)",
	"AS:V1-UA": "Arcane Shot, V1 (UA)",
	"AS:V2-UA": "Arcane Shot, V2 (UA)",
	"AS": "Arcane Shot",
	OTH: "Other",
	"FS:F": "Fighting Style; Fighter",
	"FS:B": "Fighting Style; Bard",
	"FS:P": "Fighting Style; Paladin",
	"FS:R": "Fighting Style; Ranger",
	"PB": "Pact Boon",
	"OR": "Onomancy Resonant",
	"RN": "Rune Knight Rune",
	"AF": "Alchemical Formula",
};

Parser.optFeatureTypeToFull = function (type) {
	if (Parser.OPT_FEATURE_TYPE_TO_FULL[type]) return Parser.OPT_FEATURE_TYPE_TO_FULL[type];
	if (BrewUtil.homebrewMeta && BrewUtil.homebrewMeta.optionalFeatureTypes && BrewUtil.homebrewMeta.optionalFeatureTypes[type]) return BrewUtil.homebrewMeta.optionalFeatureTypes[type];
	return type;
};

Parser.CHAR_OPTIONAL_FEATURE_TYPE_TO_FULL = {
	"SG": "Supernatural Gift",
	"OF": "Optional Feature",
	"DG": "Dark Gift",
	"RF:B": "Replacement Feature: Background",
};

Parser.charCreationOptionTypeToFull = function (type) {
	if (Parser.CHAR_OPTIONAL_FEATURE_TYPE_TO_FULL[type]) return Parser.CHAR_OPTIONAL_FEATURE_TYPE_TO_FULL[type];
	if (BrewUtil.homebrewMeta && BrewUtil.homebrewMeta.charOption && BrewUtil.homebrewMeta.charOption[type]) return BrewUtil.homebrewMeta.charOption[type];
	return type;
};

Parser.alignmentAbvToFull = function (alignment) {
	if (!alignment) return null; // used in sidekicks
	if (typeof alignment === "object") {
		if (alignment.special != null) {
			// use in MTF Sacred Statue
			return alignment.special;
		} else {
			// e.g. `{alignment: ["N", "G"], chance: 50}` or `{alignment: ["N", "G"]}`
			return `${alignment.alignment.map(a => Parser.alignmentAbvToFull(a)).join(" ")}${alignment.chance ? ` (${alignment.chance}%)` : ""}${alignment.note ? ` (${alignment.note})` : ""}`;
		}
	} else {
		alignment = alignment.toUpperCase();
		switch (alignment) {
			case "L":
				return "lawful";
			case "N":
				return "neutral";
			case "NX":
				return "neutral (law/chaos axis)";
			case "NY":
				return "neutral (good/evil axis)";
			case "C":
				return "chaotic";
			case "G":
				return "good";
			case "E":
				return "evil";
			// "special" values
			case "U":
				return "unaligned";
			case "A":
				return "any alignment";
		}
		return alignment;
	}
};

Parser.alignmentListToFull = function (alignList) {
	if (alignList.some(it => typeof it !== "string")) {
		if (alignList.some(it => typeof it === "string")) throw new Error(`Mixed alignment types: ${JSON.stringify(alignList)}`);
		// filter out any nonexistent alignments, as we don't care about "alignment does not exist" if there are other alignments
		alignList = alignList.filter(it => it.alignment === undefined || it.alignment != null);
		return alignList.map(it => it.special != null || it.chance != null || it.note != null ? Parser.alignmentAbvToFull(it) : Parser.alignmentListToFull(it.alignment)).join(" or ");
	} else {
		// assume all single-length arrays can be simply parsed
		if (alignList.length === 1) return Parser.alignmentAbvToFull(alignList[0]);
		// a pair of abv's, e.g. "L" "G"
		if (alignList.length === 2) {
			return alignList.map(a => Parser.alignmentAbvToFull(a)).join(" ");
		}
		if (alignList.length === 3) {
			if (alignList.includes("NX") && alignList.includes("NY") && alignList.includes("N")) return "any neutral alignment";
		}
		// longer arrays should have a custom mapping
		if (alignList.length === 5) {
			if (!alignList.includes("G")) return "any non-good alignment";
			if (!alignList.includes("E")) return "any non-evil alignment";
			if (!alignList.includes("L")) return "any non-lawful alignment";
			if (!alignList.includes("C")) return "any non-chaotic alignment";
		}
		if (alignList.length === 4) {
			if (!alignList.includes("L") && !alignList.includes("NX")) return "any chaotic alignment";
			if (!alignList.includes("G") && !alignList.includes("NY")) return "any evil alignment";
			if (!alignList.includes("C") && !alignList.includes("NX")) return "any lawful alignment";
			if (!alignList.includes("E") && !alignList.includes("NY")) return "any good alignment";
		}
		throw new Error(`Unmapped alignment: ${JSON.stringify(alignList)}`);
	}
};

Parser.weightToFull = function (lbs, isSmallUnit) {
	const tons = Math.floor(lbs / 2000);
	lbs = lbs - (2000 * tons);
	return [
		tons ? `${tons}${isSmallUnit ? `<span class="ve-small ml-1">` : " "}ton${tons === 1 ? "" : "s"}${isSmallUnit ? `</span>` : ""}` : null,
		lbs ? `${lbs}${isSmallUnit ? `<span class="ve-small ml-1">` : " "}lb.${isSmallUnit ? `</span>` : ""}` : null,
	].filter(Boolean).join(", ");
};

Parser.RARITIES = ["common", "uncommon", "rare", "very rare", "legendary", "artifact"];
Parser.ITEM_RARITIES = ["none", ...Parser.RARITIES, "unknown", "unknown (magic)", "other"];

Parser.CAT_ID_CREATURE = 1;
Parser.CAT_ID_SPELL = 2;
Parser.CAT_ID_BACKGROUND = 3;
Parser.CAT_ID_ITEM = 4;
Parser.CAT_ID_CLASS = 5;
Parser.CAT_ID_CONDITION = 6;
Parser.CAT_ID_FEAT = 7;
Parser.CAT_ID_ELDRITCH_INVOCATION = 8;
Parser.CAT_ID_PSIONIC = 9;
Parser.CAT_ID_RACE = 10;
Parser.CAT_ID_OTHER_REWARD = 11;
Parser.CAT_ID_VARIANT_OPTIONAL_RULE = 12;
Parser.CAT_ID_ADVENTURE = 13;
Parser.CAT_ID_DEITY = 14;
Parser.CAT_ID_OBJECT = 15;
Parser.CAT_ID_TRAP = 16;
Parser.CAT_ID_HAZARD = 17;
Parser.CAT_ID_QUICKREF = 18;
Parser.CAT_ID_CULT = 19;
Parser.CAT_ID_BOON = 20;
Parser.CAT_ID_DISEASE = 21;
Parser.CAT_ID_METAMAGIC = 22;
Parser.CAT_ID_MANEUVER_BATTLEMASTER = 23;
Parser.CAT_ID_TABLE = 24;
Parser.CAT_ID_TABLE_GROUP = 25;
Parser.CAT_ID_MANEUVER_CAVALIER = 26;
Parser.CAT_ID_ARCANE_SHOT = 27;
Parser.CAT_ID_OPTIONAL_FEATURE_OTHER = 28;
Parser.CAT_ID_FIGHTING_STYLE = 29;
Parser.CAT_ID_CLASS_FEATURE = 30;
Parser.CAT_ID_VEHICLE = 31;
Parser.CAT_ID_PACT_BOON = 32;
Parser.CAT_ID_ELEMENTAL_DISCIPLINE = 33;
Parser.CAT_ID_ARTIFICER_INFUSION = 34;
Parser.CAT_ID_SHIP_UPGRADE = 35;
Parser.CAT_ID_INFERNAL_WAR_MACHINE_UPGRADE = 36;
Parser.CAT_ID_ONOMANCY_RESONANT = 37;
Parser.CAT_ID_RUNE_KNIGHT_RUNE = 37;
Parser.CAT_ID_ALCHEMICAL_FORMULA = 38;
Parser.CAT_ID_MANEUVER = 39;
Parser.CAT_ID_SUBCLASS = 40;
Parser.CAT_ID_SUBCLASS_FEATURE = 41;
Parser.CAT_ID_ACTION = 42;
Parser.CAT_ID_LANGUAGE = 43;
Parser.CAT_ID_BOOK = 44;
Parser.CAT_ID_PAGE = 45;
Parser.CAT_ID_LEGENDARY_GROUP = 46;
Parser.CAT_ID_CHAR_CREATION_OPTIONS = 47;
Parser.CAT_ID_RECIPES = 48;

Parser.CAT_ID_TO_FULL = {};
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_CREATURE] = "Bestiary";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_SPELL] = "Spell";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_BACKGROUND] = "Background";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_ITEM] = "Item";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_CLASS] = "Class";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_CONDITION] = "Condition";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_FEAT] = "Feat";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_ELDRITCH_INVOCATION] = "Eldritch Invocation";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_PSIONIC] = "Psionic";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_RACE] = "Race";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_OTHER_REWARD] = "Other Reward";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_VARIANT_OPTIONAL_RULE] = "Variant/Optional Rule";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_ADVENTURE] = "Adventure";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_DEITY] = "Deity";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_OBJECT] = "Object";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_TRAP] = "Trap";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_HAZARD] = "Hazard";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_QUICKREF] = "Quick Reference";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_CULT] = "Cult";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_BOON] = "Boon";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_DISEASE] = "Disease";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_METAMAGIC] = "Metamagic";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_MANEUVER_BATTLEMASTER] = "Maneuver; Battlemaster";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_TABLE] = "Table";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_TABLE_GROUP] = "Table";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_MANEUVER_CAVALIER] = "Maneuver; Cavalier";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_ARCANE_SHOT] = "Arcane Shot";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_OPTIONAL_FEATURE_OTHER] = "Optional Feature";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_FIGHTING_STYLE] = "Fighting Style";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_CLASS_FEATURE] = "Class Feature";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_VEHICLE] = "Vehicle";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_PACT_BOON] = "Pact Boon";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_ELEMENTAL_DISCIPLINE] = "Elemental Discipline";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_ARTIFICER_INFUSION] = "Infusion";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_SHIP_UPGRADE] = "Ship Upgrade";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_INFERNAL_WAR_MACHINE_UPGRADE] = "Infernal War Machine Upgrade";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_ONOMANCY_RESONANT] = "Onomancy Resonant";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_RUNE_KNIGHT_RUNE] = "Rune Knight Rune";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_ALCHEMICAL_FORMULA] = "Alchemical Formula";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_MANEUVER] = "Maneuver";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_SUBCLASS] = "Subclass";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_SUBCLASS_FEATURE] = "Subclass Feature";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_ACTION] = "Action";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_LANGUAGE] = "Language";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_BOOK] = "Book";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_PAGE] = "Page";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_LEGENDARY_GROUP] = "Legendary Group";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_CHAR_CREATION_OPTIONS] = "Character Creation Option";
Parser.CAT_ID_TO_FULL[Parser.CAT_ID_RECIPES] = "Recipe";

Parser.pageCategoryToFull = function (catId) {
	return Parser._parse_aToB(Parser.CAT_ID_TO_FULL, catId);
};

Parser.CAT_ID_TO_PROP = {};
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_CREATURE] = "monster";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_SPELL] = "spell";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_BACKGROUND] = "background";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_ITEM] = "item";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_CLASS] = "class";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_CONDITION] = "condition";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_FEAT] = "feat";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_PSIONIC] = "psionic";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_RACE] = "race";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_OTHER_REWARD] = "reward";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_VARIANT_OPTIONAL_RULE] = "variantrule";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_ADVENTURE] = "adventure";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_DEITY] = "deity";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_OBJECT] = "object";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_TRAP] = "trap";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_HAZARD] = "hazard";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_CULT] = "cult";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_BOON] = "boon";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_DISEASE] = "condition";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_TABLE] = "table";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_TABLE_GROUP] = "tableGroup";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_VEHICLE] = "vehicle";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_ELDRITCH_INVOCATION] = "optionalfeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_MANEUVER_CAVALIER] = "optionalfeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_ARCANE_SHOT] = "optionalfeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_OPTIONAL_FEATURE_OTHER] = "optionalfeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_FIGHTING_STYLE] = "optionalfeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_METAMAGIC] = "optionalfeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_MANEUVER_BATTLEMASTER] = "optionalfeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_PACT_BOON] = "optionalfeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_ELEMENTAL_DISCIPLINE] = "optionalfeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_ARTIFICER_INFUSION] = "optionalfeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_SHIP_UPGRADE] = "vehicleUpgrade";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_INFERNAL_WAR_MACHINE_UPGRADE] = "vehicleUpgrade";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_ONOMANCY_RESONANT] = "optionalfeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_RUNE_KNIGHT_RUNE] = "optionalfeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_ALCHEMICAL_FORMULA] = "optionalfeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_MANEUVER] = "optionalfeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_QUICKREF] = null;
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_CLASS_FEATURE] = "classFeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_SUBCLASS] = "subclass";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_SUBCLASS_FEATURE] = "subclassFeature";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_ACTION] = "action";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_LANGUAGE] = "language";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_BOOK] = "book";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_PAGE] = null;
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_LEGENDARY_GROUP] = null;
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_CHAR_CREATION_OPTIONS] = "charoption";
Parser.CAT_ID_TO_PROP[Parser.CAT_ID_RECIPES] = "recipe";

Parser.pageCategoryToProp = function (catId) {
	return Parser._parse_aToB(Parser.CAT_ID_TO_PROP, catId);
};

Parser.ABIL_ABVS = ["str", "dex", "con", "int", "wis", "cha"];

Parser.spClassesToCurrentAndLegacy = function (fromClassList) {
	const current = [];
	const legacy = [];
	fromClassList.forEach(cls => {
		if ((cls.name === "Artificer" && cls.source === "UAArtificer") || (cls.name === "Artificer (Revisited)" && cls.source === "UAArtificerRevisited")) legacy.push(cls);
		else current.push(cls);
	});
	return [current, legacy];
};

/**
 * Build a pair of strings; one with all current subclasses, one with all legacy subclasses
 *
 * @param sp a spell
 * @param subclassLookup Data loaded from `generated/gendata-subclass-lookup.json`. Of the form: `{PHB: {Barbarian: {PHB: {Berserker: "Path of the Berserker"}}}}`
 * @returns {*[]} A two-element array. First item is a string of all the current subclasses, second item a string of
 * all the legacy/superseded subclasses
 */
Parser.spSubclassesToCurrentAndLegacyFull = function (sp, subclassLookup) {
	return Parser._spSubclassesToCurrentAndLegacyFull({sp, subclassLookup, prop: "fromSubclass"});
};

Parser.spVariantSubclassesToCurrentAndLegacyFull = function (sp, subclassLookup) {
	return Parser._spSubclassesToCurrentAndLegacyFull({sp, subclassLookup, prop: "fromSubclassVariant"});
};

Parser._spSubclassesToCurrentAndLegacyFull = ({sp, subclassLookup, prop}) => {
	const fromSubclass = Renderer.spell.getCombinedClasses(sp, prop);
	if (!fromSubclass.length) return ["", ""];

	const current = [];
	const legacy = [];
	const curNames = new Set();
	const toCheck = [];
	fromSubclass
		.filter(c => {
			const excludeClass = ExcludeUtil.isExcluded(
				UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES]({name: c.class.name, source: c.class.source}),
				"class",
				c.class.source,
				{isNoCount: true},
			);
			if (excludeClass) return false;

			const fromLookup = MiscUtil.get(subclassLookup, c.class.source, c.class.name, c.subclass.source, c.subclass.name);
			const excludeSubclass = ExcludeUtil.isExcluded(
				UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES]({name: (fromLookup || {}).name || c.subclass.name, source: c.subclass.source}),
				"subclass",
				c.subclass.source,
				{isNoCount: true},
			);
			if (excludeSubclass) return false;

			return !Renderer.spell.isExcludedSubclassVariantSource({classDefinedInSource: c.class.definedInSource});
		})
		.sort((a, b) => {
			const byName = SortUtil.ascSort(a.subclass.name, b.subclass.name);
			return byName || SortUtil.ascSort(a.class.name, b.class.name);
		})
		.forEach(c => {
			const nm = c.subclass.name;
			const src = c.subclass.source;

			const toAdd = Parser._spSubclassItem({fromSubclass: c, textOnly: false, subclassLookup});

			const fromLookup = MiscUtil.get(
				subclassLookup,
				c.class.source,
				c.class.name,
				c.subclass.source,
				c.subclass.name,
			);

			if (fromLookup && fromLookup.isReprinted) {
				legacy.push(toAdd);
			} else if (SourceUtil.isNonstandardSource(src)) {
				const cleanName = Parser._spSubclassesToCurrentAndLegacyFull.mapClassShortNameToMostRecent(
					nm.split("(")[0].trim().split(/v\d+/)[0].trim(),
				);
				toCheck.push({"name": cleanName, "ele": toAdd});
			} else {
				current.push(toAdd);
				curNames.add(nm);
			}
		});

	toCheck.forEach(n => {
		if (curNames.has(n.name)) {
			legacy.push(n.ele);
		} else {
			current.push(n.ele);
		}
	});

	return [current.join(", "), legacy.join(", ")];
};

/**
 * Get the most recent iteration of a subclass name.
 */
Parser._spSubclassesToCurrentAndLegacyFull.mapClassShortNameToMostRecent = (shortName) => {
	switch (shortName) {
		case "Favored Soul": return "Divine Soul";
		case "Undying Light": return "Celestial";
		case "Deep Stalker": return "Gloom Stalker";
	}
	return shortName;
};

Parser.spVariantClassesToCurrentAndLegacy = function (fromVariantClassList) {
	const current = [];
	const legacy = [];
	fromVariantClassList.forEach(cls => {
		if (cls.definedInSource === SRC_UACFV) legacy.push(cls);
		else current.push(cls);
	});
	return [current, legacy];
}

Parser.attackTypeToFull = function (attackType) {
	return Parser._parse_aToB(Parser.ATK_TYPE_TO_FULL, attackType);
};

Parser.trapHazTypeToFull = function (type) {
	return Parser._parse_aToB(Parser.TRAP_HAZARD_TYPE_TO_FULL, type);
};

Parser.TRAP_HAZARD_TYPE_TO_FULL = {
	MECH: "Mechanical trap",
	MAG: "Magical trap",
	SMPL: "Simple trap",
	CMPX: "Complex trap",
	HAZ: "Hazard",
	WTH: "Weather",
	ENV: "Environmental Hazard",
	WLD: "Wilderness Hazard",
	GEN: "Generic",
	EST: "Eldritch Storm",
};

Parser.tierToFullLevel = function (tier) {
	return Parser._parse_aToB(Parser.TIER_TO_FULL_LEVEL, tier);
};

Parser.TIER_TO_FULL_LEVEL = {};
Parser.TIER_TO_FULL_LEVEL[1] = "level 1\u20134";
Parser.TIER_TO_FULL_LEVEL[2] = "level 5\u201310";
Parser.TIER_TO_FULL_LEVEL[3] = "level 11\u201316";
Parser.TIER_TO_FULL_LEVEL[4] = "level 17\u201320";

Parser.trapInitToFull = function (init) {
	return Parser._parse_aToB(Parser.TRAP_INIT_TO_FULL, init);
};

Parser.TRAP_INIT_TO_FULL = {};
Parser.TRAP_INIT_TO_FULL[1] = "initiative count 10";
Parser.TRAP_INIT_TO_FULL[2] = "initiative count 20";
Parser.TRAP_INIT_TO_FULL[3] = "initiative count 20 and initiative count 10";

Parser.ATK_TYPE_TO_FULL = {};
Parser.ATK_TYPE_TO_FULL["MW"] = "Melee Weapon Attack";
Parser.ATK_TYPE_TO_FULL["RW"] = "Ranged Weapon Attack";

Parser.bookOrdinalToAbv = (ordinal, preNoSuff) => {
	if (ordinal === undefined) return "";
	switch (ordinal.type) {
		case "part": return `${preNoSuff ? " " : ""}Part ${ordinal.identifier}${preNoSuff ? "" : " \u2014 "}`;
		case "chapter": return `${preNoSuff ? " " : ""}Ch. ${ordinal.identifier}${preNoSuff ? "" : ": "}`;
		case "episode": return `${preNoSuff ? " " : ""}Ep. ${ordinal.identifier}${preNoSuff ? "" : ": "}`;
		case "appendix": return `${preNoSuff ? " " : ""}App.${ordinal.identifier != null ? ` ${ordinal.identifier}` : ""}${preNoSuff ? "" : ": "}`;
		case "level": return `${preNoSuff ? " " : ""}Level ${ordinal.identifier}${preNoSuff ? "" : ": "}`;
		default: throw new Error(`Unhandled ordinal type "${ordinal.type}"`);
	}
};

Parser.nameToTokenName = function (name) {
	return name
		.toAscii()
		.replace(/"/g, "");
};

Parser.bytesToHumanReadable = function (bytes, {fixedDigits = 2} = {}) {
	if (bytes == null) return "";
	if (!bytes) return "0 B";
	const e = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / Math.pow(1024, e)).toFixed(fixedDigits)} ${`\u200bKMGTP`.charAt(e)}B`;
};

SKL_ABV_ABJ = "A";
SKL_ABV_EVO = "V";
SKL_ABV_ENC = "E";
SKL_ABV_ILL = "I";
SKL_ABV_DIV = "D";
SKL_ABV_NEC = "N";
SKL_ABV_TRA = "T";
SKL_ABV_CON = "C";
SKL_ABV_PSI = "P";
Parser.SKL_ABVS = [
	SKL_ABV_ABJ,
	SKL_ABV_CON,
	SKL_ABV_DIV,
	SKL_ABV_ENC,
	SKL_ABV_EVO,
	SKL_ABV_ILL,
	SKL_ABV_NEC,
	SKL_ABV_PSI,
	SKL_ABV_TRA,
];

Parser.SP_TM_ACTION = "action";
Parser.SP_TM_B_ACTION = "bonus";
Parser.SP_TM_REACTION = "reaction";
Parser.SP_TM_ROUND = "round";
Parser.SP_TM_MINS = "minute";
Parser.SP_TM_HRS = "hour";
Parser.SP_TIME_SINGLETONS = [Parser.SP_TM_ACTION, Parser.SP_TM_B_ACTION, Parser.SP_TM_REACTION, Parser.SP_TM_ROUND];
Parser.SP_TIME_TO_FULL = {
	[Parser.SP_TM_ACTION]: "Action",
	[Parser.SP_TM_B_ACTION]: "Bonus Action",
	[Parser.SP_TM_REACTION]: "Reaction",
	[Parser.SP_TM_ROUND]: "Rounds",
	[Parser.SP_TM_MINS]: "Minutes",
	[Parser.SP_TM_HRS]: "Hours",
};
Parser.spTimeUnitToFull = function (timeUnit) {
	return Parser._parse_aToB(Parser.SP_TIME_TO_FULL, timeUnit);
};

Parser.SP_TIME_TO_SHORT = {
	[Parser.SP_TM_ROUND]: "Rnd.",
	[Parser.SP_TM_MINS]: "Min.",
	[Parser.SP_TM_HRS]: "Hr.",
}
Parser.spTimeUnitToShort = function (timeUnit) {
	return Parser._parse_aToB(Parser.SP_TIME_TO_SHORT, timeUnit);
};

Parser.SP_TIME_TO_ABV = {
	[Parser.SP_TM_ACTION]: "A",
	[Parser.SP_TM_B_ACTION]: "BA",
	[Parser.SP_TM_REACTION]: "R",
	[Parser.SP_TM_ROUND]: "rnd",
	[Parser.SP_TM_MINS]: "min",
	[Parser.SP_TM_HRS]: "hr",
};
Parser.spTimeUnitToAbv = function (timeUnit) {
	return Parser._parse_aToB(Parser.SP_TIME_TO_ABV, timeUnit);
};

Parser.spTimeToShort = function (time, isHtml) {
	if (!time) return "";
	return (time.number === 1 && Parser.SP_TIME_SINGLETONS.includes(time.unit))
		? `${Parser.spTimeUnitToAbv(time.unit).uppercaseFirst()}${time.condition ? "*" : ""}`
		: `${time.number} ${isHtml ? `<span class="ve-small">` : ""}${Parser.spTimeUnitToAbv(time.unit)}${isHtml ? `</span>` : ""}${time.condition ? "*" : ""}`;
};

SKL_ABJ = "Abjuration";
SKL_EVO = "Evocation";
SKL_ENC = "Enchantment";
SKL_ILL = "Illusion";
SKL_DIV = "Divination";
SKL_NEC = "Necromancy";
SKL_TRA = "Transmutation";
SKL_CON = "Conjuration";
SKL_PSI = "Psionic";

Parser.SP_SCHOOL_ABV_TO_FULL = {};
Parser.SP_SCHOOL_ABV_TO_FULL[SKL_ABV_ABJ] = SKL_ABJ;
Parser.SP_SCHOOL_ABV_TO_FULL[SKL_ABV_EVO] = SKL_EVO;
Parser.SP_SCHOOL_ABV_TO_FULL[SKL_ABV_ENC] = SKL_ENC;
Parser.SP_SCHOOL_ABV_TO_FULL[SKL_ABV_ILL] = SKL_ILL;
Parser.SP_SCHOOL_ABV_TO_FULL[SKL_ABV_DIV] = SKL_DIV;
Parser.SP_SCHOOL_ABV_TO_FULL[SKL_ABV_NEC] = SKL_NEC;
Parser.SP_SCHOOL_ABV_TO_FULL[SKL_ABV_TRA] = SKL_TRA;
Parser.SP_SCHOOL_ABV_TO_FULL[SKL_ABV_CON] = SKL_CON;
Parser.SP_SCHOOL_ABV_TO_FULL[SKL_ABV_PSI] = SKL_PSI;

Parser.SP_SCHOOL_ABV_TO_SHORT = {};
Parser.SP_SCHOOL_ABV_TO_SHORT[SKL_ABV_ABJ] = "Abj.";
Parser.SP_SCHOOL_ABV_TO_SHORT[SKL_ABV_EVO] = "Evoc.";
Parser.SP_SCHOOL_ABV_TO_SHORT[SKL_ABV_ENC] = "Ench.";
Parser.SP_SCHOOL_ABV_TO_SHORT[SKL_ABV_ILL] = "Illu.";
Parser.SP_SCHOOL_ABV_TO_SHORT[SKL_ABV_DIV] = "Divin.";
Parser.SP_SCHOOL_ABV_TO_SHORT[SKL_ABV_NEC] = "Necro.";
Parser.SP_SCHOOL_ABV_TO_SHORT[SKL_ABV_TRA] = "Trans.";
Parser.SP_SCHOOL_ABV_TO_SHORT[SKL_ABV_CON] = "Conj.";
Parser.SP_SCHOOL_ABV_TO_SHORT[SKL_ABV_PSI] = "Psi.";

Parser.ATB_ABV_TO_FULL = {
	"str": "Strength",
	"dex": "Dexterity",
	"con": "Constitution",
	"int": "Intelligence",
	"wis": "Wisdom",
	"cha": "Charisma",
};

TP_ABERRATION = "aberration";
TP_BEAST = "beast";
TP_CELESTIAL = "celestial";
TP_CONSTRUCT = "construct";
TP_DRAGON = "dragon";
TP_ELEMENTAL = "elemental";
TP_FEY = "fey";
TP_FIEND = "fiend";
TP_GIANT = "giant";
TP_HUMANOID = "humanoid";
TP_MONSTROSITY = "monstrosity";
TP_OOZE = "ooze";
TP_PLANT = "plant";
TP_UNDEAD = "undead";
Parser.MON_TYPES = [TP_ABERRATION, TP_BEAST, TP_CELESTIAL, TP_CONSTRUCT, TP_DRAGON, TP_ELEMENTAL, TP_FEY, TP_FIEND, TP_GIANT, TP_HUMANOID, TP_MONSTROSITY, TP_OOZE, TP_PLANT, TP_UNDEAD];
Parser.MON_TYPE_TO_PLURAL = {};
Parser.MON_TYPE_TO_PLURAL[TP_ABERRATION] = "aberrations";
Parser.MON_TYPE_TO_PLURAL[TP_BEAST] = "beasts";
Parser.MON_TYPE_TO_PLURAL[TP_CELESTIAL] = "celestials";
Parser.MON_TYPE_TO_PLURAL[TP_CONSTRUCT] = "constructs";
Parser.MON_TYPE_TO_PLURAL[TP_DRAGON] = "dragons";
Parser.MON_TYPE_TO_PLURAL[TP_ELEMENTAL] = "elementals";
Parser.MON_TYPE_TO_PLURAL[TP_FEY] = "fey";
Parser.MON_TYPE_TO_PLURAL[TP_FIEND] = "fiends";
Parser.MON_TYPE_TO_PLURAL[TP_GIANT] = "giants";
Parser.MON_TYPE_TO_PLURAL[TP_HUMANOID] = "humanoids";
Parser.MON_TYPE_TO_PLURAL[TP_MONSTROSITY] = "monstrosities";
Parser.MON_TYPE_TO_PLURAL[TP_OOZE] = "oozes";
Parser.MON_TYPE_TO_PLURAL[TP_PLANT] = "plants";
Parser.MON_TYPE_TO_PLURAL[TP_UNDEAD] = "undead";

SZ_FINE = "F";
SZ_DIMINUTIVE = "D";
SZ_TINY = "T";
SZ_SMALL = "S";
SZ_MEDIUM = "M";
SZ_LARGE = "L";
SZ_HUGE = "H";
SZ_GARGANTUAN = "G";
SZ_COLOSSAL = "C";
SZ_VARIES = "V";
Parser.SIZE_ABVS = [SZ_TINY, SZ_SMALL, SZ_MEDIUM, SZ_LARGE, SZ_HUGE, SZ_GARGANTUAN, SZ_VARIES];
Parser.SIZE_ABV_TO_FULL = {};
Parser.SIZE_ABV_TO_FULL[SZ_FINE] = "Fine";
Parser.SIZE_ABV_TO_FULL[SZ_DIMINUTIVE] = "Diminutive";
Parser.SIZE_ABV_TO_FULL[SZ_TINY] = "Tiny";
Parser.SIZE_ABV_TO_FULL[SZ_SMALL] = "Small";
Parser.SIZE_ABV_TO_FULL[SZ_MEDIUM] = "Medium";
Parser.SIZE_ABV_TO_FULL[SZ_LARGE] = "Large";
Parser.SIZE_ABV_TO_FULL[SZ_HUGE] = "Huge";
Parser.SIZE_ABV_TO_FULL[SZ_GARGANTUAN] = "Gargantuan";
Parser.SIZE_ABV_TO_FULL[SZ_COLOSSAL] = "Colossal";
Parser.SIZE_ABV_TO_FULL[SZ_VARIES] = "Varies";

Parser.XP_CHART_ALT = {
	"0": 10,
	"1/8": 25,
	"1/4": 50,
	"1/2": 100,
	"1": 200,
	"2": 450,
	"3": 700,
	"4": 1100,
	"5": 1800,
	"6": 2300,
	"7": 2900,
	"8": 3900,
	"9": 5000,
	"10": 5900,
	"11": 7200,
	"12": 8400,
	"13": 10000,
	"14": 11500,
	"15": 13000,
	"16": 15000,
	"17": 18000,
	"18": 20000,
	"19": 22000,
	"20": 25000,
	"21": 33000,
	"22": 41000,
	"23": 50000,
	"24": 62000,
	"25": 75000,
	"26": 90000,
	"27": 105000,
	"28": 120000,
	"29": 135000,
	"30": 155000,
};

Parser.ARMOR_ABV_TO_FULL = {
	"l.": "light",
	"m.": "medium",
	"h.": "heavy",
};

Parser.WEAPON_ABV_TO_FULL = {
	"s.": "simple",
	"m.": "martial",
};

Parser.CONDITION_TO_COLOR = {
	"Blinded": "#525252",
	"Charmed": "#f01789",
	"Deafened": "#ababab",
	"Exhausted": "#947a47",
	"Frightened": "#c9ca18",
	"Grappled": "#8784a0",
	"Incapacitated": "#3165a0",
	"Invisible": "#7ad2d6",
	"Paralyzed": "#c00900",
	"Petrified": "#a0a0a0",
	"Poisoned": "#4dc200",
	"Prone": "#5e60a0",
	"Restrained": "#d98000",
	"Stunned": "#a23bcb",
	"Unconscious": "#3a40ad",

	"Concentration": "#009f7a",
};

Parser.RULE_TYPE_TO_FULL = {
	"O": "Optional",
	"V": "Variant",
	"VO": "Variant Optional",
	"VV": "Variant Variant",
	"U": "Unknown",
};

Parser.ruleTypeToFull = function (ruleType) {
	return Parser._parse_aToB(Parser.RULE_TYPE_TO_FULL, ruleType);
};

Parser.VEHICLE_TYPE_TO_FULL = {
	"SHIP": "Ship",
	"INFWAR": "Infernal War Machine",
	"CREATURE": "Creature",
	"OBJECT": "Object",
	"SHP:H": "Ship Upgrade, Hull",
	"SHP:M": "Ship Upgrade, Movement",
	"SHP:W": "Ship Upgrade, Weapon",
	"SHP:F": "Ship Upgrade, Figurehead",
	"SHP:O": "Ship Upgrade, Miscellaneous",
	"IWM:W": "Infernal War Machine Variant, Weapon",
	"IWM:A": "Infernal War Machine Upgrade, Armor",
	"IWM:G": "Infernal War Machine Upgrade, Gadget",
};

Parser.vehicleTypeToFull = function (vehicleType) {
	return Parser._parse_aToB(Parser.VEHICLE_TYPE_TO_FULL, vehicleType);
};

SRC_5ETOOLS_TMP = "SRC_5ETOOLS_TMP"; // Temp source, used as a placeholder value

SRC_CoS = "CoS";
SRC_DMG = "DMG";
SRC_EEPC = "EEPC";
SRC_EET = "EET";
SRC_HotDQ = "HotDQ";
SRC_LMoP = "LMoP";
SRC_MM = "MM";
SRC_OotA = "OotA";
SRC_PHB = "PHB";
SRC_PotA = "PotA";
SRC_RoT = "RoT";
SRC_RoTOS = "RoTOS";
SRC_SCAG = "SCAG";
SRC_SKT = "SKT";
SRC_ToA = "ToA";
SRC_TLK = "TLK";
SRC_ToD = "ToD";
SRC_TTP = "TTP";
SRC_TYP = "TftYP";
SRC_TYP_AtG = "TftYP-AtG";
SRC_TYP_DiT = "TftYP-DiT";
SRC_TYP_TFoF = "TftYP-TFoF";
SRC_TYP_THSoT = "TftYP-THSoT";
SRC_TYP_TSC = "TftYP-TSC";
SRC_TYP_ToH = "TftYP-ToH";
SRC_TYP_WPM = "TftYP-WPM";
SRC_VGM = "VGM";
SRC_XGE = "XGE";
SRC_OGA = "OGA";
SRC_MTF = "MTF";
SRC_WDH = "WDH";
SRC_WDMM = "WDMM";
SRC_GGR = "GGR";
SRC_KKW = "KKW";
SRC_LLK = "LLK";
SRC_AZfyT = "AZfyT";
SRC_GoS = "GoS";
SRC_AI = "AI";
SRC_OoW = "OoW";
SRC_ESK = "ESK";
SRC_DIP = "DIP";
SRC_HftT = "HftT";
SRC_DC = "DC";
SRC_SLW = "SLW";
SRC_SDW = "SDW";
SRC_BGDIA = "BGDIA";
SRC_LR = "LR";
SRC_AL = "AL";
SRC_SAC = "SAC";
SRC_ERLW = "ERLW";
SRC_EFR = "EFR";
SRC_RMBRE = "RMBRE";
SRC_RMR = "RMR";
SRC_MFF = "MFF";
SRC_AWM = "AWM";
SRC_IMR = "IMR";
SRC_SADS = "SADS";
SRC_EGW = "EGW";
SRC_EGW_ToR = "ToR";
SRC_EGW_DD = "DD";
SRC_EGW_FS = "FS";
SRC_EGW_US = "US";
SRC_MOT = "MOT";
SRC_IDRotF = "IDRotF";
SRC_TCE = "TCE";
SRC_VRGR = "VRGR";
SRC_HoL = "HoL";
SRC_XMtS = "XMtS";
SRC_RtG = "RtG";
SRC_AitFR = "AitFR";
SRC_AitFR_ISF = "AitFR-ISF";
SRC_AitFR_THP = "AitFR-THP";
SRC_AitFR_AVT = "AitFR-AVT";
SRC_AitFR_DN = "AitFR-DN";
SRC_AitFR_FCD = "AitFR-FCD";
SRC_WBtW = "WBtW";
SRC_DoD = "DoD";
SRC_MaBJoV = "MaBJoV";
SRC_FTD = "FTD";
SRC_SCREEN = "Screen";
SRC_SCREEN_WILDERNESS_KIT = "ScreenWildernessKit";
SRC_HEROES_FEAST = "HF";
SRC_CM = "CM";

SRC_AL_PREFIX = "AL";

SRC_ALCoS = `${SRC_AL_PREFIX}CurseOfStrahd`;
SRC_ALEE = `${SRC_AL_PREFIX}ElementalEvil`;
SRC_ALRoD = `${SRC_AL_PREFIX}RageOfDemons`;

SRC_PS_PREFIX = "PS";

SRC_PSA = `${SRC_PS_PREFIX}A`;
SRC_PSI = `${SRC_PS_PREFIX}I`;
SRC_PSK = `${SRC_PS_PREFIX}K`;
SRC_PSZ = `${SRC_PS_PREFIX}Z`;
SRC_PSX = `${SRC_PS_PREFIX}X`;
SRC_PSD = `${SRC_PS_PREFIX}D`;

SRC_UA_PREFIX = "UA";

SRC_UAA = `${SRC_UA_PREFIX}Artificer`;
SRC_UAEAG = `${SRC_UA_PREFIX}EladrinAndGith`;
SRC_UAEBB = `${SRC_UA_PREFIX}Eberron`;
SRC_UAFFR = `${SRC_UA_PREFIX}FeatsForRaces`;
SRC_UAFFS = `${SRC_UA_PREFIX}FeatsForSkills`;
SRC_UAFO = `${SRC_UA_PREFIX}FiendishOptions`;
SRC_UAFT = `${SRC_UA_PREFIX}Feats`;
SRC_UAGH = `${SRC_UA_PREFIX}GothicHeroes`;
SRC_UAMDM = `${SRC_UA_PREFIX}ModernMagic`;
SRC_UASSP = `${SRC_UA_PREFIX}StarterSpells`;
SRC_UATMC = `${SRC_UA_PREFIX}TheMysticClass`;
SRC_UATOBM = `${SRC_UA_PREFIX}ThatOldBlackMagic`;
SRC_UATRR = `${SRC_UA_PREFIX}TheRangerRevised`;
SRC_UAWA = `${SRC_UA_PREFIX}WaterborneAdventures`;
SRC_UAVR = `${SRC_UA_PREFIX}VariantRules`;
SRC_UALDR = `${SRC_UA_PREFIX}LightDarkUnderdark`;
SRC_UARAR = `${SRC_UA_PREFIX}RangerAndRogue`;
SRC_UAATOSC = `${SRC_UA_PREFIX}ATrioOfSubclasses`;
SRC_UABPP = `${SRC_UA_PREFIX}BarbarianPrimalPaths`;
SRC_UARSC = `${SRC_UA_PREFIX}RevisedSubclasses`;
SRC_UAKOO = `${SRC_UA_PREFIX}KitsOfOld`;
SRC_UABBC = `${SRC_UA_PREFIX}BardBardColleges`;
SRC_UACDD = `${SRC_UA_PREFIX}ClericDivineDomains`;
SRC_UAD = `${SRC_UA_PREFIX}Druid`;
SRC_UARCO = `${SRC_UA_PREFIX}RevisedClassOptions`;
SRC_UAF = `${SRC_UA_PREFIX}Fighter`;
SRC_UAM = `${SRC_UA_PREFIX}Monk`;
SRC_UAP = `${SRC_UA_PREFIX}Paladin`;
SRC_UAMC = `${SRC_UA_PREFIX}ModifyingClasses`;
SRC_UAS = `${SRC_UA_PREFIX}Sorcerer`;
SRC_UAWAW = `${SRC_UA_PREFIX}WarlockAndWizard`;
SRC_UATF = `${SRC_UA_PREFIX}TheFaithful`;
SRC_UAWR = `${SRC_UA_PREFIX}WizardRevisited`;
SRC_UAESR = `${SRC_UA_PREFIX}ElfSubraces`;
SRC_UAMAC = `${SRC_UA_PREFIX}MassCombat`;
SRC_UA3PE = `${SRC_UA_PREFIX}ThreePillarExperience`;
SRC_UAGHI = `${SRC_UA_PREFIX}GreyhawkInitiative`;
SRC_UATSC = `${SRC_UA_PREFIX}ThreeSubclasses`;
SRC_UAOD = `${SRC_UA_PREFIX}OrderDomain`;
SRC_UACAM = `${SRC_UA_PREFIX}CentaursMinotaurs`;
SRC_UAGSS = `${SRC_UA_PREFIX}GiantSoulSorcerer`;
SRC_UARoE = `${SRC_UA_PREFIX}RacesOfEberron`;
SRC_UARoR = `${SRC_UA_PREFIX}RacesOfRavnica`;
SRC_UAWGE = `${SRC_UA_PREFIX}WGE`;
SRC_UAOSS = `${SRC_UA_PREFIX}OfShipsAndSea`;
SRC_UASIK = `${SRC_UA_PREFIX}Sidekicks`;
SRC_UAAR = `${SRC_UA_PREFIX}ArtificerRevisited`;
SRC_UABAM = `${SRC_UA_PREFIX}BarbarianAndMonk`;
SRC_UASAW = `${SRC_UA_PREFIX}SorcererAndWarlock`;
SRC_UABAP = `${SRC_UA_PREFIX}BardAndPaladin`;
SRC_UACDW = `${SRC_UA_PREFIX}ClericDruidWizard`;
SRC_UAFRR = `${SRC_UA_PREFIX}FighterRangerRogue`;
SRC_UACFV = `${SRC_UA_PREFIX}ClassFeatureVariants`;
SRC_UAFRW = `${SRC_UA_PREFIX}FighterRogueWizard`;
SRC_UAPCRM = `${SRC_UA_PREFIX}PrestigeClassesRunMagic`;
SRC_UAR = `${SRC_UA_PREFIX}Ranger`;
SRC_UA2020SC1 = `${SRC_UA_PREFIX}2020SubclassesPt1`;
SRC_UA2020SC2 = `${SRC_UA_PREFIX}2020SubclassesPt2`;
SRC_UA2020SC3 = `${SRC_UA_PREFIX}2020SubclassesPt3`;
SRC_UA2020SC4 = `${SRC_UA_PREFIX}2020SubclassesPt4`;
SRC_UA2020SC5 = `${SRC_UA_PREFIX}2020SubclassesPt5`;
SRC_UA2020SMT = `${SRC_UA_PREFIX}2020SpellsAndMagicTattoos`;
SRC_UA2020POR = `${SRC_UA_PREFIX}2020PsionicOptionsRevisited`;
SRC_UA2020SCR = `${SRC_UA_PREFIX}2020SubclassesRevisited`;
SRC_UA2020F = `${SRC_UA_PREFIX}2020Feats`;
SRC_UA2021GL = `${SRC_UA_PREFIX}2021GothicLineages`;
SRC_UA2021FF = `${SRC_UA_PREFIX}2021FolkOfTheFeywild`;
SRC_UA2021DO = `${SRC_UA_PREFIX}2021DraconicOptions`;
SRC_UA2021MoS = `${SRC_UA_PREFIX}2021MagesOfStrixhaven`;
SRC_UA2021TotM = `${SRC_UA_PREFIX}2021TravelersOfTheMultiverse`;

SRC_3PP_SUFFIX = " 3pp";

AL_PREFIX = "Adventurers League: ";
AL_PREFIX_SHORT = "AL: ";
PS_PREFIX = "Plane Shift: ";
PS_PREFIX_SHORT = "PS: ";
UA_PREFIX = "Unearthed Arcana: ";
UA_PREFIX_SHORT = "UA: ";
TftYP_NAME = "Tales from the Yawning Portal";
AitFR_NAME = "Adventures in the Forgotten Realms";

Parser.SOURCE_JSON_TO_FULL = {};
Parser.SOURCE_JSON_TO_FULL[SRC_CoS] = "Curse of Strahd";
Parser.SOURCE_JSON_TO_FULL[SRC_DMG] = "Dungeon Master's Guide";
Parser.SOURCE_JSON_TO_FULL[SRC_EEPC] = "Elemental Evil Player's Companion";
Parser.SOURCE_JSON_TO_FULL[SRC_EET] = "Elemental Evil: Trinkets";
Parser.SOURCE_JSON_TO_FULL[SRC_HotDQ] = "Hoard of the Dragon Queen";
Parser.SOURCE_JSON_TO_FULL[SRC_LMoP] = "Lost Mine of Phandelver";
Parser.SOURCE_JSON_TO_FULL[SRC_MM] = "Monster Manual";
Parser.SOURCE_JSON_TO_FULL[SRC_OotA] = "Out of the Abyss";
Parser.SOURCE_JSON_TO_FULL[SRC_PHB] = "Player's Handbook";
Parser.SOURCE_JSON_TO_FULL[SRC_PotA] = "Princes of the Apocalypse";
Parser.SOURCE_JSON_TO_FULL[SRC_RoT] = "The Rise of Tiamat";
Parser.SOURCE_JSON_TO_FULL[SRC_RoTOS] = "The Rise of Tiamat Online Supplement";
Parser.SOURCE_JSON_TO_FULL[SRC_SCAG] = "Sword Coast Adventurer's Guide";
Parser.SOURCE_JSON_TO_FULL[SRC_SKT] = "Storm King's Thunder";
Parser.SOURCE_JSON_TO_FULL[SRC_ToA] = "Tomb of Annihilation";
Parser.SOURCE_JSON_TO_FULL[SRC_TLK] = "The Lost Kenku";
Parser.SOURCE_JSON_TO_FULL[SRC_ToD] = "Tyranny of Dragons";
Parser.SOURCE_JSON_TO_FULL[SRC_TTP] = "The Tortle Package";
Parser.SOURCE_JSON_TO_FULL[SRC_TYP] = TftYP_NAME;
Parser.SOURCE_JSON_TO_FULL[SRC_TYP_AtG] = `${TftYP_NAME}: Against the Giants`;
Parser.SOURCE_JSON_TO_FULL[SRC_TYP_DiT] = `${TftYP_NAME}: Dead in Thay`;
Parser.SOURCE_JSON_TO_FULL[SRC_TYP_TFoF] = `${TftYP_NAME}: The Forge of Fury`;
Parser.SOURCE_JSON_TO_FULL[SRC_TYP_THSoT] = `${TftYP_NAME}: The Hidden Shrine of Tamoachan`;
Parser.SOURCE_JSON_TO_FULL[SRC_TYP_TSC] = `${TftYP_NAME}: The Sunless Citadel`;
Parser.SOURCE_JSON_TO_FULL[SRC_TYP_ToH] = `${TftYP_NAME}: Tomb of Horrors`;
Parser.SOURCE_JSON_TO_FULL[SRC_TYP_WPM] = `${TftYP_NAME}: White Plume Mountain`;
Parser.SOURCE_JSON_TO_FULL[SRC_VGM] = "Volo's Guide to Monsters";
Parser.SOURCE_JSON_TO_FULL[SRC_XGE] = "Xanathar's Guide to Everything";
Parser.SOURCE_JSON_TO_FULL[SRC_OGA] = "One Grung Above";
Parser.SOURCE_JSON_TO_FULL[SRC_MTF] = "Mordenkainen's Tome of Foes";
Parser.SOURCE_JSON_TO_FULL[SRC_WDH] = "Waterdeep: Dragon Heist";
Parser.SOURCE_JSON_TO_FULL[SRC_WDMM] = "Waterdeep: Dungeon of the Mad Mage";
Parser.SOURCE_JSON_TO_FULL[SRC_GGR] = "Guildmasters' Guide to Ravnica";
Parser.SOURCE_JSON_TO_FULL[SRC_KKW] = "Krenko's Way";
Parser.SOURCE_JSON_TO_FULL[SRC_LLK] = "Lost Laboratory of Kwalish";
Parser.SOURCE_JSON_TO_FULL[SRC_AZfyT] = "A Zib for your Thoughts";
Parser.SOURCE_JSON_TO_FULL[SRC_GoS] = "Ghosts of Saltmarsh";
Parser.SOURCE_JSON_TO_FULL[SRC_AI] = "Acquisitions Incorporated";
Parser.SOURCE_JSON_TO_FULL[SRC_OoW] = "The Orrery of the Wanderer";
Parser.SOURCE_JSON_TO_FULL[SRC_ESK] = "Essentials Kit";
Parser.SOURCE_JSON_TO_FULL[SRC_DIP] = "Dragon of Icespire Peak";
Parser.SOURCE_JSON_TO_FULL[SRC_HftT] = "Hunt for the Thessalhydra";
Parser.SOURCE_JSON_TO_FULL[SRC_DC] = "Divine Contention";
Parser.SOURCE_JSON_TO_FULL[SRC_SLW] = "Storm Lord's Wrath";
Parser.SOURCE_JSON_TO_FULL[SRC_SDW] = "Sleeping Dragon's Wake";
Parser.SOURCE_JSON_TO_FULL[SRC_BGDIA] = "Baldur's Gate: Descent Into Avernus";
Parser.SOURCE_JSON_TO_FULL[SRC_LR] = "Locathah Rising";
Parser.SOURCE_JSON_TO_FULL[SRC_AL] = "Adventurers' League";
Parser.SOURCE_JSON_TO_FULL[SRC_SAC] = "Sage Advice Compendium";
Parser.SOURCE_JSON_TO_FULL[SRC_ERLW] = "Eberron: Rising from the Last War";
Parser.SOURCE_JSON_TO_FULL[SRC_EFR] = "Eberron: Forgotten Relics";
Parser.SOURCE_JSON_TO_FULL[SRC_RMBRE] = "The Lost Dungeon of Rickedness: Big Rick Energy";
Parser.SOURCE_JSON_TO_FULL[SRC_RMR] = "Dungeons & Dragons vs. Rick and Morty: Basic Rules";
Parser.SOURCE_JSON_TO_FULL[SRC_MFF] = "Mordenkainen's Fiendish Folio";
Parser.SOURCE_JSON_TO_FULL[SRC_AWM] = "Adventure with Muk";
Parser.SOURCE_JSON_TO_FULL[SRC_IMR] = "Infernal Machine Rebuild";
Parser.SOURCE_JSON_TO_FULL[SRC_SADS] = "Sapphire Anniversary Dice Set";
Parser.SOURCE_JSON_TO_FULL[SRC_EGW] = "Explorer's Guide to Wildemount";
Parser.SOURCE_JSON_TO_FULL[SRC_EGW_ToR] = "Tide of Retribution";
Parser.SOURCE_JSON_TO_FULL[SRC_EGW_DD] = "Dangerous Designs";
Parser.SOURCE_JSON_TO_FULL[SRC_EGW_FS] = "Frozen Sick";
Parser.SOURCE_JSON_TO_FULL[SRC_EGW_US] = "Unwelcome Spirits";
Parser.SOURCE_JSON_TO_FULL[SRC_MOT] = "Mythic Odysseys of Theros";
Parser.SOURCE_JSON_TO_FULL[SRC_IDRotF] = "Icewind Dale: Rime of the Frostmaiden";
Parser.SOURCE_JSON_TO_FULL[SRC_TCE] = "Tasha's Cauldron of Everything";
Parser.SOURCE_JSON_TO_FULL[SRC_VRGR] = "Van Richten's Guide to Ravenloft";
Parser.SOURCE_JSON_TO_FULL[SRC_HoL] = "The House of Lament";
Parser.SOURCE_JSON_TO_FULL[SRC_RtG] = "Return to Glory";
Parser.SOURCE_JSON_TO_FULL[SRC_AitFR] = AitFR_NAME;
Parser.SOURCE_JSON_TO_FULL[SRC_AitFR_ISF] = `${AitFR_NAME}: In Scarlet Flames`;
Parser.SOURCE_JSON_TO_FULL[SRC_AitFR_THP] = `${AitFR_NAME}: The Hidden Page`;
Parser.SOURCE_JSON_TO_FULL[SRC_AitFR_AVT] = `${AitFR_NAME}: A Verdant Tomb`;
Parser.SOURCE_JSON_TO_FULL[SRC_AitFR_DN] = `${AitFR_NAME}: Deepest Night`;
Parser.SOURCE_JSON_TO_FULL[SRC_AitFR_FCD] = `${AitFR_NAME}: From Cyan Depths`;
Parser.SOURCE_JSON_TO_FULL[SRC_WBtW] = `The Wild Beyond the Witchlight`;
Parser.SOURCE_JSON_TO_FULL[SRC_DoD] = `Domains of Delight`;
Parser.SOURCE_JSON_TO_FULL[SRC_MaBJoV] = `Minsc and Boo's Journal of Villainy`;
Parser.SOURCE_JSON_TO_FULL[SRC_FTD] = `Fizban's Treasury of Dragons`;
Parser.SOURCE_JSON_TO_FULL[SRC_SCREEN] = "Dungeon Master's Screen";
Parser.SOURCE_JSON_TO_FULL[SRC_SCREEN_WILDERNESS_KIT] = "Dungeon Master's Screen: Wilderness Kit";
Parser.SOURCE_JSON_TO_FULL[SRC_HEROES_FEAST] = "Heroes' Feast";
Parser.SOURCE_JSON_TO_FULL[SRC_CM] = "Candlekeep Mysteries";
Parser.SOURCE_JSON_TO_FULL[SRC_ALCoS] = `${AL_PREFIX}Curse of Strahd`;
Parser.SOURCE_JSON_TO_FULL[SRC_ALEE] = `${AL_PREFIX}Elemental Evil`;
Parser.SOURCE_JSON_TO_FULL[SRC_ALRoD] = `${AL_PREFIX}Rage of Demons`;
Parser.SOURCE_JSON_TO_FULL[SRC_PSA] = `${PS_PREFIX}Amonkhet`;
Parser.SOURCE_JSON_TO_FULL[SRC_PSI] = `${PS_PREFIX}Innistrad`;
Parser.SOURCE_JSON_TO_FULL[SRC_PSK] = `${PS_PREFIX}Kaladesh`;
Parser.SOURCE_JSON_TO_FULL[SRC_PSZ] = `${PS_PREFIX}Zendikar`;
Parser.SOURCE_JSON_TO_FULL[SRC_PSX] = `${PS_PREFIX}Ixalan`;
Parser.SOURCE_JSON_TO_FULL[SRC_PSD] = `${PS_PREFIX}Dominaria`;
Parser.SOURCE_JSON_TO_FULL[SRC_XMtS] = `X Marks the Spot`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAA] = `${UA_PREFIX}Artificer`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAEAG] = `${UA_PREFIX}Eladrin and Gith`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAEBB] = `${UA_PREFIX}Eberron`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAFFR] = `${UA_PREFIX}Feats for Races`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAFFS] = `${UA_PREFIX}Feats for Skills`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAFO] = `${UA_PREFIX}Fiendish Options`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAFT] = `${UA_PREFIX}Feats`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAGH] = `${UA_PREFIX}Gothic Heroes`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAMDM] = `${UA_PREFIX}Modern Magic`;
Parser.SOURCE_JSON_TO_FULL[SRC_UASSP] = `${UA_PREFIX}Starter Spells`;
Parser.SOURCE_JSON_TO_FULL[SRC_UATMC] = `${UA_PREFIX}The Mystic Class`;
Parser.SOURCE_JSON_TO_FULL[SRC_UATOBM] = `${UA_PREFIX}That Old Black Magic`;
Parser.SOURCE_JSON_TO_FULL[SRC_UATRR] = `${UA_PREFIX}The Ranger, Revised`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAWA] = `${UA_PREFIX}Waterborne Adventures`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAVR] = `${UA_PREFIX}Variant Rules`;
Parser.SOURCE_JSON_TO_FULL[SRC_UALDR] = `${UA_PREFIX}Light, Dark, Underdark!`;
Parser.SOURCE_JSON_TO_FULL[SRC_UARAR] = `${UA_PREFIX}Ranger and Rogue`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAATOSC] = `${UA_PREFIX}A Trio of Subclasses`;
Parser.SOURCE_JSON_TO_FULL[SRC_UABPP] = `${UA_PREFIX}Barbarian Primal Paths`;
Parser.SOURCE_JSON_TO_FULL[SRC_UARSC] = `${UA_PREFIX}Revised Subclasses`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAKOO] = `${UA_PREFIX}Kits of Old`;
Parser.SOURCE_JSON_TO_FULL[SRC_UABBC] = `${UA_PREFIX}Bard: Bard Colleges`;
Parser.SOURCE_JSON_TO_FULL[SRC_UACDD] = `${UA_PREFIX}Cleric: Divine Domains`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAD] = `${UA_PREFIX}Druid`;
Parser.SOURCE_JSON_TO_FULL[SRC_UARCO] = `${UA_PREFIX}Revised Class Options`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAF] = `${UA_PREFIX}Fighter`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAM] = `${UA_PREFIX}Monk`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAP] = `${UA_PREFIX}Paladin`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAMC] = `${UA_PREFIX}Modifying Classes`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAS] = `${UA_PREFIX}Sorcerer`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAWAW] = `${UA_PREFIX}Warlock and Wizard`;
Parser.SOURCE_JSON_TO_FULL[SRC_UATF] = `${UA_PREFIX}The Faithful`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAWR] = `${UA_PREFIX}Wizard Revisited`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAESR] = `${UA_PREFIX}Elf Subraces`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAMAC] = `${UA_PREFIX}Mass Combat`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA3PE] = `${UA_PREFIX}Three-Pillar Experience`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAGHI] = `${UA_PREFIX}Greyhawk Initiative`;
Parser.SOURCE_JSON_TO_FULL[SRC_UATSC] = `${UA_PREFIX}Three Subclasses`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAOD] = `${UA_PREFIX}Order Domain`;
Parser.SOURCE_JSON_TO_FULL[SRC_UACAM] = `${UA_PREFIX}Centaurs and Minotaurs`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAGSS] = `${UA_PREFIX}Giant Soul Sorcerer`;
Parser.SOURCE_JSON_TO_FULL[SRC_UARoE] = `${UA_PREFIX}Races of Eberron`;
Parser.SOURCE_JSON_TO_FULL[SRC_UARoR] = `${UA_PREFIX}Races of Ravnica`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAWGE] = "Wayfinder's Guide to Eberron";
Parser.SOURCE_JSON_TO_FULL[SRC_UAOSS] = `${UA_PREFIX}Of Ships and the Sea`;
Parser.SOURCE_JSON_TO_FULL[SRC_UASIK] = `${UA_PREFIX}Sidekicks`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAAR] = `${UA_PREFIX}Artificer Revisited`;
Parser.SOURCE_JSON_TO_FULL[SRC_UABAM] = `${UA_PREFIX}Barbarian and Monk`;
Parser.SOURCE_JSON_TO_FULL[SRC_UASAW] = `${UA_PREFIX}Sorcerer and Warlock`;
Parser.SOURCE_JSON_TO_FULL[SRC_UABAP] = `${UA_PREFIX}Bard and Paladin`;
Parser.SOURCE_JSON_TO_FULL[SRC_UACDW] = `${UA_PREFIX}Cleric, Druid, and Wizard`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAFRR] = `${UA_PREFIX}Fighter, Ranger, and Rogue`;
Parser.SOURCE_JSON_TO_FULL[SRC_UACFV] = `${UA_PREFIX}Class Feature Variants`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAFRW] = `${UA_PREFIX}Fighter, Rogue, and Wizard`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAPCRM] = `${UA_PREFIX}Prestige Classes and Rune Magic`;
Parser.SOURCE_JSON_TO_FULL[SRC_UAR] = `${UA_PREFIX}Ranger`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA2020SC1] = `${UA_PREFIX}2020 Subclasses, Part 1`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA2020SC2] = `${UA_PREFIX}2020 Subclasses, Part 2`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA2020SC3] = `${UA_PREFIX}2020 Subclasses, Part 3`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA2020SC4] = `${UA_PREFIX}2020 Subclasses, Part 4`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA2020SC5] = `${UA_PREFIX}2020 Subclasses, Part 5`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA2020SMT] = `${UA_PREFIX}2020 Spells and Magic Tattoos`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA2020POR] = `${UA_PREFIX}2020 Psionic Options Revisited`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA2020SCR] = `${UA_PREFIX}2020 Subclasses Revisited`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA2020F] = `${UA_PREFIX}2020 Feats`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA2021GL] = `${UA_PREFIX}2021 Gothic Lineages`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA2021FF] = `${UA_PREFIX}2021 Folk of the Feywild`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA2021DO] = `${UA_PREFIX}2021 Draconic Options`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA2021MoS] = `${UA_PREFIX}2021 Mages of Strixhaven`;
Parser.SOURCE_JSON_TO_FULL[SRC_UA2021TotM] = `${UA_PREFIX}2021 Travelers of the Multiverse`;

Parser.SOURCE_JSON_TO_ABV = {};
Parser.SOURCE_JSON_TO_ABV[SRC_CoS] = "CoS";
Parser.SOURCE_JSON_TO_ABV[SRC_DMG] = "DMG";
Parser.SOURCE_JSON_TO_ABV[SRC_EEPC] = "EEPC";
Parser.SOURCE_JSON_TO_ABV[SRC_EET] = "EET";
Parser.SOURCE_JSON_TO_ABV[SRC_HotDQ] = "HotDQ";
Parser.SOURCE_JSON_TO_ABV[SRC_LMoP] = "LMoP";
Parser.SOURCE_JSON_TO_ABV[SRC_MM] = "MM";
Parser.SOURCE_JSON_TO_ABV[SRC_OotA] = "OotA";
Parser.SOURCE_JSON_TO_ABV[SRC_PHB] = "PHB";
Parser.SOURCE_JSON_TO_ABV[SRC_PotA] = "PotA";
Parser.SOURCE_JSON_TO_ABV[SRC_RoT] = "RoT";
Parser.SOURCE_JSON_TO_ABV[SRC_RoTOS] = "RoTOS";
Parser.SOURCE_JSON_TO_ABV[SRC_SCAG] = "SCAG";
Parser.SOURCE_JSON_TO_ABV[SRC_SKT] = "SKT";
Parser.SOURCE_JSON_TO_ABV[SRC_ToA] = "ToA";
Parser.SOURCE_JSON_TO_ABV[SRC_TLK] = "TLK";
Parser.SOURCE_JSON_TO_ABV[SRC_ToD] = "ToD";
Parser.SOURCE_JSON_TO_ABV[SRC_TTP] = "TTP";
Parser.SOURCE_JSON_TO_ABV[SRC_TYP] = "TftYP";
Parser.SOURCE_JSON_TO_ABV[SRC_TYP_AtG] = "TftYP";
Parser.SOURCE_JSON_TO_ABV[SRC_TYP_DiT] = "TftYP";
Parser.SOURCE_JSON_TO_ABV[SRC_TYP_TFoF] = "TftYP";
Parser.SOURCE_JSON_TO_ABV[SRC_TYP_THSoT] = "TftYP";
Parser.SOURCE_JSON_TO_ABV[SRC_TYP_TSC] = "TftYP";
Parser.SOURCE_JSON_TO_ABV[SRC_TYP_ToH] = "TftYP";
Parser.SOURCE_JSON_TO_ABV[SRC_TYP_WPM] = "TftYP";
Parser.SOURCE_JSON_TO_ABV[SRC_VGM] = "VGM";
Parser.SOURCE_JSON_TO_ABV[SRC_XGE] = "XGE";
Parser.SOURCE_JSON_TO_ABV[SRC_OGA] = "OGA";
Parser.SOURCE_JSON_TO_ABV[SRC_MTF] = "MTF";
Parser.SOURCE_JSON_TO_ABV[SRC_WDH] = "WDH";
Parser.SOURCE_JSON_TO_ABV[SRC_WDMM] = "WDMM";
Parser.SOURCE_JSON_TO_ABV[SRC_GGR] = "GGR";
Parser.SOURCE_JSON_TO_ABV[SRC_KKW] = "KKW";
Parser.SOURCE_JSON_TO_ABV[SRC_LLK] = "LLK";
Parser.SOURCE_JSON_TO_ABV[SRC_AZfyT] = "AZfyT";
Parser.SOURCE_JSON_TO_ABV[SRC_GoS] = "GoS";
Parser.SOURCE_JSON_TO_ABV[SRC_AI] = "AI";
Parser.SOURCE_JSON_TO_ABV[SRC_OoW] = "OoW";
Parser.SOURCE_JSON_TO_ABV[SRC_ESK] = "ESK";
Parser.SOURCE_JSON_TO_ABV[SRC_DIP] = "DIP";
Parser.SOURCE_JSON_TO_ABV[SRC_HftT] = "HftT";
Parser.SOURCE_JSON_TO_ABV[SRC_DC] = "DC";
Parser.SOURCE_JSON_TO_ABV[SRC_SLW] = "SLW";
Parser.SOURCE_JSON_TO_ABV[SRC_SDW] = "SDW";
Parser.SOURCE_JSON_TO_ABV[SRC_BGDIA] = "BGDIA";
Parser.SOURCE_JSON_TO_ABV[SRC_LR] = "LR";
Parser.SOURCE_JSON_TO_ABV[SRC_AL] = "AL";
Parser.SOURCE_JSON_TO_ABV[SRC_SAC] = "SAC";
Parser.SOURCE_JSON_TO_ABV[SRC_ERLW] = "ERLW";
Parser.SOURCE_JSON_TO_ABV[SRC_EFR] = "EFR";
Parser.SOURCE_JSON_TO_ABV[SRC_RMBRE] = "RMBRE";
Parser.SOURCE_JSON_TO_ABV[SRC_RMR] = "RMR";
Parser.SOURCE_JSON_TO_ABV[SRC_MFF] = "MFF";
Parser.SOURCE_JSON_TO_ABV[SRC_AWM] = "AWM";
Parser.SOURCE_JSON_TO_ABV[SRC_IMR] = "IMR";
Parser.SOURCE_JSON_TO_ABV[SRC_SADS] = "SADS";
Parser.SOURCE_JSON_TO_ABV[SRC_EGW] = "EGW";
Parser.SOURCE_JSON_TO_ABV[SRC_EGW_ToR] = "ToR";
Parser.SOURCE_JSON_TO_ABV[SRC_EGW_DD] = "DD";
Parser.SOURCE_JSON_TO_ABV[SRC_EGW_FS] = "FS";
Parser.SOURCE_JSON_TO_ABV[SRC_EGW_US] = "US";
Parser.SOURCE_JSON_TO_ABV[SRC_MOT] = "MOT";
Parser.SOURCE_JSON_TO_ABV[SRC_IDRotF] = "IDRotF";
Parser.SOURCE_JSON_TO_ABV[SRC_TCE] = "TCE";
Parser.SOURCE_JSON_TO_ABV[SRC_VRGR] = "VRGR";
Parser.SOURCE_JSON_TO_ABV[SRC_HoL] = "HoL";
Parser.SOURCE_JSON_TO_ABV[SRC_RtG] = "RtG";
Parser.SOURCE_JSON_TO_ABV[SRC_AitFR] = "AitFR";
Parser.SOURCE_JSON_TO_ABV[SRC_AitFR_ISF] = "AitFR-ISF";
Parser.SOURCE_JSON_TO_ABV[SRC_AitFR_THP] = "AitFR-THP";
Parser.SOURCE_JSON_TO_ABV[SRC_AitFR_AVT] = "AitFR-AVT";
Parser.SOURCE_JSON_TO_ABV[SRC_AitFR_DN] = "AitFR-DN";
Parser.SOURCE_JSON_TO_ABV[SRC_AitFR_FCD] = "AitFR-FCD";
Parser.SOURCE_JSON_TO_ABV[SRC_WBtW] = "WBtW";
Parser.SOURCE_JSON_TO_ABV[SRC_DoD] = "DoD";
Parser.SOURCE_JSON_TO_ABV[SRC_MaBJoV] = "MaBJoV";
Parser.SOURCE_JSON_TO_ABV[SRC_FTD] = "FTD";
Parser.SOURCE_JSON_TO_ABV[SRC_SCREEN] = "Screen";
Parser.SOURCE_JSON_TO_ABV[SRC_SCREEN_WILDERNESS_KIT] = "Wild";
Parser.SOURCE_JSON_TO_ABV[SRC_HEROES_FEAST] = "HF";
Parser.SOURCE_JSON_TO_ABV[SRC_CM] = "CM";
Parser.SOURCE_JSON_TO_ABV[SRC_ALCoS] = "ALCoS";
Parser.SOURCE_JSON_TO_ABV[SRC_ALEE] = "ALEE";
Parser.SOURCE_JSON_TO_ABV[SRC_ALRoD] = "ALRoD";
Parser.SOURCE_JSON_TO_ABV[SRC_PSA] = "PSA";
Parser.SOURCE_JSON_TO_ABV[SRC_PSI] = "PSI";
Parser.SOURCE_JSON_TO_ABV[SRC_PSK] = "PSK";
Parser.SOURCE_JSON_TO_ABV[SRC_PSZ] = "PSZ";
Parser.SOURCE_JSON_TO_ABV[SRC_PSX] = "PSX";
Parser.SOURCE_JSON_TO_ABV[SRC_PSD] = "PSD";
Parser.SOURCE_JSON_TO_ABV[SRC_XMtS] = "XMtS";
Parser.SOURCE_JSON_TO_ABV[SRC_UAA] = "UAA";
Parser.SOURCE_JSON_TO_ABV[SRC_UAEAG] = "UAEaG";
Parser.SOURCE_JSON_TO_ABV[SRC_UAEBB] = "UAEB";
Parser.SOURCE_JSON_TO_ABV[SRC_UAFFR] = "UAFFR";
Parser.SOURCE_JSON_TO_ABV[SRC_UAFFS] = "UAFFS";
Parser.SOURCE_JSON_TO_ABV[SRC_UAFO] = "UAFO";
Parser.SOURCE_JSON_TO_ABV[SRC_UAFT] = "UAFT";
Parser.SOURCE_JSON_TO_ABV[SRC_UAGH] = "UAGH";
Parser.SOURCE_JSON_TO_ABV[SRC_UAMDM] = "UAMM";
Parser.SOURCE_JSON_TO_ABV[SRC_UASSP] = "UASS";
Parser.SOURCE_JSON_TO_ABV[SRC_UATMC] = "UAMy";
Parser.SOURCE_JSON_TO_ABV[SRC_UATOBM] = "UAOBM";
Parser.SOURCE_JSON_TO_ABV[SRC_UATRR] = "UATRR";
Parser.SOURCE_JSON_TO_ABV[SRC_UAWA] = "UAWA";
Parser.SOURCE_JSON_TO_ABV[SRC_UAVR] = "UAVR";
Parser.SOURCE_JSON_TO_ABV[SRC_UALDR] = "UALDU";
Parser.SOURCE_JSON_TO_ABV[SRC_UARAR] = "UARAR";
Parser.SOURCE_JSON_TO_ABV[SRC_UAATOSC] = "UAATOSC";
Parser.SOURCE_JSON_TO_ABV[SRC_UABPP] = "UABPP";
Parser.SOURCE_JSON_TO_ABV[SRC_UARSC] = "UARSC";
Parser.SOURCE_JSON_TO_ABV[SRC_UAKOO] = "UAKoO";
Parser.SOURCE_JSON_TO_ABV[SRC_UABBC] = "UABBC";
Parser.SOURCE_JSON_TO_ABV[SRC_UACDD] = "UACDD";
Parser.SOURCE_JSON_TO_ABV[SRC_UAD] = "UAD";
Parser.SOURCE_JSON_TO_ABV[SRC_UARCO] = "UARCO";
Parser.SOURCE_JSON_TO_ABV[SRC_UAF] = "UAF";
Parser.SOURCE_JSON_TO_ABV[SRC_UAM] = "UAMk";
Parser.SOURCE_JSON_TO_ABV[SRC_UAP] = "UAP";
Parser.SOURCE_JSON_TO_ABV[SRC_UAMC] = "UAMC";
Parser.SOURCE_JSON_TO_ABV[SRC_UAS] = "UAS";
Parser.SOURCE_JSON_TO_ABV[SRC_UAWAW] = "UAWAW";
Parser.SOURCE_JSON_TO_ABV[SRC_UATF] = "UATF";
Parser.SOURCE_JSON_TO_ABV[SRC_UAWR] = "UAWR";
Parser.SOURCE_JSON_TO_ABV[SRC_UAESR] = "UAESR";
Parser.SOURCE_JSON_TO_ABV[SRC_UAMAC] = "UAMAC";
Parser.SOURCE_JSON_TO_ABV[SRC_UA3PE] = "UA3PE";
Parser.SOURCE_JSON_TO_ABV[SRC_UAGHI] = "UAGHI";
Parser.SOURCE_JSON_TO_ABV[SRC_UATSC] = "UATSC";
Parser.SOURCE_JSON_TO_ABV[SRC_UAOD] = "UAOD";
Parser.SOURCE_JSON_TO_ABV[SRC_UACAM] = "UACAM";
Parser.SOURCE_JSON_TO_ABV[SRC_UAGSS] = "UAGSS";
Parser.SOURCE_JSON_TO_ABV[SRC_UARoE] = "UARoE";
Parser.SOURCE_JSON_TO_ABV[SRC_UARoR] = "UARoR";
Parser.SOURCE_JSON_TO_ABV[SRC_UAWGE] = "WGE";
Parser.SOURCE_JSON_TO_ABV[SRC_UAOSS] = "UAOSS";
Parser.SOURCE_JSON_TO_ABV[SRC_UASIK] = "UASIK";
Parser.SOURCE_JSON_TO_ABV[SRC_UAAR] = "UAAR";
Parser.SOURCE_JSON_TO_ABV[SRC_UABAM] = "UABAM";
Parser.SOURCE_JSON_TO_ABV[SRC_UASAW] = "UASAW";
Parser.SOURCE_JSON_TO_ABV[SRC_UABAP] = "UABAP";
Parser.SOURCE_JSON_TO_ABV[SRC_UACDW] = "UACDW";
Parser.SOURCE_JSON_TO_ABV[SRC_UAFRR] = "UAFRR";
Parser.SOURCE_JSON_TO_ABV[SRC_UACFV] = "UACFV";
Parser.SOURCE_JSON_TO_ABV[SRC_UAFRW] = "UAFRW";
Parser.SOURCE_JSON_TO_ABV[SRC_UAPCRM] = "UAPCRM";
Parser.SOURCE_JSON_TO_ABV[SRC_UAR] = "UAR";
Parser.SOURCE_JSON_TO_ABV[SRC_UA2020SC1] = "UA20S1";
Parser.SOURCE_JSON_TO_ABV[SRC_UA2020SC2] = "UA20S2";
Parser.SOURCE_JSON_TO_ABV[SRC_UA2020SC3] = "UA20S3";
Parser.SOURCE_JSON_TO_ABV[SRC_UA2020SC4] = "UA20S4";
Parser.SOURCE_JSON_TO_ABV[SRC_UA2020SC5] = "UA20S5";
Parser.SOURCE_JSON_TO_ABV[SRC_UA2020SMT] = "UA20SMT";
Parser.SOURCE_JSON_TO_ABV[SRC_UA2020POR] = "UA20POR";
Parser.SOURCE_JSON_TO_ABV[SRC_UA2020SCR] = "UA20SCR";
Parser.SOURCE_JSON_TO_ABV[SRC_UA2020F] = "UA20F";
Parser.SOURCE_JSON_TO_ABV[SRC_UA2021GL] = "UA21GL";
Parser.SOURCE_JSON_TO_ABV[SRC_UA2021FF] = "UA21FF";
Parser.SOURCE_JSON_TO_ABV[SRC_UA2021DO] = "UA21DO";
Parser.SOURCE_JSON_TO_ABV[SRC_UA2021MoS] = "UA21MoS";
Parser.SOURCE_JSON_TO_ABV[SRC_UA2021TotM] = "UA21TotM";

Parser.SOURCE_JSON_TO_DATE = {};
Parser.SOURCE_JSON_TO_DATE[SRC_CoS] = "2016-03-15";
Parser.SOURCE_JSON_TO_DATE[SRC_DMG] = "2014-12-09";
Parser.SOURCE_JSON_TO_DATE[SRC_EEPC] = "2015-03-10";
Parser.SOURCE_JSON_TO_DATE[SRC_EET] = "2015-03-10";
Parser.SOURCE_JSON_TO_DATE[SRC_HotDQ] = "2014-08-19";
Parser.SOURCE_JSON_TO_DATE[SRC_LMoP] = "2014-07-15";
Parser.SOURCE_JSON_TO_DATE[SRC_MM] = "2014-09-30";
Parser.SOURCE_JSON_TO_DATE[SRC_OotA] = "2015-09-15";
Parser.SOURCE_JSON_TO_DATE[SRC_PHB] = "2014-08-19";
Parser.SOURCE_JSON_TO_DATE[SRC_PotA] = "2015-04-07";
Parser.SOURCE_JSON_TO_DATE[SRC_RoT] = "2014-11-04";
Parser.SOURCE_JSON_TO_DATE[SRC_RoTOS] = "2014-11-04";
Parser.SOURCE_JSON_TO_DATE[SRC_SCAG] = "2015-11-03";
Parser.SOURCE_JSON_TO_DATE[SRC_SKT] = "2016-09-06";
Parser.SOURCE_JSON_TO_DATE[SRC_ToA] = "2017-09-19";
Parser.SOURCE_JSON_TO_DATE[SRC_TLK] = "2017-11-28";
Parser.SOURCE_JSON_TO_DATE[SRC_ToD] = "2019-10-22";
Parser.SOURCE_JSON_TO_DATE[SRC_TTP] = "2017-09-19";
Parser.SOURCE_JSON_TO_DATE[SRC_TYP] = "2017-04-04";
Parser.SOURCE_JSON_TO_DATE[SRC_TYP_AtG] = "2017-04-04";
Parser.SOURCE_JSON_TO_DATE[SRC_TYP_DiT] = "2017-04-04";
Parser.SOURCE_JSON_TO_DATE[SRC_TYP_TFoF] = "2017-04-04";
Parser.SOURCE_JSON_TO_DATE[SRC_TYP_THSoT] = "2017-04-04";
Parser.SOURCE_JSON_TO_DATE[SRC_TYP_TSC] = "2017-04-04";
Parser.SOURCE_JSON_TO_DATE[SRC_TYP_ToH] = "2017-04-04";
Parser.SOURCE_JSON_TO_DATE[SRC_TYP_WPM] = "2017-04-04";
Parser.SOURCE_JSON_TO_DATE[SRC_VGM] = "2016-11-15";
Parser.SOURCE_JSON_TO_DATE[SRC_XGE] = "2017-11-21";
Parser.SOURCE_JSON_TO_DATE[SRC_OGA] = "2017-10-11";
Parser.SOURCE_JSON_TO_DATE[SRC_MTF] = "2018-05-29";
Parser.SOURCE_JSON_TO_DATE[SRC_WDH] = "2018-09-18";
Parser.SOURCE_JSON_TO_DATE[SRC_WDMM] = "2018-11-20";
Parser.SOURCE_JSON_TO_DATE[SRC_GGR] = "2018-11-20";
Parser.SOURCE_JSON_TO_DATE[SRC_KKW] = "2018-11-20";
Parser.SOURCE_JSON_TO_DATE[SRC_LLK] = "2018-11-10";
Parser.SOURCE_JSON_TO_DATE[SRC_AZfyT] = "2019-03-05";
Parser.SOURCE_JSON_TO_DATE[SRC_GoS] = "2019-05-21";
Parser.SOURCE_JSON_TO_DATE[SRC_AI] = "2019-06-18";
Parser.SOURCE_JSON_TO_DATE[SRC_OoW] = "2019-06-18";
Parser.SOURCE_JSON_TO_DATE[SRC_ESK] = "2019-06-24";
Parser.SOURCE_JSON_TO_DATE[SRC_DIP] = "2019-06-24";
Parser.SOURCE_JSON_TO_DATE[SRC_HftT] = "2019-05-01";
Parser.SOURCE_JSON_TO_DATE[SRC_DC] = "2019-06-24";
Parser.SOURCE_JSON_TO_DATE[SRC_SLW] = "2019-06-24";
Parser.SOURCE_JSON_TO_DATE[SRC_SDW] = "2019-06-24";
Parser.SOURCE_JSON_TO_DATE[SRC_BGDIA] = "2019-09-17";
Parser.SOURCE_JSON_TO_DATE[SRC_LR] = "2019-09-19";
Parser.SOURCE_JSON_TO_DATE[SRC_SAC] = "2019-01-31";
Parser.SOURCE_JSON_TO_DATE[SRC_ERLW] = "2019-11-19";
Parser.SOURCE_JSON_TO_DATE[SRC_EFR] = "2019-11-19";
Parser.SOURCE_JSON_TO_DATE[SRC_RMBRE] = "2019-11-19";
Parser.SOURCE_JSON_TO_DATE[SRC_RMR] = "2019-11-19";
Parser.SOURCE_JSON_TO_DATE[SRC_MFF] = "2019-11-12";
Parser.SOURCE_JSON_TO_DATE[SRC_AWM] = "2019-11-12";
Parser.SOURCE_JSON_TO_DATE[SRC_IMR] = "2019-11-12";
Parser.SOURCE_JSON_TO_DATE[SRC_SADS] = "2019-12-12";
Parser.SOURCE_JSON_TO_DATE[SRC_EGW] = "2020-03-17";
Parser.SOURCE_JSON_TO_DATE[SRC_EGW_ToR] = "2020-03-17";
Parser.SOURCE_JSON_TO_DATE[SRC_EGW_DD] = "2020-03-17";
Parser.SOURCE_JSON_TO_DATE[SRC_EGW_FS] = "2020-03-17";
Parser.SOURCE_JSON_TO_DATE[SRC_EGW_US] = "2020-03-17";
Parser.SOURCE_JSON_TO_DATE[SRC_MOT] = "2020-06-02";
Parser.SOURCE_JSON_TO_DATE[SRC_IDRotF] = "2020-09-15";
Parser.SOURCE_JSON_TO_DATE[SRC_TCE] = "2020-11-17";
Parser.SOURCE_JSON_TO_DATE[SRC_VRGR] = "2021-05-18";
Parser.SOURCE_JSON_TO_DATE[SRC_HoL] = "2021-05-18";
Parser.SOURCE_JSON_TO_DATE[SRC_RtG] = "2021-05-21";
Parser.SOURCE_JSON_TO_DATE[SRC_AitFR] = "2021-06-30";
Parser.SOURCE_JSON_TO_DATE[SRC_AitFR_ISF] = "2021-06-30";
Parser.SOURCE_JSON_TO_DATE[SRC_AitFR_THP] = "2021-07-07";
Parser.SOURCE_JSON_TO_DATE[SRC_AitFR_AVT] = "2021-07-14";
Parser.SOURCE_JSON_TO_DATE[SRC_AitFR_DN] = "2021-07-21";
Parser.SOURCE_JSON_TO_DATE[SRC_AitFR_FCD] = "2021-07-28";
Parser.SOURCE_JSON_TO_DATE[SRC_WBtW] = "2021-09-21";
Parser.SOURCE_JSON_TO_DATE[SRC_DoD] = "2021-09-21";
Parser.SOURCE_JSON_TO_DATE[SRC_MaBJoV] = "2021-10-05";
Parser.SOURCE_JSON_TO_DATE[SRC_FTD] = "2021-11-26";
Parser.SOURCE_JSON_TO_DATE[SRC_SCREEN] = "2015-01-20";
Parser.SOURCE_JSON_TO_DATE[SRC_SCREEN_WILDERNESS_KIT] = "2020-11-17";
Parser.SOURCE_JSON_TO_DATE[SRC_HEROES_FEAST] = "2020-10-27";
Parser.SOURCE_JSON_TO_DATE[SRC_CM] = "2021-03-16";
Parser.SOURCE_JSON_TO_DATE[SRC_ALCoS] = "2016-03-15";
Parser.SOURCE_JSON_TO_DATE[SRC_ALEE] = "2015-04-07";
Parser.SOURCE_JSON_TO_DATE[SRC_ALRoD] = "2015-09-15";
Parser.SOURCE_JSON_TO_DATE[SRC_PSA] = "2017-07-06";
Parser.SOURCE_JSON_TO_DATE[SRC_PSI] = "2016-07-12";
Parser.SOURCE_JSON_TO_DATE[SRC_PSK] = "2017-02-16";
Parser.SOURCE_JSON_TO_DATE[SRC_PSZ] = "2016-04-27";
Parser.SOURCE_JSON_TO_DATE[SRC_PSX] = "2018-01-09";
Parser.SOURCE_JSON_TO_DATE[SRC_PSD] = "2018-07-31";
Parser.SOURCE_JSON_TO_DATE[SRC_XMtS] = "2017-12-11";
Parser.SOURCE_JSON_TO_DATE[SRC_UAEBB] = "2015-02-02";
Parser.SOURCE_JSON_TO_DATE[SRC_UAA] = "2017-01-09";
Parser.SOURCE_JSON_TO_DATE[SRC_UAEAG] = "2017-09-11";
Parser.SOURCE_JSON_TO_DATE[SRC_UAFFR] = "2017-04-24";
Parser.SOURCE_JSON_TO_DATE[SRC_UAFFS] = "2017-04-17";
Parser.SOURCE_JSON_TO_DATE[SRC_UAFO] = "2017-10-09";
Parser.SOURCE_JSON_TO_DATE[SRC_UAFT] = "2016-06-06";
Parser.SOURCE_JSON_TO_DATE[SRC_UAGH] = "2016-04-04";
Parser.SOURCE_JSON_TO_DATE[SRC_UAMDM] = "2015-08-03";
Parser.SOURCE_JSON_TO_DATE[SRC_UASSP] = "2017-04-03";
Parser.SOURCE_JSON_TO_DATE[SRC_UATMC] = "2017-03-13";
Parser.SOURCE_JSON_TO_DATE[SRC_UATOBM] = "2015-12-07";
Parser.SOURCE_JSON_TO_DATE[SRC_UATRR] = "2016-09-12";
Parser.SOURCE_JSON_TO_DATE[SRC_UAWA] = "2015-05-04";
Parser.SOURCE_JSON_TO_DATE[SRC_UAVR] = "2015-06-08";
Parser.SOURCE_JSON_TO_DATE[SRC_UALDR] = "2015-11-02";
Parser.SOURCE_JSON_TO_DATE[SRC_UARAR] = "2017-01-16";
Parser.SOURCE_JSON_TO_DATE[SRC_UAATOSC] = "2017-03-27";
Parser.SOURCE_JSON_TO_DATE[SRC_UABPP] = "2016-11-07";
Parser.SOURCE_JSON_TO_DATE[SRC_UARSC] = "2017-05-01";
Parser.SOURCE_JSON_TO_DATE[SRC_UAKOO] = "2016-01-04";
Parser.SOURCE_JSON_TO_DATE[SRC_UABBC] = "2016-11-14";
Parser.SOURCE_JSON_TO_DATE[SRC_UACDD] = "2016-11-12";
Parser.SOURCE_JSON_TO_DATE[SRC_UAD] = "2016-11-28";
Parser.SOURCE_JSON_TO_DATE[SRC_UARCO] = "2017-06-05";
Parser.SOURCE_JSON_TO_DATE[SRC_UAF] = "2016-12-5";
Parser.SOURCE_JSON_TO_DATE[SRC_UAM] = "2016-12-12";
Parser.SOURCE_JSON_TO_DATE[SRC_UAP] = "2016-12-19";
Parser.SOURCE_JSON_TO_DATE[SRC_UAMC] = "2015-04-06";
Parser.SOURCE_JSON_TO_DATE[SRC_UAS] = "2017-02-06";
Parser.SOURCE_JSON_TO_DATE[SRC_UAWAW] = "2017-02-13";
Parser.SOURCE_JSON_TO_DATE[SRC_UATF] = "2016-08-01";
Parser.SOURCE_JSON_TO_DATE[SRC_UAWR] = "2017-03-20";
Parser.SOURCE_JSON_TO_DATE[SRC_UAESR] = "2017-11-13";
Parser.SOURCE_JSON_TO_DATE[SRC_UAMAC] = "2017-02-21";
Parser.SOURCE_JSON_TO_DATE[SRC_UA3PE] = "2017-08-07";
Parser.SOURCE_JSON_TO_DATE[SRC_UAGHI] = "2017-07-10";
Parser.SOURCE_JSON_TO_DATE[SRC_UATSC] = "2018-01-08";
Parser.SOURCE_JSON_TO_DATE[SRC_UAOD] = "2018-04-09";
Parser.SOURCE_JSON_TO_DATE[SRC_UACAM] = "2018-05-14";
Parser.SOURCE_JSON_TO_DATE[SRC_UAGSS] = "2018-06-11";
Parser.SOURCE_JSON_TO_DATE[SRC_UARoE] = "2018-07-23";
Parser.SOURCE_JSON_TO_DATE[SRC_UARoR] = "2018-08-13";
Parser.SOURCE_JSON_TO_DATE[SRC_UAWGE] = "2018-07-23";
Parser.SOURCE_JSON_TO_DATE[SRC_UAOSS] = "2018-11-12";
Parser.SOURCE_JSON_TO_DATE[SRC_UASIK] = "2018-12-17";
Parser.SOURCE_JSON_TO_DATE[SRC_UAAR] = "2019-02-28";
Parser.SOURCE_JSON_TO_DATE[SRC_UABAM] = "2019-08-15";
Parser.SOURCE_JSON_TO_DATE[SRC_UASAW] = "2019-09-05";
Parser.SOURCE_JSON_TO_DATE[SRC_UABAP] = "2019-09-18";
Parser.SOURCE_JSON_TO_DATE[SRC_UACDW] = "2019-10-03";
Parser.SOURCE_JSON_TO_DATE[SRC_UAFRR] = "2019-10-17";
Parser.SOURCE_JSON_TO_DATE[SRC_UACFV] = "2019-11-04";
Parser.SOURCE_JSON_TO_DATE[SRC_UAFRW] = "2019-11-25";
Parser.SOURCE_JSON_TO_DATE[SRC_UAPCRM] = "2015-10-05";
Parser.SOURCE_JSON_TO_DATE[SRC_UAR] = "2015-09-09";
Parser.SOURCE_JSON_TO_DATE[SRC_UA2020SC1] = "2020-01-14";
Parser.SOURCE_JSON_TO_DATE[SRC_UA2020SC2] = "2020-02-04";
Parser.SOURCE_JSON_TO_DATE[SRC_UA2020SC3] = "2020-02-24";
Parser.SOURCE_JSON_TO_DATE[SRC_UA2020SC4] = "2020-08-05";
Parser.SOURCE_JSON_TO_DATE[SRC_UA2020SC5] = "2020-10-26";
Parser.SOURCE_JSON_TO_DATE[SRC_UA2020SMT] = "2020-03-26";
Parser.SOURCE_JSON_TO_DATE[SRC_UA2020POR] = "2020-04-14";
Parser.SOURCE_JSON_TO_DATE[SRC_UA2020SCR] = "2020-05-12";
Parser.SOURCE_JSON_TO_DATE[SRC_UA2020F] = "2020-07-13";
Parser.SOURCE_JSON_TO_DATE[SRC_UA2021GL] = "2020-01-26";
Parser.SOURCE_JSON_TO_DATE[SRC_UA2021FF] = "2020-03-12";
Parser.SOURCE_JSON_TO_DATE[SRC_UA2021DO] = "2021-04-14";
Parser.SOURCE_JSON_TO_DATE[SRC_UA2021MoS] = "2021-06-08";
Parser.SOURCE_JSON_TO_DATE[SRC_UA2021TotM] = "2021-10-08";

Parser.SOURCES_ADVENTURES = new Set([
	SRC_LMoP,
	SRC_HotDQ,
	SRC_RoT,
	SRC_RoTOS,
	SRC_PotA,
	SRC_OotA,
	SRC_CoS,
	SRC_SKT,
	SRC_TYP,
	SRC_TYP_AtG,
	SRC_TYP_DiT,
	SRC_TYP_TFoF,
	SRC_TYP_THSoT,
	SRC_TYP_TSC,
	SRC_TYP_ToH,
	SRC_TYP_WPM,
	SRC_ToA,
	SRC_TLK,
	SRC_TTP,
	SRC_WDH,
	SRC_LLK,
	SRC_WDMM,
	SRC_KKW,
	SRC_AZfyT,
	SRC_GoS,
	SRC_HftT,
	SRC_OoW,
	SRC_DIP,
	SRC_SLW,
	SRC_SDW,
	SRC_DC,
	SRC_BGDIA,
	SRC_LR,
	SRC_EFR,
	SRC_RMBRE,
	SRC_IMR,
	SRC_EGW_ToR,
	SRC_EGW_DD,
	SRC_EGW_FS,
	SRC_EGW_US,
	SRC_IDRotF,
	SRC_CM,
	SRC_HoL,
	SRC_XMtS,
	SRC_RtG,
	SRC_AitFR,
	SRC_AitFR_ISF,
	SRC_AitFR_THP,
	SRC_AitFR_AVT,
	SRC_AitFR_DN,
	SRC_AitFR_FCD,
	SRC_WBtW,

	SRC_AWM,
]);
Parser.SOURCES_CORE_SUPPLEMENTS = new Set(Object.keys(Parser.SOURCE_JSON_TO_FULL).filter(it => !Parser.SOURCES_ADVENTURES.has(it)));
Parser.SOURCES_NON_STANDARD_WOTC = new Set([
	SRC_OGA,
	SRC_LLK,
	SRC_AZfyT,
	SRC_LR,
	SRC_TLK,
	SRC_TTP,
	SRC_AWM,
	SRC_IMR,
	SRC_SADS,
	SRC_MFF,
	SRC_XMtS,
	SRC_RtG,
	SRC_AitFR,
	SRC_AitFR_ISF,
	SRC_AitFR_THP,
	SRC_AitFR_AVT,
	SRC_AitFR_DN,
	SRC_AitFR_FCD,
	SRC_DoD,
	SRC_MaBJoV,
]);
// region Source categories

// An opinionated set of source that could be considered "core-core"
Parser.SOURCES_VANILLA = new Set([
	SRC_DMG,
	SRC_MM,
	SRC_PHB,
	SRC_SCAG,
	SRC_TTP,
	SRC_VGM,
	SRC_XGE,
	SRC_MTF,
	SRC_SAC,
	SRC_MFF,
	SRC_SADS,
	SRC_TCE,
	SRC_FTD,
	SRC_SCREEN,
	SRC_SCREEN_WILDERNESS_KIT,
]);

// Any opinionated set of sources that are """hilarious, dude"""
Parser.SOURCES_COMEDY = new Set([
	SRC_AI,
	SRC_OoW,
	SRC_RMR,
	SRC_RMBRE,
	SRC_HftT,
]);

// Any opinionated set of sources that are "other settings"
Parser.SOURCES_NON_FR = new Set([
	SRC_GGR,
	SRC_KKW,
	SRC_ERLW,
	SRC_EFR,
	SRC_UAWGE,
	SRC_EGW,
	SRC_EGW_ToR,
	SRC_EGW_DD,
	SRC_EGW_FS,
	SRC_EGW_US,
	SRC_MOT,
	SRC_XMtS,
	SRC_AZfyT,
]);

// endregion
Parser.SOURCES_AVAILABLE_DOCS_BOOK = {};
[
	SRC_PHB,
	SRC_MM,
	SRC_DMG,
	SRC_SCAG,
	SRC_VGM,
	SRC_OGA,
	SRC_XGE,
	SRC_MTF,
	SRC_GGR,
	SRC_AI,
	SRC_ERLW,
	SRC_RMR,
	SRC_EGW,
	SRC_MOT,
	SRC_TCE,
	SRC_VRGR,
	SRC_DoD,
	SRC_MaBJoV,
	SRC_FTD,
].forEach(src => {
	Parser.SOURCES_AVAILABLE_DOCS_BOOK[src] = src;
	Parser.SOURCES_AVAILABLE_DOCS_BOOK[src.toLowerCase()] = src;
});
Parser.SOURCES_AVAILABLE_DOCS_ADVENTURE = {};
[
	SRC_LMoP,
	SRC_HotDQ,
	SRC_RoT,
	SRC_PotA,
	SRC_OotA,
	SRC_CoS,
	SRC_SKT,
	SRC_TYP_AtG,
	SRC_TYP_DiT,
	SRC_TYP_TFoF,
	SRC_TYP_THSoT,
	SRC_TYP_TSC,
	SRC_TYP_ToH,
	SRC_TYP_WPM,
	SRC_ToA,
	SRC_TLK,
	SRC_TTP,
	SRC_WDH,
	SRC_LLK,
	SRC_WDMM,
	SRC_KKW,
	SRC_AZfyT,
	SRC_GoS,
	SRC_HftT,
	SRC_OoW,
	SRC_DIP,
	SRC_SLW,
	SRC_SDW,
	SRC_DC,
	SRC_BGDIA,
	SRC_LR,
	SRC_EFR,
	SRC_RMBRE,
	SRC_IMR,
	SRC_EGW_ToR,
	SRC_EGW_DD,
	SRC_EGW_FS,
	SRC_EGW_US,
	SRC_IDRotF,
	SRC_CM,
	SRC_HoL,
	SRC_XMtS,
	SRC_RtG,
	SRC_AitFR_ISF,
	SRC_AitFR_THP,
	SRC_AitFR_AVT,
	SRC_AitFR_DN,
	SRC_AitFR_FCD,
	SRC_WBtW,
].forEach(src => {
	Parser.SOURCES_AVAILABLE_DOCS_ADVENTURE[src] = src;
	Parser.SOURCES_AVAILABLE_DOCS_ADVENTURE[src.toLowerCase()] = src;
});

Parser.TAG_TO_DEFAULT_SOURCE = {
	"spell": SRC_PHB,
	"item": SRC_DMG,
	"class": SRC_PHB,
	"creature": SRC_MM,
	"condition": SRC_PHB,
	"disease": SRC_DMG,
	"status": SRC_DMG,
	"background": SRC_PHB,
	"race": SRC_PHB,
	"optfeature": SRC_PHB,
	"reward": SRC_DMG,
	"feat": SRC_PHB,
	"psionic": SRC_UATMC,
	"object": SRC_DMG,
	"cult": SRC_MTF,
	"boon": SRC_MTF,
	"trap": SRC_DMG,
	"hazard": SRC_DMG,
	"deity": SRC_PHB,
	"variantrule": SRC_DMG,
	"vehicle": SRC_GoS,
	"vehupgrade": SRC_GoS,
	"action": SRC_PHB,
	"classFeature": SRC_PHB,
	"subclassFeature": SRC_PHB,
	"table": SRC_DMG,
	"language": SRC_PHB,
	"charoption": SRC_MOT,
	"recipe": SRC_HEROES_FEAST,
	"itemEntry": SRC_DMG,
};
Parser.getTagSource = function (tag, source) {
	if (source && source.trim()) return source;

	tag = tag.trim();
	if (tag.startsWith("@")) tag = tag.slice(1);

	if (!Parser.TAG_TO_DEFAULT_SOURCE[tag]) throw new Error(`Unhandled tag "${tag}"`);
	return Parser.TAG_TO_DEFAULT_SOURCE[tag];
};

Parser.ITEM_TYPE_JSON_TO_ABV = {
	"A": "ammunition",
	"AF": "ammunition",
	"AT": "artisan's tools",
	"EM": "eldritch machine",
	"EXP": "explosive",
	"FD": "food and drink",
	"G": "adventuring gear",
	"GS": "gaming set",
	"HA": "heavy armor",
	"INS": "instrument",
	"LA": "light armor",
	"M": "melee weapon",
	"MA": "medium armor",
	"MNT": "mount",
	"MR": "master rune",
	"GV": "generic variant",
	"P": "potion",
	"R": "ranged weapon",
	"RD": "rod",
	"RG": "ring",
	"S": "shield",
	"SC": "scroll",
	"SCF": "spellcasting focus",
	"OTH": "other",
	"T": "tools",
	"TAH": "tack and harness",
	"TG": "trade good",
	"$": "treasure",
	"VEH": "vehicle (land)",
	"SHP": "vehicle (water)",
	"AIR": "vehicle (air)",
	"WD": "wand",
};

Parser.DMGTYPE_JSON_TO_FULL = {
	"A": "acid",
	"B": "bludgeoning",
	"C": "cold",
	"F": "fire",
	"O": "force",
	"L": "lightning",
	"N": "necrotic",
	"P": "piercing",
	"I": "poison",
	"Y": "psychic",
	"R": "radiant",
	"S": "slashing",
	"T": "thunder",
};

Parser.DMG_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
Parser.CONDITIONS = ["blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"];

Parser.SKILL_JSON_TO_FULL = {
	"Acrobatics": [
		"Your Dexterity (Acrobatics) check covers your attempt to stay on your feet in a tricky situation, such as when you're trying to run across a sheet of ice, balance on a tightrope, or stay upright on a rocking ship's deck. The DM might also call for a Dexterity (Acrobatics) check to see if you can perform acrobatic stunts, including dives, rolls, somersaults, and flips.",
	],
	"Animal Handling": [
		"When there is any question whether you can calm down a domesticated animal, keep a mount from getting spooked, or intuit an animal's intentions, the DM might call for a Wisdom (Animal Handling) check. You also make a Wisdom (Animal Handling) check to control your mount when you attempt a risky maneuver.",
	],
	"Arcana": [
		"Your Intelligence (Arcana) check measures your ability to recall lore about spells, magic items, eldritch symbols, magical traditions, the planes of existence, and the inhabitants of those planes.",
	],
	"Athletics": [
		"Your Strength (Athletics) check covers difficult situations you encounter while climbing, jumping, or swimming. Examples include the following activities:",
		{
			"type": "list",
			"items": [
				"You attempt to climb a sheer or slippery cliff, avoid hazards while scaling a wall, or cling to a surface while something is trying to knock you off.",
				"You try to jump an unusually long distance or pull off a stunt mid jump.",
				"You struggle to swim or stay afloat in treacherous currents, storm-tossed waves, or areas of thick seaweed. Or another creature tries to push or pull you underwater or otherwise interfere with your swimming.",
			],
		},
	],
	"Deception": [
		"Your Charisma (Deception) check determines whether you can convincingly hide the truth, either verbally or through your actions. This deception can encompass everything from misleading others through ambiguity to telling outright lies. Typical situations include trying to fast-talk a guard, con a merchant, earn money through gambling, pass yourself off in a disguise, dull someone's suspicions with false assurances, or maintain a straight face while telling a blatant lie.",
	],
	"History": [
		"Your Intelligence (History) check measures your ability to recall lore about historical events, legendary people, ancient kingdoms, past disputes, recent wars, and lost civilizations.",
	],
	"Insight": [
		"Your Wisdom (Insight) check decides whether you can determine the true intentions of a creature, such as when searching out a lie or predicting someone's next move. Doing so involves gleaning clues from body language, speech habits, and changes in mannerisms.",
	],
	"Intimidation": [
		"When you attempt to influence someone through overt threats, hostile actions, and physical violence, the DM might ask you to make a Charisma (Intimidation) check. Examples include trying to pry information out of a prisoner, convincing street thugs to back down from a confrontation, or using the edge of a broken bottle to convince a sneering vizier to reconsider a decision.",
	],
	"Investigation": [
		"When you look around for clues and make deductions based on those clues, you make an Intelligence (Investigation) check. You might deduce the location of a hidden object, discern from the appearance of a wound what kind of weapon dealt it, or determine the weakest point in a tunnel that could cause it to collapse. Poring through ancient scrolls in search of a hidden fragment of knowledge might also call for an Intelligence (Investigation) check.",
	],
	"Medicine": [
		"A Wisdom (Medicine) check lets you try to stabilize a dying companion or diagnose an illness.",
	],
	"Nature": [
		"Your Intelligence (Nature) check measures your ability to recall lore about terrain, plants and animals, the weather, and natural cycles.",
	],
	"Perception": [
		"Your Wisdom (Perception) check lets you spot, hear, or otherwise detect the presence of something. It measures your general awareness of your surroundings and the keenness of your senses.", "For example, you might try to hear a conversation through a closed door, eavesdrop under an open window, or hear monsters moving stealthily in the forest. Or you might try to spot things that are obscured or easy to miss, whether they are orcs lying in ambush on a road, thugs hiding in the shadows of an alley, or candlelight under a closed secret door.",
	],
	"Performance": [
		"Your Charisma (Performance) check determines how well you can delight an audience with music, dance, acting, storytelling, or some other form of entertainment.",
	],
	"Persuasion": [
		"When you attempt to influence someone or a group of people with tact, social graces, or good nature, the DM might ask you to make a Charisma (Persuasion) check. Typically, you use persuasion when acting in good faith, to foster friendships, make cordial requests, or exhibit proper etiquette. Examples of persuading others include convincing a chamberlain to let your party see the king, negotiating peace between warring tribes, or inspiring a crowd of townsfolk.",
	],
	"Religion": [
		"Your Intelligence (Religion) check measures your ability to recall lore about deities, rites and prayers, religious hierarchies, holy symbols, and the practices of secret cults.",
	],
	"Sleight of Hand": [
		"Whenever you attempt an act of legerdemain or manual trickery, such as planting something on someone else or concealing an object on your person, make a Dexterity (Sleight of Hand) check. The DM might also call for a Dexterity (Sleight of Hand) check to determine whether you can lift a coin purse off another person or slip something out of another person's pocket.",
	],
	"Stealth": [
		"Make a Dexterity (Stealth) check when you attempt to conceal yourself from enemies, slink past guards, slip away without being noticed, or sneak up on someone without being seen or heard.",
	],
	"Survival": [
		"The DM might ask you to make a Wisdom (Survival) check to follow tracks, hunt wild game, guide your group through frozen wastelands, identify signs that owlbears live nearby, predict the weather, or avoid quicksand and other natural hazards.",
	],
};

Parser.SENSE_JSON_TO_FULL = {
	"blindsight": [
		"A creature with blindsight can perceive its surroundings without relying on sight, within a specific radius. Creatures without eyes, such as oozes, and creatures with echolocation or heightened senses, such as bats and true dragons, have this sense.",
	],
	"darkvision": [
		"Many creatures in fantasy gaming worlds, especially those that dwell underground, have darkvision. Within a specified range, a creature with darkvision can see in dim light as if it were bright light and in darkness as if it were dim light, so areas of darkness are only lightly obscured as far as that creature is concerned. However, the creature can't discern color in that darkness, only shades of gray.",
	],
	"tremorsense": [
		"A creature with tremorsense can detect and pinpoint the origin of vibrations within a specific radius, provided that the creature and the source of the vibrations are in contact with the same ground or substance. Tremorsense can't be used to detect flying or incorporeal creatures. Many burrowing creatures, such as ankhegs and umber hulks, have this special sense.",
	],
	"truesight": [
		"A creature with truesight can, out to a specific range, see in normal and magical darkness, see invisible creatures and objects, automatically detect visual illusions and succeed on saving throws against them, and perceives the original form of a shapechanger or a creature that is transformed by magic. Furthermore, the creature can see into the Ethereal Plane.",
	],
};

Parser.NUMBERS_ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
Parser.NUMBERS_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
Parser.NUMBERS_TEENS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
