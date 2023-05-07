"use strict";

// in deployment, `IS_DEPLOYED = "<version number>";` should be set below.
globalThis.IS_DEPLOYED = undefined;
globalThis.VERSION_NUMBER = /* 5ETOOLS_VERSION__OPEN */"1.181.0"/* 5ETOOLS_VERSION__CLOSE */;
globalThis.DEPLOYED_STATIC_ROOT = ""; // "https://static.5etools.com/"; // FIXME re-enable this when we have a CDN again
globalThis.DEPLOYED_IMG_ROOT = undefined;
// for the roll20 script to set
globalThis.IS_VTT = false;

globalThis.IMGUR_CLIENT_ID = `abdea4de492d3b0`;

// TODO refactor into VeCt
globalThis.HASH_PART_SEP = ",";
globalThis.HASH_LIST_SEP = "_";
globalThis.HASH_SUB_LIST_SEP = "~";
globalThis.HASH_SUB_KV_SEP = ":";
globalThis.HASH_BLANK = "blankhash";
globalThis.HASH_SUB_NONE = "null";

globalThis.VeCt = {
	STR_NONE: "None",
	STR_SEE_CONSOLE: "See the console (CTRL+SHIFT+J) for details.",

	HASH_SCALED: "scaled",
	HASH_SCALED_SPELL_SUMMON: "scaledspellsummon",
	HASH_SCALED_CLASS_SUMMON: "scaledclasssummon",

	FILTER_BOX_SUB_HASH_SEARCH_PREFIX: "fbsr",

	JSON_PRERELEASE_INDEX: `prerelease/index.json`,
	JSON_BREW_INDEX: `homebrew/index.json`,

	STORAGE_HOMEBREW: "HOMEBREW_STORAGE",
	STORAGE_HOMEBREW_META: "HOMEBREW_META_STORAGE",
	STORAGE_EXCLUDES: "EXCLUDES_STORAGE",
	STORAGE_DMSCREEN: "DMSCREEN_STORAGE",
	STORAGE_DMSCREEN_TEMP_SUBLIST: "DMSCREEN_TEMP_SUBLIST",
	STORAGE_ROLLER_MACRO: "ROLLER_MACRO_STORAGE",
	STORAGE_ENCOUNTER: "ENCOUNTER_STORAGE",
	STORAGE_POINTBUY: "POINTBUY_STORAGE",
	STORAGE_GLOBAL_COMPONENT_STATE: "GLOBAL_COMPONENT_STATE",

	DUR_INLINE_NOTIFY: 500,

	PG_NONE: "NO_PAGE",
	STR_GENERIC: "Generic",

	SYM_UI_SKIP: Symbol("uiSkip"),

	SYM_WALKER_BREAK: Symbol("walkerBreak"),

	SYM_UTIL_TIMEOUT: Symbol("timeout"),

	LOC_ORIGIN_CANCER: "https://5e.tools",

	URL_BREW: `https://github.com/TheGiddyLimit/homebrew`,
	URL_ROOT_BREW: `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/`, // N.b. must end with a slash
	URL_PRERELEASE: `https://github.com/TheGiddyLimit/unearthed-arcana`,
	URL_ROOT_PRERELEASE: `https://raw.githubusercontent.com/TheGiddyLimit/unearthed-arcana/master/`, // As above

	STR_NO_ATTUNEMENT: "No Attunement Required",

	CR_UNKNOWN: 100001,
	CR_CUSTOM: 100000,

	SPELL_LEVEL_MAX: 9,
	LEVEL_MAX: 20,

	ENTDATA_TABLE_INCLUDE: "tableInclude",
	ENTDATA_ITEM_MERGED_ENTRY_TAG: "item__mergedEntryTag",

	DRAG_TYPE_IMPORT: "ve-Import",
	DRAG_TYPE_LOOT: "ve-Loot",

	Z_INDEX_BENEATH_HOVER: 199,
};

// STRING ==============================================================================================================
String.prototype.uppercaseFirst = String.prototype.uppercaseFirst || function () {
	const str = this.toString();
	if (str.length === 0) return str;
	if (str.length === 1) return str.charAt(0).toUpperCase();
	return str.charAt(0).toUpperCase() + str.slice(1);
};

String.prototype.lowercaseFirst = String.prototype.lowercaseFirst || function () {
	const str = this.toString();
	if (str.length === 0) return str;
	if (str.length === 1) return str.charAt(0).toLowerCase();
	return str.charAt(0).toLowerCase() + str.slice(1);
};

String.prototype.toTitleCase = String.prototype.toTitleCase || function () {
	let str = this.replace(/([^\W_]+[^-\u2014\s/]*) */g, m0 => m0.charAt(0).toUpperCase() + m0.substr(1).toLowerCase());

	// Require space surrounded, as title-case requires a full word on either side
	StrUtil._TITLE_LOWER_WORDS_RE = StrUtil._TITLE_LOWER_WORDS_RE || StrUtil.TITLE_LOWER_WORDS.map(it => new RegExp(`\\s${it}\\s`, "gi"));
	StrUtil._TITLE_UPPER_WORDS_RE = StrUtil._TITLE_UPPER_WORDS_RE || StrUtil.TITLE_UPPER_WORDS.map(it => new RegExp(`\\b${it}\\b`, "g"));
	StrUtil._TITLE_UPPER_WORDS_PLURAL_RE = StrUtil._TITLE_UPPER_WORDS_PLURAL_RE || StrUtil.TITLE_UPPER_WORDS.map(it => new RegExp(`\\b${it}s\\b`, "g"));

	const len = StrUtil.TITLE_LOWER_WORDS.length;
	for (let i = 0; i < len; i++) {
		str = str.replace(
			StrUtil._TITLE_LOWER_WORDS_RE[i],
			txt => txt.toLowerCase(),
		);
	}

	const len1 = StrUtil.TITLE_UPPER_WORDS.length;
	for (let i = 0; i < len1; i++) {
		str = str.replace(
			StrUtil._TITLE_UPPER_WORDS_RE[i],
			StrUtil.TITLE_UPPER_WORDS[i].toUpperCase(),
		);
	}

	for (let i = 0; i < len1; i++) {
		str = str.replace(
			StrUtil._TITLE_UPPER_WORDS_PLURAL_RE[i],
			`${StrUtil.TITLE_UPPER_WORDS[i].toUpperCase()}s`,
		);
	}

	str = str
		.split(/([;:?!.])/g)
		.map(pt => pt.replace(/^(\s*)([^\s])/, (...m) => `${m[1]}${m[2].toUpperCase()}`))
		.join("");

	return str;
};

String.prototype.toSentenceCase = String.prototype.toSentenceCase || function () {
	const out = [];
	const re = /([^.!?]+)([.!?]\s*|$)/gi;
	let m;
	do {
		m = re.exec(this);
		if (m) {
			out.push(m[0].toLowerCase().uppercaseFirst());
		}
	} while (m);
	return out.join("");
};

String.prototype.toSpellCase = String.prototype.toSpellCase || function () {
	return this.toLowerCase().replace(/(^|of )(bigby|otiluke|mordenkainen|evard|hadar|agathys|abi-dalzim|aganazzar|drawmij|leomund|maximilian|melf|nystul|otto|rary|snilloc|tasha|tenser|jim)('s|$| )/g, (...m) => `${m[1]}${m[2].toTitleCase()}${m[3]}`);
};

String.prototype.toCamelCase = String.prototype.toCamelCase || function () {
	return this.split(" ").map((word, index) => {
		if (index === 0) return word.toLowerCase();
		return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
	}).join("");
};

String.prototype.escapeQuotes = String.prototype.escapeQuotes || function () {
	return this.replace(/'/g, `&apos;`).replace(/"/g, `&quot;`).replace(/</g, `&lt;`).replace(/>/g, `&gt;`);
};

String.prototype.qq = String.prototype.qq || function () {
	return this.escapeQuotes();
};

String.prototype.unescapeQuotes = String.prototype.unescapeQuotes || function () {
	return this.replace(/&apos;/g, `'`).replace(/&quot;/g, `"`).replace(/&lt;/g, `<`).replace(/&gt;/g, `>`);
};

String.prototype.uq = String.prototype.uq || function () {
	return this.unescapeQuotes();
};

String.prototype.encodeApos = String.prototype.encodeApos || function () {
	return this.replace(/'/g, `%27`);
};

/**
 * Calculates the Damerau-Levenshtein distance between two strings.
 * https://gist.github.com/IceCreamYou/8396172
 */
String.prototype.distance = String.prototype.distance || function (target) {
	let source = this; let i; let j;
	if (!source) return target ? target.length : 0;
	else if (!target) return source.length;

	const m = source.length; const n = target.length; const INF = m + n; const score = new Array(m + 2); const sd = {};
	for (i = 0; i < m + 2; i++) score[i] = new Array(n + 2);
	score[0][0] = INF;
	for (i = 0; i <= m; i++) {
		score[i + 1][1] = i;
		score[i + 1][0] = INF;
		sd[source[i]] = 0;
	}
	for (j = 0; j <= n; j++) {
		score[1][j + 1] = j;
		score[0][j + 1] = INF;
		sd[target[j]] = 0;
	}

	for (i = 1; i <= m; i++) {
		let DB = 0;
		for (j = 1; j <= n; j++) {
			const i1 = sd[target[j - 1]]; const j1 = DB;
			if (source[i - 1] === target[j - 1]) {
				score[i + 1][j + 1] = score[i][j];
				DB = j;
			} else {
				score[i + 1][j + 1] = Math.min(score[i][j], Math.min(score[i + 1][j], score[i][j + 1])) + 1;
			}
			score[i + 1][j + 1] = Math.min(score[i + 1][j + 1], score[i1] ? score[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1) : Infinity);
		}
		sd[source[i - 1]] = i;
	}
	return score[m + 1][n + 1];
};

String.prototype.isNumeric = String.prototype.isNumeric || function () {
	return !isNaN(parseFloat(this)) && isFinite(this);
};

String.prototype.last = String.prototype.last || function () {
	return this[this.length - 1];
};

String.prototype.escapeRegexp = String.prototype.escapeRegexp || function () {
	return this.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
};

String.prototype.toUrlified = String.prototype.toUrlified || function () {
	return encodeURIComponent(this.toLowerCase()).toLowerCase();
};

String.prototype.toChunks = String.prototype.toChunks || function (size) {
	// https://stackoverflow.com/a/29202760/5987433
	const numChunks = Math.ceil(this.length / size);
	const chunks = new Array(numChunks);
	for (let i = 0, o = 0; i < numChunks; ++i, o += size) chunks[i] = this.substr(o, size);
	return chunks;
};

String.prototype.toAscii = String.prototype.toAscii || function () {
	return this
		.normalize("NFD") // replace diacritics with their individual graphemes
		.replace(/[\u0300-\u036f]/g, "") // remove accent graphemes
		.replace(/Æ/g, "AE").replace(/æ/g, "ae");
};

String.prototype.trimChar = String.prototype.trimChar || function (ch) {
	let start = 0; let end = this.length;
	while (start < end && this[start] === ch) ++start;
	while (end > start && this[end - 1] === ch) --end;
	return (start > 0 || end < this.length) ? this.substring(start, end) : this;
};

String.prototype.trimAnyChar = String.prototype.trimAnyChar || function (chars) {
	let start = 0; let end = this.length;
	while (start < end && chars.indexOf(this[start]) >= 0) ++start;
	while (end > start && chars.indexOf(this[end - 1]) >= 0) --end;
	return (start > 0 || end < this.length) ? this.substring(start, end) : this;
};

Array.prototype.joinConjunct || Object.defineProperty(Array.prototype, "joinConjunct", {
	enumerable: false,
	writable: true,
	value: function (joiner, lastJoiner, nonOxford) {
		if (this.length === 0) return "";
		if (this.length === 1) return this[0];
		if (this.length === 2) return this.join(lastJoiner);
		else {
			let outStr = "";
			for (let i = 0; i < this.length; ++i) {
				outStr += this[i];
				if (i < this.length - 2) outStr += joiner;
				else if (i === this.length - 2) outStr += `${(!nonOxford && this.length > 2 ? joiner.trim() : "")}${lastJoiner}`;
			}
			return outStr;
		}
	},
});

globalThis.StrUtil = {
	COMMAS_NOT_IN_PARENTHESES_REGEX: /,\s?(?![^(]*\))/g,
	COMMA_SPACE_NOT_IN_PARENTHESES_REGEX: /, (?![^(]*\))/g,

	uppercaseFirst: function (string) {
		return string.uppercaseFirst();
	},
	// Certain minor words should be left lowercase unless they are the first or last words in the string
	TITLE_LOWER_WORDS: ["a", "an", "the", "and", "but", "or", "for", "nor", "as", "at", "by", "for", "from", "in", "into", "near", "of", "on", "onto", "to", "with", "over", "von"],
	// Certain words such as initialisms or acronyms should be left uppercase
	TITLE_UPPER_WORDS: ["Id", "Tv", "Dm", "Ok", "Npc", "Pc", "Tpk", "Wip"],

	padNumber: (n, len, padder) => {
		return String(n).padStart(len, padder);
	},

	elipsisTruncate (str, atLeastPre = 5, atLeastSuff = 0, maxLen = 20) {
		if (maxLen >= str.length) return str;

		maxLen = Math.max(atLeastPre + atLeastSuff + 3, maxLen);
		let out = "";
		let remain = maxLen - (3 + atLeastPre + atLeastSuff);
		for (let i = 0; i < str.length - atLeastSuff; ++i) {
			const c = str[i];
			if (i < atLeastPre) out += c;
			else if ((remain--) > 0) out += c;
		}
		if (remain < 0) out += "...";
		out += str.substring(str.length - atLeastSuff, str.length);
		return out;
	},

	toTitleCase (str) { return str.toTitleCase(); },
	qq (str) { return (str = str || "").qq(); },
};

globalThis.CleanUtil = {
	getCleanJson (data, {isMinify = false, isFast = true} = {}) {
		data = MiscUtil.copy(data);
		data = MiscUtil.getWalker().walk(data, {string: (str) => CleanUtil.getCleanString(str, {isFast})});
		let str = isMinify ? JSON.stringify(data) : `${JSON.stringify(data, null, "\t")}\n`;
		return str.replace(CleanUtil.STR_REPLACEMENTS_REGEX, (match) => CleanUtil.STR_REPLACEMENTS[match]);
	},

	getCleanString (str, {isFast = true} = {}) {
		str = str
			.replace(CleanUtil.SHARED_REPLACEMENTS_REGEX, (match) => CleanUtil.SHARED_REPLACEMENTS[match])
			.replace(CleanUtil._SOFT_HYPHEN_REMOVE_REGEX, "")
		;

		if (isFast) return str;

		const ptrStack = {_: ""};
		CleanUtil._getCleanString_walkerStringHandler(ptrStack, 0, str);
		return ptrStack._;
	},

	_getCleanString_walkerStringHandler (ptrStack, tagCount, str) {
		const tagSplit = Renderer.splitByTags(str);
		const len = tagSplit.length;
		for (let i = 0; i < len; ++i) {
			const s = tagSplit[i];
			if (!s) continue;
			if (s.startsWith("{@")) {
				const [tag, text] = Renderer.splitFirstSpace(s.slice(1, -1));

				ptrStack._ += `{${tag}${text.length ? " " : ""}`;
				this._getCleanString_walkerStringHandler(ptrStack, tagCount + 1, text);
				ptrStack._ += `}`;
			} else {
				// avoid tagging things wrapped in existing tags
				if (tagCount) {
					ptrStack._ += s;
				} else {
					ptrStack._ += s
						.replace(CleanUtil._DASH_COLLAPSE_REGEX, "$1")
						.replace(CleanUtil._ELLIPSIS_COLLAPSE_REGEX, "$1");
				}
			}
		}
	},
};
CleanUtil.SHARED_REPLACEMENTS = {
	"’": "'",
	"‘": "'",
	"": "'",
	"…": "...",
	"\u200B": ``, // zero-width space
	"ﬀ": "ff",
	"ﬃ": "ffi",
	"ﬄ": "ffl",
	"ﬁ": "fi",
	"ﬂ": "fl",
	"Ĳ": "IJ",
	"ĳ": "ij",
	"Ǉ": "LJ",
	"ǈ": "Lj",
	"ǉ": "lj",
	"Ǌ": "NJ",
	"ǋ": "Nj",
	"ǌ": "nj",
	"ﬅ": "ft",
	"“": `"`,
	"”": `"`,
};
CleanUtil.STR_REPLACEMENTS = {
	"—": "\\u2014",
	"–": "\\u2013",
	"‑": "\\u2011",
	"−": "\\u2212",
	" ": "\\u00A0",
};
CleanUtil.SHARED_REPLACEMENTS_REGEX = new RegExp(Object.keys(CleanUtil.SHARED_REPLACEMENTS).join("|"), "g");
CleanUtil.STR_REPLACEMENTS_REGEX = new RegExp(Object.keys(CleanUtil.STR_REPLACEMENTS).join("|"), "g");
CleanUtil._SOFT_HYPHEN_REMOVE_REGEX = /\u00AD *\r?\n?\r?/g;
CleanUtil._ELLIPSIS_COLLAPSE_REGEX = /\s*(\.\s*\.\s*\.)/g;
CleanUtil._DASH_COLLAPSE_REGEX = /[ ]*([\u2014\u2013])[ ]*/g;

// SOURCES =============================================================================================================
globalThis.SourceUtil = {
	ADV_BOOK_GROUPS: [
		{group: "core", displayName: "Core"},
		{group: "supplement", displayName: "Supplements"},
		{group: "setting", displayName: "Settings"},
		{group: "supplement-alt", displayName: "Extras"},
		{group: "prerelease", displayName: "Prerelease"},
		{group: "homebrew", displayName: "Homebrew"},
		{group: "screen", displayName: "Screens"},
		{group: "other", displayName: "Miscellaneous"},
	],

	_subclassReprintLookup: {},
	async pInitSubclassReprintLookup () {
		SourceUtil._subclassReprintLookup = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/generated/gendata-subclass-lookup.json`);
	},

	isSubclassReprinted (className, classSource, subclassShortName, subclassSource) {
		const fromLookup = MiscUtil.get(SourceUtil._subclassReprintLookup, classSource, className, subclassSource, subclassShortName);
		return fromLookup ? fromLookup.isReprinted : false;
	},

	/** I.e., not homebrew. */
	isSiteSource (source) { return !!Parser.SOURCE_JSON_TO_FULL[source]; },

	isAdventure (source) {
		if (source instanceof FilterItem) source = source.item;
		return Parser.SOURCES_ADVENTURES.has(source);
	},

	isCoreOrSupplement (source) {
		if (source instanceof FilterItem) source = source.item;
		return Parser.SOURCES_CORE_SUPPLEMENTS.has(source);
	},

	isNonstandardSource (source) {
		if (source == null) return false;
		return (
			(typeof BrewUtil2 === "undefined" || !BrewUtil2.hasSourceJson(source))
				&& SourceUtil.isNonstandardSourceWotc(source)
		)
			|| SourceUtil.isPrereleaseSource(source);
	},

	// TODO(Future) remove this in favor of simply checking existence in `PrereleaseUtil`
	// TODO(Future) cleanup uses of `PrereleaseUtil.hasSourceJson` to match
	isPrereleaseSource (source) {
		if (source == null) return false;
		if (typeof PrereleaseUtil !== "undefined" && PrereleaseUtil.hasSourceJson(source)) return true;
		return source.startsWith(Parser.SRC_UA_PREFIX)
			|| source.startsWith(Parser.SRC_UA_ONE_PREFIX);
	},

	isNonstandardSourceWotc (source) {
		return source.startsWith(Parser.SRC_UA_PREFIX) || source.startsWith(Parser.SRC_UA_ONE_PREFIX) || source.startsWith(Parser.SRC_PS_PREFIX) || source.startsWith(Parser.SRC_AL_PREFIX) || source.startsWith(Parser.SRC_MCVX_PREFIX) || Parser.SOURCES_NON_STANDARD_WOTC.has(source);
	},

	getFilterGroup (source) {
		if (source instanceof FilterItem) source = source.item;
		if (typeof PrereleaseUtil !== "undefined" && PrereleaseUtil.hasSourceJson(source)) return 1;
		if (typeof BrewUtil2 !== "undefined" && BrewUtil2.hasSourceJson(source)) return 2;
		return Number(SourceUtil.isNonstandardSource(source));
	},

	getAdventureBookSourceHref (source, page) {
		if (!source) return null;
		source = source.toLowerCase();

		// TODO this could be made to work with homebrew
		let docPage, mappedSource;
		if (Parser.SOURCES_AVAILABLE_DOCS_BOOK[source]) {
			docPage = UrlUtil.PG_BOOK;
			mappedSource = Parser.SOURCES_AVAILABLE_DOCS_BOOK[source];
		} else if (Parser.SOURCES_AVAILABLE_DOCS_ADVENTURE[source]) {
			docPage = UrlUtil.PG_ADVENTURE;
			mappedSource = Parser.SOURCES_AVAILABLE_DOCS_ADVENTURE[source];
		}
		if (!docPage) return null;

		mappedSource = mappedSource.toLowerCase();

		return `${docPage}#${[mappedSource, page ? `page:${page}` : null].filter(Boolean).join(HASH_PART_SEP)}`;
	},

	getEntitySource (it) { return it.source || it.inherits?.source; },
};

// CURRENCY ============================================================================================================
globalThis.CurrencyUtil = {
	/**
	 * Convert 10 gold -> 1 platinum, etc.
	 * @param obj Object of the form {cp: 123, sp: 456, ...} (values optional)
	 * @param [opts]
	 * @param [opts.currencyConversionId] Currency conversion table ID.
	 * @param [opts.currencyConversionTable] Currency conversion table.
	 * @param [opts.originalCurrency] Original currency object, if the current currency object is after spending coin.
	 * @param [opts.isPopulateAllValues] If all currency properties should be be populated, even if no currency of that
	 * type is being returned (i.e. zero out unused coins).
	 */
	doSimplifyCoins (obj, opts) {
		opts = opts || {};

		const conversionTable = opts.currencyConversionTable || Parser.getCurrencyConversionTable(opts.currencyConversionId);
		if (!conversionTable.length) return obj;

		const normalized = conversionTable
			.map(it => {
				return {
					...it,
					normalizedMult: 1 / it.mult,
				};
			})
			.sort((a, b) => SortUtil.ascSort(a.normalizedMult, b.normalizedMult));

		// Simplify currencies
		for (let i = 0; i < normalized.length - 1; ++i) {
			const coinCur = normalized[i].coin;
			const coinNxt = normalized[i + 1].coin;
			const coinRatio = normalized[i + 1].normalizedMult / normalized[i].normalizedMult;

			if (obj[coinCur] && Math.abs(obj[coinCur]) >= coinRatio) {
				const nxtVal = obj[coinCur] >= 0 ? Math.floor(obj[coinCur] / coinRatio) : Math.ceil(obj[coinCur] / coinRatio);
				obj[coinCur] = obj[coinCur] % coinRatio;
				obj[coinNxt] = (obj[coinNxt] || 0) + nxtVal;
			}
		}

		// Note: this assumes that we, overall, lost money.
		if (opts.originalCurrency) {
			const normalizedHighToLow = MiscUtil.copyFast(normalized).reverse();

			// For each currency, look at the previous coin's diff. Say, for gp, that it is -1pp. That means we could have
			//   gained up to 10gp as change. So we can have <original gold or 0> + <10gp> max gold; the rest is converted
			//   to sp. Repeat to the end.
			// Never allow more highest-value currency (i.e. pp) than we originally had.
			normalizedHighToLow
				.forEach((coinMeta, i) => {
					const valOld = opts.originalCurrency[coinMeta.coin] || 0;
					const valNew = obj[coinMeta.coin] || 0;

					const prevCoinMeta = normalizedHighToLow[i - 1];
					const nxtCoinMeta = normalizedHighToLow[i + 1];

					if (!prevCoinMeta) { // Handle the biggest currency, e.g. platinum--never allow it to increase
						if (nxtCoinMeta) {
							const diff = valNew - valOld;
							if (diff > 0) {
								obj[coinMeta.coin] = valOld;
								const coinRatio = coinMeta.normalizedMult / nxtCoinMeta.normalizedMult;
								obj[nxtCoinMeta.coin] = (obj[nxtCoinMeta.coin] || 0) + (diff * coinRatio);
							}
						}
					} else {
						if (nxtCoinMeta) {
							const diffPrevCoin = (opts.originalCurrency[prevCoinMeta.coin] || 0) - (obj[prevCoinMeta.coin] || 0);
							const coinRatio = prevCoinMeta.normalizedMult / coinMeta.normalizedMult;
							const capFromOld = valOld + (diffPrevCoin > 0 ? diffPrevCoin * coinRatio : 0);
							const diff = valNew - capFromOld;
							if (diff > 0) {
								obj[coinMeta.coin] = capFromOld;
								const coinRatio = coinMeta.normalizedMult / nxtCoinMeta.normalizedMult;
								obj[nxtCoinMeta.coin] = (obj[nxtCoinMeta.coin] || 0) + (diff * coinRatio);
							}
						}
					}
				});
		}

		normalized
			.filter(coinMeta => obj[coinMeta.coin] === 0 || obj[coinMeta.coin] == null)
			.forEach(coinMeta => {
				// First set the value to null, in case we're dealing with a class instance that has setters
				obj[coinMeta.coin] = null;
				delete obj[coinMeta.coin];
			});

		if (opts.isPopulateAllValues) normalized.forEach(coinMeta => obj[coinMeta.coin] = obj[coinMeta.coin] || 0);

		return obj;
	},

	/**
	 * Convert a collection of coins into an equivalent value in copper.
	 * @param obj Object of the form {cp: 123, sp: 456, ...} (values optional)
	 */
	getAsCopper (obj) {
		return Parser.FULL_CURRENCY_CONVERSION_TABLE
			.map(currencyMeta => (obj[currencyMeta.coin] || 0) * (1 / currencyMeta.mult))
			.reduce((a, b) => a + b, 0);
	},

	/**
	 * Convert a collection of coins into an equivalent number of coins of the highest denomination.
	 * @param obj Object of the form {cp: 123, sp: 456, ...} (values optional)
	 */
	getAsSingleCurrency (obj) {
		const simplified = CurrencyUtil.doSimplifyCoins({...obj});

		if (Object.keys(simplified).length === 1) return simplified;

		const out = {};

		const targetDemonination = Parser.FULL_CURRENCY_CONVERSION_TABLE.find(it => simplified[it.coin]);

		out[targetDemonination.coin] = simplified[targetDemonination.coin];
		delete simplified[targetDemonination.coin];

		Object.entries(simplified)
			.forEach(([coin, amt]) => {
				const denom = Parser.FULL_CURRENCY_CONVERSION_TABLE.find(it => it.coin === coin);
				out[targetDemonination.coin] = (out[targetDemonination.coin] || 0) + (amt / denom.mult) * targetDemonination.mult;
			});

		return out;
	},
};

// CONVENIENCE/ELEMENTS ================================================================================================
Math.seed = Math.seed || function (s) {
	return function () {
		s = Math.sin(s) * 10000;
		return s - Math.floor(s);
	};
};

globalThis.JqueryUtil = {
	_isEnhancementsInit: false,
	initEnhancements () {
		if (JqueryUtil._isEnhancementsInit) return;
		JqueryUtil._isEnhancementsInit = true;

		JqueryUtil.addSelectors();

		/**
		 * Template strings which can contain jQuery objects.
		 * Usage: $$`<div>Press this button: ${$btn}</div>`
		 * @return JQuery
		 */
		window.$$ = function (parts, ...args) {
			if (parts instanceof jQuery || parts instanceof HTMLElement) {
				return (...passed) => {
					const parts2 = [...passed[0]];
					const args2 = passed.slice(1);
					parts2[0] = `<div>${parts2[0]}`;
					parts2.last(`${parts2.last()}</div>`);

					const $temp = $$(parts2, ...args2);
					$temp.children().each((i, e) => $(e).appendTo(parts));
					return parts;
				};
			} else {
				const $eles = [];
				let ixArg = 0;

				const handleArg = (arg) => {
					if (arg instanceof $) {
						$eles.push(arg);
						return `<${arg.tag()} data-r="true"></${arg.tag()}>`;
					} else if (arg instanceof HTMLElement) {
						return handleArg($(arg));
					} else return arg;
				};

				const raw = parts.reduce((html, p) => {
					const myIxArg = ixArg++;
					if (args[myIxArg] == null) return `${html}${p}`;
					if (args[myIxArg] instanceof Array) return `${html}${args[myIxArg].map(arg => handleArg(arg)).join("")}${p}`;
					else return `${html}${handleArg(args[myIxArg])}${p}`;
				});
				const $res = $(raw);

				if ($res.length === 1) {
					if ($res.attr("data-r") === "true") return $eles[0];
					else $res.find(`[data-r=true]`).replaceWith(i => $eles[i]);
				} else {
					// Handle case where user has passed in a bunch of elements with no outer wrapper
					const $tmp = $(`<div></div>`);
					$tmp.append($res);
					$tmp.find(`[data-r=true]`).replaceWith(i => $eles[i]);
					return $tmp.children();
				}

				return $res;
			}
		};

		$.fn.extend({
			// avoid setting input type to "search" as it visually offsets the contents of the input
			disableSpellcheck: function () { return this.attr("autocomplete", "new-password").attr("autocapitalize", "off").attr("spellcheck", "false"); },
			tag: function () { return this.prop("tagName").toLowerCase(); },
			title: function (...args) { return this.attr("title", ...args); },
			placeholder: function (...args) { return this.attr("placeholder", ...args); },
			disable: function () { return this.attr("disabled", true); },

			/**
			 * Quickly set the innerHTML of the innermost element, without parsing the whole thing with jQuery.
			 * Useful for populating e.g. a table row.
			 */
			fastSetHtml: function (html) {
				if (!this.length) return this;
				let tgt = this[0];
				while (tgt.children.length) {
					tgt = tgt.children[0];
				}
				tgt.innerHTML = html;
				return this;
			},

			blurOnEsc: function () {
				return this.keydown(evt => {
					if (evt.which === 27) this.blur(); // escape
				});
			},

			hideVe: function () { return this.addClass("ve-hidden"); },
			showVe: function () { return this.removeClass("ve-hidden"); },
			toggleVe: function (val) {
				if (val === undefined) return this.toggleClass("ve-hidden", !this.hasClass("ve-hidden"));
				else return this.toggleClass("ve-hidden", !val);
			},
		});

		$.event.special.destroyed = {
			remove: function (o) {
				if (o.handler) o.handler();
			},
		};
	},

	addSelectors () {
		// Add a selector to match exact text (case insensitive) to jQuery's arsenal
		//   Note that the search text should be `trim().toLowerCase()`'d before being passed in
		$.expr[":"].textEquals = (el, i, m) => $(el).text().toLowerCase().trim() === m[3].unescapeQuotes();

		// Add a selector to match contained text (case insensitive)
		$.expr[":"].containsInsensitive = (el, i, m) => {
			const searchText = m[3];
			const textNode = $(el).contents().filter((i, e) => e.nodeType === 3)[0];
			if (!textNode) return false;
			const match = textNode.nodeValue.toLowerCase().trim().match(`${searchText.toLowerCase().trim().escapeRegexp()}`);
			return match && match.length > 0;
		};
	},

	showCopiedEffect (eleOr$Ele, text = "Copied!", bubble) {
		const $ele = eleOr$Ele instanceof $ ? eleOr$Ele : $(eleOr$Ele);

		const top = $(window).scrollTop();
		const pos = $ele.offset();

		const animationOptions = {
			top: "-=8",
			opacity: 0,
		};
		if (bubble) {
			animationOptions.left = `${Math.random() > 0.5 ? "-" : "+"}=${~~(Math.random() * 17)}`;
		}
		const seed = Math.random();
		const duration = bubble ? 250 + seed * 200 : 250;
		const offsetY = bubble ? 16 : 0;

		const $dispCopied = $(`<div class="clp__disp-copied ve-flex-vh-center py-2 px-4"></div>`);
		$dispCopied
			.html(text)
			.css({
				top: (pos.top - 24) + offsetY - top,
				left: pos.left + ($ele.width() / 2),
			})
			.appendTo(document.body)
			.animate(
				animationOptions,
				{
					duration,
					complete: () => $dispCopied.remove(),
					progress: (_, progress) => { // progress is 0..1
						if (bubble) {
							const diffProgress = 0.5 - progress;
							animationOptions.top = `${diffProgress > 0 ? "-" : "+"}=40`;
							$dispCopied.css("transform", `rotate(${seed > 0.5 ? "-" : ""}${seed * 500 * progress}deg)`);
						}
					},
				},
			);
	},

	_dropdownInit: false,
	bindDropdownButton ($ele) {
		if (!JqueryUtil._dropdownInit) {
			JqueryUtil._dropdownInit = true;
			document.addEventListener("click", () => [...document.querySelectorAll(`.open`)].filter(ele => !(ele.className || "").split(" ").includes(`dropdown--navbar`)).forEach(ele => ele.classList.remove("open")));
		}
		$ele.click(() => setTimeout(() => $ele.parent().addClass("open"), 1)); // defer to allow the above to complete
	},

	_WRP_TOAST: null,
	_ACTIVE_TOAST: [],
	/**
	 * @param {{content: jQuery|string, type?: string, autoHideTime?: boolean} | string} options The options for the toast.
	 * @param {(jQuery|string)} options.content Toast contents. Supports jQuery objects.
	 * @param {string} options.type Toast type. Can be any Bootstrap alert type ("success", "info", "warning", or "danger").
	 * @param {number} options.autoHideTime The time in ms before the toast will be automatically hidden.
	 * Defaults to 5000 ms.
	 * @param {boolean} options.isAutoHide
	 */
	doToast (options) {
		if (typeof window === "undefined") return;

		if (JqueryUtil._WRP_TOAST == null) {
			JqueryUtil._WRP_TOAST = e_({
				tag: "div",
				clazz: "toast__container no-events w-100 overflow-y-hidden ve-flex-col",
			});
			document.body.appendChild(JqueryUtil._WRP_TOAST);
		}

		if (typeof options === "string") {
			options = {
				content: options,
				type: "info",
			};
		}
		options.type = options.type || "info";

		options.isAutoHide = options.isAutoHide ?? true;
		options.autoHideTime = options.autoHideTime ?? 5000;

		const eleToast = e_({
			tag: "div",
			clazz: `toast toast--type-${options.type} events-initial relative my-2 mx-auto`,
			children: [
				e_({
					tag: "div",
					clazz: "toast__wrp-content",
					children: [
						options.content instanceof $ ? options.content[0] : options.content,
					],
				}),
				e_({
					tag: "div",
					clazz: "toast__wrp-control",
					children: [
						e_({
							tag: "button",
							clazz: "btn toast__btn-close",
							children: [
								e_({
									tag: "span",
									clazz: "glyphicon glyphicon-remove",
								}),
							],
						}),
					],
				}),
			],
			mousedown: evt => {
				evt.preventDefault();
			},
			click: evt => {
				evt.preventDefault();
				JqueryUtil._doToastCleanup(toastMeta);

				// Close all on SHIFT-click
				if (!evt.shiftKey) return;
				[...JqueryUtil._ACTIVE_TOAST].forEach(toastMeta => JqueryUtil._doToastCleanup(toastMeta));
			},
		});

		// FIXME(future) this could be smoother; when stacking multiple tooltips, the incoming tooltip bumps old tooltips
		//   down instantly (should be animated).
		//   See e.g.:
		//   `[...new Array(10)].forEach((_, i) => MiscUtil.pDelay(i * 50).then(() => JqueryUtil.doToast(`test ${i}`)))`
		eleToast.prependTo(JqueryUtil._WRP_TOAST);

		const toastMeta = {isAutoHide: !!options.isAutoHide, eleToast};
		JqueryUtil._ACTIVE_TOAST.push(toastMeta);

		AnimationUtil.pRecomputeStyles()
			.then(() => {
				eleToast.addClass(`toast--animate`);

				if (options.isAutoHide) {
					setTimeout(() => {
						JqueryUtil._doToastCleanup(toastMeta);
					}, options.autoHideTime);
				}

				if (JqueryUtil._ACTIVE_TOAST.length >= 3) {
					JqueryUtil._ACTIVE_TOAST
						.filter(({isAutoHide}) => !isAutoHide)
						.forEach(toastMeta => {
							JqueryUtil._doToastCleanup(toastMeta);
						});
				}
			});
	},

	_doToastCleanup (toastMeta) {
		toastMeta.eleToast.removeClass("toast--animate");
		JqueryUtil._ACTIVE_TOAST.splice(JqueryUtil._ACTIVE_TOAST.indexOf(toastMeta), 1);
		setTimeout(() => toastMeta.eleToast.parentElement && toastMeta.eleToast.remove(), 85);
	},

	isMobile () {
		if (navigator?.userAgentData?.mobile) return true;
		// Equivalent to `$width-screen-sm`
		return window.matchMedia("(max-width: 768px)").matches;
	},
};

if (typeof window !== "undefined") window.addEventListener("load", JqueryUtil.initEnhancements);

globalThis.ElementUtil = {
	_ATTRS_NO_FALSY: new Set([
		"checked",
		"disabled",
	]),

	getOrModify ({
		tag,
		clazz,
		style,
		click,
		contextmenu,
		change,
		mousedown,
		mouseup,
		mousemove,
		pointerdown,
		pointerup,
		keydown,
		html,
		text,
		txt,
		ele,
		children,
		outer,

		id,
		name,
		title,
		val,
		href,
		type,
		tabindex,
		value,
		attrs,
		data,
	}) {
		ele = ele || (outer ? (new DOMParser()).parseFromString(outer, "text/html").body.childNodes[0] : document.createElement(tag));

		if (clazz) ele.className = clazz;
		if (style) ele.setAttribute("style", style);
		if (click) ele.addEventListener("click", click);
		if (contextmenu) ele.addEventListener("contextmenu", contextmenu);
		if (change) ele.addEventListener("change", change);
		if (mousedown) ele.addEventListener("mousedown", mousedown);
		if (mouseup) ele.addEventListener("mouseup", mouseup);
		if (mousemove) ele.addEventListener("mousemove", mousemove);
		if (pointerdown) ele.addEventListener("pointerdown", pointerdown);
		if (pointerup) ele.addEventListener("pointerup", pointerup);
		if (keydown) ele.addEventListener("keydown", keydown);
		if (html != null) ele.innerHTML = html;
		if (text != null || txt != null) ele.textContent = text;
		if (id != null) ele.setAttribute("id", id);
		if (name != null) ele.setAttribute("name", name);
		if (title != null) ele.setAttribute("title", title);
		if (href != null) ele.setAttribute("href", href);
		if (val != null) ele.setAttribute("value", val);
		if (type != null) ele.setAttribute("type", type);
		if (tabindex != null) ele.setAttribute("tabindex", tabindex);
		if (value != null) ele.setAttribute("value", value);

		if (attrs != null) {
			for (const k in attrs) {
				if (attrs[k] === undefined) continue;
				if (!attrs[k] && ElementUtil._ATTRS_NO_FALSY.has(k)) continue;
				ele.setAttribute(k, attrs[k]);
			}
		}

		if (data != null) { for (const k in data) { if (data[k] === undefined) continue; ele.dataset[k] = data[k]; } }

		if (children) for (let i = 0, len = children.length; i < len; ++i) if (children[i] != null) ele.append(children[i]);

		ele.appends = ele.appends || ElementUtil._appends.bind(ele);
		ele.appendTo = ele.appendTo || ElementUtil._appendTo.bind(ele);
		ele.prependTo = ele.prependTo || ElementUtil._prependTo.bind(ele);
		ele.addClass = ele.addClass || ElementUtil._addClass.bind(ele);
		ele.removeClass = ele.removeClass || ElementUtil._removeClass.bind(ele);
		ele.toggleClass = ele.toggleClass || ElementUtil._toggleClass.bind(ele);
		ele.showVe = ele.showVe || ElementUtil._showVe.bind(ele);
		ele.hideVe = ele.hideVe || ElementUtil._hideVe.bind(ele);
		ele.toggleVe = ele.toggleVe || ElementUtil._toggleVe.bind(ele);
		ele.empty = ele.empty || ElementUtil._empty.bind(ele);
		ele.detach = ele.detach || ElementUtil._detach.bind(ele);
		ele.attr = ele.attr || ElementUtil._attr.bind(ele);
		ele.val = ele.val || ElementUtil._val.bind(ele);
		ele.html = ele.html || ElementUtil._html.bind(ele);
		ele.txt = ele.txt || ElementUtil._txt.bind(ele);
		ele.tooltip = ele.tooltip || ElementUtil._tooltip.bind(ele);
		ele.onClick = ele.onClick || ElementUtil._onClick.bind(ele);
		ele.onContextmenu = ele.onContextmenu || ElementUtil._onContextmenu.bind(ele);
		ele.onChange = ele.onChange || ElementUtil._onChange.bind(ele);

		return ele;
	},

	_appends (child) {
		this.appendChild(child);
		return this;
	},

	_appendTo (parent) {
		parent.appendChild(this);
		return this;
	},

	_prependTo (parent) {
		parent.prepend(this);
		return this;
	},

	_addClass (clazz) {
		this.classList.add(clazz);
		return this;
	},

	_removeClass (clazz) {
		this.classList.remove(clazz);
		return this;
	},

	_toggleClass (clazz, isActive) {
		if (isActive == null) this.classList.toggle(clazz);
		else if (isActive) this.classList.add(clazz);
		else this.classList.remove(clazz);
		return this;
	},

	_showVe () {
		this.classList.remove("ve-hidden");
		return this;
	},

	_hideVe () {
		this.classList.add("ve-hidden");
		return this;
	},

	_toggleVe (isActive) {
		this.toggleClass("ve-hidden", isActive == null ? isActive : !isActive);
		return this;
	},

	_empty () {
		this.innerHTML = "";
		return this;
	},

	_detach () {
		if (this.parentElement) this.parentElement.removeChild(this);
		return this;
	},

	_attr (name, value) {
		this.setAttribute(name, value);
		return this;
	},

	_html (html) {
		if (html === undefined) return this.innerHTML;
		this.innerHTML = html;
		return this;
	},

	_txt (txt) {
		if (txt === undefined) return this.innerText;
		this.innerText = txt;
		return this;
	},

	_tooltip (title) {
		return this.attr("title", title);
	},

	_onClick (fn) { return ElementUtil._onX(this, "click", fn); },
	_onContextmenu (fn) { return ElementUtil._onX(this, "contextmenu", fn); },
	_onChange (fn) { return ElementUtil._onX(this, "change", fn); },

	_onX (ele, evtName, fn) { ele.addEventListener(evtName, fn); return ele; },

	_val (val) {
		if (val !== undefined) {
			switch (this.tagName) {
				case "SELECT": {
					let selectedIndexNxt = -1;
					for (let i = 0, len = this.options.length; i < len; ++i) {
						if (this.options[i]?.value === val) { selectedIndexNxt = i; break; }
					}
					this.selectedIndex = selectedIndexNxt;
					return this;
				}

				default: {
					this.value = val;
					return this;
				}
			}
		}

		switch (this.tagName) {
			case "SELECT": return this.options[this.selectedIndex]?.value;

			default: return this.value;
		}
	},

	// region "Static"
	getIndexPathToParent (parent, child) {
		if (!parent.contains(child)) return null;

		const path = [];

		while (child !== parent) {
			if (!child.parentElement) return null;

			const ix = [...child.parentElement.children].indexOf(child);
			if (!~ix) return null;

			path.push(ix);

			child = child.parentElement;
		}

		return path.reverse();
	},

	getChildByIndexPath (parent, indexPath) {
		for (let i = 0; i < indexPath.length; ++i) {
			const ix = indexPath[i];
			parent = parent.children[ix];
			if (!parent) return null;
		}
		return parent;
	},
	// endregion
};

if (typeof window !== "undefined") window.e_ = ElementUtil.getOrModify;

globalThis.ObjUtil = {
	async pForEachDeep (source, pCallback, options = {depth: Infinity, callEachLevel: false}) {
		const path = [];
		const pDiveDeep = async function (val, path, depth = 0) {
			if (options.callEachLevel || typeof val !== "object" || options.depth === depth) {
				await pCallback(val, path, depth);
			}
			if (options.depth !== depth && typeof val === "object") {
				for (const key of Object.keys(val)) {
					path.push(key);
					await pDiveDeep(val[key], path, depth + 1);
				}
			}
			path.pop();
		};
		await pDiveDeep(source, path);
	},
};

// TODO refactor other misc utils into this
globalThis.MiscUtil = {
	COLOR_HEALTHY: "#00bb20",
	COLOR_HURT: "#c5ca00",
	COLOR_BLOODIED: "#f7a100",
	COLOR_DEFEATED: "#cc0000",

	/**
	 * @param obj
	 * @param isSafe
	 * @param isPreserveUndefinedValueKeys Otherwise, drops the keys of `undefined` values
	 * (e.g. `{a: undefined}` -> `{}`).
	 */
	copy (obj, {isSafe = false, isPreserveUndefinedValueKeys = false} = {}) {
		if (isSafe && obj === undefined) return undefined; // Generally use "unsafe," as this helps identify bugs.
		return JSON.parse(JSON.stringify(obj));
	},

	copyFast (obj) {
		if ((typeof obj !== "object") || obj == null) return obj;

		if (obj instanceof Array) return obj.map(MiscUtil.copyFast);

		const cpy = {};
		for (const k of Object.keys(obj)) cpy[k] = MiscUtil.copyFast(obj[k]);
		return cpy;
	},

	async pCopyTextToClipboard (text) {
		function doCompatibilityCopy () {
			const $iptTemp = $(`<textarea class="clp__wrp-temp"></textarea>`)
				.appendTo(document.body)
				.val(text)
				.select();
			document.execCommand("Copy");
			$iptTemp.remove();
		}

		if (navigator && navigator.permissions) {
			try {
				const access = await navigator.permissions.query({name: "clipboard-write"});
				if (access.state === "granted" || access.state === "prompt") {
					await navigator.clipboard.writeText(text);
				} else doCompatibilityCopy();
			} catch (e) { doCompatibilityCopy(); }
		} else doCompatibilityCopy();
	},

	checkProperty (object, ...path) {
		for (let i = 0; i < path.length; ++i) {
			object = object[path[i]];
			if (object == null) return false;
		}
		return true;
	},

	get (object, ...path) {
		if (object == null) return null;
		for (let i = 0; i < path.length; ++i) {
			object = object[path[i]];
			if (object == null) return object;
		}
		return object;
	},

	set (object, ...pathAndVal) {
		if (object == null) return null;

		const val = pathAndVal.pop();
		if (!pathAndVal.length) return null;

		const len = pathAndVal.length;
		for (let i = 0; i < len; ++i) {
			const pathPart = pathAndVal[i];
			if (i === len - 1) object[pathPart] = val;
			else object = (object[pathPart] = object[pathPart] || {});
		}

		return val;
	},

	getOrSet (object, ...pathAndVal) {
		if (pathAndVal.length < 2) return null;
		const existing = MiscUtil.get(object, ...pathAndVal.slice(0, -1));
		return existing || MiscUtil.set(object, ...pathAndVal);
	},

	getThenSetCopy (object1, object2, ...path) {
		const val = MiscUtil.get(object1, ...path);
		return MiscUtil.set(object2, ...path, MiscUtil.copyFast(val, {isSafe: true}));
	},

	delete (object, ...path) {
		if (object == null) return object;
		for (let i = 0; i < path.length - 1; ++i) {
			object = object[path[i]];
			if (object == null) return object;
		}
		return delete object[path.last()];
	},

	/** Delete a prop from a nested object, then all now-empty objects backwards from that point. */
	deleteObjectPath (object, ...path) {
		const stack = [object];

		if (object == null) return object;
		for (let i = 0; i < path.length - 1; ++i) {
			object = object[path[i]];
			stack.push(object);
			if (object === undefined) return object;
		}
		const out = delete object[path.last()];

		for (let i = path.length - 1; i > 0; --i) {
			if (!Object.keys(stack[i]).length) delete stack[i - 1][path[i - 1]];
		}

		return out;
	},

	merge (obj1, obj2) {
		obj2 = MiscUtil.copyFast(obj2);

		Object.entries(obj2)
			.forEach(([k, v]) => {
				if (obj1[k] == null) {
					obj1[k] = v;
					return;
				}

				if (
					typeof obj1[k] === "object"
					&& typeof v === "object"
					&& !(obj1[k] instanceof Array)
					&& !(v instanceof Array)
				) {
					MiscUtil.merge(obj1[k], v);
					return;
				}

				obj1[k] = v;
			});

		return obj1;
	},

	/**
	 * @deprecated
	 */
	mix: (superclass) => new MiscUtil._MixinBuilder(superclass),
	_MixinBuilder: function (superclass) {
		this.superclass = superclass;

		this.with = function (...mixins) {
			return mixins.reduce((c, mixin) => mixin(c), this.superclass);
		};
	},

	clearSelection () {
		if (document.getSelection) {
			document.getSelection().removeAllRanges();
			document.getSelection().addRange(document.createRange());
		} else if (window.getSelection) {
			if (window.getSelection().removeAllRanges) {
				window.getSelection().removeAllRanges();
				window.getSelection().addRange(document.createRange());
			} else if (window.getSelection().empty) {
				window.getSelection().empty();
			}
		} else if (document.selection) {
			document.selection.empty();
		}
	},

	randomColor () {
		let r; let g; let b;
		const h = RollerUtil.randomise(30, 0) / 30;
		const i = ~~(h * 6);
		const f = h * 6 - i;
		const q = 1 - f;
		switch (i % 6) {
			case 0: r = 1; g = f; b = 0; break;
			case 1: r = q; g = 1; b = 0; break;
			case 2: r = 0; g = 1; b = f; break;
			case 3: r = 0; g = q; b = 1; break;
			case 4: r = f; g = 0; b = 1; break;
			case 5: r = 1; g = 0; b = q; break;
		}
		return `#${`00${(~~(r * 255)).toString(16)}`.slice(-2)}${`00${(~~(g * 255)).toString(16)}`.slice(-2)}${`00${(~~(b * 255)).toString(16)}`.slice(-2)}`;
	},

	/**
	 * @param hex Original hex color.
	 * @param [opts] Options object.
	 * @param [opts.bw] True if the color should be returnes as black/white depending on contrast ratio.
	 * @param [opts.dark] Color to return if a "dark" color would contrast best.
	 * @param [opts.light] Color to return if a "light" color would contrast best.
	 */
	invertColor (hex, opts) {
		opts = opts || {};

		hex = hex.slice(1); // remove #

		let r = parseInt(hex.slice(0, 2), 16);
		let g = parseInt(hex.slice(2, 4), 16);
		let b = parseInt(hex.slice(4, 6), 16);

		// http://stackoverflow.com/a/3943023/112731
		const isDark = (r * 0.299 + g * 0.587 + b * 0.114) > 186;
		if (opts.dark && opts.light) return isDark ? opts.dark : opts.light;
		else if (opts.bw) return isDark ? "#000000" : "#FFFFFF";

		r = (255 - r).toString(16); g = (255 - g).toString(16); b = (255 - b).toString(16);
		return `#${[r, g, b].map(it => it.padStart(2, "0")).join("")}`;
	},

	scrollPageTop () {
		document.body.scrollTop = document.documentElement.scrollTop = 0;
	},

	expEval (str) {
		// eslint-disable-next-line no-new-func
		return new Function(`return ${str.replace(/[^-()\d/*+.]/g, "")}`)();
	},

	parseNumberRange (input, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
		if (!input || !input.trim()) return null;

		const errInvalid = input => { throw new Error(`Could not parse range input "${input}"`); };

		const errOutOfRange = () => { throw new Error(`Number was out of range! Range was ${min}-${max} (inclusive).`); };

		const isOutOfRange = (num) => num < min || num > max;

		const addToRangeVal = (range, num) => range.add(num);

		const addToRangeLoHi = (range, lo, hi) => {
			for (let i = lo; i <= hi; ++i) range.add(i);
		};

		const clean = input.replace(/\s*/g, "");
		if (!/^((\d+-\d+|\d+),)*(\d+-\d+|\d+)$/.exec(clean)) errInvalid();

		const parts = clean.split(",");
		const out = new Set();

		for (const part of parts) {
			if (part.includes("-")) {
				const spl = part.split("-");
				const numLo = Number(spl[0]);
				const numHi = Number(spl[1]);

				if (isNaN(numLo) || isNaN(numHi) || numLo === 0 || numHi === 0 || numLo > numHi) errInvalid();

				if (isOutOfRange(numLo) || isOutOfRange(numHi)) errOutOfRange();

				if (numLo === numHi) addToRangeVal(out, numLo);
				else addToRangeLoHi(out, numLo, numHi);
				continue;
			}

			const num = Number(part);
			if (isNaN(num) || num === 0) errInvalid();

			if (isOutOfRange(num)) errOutOfRange();
			addToRangeVal(out, num);
		}

		return out;
	},

	findCommonPrefix (strArr, {isRespectWordBoundaries} = {}) {
		if (isRespectWordBoundaries) {
			return MiscUtil._findCommonPrefixSuffixWords({strArr});
		}

		let prefix = null;
		strArr.forEach(s => {
			if (prefix == null) {
				prefix = s;
				return;
			}

			const minLen = Math.min(s.length, prefix.length);
			for (let i = 0; i < minLen; ++i) {
				const cp = prefix[i];
				const cs = s[i];
				if (cp !== cs) {
					prefix = prefix.substring(0, i);
					break;
				}
			}
		});
		return prefix;
	},

	findCommonSuffix (strArr, {isRespectWordBoundaries} = {}) {
		if (!isRespectWordBoundaries) throw new Error(`Unimplemented!`);

		return MiscUtil._findCommonPrefixSuffixWords({strArr, isSuffix: true});
	},

	_findCommonPrefixSuffixWords ({strArr, isSuffix}) {
		let prefixTks = null;

		strArr
			.map(str => str.split(" "))
			.forEach(tks => {
				if (isSuffix) tks.reverse();

				if (prefixTks == null) return prefixTks = [...tks];

				const minLen = Math.min(tks.length, prefixTks.length);
				while (prefixTks.length > minLen) prefixTks.pop();

				for (let i = 0; i < minLen; ++i) {
					const cp = prefixTks[i];
					const cs = tks[i];
					if (cp !== cs) {
						prefixTks = prefixTks.slice(0, i);
						break;
					}
				}
			});

		if (isSuffix) prefixTks.reverse();

		if (!prefixTks.length) return "";

		return isSuffix
			? ` ${prefixTks.join(" ")}`
			: `${prefixTks.join(" ")} `;
	},

	/**
	 * @param fgHexTarget Target/resultant color for the foreground item
	 * @param fgOpacity Desired foreground transparency (0-1 inclusive)
	 * @param bgHex Background color
	 */
	calculateBlendedColor (fgHexTarget, fgOpacity, bgHex) {
		const fgDcTarget = CryptUtil.hex2Dec(fgHexTarget);
		const bgDc = CryptUtil.hex2Dec(bgHex);
		return ((fgDcTarget - ((1 - fgOpacity) * bgDc)) / fgOpacity).toString(16);
	},

	/**
	 * Borrowed from lodash.
	 *
	 * @param func The function to debounce.
	 * @param wait Minimum duration between calls.
	 * @param options Options object.
	 * @return {Function} The debounced function.
	 */
	debounce (func, wait, options) {
		let lastArgs; let lastThis; let maxWait; let result; let timerId; let lastCallTime; let lastInvokeTime = 0; let leading = false; let maxing = false; let trailing = true;

		wait = Number(wait) || 0;
		if (typeof options === "object") {
			leading = !!options.leading;
			maxing = "maxWait" in options;
			maxWait = maxing ? Math.max(Number(options.maxWait) || 0, wait) : maxWait;
			trailing = "trailing" in options ? !!options.trailing : trailing;
		}

		function invokeFunc (time) {
			let args = lastArgs; let thisArg = lastThis;

			lastArgs = lastThis = undefined;
			lastInvokeTime = time;
			result = func.apply(thisArg, args);
			return result;
		}

		function leadingEdge (time) {
			lastInvokeTime = time;
			timerId = setTimeout(timerExpired, wait);
			return leading ? invokeFunc(time) : result;
		}

		function remainingWait (time) {
			let timeSinceLastCall = time - lastCallTime; let timeSinceLastInvoke = time - lastInvokeTime; let result = wait - timeSinceLastCall;
			return maxing ? Math.min(result, maxWait - timeSinceLastInvoke) : result;
		}

		function shouldInvoke (time) {
			let timeSinceLastCall = time - lastCallTime; let timeSinceLastInvoke = time - lastInvokeTime;

			return (lastCallTime === undefined || (timeSinceLastCall >= wait) || (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
		}

		function timerExpired () {
			const time = Date.now();
			if (shouldInvoke(time)) {
				return trailingEdge(time);
			}
			// Restart the timer.
			timerId = setTimeout(timerExpired, remainingWait(time));
		}

		function trailingEdge (time) {
			timerId = undefined;

			if (trailing && lastArgs) return invokeFunc(time);
			lastArgs = lastThis = undefined;
			return result;
		}

		function cancel () {
			if (timerId !== undefined) clearTimeout(timerId);
			lastInvokeTime = 0;
			lastArgs = lastCallTime = lastThis = timerId = undefined;
		}

		function flush () {
			return timerId === undefined ? result : trailingEdge(Date.now());
		}

		function debounced () {
			let time = Date.now(); let isInvoking = shouldInvoke(time);
			lastArgs = arguments;
			lastThis = this;
			lastCallTime = time;

			if (isInvoking) {
				if (timerId === undefined) return leadingEdge(lastCallTime);
				if (maxing) {
					// Handle invocations in a tight loop.
					timerId = setTimeout(timerExpired, wait);
					return invokeFunc(lastCallTime);
				}
			}
			if (timerId === undefined) timerId = setTimeout(timerExpired, wait);
			return result;
		}

		debounced.cancel = cancel;
		debounced.flush = flush;
		return debounced;
	},

	// from lodash
	throttle (func, wait, options) {
		let leading = true; let trailing = true;

		if (typeof options === "object") {
			leading = "leading" in options ? !!options.leading : leading;
			trailing = "trailing" in options ? !!options.trailing : trailing;
		}

		return this.debounce(func, wait, {leading, maxWait: wait, trailing});
	},

	pDelay (msecs, resolveAs) {
		return new Promise(resolve => setTimeout(() => resolve(resolveAs), msecs));
	},

	GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST: new Set(["caption", "type", "colLabels", "colLabelGroups", "name", "colStyles", "style", "shortName", "subclassShortName", "id", "path"]),

	/**
	 * @param [opts]
	 * @param [opts.keyBlocklist]
	 * @param [opts.isAllowDeleteObjects] If returning `undefined` from an object handler should be treated as a delete.
	 * @param [opts.isAllowDeleteArrays] If returning `undefined` from an array handler should be treated as a delete.
	 * @param [opts.isAllowDeleteBooleans] (Unimplemented) // TODO
	 * @param [opts.isAllowDeleteNumbers] (Unimplemented) // TODO
	 * @param [opts.isAllowDeleteStrings] (Unimplemented) // TODO
	 * @param [opts.isDepthFirst] If array/object recursion should occur before array/object primitive handling.
	 * @param [opts.isNoModification] If the walker should not attempt to modify the data.
	 * @param [opts.isBreakOnReturn] If the walker should fast-exist on any handler returning a value.
	 */
	getWalker (opts) {
		opts = opts || {};

		if (opts.isBreakOnReturn && !opts.isNoModification) throw new Error(`"isBreakOnReturn" may only be used in "isNoModification" mode!`);

		const keyBlocklist = opts.keyBlocklist || new Set();

		const getMappedPrimitive = (obj, primitiveHandlers, lastKey, stack, prop, propPre, propPost) => {
			if (primitiveHandlers[propPre]) MiscUtil._getWalker_runHandlers({handlers: primitiveHandlers[propPre], obj, lastKey, stack});
			if (primitiveHandlers[prop]) {
				const out = MiscUtil._getWalker_applyHandlers({opts, handlers: primitiveHandlers[prop], obj, lastKey, stack});
				if (out === VeCt.SYM_WALKER_BREAK) return out;
				if (!opts.isNoModification) obj = out;
			}
			if (primitiveHandlers[propPost]) MiscUtil._getWalker_runHandlers({handlers: primitiveHandlers[propPost], obj, lastKey, stack});
			return obj;
		};

		const doObjectRecurse = (obj, primitiveHandlers, stack) => {
			for (const k of Object.keys(obj)) {
				if (keyBlocklist.has(k)) continue;

				const out = fn(obj[k], primitiveHandlers, k, stack);
				if (out === VeCt.SYM_WALKER_BREAK) return VeCt.SYM_WALKER_BREAK;
				if (!opts.isNoModification) obj[k] = out;
			}
		};

		const fn = (obj, primitiveHandlers, lastKey, stack) => {
			if (obj === null) return getMappedPrimitive(obj, primitiveHandlers, lastKey, stack, "null", "preNull", "postNull");

			switch (typeof obj) {
				case "undefined": return getMappedPrimitive(obj, primitiveHandlers, lastKey, stack, "undefined", "preUndefined", "postUndefined");
				case "boolean": return getMappedPrimitive(obj, primitiveHandlers, lastKey, stack, "boolean", "preBoolean", "postBoolean");
				case "number": return getMappedPrimitive(obj, primitiveHandlers, lastKey, stack, "number", "preNumber", "postNumber");
				case "string": return getMappedPrimitive(obj, primitiveHandlers, lastKey, stack, "string", "preString", "postString");
				case "object": {
					// region Array
					if (obj instanceof Array) {
						if (primitiveHandlers.preArray) MiscUtil._getWalker_runHandlers({handlers: primitiveHandlers.preArray, obj, lastKey, stack});
						if (opts.isDepthFirst) {
							if (stack) stack.push(obj);
							const out = new Array(obj.length);
							for (let i = 0, len = out.length; i < len; ++i) {
								out[i] = fn(obj[i], primitiveHandlers, lastKey, stack);
								if (out[i] === VeCt.SYM_WALKER_BREAK) return out[i];
							}
							if (!opts.isNoModification) obj = out;
							if (stack) stack.pop();

							if (primitiveHandlers.array) {
								const out = MiscUtil._getWalker_applyHandlers({opts, handlers: primitiveHandlers.array, obj, lastKey, stack});
								if (out === VeCt.SYM_WALKER_BREAK) return out;
								if (!opts.isNoModification) obj = out;
							}
							if (obj == null) {
								if (!opts.isAllowDeleteArrays) throw new Error(`Array handler(s) returned null!`);
							}
						} else {
							if (primitiveHandlers.array) {
								const out = MiscUtil._getWalker_applyHandlers({opts, handlers: primitiveHandlers.array, obj, lastKey, stack});
								if (out === VeCt.SYM_WALKER_BREAK) return out;
								if (!opts.isNoModification) obj = out;
							}
							if (obj != null) {
								const out = new Array(obj.length);
								for (let i = 0, len = out.length; i < len; ++i) {
									if (stack) stack.push(obj);
									out[i] = fn(obj[i], primitiveHandlers, lastKey, stack);
									if (stack) stack.pop();
									if (out[i] === VeCt.SYM_WALKER_BREAK) return out[i];
								}
								if (!opts.isNoModification) obj = out;
							} else {
								if (!opts.isAllowDeleteArrays) throw new Error(`Array handler(s) returned null!`);
							}
						}
						if (primitiveHandlers.postArray) MiscUtil._getWalker_runHandlers({handlers: primitiveHandlers.postArray, obj, lastKey, stack});
						return obj;
					}
					// endregion

					// region Object
					if (primitiveHandlers.preObject) MiscUtil._getWalker_runHandlers({handlers: primitiveHandlers.preObject, obj, lastKey, stack});
					if (opts.isDepthFirst) {
						if (stack) stack.push(obj);
						const flag = doObjectRecurse(obj, primitiveHandlers, stack);
						if (stack) stack.pop();
						if (flag === VeCt.SYM_WALKER_BREAK) return flag;

						if (primitiveHandlers.object) {
							const out = MiscUtil._getWalker_applyHandlers({opts, handlers: primitiveHandlers.object, obj, lastKey, stack});
							if (out === VeCt.SYM_WALKER_BREAK) return out;
							if (!opts.isNoModification) obj = out;
						}
						if (obj == null) {
							if (!opts.isAllowDeleteObjects) throw new Error(`Object handler(s) returned null!`);
						}
					} else {
						if (primitiveHandlers.object) {
							const out = MiscUtil._getWalker_applyHandlers({opts, handlers: primitiveHandlers.object, obj, lastKey, stack});
							if (out === VeCt.SYM_WALKER_BREAK) return out;
							if (!opts.isNoModification) obj = out;
						}
						if (obj == null) {
							if (!opts.isAllowDeleteObjects) throw new Error(`Object handler(s) returned null!`);
						} else {
							if (stack) stack.push(obj);
							const flag = doObjectRecurse(obj, primitiveHandlers, stack);
							if (stack) stack.pop();
							if (flag === VeCt.SYM_WALKER_BREAK) return flag;
						}
					}
					if (primitiveHandlers.postObject) MiscUtil._getWalker_runHandlers({handlers: primitiveHandlers.postObject, obj, lastKey, stack});
					return obj;
					// endregion
				}
				default: throw new Error(`Unhandled type "${typeof obj}"`);
			}
		};

		return {walk: fn};
	},

	_getWalker_applyHandlers ({opts, handlers, obj, lastKey, stack}) {
		handlers = handlers instanceof Array ? handlers : [handlers];
		const didBreak = handlers.some(h => {
			const out = h(obj, lastKey, stack);
			if (opts.isBreakOnReturn && out) return true;
			if (!opts.isNoModification) obj = out;
		});
		if (didBreak) return VeCt.SYM_WALKER_BREAK;
		return obj;
	},

	_getWalker_runHandlers ({handlers, obj, lastKey, stack}) {
		handlers = handlers instanceof Array ? handlers : [handlers];
		handlers.forEach(h => h(obj, lastKey, stack));
	},

	/**
	 * TODO refresh to match sync version
	 * @param [opts]
	 * @param [opts.keyBlocklist]
	 * @param [opts.isAllowDeleteObjects] If returning `undefined` from an object handler should be treated as a delete.
	 * @param [opts.isAllowDeleteArrays] If returning `undefined` from an array handler should be treated as a delete.
	 * @param [opts.isAllowDeleteBooleans] (Unimplemented) // TODO
	 * @param [opts.isAllowDeleteNumbers] (Unimplemented) // TODO
	 * @param [opts.isAllowDeleteStrings] (Unimplemented) // TODO
	 * @param [opts.isDepthFirst] If array/object recursion should occur before array/object primitive handling.
	 * @param [opts.isNoModification] If the walker should not attempt to modify the data.
	 */
	getAsyncWalker (opts) {
		opts = opts || {};
		const keyBlocklist = opts.keyBlocklist || new Set();

		const pFn = async (obj, primitiveHandlers, lastKey, stack) => {
			if (obj == null) {
				if (primitiveHandlers.null) return MiscUtil._getAsyncWalker_pApplyHandlers({opts, handlers: primitiveHandlers.null, obj, lastKey, stack});
				return obj;
			}

			const pDoObjectRecurse = async () => {
				await Object.keys(obj).pSerialAwaitMap(async k => {
					const v = obj[k];
					if (keyBlocklist.has(k)) return;
					const out = await pFn(v, primitiveHandlers, k, stack);
					if (!opts.isNoModification) obj[k] = out;
				});
			};

			const to = typeof obj;
			switch (to) {
				case undefined:
					if (primitiveHandlers.preUndefined) await MiscUtil._getAsyncWalker_pRunHandlers({handlers: primitiveHandlers.preUndefined, obj, lastKey, stack});
					if (primitiveHandlers.undefined) {
						const out = await MiscUtil._getAsyncWalker_pApplyHandlers({opts, handlers: primitiveHandlers.undefined, obj, lastKey, stack});
						if (!opts.isNoModification) obj = out;
					}
					if (primitiveHandlers.postUndefined) await MiscUtil._getAsyncWalker_pRunHandlers({handlers: primitiveHandlers.postUndefined, obj, lastKey, stack});
					return obj;
				case "boolean":
					if (primitiveHandlers.preBoolean) await MiscUtil._getAsyncWalker_pRunHandlers({handlers: primitiveHandlers.preBoolean, obj, lastKey, stack});
					if (primitiveHandlers.boolean) {
						const out = await MiscUtil._getAsyncWalker_pApplyHandlers({opts, handlers: primitiveHandlers.boolean, obj, lastKey, stack});
						if (!opts.isNoModification) obj = out;
					}
					if (primitiveHandlers.postBoolean) await MiscUtil._getAsyncWalker_pRunHandlers({handlers: primitiveHandlers.postBoolean, obj, lastKey, stack});
					return obj;
				case "number":
					if (primitiveHandlers.preNumber) await MiscUtil._getAsyncWalker_pRunHandlers({handlers: primitiveHandlers.preNumber, obj, lastKey, stack});
					if (primitiveHandlers.number) {
						const out = await MiscUtil._getAsyncWalker_pApplyHandlers({opts, handlers: primitiveHandlers.number, obj, lastKey, stack});
						if (!opts.isNoModification) obj = out;
					}
					if (primitiveHandlers.postNumber) await MiscUtil._getAsyncWalker_pRunHandlers({handlers: primitiveHandlers.postNumber, obj, lastKey, stack});
					return obj;
				case "string":
					if (primitiveHandlers.preString) await MiscUtil._getAsyncWalker_pRunHandlers({handlers: primitiveHandlers.preString, obj, lastKey, stack});
					if (primitiveHandlers.string) {
						const out = await MiscUtil._getAsyncWalker_pApplyHandlers({opts, handlers: primitiveHandlers.string, obj, lastKey, stack});
						if (!opts.isNoModification) obj = out;
					}
					if (primitiveHandlers.postString) await MiscUtil._getAsyncWalker_pRunHandlers({handlers: primitiveHandlers.postString, obj, lastKey, stack});
					return obj;
				case "object": {
					if (obj instanceof Array) {
						if (primitiveHandlers.preArray) await MiscUtil._getAsyncWalker_pRunHandlers({handlers: primitiveHandlers.preArray, obj, lastKey, stack});
						if (opts.isDepthFirst) {
							if (stack) stack.push(obj);
							const out = await obj.pSerialAwaitMap(it => pFn(it, primitiveHandlers, lastKey, stack));
							if (!opts.isNoModification) obj = out;
							if (stack) stack.pop();

							if (primitiveHandlers.array) {
								const out = await MiscUtil._getAsyncWalker_pApplyHandlers({opts, handlers: primitiveHandlers.array, obj, lastKey, stack});
								if (!opts.isNoModification) obj = out;
							}
							if (obj == null) {
								if (!opts.isAllowDeleteArrays) throw new Error(`Array handler(s) returned null!`);
							}
						} else {
							if (primitiveHandlers.array) {
								const out = await MiscUtil._getAsyncWalker_pApplyHandlers({opts, handlers: primitiveHandlers.array, obj, lastKey, stack});
								if (!opts.isNoModification) obj = out;
							}
							if (obj != null) {
								const out = await obj.pSerialAwaitMap(it => pFn(it, primitiveHandlers, lastKey, stack));
								if (!opts.isNoModification) obj = out;
							} else {
								if (!opts.isAllowDeleteArrays) throw new Error(`Array handler(s) returned null!`);
							}
						}
						if (primitiveHandlers.postArray) await MiscUtil._getAsyncWalker_pRunHandlers({handlers: primitiveHandlers.postArray, obj, lastKey, stack});
						return obj;
					} else {
						if (primitiveHandlers.preObject) await MiscUtil._getAsyncWalker_pRunHandlers({handlers: primitiveHandlers.preObject, obj, lastKey, stack});
						if (opts.isDepthFirst) {
							if (stack) stack.push(obj);
							await pDoObjectRecurse();
							if (stack) stack.pop();

							if (primitiveHandlers.object) {
								const out = await MiscUtil._getAsyncWalker_pApplyHandlers({opts, handlers: primitiveHandlers.object, obj, lastKey, stack});
								if (!opts.isNoModification) obj = out;
							}
							if (obj == null) {
								if (!opts.isAllowDeleteObjects) throw new Error(`Object handler(s) returned null!`);
							}
						} else {
							if (primitiveHandlers.object) {
								const out = await MiscUtil._getAsyncWalker_pApplyHandlers({opts, handlers: primitiveHandlers.object, obj, lastKey, stack});
								if (!opts.isNoModification) obj = out;
							}
							if (obj == null) {
								if (!opts.isAllowDeleteObjects) throw new Error(`Object handler(s) returned null!`);
							} else {
								await pDoObjectRecurse();
							}
						}
						if (primitiveHandlers.postObject) await MiscUtil._getAsyncWalker_pRunHandlers({handlers: primitiveHandlers.postObject, obj, lastKey, stack});
						return obj;
					}
				}
				default: throw new Error(`Unhandled type "${to}"`);
			}
		};

		return {pWalk: pFn};
	},

	async _getAsyncWalker_pApplyHandlers ({opts, handlers, obj, lastKey, stack}) {
		handlers = handlers instanceof Array ? handlers : [handlers];
		await handlers.pSerialAwaitMap(async pH => {
			const out = await pH(obj, lastKey, stack);
			if (!opts.isNoModification) obj = out;
		});
		return obj;
	},

	async _getAsyncWalker_pRunHandlers ({handlers, obj, lastKey, stack}) {
		handlers = handlers instanceof Array ? handlers : [handlers];
		await handlers.pSerialAwaitMap(pH => pH(obj, lastKey, stack));
	},

	pDefer (fn) {
		return (async () => fn())();
	},
};

// EVENT HANDLERS ======================================================================================================
globalThis.EventUtil = {
	_mouseX: 0,
	_mouseY: 0,
	_isUsingTouch: false,
	_isSetCssVars: false,

	init () {
		document.addEventListener("mousemove", evt => {
			EventUtil._mouseX = evt.clientX;
			EventUtil._mouseY = evt.clientY;
			EventUtil._onMouseMove_setCssVars();
		});
		document.addEventListener("touchstart", () => {
			EventUtil._isUsingTouch = true;
		});
	},

	_eleDocRoot: null,
	_onMouseMove_setCssVars () {
		if (!EventUtil._isSetCssVars) return;

		EventUtil._eleDocRoot = EventUtil._eleDocRoot || document.querySelector(":root");

		EventUtil._eleDocRoot.style.setProperty("--mouse-position-x", EventUtil._mouseX);
		EventUtil._eleDocRoot.style.setProperty("--mouse-position-y", EventUtil._mouseY);
	},

	getClientX (evt) { return evt.touches && evt.touches.length ? evt.touches[0].clientX : evt.clientX; },
	getClientY (evt) { return evt.touches && evt.touches.length ? evt.touches[0].clientY : evt.clientY; },

	getOffsetY (evt) {
		if (!evt.touches?.length) return evt.offsetY;

		const bounds = evt.target.getBoundingClientRect();
		return evt.targetTouches[0].clientY - bounds.y;
	},

	getMousePos () {
		return {x: EventUtil._mouseX, y: EventUtil._mouseY};
	},

	isUsingTouch () { return !!EventUtil._isUsingTouch; },

	isInInput (evt) {
		return evt.target.nodeName === "INPUT" || evt.target.nodeName === "TEXTAREA"
			|| evt.target.getAttribute("contenteditable") === "true";
	},

	noModifierKeys (evt) { return !evt.ctrlKey && !evt.altKey && !evt.metaKey; },

	getKeyIgnoreCapsLock (evt) {
		if (!evt.key) return null;
		if (evt.key.length !== 1) return evt.key;
		const isCaps = (evt.originalEvent || evt).getModifierState("CapsLock");
		if (!isCaps) return evt.key;
		const asciiCode = evt.key.charCodeAt(0);
		const isUpperCase = asciiCode >= 65 && asciiCode <= 90;
		const isLowerCase = asciiCode >= 97 && asciiCode <= 122;
		if (!isUpperCase && !isLowerCase) return evt.key;
		return isUpperCase ? evt.key.toLowerCase() : evt.key.toUpperCase();
	},
};

if (typeof window !== "undefined") window.addEventListener("load", EventUtil.init);

// ANIMATIONS ==========================================================================================================
globalThis.AnimationUtil = class {
	/**
	 * See: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations/Tips
	 *
	 * requestAnimationFrame() [...] gets executed just before the next repaint of the document. [...] because it's
	 * before the repaint, the style recomputation hasn't actually happened yet!
	 * [...] calls requestAnimationFrame() a second time! This time, the callback is run before the next repaint,
	 * which is after the style recomputation has occurred.
	 */
	static async pRecomputeStyles () {
		return new Promise(resolve => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					resolve();
				});
			});
		});
	}

	static pLoadImage (uri) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onerror = err => reject(err);
			img.onload = () => resolve(img);
			img.src = uri;
		});
	}
};

// CONTEXT MENUS =======================================================================================================
globalThis.ContextUtil = {
	_isInit: false,
	_menus: [],

	_init () {
		if (ContextUtil._isInit) return;
		ContextUtil._isInit = true;

		$(document.body).on("pointerup", () => ContextUtil._menus.forEach(menu => menu.close()));
	},

	getMenu (actions) {
		ContextUtil._init();

		const menu = new ContextUtil.Menu(actions);
		ContextUtil._menus.push(menu);
		return menu;
	},

	deleteMenu (menu) {
		if (!menu) return;

		menu.remove();
		const ix = ContextUtil._menus.findIndex(it => it === menu);
		if (~ix) ContextUtil._menus.splice(ix, 1);
	},

	pOpenMenu (evt, menu, userData) {
		evt.preventDefault();
		evt.stopPropagation();

		ContextUtil._init();

		// Close any other open menus
		ContextUtil._menus.filter(it => it !== menu).forEach(it => it.close());

		return menu.pOpen(evt, userData);
	},

	Menu: function (actions) {
		this._actions = actions;
		this._pResult = null;
		this.resolveResult_ = null;

		this.userData = null;

		this._$ele = null;
		this._metasActions = [];

		this.remove = function () { if (this._$ele) this._$ele.remove(); };

		this.width = function () { return this._$ele ? this._$ele.width() : undefined; };
		this.height = function () { return this._$ele ? this._$ele.height() : undefined; };

		this.pOpen = function (evt, userData) {
			evt.stopPropagation();
			evt.preventDefault();

			this._initLazy();

			if (this.resolveResult_) this.resolveResult_(null);
			this._pResult = new Promise(resolve => {
				this.resolveResult_ = resolve;
			});
			this.userData = userData;

			this._$ele
				// Show as transparent/non-clickable first, so we can get an accurate width/height
				.css({
					left: 0,
					top: 0,
					opacity: 0,
					pointerEvents: "none",
				})
				.showVe()
				// Use the accurate width/height to set the final position, and remove our temp styling
				.css({
					left: this._getMenuPosition(evt, "x"),
					top: this._getMenuPosition(evt, "y"),
					opacity: "",
					pointerEvents: "",
				});

			this._metasActions[0].$eleRow.focus();

			return this._pResult;
		};
		this.close = function () { if (this._$ele) this._$ele.hideVe(); };

		this._initLazy = function () {
			if (this._$ele) {
				this._metasActions.forEach(meta => meta.action.update());
				return;
			}

			const $elesAction = this._actions.map(it => {
				if (it == null) return $(`<div class="my-1 w-100 ui-ctx__divider"></div>`);

				const rdMeta = it.render({menu: this});
				this._metasActions.push(rdMeta);
				return rdMeta.$eleRow;
			});

			this._$ele = $$`<div class="ve-flex-col ui-ctx__wrp py-2 absolute">${$elesAction}</div>`
				.hideVe()
				.appendTo(document.body);
		};

		this._getMenuPosition = function (evt, axis) {
			const {fnMenuSize, fnGetEventPos, fnWindowSize, fnScrollDir} = axis === "x"
				? {fnMenuSize: "width", fnGetEventPos: "getClientX", fnWindowSize: "width", fnScrollDir: "scrollLeft"}
				: {fnMenuSize: "height", fnGetEventPos: "getClientY", fnWindowSize: "height", fnScrollDir: "scrollTop"};

			const posMouse = EventUtil[fnGetEventPos](evt);
			const szWin = $(window)[fnWindowSize]();
			const posScroll = $(window)[fnScrollDir]();
			let position = posMouse + posScroll;
			const szMenu = this[fnMenuSize]();
			// opening menu would pass the side of the page
			if (posMouse + szMenu > szWin && szMenu < posMouse) position -= szMenu;
			return position;
		};
	},

	/**
	 * @param text
	 * @param fnAction Action, which is passed its triggering click event as an argument.
	 * @param [opts] Options object.
	 * @param [opts.isDisabled] If this action is disabled.
	 * @param [opts.title] Help (title) text.
	 * @param [opts.style] Additional CSS classes to add (e.g. `ctx-danger`).
	 * @param [opts.fnActionAlt] Alternate action, which can be accessed by clicking a secondary "settings"-esque button.
	 * @param [opts.textAlt] Text for the alt-action button
	 * @param [opts.titleAlt] Title for the alt-action button
	 */
	Action: function (text, fnAction, opts) {
		opts = opts || {};

		this.text = text;
		this.fnAction = fnAction;

		this.isDisabled = opts.isDisabled;
		this.title = opts.title;
		this.style = opts.style;

		this.fnActionAlt = opts.fnActionAlt;
		this.textAlt = opts.textAlt;
		this.titleAlt = opts.titleAlt;

		this.render = function ({menu}) {
			const $btnAction = this._render_$btnAction({menu});
			const $btnActionAlt = this._render_$btnActionAlt({menu});

			return {
				action: this,
				$eleRow: $$`<div class="ui-ctx__row ve-flex-v-center ${this.style || ""}">${$btnAction}${$btnActionAlt}</div>`,
				$eleBtn: $btnAction,
			};
		};

		this._render_$btnAction = function ({menu}) {
			const $btnAction = $(`<div class="w-100 min-w-0 ui-ctx__btn py-1 pl-5 ${this.fnActionAlt ? "" : "pr-5"}" ${this.isDisabled ? "disabled" : ""} tabindex="0">${this.text}</div>`)
				.on("pointerup", async evt => {
					if (this.isDisabled) return;

					evt.preventDefault();
					evt.stopPropagation();

					menu.close();

					const result = await this.fnAction(evt, menu.userData);
					if (menu.resolveResult_) menu.resolveResult_(result);
				})
				.keydown(evt => {
					if (evt.key !== "Enter") return;
					$btnAction.click();
				});
			if (this.title) $btnAction.title(this.title);

			return $btnAction;
		};

		this._render_$btnActionAlt = function ({menu}) {
			if (!this.fnActionAlt) return null;

			const $btnActionAlt = $(`<div class="ui-ctx__btn ml-1 bl-1 py-1 px-4" ${this.isDisabled ? "disabled" : ""}>${this.textAlt ?? `<span class="glyphicon glyphicon-cog"></span>`}</div>`)
				.on("pointerup", async evt => {
					if (this.isDisabled) return;

					evt.preventDefault();
					evt.stopPropagation();

					menu.close();

					const result = await this.fnActionAlt(evt, menu.userData);
					if (menu.resolveResult_) menu.resolveResult_(result);
				});
			if (this.titleAlt) $btnActionAlt.title(this.titleAlt);

			return $btnActionAlt;
		};

		this.update = function () { /* Implement as required */ };
	},

	ActionLink: function (text, fnHref, opts) {
		ContextUtil.Action.call(this, text, null, opts);

		this.fnHref = fnHref;
		this._$btnAction = null;

		this._render_$btnAction = function () {
			this._$btnAction = $(`<a href="${this.fnHref()}" class="w-100 min-w-0 ui-ctx__btn py-1 pl-5 ${this.fnActionAlt ? "" : "pr-5"}" ${this.isDisabled ? "disabled" : ""} tabindex="0">${this.text}</a>`);
			if (this.title) this._$btnAction.title(this.title);

			return this._$btnAction;
		};

		this.update = function () {
			this._$btnAction.attr("href", this.fnHref());
		};
	},

	ActionSelect: function (
		{
			values,
			fnOnChange = null,
			fnGetDisplayValue = null,
		},
	) {
		this._values = values;
		this._fnOnChange = fnOnChange;
		this._fnGetDisplayValue = fnGetDisplayValue;

		this._sel = null;

		this._ixInitial = null;

		this.render = function ({menu}) {
			this._sel = this._render_sel({menu});

			if (this._ixInitial != null) {
				this._sel.val(`${this._ixInitial}`);
				this._ixInitial = null;
			}

			return {
				action: this,
				$eleRow: $$`<div class="ui-ctx__row ve-flex-v-center">${this._sel}</div>`,
			};
		};

		this._render_sel = function ({menu}) {
			const sel = e_({
				tag: "select",
				clazz: "w-100 min-w-0 mx-5 py-1",
				tabindex: 0,
				children: this._values
					.map((val, i) => {
						return e_({
							tag: "option",
							value: i,
							text: this._fnGetDisplayValue ? this._fnGetDisplayValue(val) : val,
						});
					}),
				pointerup: async evt => {
					evt.preventDefault();
					evt.stopPropagation();
				},
				keydown: evt => {
					if (evt.key !== "Enter") return;
					sel.click();
				},
				change: () => {
					menu.close();

					const ix = Number(sel.val() || 0);
					const val = this._values[ix];

					if (this._fnOnChange) this._fnOnChange(val);
					if (menu.resolveResult_) menu.resolveResult_(val);
				},
			});

			return sel;
		};

		this.setValue = function (val) {
			const ix = this._values.indexOf(val);
			if (!this._sel) return this._ixInitial = ix;
			this._sel.val(`${ix}`);
		};

		this.update = function () { /* Implement as required */ };
	},
};

// LIST AND SEARCH =====================================================================================================
globalThis.SearchUtil = {
	removeStemmer (elasticSearch) {
		const stemmer = elasticlunr.Pipeline.getRegisteredFunction("stemmer");
		elasticSearch.pipeline.remove(stemmer);
	},
};

// ENCODING/DECODING ===================================================================================================
globalThis.UrlUtil = {
	encodeForHash (toEncode) {
		if (toEncode instanceof Array) return toEncode.map(it => `${it}`.toUrlified()).join(HASH_LIST_SEP);
		else return `${toEncode}`.toUrlified();
	},

	encodeArrayForHash (...toEncodes) {
		return toEncodes.map(UrlUtil.encodeForHash).join(HASH_LIST_SEP);
	},

	autoEncodeHash (obj) {
		const curPage = UrlUtil.getCurrentPage();
		const encoder = UrlUtil.URL_TO_HASH_BUILDER[curPage];
		if (!encoder) throw new Error(`No encoder found for page ${curPage}`);
		return encoder(obj);
	},

	decodeHash (hash) {
		return hash.split(HASH_LIST_SEP).map(it => decodeURIComponent(it));
	},

	getSluggedHash (hash) {
		return Parser.stringToSlug(decodeURIComponent(hash)).replace(/_/g, "-");
	},

	getCurrentPage () {
		if (typeof window === "undefined") return VeCt.PG_NONE;
		const pSplit = window.location.pathname.split("/");
		let out = pSplit[pSplit.length - 1];
		if (!out.toLowerCase().endsWith(".html")) out += ".html";
		return out;
	},

	/**
	 * All internal URL construction should pass through here, to ensure `static.5etools.com` is used when required.
	 *
	 * @param href the link
	 * @param isBustCache If a cache-busting parameter should always be added.
	 */
	link (href, {isBustCache = false} = {}) {
		if (isBustCache) return UrlUtil._link_getWithParam(href, {param: `t=${Date.now()}`});
		return href;
	},

	_link_getWithParam (href, {param = `v=${VERSION_NUMBER}`} = {}) {
		if (href.includes("?")) return `${href}&${param}`;
		return `${href}?${param}`;
	},

	unpackSubHash (subHash, unencode) {
		// format is "key:value~list~sep~with~tilde"
		if (subHash.includes(HASH_SUB_KV_SEP)) {
			const keyValArr = subHash.split(HASH_SUB_KV_SEP).map(s => s.trim());
			const out = {};
			let k = keyValArr[0].toLowerCase();
			if (unencode) k = decodeURIComponent(k);
			let v = keyValArr[1].toLowerCase();
			if (unencode) v = decodeURIComponent(v);
			out[k] = v.split(HASH_SUB_LIST_SEP).map(s => s.trim());
			if (out[k].length === 1 && out[k] === HASH_SUB_NONE) out[k] = [];
			return out;
		} else {
			throw new Error(`Badly formatted subhash ${subHash}`);
		}
	},

	/**
	 * @param key The subhash key.
	 * @param values The subhash values.
	 * @param [opts] Options object.
	 * @param [opts.isEncodeBoth] If both the key and values should be URl encoded.
	 * @param [opts.isEncodeKey] If the key should be URL encoded.
	 * @param [opts.isEncodeValues] If the values should be URL encoded.
	 * @returns {string}
	 */
	packSubHash (key, values, opts) {
		opts = opts || {};
		if (opts.isEncodeBoth || opts.isEncodeKey) key = key.toUrlified();
		if (opts.isEncodeBoth || opts.isEncodeValues) values = values.map(it => it.toUrlified());
		return `${key}${HASH_SUB_KV_SEP}${values.join(HASH_SUB_LIST_SEP)}`;
	},

	categoryToPage (category) { return UrlUtil.CAT_TO_PAGE[category]; },
	categoryToHoverPage (category) { return UrlUtil.CAT_TO_HOVER_PAGE[category] || UrlUtil.categoryToPage(category); },

	pageToDisplayPage (page) { return UrlUtil.PG_TO_NAME[page] || page; },

	getFilename (url) { return url.slice(url.lastIndexOf("/") + 1); },

	isFullUrl (url) { return url && /^.*?:\/\//.test(url); },

	mini: {
		compress (primitive) {
			const type = typeof primitive;
			if (primitive == null) return `x`;
			switch (type) {
				case "boolean": return `b${Number(primitive)}`;
				case "number": return `n${primitive}`;
				case "string": return `s${primitive.toUrlified()}`;
				default: throw new Error(`Unhandled type "${type}"`);
			}
		},

		decompress (raw) {
			const [type, data] = [raw.slice(0, 1), raw.slice(1)];
			switch (type) {
				case "x": return null;
				case "b": return !!Number(data);
				case "n": return Number(data);
				case "s": return decodeURIComponent(String(data));
				default: throw new Error(`Unhandled type "${type}"`);
			}
		},
	},

	class: {
		getIndexedClassEntries (cls) {
			const out = [];

			(cls.classFeatures || []).forEach((lvlFeatureList, ixLvl) => {
				lvlFeatureList
					// don't add "you gain a subclass feature" or ASI's
					.filter(feature => (!feature.gainSubclassFeature || feature.gainSubclassFeatureHasContent)
						&& feature.name !== "Ability Score Improvement"
						&& feature.name !== "Proficiency Versatility")
					.forEach((feature, ixFeature) => {
						const name = Renderer.findName(feature);
						if (!name) { // tolerate missing names in homebrew
							if (BrewUtil2.hasSourceJson(cls.source)) return;
							else throw new Error("Class feature had no name!");
						}
						out.push({
							_type: "classFeature",
							source: cls.source.source || cls.source,
							name,
							hash: `${UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](cls)}${HASH_PART_SEP}${UrlUtil.getClassesPageStatePart({feature: {ixLevel: ixLvl, ixFeature: ixFeature}})}`,
							entry: feature,
							level: ixLvl + 1,
						});
					});
			});

			return out;
		},

		getIndexedSubclassEntries (sc) {
			const out = [];

			const lvlFeatures = sc.subclassFeatures || [];
			sc.source = sc.source || sc.classSource; // default to class source if required

			lvlFeatures.forEach(lvlFeature => {
				lvlFeature.forEach((feature, ixFeature) => {
					const subclassFeatureHash = `${UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES]({name: sc.className, source: sc.classSource})}${HASH_PART_SEP}${UrlUtil.getClassesPageStatePart({subclass: sc, feature: {ixLevel: feature.level - 1, ixFeature: ixFeature}})}`;

					const name = Renderer.findName(feature);
					if (!name) { // tolerate missing names in homebrew
						if (BrewUtil2.hasSourceJson(sc.source)) return;
						else throw new Error("Subclass feature had no name!");
					}
					out.push({
						_type: "subclassFeature",
						name,
						subclassName: sc.name,
						subclassShortName: sc.shortName,
						source: sc.source.source || sc.source,
						hash: subclassFeatureHash,
						entry: feature,
						level: feature.level,
					});

					if (feature.entries) {
						const namedFeatureParts = feature.entries.filter(it => it.name);
						namedFeatureParts.forEach(it => {
							if (out.find(existing => it.name === existing.name && feature.level === existing.level)) return;
							out.push({
								_type: "subclassFeaturePart",
								name: it.name,
								subclassName: sc.name,
								subclassShortName: sc.shortName,
								source: sc.source.source || sc.source,
								hash: subclassFeatureHash,
								entry: feature,
								level: feature.level,
							});
						});
					}
				});
			});

			return out;
		},
	},

	getStateKeySubclass (sc) { return Parser.stringToSlug(`sub ${sc.shortName || sc.name} ${sc.source}`); },

	/**
	 * @param opts Options object.
	 * @param [opts.subclass] Subclass (or object of the form `{shortName: "str", source: "str"}`)
	 * @param [opts.feature] Object of the form `{ixLevel: 0, ixFeature: 0}`
	 */
	getClassesPageStatePart (opts) {
		if (!opts.subclass && !opts.feature) return "";

		if (!opts.feature) return UrlUtil.packSubHash("state", [UrlUtil._getClassesPageStatePart_subclass(opts.subclass)]);
		if (!opts.subclass) return UrlUtil.packSubHash("state", [UrlUtil._getClassesPageStatePart_feature(opts.feature)]);

		return UrlUtil.packSubHash(
			"state",
			[
				UrlUtil._getClassesPageStatePart_subclass(opts.subclass),
				UrlUtil._getClassesPageStatePart_feature(opts.feature),
			],
		);
	},

	_getClassesPageStatePart_subclass (sc) { return `${UrlUtil.getStateKeySubclass(sc)}=${UrlUtil.mini.compress(true)}`; },
	_getClassesPageStatePart_feature (feature) { return `feature=${UrlUtil.mini.compress(`${feature.ixLevel}-${feature.ixFeature}`)}`; },
};

UrlUtil.PG_BESTIARY = "bestiary.html";
UrlUtil.PG_SPELLS = "spells.html";
UrlUtil.PG_BACKGROUNDS = "backgrounds.html";
UrlUtil.PG_ITEMS = "items.html";
UrlUtil.PG_CLASSES = "classes.html";
UrlUtil.PG_CONDITIONS_DISEASES = "conditionsdiseases.html";
UrlUtil.PG_FEATS = "feats.html";
UrlUtil.PG_OPT_FEATURES = "optionalfeatures.html";
UrlUtil.PG_PSIONICS = "psionics.html";
UrlUtil.PG_RACES = "races.html";
UrlUtil.PG_REWARDS = "rewards.html";
UrlUtil.PG_VARIANTRULES = "variantrules.html";
UrlUtil.PG_ADVENTURE = "adventure.html";
UrlUtil.PG_ADVENTURES = "adventures.html";
UrlUtil.PG_BOOK = "book.html";
UrlUtil.PG_BOOKS = "books.html";
UrlUtil.PG_DEITIES = "deities.html";
UrlUtil.PG_CULTS_BOONS = "cultsboons.html";
UrlUtil.PG_OBJECTS = "objects.html";
UrlUtil.PG_TRAPS_HAZARDS = "trapshazards.html";
UrlUtil.PG_QUICKREF = "quickreference.html";
UrlUtil.PG_MANAGE_BREW = "managebrew.html";
UrlUtil.PG_MANAGE_PRERELEASE = "manageprerelease.html";
UrlUtil.PG_MAKE_BREW = "makebrew.html";
UrlUtil.PG_DEMO_RENDER = "renderdemo.html";
UrlUtil.PG_TABLES = "tables.html";
UrlUtil.PG_VEHICLES = "vehicles.html";
UrlUtil.PG_CHARACTERS = "characters.html";
UrlUtil.PG_ACTIONS = "actions.html";
UrlUtil.PG_LANGUAGES = "languages.html";
UrlUtil.PG_STATGEN = "statgen.html";
UrlUtil.PG_LIFEGEN = "lifegen.html";
UrlUtil.PG_NAMES = "names.html";
UrlUtil.PG_DM_SCREEN = "dmscreen.html";
UrlUtil.PG_CR_CALCULATOR = "crcalculator.html";
UrlUtil.PG_ENCOUNTERGEN = "encountergen.html";
UrlUtil.PG_LOOTGEN = "lootgen.html";
UrlUtil.PG_TEXT_CONVERTER = "converter.html";
UrlUtil.PG_CHANGELOG = "changelog.html";
UrlUtil.PG_CHAR_CREATION_OPTIONS = "charcreationoptions.html";
UrlUtil.PG_RECIPES = "recipes.html";
UrlUtil.PG_CLASS_SUBCLASS_FEATURES = "classfeatures.html";
UrlUtil.PG_MAPS = "maps.html";
UrlUtil.PG_SEARCH = "search.html";
UrlUtil.PG_DECKS = "decks.html";

UrlUtil.URL_TO_HASH_GENERIC = (it) => UrlUtil.encodeArrayForHash(it.name, it.source);

UrlUtil.URL_TO_HASH_BUILDER = {};
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BESTIARY] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_SPELLS] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BACKGROUNDS] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CONDITIONS_DISEASES] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_FEATS] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_OPT_FEATURES] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_PSIONICS] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_RACES] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_REWARDS] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_VARIANTRULES] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ADVENTURE] = (it) => UrlUtil.encodeForHash(it.id);
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ADVENTURES] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ADVENTURE];
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BOOK] = (it) => UrlUtil.encodeForHash(it.id);
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BOOKS] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BOOK];
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_DEITIES] = (it) => UrlUtil.encodeArrayForHash(it.name, it.pantheon, it.source);
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CULTS_BOONS] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_OBJECTS] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_TRAPS_HAZARDS] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_TABLES] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_VEHICLES] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ACTIONS] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_LANGUAGES] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CHAR_CREATION_OPTIONS] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_RECIPES] = (it) => `${UrlUtil.encodeArrayForHash(it.name, it.source)}${it._scaleFactor ? `${HASH_PART_SEP}${VeCt.HASH_SCALED}${HASH_SUB_KV_SEP}${it._scaleFactor}` : ""}`;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_DECKS] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASS_SUBCLASS_FEATURES] = (it) => (it.__prop === "subclassFeature" || it.subclassSource) ? UrlUtil.URL_TO_HASH_BUILDER["subclassFeature"](it) : UrlUtil.URL_TO_HASH_BUILDER["classFeature"](it);
UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_QUICKREF] = ({name, ixChapter, ixHeader}) => {
	const hashParts = ["bookref-quick", ixChapter, UrlUtil.encodeForHash(name.toLowerCase())];
	if (ixHeader) hashParts.push(ixHeader);
	return hashParts.join(HASH_PART_SEP);
};

// region Fake pages (props)
UrlUtil.URL_TO_HASH_BUILDER["monster"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BESTIARY];
UrlUtil.URL_TO_HASH_BUILDER["spell"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_SPELLS];
UrlUtil.URL_TO_HASH_BUILDER["background"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BACKGROUNDS];
UrlUtil.URL_TO_HASH_BUILDER["item"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS];
UrlUtil.URL_TO_HASH_BUILDER["itemGroup"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS];
UrlUtil.URL_TO_HASH_BUILDER["baseitem"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS];
UrlUtil.URL_TO_HASH_BUILDER["magicvariant"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS];
UrlUtil.URL_TO_HASH_BUILDER["class"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES];
UrlUtil.URL_TO_HASH_BUILDER["condition"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CONDITIONS_DISEASES];
UrlUtil.URL_TO_HASH_BUILDER["disease"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CONDITIONS_DISEASES];
UrlUtil.URL_TO_HASH_BUILDER["status"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CONDITIONS_DISEASES];
UrlUtil.URL_TO_HASH_BUILDER["feat"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_FEATS];
UrlUtil.URL_TO_HASH_BUILDER["optionalfeature"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_OPT_FEATURES];
UrlUtil.URL_TO_HASH_BUILDER["psionic"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_PSIONICS];
UrlUtil.URL_TO_HASH_BUILDER["race"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_RACES];
UrlUtil.URL_TO_HASH_BUILDER["subrace"] = (it) => UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_RACES]({name: `${it.name} (${it.raceName})`, source: it.source});
UrlUtil.URL_TO_HASH_BUILDER["reward"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_REWARDS];
UrlUtil.URL_TO_HASH_BUILDER["variantrule"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_VARIANTRULES];
UrlUtil.URL_TO_HASH_BUILDER["adventure"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ADVENTURES];
UrlUtil.URL_TO_HASH_BUILDER["adventureData"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ADVENTURES];
UrlUtil.URL_TO_HASH_BUILDER["book"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BOOKS];
UrlUtil.URL_TO_HASH_BUILDER["bookData"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BOOKS];
UrlUtil.URL_TO_HASH_BUILDER["deity"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_DEITIES];
UrlUtil.URL_TO_HASH_BUILDER["cult"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CULTS_BOONS];
UrlUtil.URL_TO_HASH_BUILDER["boon"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CULTS_BOONS];
UrlUtil.URL_TO_HASH_BUILDER["object"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_OBJECTS];
UrlUtil.URL_TO_HASH_BUILDER["trap"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_TRAPS_HAZARDS];
UrlUtil.URL_TO_HASH_BUILDER["hazard"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_TRAPS_HAZARDS];
UrlUtil.URL_TO_HASH_BUILDER["table"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_TABLES];
UrlUtil.URL_TO_HASH_BUILDER["tableGroup"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_TABLES];
UrlUtil.URL_TO_HASH_BUILDER["vehicle"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_VEHICLES];
UrlUtil.URL_TO_HASH_BUILDER["vehicleUpgrade"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_VEHICLES];
UrlUtil.URL_TO_HASH_BUILDER["action"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ACTIONS];
UrlUtil.URL_TO_HASH_BUILDER["language"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_LANGUAGES];
UrlUtil.URL_TO_HASH_BUILDER["charoption"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CHAR_CREATION_OPTIONS];
UrlUtil.URL_TO_HASH_BUILDER["recipe"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_RECIPES];
UrlUtil.URL_TO_HASH_BUILDER["deck"] = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_DECKS];

UrlUtil.URL_TO_HASH_BUILDER["subclass"] = it => {
	return Hist.util.getCleanHash(
		`${UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES]({name: it.className, source: it.classSource})}${HASH_PART_SEP}${UrlUtil.getClassesPageStatePart({subclass: it})}`,
	);
};
UrlUtil.URL_TO_HASH_BUILDER["classFeature"] = (it) => UrlUtil.encodeArrayForHash(it.name, it.className, it.classSource, it.level, it.source);
UrlUtil.URL_TO_HASH_BUILDER["subclassFeature"] = (it) => UrlUtil.encodeArrayForHash(it.name, it.className, it.classSource, it.subclassShortName, it.subclassSource, it.level, it.source);
UrlUtil.URL_TO_HASH_BUILDER["card"] = (it) => UrlUtil.encodeArrayForHash(it.name, it.set, it.source);
UrlUtil.URL_TO_HASH_BUILDER["legendaryGroup"] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER["itemEntry"] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER["itemProperty"] = (it) => UrlUtil.encodeArrayForHash(it.abbreviation, it.source);
UrlUtil.URL_TO_HASH_BUILDER["itemType"] = (it) => UrlUtil.encodeArrayForHash(it.abbreviation, it.source);
UrlUtil.URL_TO_HASH_BUILDER["itemTypeAdditionalEntries"] = (it) => UrlUtil.encodeArrayForHash(it.appliesTo, it.source);
UrlUtil.URL_TO_HASH_BUILDER["itemMastery"] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER["skill"] = UrlUtil.URL_TO_HASH_GENERIC;
UrlUtil.URL_TO_HASH_BUILDER["sense"] = UrlUtil.URL_TO_HASH_GENERIC;

// Add lowercase aliases
Object.keys(UrlUtil.URL_TO_HASH_BUILDER)
	.filter(k => !k.endsWith(".html") && k.toLowerCase() !== k)
	.forEach(k => UrlUtil.URL_TO_HASH_BUILDER[k.toLowerCase()] = UrlUtil.URL_TO_HASH_BUILDER[k]);

// Add raw aliases
Object.keys(UrlUtil.URL_TO_HASH_BUILDER)
	.filter(k => !k.endsWith(".html"))
	.forEach(k => UrlUtil.URL_TO_HASH_BUILDER[`raw_${k}`] = UrlUtil.URL_TO_HASH_BUILDER[k]);

// Add fluff aliases
Object.keys(UrlUtil.URL_TO_HASH_BUILDER)
	.filter(k => !k.endsWith(".html"))
	.forEach(k => UrlUtil.URL_TO_HASH_BUILDER[`${k}Fluff`] = UrlUtil.URL_TO_HASH_BUILDER[k]);
// endregion

UrlUtil.PG_TO_NAME = {};
UrlUtil.PG_TO_NAME[UrlUtil.PG_BESTIARY] = "Bestiary";
UrlUtil.PG_TO_NAME[UrlUtil.PG_SPELLS] = "Spells";
UrlUtil.PG_TO_NAME[UrlUtil.PG_BACKGROUNDS] = "Backgrounds";
UrlUtil.PG_TO_NAME[UrlUtil.PG_ITEMS] = "Items";
UrlUtil.PG_TO_NAME[UrlUtil.PG_CLASSES] = "Classes";
UrlUtil.PG_TO_NAME[UrlUtil.PG_CONDITIONS_DISEASES] = "Conditions & Diseases";
UrlUtil.PG_TO_NAME[UrlUtil.PG_FEATS] = "Feats";
UrlUtil.PG_TO_NAME[UrlUtil.PG_OPT_FEATURES] = "Other Options and Features";
UrlUtil.PG_TO_NAME[UrlUtil.PG_PSIONICS] = "Psionics";
UrlUtil.PG_TO_NAME[UrlUtil.PG_RACES] = "Races";
UrlUtil.PG_TO_NAME[UrlUtil.PG_REWARDS] = "Supernatural Gifts & Rewards";
UrlUtil.PG_TO_NAME[UrlUtil.PG_VARIANTRULES] = "Optional, Variant, and Expanded Rules";
UrlUtil.PG_TO_NAME[UrlUtil.PG_ADVENTURES] = "Adventures";
UrlUtil.PG_TO_NAME[UrlUtil.PG_BOOKS] = "Books";
UrlUtil.PG_TO_NAME[UrlUtil.PG_DEITIES] = "Deities";
UrlUtil.PG_TO_NAME[UrlUtil.PG_CULTS_BOONS] = "Cults & Supernatural Boons";
UrlUtil.PG_TO_NAME[UrlUtil.PG_OBJECTS] = "Objects";
UrlUtil.PG_TO_NAME[UrlUtil.PG_TRAPS_HAZARDS] = "Traps & Hazards";
UrlUtil.PG_TO_NAME[UrlUtil.PG_QUICKREF] = "Quick Reference";
UrlUtil.PG_TO_NAME[UrlUtil.PG_MANAGE_BREW] = "Homebrew Manager";
UrlUtil.PG_TO_NAME[UrlUtil.PG_MANAGE_PRERELEASE] = "Prerelease Content Manager";
UrlUtil.PG_TO_NAME[UrlUtil.PG_MAKE_BREW] = "Homebrew Builder";
UrlUtil.PG_TO_NAME[UrlUtil.PG_DEMO_RENDER] = "Renderer Demo";
UrlUtil.PG_TO_NAME[UrlUtil.PG_TABLES] = "Tables";
UrlUtil.PG_TO_NAME[UrlUtil.PG_VEHICLES] = "Vehicles";
// UrlUtil.PG_TO_NAME[UrlUtil.PG_CHARACTERS] = "";
UrlUtil.PG_TO_NAME[UrlUtil.PG_ACTIONS] = "Actions";
UrlUtil.PG_TO_NAME[UrlUtil.PG_LANGUAGES] = "Languages";
UrlUtil.PG_TO_NAME[UrlUtil.PG_STATGEN] = "Stat Generator";
UrlUtil.PG_TO_NAME[UrlUtil.PG_LIFEGEN] = "This Is Your Life";
UrlUtil.PG_TO_NAME[UrlUtil.PG_NAMES] = "Names";
UrlUtil.PG_TO_NAME[UrlUtil.PG_DM_SCREEN] = "DM Screen";
UrlUtil.PG_TO_NAME[UrlUtil.PG_CR_CALCULATOR] = "CR Calculator";
UrlUtil.PG_TO_NAME[UrlUtil.PG_ENCOUNTERGEN] = "Encounter Generator";
UrlUtil.PG_TO_NAME[UrlUtil.PG_LOOTGEN] = "Loot Generator";
UrlUtil.PG_TO_NAME[UrlUtil.PG_TEXT_CONVERTER] = "Text Converter";
UrlUtil.PG_TO_NAME[UrlUtil.PG_CHANGELOG] = "Changelog";
UrlUtil.PG_TO_NAME[UrlUtil.PG_CHAR_CREATION_OPTIONS] = "Other Character Creation Options";
UrlUtil.PG_TO_NAME[UrlUtil.PG_RECIPES] = "Recipes";
UrlUtil.PG_TO_NAME[UrlUtil.PG_CLASS_SUBCLASS_FEATURES] = "Class & Subclass Features";
UrlUtil.PG_TO_NAME[UrlUtil.PG_MAPS] = "Maps";
UrlUtil.PG_TO_NAME[UrlUtil.PG_DECKS] = "Decks";

UrlUtil.CAT_TO_PAGE = {};
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_CREATURE] = UrlUtil.PG_BESTIARY;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_SPELL] = UrlUtil.PG_SPELLS;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_BACKGROUND] = UrlUtil.PG_BACKGROUNDS;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_ITEM] = UrlUtil.PG_ITEMS;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_CLASS] = UrlUtil.PG_CLASSES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_CLASS_FEATURE] = UrlUtil.PG_CLASSES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_SUBCLASS] = UrlUtil.PG_CLASSES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_SUBCLASS_FEATURE] = UrlUtil.PG_CLASSES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_CONDITION] = UrlUtil.PG_CONDITIONS_DISEASES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_FEAT] = UrlUtil.PG_FEATS;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_ELDRITCH_INVOCATION] = UrlUtil.PG_OPT_FEATURES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_METAMAGIC] = UrlUtil.PG_OPT_FEATURES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_MANEUVER_BATTLEMASTER] = UrlUtil.PG_OPT_FEATURES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_MANEUVER_CAVALIER] = UrlUtil.PG_OPT_FEATURES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_ARCANE_SHOT] = UrlUtil.PG_OPT_FEATURES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_OPTIONAL_FEATURE_OTHER] = UrlUtil.PG_OPT_FEATURES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_FIGHTING_STYLE] = UrlUtil.PG_OPT_FEATURES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_PSIONIC] = UrlUtil.PG_PSIONICS;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_RACE] = UrlUtil.PG_RACES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_OTHER_REWARD] = UrlUtil.PG_REWARDS;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_VARIANT_OPTIONAL_RULE] = UrlUtil.PG_VARIANTRULES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_ADVENTURE] = UrlUtil.PG_ADVENTURE;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_DEITY] = UrlUtil.PG_DEITIES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_OBJECT] = UrlUtil.PG_OBJECTS;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_TRAP] = UrlUtil.PG_TRAPS_HAZARDS;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_HAZARD] = UrlUtil.PG_TRAPS_HAZARDS;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_QUICKREF] = UrlUtil.PG_QUICKREF;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_CULT] = UrlUtil.PG_CULTS_BOONS;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_BOON] = UrlUtil.PG_CULTS_BOONS;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_DISEASE] = UrlUtil.PG_CONDITIONS_DISEASES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_TABLE] = UrlUtil.PG_TABLES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_TABLE_GROUP] = UrlUtil.PG_TABLES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_VEHICLE] = UrlUtil.PG_VEHICLES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_PACT_BOON] = UrlUtil.PG_OPT_FEATURES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_ELEMENTAL_DISCIPLINE] = UrlUtil.PG_OPT_FEATURES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_ARTIFICER_INFUSION] = UrlUtil.PG_OPT_FEATURES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_SHIP_UPGRADE] = UrlUtil.PG_VEHICLES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_INFERNAL_WAR_MACHINE_UPGRADE] = UrlUtil.PG_VEHICLES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_ONOMANCY_RESONANT] = UrlUtil.PG_OPT_FEATURES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_RUNE_KNIGHT_RUNE] = UrlUtil.PG_OPT_FEATURES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_ALCHEMICAL_FORMULA] = UrlUtil.PG_OPT_FEATURES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_MANEUVER] = UrlUtil.PG_OPT_FEATURES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_ACTION] = UrlUtil.PG_ACTIONS;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_LANGUAGE] = UrlUtil.PG_LANGUAGES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_BOOK] = UrlUtil.PG_BOOK;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_PAGE] = null;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_LEGENDARY_GROUP] = null;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_CHAR_CREATION_OPTIONS] = UrlUtil.PG_CHAR_CREATION_OPTIONS;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_RECIPES] = UrlUtil.PG_RECIPES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_STATUS] = UrlUtil.PG_CONDITIONS_DISEASES;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_DECK] = UrlUtil.PG_DECKS;
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_CARD] = "card";
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_SKILLS] = "skill";
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_SENSES] = "sense";
UrlUtil.CAT_TO_PAGE[Parser.CAT_ID_LEGENDARY_GROUP] = "legendaryGroup";

UrlUtil.CAT_TO_HOVER_PAGE = {};
UrlUtil.CAT_TO_HOVER_PAGE[Parser.CAT_ID_CLASS_FEATURE] = "classfeature";
UrlUtil.CAT_TO_HOVER_PAGE[Parser.CAT_ID_SUBCLASS_FEATURE] = "subclassfeature";
UrlUtil.CAT_TO_HOVER_PAGE[Parser.CAT_ID_CARD] = "card";
UrlUtil.CAT_TO_HOVER_PAGE[Parser.CAT_ID_SKILLS] = "skill";
UrlUtil.CAT_TO_HOVER_PAGE[Parser.CAT_ID_SENSES] = "sense";
UrlUtil.CAT_TO_HOVER_PAGE[Parser.CAT_ID_LEGENDARY_GROUP] = "legendaryGroup";

UrlUtil.HASH_START_CREATURE_SCALED = `${VeCt.HASH_SCALED}${HASH_SUB_KV_SEP}`;
UrlUtil.HASH_START_CREATURE_SCALED_SPELL_SUMMON = `${VeCt.HASH_SCALED_SPELL_SUMMON}${HASH_SUB_KV_SEP}`;
UrlUtil.HASH_START_CREATURE_SCALED_CLASS_SUMMON = `${VeCt.HASH_SCALED_CLASS_SUMMON}${HASH_SUB_KV_SEP}`;

UrlUtil.SUBLIST_PAGES = {
	[UrlUtil.PG_BESTIARY]: true,
	[UrlUtil.PG_SPELLS]: true,
	[UrlUtil.PG_BACKGROUNDS]: true,
	[UrlUtil.PG_ITEMS]: true,
	[UrlUtil.PG_CONDITIONS_DISEASES]: true,
	[UrlUtil.PG_FEATS]: true,
	[UrlUtil.PG_OPT_FEATURES]: true,
	[UrlUtil.PG_PSIONICS]: true,
	[UrlUtil.PG_RACES]: true,
	[UrlUtil.PG_REWARDS]: true,
	[UrlUtil.PG_VARIANTRULES]: true,
	[UrlUtil.PG_DEITIES]: true,
	[UrlUtil.PG_CULTS_BOONS]: true,
	[UrlUtil.PG_OBJECTS]: true,
	[UrlUtil.PG_TRAPS_HAZARDS]: true,
	[UrlUtil.PG_TABLES]: true,
	[UrlUtil.PG_VEHICLES]: true,
	[UrlUtil.PG_ACTIONS]: true,
	[UrlUtil.PG_LANGUAGES]: true,
	[UrlUtil.PG_CHAR_CREATION_OPTIONS]: true,
	[UrlUtil.PG_RECIPES]: true,
	[UrlUtil.PG_DECKS]: true,
};

UrlUtil.PAGE_TO_PROPS = {};
UrlUtil.PAGE_TO_PROPS[UrlUtil.PG_SPELLS] = ["spell"];
UrlUtil.PAGE_TO_PROPS[UrlUtil.PG_ITEMS] = ["item", "itemGroup", "itemType", "itemEntry", "itemProperty", "itemTypeAdditionalEntries", "itemMastery", "baseitem", "magicvariant"];

if (!IS_DEPLOYED && !IS_VTT && typeof window !== "undefined") {
	// for local testing, hotkey to get a link to the current page on the main site
	window.addEventListener("keypress", (e) => {
		if (EventUtil.noModifierKeys(e) && typeof d20 === "undefined") {
			if (e.key === "#") {
				const spl = window.location.href.split("/");
				window.prompt("Copy to clipboard: Ctrl+C, Enter", `https://5etools-mirror-1.github.io/${spl[spl.length - 1]}`);
			}
		}
	});
}

// SORTING =============================================================================================================
globalThis.SortUtil = {
	ascSort: (a, b) => {
		if (typeof FilterItem !== "undefined") {
			if (a instanceof FilterItem) a = a.item;
			if (b instanceof FilterItem) b = b.item;
		}

		return SortUtil._ascSort(a, b);
	},

	ascSortProp: (prop, a, b) => { return SortUtil.ascSort(a[prop], b[prop]); },

	ascSortLower: (a, b) => {
		if (typeof FilterItem !== "undefined") {
			if (a instanceof FilterItem) a = a.item;
			if (b instanceof FilterItem) b = b.item;
		}

		a = a ? a.toLowerCase() : a;
		b = b ? b.toLowerCase() : b;

		return SortUtil._ascSort(a, b);
	},

	ascSortLowerProp: (prop, a, b) => { return SortUtil.ascSortLower(a[prop], b[prop]); },

	// warning: slow
	ascSortNumericalSuffix (a, b) {
		if (typeof FilterItem !== "undefined") {
			if (a instanceof FilterItem) a = a.item;
			if (b instanceof FilterItem) b = b.item;
		}

		function popEndNumber (str) {
			const spl = str.split(" ");
			return spl.last().isNumeric() ? [spl.slice(0, -1).join(" "), Number(spl.last().replace(Parser._numberCleanRegexp, ""))] : [spl.join(" "), 0];
		}

		const [aStr, aNum] = popEndNumber(a.item || a);
		const [bStr, bNum] = popEndNumber(b.item || b);
		const initialSort = SortUtil.ascSort(aStr, bStr);
		if (initialSort) return initialSort;
		return SortUtil.ascSort(aNum, bNum);
	},

	_ascSort: (a, b) => {
		if (b === a) return 0;
		return b < a ? 1 : -1;
	},

	ascSortDate (a, b) {
		return b.getTime() - a.getTime();
	},

	ascSortDateString (a, b) {
		return SortUtil.ascSortDate(new Date(a || "1970-01-0"), new Date(b || "1970-01-0"));
	},

	compareListNames (a, b) { return SortUtil._ascSort(a.name.toLowerCase(), b.name.toLowerCase()); },

	listSort (a, b, opts) {
		opts = opts || {sortBy: "name"};
		if (opts.sortBy === "name") return SortUtil.compareListNames(a, b);
		else return SortUtil._compareByOrDefault_compareByOrDefault(a, b, opts.sortBy);
	},

	_listSort_compareBy (a, b, sortBy) {
		const aValue = typeof a.values[sortBy] === "string" ? a.values[sortBy].toLowerCase() : a.values[sortBy];
		const bValue = typeof b.values[sortBy] === "string" ? b.values[sortBy].toLowerCase() : b.values[sortBy];

		return SortUtil._ascSort(aValue, bValue);
	},

	_compareByOrDefault_compareByOrDefault (a, b, sortBy) {
		return SortUtil._listSort_compareBy(a, b, sortBy) || SortUtil.compareListNames(a, b);
	},

	/**
	 * "Special Equipment" first, then alphabetical
	 */
	_MON_TRAIT_ORDER: [
		"special equipment",
		"shapechanger",
	],
	monTraitSort: (a, b) => {
		if (a.sort != null && b.sort != null) return a.sort - b.sort;
		if (a.sort != null && b.sort == null) return -1;
		if (a.sort == null && b.sort != null) return 1;

		if (!a.name && !b.name) return 0;
		const aClean = Renderer.stripTags(a.name).toLowerCase().trim();
		const bClean = Renderer.stripTags(b.name).toLowerCase().trim();

		const isOnlyA = a.name.endsWith(" Only)");
		const isOnlyB = b.name.endsWith(" Only)");
		if (!isOnlyA && isOnlyB) return -1;
		if (isOnlyA && !isOnlyB) return 1;

		const ixA = SortUtil._MON_TRAIT_ORDER.indexOf(aClean);
		const ixB = SortUtil._MON_TRAIT_ORDER.indexOf(bClean);
		if (~ixA && ~ixB) return ixA - ixB;
		else if (~ixA) return -1;
		else if (~ixB) return 1;
		else return SortUtil.ascSort(aClean, bClean);
	},

	_alignFirst: ["L", "C"],
	_alignSecond: ["G", "E"],
	alignmentSort: (a, b) => {
		if (a === b) return 0;
		if (SortUtil._alignFirst.includes(a)) return -1;
		if (SortUtil._alignSecond.includes(a)) return 1;
		if (SortUtil._alignFirst.includes(b)) return 1;
		if (SortUtil._alignSecond.includes(b)) return -1;
		return 0;
	},

	ascSortCr (a, b) {
		if (typeof FilterItem !== "undefined") {
			if (a instanceof FilterItem) a = a.item;
			if (b instanceof FilterItem) b = b.item;
		}
		// always put unknown values last
		if (a === "Unknown") a = "998";
		if (b === "Unknown") b = "998";
		if (a === "\u2014" || a == null) a = "999";
		if (b === "\u2014" || b == null) b = "999";
		return SortUtil.ascSort(Parser.crToNumber(a), Parser.crToNumber(b));
	},

	ascSortAtts (a, b) {
		const aSpecial = a === "special";
		const bSpecial = b === "special";
		return aSpecial && bSpecial ? 0 : aSpecial ? 1 : bSpecial ? -1 : Parser.ABIL_ABVS.indexOf(a) - Parser.ABIL_ABVS.indexOf(b);
	},

	ascSortSize (a, b) { return Parser.SIZE_ABVS.indexOf(a) - Parser.SIZE_ABVS.indexOf(b); },

	initBtnSortHandlers ($wrpBtnsSort, list) {
		let dispCaretInitial = null;

		const dispCarets = [...$wrpBtnsSort[0].querySelectorAll(`[data-sort]`)]
			.map(btnSort => {
				const dispCaret = e_({
					tag: "span",
					clazz: "lst__caret",
				})
					.appendTo(btnSort);

				const btnSortField = btnSort.dataset.sort;

				if (btnSortField === list.sortBy) dispCaretInitial = dispCaret;

				e_({
					ele: btnSort,
					click: evt => {
						evt.stopPropagation();
						const direction = list.sortDir === "asc" ? "desc" : "asc";
						SortUtil._initBtnSortHandlers_showCaret({dispCarets, dispCaret, direction});
						list.sort(btnSortField, direction);
					},
				});

				return dispCaret;
			});

		dispCaretInitial = dispCaretInitial || dispCarets[0]; // Fall back on displaying the first caret

		SortUtil._initBtnSortHandlers_showCaret({dispCaret: dispCaretInitial, dispCarets, direction: list.sortDir});
	},

	_initBtnSortHandlers_showCaret (
		{
			dispCaret,
			dispCarets,
			direction,
		},
	) {
		dispCarets.forEach($it => $it.removeClass("lst__caret--active"));
		dispCaret.addClass("lst__caret--active").toggleClass("lst__caret--reverse", direction === "asc");
	},

	/** Add more list sort on-clicks to existing sort buttons. */
	initBtnSortHandlersAdditional ($wrpBtnsSort, list) {
		[...$wrpBtnsSort[0].querySelectorAll(".sort")]
			.map(btnSort => {
				const btnSortField = btnSort.dataset.sort;

				e_({
					ele: btnSort,
					click: evt => {
						evt.stopPropagation();
						const direction = list.sortDir === "asc" ? "desc" : "asc";
						list.sort(btnSortField, direction);
					},
				});
			});
	},

	ascSortSourceGroup (a, b) {
		const grpA = a.group || "other";
		const grpB = b.group || "other";
		const ixA = SourceUtil.ADV_BOOK_GROUPS.findIndex(it => it.group === grpA);
		const ixB = SourceUtil.ADV_BOOK_GROUPS.findIndex(it => it.group === grpB);
		return SortUtil.ascSort(ixA, ixB);
	},

	ascSortAdventure (a, b) {
		return SortUtil.ascSortDateString(b.published, a.published)
			|| SortUtil.ascSortLower(a.parentSource || "", b.parentSource || "")
			|| SortUtil.ascSort(a.publishedOrder ?? 0, b.publishedOrder ?? 0)
			|| SortUtil.ascSortLower(a.storyline, b.storyline)
			|| SortUtil.ascSort(a.level?.start ?? 20, b.level?.start ?? 20)
			|| SortUtil.ascSortLower(a.name, b.name);
	},

	ascSortBook (a, b) {
		return SortUtil.ascSortDateString(b.published, a.published)
			|| SortUtil.ascSortLower(a.parentSource || "", b.parentSource || "")
			|| SortUtil.ascSortLower(a.name, b.name);
	},

	ascSortGenericEntity (a, b) {
		return SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source);
	},

	ascSortDeity (a, b) {
		return SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source) || SortUtil.ascSortLower(a.pantheon, b.pantheon);
	},

	ascSortCard (a, b) {
		return SortUtil.ascSortLower(a.set, b.set) || SortUtil.ascSortLower(a.source, b.source) || SortUtil.ascSortLower(a.name, b.name);
	},

	_ITEM_RARITY_ORDER: ["none", "common", "uncommon", "rare", "very rare", "legendary", "artifact", "varies", "unknown (magic)", "unknown"],
	ascSortItemRarity (a, b) {
		const ixA = SortUtil._ITEM_RARITY_ORDER.indexOf(a);
		const ixB = SortUtil._ITEM_RARITY_ORDER.indexOf(b);
		return (~ixA ? ixA : Number.MAX_SAFE_INTEGER) - (~ixB ? ixB : Number.MAX_SAFE_INTEGER);
	},
};

// JSON LOADING ========================================================================================================
class _DataUtilPropConfig {
	static _MERGE_REQUIRES_PRESERVE = {};
	static _PAGE = null;

	static get PAGE () { return this._PAGE; }

	static async pMergeCopy (lst, ent, options) {
		return DataUtil.generic._pMergeCopy(this, this._PAGE, lst, ent, options);
	}
}

class _DataUtilPropConfigSingleSource extends _DataUtilPropConfig {
	static _FILENAME = null;

	static getDataUrl () { return `${Renderer.get().baseUrl}data/${this._FILENAME}`; }

	static async loadJSON () { return this.loadRawJSON(); }
	static async loadRawJSON () { return DataUtil.loadJSON(this.getDataUrl()); }
	static async loadUnmergedJSON () { return DataUtil.loadRawJSON(this.getDataUrl()); }
}

class _DataUtilPropConfigMultiSource extends _DataUtilPropConfig {
	static _DIR = null;
	static _PROP = null;
	static _IS_MUT_ENTITIES = false;

	static get _isFluff () { return this._PROP.endsWith("Fluff"); }

	static _P_INDEX = null;

	static pLoadIndex () {
		this._P_INDEX = this._P_INDEX || DataUtil.loadJSON(`${Renderer.get().baseUrl}data/${this._DIR}/${this._isFluff ? `fluff-` : ""}index.json`);
		return this._P_INDEX;
	}

	static async pLoadAll () {
		const json = await this.loadJSON();
		return json[this._PROP];
	}

	static async loadJSON () { return this._loadJSON({isUnmerged: false}); }
	static async loadUnmergedJSON () { return this._loadJSON({isUnmerged: true}); }

	static async _loadJSON ({isUnmerged = false} = {}) {
		const index = await this.pLoadIndex();

		const allData = await Object.entries(index)
			.pMap(async ([source, file]) => this._pLoadSourceEntities({source, isUnmerged, file}));

		return {[this._PROP]: allData.flat()};
	}

	static async pLoadSingleSource (source) {
		const index = await this.pLoadIndex();

		const file = index[source];
		if (!file) return null;

		return {[this._PROP]: await this._pLoadSourceEntities({source, file})};
	}

	static async _pLoadSourceEntities ({source, isUnmerged = false, file}) {
		await this._pInitPreData();

		const fnLoad = isUnmerged ? DataUtil.loadRawJSON.bind(DataUtil) : DataUtil.loadJSON.bind(DataUtil);

		let data = await fnLoad(`${Renderer.get().baseUrl}data/${this._DIR}/${file}`);
		data = data[this._PROP].filter(it => it.source === source);

		if (!this._IS_MUT_ENTITIES) return data;

		return data.map(ent => this._mutEntity(ent));
	}

	static _P_INIT_PRE_DATA = null;

	static async _pInitPreData () {
		return (this._P_INIT_PRE_DATA = this._P_INIT_PRE_DATA || this._pInitPreData_());
	}

	static async _pInitPreData_ () { /* Implement as required */ }

	static _mutEntity (ent) { return ent; }
}

class _DataUtilPropConfigCustom extends _DataUtilPropConfig {
	static async loadJSON () { throw new Error("Unimplemented!"); }
	static async loadUnmergedJSON () { throw new Error("Unimplemented!"); }
}

class _DataUtilBrewHelper {
	constructor ({defaultUrlRoot}) {
		this._defaultUrlRoot = defaultUrlRoot;
	}

	_getCleanUrlRoot (urlRoot) {
		if (urlRoot && urlRoot.trim()) {
			urlRoot = urlRoot.trim();
			if (!urlRoot.endsWith("/")) urlRoot = `${urlRoot}/`;
			return urlRoot;
		}
		return this._defaultUrlRoot;
	}

	async pLoadTimestamps (urlRoot) {
		urlRoot = this._getCleanUrlRoot(urlRoot);
		return DataUtil.loadJSON(`${urlRoot}_generated/index-timestamps.json`);
	}

	async pLoadPropIndex (urlRoot) {
		urlRoot = this._getCleanUrlRoot(urlRoot);
		return DataUtil.loadJSON(`${urlRoot}_generated/index-props.json`);
	}

	async pLoadMetaIndex (urlRoot) {
		urlRoot = this._getCleanUrlRoot(urlRoot);
		return DataUtil.loadJSON(`${urlRoot}_generated/index-meta.json`);
	}

	async pLoadSourceIndex (urlRoot) {
		urlRoot = this._getCleanUrlRoot(urlRoot);
		return DataUtil.loadJSON(`${urlRoot}_generated/index-sources.json`);
	}

	getFileUrl (path, urlRoot) {
		urlRoot = this._getCleanUrlRoot(urlRoot);
		return `${urlRoot}${path}`;
	}
}

globalThis.DataUtil = {
	_loading: {},
	_loaded: {},
	_merging: {},
	_merged: {},

	async _pLoad ({url, id, isBustCache = false}) {
		if (DataUtil._loading[id] && !isBustCache) {
			await DataUtil._loading[id];
			return DataUtil._loaded[id];
		}

		DataUtil._loading[id] = new Promise((resolve, reject) => {
			const request = new XMLHttpRequest();

			request.open("GET", url, true);
			/*
			// These would be nice to have, but kill CORS when e.g. hitting GitHub `raw.`s.
			// This may be why `fetch` dies horribly here, too. Prefer `XMLHttpRequest` for now, as it seems to have a
			//   higher innate tolerance to CORS nonsense.
			if (isBustCache) request.setRequestHeader("Cache-Control", "no-cache, no-store");
			request.setRequestHeader("Content-Type", "application/json");
			request.setRequestHeader("Referrer-Policy", "no-referrer");
			 */
			request.overrideMimeType("application/json");

			request.onload = function () {
				try {
					DataUtil._loaded[id] = JSON.parse(this.response);
					resolve();
				} catch (e) {
					reject(new Error(`Could not parse JSON from ${url}: ${e.message}`));
				}
			};
			request.onerror = (e) => reject(new Error(`Error during JSON request: ${e.target.status}`));

			request.send();
		});

		await DataUtil._loading[id];
		return DataUtil._loaded[id];
	},

	_mutAddProps (data) {
		if (data && typeof data === "object") {
			for (const k in data) {
				if (data[k] instanceof Array) {
					for (const it of data[k]) {
						if (typeof it !== "object") continue;
						it.__prop = k;
					}
				}
			}
		}
	},

	async loadJSON (url) {
		return DataUtil._loadJson(url, {isDoDataMerge: true});
	},

	async loadRawJSON (url, {isBustCache} = {}) {
		return DataUtil._loadJson(url, {isBustCache});
	},

	async _loadJson (url, {isDoDataMerge = false, isBustCache = false} = {}) {
		const procUrl = UrlUtil.link(url, {isBustCache});

		let data;
		try {
			data = await DataUtil._pLoad({url: procUrl, id: url, isBustCache});
		} catch (e) {
			setTimeout(() => { throw e; });
		}

		// Fallback to the un-processed URL
		if (!data) data = await DataUtil._pLoad({url: url, id: url, isBustCache});

		if (isDoDataMerge) await DataUtil.pDoMetaMerge(url, data);

		return data;
	},

	async pDoMetaMerge (ident, data, options) {
		DataUtil._mutAddProps(data);
		DataUtil._merging[ident] = DataUtil._merging[ident] || DataUtil._pDoMetaMerge(ident, data, options);
		await DataUtil._merging[ident];
		const out = DataUtil._merged[ident];

		// Cache the result, but immediately flush it.
		//   We do this because the cache is both a cache and a locking mechanism.
		if (options?.isSkipMetaMergeCache) {
			delete DataUtil._merging[ident];
			delete DataUtil._merged[ident];
		}

		return out;
	},

	_pDoMetaMerge_handleCopyProp (prop, arr, entry, options) {
		if (!entry._copy) return;
		let fnMergeCopy = DataUtil[prop]?.pMergeCopy;
		if (!fnMergeCopy) throw new Error(`No dependency _copy merge strategy specified for property "${prop}"`);
		fnMergeCopy = fnMergeCopy.bind(DataUtil[prop]);
		return fnMergeCopy(arr, entry, options);
	},

	async _pDoMetaMerge (ident, data, options) {
		if (data._meta) {
			const loadedSourceIds = new Set();

			if (data._meta.dependencies) {
				await Promise.all(Object.entries(data._meta.dependencies).map(async ([dataProp, sourceIds]) => {
					sourceIds.forEach(sourceId => loadedSourceIds.add(sourceId));

					if (!data[dataProp]) return; // if e.g. monster dependencies are declared, but there are no monsters to merge with, bail out

					const isHasInternalCopies = (data._meta.internalCopies || []).includes(dataProp);

					const dependencyData = await Promise.all(sourceIds.map(sourceId => DataUtil.pLoadByMeta(dataProp, sourceId)));

					const flatDependencyData = dependencyData.map(dd => dd[dataProp]).flat().filter(Boolean);
					await Promise.all(data[dataProp].map(entry => DataUtil._pDoMetaMerge_handleCopyProp(dataProp, flatDependencyData, entry, {...options, isErrorOnMissing: !isHasInternalCopies})));
				}));
				delete data._meta.dependencies;
			}

			if (data._meta.internalCopies) {
				for (const prop of data._meta.internalCopies) {
					if (!data[prop]) continue;
					for (const entry of data[prop]) {
						await DataUtil._pDoMetaMerge_handleCopyProp(prop, data[prop], entry, {...options, isErrorOnMissing: true});
					}
				}
				delete data._meta.internalCopies;
			}

			// Load any other included data
			if (data._meta.includes) {
				const includesData = await Promise.all(Object.entries(data._meta.includes).map(async ([dataProp, sourceIds]) => {
					// Avoid re-loading any sources we already loaded as dependencies
					sourceIds = sourceIds.filter(it => !loadedSourceIds.has(it));

					sourceIds.forEach(sourceId => loadedSourceIds.add(sourceId));

					const includesData = await Promise.all(sourceIds.map(sourceId => DataUtil.pLoadByMeta(dataProp, sourceId)));

					const flatIncludesData = includesData.map(dd => dd[dataProp]).flat().filter(Boolean);
					return {dataProp, flatIncludesData};
				}));
				delete data._meta.includes;

				// Add the includes data to our current data
				includesData.forEach(({dataProp, flatIncludesData}) => {
					data[dataProp] = [...data[dataProp] || [], ...flatIncludesData];
				});
			}
		}

		if (data._meta && data._meta.otherSources) {
			await Promise.all(Object.entries(data._meta.otherSources).map(async ([dataProp, sourceIds]) => {
				const additionalData = await Promise.all(Object.entries(sourceIds).map(async ([sourceId, findWith]) => ({
					findWith,
					dataOther: await DataUtil.pLoadByMeta(dataProp, sourceId),
				})));

				additionalData.forEach(({findWith, dataOther}) => {
					const toAppend = dataOther[dataProp].filter(it => it.otherSources && it.otherSources.find(os => os.source === findWith));
					if (toAppend.length) data[dataProp] = (data[dataProp] || []).concat(toAppend);
				});
			}));
			delete data._meta.otherSources;
		}

		if (data._meta && !Object.keys(data._meta).length) delete data._meta;

		DataUtil._merged[ident] = data;
	},

	getCleanFilename (filename) {
		return filename.replace(/[^-_a-zA-Z0-9]/g, "_");
	},

	getCsv (headers, rows) {
		function escapeCsv (str) {
			return `"${str.replace(/"/g, `""`).replace(/ +/g, " ").replace(/\n\n+/gi, "\n\n")}"`;
		}

		function toCsv (row) {
			return row.map(str => escapeCsv(str)).join(",");
		}

		return `${toCsv(headers)}\n${rows.map(r => toCsv(r)).join("\n")}`;
	},

	userDownload (filename, data, {fileType = null, isSkipAdditionalMetadata = false, propVersion = "siteVersion", valVersion = VERSION_NUMBER} = {}) {
		filename = `${filename}.json`;
		if (isSkipAdditionalMetadata || data instanceof Array) return DataUtil._userDownload(filename, JSON.stringify(data, null, "\t"), "text/json");

		data = {[propVersion]: valVersion, ...data};
		if (fileType != null) data = {fileType, ...data};
		return DataUtil._userDownload(filename, JSON.stringify(data, null, "\t"), "text/json");
	},

	userDownloadText (filename, string) {
		return DataUtil._userDownload(filename, string, "text/plain");
	},

	_userDownload (filename, data, mimeType) {
		const a = document.createElement("a");
		const t = new Blob([data], {type: mimeType});
		a.href = window.URL.createObjectURL(t);
		a.download = filename;
		a.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true, view: window}));
		setTimeout(() => window.URL.revokeObjectURL(a.href), 100);
	},

	/** Always returns an array of files, even in "single" mode. */
	pUserUpload (
		{
			isMultiple = false,
			expectedFileTypes = null,
			propVersion = "siteVersion",
		} = {},
	) {
		return new Promise(resolve => {
			const $iptAdd = $(`<input type="file" ${isMultiple ? "multiple" : ""} class="ve-hidden" accept=".json">`)
				.on("change", (evt) => {
					const input = evt.target;

					const reader = new FileReader();
					let readIndex = 0;
					const out = [];
					const errs = [];

					reader.onload = async () => {
						const name = input.files[readIndex - 1].name;
						const text = reader.result;

						try {
							const json = JSON.parse(text);

							const isSkipFile = expectedFileTypes != null
								&& json.fileType
								&& !expectedFileTypes.includes(json.fileType)
								&& !(await InputUiUtil.pGetUserBoolean({
									textYes: "Yes",
									textNo: "Cancel",
									title: "File Type Mismatch",
									htmlDescription: `The file "${name}" has the type "${json.fileType}" when the expected file type was "${expectedFileTypes.join("/")}".<br>Are you sure you want to upload this file?`,
								}));

							if (!isSkipFile) {
								delete json.fileType;
								delete json[propVersion];

								out.push({name, json});
							}
						} catch (e) {
							errs.push({filename: name, message: e.message});
						}

						if (input.files[readIndex]) {
							reader.readAsText(input.files[readIndex++]);
							return;
						}

						resolve({
							files: out,
							errors: errs,
							jsons: out.map(({json}) => json),
						});
					};

					reader.readAsText(input.files[readIndex++]);
				})
				.appendTo(document.body);

			$iptAdd.click();
		});
	},

	doHandleFileLoadErrorsGeneric (errors) {
		if (!errors) return;
		errors.forEach(err => {
			JqueryUtil.doToast({
				content: `Could not load file "${err.filename}": <code>${err.message}</code>. ${VeCt.STR_SEE_CONSOLE}`,
				type: "danger",
			});
		});
	},

	cleanJson (cpy, {isDeleteUniqueId = true} = {}) {
		if (!cpy) return cpy;
		cpy.name = cpy._displayName || cpy.name;
		if (isDeleteUniqueId) delete cpy.uniqueId;
		DataUtil.__cleanJsonObject(cpy);
		return cpy;
	},

	_CLEAN_JSON_ALLOWED_UNDER_KEYS: [
		"_copy",
		"_versions",
		"_version",
	],
	__cleanJsonObject (obj) {
		if (obj == null) return obj;
		if (typeof obj !== "object") return obj;

		if (obj instanceof Array) {
			return obj.forEach(it => DataUtil.__cleanJsonObject(it));
		}

		Object.entries(obj).forEach(([k, v]) => {
			if (DataUtil._CLEAN_JSON_ALLOWED_UNDER_KEYS.includes(k)) return;
			// TODO(Future) use "__" prefix for temp data, instead of "_"
			if ((k.startsWith("_") && k !== "_") || k === "customHashId") delete obj[k];
			else DataUtil.__cleanJsonObject(v);
		});
	},

	_MULTI_SOURCE_PROP_TO_DIR: {
		"monster": "bestiary",
		"monsterFluff": "bestiary",
		"spell": "spells",
		"spellFluff": "spells",
		"class": "class",
		"subclass": "class",
		"classFeature": "class",
		"subclassFeature": "class",
	},
	_MULTI_SOURCE_PROP_TO_INDEX_NAME: {
		"class": "index.json",
		"subclass": "index.json",
		"classFeature": "index.json",
		"subclassFeature": "index.json",
	},
	async pLoadByMeta (prop, source) {
		// TODO(future) expand support

		switch (prop) {
			// region Predefined multi-source
			case "monster":
			case "spell":
			case "monsterFluff":
			case "spellFluff": {
				const data = await DataUtil[prop].pLoadSingleSource(source);
				if (data) return data;

				return DataUtil._pLoadByMeta_pGetPrereleaseBrewUrl(source);
			}
			// endregion

			// region Multi-source
			case "class":
			case "subclass":
			case "classFeature":
			case "subclassFeature": {
				const baseUrlPart = `${Renderer.get().baseUrl}data/${DataUtil._MULTI_SOURCE_PROP_TO_DIR[prop]}`;
				const index = await DataUtil.loadJSON(`${baseUrlPart}/${DataUtil._MULTI_SOURCE_PROP_TO_INDEX_NAME[prop]}`);
				if (index[source]) return DataUtil.loadJSON(`${baseUrlPart}/${index[source]}`);

				return DataUtil._pLoadByMeta_pGetPrereleaseBrewUrl(source);
			}
			// endregion

			// region Special
			case "item":
			case "itemGroup": {
				const data = await DataUtil.item.loadRawJSON();
				if (data[prop] && data[prop].some(it => it.source === source)) return data;
				return DataUtil._pLoadByMeta_pGetPrereleaseBrewUrl(source);
			}
			case "race": {
				const data = await DataUtil.race.loadJSON({isAddBaseRaces: true});
				if (data[prop] && data[prop].some(it => it.source === source)) return data;
				return DataUtil._pLoadByMeta_pGetPrereleaseBrewUrl(source);
			}
			// endregion

			// region Standard
			default: {
				const impl = DataUtil[prop];
				if (impl && (impl.getDataUrl || impl.loadJSON)) {
					const data = await (impl.loadJSON ? impl.loadJSON() : DataUtil.loadJSON(impl.getDataUrl()));
					if (data[prop] && data[prop].some(it => it.source === source)) return data;

					return DataUtil._pLoadByMeta_pGetPrereleaseBrewUrl(source);
				}

				throw new Error(`Could not get loadable URL for \`${JSON.stringify({key: prop, value: source})}\``);
			}
			// endregion
		}
	},

	async _pLoadByMeta_pGetPrereleaseBrewUrl (source) {
		const fromPrerelease = await DataUtil.pLoadPrereleaseBySource(source);
		if (fromPrerelease) return fromPrerelease;

		const fromBrew = await DataUtil.pLoadBrewBySource(source);
		if (fromBrew) return fromBrew;

		throw new Error(`Could not find prerelease/brew URL for source "${source}"`);
	},

	async pLoadPrereleaseBySource (source) {
		if (typeof PrereleaseUtil === "undefined") return null;
		const url = await PrereleaseUtil.pGetSourceUrl(source);
		if (!url) return null;
		return DataUtil.loadJSON(url);
	},

	async pLoadBrewBySource (source) {
		if (typeof BrewUtil2 === "undefined") return null;
		const url = await BrewUtil2.pGetSourceUrl(source);
		if (!url) return null;
		return DataUtil.loadJSON(url);
	},

	// region Dbg
	dbg: {
		isTrackCopied: false,
	},
	// endregion

	generic: {
		_MERGE_REQUIRES_PRESERVE_BASE: {
			page: true,
			otherSources: true,
			srd: true,
			basicRules: true,
			reprintedAs: true,
			hasFluff: true,
			hasFluffImages: true,
			hasToken: true,
			_versions: true,
		},

		_walker_replaceTxt: null,

		/**
		 * @param uid
		 * @param tag
		 * @param [opts]
		 * @param [opts.isLower] If the returned values should be lowercase.
		 */
		unpackUid (uid, tag, opts) {
			opts = opts || {};
			if (opts.isLower) uid = uid.toLowerCase();
			let [name, source, displayText, ...others] = uid.split("|").map(it => it.trim());

			source = source || Parser.getTagSource(tag, source);
			if (opts.isLower) source = source.toLowerCase();

			return {
				name,
				source,
				displayText,
				others,
			};
		},

		packUid (ent, tag) {
			// <name>|<source>
			const sourceDefault = Parser.getTagSource(tag);
			return [
				ent.name,
				(ent.source || "").toLowerCase() === sourceDefault.toLowerCase() ? "" : ent.source,
			].join("|").replace(/\|+$/, ""); // Trim trailing pipes
		},

		getNormalizedUid (uid, tag) {
			const {name, source} = DataUtil.generic.unpackUid(uid, tag, {isLower: true});
			return [name, source].join("|");
		},

		getUid (ent, {isMaintainCase = false} = {}) {
			const {name} = ent;
			const source = SourceUtil.getEntitySource(ent);
			if (!name || !source) throw new Error(`Entity did not have a name and source!`);
			const out = [name, source].join("|");
			if (isMaintainCase) return out;
			return out.toLowerCase();
		},

		async _pMergeCopy (impl, page, entryList, entry, options) {
			if (!entry._copy) return;

			const hashCurrent = UrlUtil.URL_TO_HASH_BUILDER[page](entry);
			const hash = UrlUtil.URL_TO_HASH_BUILDER[page](entry._copy);

			if (hashCurrent === hash) throw new Error(`${hashCurrent} _copy self-references! This is a bug!`);

			const it = (impl._mergeCache = impl._mergeCache || {})[hash] || DataUtil.generic._pMergeCopy_search(impl, page, entryList, entry, options);

			if (!it) {
				if (options.isErrorOnMissing) {
					// In development/script mode, throw an exception
					if (!IS_DEPLOYED && !IS_VTT) throw new Error(`Could not find "${page}" entity "${entry._copy.name}" ("${entry._copy.source}") to copy in copier "${entry.name}" ("${entry.source}")`);
				}
				return;
			}

			if (DataUtil.dbg.isTrackCopied) it.dbg_isCopied = true;
			// Handle recursive copy
			if (it._copy) await DataUtil.generic._pMergeCopy(impl, page, entryList, it, options);

			// Preload traits, if required
			const traitData = entry._copy?._trait
				? (await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/bestiary/traits.json`))
				: null;
			return DataUtil.generic._applyCopy(impl, MiscUtil.copyFast(it), entry, traitData, options);
		},

		_pMergeCopy_search (impl, page, entryList, entry, options) {
			const entryHash = UrlUtil.URL_TO_HASH_BUILDER[page](entry._copy);
			return entryList.find(it => {
				const hash = UrlUtil.URL_TO_HASH_BUILDER[page](it);
				impl._mergeCache[hash] = it;
				return hash === entryHash;
			});
		},

		COPY_ENTRY_PROPS: [
			"action", "bonus", "reaction", "trait", "legendary", "mythic", "variant", "spellcasting",
			"actionHeader", "bonusHeader", "reactionHeader", "legendaryHeader", "mythicHeader",
		],
		_applyCopy (impl, copyFrom, copyTo, traitData, options = {}) {
			if (options.doKeepCopy) copyTo.__copy = MiscUtil.copyFast(copyFrom);

			// convert everything to arrays
			function normaliseMods (obj) {
				Object.entries(obj._mod).forEach(([k, v]) => {
					if (!(v instanceof Array)) obj._mod[k] = [v];
				});
			}

			const msgPtFailed = `Failed to apply _copy to "${copyTo.name}" ("${copyTo.source}").`;

			const copyMeta = copyTo._copy || {};

			if (copyMeta._mod) normaliseMods(copyMeta);

			// fetch and apply any external traits -- append them to existing copy mods where available
			let racials = null;
			if (copyMeta._trait) {
				racials = traitData.trait.find(t => t.name.toLowerCase() === copyMeta._trait.name.toLowerCase() && t.source.toLowerCase() === copyMeta._trait.source.toLowerCase());
				if (!racials) throw new Error(`${msgPtFailed} Could not find traits to apply with name "${copyMeta._trait.name}" and source "${copyMeta._trait.source}"`);
				racials = MiscUtil.copyFast(racials);

				if (racials.apply._mod) {
					normaliseMods(racials.apply);

					if (copyMeta._mod) {
						Object.entries(racials.apply._mod).forEach(([k, v]) => {
							if (copyMeta._mod[k]) copyMeta._mod[k] = copyMeta._mod[k].concat(v);
							else copyMeta._mod[k] = v;
						});
					} else copyMeta._mod = racials.apply._mod;
				}

				delete copyMeta._trait;
			}

			const copyToRootProps = new Set(Object.keys(copyTo));

			// copy over required values
			Object.keys(copyFrom).forEach(k => {
				if (copyTo[k] === null) return delete copyTo[k];
				if (copyTo[k] == null) {
					if (DataUtil.generic._MERGE_REQUIRES_PRESERVE_BASE[k] || impl?._MERGE_REQUIRES_PRESERVE[k]) {
						if (copyTo._copy._preserve?.["*"] || copyTo._copy._preserve?.[k]) copyTo[k] = copyFrom[k];
					} else copyTo[k] = copyFrom[k];
				}
			});

			// apply any root racial properties after doing base copy
			if (racials && racials.apply._root) {
				Object.entries(racials.apply._root)
					.filter(([k, v]) => !copyToRootProps.has(k)) // avoid overwriting any real root properties
					.forEach(([k, v]) => copyTo[k] = v);
			}

			// mod helpers /////////////////
			function doEnsureArray (obj, prop) {
				if (!(obj[prop] instanceof Array)) obj[prop] = [obj[prop]];
			}

			function getRegexFromReplaceModInfo (replace, flags) {
				return new RegExp(replace, `g${flags || ""}`);
			}

			function doReplaceStringHandler (re, withStr, str) {
				// TODO(Future) may need to have this handle replaces inside _some_ tags
				const split = Renderer.splitByTags(str);
				const len = split.length;
				for (let i = 0; i < len; ++i) {
					if (split[i].startsWith("{@")) continue;
					split[i] = split[i].replace(re, withStr);
				}
				return split.join("");
			}

			function doMod_appendStr (modInfo, prop) {
				if (copyTo[prop]) copyTo[prop] = `${copyTo[prop]}${modInfo.joiner || ""}${modInfo.str}`;
				else copyTo[prop] = modInfo.str;
			}

			function doMod_replaceName (modInfo, prop) {
				if (!copyTo[prop]) return;

				DataUtil.generic._walker_replaceTxt = DataUtil.generic._walker_replaceTxt || MiscUtil.getWalker();
				const re = getRegexFromReplaceModInfo(modInfo.replace, modInfo.flags);
				const handlers = {string: doReplaceStringHandler.bind(null, re, modInfo.with)};

				copyTo[prop].forEach(it => {
					if (it.name) it.name = DataUtil.generic._walker_replaceTxt.walk(it.name, handlers);
				});
			}

			function doMod_replaceTxt (modInfo, prop) {
				if (!copyTo[prop]) return;

				DataUtil.generic._walker_replaceTxt = DataUtil.generic._walker_replaceTxt || MiscUtil.getWalker();
				const re = getRegexFromReplaceModInfo(modInfo.replace, modInfo.flags);
				const handlers = {string: doReplaceStringHandler.bind(null, re, modInfo.with)};

				const props = modInfo.props || [null, "entries", "headerEntries", "footerEntries"];
				if (!props.length) return;

				if (props.includes(null)) {
					// Handle any pure strings, e.g. `"legendaryHeader"`
					copyTo[prop] = copyTo[prop].map(it => {
						if (typeof it !== "string") return it;
						return DataUtil.generic._walker_replaceTxt.walk(it, handlers);
					});
				}

				copyTo[prop].forEach(it => {
					props.forEach(prop => {
						if (prop == null) return;
						if (it[prop]) it[prop] = DataUtil.generic._walker_replaceTxt.walk(it[prop], handlers);
					});
				});
			}

			function doMod_prependArr (modInfo, prop) {
				doEnsureArray(modInfo, "items");
				copyTo[prop] = copyTo[prop] ? modInfo.items.concat(copyTo[prop]) : modInfo.items;
			}

			function doMod_appendArr (modInfo, prop) {
				doEnsureArray(modInfo, "items");
				copyTo[prop] = copyTo[prop] ? copyTo[prop].concat(modInfo.items) : modInfo.items;
			}

			function doMod_appendIfNotExistsArr (modInfo, prop) {
				doEnsureArray(modInfo, "items");
				if (!copyTo[prop]) return copyTo[prop] = modInfo.items;
				copyTo[prop] = copyTo[prop].concat(modInfo.items.filter(it => !copyTo[prop].some(x => CollectionUtil.deepEquals(it, x))));
			}

			function doMod_replaceArr (modInfo, prop, isThrow = true) {
				doEnsureArray(modInfo, "items");

				if (!copyTo[prop]) {
					if (isThrow) throw new Error(`${msgPtFailed} Could not find "${prop}" array`);
					return false;
				}

				let ixOld;
				if (modInfo.replace.regex) {
					const re = new RegExp(modInfo.replace.regex, modInfo.replace.flags || "");
					ixOld = copyTo[prop].findIndex(it => it.name ? re.test(it.name) : typeof it === "string" ? re.test(it) : false);
				} else if (modInfo.replace.index != null) {
					ixOld = modInfo.replace.index;
				} else {
					ixOld = copyTo[prop].findIndex(it => it.name ? it.name === modInfo.replace : it === modInfo.replace);
				}

				if (~ixOld) {
					copyTo[prop].splice(ixOld, 1, ...modInfo.items);
					return true;
				} else if (isThrow) throw new Error(`${msgPtFailed} Could not find "${prop}" item with name "${modInfo.replace}" to replace`);
				return false;
			}

			function doMod_replaceOrAppendArr (modInfo, prop) {
				const didReplace = doMod_replaceArr(modInfo, prop, false);
				if (!didReplace) doMod_appendArr(modInfo, prop);
			}

			function doMod_insertArr (modInfo, prop) {
				doEnsureArray(modInfo, "items");
				if (!copyTo[prop]) throw new Error(`${msgPtFailed} Could not find "${prop}" array`);
				copyTo[prop].splice(~modInfo.index ? modInfo.index : copyTo[prop].length, 0, ...modInfo.items);
			}

			function doMod_removeArr (modInfo, prop) {
				if (modInfo.names) {
					doEnsureArray(modInfo, "names");
					modInfo.names.forEach(nameToRemove => {
						const ixOld = copyTo[prop].findIndex(it => it.name === nameToRemove);
						if (~ixOld) copyTo[prop].splice(ixOld, 1);
						else {
							if (!modInfo.force) throw new Error(`${msgPtFailed} Could not find "${prop}" item with name "${nameToRemove}" to remove`);
						}
					});
				} else if (modInfo.items) {
					doEnsureArray(modInfo, "items");
					modInfo.items.forEach(itemToRemove => {
						const ixOld = copyTo[prop].findIndex(it => it === itemToRemove);
						if (~ixOld) copyTo[prop].splice(ixOld, 1);
						else throw new Error(`${msgPtFailed} Could not find "${prop}" item "${itemToRemove}" to remove`);
					});
				} else throw new Error(`${msgPtFailed} One of "names" or "items" must be provided!`);
			}

			function doMod_calculateProp (modInfo, prop) {
				copyTo[prop] = copyTo[prop] || {};
				const toExec = modInfo.formula.replace(/<\$([^$]+)\$>/g, (...m) => {
					switch (m[1]) {
						case "prof_bonus": return Parser.crToPb(copyTo.cr);
						case "dex_mod": return Parser.getAbilityModNumber(copyTo.dex);
						default: throw new Error(`${msgPtFailed} Unknown variable "${m[1]}"`);
					}
				});
				// eslint-disable-next-line no-eval
				copyTo[prop][modInfo.prop] = eval(toExec);
			}

			function doMod_scalarAddProp (modInfo, prop) {
				function applyTo (k) {
					const out = Number(copyTo[prop][k]) + modInfo.scalar;
					const isString = typeof copyTo[prop][k] === "string";
					copyTo[prop][k] = isString ? `${out >= 0 ? "+" : ""}${out}` : out;
				}

				if (!copyTo[prop]) return;
				if (modInfo.prop === "*") Object.keys(copyTo[prop]).forEach(k => applyTo(k));
				else applyTo(modInfo.prop);
			}

			function doMod_scalarMultProp (modInfo, prop) {
				function applyTo (k) {
					let out = Number(copyTo[prop][k]) * modInfo.scalar;
					if (modInfo.floor) out = Math.floor(out);
					const isString = typeof copyTo[prop][k] === "string";
					copyTo[prop][k] = isString ? `${out >= 0 ? "+" : ""}${out}` : out;
				}

				if (!copyTo[prop]) return;
				if (modInfo.prop === "*") Object.keys(copyTo[prop]).forEach(k => applyTo(k));
				else applyTo(modInfo.prop);
			}

			function doMod_addSenses (modInfo) {
				doEnsureArray(modInfo, "senses");
				copyTo.senses = copyTo.senses || [];
				modInfo.senses.forEach(sense => {
					let found = false;
					for (let i = 0; i < copyTo.senses.length; ++i) {
						const m = new RegExp(`${sense.type} (\\d+)`, "i").exec(copyTo.senses[i]);
						if (m) {
							found = true;
							// if the creature already has a greater sense of this type, do nothing
							if (Number(m[1]) < sense.range) {
								copyTo.senses[i] = `${sense.type} ${sense.range} ft.`;
							}
							break;
						}
					}

					if (!found) copyTo.senses.push(`${sense.type} ${sense.range} ft.`);
				});
			}

			function doMod_addSaves (modInfo) {
				copyTo.save = copyTo.save || {};
				Object.entries(modInfo.saves).forEach(([save, mode]) => {
					// mode: 1 = proficient; 2 = expert
					const total = mode * Parser.crToPb(copyTo.cr) + Parser.getAbilityModNumber(copyTo[save]);
					const asText = total >= 0 ? `+${total}` : total;
					if (copyTo.save && copyTo.save[save]) {
						// update only if ours is larger (prevent reduction in save)
						if (Number(copyTo.save[save]) < total) copyTo.save[save] = asText;
					} else copyTo.save[save] = asText;
				});
			}

			function doMod_addSkills (modInfo) {
				copyTo.skill = copyTo.skill || {};
				Object.entries(modInfo.skills).forEach(([skill, mode]) => {
					// mode: 1 = proficient; 2 = expert
					const total = mode * Parser.crToPb(copyTo.cr) + Parser.getAbilityModNumber(copyTo[Parser.skillToAbilityAbv(skill)]);
					const asText = total >= 0 ? `+${total}` : total;
					if (copyTo.skill && copyTo.skill[skill]) {
						// update only if ours is larger (prevent reduction in skill score)
						if (Number(copyTo.skill[skill]) < total) copyTo.skill[skill] = asText;
					} else copyTo.skill[skill] = asText;
				});
			}

			function doMod_addAllSaves (modInfo) {
				return doMod_addSaves({
					mode: "addSaves",
					saves: Object.keys(Parser.ATB_ABV_TO_FULL).mergeMap(it => ({[it]: modInfo.saves})),
				});
			}

			function doMod_addAllSkills (modInfo) {
				return doMod_addSkills({
					mode: "addSkills",
					skills: Object.keys(Parser.SKILL_TO_ATB_ABV).mergeMap(it => ({[it]: modInfo.skills})),
				});
			}

			function doMod_addSpells (modInfo) {
				if (!copyTo.spellcasting) throw new Error(`${msgPtFailed} Creature did not have a spellcasting property!`);

				// TODO could accept a "position" or "name" parameter should spells need to be added to other spellcasting traits
				const spellcasting = copyTo.spellcasting[0];

				if (modInfo.spells) {
					const spells = spellcasting.spells;

					Object.keys(modInfo.spells).forEach(k => {
						if (!spells[k]) spells[k] = modInfo.spells[k];
						else {
							// merge the objects
							const spellCategoryNu = modInfo.spells[k];
							const spellCategoryOld = spells[k];
							Object.keys(spellCategoryNu).forEach(kk => {
								if (!spellCategoryOld[kk]) spellCategoryOld[kk] = spellCategoryNu[kk];
								else {
									if (typeof spellCategoryOld[kk] === "object") {
										if (spellCategoryOld[kk] instanceof Array) spellCategoryOld[kk] = spellCategoryOld[kk].concat(spellCategoryNu[kk]).sort(SortUtil.ascSortLower);
										else throw new Error(`${msgPtFailed} Object at key ${kk} not an array!`);
									} else spellCategoryOld[kk] = spellCategoryNu[kk];
								}
							});
						}
					});
				}

				["constant", "will", "ritual"].forEach(prop => {
					if (!modInfo[prop]) return;
					modInfo[prop].forEach(sp => (spellcasting[prop] = spellcasting[prop] || []).push(sp));
				});

				["rest", "daily", "weekly", "yearly"].forEach(prop => {
					if (!modInfo[prop]) return;

					for (let i = 1; i <= 9; ++i) {
						const e = `${i}e`;

						spellcasting[prop] = spellcasting[prop] || {};

						if (modInfo[prop][i]) {
							modInfo[prop][i].forEach(sp => (spellcasting[prop][i] = spellcasting[prop][i] || []).push(sp));
						}

						if (modInfo[prop][e]) {
							modInfo[prop][e].forEach(sp => (spellcasting[prop][e] = spellcasting[prop][e] || []).push(sp));
						}
					}
				});
			}

			function doMod_replaceSpells (modInfo) {
				if (!copyTo.spellcasting) throw new Error(`${msgPtFailed} Creature did not have a spellcasting property!`);

				// TODO could accept a "position" or "name" parameter should spells need to be added to other spellcasting traits
				const spellcasting = copyTo.spellcasting[0];

				const handleReplace = (curSpells, replaceMeta, k) => {
					doEnsureArray(replaceMeta, "with");

					const ix = curSpells[k].indexOf(replaceMeta.replace);
					if (~ix) {
						curSpells[k].splice(ix, 1, ...replaceMeta.with);
						curSpells[k].sort(SortUtil.ascSortLower);
					} else throw new Error(`${msgPtFailed} Could not find spell "${replaceMeta.replace}" to replace`);
				};

				if (modInfo.spells) {
					const trait0 = spellcasting.spells;
					Object.keys(modInfo.spells).forEach(k => { // k is e.g. "4"
						if (trait0[k]) {
							const replaceMetas = modInfo.spells[k];
							const curSpells = trait0[k];
							replaceMetas.forEach(replaceMeta => handleReplace(curSpells, replaceMeta, "spells"));
						}
					});
				}

				// TODO should be extended  to handle all non-slot-based spellcasters
				if (modInfo.daily) {
					for (let i = 1; i <= 9; ++i) {
						const e = `${i}e`;

						if (modInfo.daily[i]) {
							modInfo.daily[i].forEach(replaceMeta => handleReplace(spellcasting.daily, replaceMeta, i));
						}

						if (modInfo.daily[e]) {
							modInfo.daily[e].forEach(replaceMeta => handleReplace(spellcasting.daily, replaceMeta, e));
						}
					}
				}
			}

			function doMod_removeSpells (modInfo) {
				if (!copyTo.spellcasting) throw new Error(`${msgPtFailed} Creature did not have a spellcasting property!`);

				// TODO could accept a "position" or "name" parameter should spells need to be added to other spellcasting traits
				const spellcasting = copyTo.spellcasting[0];

				if (modInfo.spells) {
					const spells = spellcasting.spells;

					Object.keys(modInfo.spells).forEach(k => {
						if (!spells[k]?.spells) return;

						spells[k].spells = spells[k].spells.filter(it => !modInfo.spells[k].includes(it));
					});
				}

				["constant", "will", "ritual"].forEach(prop => {
					if (!modInfo[prop]) return;
					spellcasting[prop].filter(it => !modInfo[prop].includes(it));
				});

				["rest", "daily", "weekly", "yearly"].forEach(prop => {
					if (!modInfo[prop]) return;

					for (let i = 1; i <= 9; ++i) {
						const e = `${i}e`;

						spellcasting[prop] = spellcasting[prop] || {};

						if (modInfo[prop][i]) {
							spellcasting[prop][i] = spellcasting[prop][i].filter(it => !modInfo[prop][i].includes(it));
						}

						if (modInfo[prop][e]) {
							spellcasting[prop][e] = spellcasting[prop][e].filter(it => !modInfo[prop][e].includes(it));
						}
					}
				});
			}

			function doMod_scalarAddHit (modInfo, prop) {
				if (!copyTo[prop]) return;
				copyTo[prop] = JSON.parse(JSON.stringify(copyTo[prop]).replace(/{@hit ([-+]?\d+)}/g, (m0, m1) => `{@hit ${Number(m1) + modInfo.scalar}}`));
			}

			function doMod_scalarAddDc (modInfo, prop) {
				if (!copyTo[prop]) return;
				copyTo[prop] = JSON.parse(JSON.stringify(copyTo[prop]).replace(/{@dc (\d+)(?:\|[^}]+)?}/g, (m0, m1) => `{@dc ${Number(m1) + modInfo.scalar}}`));
			}

			function doMod_maxSize (modInfo) {
				const sizes = [...copyTo.size].sort(SortUtil.ascSortSize);

				const ixsCur = sizes.map(it => Parser.SIZE_ABVS.indexOf(it));
				const ixMax = Parser.SIZE_ABVS.indexOf(modInfo.max);

				if (!~ixMax || ixsCur.some(ix => !~ix)) throw new Error(`${msgPtFailed} Unhandled size!`);

				const ixsNxt = ixsCur.filter(ix => ix <= ixMax);
				if (!ixsNxt.length) ixsNxt.push(ixMax);

				copyTo.size = ixsNxt.map(ix => Parser.SIZE_ABVS[ix]);
			}

			function doMod_scalarMultXp (modInfo) {
				function getOutput (input) {
					let out = input * modInfo.scalar;
					if (modInfo.floor) out = Math.floor(out);
					return out;
				}

				if (copyTo.cr.xp) copyTo.cr.xp = getOutput(copyTo.cr.xp);
				else {
					const curXp = Parser.crToXpNumber(copyTo.cr);
					if (!copyTo.cr.cr) copyTo.cr = {cr: copyTo.cr};
					copyTo.cr.xp = getOutput(curXp);
				}
			}

			function doMod (modInfos, ...properties) {
				function handleProp (prop) {
					modInfos.forEach(modInfo => {
						if (typeof modInfo === "string") {
							switch (modInfo) {
								case "remove": return delete copyTo[prop];
								default: throw new Error(`${msgPtFailed} Unhandled mode: ${modInfo}`);
							}
						} else {
							switch (modInfo.mode) {
								case "appendStr": return doMod_appendStr(modInfo, prop);
								case "replaceName": return doMod_replaceName(modInfo, prop);
								case "replaceTxt": return doMod_replaceTxt(modInfo, prop);
								case "prependArr": return doMod_prependArr(modInfo, prop);
								case "appendArr": return doMod_appendArr(modInfo, prop);
								case "replaceArr": return doMod_replaceArr(modInfo, prop);
								case "replaceOrAppendArr": return doMod_replaceOrAppendArr(modInfo, prop);
								case "appendIfNotExistsArr": return doMod_appendIfNotExistsArr(modInfo, prop);
								case "insertArr": return doMod_insertArr(modInfo, prop);
								case "removeArr": return doMod_removeArr(modInfo, prop);
								case "calculateProp": return doMod_calculateProp(modInfo, prop);
								case "scalarAddProp": return doMod_scalarAddProp(modInfo, prop);
								case "scalarMultProp": return doMod_scalarMultProp(modInfo, prop);
								// region Bestiary specific
								case "addSenses": return doMod_addSenses(modInfo);
								case "addSaves": return doMod_addSaves(modInfo);
								case "addSkills": return doMod_addSkills(modInfo);
								case "addAllSaves": return doMod_addAllSaves(modInfo);
								case "addAllSkills": return doMod_addAllSkills(modInfo);
								case "addSpells": return doMod_addSpells(modInfo);
								case "replaceSpells": return doMod_replaceSpells(modInfo);
								case "removeSpells": return doMod_removeSpells(modInfo);
								case "scalarAddHit": return doMod_scalarAddHit(modInfo, prop);
								case "scalarAddDc": return doMod_scalarAddDc(modInfo, prop);
								case "maxSize": return doMod_maxSize(modInfo);
								case "scalarMultXp": return doMod_scalarMultXp(modInfo);
								// endregion
								default: throw new Error(`${msgPtFailed} Unhandled mode: ${modInfo.mode}`);
							}
						}
					});
				}

				properties.forEach(prop => handleProp(prop));
				// special case for "no property" modifications, i.e. underscore-key'd
				if (!properties.length) handleProp();
			}

			// apply mods
			if (copyMeta._mod) {
				// pre-convert any dynamic text
				Object.entries(copyMeta._mod).forEach(([k, v]) => {
					copyMeta._mod[k] = DataUtil.generic.variableResolver.resolve({obj: v, ent: copyTo});
				});

				Object.entries(copyMeta._mod).forEach(([prop, modInfos]) => {
					if (prop === "*") doMod(modInfos, ...DataUtil.generic.COPY_ENTRY_PROPS);
					else if (prop === "_") doMod(modInfos);
					else doMod(modInfos, prop);
				});
			}

			// add filter tag
			copyTo._isCopy = true;

			// cleanup
			delete copyTo._copy;
		},

		variableResolver: class {
			static _getSize ({ent}) { return ent.size?.[0] || Parser.SZ_MEDIUM; }

			static _SIZE_TO_MULT = {
				[Parser.SZ_LARGE]: 2,
				[Parser.SZ_HUGE]: 3,
				[Parser.SZ_GARGANTUAN]: 4,
			};

			static _getSizeMult (size) { return this._SIZE_TO_MULT[size] ?? 1; }

			static _getCleanMathExpression (str) { return str.replace(/[^-+/*0-9.,]+/g, ""); }

			static resolve ({obj, ent, msgPtFailed = null}) {
				return JSON.parse(
					JSON.stringify(obj)
						.replace(/<\$(?<variable>[^$]+)\$>/g, (...m) => {
							const [mode, detail] = m.last().variable.split("__");

							switch (mode) {
								case "name": return ent.name;
								case "short_name":
								case "title_short_name": {
									return Renderer.monster.getShortName(ent, {isTitleCase: mode === "title_short_name"});
								}

								case "dc":
								case "spell_dc": {
									if (!Parser.ABIL_ABVS.includes(detail)) throw new Error(`${msgPtFailed ? `${msgPtFailed} ` : ""} Unknown ability score "${detail}"`);
									return 8 + Parser.getAbilityModNumber(Number(ent[detail])) + Parser.crToPb(ent.cr);
								}

								case "to_hit": {
									if (!Parser.ABIL_ABVS.includes(detail)) throw new Error(`${msgPtFailed ? `${msgPtFailed} ` : ""} Unknown ability score "${detail}"`);
									const total = Parser.crToPb(ent.cr) + Parser.getAbilityModNumber(Number(ent[detail]));
									return total >= 0 ? `+${total}` : total;
								}

								case "damage_mod": {
									if (!Parser.ABIL_ABVS.includes(detail)) throw new Error(`${msgPtFailed ? `${msgPtFailed} ` : ""} Unknown ability score "${detail}"`);
									const total = Parser.getAbilityModNumber(Number(ent[detail]));
									return total === 0 ? "" : total > 0 ? ` + ${total}` : ` - ${Math.abs(total)}`;
								}

								case "damage_avg": {
									const replaced = detail
										.replace(/\b(?<abil>str|dex|con|int|wis|cha)\b/gi, (...m) => Parser.getAbilityModNumber(Number(ent[m.last().abil])))
										.replace(/\bsize_mult\b/g, () => this._getSizeMult(this._getSize({ent})));

									// eslint-disable-next-line no-eval
									return Math.floor(eval(this._getCleanMathExpression(replaced)));
								}

								case "size_mult": {
									const mult = this._getSizeMult(this._getSize({ent}));

									if (!detail) return mult;

									// eslint-disable-next-line no-eval
									return Math.floor(eval(`${mult} * ${this._getCleanMathExpression(detail)}`));
								}

								default: return m[0];
							}
						}),
				);
			}
		},

		getVersions (parent) {
			if (!parent?._versions?.length) return [];

			return parent._versions
				.map(ver => {
					if (ver._template && ver._implementations?.length) return DataUtil.generic._getVersions_template({ver});
					return DataUtil.generic._getVersions_basic({ver});
				})
				.flat()
				.map(ver => DataUtil.generic._getVersion({parentEntity: parent, version: ver}));
		},

		_getVersions_template ({ver}) {
			return ver._implementations
				.map(impl => {
					let cpyTemplate = MiscUtil.copyFast(ver._template);
					const cpyImpl = MiscUtil.copyFast(impl);

					DataUtil.generic._getVersions_mutExpandCopy({ent: cpyTemplate});

					if (cpyImpl._variables) {
						cpyTemplate = MiscUtil.getWalker()
							.walk(
								cpyTemplate,
								{
									string: str => str.replace(/{{([^}]+)}}/g, (...m) => cpyImpl._variables[m[1]]),
								},
							);
						delete cpyImpl._variables;
					}

					Object.assign(cpyTemplate, cpyImpl);

					return cpyTemplate;
				});
		},

		_getVersions_basic ({ver}) {
			const cpyVer = MiscUtil.copyFast(ver);
			DataUtil.generic._getVersions_mutExpandCopy({ent: cpyVer});
			return cpyVer;
		},

		_getVersions_mutExpandCopy ({ent}) {
			// Tweak the data structure to match what `_applyCopy` expects
			ent._copy = {
				_mod: ent._mod,
				_preserve: {"*": true},
			};
			delete ent._mod;
		},

		_getVersion ({parentEntity, version}) {
			const additionalData = {
				_versionBase_isVersion: true,
				_versionBase_name: parentEntity.name,
				_versionBase_source: parentEntity.source,
				_versionBase_hasToken: parentEntity.hasToken,
				_versionBase_hasFluff: parentEntity.hasFluff,
				_versionBase_hasFluffImages: parentEntity.hasFluffImages,
			};
			const cpyParentEntity = MiscUtil.copyFast(parentEntity);

			delete cpyParentEntity._versions;
			delete cpyParentEntity.hasToken;
			delete cpyParentEntity.hasFluff;
			delete cpyParentEntity.hasFluffImages;

			DataUtil.generic._applyCopy(
				null,
				cpyParentEntity,
				version,
				null,
			);
			Object.assign(version, additionalData);
			return version;
		},
	},

	proxy: {
		getVersions (prop, ent) {
			if (DataUtil[prop]?.getVersions) return DataUtil[prop]?.getVersions(ent);
			return DataUtil.generic.getVersions(ent);
		},

		unpackUid (prop, uid, tag, opts) {
			if (DataUtil[prop]?.unpackUid) return DataUtil[prop]?.unpackUid(uid, tag, opts);
			return DataUtil.generic.unpackUid(uid, tag, opts);
		},

		getNormalizedUid (prop, uid, tag, opts) {
			if (DataUtil[prop]?.getNormalizedUid) return DataUtil[prop].getNormalizedUid(uid, tag, opts);
			return DataUtil.generic.getNormalizedUid(uid, tag, opts);
		},

		getUid (prop, ent, opts) {
			if (DataUtil[prop]?.getUid) return DataUtil[prop].getUid(ent, opts);
			return DataUtil.generic.getUid(ent, opts);
		},
	},

	monster: class extends _DataUtilPropConfigMultiSource {
		static _MERGE_REQUIRES_PRESERVE = {
			legendaryGroup: true,
			environment: true,
			soundClip: true,
			altArt: true,
			variant: true,
			dragonCastingColor: true,
			familiar: true,
		};

		static _PAGE = UrlUtil.PG_BESTIARY;

		static _DIR = "bestiary";
		static _PROP = "monster";

		static async loadJSON () {
			await DataUtil.monster.pPreloadMeta();
			return super.loadJSON();
		}

		static getVersions (mon) {
			const additionalVersionData = DataUtil.monster._getAdditionalVersionsData(mon);
			if (additionalVersionData.length) {
				mon = MiscUtil.copyFast(mon);
				(mon._versions = mon._versions || []).push(...additionalVersionData);
			}
			return DataUtil.generic.getVersions(mon);
		}

		static _getAdditionalVersionsData (mon) {
			if (!mon.variant?.length) return [];

			return mon.variant
				.filter(it => it._version)
				.map(it => {
					const toAdd = {
						name: it._version.name || it.name,
						source: it._version.source || it.source || mon.source,
						variant: null,
					};

					if (it._version.addAs) {
						const cpy = MiscUtil.copyFast(it);
						delete cpy._version;
						delete cpy.type;
						delete cpy.source;
						delete cpy.page;

						toAdd._mod = {
							[it._version.addAs]: {
								mode: "appendArr",
								items: cpy,
							},
						};

						return toAdd;
					}

					if (it._version.addHeadersAs) {
						const cpy = MiscUtil.copyFast(it);
						cpy.entries = cpy.entries.filter(it => it.name && it.entries);
						cpy.entries.forEach(cpyEnt => {
							delete cpyEnt.type;
							delete cpyEnt.source;
						});

						toAdd._mod = {
							[it._version.addHeadersAs]: {
								mode: "appendArr",
								items: cpy.entries,
							},
						};

						return toAdd;
					}
				})
				.filter(Boolean);
		}

		static async pPreloadMeta () {
			DataUtil.monster._pLoadMeta = DataUtil.monster._pLoadMeta || ((async () => {
				const legendaryGroups = await DataUtil.legendaryGroup.pLoadAll();
				DataUtil.monster.populateMetaReference({legendaryGroup: legendaryGroups});
			})());
			await DataUtil.monster._pLoadMeta;
		}

		static _pLoadMeta = null;
		static metaGroupMap = {};
		static getMetaGroup (mon) {
			if (!mon.legendaryGroup || !mon.legendaryGroup.source || !mon.legendaryGroup.name) return null;
			return (DataUtil.monster.metaGroupMap[mon.legendaryGroup.source] || {})[mon.legendaryGroup.name];
		}
		static populateMetaReference (data) {
			(data.legendaryGroup || []).forEach(it => {
				(DataUtil.monster.metaGroupMap[it.source] =
					DataUtil.monster.metaGroupMap[it.source] || {})[it.name] = it;
			});
		}
	},

	monsterFluff: class extends _DataUtilPropConfigMultiSource {
		static _PAGE = UrlUtil.PG_BESTIARY;
		static _DIR = "bestiary";
		static _PROP = "monsterFluff";
	},

	spell: class extends _DataUtilPropConfigMultiSource {
		static _PAGE = UrlUtil.PG_SPELLS;
		static _DIR = "spells";
		static _PROP = "spell";
		static _IS_MUT_ENTITIES = true;

		static _SPELL_SOURCE_LOOKUP = null;

		// region Utilities for external applications (i.e., the spell source generation script) to use
		static setSpellSourceLookup (lookup, {isExternalApplication = false} = {}) {
			if (!isExternalApplication) throw new Error("Should not be calling this!");
			this._SPELL_SOURCE_LOOKUP = MiscUtil.copyFast(lookup);
		}

		static mutEntity (sp, {isExternalApplication = false} = {}) {
			if (!isExternalApplication) throw new Error("Should not be calling this!");
			return this._mutEntity(sp);
		}

		static unmutEntity (sp, {isExternalApplication = false} = {}) {
			if (!isExternalApplication) throw new Error("Should not be calling this!");
			delete sp.classes;
			delete sp.races;
			delete sp.optionalfeatures;
			delete sp.backgrounds;
			delete sp.feats;
			delete sp.charoptions;
			delete sp.rewards;
			delete sp._isMutEntity;
		}
		// endregion

		static async _pInitPreData_ () {
			this._SPELL_SOURCE_LOOKUP = await DataUtil.loadRawJSON(`${Renderer.get().baseUrl}data/generated/gendata-spell-source-lookup.json`);
		}

		static _mutEntity (sp) {
			if (sp._isMutEntity) return sp;

			const spSources = this._SPELL_SOURCE_LOOKUP[sp.source.toLowerCase()]?.[sp.name.toLowerCase()];
			if (!spSources) return;

			this._mutSpell_class({sp, spSources, propSources: "class", propClasses: "fromClassList"});
			this._mutSpell_class({sp, spSources, propSources: "classVariant", propClasses: "fromClassListVariant"});
			this._mutSpell_subclass({sp, spSources});
			this._mutSpell_race({sp, spSources});
			this._mutSpell_optionalfeature({sp, spSources});
			this._mutSpell_background({sp, spSources});
			this._mutSpell_feat({sp, spSources});
			this._mutSpell_charoption({sp, spSources});
			this._mutSpell_reward({sp, spSources});

			sp._isMutEntity = true;

			return sp;
		}

		static _mutSpell_class ({sp, spSources, propSources, propClasses}) {
			if (!spSources[propSources]) return;

			Object.entries(spSources[propSources])
				.forEach(([source, nameTo]) => {
					const tgt = MiscUtil.getOrSet(sp, "classes", propClasses, []);

					Object.entries(nameTo)
						.forEach(([name, val]) => {
							if (tgt.some(it => it.name === nameTo && it.source === source)) return;

							const toAdd = {name, source};
							if (val === true) return tgt.push(toAdd);

							if (val.definedInSource) {
								toAdd.definedInSource = val.definedInSource;
								tgt.push(toAdd);
								return;
							}

							if (val.definedInSources) {
								val.definedInSources
									.forEach(definedInSource => {
										const cpyToAdd = MiscUtil.copyFast(toAdd);

										if (definedInSource == null) {
											return tgt.push(cpyToAdd);
										}

										cpyToAdd.definedInSource = definedInSource;
										tgt.push(cpyToAdd);
									});

								return;
							}

							throw new Error("Unimplemented!");
						});
				});
		}

		static _mutSpell_subclass ({sp, spSources}) {
			if (!spSources.subclass) return;

			Object.entries(spSources.subclass)
				.forEach(([classSource, classNameTo]) => {
					Object.entries(classNameTo)
						.forEach(([className, sourceTo]) => {
							Object.entries(sourceTo)
								.forEach(([source, nameTo]) => {
									const tgt = MiscUtil.getOrSet(sp, "classes", "fromSubclass", []);

									Object.entries(nameTo)
										.forEach(([name, val]) => {
											if (val === true) throw new Error("Unimplemented!");

											if (tgt.some(it => it.class.name === className && it.class.source === classSource && it.subclass.name === name && it.subclass.source === source && ((it.subclass.subSubclass == null && val.subSubclasses == null) || val.subSubclasses.includes(it.subclass.subSubclass)))) return;

											const toAdd = {
												class: {
													name: className,
													source: classSource,
												},
												subclass: {
													name: val.name,
													shortName: name,
													source,
												},
											};

											if (!val.subSubclasses?.length) return tgt.push(toAdd);

											val.subSubclasses
												.forEach(subSubclass => {
													const cpyToAdd = MiscUtil.copyFast(toAdd);
													cpyToAdd.subclass.subSubclass = subSubclass;
													tgt.push(cpyToAdd);
												});
										});
								});
						});
				});
		}

		static _mutSpell_race ({sp, spSources}) {
			this._mutSpell_generic({sp, spSources, propSources: "race", propSpell: "races"});
		}

		static _mutSpell_optionalfeature ({sp, spSources}) {
			this._mutSpell_generic({sp, spSources, propSources: "optionalfeature", propSpell: "optionalfeatures"});
		}

		static _mutSpell_background ({sp, spSources}) {
			this._mutSpell_generic({sp, spSources, propSources: "background", propSpell: "backgrounds"});
		}

		static _mutSpell_feat ({sp, spSources}) {
			this._mutSpell_generic({sp, spSources, propSources: "feat", propSpell: "feats"});
		}

		static _mutSpell_charoption ({sp, spSources}) {
			this._mutSpell_generic({sp, spSources, propSources: "charoption", propSpell: "charoptions"});
		}

		static _mutSpell_reward ({sp, spSources}) {
			this._mutSpell_generic({sp, spSources, propSources: "reward", propSpell: "rewards"});
		}

		static _mutSpell_generic ({sp, spSources, propSources, propSpell}) {
			if (!spSources[propSources]) return;

			Object.entries(spSources[propSources])
				.forEach(([source, nameTo]) => {
					const tgt = MiscUtil.getOrSet(sp, propSpell, []);

					Object.entries(nameTo)
						.forEach(([name, val]) => {
							if (tgt.some(it => it.name === nameTo && it.source === source)) return;

							const toAdd = {name, source};
							if (val === true) return tgt.push(toAdd);

							Object.assign(toAdd, {...val});
							tgt.push(toAdd);
						});
				});
		}
	},

	spellFluff: class extends _DataUtilPropConfigMultiSource {
		static _PAGE = UrlUtil.PG_SPELLS;
		static _DIR = "spells";
		static _PROP = "spellFluff";
	},

	background: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_BACKGROUNDS;
		static _FILENAME = "backgrounds.json";
	},

	backgroundFluff: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_BACKGROUNDS;
		static _FILENAME = "fluff-backgrounds.json";
	},

	charoption: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_CHAR_CREATION_OPTIONS;
		static _FILENAME = "charcreationoptions.json";
	},

	charoptionFluff: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_CHAR_CREATION_OPTIONS;
		static _FILENAME = "fluff-charcreationoptions.json";
	},

	condition: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_CONDITIONS_DISEASES;
		static _FILENAME = "conditionsdiseases.json";
	},

	conditionFluff: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_CONDITIONS_DISEASES;
		static _FILENAME = "fluff-conditionsdiseases.json";
	},

	disease: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_CONDITIONS_DISEASES;
		static _FILENAME = "conditionsdiseases.json";
	},

	feat: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_FEATS;
		static _FILENAME = "feats.json";
	},

	featFluff: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_FEATS;
		static _FILENAME = "fluff-feats.json";
	},

	item: class extends _DataUtilPropConfigCustom {
		static _MERGE_REQUIRES_PRESERVE = {
			lootTables: true,
			tier: true,
		};
		static _PAGE = UrlUtil.PG_ITEMS;

		static async loadRawJSON () {
			if (DataUtil.item._loadedRawJson) return DataUtil.item._loadedRawJson;

			DataUtil.item._pLoadingRawJson = (async () => {
				const urlItems = `${Renderer.get().baseUrl}data/items.json`;
				const urlItemsBase = `${Renderer.get().baseUrl}data/items-base.json`;
				const urlVariants = `${Renderer.get().baseUrl}data/magicvariants.json`;

				const [dataItems, dataItemsBase, dataVariants] = await Promise.all([
					DataUtil.loadJSON(urlItems),
					DataUtil.loadJSON(urlItemsBase),
					DataUtil.loadJSON(urlVariants),
				]);

				DataUtil.item._loadedRawJson = {
					item: MiscUtil.copyFast(dataItems.item),
					itemGroup: MiscUtil.copyFast(dataItems.itemGroup),
					magicvariant: MiscUtil.copyFast(dataVariants.magicvariant),
					baseitem: MiscUtil.copyFast(dataItemsBase.baseitem),
				};
			})();
			await DataUtil.item._pLoadingRawJson;

			return DataUtil.item._loadedRawJson;
		}

		static async loadJSON () {
			return {item: await Renderer.item.pBuildList()};
		}

		static async loadPrerelease () {
			return {item: await Renderer.item.pGetItemsFromPrerelease()};
		}

		static async loadBrew () {
			return {item: await Renderer.item.pGetItemsFromBrew()};
		}
	},

	itemGroup: class extends _DataUtilPropConfig {
		static _MERGE_REQUIRES_PRESERVE = {
			lootTables: true,
			tier: true,
		};
		static _PAGE = UrlUtil.PG_ITEMS;

		static async pMergeCopy (...args) { return DataUtil.item.pMergeCopy(...args); }
		static async loadRawJSON (...args) { return DataUtil.item.loadRawJSON(...args); }
	},

	itemFluff: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_ITEMS;
		static _FILENAME = "fluff-items.json";
	},

	language: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_LANGUAGES;
		static _FILENAME = "languages.json";

		static async loadJSON () {
			const rawData = await super.loadJSON();

			// region Populate fonts, based on script
			const scriptLookup = {};
			(rawData.languageScript || []).forEach(script => scriptLookup[script.name] = script);

			const out = {language: MiscUtil.copyFast(rawData.language)};
			out.language.forEach(lang => {
				if (!lang.script || lang.fonts === false) return;

				const script = scriptLookup[lang.script];
				if (!script) return;

				lang._fonts = [...script.fonts];
			});
			// endregion

			return out;
		}
	},

	languageFluff: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_LANGUAGES;
		static _FILENAME = "fluff-languages.json";
	},

	object: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_OBJECTS;
		static _FILENAME = "objects.json";
	},

	objectFluff: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_OBJECTS;
		static _FILENAME = "fluff-objects.json";
	},

	race: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_RACES;
		static _FILENAME = "races.json";

		static _loadCache = {};
		static _pIsLoadings = {};
		static async loadJSON ({isAddBaseRaces = false} = {}) {
			if (!DataUtil.race._pIsLoadings[isAddBaseRaces]) {
				DataUtil.race._pIsLoadings[isAddBaseRaces] = (async () => {
					DataUtil.race._loadCache[isAddBaseRaces] = DataUtil.race.getPostProcessedSiteJson(
						await this.loadRawJSON(),
						{isAddBaseRaces},
					);
				})();
			}
			await DataUtil.race._pIsLoadings[isAddBaseRaces];
			return DataUtil.race._loadCache[isAddBaseRaces];
		}

		static getPostProcessedSiteJson (rawRaceData, {isAddBaseRaces = false} = {}) {
			rawRaceData = MiscUtil.copyFast(rawRaceData);
			(rawRaceData.subrace || []).forEach(sr => {
				const r = rawRaceData.race.find(it => it.name === sr.raceName && it.source === sr.raceSource);
				if (!r) return JqueryUtil.doToast({content: `Failed to find race "${sr.raceName}" (${sr.raceSource})`, type: "danger"});
				const cpySr = MiscUtil.copyFast(sr);
				delete cpySr.raceName;
				delete cpySr.raceSource;
				(r.subraces = r.subraces || []).push(sr);
			});
			delete rawRaceData.subrace;
			const raceData = Renderer.race.mergeSubraces(rawRaceData.race, {isAddBaseRaces});
			raceData.forEach(it => it.__prop = "race");
			return {race: raceData};
		}

		static async loadPrerelease ({isAddBaseRaces = true} = {}) {
			return DataUtil.race._loadPrereleaseBrew({isAddBaseRaces, brewUtil: typeof PrereleaseUtil !== "undefined" ? PrereleaseUtil : null});
		}

		static async loadBrew ({isAddBaseRaces = true} = {}) {
			return DataUtil.race._loadPrereleaseBrew({isAddBaseRaces, brewUtil: typeof BrewUtil2 !== "undefined" ? BrewUtil2 : null});
		}

		static async _loadPrereleaseBrew ({isAddBaseRaces = true, brewUtil} = {}) {
			if (!brewUtil) return {};

			const rawSite = await DataUtil.race.loadRawJSON();
			const brew = await brewUtil.pGetBrewProcessed();
			return DataUtil.race.getPostProcessedPrereleaseBrewJson(rawSite, brew, {isAddBaseRaces});
		}

		static getPostProcessedPrereleaseBrewJson (rawSite, brew, {isAddBaseRaces = false} = {}) {
			rawSite = MiscUtil.copyFast(rawSite);
			brew = MiscUtil.copyFast(brew);

			const rawSiteUsed = [];
			(brew.subrace || []).forEach(sr => {
				const rSite = rawSite.race.find(it => it.name === sr.raceName && it.source === sr.raceSource);
				const rBrew = (brew.race || []).find(it => it.name === sr.raceName && it.source === sr.raceSource);
				if (!rSite && !rBrew) return JqueryUtil.doToast({content: `Failed to find race "${sr.raceName}" (${sr.raceSource})`, type: "danger"});
				const rTgt = rSite || rBrew;
				const cpySr = MiscUtil.copyFast(sr);
				delete cpySr.raceName;
				delete cpySr.raceSource;
				(rTgt.subraces = rTgt.subraces || []).push(sr);
				if (rSite && !rawSiteUsed.includes(rSite)) rawSiteUsed.push(rSite);
			});
			delete brew.subrace;

			const raceDataBrew = Renderer.race.mergeSubraces(brew.race || [], {isAddBaseRaces});
			// Never add base races from site races when building brew race list
			const raceDataSite = Renderer.race.mergeSubraces(rawSiteUsed, {isAddBaseRaces: false});

			const out = [...raceDataBrew, ...raceDataSite];
			out.forEach(it => it.__prop = "race");
			return {race: out};
		}
	},

	raceFluff: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_RACES;
		static _FILENAME = "fluff-races.json";

		static _getApplyUncommonMonstrous (data) {
			data = MiscUtil.copyFast(data);
			data.raceFluff
				.forEach(raceFluff => {
					if (raceFluff.uncommon) {
						raceFluff.entries = raceFluff.entries || [];
						raceFluff.entries.push(MiscUtil.copyFast(data.raceFluffMeta.uncommon));
						delete raceFluff.uncommon;
					}

					if (raceFluff.monstrous) {
						raceFluff.entries = raceFluff.entries || [];
						raceFluff.entries.push(MiscUtil.copyFast(data.raceFluffMeta.monstrous));
						delete raceFluff.monstrous;
					}
				});
			return data;
		}

		static async loadJSON () {
			const data = await super.loadJSON();
			return this._getApplyUncommonMonstrous(data);
		}

		static async loadUnmergedJSON () {
			const data = await super.loadUnmergedJSON();
			return this._getApplyUncommonMonstrous(data);
		}
	},

	recipe: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_RECIPES;
		static _FILENAME = "recipes.json";

		static async loadJSON () {
			const out = [];

			const rawData = await super.loadJSON();

			DataUtil.recipe.postProcessData(rawData);

			// region Merge together main data and fluff, as we render the fluff in the main tab
			for (const r of rawData.recipe) {
				const fluff = await Renderer.utils.pGetFluff({
					entity: r,
					fnGetFluffData: DataUtil.recipeFluff.loadJSON.bind(DataUtil.recipeFluff),
					fluffProp: "recipeFluff",
				});

				if (!fluff) {
					out.push(r);
					continue;
				}

				const cpyR = MiscUtil.copyFast(r);
				cpyR.fluff = MiscUtil.copyFast(fluff);
				delete cpyR.fluff.name;
				delete cpyR.fluff.source;
				out.push(cpyR);
			}
			// endregion

			return {recipe: out};
		}

		static postProcessData (data) {
			if (!data.recipe || !data.recipe.length) return;

			// Apply ingredient properties
			data.recipe.forEach(r => Renderer.recipe.populateFullIngredients(r));
		}

		static async loadPrerelease () {
			return this._loadPrereleaseBrew({brewUtil: typeof PrereleaseUtil !== "undefined" ? PrereleaseUtil : null});
		}

		static async loadBrew () {
			return this._loadPrereleaseBrew({brewUtil: typeof BrewUtil2 !== "undefined" ? BrewUtil2 : null});
		}

		static async _loadPrereleaseBrew ({brewUtil}) {
			if (!brewUtil) return {};

			const brew = await brewUtil.pGetBrewProcessed();
			DataUtil.recipe.postProcessData(brew);
			return brew;
		}
	},

	recipeFluff: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_RECIPES;
		static _FILENAME = "fluff-recipes.json";
	},

	vehicle: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_VEHICLES;
		static _FILENAME = "vehicles.json";
	},

	vehicleFluff: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_VEHICLES;
		static _FILENAME = "fluff-vehicles.json";
	},

	optionalfeature: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_OPT_FEATURES;
		static _FILENAME = "optionalfeatures.json";
	},

	class: class clazz extends _DataUtilPropConfigCustom {
		static _PAGE = UrlUtil.PG_CLASSES;

		static _pLoadJson = null;
		static _pLoadRawJson = null;

		static loadJSON () {
			return DataUtil.class._pLoadJson = DataUtil.class._pLoadJson || (async () => {
				return {
					class: await DataLoader.pCacheAndGetAllSite("class"),
					subclass: await DataLoader.pCacheAndGetAllSite("subclass"),
				};
			})();
		}

		static loadRawJSON () {
			return DataUtil.class._pLoadRawJson = DataUtil.class._pLoadRawJson || (async () => {
				const index = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/class/index.json`);
				const allData = await Promise.all(Object.values(index).map(it => DataUtil.loadJSON(`${Renderer.get().baseUrl}data/class/${it}`)));

				return {
					class: MiscUtil.copyFast(allData.map(it => it.class || []).flat()),
					subclass: MiscUtil.copyFast(allData.map(it => it.subclass || []).flat()),
					classFeature: allData.map(it => it.classFeature || []).flat(),
					subclassFeature: allData.map(it => it.subclassFeature || []).flat(),
				};
			})();
		}

		static async loadPrerelease () {
			return {
				class: await DataLoader.pCacheAndGetAllPrerelease("class"),
				subclass: await DataLoader.pCacheAndGetAllPrerelease("subclass"),
			};
		}

		static async loadBrew () {
			return {
				class: await DataLoader.pCacheAndGetAllBrew("class"),
				subclass: await DataLoader.pCacheAndGetAllBrew("subclass"),
			};
		}

		static packUidSubclass (it) {
			// <name>|<className>|<classSource>|<source>
			const sourceDefault = Parser.getTagSource("subclass");
			return [
				it.name,
				it.className,
				(it.classSource || "").toLowerCase() === sourceDefault.toLowerCase() ? "" : it.classSource,
				(it.source || "").toLowerCase() === sourceDefault.toLowerCase() ? "" : it.source,
			].join("|").replace(/\|+$/, ""); // Trim trailing pipes
		}

		/**
		 * @param uid
		 * @param [opts]
		 * @param [opts.isLower] If the returned values should be lowercase.
		 */
		static unpackUidClassFeature (uid, opts) {
			opts = opts || {};
			if (opts.isLower) uid = uid.toLowerCase();
			let [name, className, classSource, level, source, displayText] = uid.split("|").map(it => it.trim());
			classSource = classSource || (opts.isLower ? Parser.SRC_PHB.toLowerCase() : Parser.SRC_PHB);
			source = source || classSource;
			level = Number(level);
			return {
				name,
				className,
				classSource,
				level,
				source,
				displayText,
			};
		}

		static isValidClassFeatureUid (uid) {
			const {name, className, level} = DataUtil.class.unpackUidClassFeature(uid);
			return !(!name || !className || isNaN(level));
		}

		static packUidClassFeature (f) {
			// <name>|<className>|<classSource>|<level>|<source>
			return [
				f.name,
				f.className,
				f.classSource === Parser.SRC_PHB ? "" : f.classSource, // assume the class has PHB source
				f.level,
				f.source === f.classSource ? "" : f.source, // assume the class feature has the class source
			].join("|").replace(/\|+$/, ""); // Trim trailing pipes
		}

		/**
		 * @param uid
		 * @param [opts]
		 * @param [opts.isLower] If the returned values should be lowercase.
		 */
		static unpackUidSubclassFeature (uid, opts) {
			opts = opts || {};
			if (opts.isLower) uid = uid.toLowerCase();
			let [name, className, classSource, subclassShortName, subclassSource, level, source, displayText] = uid.split("|").map(it => it.trim());
			classSource = classSource || (opts.isLower ? Parser.SRC_PHB.toLowerCase() : Parser.SRC_PHB);
			subclassSource = subclassSource || (opts.isLower ? Parser.SRC_PHB.toLowerCase() : Parser.SRC_PHB);
			source = source || subclassSource;
			level = Number(level);
			return {
				name,
				className,
				classSource,
				subclassShortName,
				subclassSource,
				level,
				source,
				displayText,
			};
		}

		static isValidSubclassFeatureUid (uid) {
			const {name, className, subclassShortName, level} = DataUtil.class.unpackUidSubclassFeature(uid);
			return !(!name || !className || !subclassShortName || isNaN(level));
		}

		static packUidSubclassFeature (f) {
			// <name>|<className>|<classSource>|<subclassShortName>|<subclassSource>|<level>|<source>
			return [
				f.name,
				f.className,
				f.classSource === Parser.SRC_PHB ? "" : f.classSource, // assume the class has the PHB source
				f.subclassShortName,
				f.subclassSource === Parser.SRC_PHB ? "" : f.subclassSource, // assume the subclass has the PHB source
				f.level,
				f.source === f.subclassSource ? "" : f.source, // assume the feature has the same source as the subclass
			].join("|").replace(/\|+$/, ""); // Trim trailing pipes
		}

		// region Subclass lookup
		static _CACHE_SUBCLASS_LOOKUP_PROMISE = null;
		static _CACHE_SUBCLASS_LOOKUP = null;
		static async pGetSubclassLookup () {
			DataUtil.class._CACHE_SUBCLASS_LOOKUP_PROMISE = DataUtil.class._CACHE_SUBCLASS_LOOKUP_PROMISE || (async () => {
				const subclassLookup = {};
				Object.assign(subclassLookup, await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/generated/gendata-subclass-lookup.json`));
				DataUtil.class._CACHE_SUBCLASS_LOOKUP = subclassLookup;
			})();
			await DataUtil.class._CACHE_SUBCLASS_LOOKUP_PROMISE;
			return DataUtil.class._CACHE_SUBCLASS_LOOKUP;
		}
		// endregion
	},

	subclass: class extends _DataUtilPropConfig {
		static _PAGE = "subclass";
	},

	deity: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_DEITIES;
		static _FILENAME = "deities.json";

		static doPostLoad (data) {
			const PRINT_ORDER = [
				Parser.SRC_PHB,
				Parser.SRC_DMG,
				Parser.SRC_SCAG,
				Parser.SRC_VGM,
				Parser.SRC_MTF,
				Parser.SRC_ERLW,
			];

			const inSource = {};
			PRINT_ORDER.forEach(src => {
				inSource[src] = {};
				data.deity.filter(it => it.source === src).forEach(it => inSource[src][it.reprintAlias || it.name] = it); // TODO need to handle similar names
			});

			const laterPrinting = [PRINT_ORDER.last()];
			[...PRINT_ORDER].reverse().slice(1).forEach(src => {
				laterPrinting.forEach(laterSrc => {
					Object.keys(inSource[src]).forEach(name => {
						const newer = inSource[laterSrc][name];
						if (newer) {
							const old = inSource[src][name];
							old.reprinted = true;
							if (!newer._isEnhanced) {
								newer.previousVersions = newer.previousVersions || [];
								newer.previousVersions.push(old);
							}
						}
					});
				});

				laterPrinting.push(src);
			});
			data.deity.forEach(g => g._isEnhanced = true);

			return data;
		}

		static async loadJSON () {
			const data = await super.loadJSON();
			DataUtil.deity.doPostLoad(data);
			return data;
		}

		static getUid (ent, opts) {
			return this.packUidDeity(ent, opts);
		}

		static getNormalizedUid (uid, tag) {
			const {name, pantheon, source} = this.unpackUidDeity(uid, tag, {isLower: true});
			return [name, pantheon, source].join("|");
		}

		static unpackUidDeity (uid, opts) {
			opts = opts || {};
			if (opts.isLower) uid = uid.toLowerCase();
			let [name, pantheon, source, displayText, ...others] = uid.split("|").map(it => it.trim());

			pantheon = pantheon || "forgotten realms";
			if (opts.isLower) pantheon = pantheon.toLowerCase();

			source = source || Parser.getTagSource("deity", source);
			if (opts.isLower) source = source.toLowerCase();

			return {
				name,
				pantheon,
				source,
				displayText,
				others,
			};
		}

		static packUidDeity (it) {
			// <name>|<pantheon>|<source>
			const sourceDefault = Parser.getTagSource("deity");
			return [
				it.name,
				(it.pantheon || "").toLowerCase() === "forgotten realms" ? "" : it.pantheon,
				(it.source || "").toLowerCase() === sourceDefault.toLowerCase() ? "" : it.source,
			].join("|").replace(/\|+$/, ""); // Trim trailing pipes
		}
	},

	table: class extends _DataUtilPropConfigCustom {
		static async loadJSON () {
			const datas = await Promise.all([
				`${Renderer.get().baseUrl}data/generated/gendata-tables.json`,
				`${Renderer.get().baseUrl}data/tables.json`,
			].map(url => DataUtil.loadJSON(url)));
			const combined = {};
			datas.forEach(data => {
				Object.entries(data).forEach(([k, v]) => {
					if (combined[k] && combined[k] instanceof Array && v instanceof Array) combined[k] = combined[k].concat(v);
					else if (combined[k] == null) combined[k] = v;
					else throw new Error(`Could not merge keys for key "${k}"`);
				});
			});

			return combined;
		}
	},

	legendaryGroup: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_BESTIARY;
		static _FILENAME = "bestiary/legendarygroups.json";

		static async pLoadAll () {
			return (await this.loadJSON()).legendaryGroup;
		}
	},

	variantrule: class extends _DataUtilPropConfigSingleSource {
		static _PAGE = UrlUtil.PG_VARIANTRULES;
		static _FILENAME = "variantrules.json";

		static async loadJSON () {
			const rawData = await super.loadJSON();
			const rawDataGenerated = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/generated/gendata-variantrules.json`);

			return {variantrule: [...rawData.variantrule, ...rawDataGenerated.variantrule]};
		}
	},

	deck: class extends _DataUtilPropConfigCustom {
		static _PAGE = UrlUtil.PG_DECKS;

		static _pLoadJson = null;
		static _pLoadRawJson = null;

		static loadJSON () {
			return DataUtil.deck._pLoadJson = DataUtil.deck._pLoadJson || (async () => {
				return {
					deck: await DataLoader.pCacheAndGetAllSite("deck"),
					card: await DataLoader.pCacheAndGetAllSite("card"),
				};
			})();
		}

		static loadRawJSON () {
			return DataUtil.deck._pLoadRawJson = DataUtil.deck._pLoadRawJson || DataUtil.loadJSON(`${Renderer.get().baseUrl}data/decks.json`);
		}

		static async loadPrerelease () {
			return {
				deck: await DataLoader.pCacheAndGetAllPrerelease("deck"),
				card: await DataLoader.pCacheAndGetAllPrerelease("card"),
			};
		}

		static async loadBrew () {
			return {
				deck: await DataLoader.pCacheAndGetAllBrew("deck"),
				card: await DataLoader.pCacheAndGetAllBrew("card"),
			};
		}

		/**
		 * @param uid
		 * @param [opts]
		 * @param [opts.isLower] If the returned values should be lowercase.
		 */
		static unpackUidCard (uid, opts) {
			opts = opts || {};
			if (opts.isLower) uid = uid.toLowerCase();
			let [name, set, source, displayText] = uid.split("|").map(it => it.trim());
			set = set || "none";
			source = source || Parser.getTagSource("card", source)[opts.isLower ? "toLowerCase" : "toString"]();
			return {
				name,
				set,
				source,
				displayText,
			};
		}
	},

	quickreference: {
		/**
		 * @param uid
		 * @param [opts]
		 * @param [opts.isLower] If the returned values should be lowercase.
		 */
		unpackUid (uid, opts) {
			opts = opts || {};
			if (opts.isLower) uid = uid.toLowerCase();
			let [name, source, ixChapter, ixHeader, displayText] = uid.split("|").map(it => it.trim());
			source = source || (opts.isLower ? Parser.SRC_PHB.toLowerCase() : Parser.SRC_PHB);
			ixChapter = Number(ixChapter || 0);
			return {
				name,
				ixChapter,
				ixHeader,
				source,
				displayText,
			};
		},
	},

	brew: new _DataUtilBrewHelper({defaultUrlRoot: VeCt.URL_ROOT_BREW}),
	prerelease: new _DataUtilBrewHelper({defaultUrlRoot: VeCt.URL_ROOT_PRERELEASE}),
};

// ROLLING =============================================================================================================
globalThis.RollerUtil = {
	isCrypto () {
		return typeof window !== "undefined" && typeof window.crypto !== "undefined";
	},

	randomise (max, min = 1) {
		if (min > max) return 0;
		if (max === min) return max;
		if (RollerUtil.isCrypto()) {
			return RollerUtil._randomise(min, max + 1);
		} else {
			return RollerUtil.roll(max) + min;
		}
	},

	rollOnArray (array) {
		return array[RollerUtil.randomise(array.length) - 1];
	},

	/**
	 * Cryptographically secure RNG
	 */
	_randomise: (min, max) => {
		if (isNaN(min) || isNaN(max)) throw new Error(`Invalid min/max!`);

		const range = max - min;
		const bytesNeeded = Math.ceil(Math.log2(range) / 8);
		const randomBytes = new Uint8Array(bytesNeeded);
		const maximumRange = (2 ** 8) ** bytesNeeded;
		const extendedRange = Math.floor(maximumRange / range) * range;
		let i;
		let randomInteger;
		while (true) {
			window.crypto.getRandomValues(randomBytes);
			randomInteger = 0;
			for (i = 0; i < bytesNeeded; i++) {
				randomInteger <<= 8;
				randomInteger += randomBytes[i];
			}
			if (randomInteger < extendedRange) {
				randomInteger %= range;
				return min + randomInteger;
			}
		}
	},

	/**
	 * Result in range: 0 to (max-1); inclusive
	 * e.g. roll(20) gives results ranging from 0 to 19
	 * @param max range max (exclusive)
	 * @param fn funciton to call to generate random numbers
	 * @returns {number} rolled
	 */
	roll (max, fn = Math.random) {
		return Math.floor(fn() * max);
	},

	addListRollButton (isCompact) {

	},

	getColRollType (colLabel) {
		if (typeof colLabel !== "string") return false;
		colLabel = Renderer.stripTags(colLabel);

		if (Renderer.dice.lang.getTree3(colLabel)) return RollerUtil.ROLL_COL_STANDARD;

		// Remove trailing variables, if they exist
		colLabel = colLabel.replace(RollerUtil._REGEX_ROLLABLE_COL_LABEL, "$1");
		if (Renderer.dice.lang.getTree3(colLabel)) return RollerUtil.ROLL_COL_VARIABLE;

		return RollerUtil.ROLL_COL_NONE;
	},

	getFullRollCol (lbl) {
		if (lbl.includes("@dice")) return lbl;

		if (Renderer.dice.lang.getTree3(lbl)) return `{@dice ${lbl}}`;

		// Try to split off any trailing variables, e.g. `d100 + Level` -> `d100`, `Level`
		const m = RollerUtil._REGEX_ROLLABLE_COL_LABEL.exec(lbl);
		if (!m) return lbl;

		return `{@dice ${m[1]}${m[2]}#$prompt_number:title=Enter a ${m[3].trim()}$#|${lbl}}`;
	},

	_DICE_REGEX_STR: "((([1-9]\\d*)?d([1-9]\\d*)(\\s*?[-+×x*÷/]\\s*?(\\d,\\d|\\d)+(\\.\\d+)?)?))+?",
};
RollerUtil.DICE_REGEX = new RegExp(RollerUtil._DICE_REGEX_STR, "g");
RollerUtil.REGEX_DAMAGE_DICE = /(?<average>\d+)(?<prefix> \((?:{@dice |{@damage ))(?<diceExp>[-+0-9d ]*)(?<suffix>}\)(?:\s*\+\s*the spell's level)? [a-z]+( \([-a-zA-Z0-9 ]+\))?( or [a-z]+( \([-a-zA-Z0-9 ]+\))?)? damage)/gi;
RollerUtil.REGEX_DAMAGE_FLAT = /(?<prefix>Hit: |{@h})(?<flatVal>[0-9]+)(?<suffix> [a-z]+( \([-a-zA-Z0-9 ]+\))?( or [a-z]+( \([-a-zA-Z0-9 ]+\))?)? damage)/gi;
RollerUtil._REGEX_ROLLABLE_COL_LABEL = /^(.*?\d)(\s*[-+/*^×÷]\s*)([a-zA-Z0-9 ]+)$/;
RollerUtil.ROLL_COL_NONE = 0;
RollerUtil.ROLL_COL_STANDARD = 1;
RollerUtil.ROLL_COL_VARIABLE = 2;

// STORAGE =============================================================================================================
// Dependency: localforage
function StorageUtilBase () {
	this._META_KEY = "_STORAGE_META_STORAGE";

	this._fakeStorageBacking = {};
	this._fakeStorageBackingAsync = {};

	this._getFakeStorageSync = function () {
		return {
			isSyncFake: true,
			getItem: k => this._fakeStorageBacking[k],
			removeItem: k => delete this._fakeStorageBacking[k],
			setItem: (k, v) => this._fakeStorageBacking[k] = v,
		};
	};

	this._getFakeStorageAsync = function () {
		return {
			pIsAsyncFake: true,
			setItem: async (k, v) => this._fakeStorageBackingAsync[k] = v,
			getItem: async (k) => this._fakeStorageBackingAsync[k],
			removeItem: async (k) => delete this._fakeStorageBackingAsync[k],
		};
	};

	this._getSyncStorage = function () { throw new Error(`Unimplemented!`); };
	this._getAsyncStorage = async function () { throw new Error(`Unimplemented!`); };

	this.getPageKey = function (key, page) { return `${key}_${page || UrlUtil.getCurrentPage()}`; };

	// region Synchronous
	this.syncGet = function (key) {
		const rawOut = this._getSyncStorage().getItem(key);
		if (rawOut && rawOut !== "undefined" && rawOut !== "null") return JSON.parse(rawOut);
		return null;
	};

	this.syncSet = function (key, value) {
		this._getSyncStorage().setItem(key, JSON.stringify(value));
		this._syncTrackKey(key);
	};

	this.syncRemove = function (key) {
		this._getSyncStorage().removeItem(key);
		this._syncTrackKey(key, true);
	};

	this.syncGetForPage = function (key) { return this.syncGet(`${key}_${UrlUtil.getCurrentPage()}`); };
	this.syncSetForPage = function (key, value) { this.syncSet(`${key}_${UrlUtil.getCurrentPage()}`, value); };

	this.isSyncFake = function () {
		return !!this._getSyncStorage().isSyncFake;
	};

	this._syncTrackKey = function (key, isRemove) {
		const meta = this.syncGet(this._META_KEY) || {};
		if (isRemove) delete meta[key];
		else meta[key] = 1;
		this._getSyncStorage().setItem(this._META_KEY, JSON.stringify(meta));
	};

	this.syncGetDump = function () {
		const out = {};
		this._syncGetPresentKeys().forEach(key => out[key] = this.syncGet(key));
		return out;
	};

	this._syncGetPresentKeys = function () {
		const meta = this.syncGet(this._META_KEY) || {};
		return Object.entries(meta).filter(([, isPresent]) => isPresent).map(([key]) => key);
	};

	this.syncSetFromDump = function (dump) {
		const keysToRemove = new Set(this._syncGetPresentKeys());
		Object.entries(dump).map(([k, v]) => {
			keysToRemove.delete(k);
			return this.syncSet(k, v);
		});
		[...keysToRemove].map(k => this.syncRemove(k));
	};
	// endregion

	// region Asynchronous
	this.pIsAsyncFake = async function () {
		const storage = await this._getAsyncStorage();
		return !!storage.pIsAsyncFake;
	};

	this.pSet = async function (key, value) {
		this._pTrackKey(key).then(null);
		const storage = await this._getAsyncStorage();
		return storage.setItem(key, value);
	};

	this.pGet = async function (key) {
		const storage = await this._getAsyncStorage();
		return storage.getItem(key);
	};

	this.pRemove = async function (key) {
		this._pTrackKey(key, true).then(null);
		const storage = await this._getAsyncStorage();
		return storage.removeItem(key);
	};

	this.pGetForPage = async function (key, {page = null} = {}) { return this.pGet(this.getPageKey(key, page)); };
	this.pSetForPage = async function (key, value, {page = null} = {}) { return this.pSet(this.getPageKey(key, page), value); };
	this.pRemoveForPage = async function (key, {page = null} = {}) { return this.pRemove(this.getPageKey(key, page)); };

	this._pTrackKey = async function (key, isRemove) {
		const storage = await this._getAsyncStorage();
		const meta = (await this.pGet(this._META_KEY)) || {};
		if (isRemove) delete meta[key];
		else meta[key] = 1;
		return storage.setItem(this._META_KEY, meta);
	};

	this.pGetDump = async function () {
		const out = {};
		await Promise.all(
			(await this._pGetPresentKeys()).map(async (key) => out[key] = await this.pGet(key)),
		);
		return out;
	};

	this._pGetPresentKeys = async function () {
		const meta = (await this.pGet(this._META_KEY)) || {};
		return Object.entries(meta).filter(([, isPresent]) => isPresent).map(([key]) => key);
	};

	this.pSetFromDump = async function (dump) {
		const keysToRemove = new Set(await this._pGetPresentKeys());
		await Promise.all(
			Object.entries(dump).map(([k, v]) => {
				keysToRemove.delete(k);
				return this.pSet(k, v);
			}),
		);
		await Promise.all(
			[...keysToRemove].map(k => this.pRemove(k)),
		);
	};
	// endregion
}

function StorageUtilMemory () {
	StorageUtilBase.call(this);

	this._fakeStorage = null;
	this._fakeStorageAsync = null;

	this._getSyncStorage = function () {
		this._fakeStorage = this._fakeStorage || this._getFakeStorageSync();
		return this._fakeStorage;
	};

	this._getAsyncStorage = async function () {
		this._fakeStorageAsync = this._fakeStorageAsync || this._getFakeStorageAsync();
		return this._fakeStorageAsync;
	};
}

globalThis.StorageUtilMemory = StorageUtilMemory;

function StorageUtilBacked () {
	StorageUtilBase.call(this);

	this._isInit = false;
	this._isInitAsync = false;
	this._fakeStorage = null;
	this._fakeStorageAsync = null;

	this._initSyncStorage = function () {
		if (this._isInit) return;

		if (typeof window === "undefined") {
			this._fakeStorage = this._getFakeStorageSync();
			this._isInit = true;
			return;
		}

		try {
			window.localStorage.setItem("_test_storage", true);
		} catch (e) {
			// if the user has disabled cookies, build a fake version
			this._fakeStorage = this._getFakeStorageSync();
		}

		this._isInit = true;
	};

	this._getSyncStorage = function () {
		this._initSyncStorage();
		if (this._fakeStorage) return this._fakeStorage;
		return window.localStorage;
	};

	this._initAsyncStorage = async function () {
		if (this._isInitAsync) return;

		if (typeof window === "undefined") {
			this._fakeStorageAsync = this._getFakeStorageAsync();
			this._isInitAsync = true;
			return;
		}

		try {
			// check if IndexedDB is available (i.e. not in Firefox private browsing)
			await new Promise((resolve, reject) => {
				const request = window.indexedDB.open("_test_db", 1);
				request.onerror = reject;
				request.onsuccess = resolve;
			});
			await localforage.setItem("_storage_check", true);
		} catch (e) {
			this._fakeStorageAsync = this._getFakeStorageAsync();
		}

		this._isInitAsync = true;
	};

	this._getAsyncStorage = async function () {
		await this._initAsyncStorage();
		if (this._fakeStorageAsync) return this._fakeStorageAsync;
		else return localforage;
	};
}

globalThis.StorageUtil = new StorageUtilBacked();

// TODO transition cookie-like storage items over to this
globalThis.SessionStorageUtil = {
	_fakeStorage: {},
	__storage: null,
	getStorage: () => {
		try {
			return window.sessionStorage;
		} catch (e) {
			// if the user has disabled cookies, build a fake version
			if (SessionStorageUtil.__storage) return SessionStorageUtil.__storage;
			else {
				return SessionStorageUtil.__storage = {
					isFake: true,
					getItem: (k) => {
						return SessionStorageUtil._fakeStorage[k];
					},
					removeItem: (k) => {
						delete SessionStorageUtil._fakeStorage[k];
					},
					setItem: (k, v) => {
						SessionStorageUtil._fakeStorage[k] = v;
					},
				};
			}
		}
	},

	isFake () {
		return SessionStorageUtil.getStorage().isSyncFake;
	},

	setForPage: (key, value) => {
		SessionStorageUtil.set(`${key}_${UrlUtil.getCurrentPage()}`, value);
	},

	set (key, value) {
		SessionStorageUtil.getStorage().setItem(key, JSON.stringify(value));
	},

	getForPage: (key) => {
		return SessionStorageUtil.get(`${key}_${UrlUtil.getCurrentPage()}`);
	},

	get (key) {
		const rawOut = SessionStorageUtil.getStorage().getItem(key);
		if (rawOut && rawOut !== "undefined" && rawOut !== "null") return JSON.parse(rawOut);
		return null;
	},

	removeForPage: (key) => {
		SessionStorageUtil.remove(`${key}_${UrlUtil.getCurrentPage()}`);
	},

	remove (key) {
		SessionStorageUtil.getStorage().removeItem(key);
	},
};

// ID GENERATION =======================================================================================================
globalThis.CryptUtil = {
	// region md5 internals
	// stolen from http://www.myersdaily.org/joseph/javascript/md5.js
	_md5cycle: (x, k) => {
		let a = x[0];
		let b = x[1];
		let c = x[2];
		let d = x[3];

		a = CryptUtil._ff(a, b, c, d, k[0], 7, -680876936);
		d = CryptUtil._ff(d, a, b, c, k[1], 12, -389564586);
		c = CryptUtil._ff(c, d, a, b, k[2], 17, 606105819);
		b = CryptUtil._ff(b, c, d, a, k[3], 22, -1044525330);
		a = CryptUtil._ff(a, b, c, d, k[4], 7, -176418897);
		d = CryptUtil._ff(d, a, b, c, k[5], 12, 1200080426);
		c = CryptUtil._ff(c, d, a, b, k[6], 17, -1473231341);
		b = CryptUtil._ff(b, c, d, a, k[7], 22, -45705983);
		a = CryptUtil._ff(a, b, c, d, k[8], 7, 1770035416);
		d = CryptUtil._ff(d, a, b, c, k[9], 12, -1958414417);
		c = CryptUtil._ff(c, d, a, b, k[10], 17, -42063);
		b = CryptUtil._ff(b, c, d, a, k[11], 22, -1990404162);
		a = CryptUtil._ff(a, b, c, d, k[12], 7, 1804603682);
		d = CryptUtil._ff(d, a, b, c, k[13], 12, -40341101);
		c = CryptUtil._ff(c, d, a, b, k[14], 17, -1502002290);
		b = CryptUtil._ff(b, c, d, a, k[15], 22, 1236535329);

		a = CryptUtil._gg(a, b, c, d, k[1], 5, -165796510);
		d = CryptUtil._gg(d, a, b, c, k[6], 9, -1069501632);
		c = CryptUtil._gg(c, d, a, b, k[11], 14, 643717713);
		b = CryptUtil._gg(b, c, d, a, k[0], 20, -373897302);
		a = CryptUtil._gg(a, b, c, d, k[5], 5, -701558691);
		d = CryptUtil._gg(d, a, b, c, k[10], 9, 38016083);
		c = CryptUtil._gg(c, d, a, b, k[15], 14, -660478335);
		b = CryptUtil._gg(b, c, d, a, k[4], 20, -405537848);
		a = CryptUtil._gg(a, b, c, d, k[9], 5, 568446438);
		d = CryptUtil._gg(d, a, b, c, k[14], 9, -1019803690);
		c = CryptUtil._gg(c, d, a, b, k[3], 14, -187363961);
		b = CryptUtil._gg(b, c, d, a, k[8], 20, 1163531501);
		a = CryptUtil._gg(a, b, c, d, k[13], 5, -1444681467);
		d = CryptUtil._gg(d, a, b, c, k[2], 9, -51403784);
		c = CryptUtil._gg(c, d, a, b, k[7], 14, 1735328473);
		b = CryptUtil._gg(b, c, d, a, k[12], 20, -1926607734);

		a = CryptUtil._hh(a, b, c, d, k[5], 4, -378558);
		d = CryptUtil._hh(d, a, b, c, k[8], 11, -2022574463);
		c = CryptUtil._hh(c, d, a, b, k[11], 16, 1839030562);
		b = CryptUtil._hh(b, c, d, a, k[14], 23, -35309556);
		a = CryptUtil._hh(a, b, c, d, k[1], 4, -1530992060);
		d = CryptUtil._hh(d, a, b, c, k[4], 11, 1272893353);
		c = CryptUtil._hh(c, d, a, b, k[7], 16, -155497632);
		b = CryptUtil._hh(b, c, d, a, k[10], 23, -1094730640);
		a = CryptUtil._hh(a, b, c, d, k[13], 4, 681279174);
		d = CryptUtil._hh(d, a, b, c, k[0], 11, -358537222);
		c = CryptUtil._hh(c, d, a, b, k[3], 16, -722521979);
		b = CryptUtil._hh(b, c, d, a, k[6], 23, 76029189);
		a = CryptUtil._hh(a, b, c, d, k[9], 4, -640364487);
		d = CryptUtil._hh(d, a, b, c, k[12], 11, -421815835);
		c = CryptUtil._hh(c, d, a, b, k[15], 16, 530742520);
		b = CryptUtil._hh(b, c, d, a, k[2], 23, -995338651);

		a = CryptUtil._ii(a, b, c, d, k[0], 6, -198630844);
		d = CryptUtil._ii(d, a, b, c, k[7], 10, 1126891415);
		c = CryptUtil._ii(c, d, a, b, k[14], 15, -1416354905);
		b = CryptUtil._ii(b, c, d, a, k[5], 21, -57434055);
		a = CryptUtil._ii(a, b, c, d, k[12], 6, 1700485571);
		d = CryptUtil._ii(d, a, b, c, k[3], 10, -1894986606);
		c = CryptUtil._ii(c, d, a, b, k[10], 15, -1051523);
		b = CryptUtil._ii(b, c, d, a, k[1], 21, -2054922799);
		a = CryptUtil._ii(a, b, c, d, k[8], 6, 1873313359);
		d = CryptUtil._ii(d, a, b, c, k[15], 10, -30611744);
		c = CryptUtil._ii(c, d, a, b, k[6], 15, -1560198380);
		b = CryptUtil._ii(b, c, d, a, k[13], 21, 1309151649);
		a = CryptUtil._ii(a, b, c, d, k[4], 6, -145523070);
		d = CryptUtil._ii(d, a, b, c, k[11], 10, -1120210379);
		c = CryptUtil._ii(c, d, a, b, k[2], 15, 718787259);
		b = CryptUtil._ii(b, c, d, a, k[9], 21, -343485551);

		x[0] = CryptUtil._add32(a, x[0]);
		x[1] = CryptUtil._add32(b, x[1]);
		x[2] = CryptUtil._add32(c, x[2]);
		x[3] = CryptUtil._add32(d, x[3]);
	},

	_cmn: (q, a, b, x, s, t) => {
		a = CryptUtil._add32(CryptUtil._add32(a, q), CryptUtil._add32(x, t));
		return CryptUtil._add32((a << s) | (a >>> (32 - s)), b);
	},

	_ff: (a, b, c, d, x, s, t) => {
		return CryptUtil._cmn((b & c) | ((~b) & d), a, b, x, s, t);
	},

	_gg: (a, b, c, d, x, s, t) => {
		return CryptUtil._cmn((b & d) | (c & (~d)), a, b, x, s, t);
	},

	_hh: (a, b, c, d, x, s, t) => {
		return CryptUtil._cmn(b ^ c ^ d, a, b, x, s, t);
	},

	_ii: (a, b, c, d, x, s, t) => {
		return CryptUtil._cmn(c ^ (b | (~d)), a, b, x, s, t);
	},

	_md51: (s) => {
		let n = s.length;
		let state = [1732584193, -271733879, -1732584194, 271733878];
		let i;
		for (i = 64; i <= s.length; i += 64) {
			CryptUtil._md5cycle(state, CryptUtil._md5blk(s.substring(i - 64, i)));
		}
		s = s.substring(i - 64);
		let tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
		tail[i >> 2] |= 0x80 << ((i % 4) << 3);
		if (i > 55) {
			CryptUtil._md5cycle(state, tail);
			for (i = 0; i < 16; i++) tail[i] = 0;
		}
		tail[14] = n * 8;
		CryptUtil._md5cycle(state, tail);
		return state;
	},

	_md5blk: (s) => {
		let md5blks = [];
		for (let i = 0; i < 64; i += 4) {
			md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
		}
		return md5blks;
	},

	_hex_chr: "0123456789abcdef".split(""),

	_rhex: (n) => {
		let s = "";
		for (let j = 0; j < 4; j++) {
			s += CryptUtil._hex_chr[(n >> (j * 8 + 4)) & 0x0F] + CryptUtil._hex_chr[(n >> (j * 8)) & 0x0F];
		}
		return s;
	},

	_add32: (a, b) => {
		return (a + b) & 0xFFFFFFFF;
	},
	// endregion

	hex: (x) => {
		for (let i = 0; i < x.length; i++) {
			x[i] = CryptUtil._rhex(x[i]);
		}
		return x.join("");
	},

	hex2Dec (hex) {
		return parseInt(`0x${hex}`);
	},

	md5: (s) => {
		return CryptUtil.hex(CryptUtil._md51(s));
	},

	/**
	 * Based on Java's implementation.
	 * @param obj An object to hash.
	 * @return {*} An integer hashcode for the object.
	 */
	hashCode (obj) {
		if (typeof obj === "string") {
			if (!obj) return 0;
			let h = 0;
			for (let i = 0; i < obj.length; ++i) h = 31 * h + obj.charCodeAt(i);
			return h;
		} else if (typeof obj === "number") return obj;
		else throw new Error(`No hashCode implementation for ${obj}`);
	},

	uid () { // https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
		if (RollerUtil.isCrypto()) {
			return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
		} else {
			let d = Date.now();
			if (typeof performance !== "undefined" && typeof performance.now === "function") {
				d += performance.now();
			}
			return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
				const r = (d + Math.random() * 16) % 16 | 0;
				d = Math.floor(d / 16);
				return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
			});
		}
	},
};

// COLLECTIONS =========================================================================================================
globalThis.CollectionUtil = {
	ObjectSet: class ObjectSet {
		constructor () {
			this.map = new Map();
			this[Symbol.iterator] = this.values;
		}
		// Each inserted element has to implement _toIdString() method that returns a string ID.
		// Two objects are considered equal if their string IDs are equal.
		add (item) {
			this.map.set(item._toIdString(), item);
		}

		values () {
			return this.map.values();
		}
	},

	setEq (a, b) {
		if (a.size !== b.size) return false;
		for (const it of a) if (!b.has(it)) return false;
		return true;
	},

	setDiff (set1, set2) {
		return new Set([...set1].filter(it => !set2.has(it)));
	},

	objectDiff (obj1, obj2) {
		const out = {};

		[...new Set([...Object.keys(obj1), ...Object.keys(obj2)])]
			.forEach(k => {
				const diff = CollectionUtil._objectDiff_recurse(obj1[k], obj2[k]);
				if (diff !== undefined) out[k] = diff;
			});

		return out;
	},

	_objectDiff_recurse (a, b) {
		if (CollectionUtil.deepEquals(a, b)) return undefined;

		if (a && b && typeof a === "object" && typeof b === "object") {
			return CollectionUtil.objectDiff(a, b);
		}

		return b;
	},

	objectIntersect (obj1, obj2) {
		const out = {};

		[...new Set([...Object.keys(obj1), ...Object.keys(obj2)])]
			.forEach(k => {
				const diff = CollectionUtil._objectIntersect_recurse(obj1[k], obj2[k]);
				if (diff !== undefined) out[k] = diff;
			});

		return out;
	},

	_objectIntersect_recurse (a, b) {
		if (CollectionUtil.deepEquals(a, b)) return a;

		if (a && b && typeof a === "object" && typeof b === "object") {
			return CollectionUtil.objectIntersect(a, b);
		}

		return undefined;
	},

	deepEquals (a, b) {
		if (Object.is(a, b)) return true;
		if (a && b && typeof a === "object" && typeof b === "object") {
			if (CollectionUtil._eq_isPlainObject(a) && CollectionUtil._eq_isPlainObject(b)) return CollectionUtil._eq_areObjectsEqual(a, b);
			const isArrayA = Array.isArray(a);
			const isArrayB = Array.isArray(b);
			if (isArrayA || isArrayB) return isArrayA === isArrayB && CollectionUtil._eq_areArraysEqual(a, b);
			const isSetA = a instanceof Set;
			const isSetB = b instanceof Set;
			if (isSetA || isSetB) return isSetA === isSetB && CollectionUtil.setEq(a, b);
			return CollectionUtil._eq_areObjectsEqual(a, b);
		}
		return false;
	},

	_eq_isPlainObject: (value) => value.constructor === Object || value.constructor == null,
	_eq_areObjectsEqual (a, b) {
		const keysA = Object.keys(a);
		const {length} = keysA;
		if (Object.keys(b).length !== length) return false;
		for (let i = 0; i < length; i++) {
			if (!b.hasOwnProperty(keysA[i])) return false;
			if (!CollectionUtil.deepEquals(a[keysA[i]], b[keysA[i]])) return false;
		}
		return true;
	},
	_eq_areArraysEqual (a, b) {
		const {length} = a;
		if (b.length !== length) return false;
		for (let i = 0; i < length; i++) if (!CollectionUtil.deepEquals(a[i], b[i])) return false;
		return true;
	},

	// region Find first <X>
	dfs (obj, opts) {
		const {prop = null, fnMatch = null} = opts;
		if (!prop && !fnMatch) throw new Error(`One of "prop" or "fnMatch" must be specified!`);

		if (obj instanceof Array) {
			for (const child of obj) {
				const n = CollectionUtil.dfs(child, opts);
				if (n) return n;
			}
			return;
		}

		if (obj instanceof Object) {
			if (prop && obj[prop]) return obj[prop];
			if (fnMatch && fnMatch(obj)) return obj;

			for (const child of Object.values(obj)) {
				const n = CollectionUtil.dfs(child, opts);
				if (n) return n;
			}
		}
	},

	bfs (obj, opts) {
		const {prop = null, fnMatch = null} = opts;
		if (!prop && !fnMatch) throw new Error(`One of "prop" or "fnMatch" must be specified!`);

		if (obj instanceof Array) {
			for (const child of obj) {
				if (!(child instanceof Array) && child instanceof Object) {
					if (prop && child[prop]) return child[prop];
					if (fnMatch && fnMatch(child)) return child;
				}
			}

			for (const child of obj) {
				const n = CollectionUtil.bfs(child, opts);
				if (n) return n;
			}

			return;
		}

		if (obj instanceof Object) {
			if (prop && obj[prop]) return obj[prop];
			if (fnMatch && fnMatch(obj)) return obj;

			return CollectionUtil.bfs(Object.values(obj));
		}
	},
	// endregion
};

Array.prototype.last || Object.defineProperty(Array.prototype, "last", {
	enumerable: false,
	writable: true,
	value: function (arg) {
		if (arg !== undefined) this[this.length - 1] = arg;
		else return this[this.length - 1];
	},
});

Array.prototype.filterIndex || Object.defineProperty(Array.prototype, "filterIndex", {
	enumerable: false,
	writable: true,
	value: function (fnCheck) {
		const out = [];
		this.forEach((it, i) => {
			if (fnCheck(it)) out.push(i);
		});
		return out;
	},
});

Array.prototype.equals || Object.defineProperty(Array.prototype, "equals", {
	enumerable: false,
	writable: true,
	value: function (array2) {
		const array1 = this;
		if (!array1 && !array2) return true;
		else if ((!array1 && array2) || (array1 && !array2)) return false;

		let temp = [];
		if ((!array1[0]) || (!array2[0])) return false;
		if (array1.length !== array2.length) return false;
		let key;
		// Put all the elements from array1 into a "tagged" array
		for (let i = 0; i < array1.length; i++) {
			key = `${(typeof array1[i])}~${array1[i]}`; // Use "typeof" so a number 1 isn't equal to a string "1".
			if (temp[key]) temp[key]++;
			else temp[key] = 1;
		}
		// Go through array2 - if same tag missing in "tagged" array, not equal
		for (let i = 0; i < array2.length; i++) {
			key = `${(typeof array2[i])}~${array2[i]}`;
			if (temp[key]) {
				if (temp[key] === 0) return false;
				else temp[key]--;
			} else return false;
		}
		return true;
	},
});

// Alternate name due to clash with Foundry VTT
Array.prototype.segregate || Object.defineProperty(Array.prototype, "segregate", {
	enumerable: false,
	writable: true,
	value: function (fnIsValid) {
		return this.reduce(([pass, fail], elem) => fnIsValid(elem) ? [[...pass, elem], fail] : [pass, [...fail, elem]], [[], []]);
	},
});

Array.prototype.partition || Object.defineProperty(Array.prototype, "partition", {
	enumerable: false,
	writable: true,
	value: Array.prototype.segregate,
});

Array.prototype.getNext || Object.defineProperty(Array.prototype, "getNext", {
	enumerable: false,
	writable: true,
	value: function (curVal) {
		let ix = this.indexOf(curVal);
		if (!~ix) throw new Error("Value was not in array!");
		if (++ix >= this.length) ix = 0;
		return this[ix];
	},
});

Array.prototype.shuffle || Object.defineProperty(Array.prototype, "shuffle", {
	enumerable: false,
	writable: true,
	value: function () {
		for (let i = 0; i < 10000; ++i) this.sort(() => Math.random() - 0.5);
		return this;
	},
});

/** Map each array item to a k:v pair, then flatten them into one object. */
Array.prototype.mergeMap || Object.defineProperty(Array.prototype, "mergeMap", {
	enumerable: false,
	writable: true,
	value: function (fnMap) {
		return this.map((...args) => fnMap(...args)).filter(it => it != null).reduce((a, b) => Object.assign(a, b), {});
	},
});

Array.prototype.first || Object.defineProperty(Array.prototype, "first", {
	enumerable: false,
	writable: true,
	value: function (fnMapFind) {
		for (let i = 0, len = this.length; i < len; ++i) {
			const result = fnMapFind(this[i], i, this);
			if (result) return result;
		}
	},
});

Array.prototype.pMap || Object.defineProperty(Array.prototype, "pMap", {
	enumerable: false,
	writable: true,
	value: async function (fnMap) {
		return Promise.all(this.map((it, i) => fnMap(it, i, this)));
	},
});

/** Map each item via an async function, awaiting for each to complete before starting the next. */
Array.prototype.pSerialAwaitMap || Object.defineProperty(Array.prototype, "pSerialAwaitMap", {
	enumerable: false,
	writable: true,
	value: async function (fnMap) {
		const out = [];
		for (let i = 0, len = this.length; i < len; ++i) out.push(await fnMap(this[i], i, this));
		return out;
	},
});

Array.prototype.pSerialAwaitFilter || Object.defineProperty(Array.prototype, "pSerialAwaitFilter", {
	enumerable: false,
	writable: true,
	value: async function (fnFilter) {
		const out = [];
		for (let i = 0, len = this.length; i < len; ++i) {
			if (await fnFilter(this[i], i, this)) out.push(this[i]);
		}
		return out;
	},
});

Array.prototype.pSerialAwaitFind || Object.defineProperty(Array.prototype, "pSerialAwaitFind", {
	enumerable: false,
	writable: true,
	value: async function (fnFind) {
		for (let i = 0, len = this.length; i < len; ++i) if (await fnFind(this[i], i, this)) return this[i];
	},
});

Array.prototype.pSerialAwaitSome || Object.defineProperty(Array.prototype, "pSerialAwaitSome", {
	enumerable: false,
	writable: true,
	value: async function (fnSome) {
		for (let i = 0, len = this.length; i < len; ++i) if (await fnSome(this[i], i, this)) return true;
		return false;
	},
});

Array.prototype.pSerialAwaitFirst || Object.defineProperty(Array.prototype, "pSerialAwaitFirst", {
	enumerable: false,
	writable: true,
	value: async function (fnMapFind) {
		for (let i = 0, len = this.length; i < len; ++i) {
			const result = await fnMapFind(this[i], i, this);
			if (result) return result;
		}
	},
});

Array.prototype.unique || Object.defineProperty(Array.prototype, "unique", {
	enumerable: false,
	writable: true,
	value: function (fnGetProp) {
		const seen = new Set();
		return this.filter((...args) => {
			const val = fnGetProp ? fnGetProp(...args) : args[0];
			if (seen.has(val)) return false;
			seen.add(val);
			return true;
		});
	},
});

Array.prototype.zip || Object.defineProperty(Array.prototype, "zip", {
	enumerable: false,
	writable: true,
	value: function (otherArray) {
		const out = [];
		const len = Math.max(this.length, otherArray.length);
		for (let i = 0; i < len; ++i) {
			out.push([this[i], otherArray[i]]);
		}
		return out;
	},
});

Array.prototype.nextWrap || Object.defineProperty(Array.prototype, "nextWrap", {
	enumerable: false,
	writable: true,
	value: function (item) {
		const ix = this.indexOf(item);
		if (~ix) {
			if (ix + 1 < this.length) return this[ix + 1];
			else return this[0];
		} else return this.last();
	},
});

Array.prototype.prevWrap || Object.defineProperty(Array.prototype, "prevWrap", {
	enumerable: false,
	writable: true,
	value: function (item) {
		const ix = this.indexOf(item);
		if (~ix) {
			if (ix - 1 >= 0) return this[ix - 1];
			else return this.last();
		} else return this[0];
	},
});

Array.prototype.findLast || Object.defineProperty(Array.prototype, "findLast", {
	enumerable: false,
	writable: true,
	value: function (fn) {
		for (let i = this.length - 1; i >= 0; --i) if (fn(this[i])) return this[i];
	},
});

Array.prototype.findLastIndex || Object.defineProperty(Array.prototype, "findLastIndex", {
	enumerable: false,
	writable: true,
	value: function (fn) {
		for (let i = this.length - 1; i >= 0; --i) if (fn(this[i])) return i;
		return -1;
	},
});

Array.prototype.sum || Object.defineProperty(Array.prototype, "sum", {
	enumerable: false,
	writable: true,
	value: function () {
		let tmp = 0;
		const len = this.length;
		for (let i = 0; i < len; ++i) tmp += this[i];
		return tmp;
	},
});

Array.prototype.mean || Object.defineProperty(Array.prototype, "mean", {
	enumerable: false,
	writable: true,
	value: function () {
		return this.sum() / this.length;
	},
});

Array.prototype.meanAbsoluteDeviation || Object.defineProperty(Array.prototype, "meanAbsoluteDeviation", {
	enumerable: false,
	writable: true,
	value: function () {
		const mean = this.mean();
		return (this.map(num => Math.abs(num - mean)) || []).mean();
	},
});

Map.prototype.getOrSet || Object.defineProperty(Map.prototype, "getOrSet", {
	enumerable: false,
	writable: true,
	value: function (k, orV) {
		if (this.has(k)) return this.get(k);
		this.set(k, orV);
		return orV;
	},
});

// OVERLAY VIEW ========================================================================================================
/**
 * Relies on:
 * - page implementing HashUtil's `loadSubHash` with handling to show/hide the book view based on hashKey changes
 * - page running no-argument `loadSubHash` when `hashchange` occurs
 *
 * @param opts Options object.
 * @param opts.hashKey to use in the URL so that forward/back can open/close the view
 * @param opts.$openBtn jQuery-selected button to bind click open/close
 * @param opts.$eleNoneVisible "error" message to display if user has not selected any viewable content
 * @param opts.pageTitle Title.
 * @param opts.state State to modify when opening/closing.
 * @param opts.stateKey Key in state to set true/false when opening/closing.
 * @param opts.popTblGetNumShown function which should populate the view with HTML content and return the number of items displayed
 * @param [opts.hasPrintColumns] True if the overlay should contain a dropdown for adjusting print columns.
 * @param [opts.isHideContentOnNoneShown]
 * @param [opts.isHideButtonCloseNone]
 * @constructor
 */
function BookModeView (opts) {
	opts = opts || {};
	const {hashKey, $openBtn, $eleNoneVisible, pageTitle, popTblGetNumShown, isFlex, state, stateKey, isHideContentOnNoneShown, isHideButtonCloseNone} = opts;

	if (hashKey && stateKey) throw new Error();

	this.hashKey = hashKey;
	this.stateKey = stateKey;
	this.state = state;
	this.$openBtn = $openBtn;
	this.$eleNoneVisible = $eleNoneVisible;
	this.popTblGetNumShown = popTblGetNumShown;
	this.isHideContentOnNoneShown = isHideContentOnNoneShown;
	this.isHideButtonCloseNone = isHideButtonCloseNone;

	this.active = false;
	this._$body = null;
	this._$wrpBook = null;

	this._$wrpRenderedContent = null;
	this._$wrpNoneShown = null;
	this._doRenderContent = null; // N.B. currently unused, but can be used to refresh the contents of the view

	this.$openBtn.off("click").on("click", () => {
		if (this.stateKey) {
			this.state[this.stateKey] = true;
		} else {
			Hist.cleanSetHash(`${window.location.hash}${HASH_PART_SEP}${this.hashKey}${HASH_SUB_KV_SEP}true`);
		}
	});

	this.close = () => { return this._doHashTeardown(); };

	this._doHashTeardown = () => {
		if (this.stateKey) {
			this.state[this.stateKey] = false;
		} else {
			Hist.cleanSetHash(window.location.hash.replace(`${this.hashKey}${HASH_SUB_KV_SEP}true`, ""));
		}
	};

	this._renderContent = async ($wrpContent, $dispName, $wrpControlsToPass) => {
		this._$wrpRenderedContent = this._$wrpRenderedContent
			? this._$wrpRenderedContent.empty().append($wrpContent)
			: $$`<div class="bkmv__scroller smooth-scroll h-100 overflow-y-auto ${isFlex ? "ve-flex" : ""}">${this.isHideContentOnNoneShown ? null : $wrpContent}</div>`;
		this._$wrpRenderedContent.appendTo(this._$wrpBook);

		const numShown = await this.popTblGetNumShown({$wrpContent, $dispName, $wrpControls: $wrpControlsToPass});

		if (numShown) {
			if (this.isHideContentOnNoneShown) this._$wrpRenderedContent.append($wrpContent);
			if (this._$wrpNoneShown) {
				this._$wrpNoneShown.detach();
			}
		} else {
			if (this.isHideContentOnNoneShown) $wrpContent.detach();
			if (!this._$wrpNoneShown) {
				const $btnClose = $(`<button class="btn btn-default">Close</button>`)
					.click(() => this.close());

				this._$wrpNoneShown = $$`<div class="w-100 ve-flex-col ve-flex-h-center no-shrink bkmv__footer mb-3">
					<div class="mb-2 ve-flex-vh-center min-h-0">${this.$eleNoneVisible}</div>
					${this.isHideButtonCloseNone ? null : $$`<div class="ve-flex-vh-center">${$btnClose}</div>`}
				</div>`;
			}
			this._$wrpNoneShown.appendTo(this.isHideContentOnNoneShown ? this._$wrpRenderedContent : this._$wrpBook);
		}
	};

	// NOTE: Avoid using `ve-flex` css, as it doesn't play nice with printing
	this.pOpen = async () => {
		if (this.active) return;
		this.active = true;
		document.title = `${pageTitle} - 5etools`;

		this._$body = $(`body`);
		this._$wrpBook = $(`<div class="bkmv"></div>`);

		this._$body.css("overflow", "hidden");
		this._$body.addClass("bkmv-active");

		const $btnClose = $(`<button class="btn btn-xs btn-danger br-0 bt-0 bb-0 btl-0 bbl-0 h-20p" title="Close"><span class="glyphicon glyphicon-remove"></span></button>`)
			.click(() => this._doHashTeardown());
		const $dispName = $(`<div></div>`); // pass this to the content function to allow it to set a main header
		$$`<div class="bkmv__spacer-name split-v-center no-shrink">${$dispName}${$btnClose}</div>`.appendTo(this._$wrpBook);

		// region controls
		// Optionally usable "controls" section at the top of the pane
		const $wrpControls = $(`<div class="w-100 ve-flex-col bkmv__wrp-controls"></div>`)
			.appendTo(this._$wrpBook);

		let $wrpControlsToPass = $wrpControls;
		if (opts.hasPrintColumns) {
			$wrpControls.addClass("px-2 mt-2");

			const injectPrintCss = (cols) => {
				$(`#bkmv__print-style`).remove();
				$(`<style media="print" id="bkmv__print-style">.bkmv__wrp { column-count: ${cols}; }</style>`)
					.appendTo($(document.body));
			};

			const lastColumns = StorageUtil.syncGetForPage(BookModeView._BOOK_VIEW_COLUMNS_K);

			const $selColumns = $(`<select class="form-control input-sm">
				<option value="0">Two (book style)</option>
				<option value="1">One</option>
			</select>`)
				.change(() => {
					const val = Number($selColumns.val());
					if (val === 0) injectPrintCss(2);
					else injectPrintCss(1);

					StorageUtil.syncSetForPage(BookModeView._BOOK_VIEW_COLUMNS_K, val);
				});
			if (lastColumns != null) $selColumns.val(lastColumns);
			$selColumns.change();

			$wrpControlsToPass = $$`<div class="w-100 ve-flex">
				<div class="ve-flex-vh-center"><div class="mr-2 no-wrap help-subtle" title="Applied when printing the page.">Print columns:</div>${$selColumns}</div>
			</div>`.appendTo($wrpControls);
		}
		// endregion

		const $wrpContent = $(`<div class="bkmv__wrp p-2"></div>`);

		await this._renderContent($wrpContent, $dispName, $wrpControlsToPass);

		this._pRenderContent = () => this._renderContent($wrpContent, $dispName, $wrpControlsToPass);

		this._$body.append(this._$wrpBook);
	};

	this.teardown = () => {
		if (this.active) {
			if (this._$wrpRenderedContent) this._$wrpRenderedContent.detach();
			if (this._$wrpNoneShown) this._$wrpNoneShown.detach();

			this._$body.css("overflow", "");
			this._$body.removeClass("bkmv-active");
			this._$wrpBook.remove();
			this.active = false;

			this._pRenderContent = null;
		}
	};

	this.pHandleSub = (sub) => {
		if (this.stateKey) return; // Assume anything with state will handle this itself.

		const bookViewHash = sub.find(it => it.startsWith(this.hashKey));
		if (bookViewHash && UrlUtil.unpackSubHash(bookViewHash)[this.hashKey][0] === "true") return this.pOpen();
		else this.teardown();
	};
}
BookModeView._BOOK_VIEW_COLUMNS_K = "bookViewColumns";

// CONTENT EXCLUSION ===================================================================================================
globalThis.ExcludeUtil = {
	isInitialised: false,
	_excludes: null,
	_cache_excludesLookup: null,
	_lock: null,

	async pInitialise ({lockToken = null} = {}) {
		try {
			await ExcludeUtil._lock.pLock({token: lockToken});
			await ExcludeUtil._pInitialise();
		} finally {
			ExcludeUtil._lock.unlock();
		}
	},

	async _pInitialise () {
		if (ExcludeUtil.isInitialised) return;

		ExcludeUtil.pSave = MiscUtil.throttle(ExcludeUtil._pSave, 50);
		try {
			ExcludeUtil._excludes = await StorageUtil.pGet(VeCt.STORAGE_EXCLUDES) || [];
			ExcludeUtil._excludes = ExcludeUtil._excludes.filter(it => it.hash); // remove legacy rows
		} catch (e) {
			JqueryUtil.doToast({
				content: "Error when loading content blocklist! Purged blocklist data. (See the log for more information.)",
				type: "danger",
			});
			try {
				await StorageUtil.pRemove(VeCt.STORAGE_EXCLUDES);
			} catch (e) {
				setTimeout(() => { throw e; });
			}
			ExcludeUtil._excludes = null;
			window.location.hash = "";
			setTimeout(() => { throw e; });
		}
		ExcludeUtil.isInitialised = true;
	},

	getList () {
		return MiscUtil.copyFast(ExcludeUtil._excludes || []);
	},

	async pSetList (toSet) {
		ExcludeUtil._excludes = toSet;
		ExcludeUtil._cache_excludesLookup = null;
		await ExcludeUtil.pSave();
	},

	async pExtendList (toAdd) {
		try {
			const lockToken = await ExcludeUtil._lock.pLock();
			await ExcludeUtil._pExtendList({toAdd, lockToken});
		} finally {
			ExcludeUtil._lock.unlock();
		}
	},

	async _pExtendList ({toAdd, lockToken}) {
		await ExcludeUtil.pInitialise({lockToken});
		this._doBuildCache();

		const out = MiscUtil.copyFast(ExcludeUtil._excludes || []);
		MiscUtil.copyFast(toAdd || [])
			.filter(({hash, category, source}) => {
				if (!hash || !category || !source) return false;
				const cacheUid = ExcludeUtil._getCacheUids(hash, category, source, true);
				return !ExcludeUtil._cache_excludesLookup[cacheUid];
			})
			.forEach(it => out.push(it));

		await ExcludeUtil.pSetList(out);
	},

	_doBuildCache () {
		if (ExcludeUtil._cache_excludesLookup) return;
		if (!ExcludeUtil._excludes) return;

		ExcludeUtil._cache_excludesLookup = {};
		ExcludeUtil._excludes.forEach(({source, category, hash}) => {
			const cacheUid = ExcludeUtil._getCacheUids(hash, category, source, true);
			ExcludeUtil._cache_excludesLookup[cacheUid] = true;
		});
	},

	_getCacheUids (hash, category, source, isExact) {
		hash = (hash || "").toLowerCase();
		category = (category || "").toLowerCase();
		source = (source?.source || source || "").toLowerCase();

		const exact = `${hash}__${category}__${source}`;
		if (isExact) return [exact];

		return [
			`${hash}__${category}__${source}`,
			`*__${category}__${source}`,
			`${hash}__*__${source}`,
			`${hash}__${category}__*`,
			`*__*__${source}`,
			`*__${category}__*`,
			`${hash}__*__*`,
			`*__*__*`,
		];
	},

	_excludeCount: 0,
	/**
	 * @param hash
	 * @param category
	 * @param source
	 * @param [opts]
	 * @param [opts.isNoCount]
	 */
	isExcluded (hash, category, source, opts) {
		if (!ExcludeUtil._excludes || !ExcludeUtil._excludes.length) return false;
		if (!source) throw new Error(`Entity had no source!`);
		opts = opts || {};

		this._doBuildCache();

		hash = (hash || "").toLowerCase();
		category = (category || "").toLowerCase();
		source = (source.source || source || "").toLowerCase();

		const isExcluded = ExcludeUtil._isExcluded(hash, category, source);
		if (!isExcluded) return isExcluded;

		if (!opts.isNoCount) ++ExcludeUtil._excludeCount;

		return isExcluded;
	},

	_isExcluded (hash, category, source) {
		for (const cacheUid of ExcludeUtil._getCacheUids(hash, category, source)) {
			if (ExcludeUtil._cache_excludesLookup[cacheUid]) return true;
		}
		return false;
	},

	isAllContentExcluded (list) { return (!list.length && ExcludeUtil._excludeCount) || (list.length > 0 && list.length === ExcludeUtil._excludeCount); },
	getAllContentBlocklistedHtml () { return `<div class="initial-message">(All content <a href="blocklist.html">blocklisted</a>)</div>`; },

	async _pSave () {
		return StorageUtil.pSet(VeCt.STORAGE_EXCLUDES, ExcludeUtil._excludes);
	},

	// The throttled version, available post-initialisation
	async pSave () { /* no-op */ },
};

// EXTENSIONS ==========================================================================================================
globalThis.ExtensionUtil = {
	ACTIVE: false,

	_doSend (type, data) {
		const detail = MiscUtil.copy({type, data}); // Note that this needs to include `JSON.parse` to function
		window.dispatchEvent(new CustomEvent("rivet.send", {detail}));
	},

	async pDoSendStats (evt, ele) {
		const {page, source, hash, extensionData} = ExtensionUtil._getElementData({ele});

		if (page && source && hash) {
			let toSend = ExtensionUtil._getEmbeddedFromCache(page, source, hash)
				|| await DataLoader.pCacheAndGet(page, source, hash);

			if (extensionData) {
				switch (page) {
					case UrlUtil.PG_BESTIARY: {
						if (extensionData._scaledCr) toSend = await ScaleCreature.scale(toSend, extensionData._scaledCr);
						else if (extensionData._scaledSpellSummonLevel) toSend = await ScaleSpellSummonedCreature.scale(toSend, extensionData._scaledSpellSummonLevel);
						else if (extensionData._scaledClassSummonLevel) toSend = await ScaleClassSummonedCreature.scale(toSend, extensionData._scaledClassSummonLevel);
					}
				}
			}

			ExtensionUtil._doSend("entity", {page, entity: toSend, isTemp: !!evt.shiftKey});
		}
	},

	async doDragStart (evt, ele) {
		const {page, source, hash} = ExtensionUtil._getElementData({ele});
		const meta = {
			type: VeCt.DRAG_TYPE_IMPORT,
			page,
			source,
			hash,
		};
		evt.dataTransfer.setData("application/json", JSON.stringify(meta));
	},

	_getElementData ({ele}) {
		const $parent = $(ele).closest(`[data-page]`);
		const page = $parent.attr("data-page");
		const source = $parent.attr("data-source");
		const hash = $parent.attr("data-hash");
		const rawExtensionData = $parent.attr("data-extension");
		const extensionData = rawExtensionData ? JSON.parse(rawExtensionData) : null;

		return {page, source, hash, extensionData};
	},

	pDoSendStatsPreloaded ({page, entity, isTemp, options}) {
		ExtensionUtil._doSend("entity", {page, entity, isTemp, options});
	},

	pDoSendCurrency ({currency}) {
		ExtensionUtil._doSend("currency", {currency});
	},

	doSendRoll (data) { ExtensionUtil._doSend("roll", data); },

	pDoSend ({type, data}) { ExtensionUtil._doSend(type, data); },

	/* -------------------------------------------- */

	_CACHE_EMBEDDED_STATS: {},

	addEmbeddedToCache (page, source, hash, ent) {
		MiscUtil.set(ExtensionUtil._CACHE_EMBEDDED_STATS, page.toLowerCase(), source.toLowerCase(), hash.toLowerCase(), MiscUtil.copyFast(ent));
	},

	_getEmbeddedFromCache (page, source, hash) {
		return MiscUtil.get(ExtensionUtil._CACHE_EMBEDDED_STATS, page.toLowerCase(), source.toLowerCase(), hash.toLowerCase());
	},

	/* -------------------------------------------- */
};
if (typeof window !== "undefined") window.addEventListener("rivet.active", () => ExtensionUtil.ACTIVE = true);

// TOKENS ==============================================================================================================
globalThis.TokenUtil = {
	handleStatblockScroll (event, ele) {
		$(`#token_image`)
			.toggle(ele.scrollTop < 32)
			.css({
				opacity: (32 - ele.scrollTop) / 32,
				top: -ele.scrollTop,
			});
	},
};

// LOCKS ===============================================================================================================
/**
 * @param {string} name
 * @param {boolean} isDbg
 * @constructor
 */
globalThis.VeLock = function ({name = null, isDbg = false} = {}) {
	this._name = name;
	this._isDbg = isDbg;
	this._lockMeta = null;

	this._getCaller = () => {
		return (new Error()).stack.split("\n")[3].trim();
	};

	this.pLock = async ({token = null} = {}) => {
		if (token != null && this._lockMeta?.token === token) {
			++this._lockMeta.depth;
			// eslint-disable-next-line no-console
			if (this._isDbg) console.warn(`Lock "${this._name || "(unnamed)"}" add (now ${this._lockMeta.depth}) at ${this._getCaller()}`);
			return token;
		}

		while (this._lockMeta) await this._lockMeta.lock;

		// eslint-disable-next-line no-console
		if (this._isDbg) console.warn(`Lock "${this._name || "(unnamed)"}" acquired at ${this._getCaller()}`);

		let unlock = null;
		const lock = new Promise(resolve => unlock = resolve);
		this._lockMeta = {
			lock,
			unlock,
			token: CryptUtil.uid(),
			depth: 0,
		};

		return this._lockMeta.token;
	};

	this.unlock = () => {
		if (!this._lockMeta) return;

		if (this._lockMeta.depth > 0) {
			// eslint-disable-next-line no-console
			if (this._isDbg) console.warn(`Lock "${this._name || "(unnamed)"}" sub (now ${this._lockMeta.depth - 1}) at ${this._getCaller()}`);
			return --this._lockMeta.depth;
		}

		// eslint-disable-next-line no-console
		if (this._isDbg) console.warn(`Lock "${this._name || "(unnamed)"}" released at ${this._getCaller()}`);

		const lockMeta = this._lockMeta;
		this._lockMeta = null;
		lockMeta.unlock();
	};
};
ExcludeUtil._lock = new VeLock();

// DATETIME ============================================================================================================
globalThis.DatetimeUtil = {
	getDateStr ({date, isShort = false, isPad = false} = {}) {
		const month = DatetimeUtil._MONTHS[date.getMonth()];
		return `${isShort ? month.substring(0, 3) : month} ${isPad && date.getDate() < 10 ? "\u00A0" : ""}${Parser.getOrdinalForm(date.getDate())}, ${date.getFullYear()}`;
	},

	getDatetimeStr ({date, isPlainText = false} = {}) {
		date = date ?? new Date();
		const monthName = DatetimeUtil._MONTHS[date.getMonth()];
		return `${date.getDate()} ${!isPlainText ? `<span title="${monthName}">` : ""}${monthName.substring(0, 3)}.${!isPlainText ? `</span>` : ""} ${date.getFullYear()}, ${DatetimeUtil._getPad2(date.getHours())}:${DatetimeUtil._getPad2(date.getMinutes())}:${DatetimeUtil._getPad2(date.getSeconds())}`;
	},

	_getPad2 (num) { return `${num}`.padStart(2, "0"); },

	getIntervalStr (millis) {
		if (millis < 0 || isNaN(millis)) return "(Unknown interval)";

		const s = number => (number !== 1) ? "s" : "";

		const stack = [];

		let numSecs = Math.floor(millis / 1000);

		const numYears = Math.floor(numSecs / DatetimeUtil._SECS_PER_YEAR);
		if (numYears) {
			stack.push(`${numYears} year${s(numYears)}`);
			numSecs = numSecs - (numYears * DatetimeUtil._SECS_PER_YEAR);
		}

		const numDays = Math.floor(numSecs / DatetimeUtil._SECS_PER_DAY);
		if (numDays) {
			stack.push(`${numDays} day${s(numDays)}`);
			numSecs = numSecs - (numDays * DatetimeUtil._SECS_PER_DAY);
		}

		const numHours = Math.floor(numSecs / DatetimeUtil._SECS_PER_HOUR);
		if (numHours) {
			stack.push(`${numHours} hour${s(numHours)}`);
			numSecs = numSecs - (numHours * DatetimeUtil._SECS_PER_HOUR);
		}

		const numMinutes = Math.floor(numSecs / DatetimeUtil._SECS_PER_MINUTE);
		if (numMinutes) {
			stack.push(`${numMinutes} minute${s(numMinutes)}`);
			numSecs = numSecs - (numMinutes * DatetimeUtil._SECS_PER_MINUTE);
		}

		if (numSecs) stack.push(`${numSecs} second${s(numSecs)}`);
		else if (!stack.length) stack.push("less than a second"); // avoid adding this if there's already info

		return stack.join(", ");
	},
};
DatetimeUtil._MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
DatetimeUtil._SECS_PER_YEAR = 31536000;
DatetimeUtil._SECS_PER_DAY = 86400;
DatetimeUtil._SECS_PER_HOUR = 3600;
DatetimeUtil._SECS_PER_MINUTE = 60;

globalThis.EditorUtil = {
	getTheme () {
		const {isNight} = styleSwitcher.getSummary();
		return isNight ? "ace/theme/tomorrow_night" : "ace/theme/textmate";
	},

	initEditor (id, additionalOpts = null) {
		additionalOpts = additionalOpts || {};

		const editor = ace.edit(id);
		editor.setOptions({
			theme: EditorUtil.getTheme(),
			wrap: true,
			showPrintMargin: false,
			tabSize: 2,
			useWorker: false,
			...additionalOpts,
		});

		styleSwitcher.addFnOnChange(() => editor.setOptions({theme: EditorUtil.getTheme()}));

		return editor;
	},
};

// MISC WEBPAGE ONLOADS ================================================================================================
if (!IS_VTT && typeof window !== "undefined") {
	window.addEventListener("load", () => {
		const docRoot = document.querySelector(":root");

		if (CSS?.supports("top: constant(safe-area-inset-top)")) {
			docRoot.style.setProperty("--safe-area-inset-top", "constant(safe-area-inset-top, 0)");
			docRoot.style.setProperty("--safe-area-inset-right", "constant(safe-area-inset-right, 0)");
			docRoot.style.setProperty("--safe-area-inset-bottom", "constant(safe-area-inset-bottom, 0)");
			docRoot.style.setProperty("--safe-area-inset-left", "constant(safe-area-inset-left, 0)");
		} else if (CSS?.supports("top: env(safe-area-inset-top)")) {
			docRoot.style.setProperty("--safe-area-inset-top", "env(safe-area-inset-top, 0)");
			docRoot.style.setProperty("--safe-area-inset-right", "env(safe-area-inset-right, 0)");
			docRoot.style.setProperty("--safe-area-inset-bottom", "env(safe-area-inset-bottom, 0)");
			docRoot.style.setProperty("--safe-area-inset-left", "env(safe-area-inset-left, 0)");
		}
	});

	window.addEventListener("load", () => {
		$(document.body)
			.on("click", `[data-packed-dice]`, evt => {
				Renderer.dice.pRollerClickUseData(evt, evt.currentTarget);
			});
		Renderer.events.bindGeneric();
	});

	if (location.origin === VeCt.LOC_ORIGIN_CANCER) {
		const ivsCancer = [];

		window.addEventListener("load", () => {
			let isPadded = false;
			let anyFound = false;
			[
				"div-gpt-ad-5etools35927", // main banner
				"div-gpt-ad-5etools35930", // side banner
				"div-gpt-ad-5etools35928", // sidebar top
				"div-gpt-ad-5etools35929", // sidebar bottom
				"div-gpt-ad-5etools36159", // bottom floater
				"div-gpt-ad-5etools36834", // mobile middle
			].forEach(id => {
				const iv = setInterval(() => {
					const $wrp = $(`#${id}`);
					if (!$wrp.length) return;
					if (!$wrp.children().length) return;
					if ($wrp.children()[0].tagName === "SCRIPT") return;
					const $tgt = $wrp.closest(".cancer__anchor").find(".cancer__disp-cancer");
					if ($tgt.length) {
						anyFound = true;
						$tgt.css({display: "flex"}).text("Advertisements");
						clearInterval(iv);
					}
				}, 250);

				ivsCancer.push(iv);
			});

			const ivPad = setInterval(() => {
				if (!anyFound) return;
				if (isPadded) return;
				isPadded = true;
				// Pad the bottom of the page so the adhesive unit doesn't overlap the content
				$(`.view-col-group--cancer`).append(`<div class="w-100 no-shrink" style="height: 110px;"></div>`);
			}, 300);
			ivsCancer.push(ivPad);
		});

		// Hack to lock the ad space at original size--prevents the screen from shifting around once loaded
		setTimeout(() => {
			const $wrp = $(`.cancer__wrp-leaderboard-inner`);
			const h = $wrp.outerHeight();
			$wrp.css({height: h});
			ivsCancer.forEach(iv => clearInterval(iv));
		}, 5000);
	} else {
		window.addEventListener("load", () => $(`.cancer__anchor`).remove());
	}

	// window.addEventListener("load", () => {
	// 	$(`.cancer__sidebar-rhs-inner--top`).append(`<div class="TEST_RHS_TOP"></div>`)
	// 	$(`.cancer__sidebar-rhs-inner--bottom`).append(`<div class="TEST_RHS_BOTTOM"></div>`)
	// });
}

globalThis._Donate = {
	// TAG Disabled until further notice
	/*
	init () {
		if (IS_DEPLOYED) {
			DataUtil.loadJSON(`https://get.5etools.com/money.php`).then(dosh => {
				const pct = Number(dosh.donated) / Number(dosh.Goal);
				$(`#don-total`).text(`€${dosh.Goal}`);
				if (isNaN(pct)) {
					throw new Error(`Was not a number! Values were ${dosh.donated} and ${dosh.Goal}`);
				} else {
					const $bar = $(`.don__bar_inner`);
					$bar.css("width", `${Math.min(Math.ceil(100 * pct), 100)}%`).html(pct !== 0 ? `€${dosh.donated}&nbsp;` : "");
					if (pct >= 1) $bar.css("background-color", "lightgreen");
				}
			}).catch(noDosh => {
				$(`#don-wrapper`).remove();
				throw noDosh;
			});
		}
	},

	async pNotDonating () {
		const isFake = await StorageUtil.pIsAsyncFake();
		const isNotDonating = await StorageUtil.pGet("notDonating");
		return isFake || isNotDonating;
	},
	*/

	// region Test code, please ignore
	cycleLeader (ele) {
		const modes = [{width: 970, height: 90}, {width: 970, height: 250}, {width: 320, height: 50}, {width: 728, height: 90}];
		_Donate._cycleMode(ele, modes);
	},

	cycleSide (ele) {
		const modes = [{width: 300, height: 250}, {width: 300, height: 600}];
		_Donate._cycleMode(ele, modes);
	},

	_cycleMode (ele, modes) {
		const $e = $(ele);
		const pos = $e.data("pos") || 0;
		const mode = modes[pos];
		$e.css(mode);
		$e.text(`${mode.width}*${mode.height}`);
		$e.data("pos", (pos + 1) % modes.length);
	},
	// endregion
};
