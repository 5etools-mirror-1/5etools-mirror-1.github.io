"use strict";

class Omnidexer {
	constructor (id = 0) {
		/**
		 * Produces index of the form:
		 * {
		 *   n: "Display Name",
		 *   b: "Base Name" // Optional; name is used if not specified
		 *   s: "PHB", // source
		 *   u: "spell name_phb, // hash
		 *   uh: "spell name_phb, // Optional; hash for href if the link should be different from the hover lookup hash.
		 *   p: 110, // page number
		 *   [q: "bestiary.html", // page; synthetic property only used by search widget]
		 *   h: 1 // if isHover enabled, otherwise undefined
		 *   r: 1 // if SRD
		 *   c: 10, // category ID
		 *   id: 123, // index ID
		 *   [t: "spell"], // tag
		 *   [uu: "fireball|phb"], // UID
		 *   [m: "img/spell/Fireball.png"], // Image
		 * }
		 */
		this._index = [];
		this.id = id;
		this._metaMap = {};
		this._metaIndices = {};
	}

	getIndex () {
		return {
			x: this._index,
			m: this._metaMap,
		};
	}

	static decompressIndex (indexGroup) {
		const {x: index, m: metadata} = indexGroup;

		const props = new Set();

		// de-invert the metadata
		const lookup = {};
		Object.keys(metadata).forEach(k => {
			props.add(k);
			Object.entries(metadata[k]).forEach(([kk, vv]) => (lookup[k] = lookup[k] || {})[vv] = kk);
		});

		index.forEach(it => Object.keys(it).filter(k => props.has(k))
			.forEach(k => it[k] = lookup[k][it[k]] ?? it[k]));
		return index;
	}

	static getProperty (obj, withDots) {
		return withDots.split(".").reduce((o, i) => o[i], obj);
	}

	/**
	 * Compute and add an index item.
	 * @param arbiter The indexer arbiter.
	 * @param json A raw JSON object of a file, typically containing an array to be indexed.
	 * @param [options] Options object.
	 * @param [options.isNoFilter] If filtering rules are to be ignored (e.g. for tests).
	 * @param [options.alt] Sub-options for alternate indices.
	 * @param [options.isIncludeTag]
	 * @param [options.isIncludeUid]
	 * @param [options.isIncludeImg]
	 */
	async pAddToIndex (arbiter, json, options) {
		options = options || {};
		const index = this._index;

		if (arbiter.postLoad) json = arbiter.postLoad(json);

		const dataArr = Omnidexer.getProperty(json, arbiter.listProp);
		if (!dataArr) return;

		const state = {arbiter, index, options};

		let ixOffset = 0;
		for (let ix = 0; ix < dataArr.length; ++ix) {
			const it = dataArr[ix];

			const name = Omnidexer.getProperty(it, arbiter.primary || "name");
			await this._pAddToIndex_pHandleItem(state, it, ix + ixOffset, name);

			if (it.alias?.length) {
				for (const a of it.alias) {
					ixOffset++;
					await this._pAddToIndex_pHandleItem(state, it, ix + ixOffset, a);
				}
			}
		}
	}

	async _pAddToIndex_pHandleItem (state, ent, ix, name) {
		if (ent.noDisplay) return;

		const {arbiter, index, options} = state;

		if (name) name = name.toAscii();

		const toAdd = await this._pAddToIndex_pGetToAdd(state, ent, {n: name}, ix);

		if ((options.isNoFilter || (!arbiter.include && !(arbiter.filter && arbiter.filter(ent))) || (!arbiter.filter && (!arbiter.include || arbiter.include(ent)))) && !arbiter.isOnlyDeep) index.push(toAdd);

		const primary = {it: ent, ix: ix, parentName: name};
		const deepItems = await arbiter.pGetDeepIndex(this, primary, ent);
		for (const item of deepItems) {
			const toAdd = await this._pAddToIndex_pGetToAdd(state, ent, item);
			if (!arbiter.filter || !arbiter.filter(ent)) index.push(toAdd);
		}
	}

	async _pAddToIndex_pGetToAdd (state, ent, toMerge, i) {
		const {arbiter, options} = state;

		const src = Omnidexer.getProperty(ent, arbiter.source || "source");

		const hash = arbiter.hashBuilder
			? arbiter.hashBuilder(ent, i)
			: (UrlUtil.URL_TO_HASH_BUILDER[arbiter.listProp])(ent);

		const id = this.id++;

		const indexDoc = {
			id,
			c: arbiter.category,
			u: hash,
			p: Omnidexer.getProperty(ent, arbiter.page || "page"),
		};
		if (src != null) indexDoc.s = this.getMetaId("s", src);
		if (arbiter.isHover) indexDoc.h = 1;
		if (arbiter.isFauxPage) indexDoc.hx = 1;
		if (ent.srd) indexDoc.r = 1;

		if (src) {
			if (options.isIncludeTag) {
				indexDoc.t = this.getMetaId("t", Parser.getPropTag(arbiter.listProp));
			}

			if (options.isIncludeUid) {
				const tag = Parser.getPropTag(arbiter.listProp);
				const uid = DataUtil.proxy.getUid(arbiter.listProp, ent);
				indexDoc.uu = DataUtil.proxy.getNormalizedUid(arbiter.listProp, uid, tag);
			}

			if (options.isIncludeImg) {
				// Prefer the token image, as it is more likely to be an appropriate size
				if (arbiter.fnGetToken) {
					indexDoc.m = arbiter.fnGetToken(ent);
				}

				if (!indexDoc.m) {
					const fluff = await Renderer.hover.pGetHoverableFluff(arbiter.fluffBaseListProp || arbiter.listProp, src, hash, {isSilent: true});
					if (fluff?.images?.length) {
						indexDoc.m = Renderer.utils.getMediaUrl(fluff.images[0], "href", "img");
					}
				}

				if (indexDoc.m) {
					indexDoc.m = indexDoc.m.replace(/^img\//, "");
				}
			}
		}

		if (options.alt) {
			if (options.alt.additionalProperties) Object.entries(options.alt.additionalProperties).forEach(([k, getV]) => indexDoc[k] = getV(ent));
		}

		Object.assign(indexDoc, toMerge);

		return indexDoc;
	}

	/**
	 * Directly add a pre-computed index item.
	 * @param item
	 */
	pushToIndex (item) {
		item.id = this.id++;
		this._index.push(item);
	}

	getMetaId (k, v) {
		this._metaMap[k] = this._metaMap[k] || {};
		// store the index in "inverted" format to prevent extra quote characters around numbers
		if (this._metaMap[k][v] != null) return this._metaMap[k][v];
		else {
			this._metaIndices[k] = this._metaIndices[k] || 0;
			this._metaMap[k][v] = this._metaIndices[k];
			const out = this._metaIndices[k];
			this._metaIndices[k]++;
			return out;
		}
	}
}

class IndexableDirectory {
	/**
	 * @param opts Options object.
	 * @param [opts.category]
	 * @param [opts.dir]
	 * @param [opts.primary]
	 * @param [opts.source]
	 * @param [opts.listProp]
	 * @param [opts.brewProp]
	 * @param [opts.baseUrl]
	 * @param [opts.isHover]
	 * @param [opts.alternateIndexes]
	 * @param [opts.isOnlyDeep]
	 * @param [opts.pFnPreProcBrew] An un-bound function
	 * @param [opts.fnGetToken]
	 */
	constructor (opts) {
		this.category = opts.category;
		this.dir = opts.dir;
		this.primary = opts.primary;
		this.source = opts.source;
		this.listProp = opts.listProp;
		this.brewProp = opts.brewProp;
		this.baseUrl = opts.baseUrl;
		this.isHover = opts.isHover;
		this.alternateIndexes = opts.alternateIndexes;
		this.isOnlyDeep = opts.isOnlyDeep;
		this.pFnPreProcBrew = opts.pFnPreProcBrew;
		this.fnGetToken = opts.fnGetToken;
	}

	pGetDeepIndex () { return []; }
}

class IndexableDirectoryBestiary extends IndexableDirectory {
	constructor () {
		super({
			category: Parser.CAT_ID_CREATURE,
			dir: "bestiary",
			primary: "name",
			source: "source",
			listProp: "monster",
			baseUrl: "bestiary.html",
			isHover: true,
			fnGetToken: (ent) => {
				if (!ent.tokenUrl && !ent.hasToken) return null;
				return Renderer.monster.getTokenUrl(ent);
			},
		});
	}
}

class IndexableDirectorySpells extends IndexableDirectory {
	constructor () {
		super({
			category: Parser.CAT_ID_SPELL,
			dir: "spells",
			primary: "name",
			source: "source",
			listProp: "spell",
			baseUrl: "spells.html",
			isHover: true,
			alternateIndexes: {
				spell: {
					additionalProperties: {
						lvl: spell => spell.level,
					},
				},
			},
		});
	}
}

class IndexableDirectoryClass extends IndexableDirectory {
	constructor () {
		super({
			category: Parser.CAT_ID_CLASS,
			dir: "class",
			primary: "name",
			source: "source",
			listProp: "class",
			baseUrl: "classes.html",
			isHover: true,
		});
	}
}

class IndexableDirectorySubclass extends IndexableDirectory {
	constructor () {
		super({
			category: Parser.CAT_ID_SUBCLASS,
			dir: "class",
			primary: "name",
			source: "source",
			listProp: "subclass",
			brewProp: "subclass",
			baseUrl: "classes.html",
			isHover: true,
			isOnlyDeep: true,
		});
	}

	pGetDeepIndex (indexer, primary, sc) {
		return [
			{
				b: sc.name,
				n: `${sc.name} (${sc.className})`,
				s: indexer.getMetaId("s", sc.source),
				u: `${UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES]({name: sc.className, source: sc.classSource})}${HASH_PART_SEP}${UrlUtil.getClassesPageStatePart({subclass: sc})}`,
				p: sc.page,
			},
		];
	}
}

class IndexableDirectoryClassFeature extends IndexableDirectory {
	constructor () {
		super({
			category: Parser.CAT_ID_CLASS_FEATURE,
			dir: "class",
			primary: "name",
			source: "source",
			listProp: "classFeature",
			baseUrl: "classes.html",
			isOnlyDeep: true,
			isHover: true,
		});
	}

	async pGetDeepIndex (indexer, primary, it) {
		// TODO(Future) this could pull in the class data to get an accurate feature index; default to 0 for now
		const ixFeature = 0;
		const classPageHash = `${UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES]({name: it.className, source: it.classSource})}${HASH_PART_SEP}${UrlUtil.getClassesPageStatePart({feature: {ixLevel: it.level - 1, ixFeature}})}`;
		return [
			{
				n: `${it.className} ${it.level}; ${it.name}`,
				s: it.source,
				u: UrlUtil.URL_TO_HASH_BUILDER["classFeature"](it),
				uh: classPageHash,
				p: it.page,
			},
		];
	}
}

class IndexableDirectorySubclassFeature extends IndexableDirectory {
	constructor () {
		super({
			category: Parser.CAT_ID_SUBCLASS_FEATURE,
			dir: "class",
			primary: "name",
			source: "source",
			listProp: "subclassFeature",
			baseUrl: "classes.html",
			isOnlyDeep: true,
			isHover: true,
		});
	}

	async pGetDeepIndex (indexer, primary, it) {
		const ixFeature = 0;
		const pageStateOpts = {
			subclass: {shortName: it.subclassShortName, source: it.source},
			feature: {ixLevel: it.level - 1, ixFeature},
		};
		const classPageHash = `${UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES]({name: it.className, source: it.classSource})}${HASH_PART_SEP}${UrlUtil.getClassesPageStatePart(pageStateOpts)}`;
		return [
			{
				n: `${it.subclassShortName} ${it.className} ${it.level}; ${it.name}`,
				s: it.source,
				u: UrlUtil.URL_TO_HASH_BUILDER["subclassFeature"](it),
				uh: classPageHash,
				p: it.page,
			},
		];
	}
}

Omnidexer.TO_INDEX__FROM_INDEX_JSON = [
	new IndexableDirectoryBestiary(),
	new IndexableDirectorySpells(),
	new IndexableDirectoryClass(),
	new IndexableDirectorySubclass(),
	new IndexableDirectoryClassFeature(),
	new IndexableDirectorySubclassFeature(),
];

class IndexableFile {
	/**
	 * @param opts Options object.
	 * @param opts.category a category from utils.js (see `Parser.pageCategoryToFull`)
	 * @param opts.file source JSON file
	 * @param [opts.primary] (default "name") JSON property to index, per item. Can be a chain of properties e.g. `outer.inner.name`
	 * @param [opts.source] (default "source") JSON property containing the item's source, per item. Can be a chan of properties, e.g. `outer.inner.source`
	 * @param [opts.page] (default "page") JSON property containing the item's page in the relevant book, per item. Can be a chain of properties, e.g. `outer.inner.page`
	 * @param opts.listProp the JSON always has a root property containing the list of items. Provide the name of this property here. Can be a chain of properties e.g. `outer.inner.name`
	 * @param [opts.fluffBaseListProp]
	 * @param opts.baseUrl the base URL (which page) to use when forming index URLs
	 * @param [opts.hashBuilder] a function which takes a data item and returns a hash for it. Generally not needed, as UrlUtils has a defined list of hash-building functions for each page.
	 * @param [opts.test_extraIndex] a function which can optionally be called per item if `doExtraIndex` is true. Used to generate a complete list of links for testing; should not be used for production index. Should return full index objects.
	 * @param [opts.isHover] a boolean indicating if the generated link should have `Renderer` isHover functionality.
	 * @param [opts.filter] a function which takes a data item and returns true if it should not be indexed, false otherwise
	 * @param [opts.include] a function which takes a data item and returns true if it should be indexed, false otherwise
	 * @param [opts.postLoad] a function which takes the data set, does some post-processing, and runs a callback when done (synchronously)
	 * @param opts.isOnlyDeep
	 * @param opts.additionalIndexes
	 * @param opts.isSkipBrew
	 * @param [opts.pFnPreProcBrew] An un-bound function
	 * @param [opts.fnGetToken]
	 * @param [opts.isFauxPage]
	 */
	constructor (opts) {
		this.category = opts.category;
		this.file = opts.file;
		this.primary = opts.primary;
		this.source = opts.source;
		this.page = opts.page;
		this.listProp = opts.listProp;
		this.fluffBaseListProp = opts.fluffBaseListProp;
		this.baseUrl = opts.baseUrl;
		this.hashBuilder = opts.hashBuilder;
		this.test_extraIndex = opts.test_extraIndex;
		this.isHover = opts.isHover;
		this.filter = opts.filter;
		this.include = opts.include;
		this.postLoad = opts.postLoad;
		this.isOnlyDeep = opts.isOnlyDeep;
		this.additionalIndexes = opts.additionalIndexes;
		this.isSkipBrew = opts.isSkipBrew;
		this.pFnPreProcBrew = opts.pFnPreProcBrew;
		this.fnGetToken = opts.fnGetToken;
		this.isFauxPage = !!opts.isFauxPage;
	}

	/**
	 * A function which returns an additional "deep" list of index docs.
	 */
	pGetDeepIndex () { return []; }
}

class IndexableFileBackgrounds extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_BACKGROUND,
			file: "backgrounds.json",
			listProp: "background",
			baseUrl: "backgrounds.html",
			isHover: true,
		});
	}
}

class IndexableFileItemsBase extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_ITEM,
			file: "items-base.json",
			listProp: "baseitem",
			fluffBaseListProp: "item",
			baseUrl: "items.html",
			isHover: true,
		});
	}
}

class IndexableFileItems extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_ITEM,
			file: "items.json",
			listProp: "item",
			baseUrl: "items.html",
			isHover: true,
		});
	}
}

class IndexableFileItemGroups extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_ITEM,
			file: "items.json",
			listProp: "itemGroup",
			fluffBaseListProp: "item",
			baseUrl: "items.html",
			isHover: true,
		});
	}
}

class IndexableFileMagicVariants extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_ITEM,
			file: "magicvariants.json",
			source: "inherits.source",
			page: "inherits.page",
			listProp: "magicvariant",
			fluffBaseListProp: "item",
			baseUrl: "items.html",
			hashBuilder: (it) => {
				return UrlUtil.encodeForHash([it.name, it.inherits.source]);
			},
			additionalIndexes: {
				item: async (indexer, rawVariants) => {
					const specVars = await (async () => {
						const baseItemJson = await DataUtil.loadJSON(`data/items-base.json`);
						const rawBaseItems = {...baseItemJson, baseitem: [...baseItemJson.baseitem]};

						const prerelease = typeof PrereleaseUtil !== "undefined" ? await PrereleaseUtil.pGetBrewProcessed() : {};
						if (prerelease.baseitem) rawBaseItems.baseitem.push(...prerelease.baseitem);

						const brew = typeof BrewUtil2 !== "undefined" ? await BrewUtil2.pGetBrewProcessed() : {};
						if (brew.baseitem) rawBaseItems.baseitem.push(...brew.baseitem);

						return Renderer.item.getAllIndexableItems(rawVariants, rawBaseItems);
					})();
					return specVars.map(sv => {
						const out = {
							c: Parser.CAT_ID_ITEM,
							u: UrlUtil.encodeForHash([sv.name, sv.source]),
							s: indexer.getMetaId("s", sv.source),
							n: sv.name,
							h: 1,
							p: sv.page,
						};
						if (sv.genericVariant) {
							// use z-prefixed as "other data" properties
							out.zg = {
								n: indexer.getMetaId("n", sv.genericVariant.name),
								s: indexer.getMetaId("s", sv.genericVariant.source),
							};
						}
						return out;
					});
				},
			},
			isHover: true,
		});
	}
}

class IndexableFileConditions extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_CONDITION,
			file: "conditionsdiseases.json",
			listProp: "condition",
			baseUrl: "conditionsdiseases.html",
			isHover: true,
		});
	}
}

class IndexableFileDiseases extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_DISEASE,
			file: "conditionsdiseases.json",
			listProp: "disease",
			baseUrl: "conditionsdiseases.html",
			isHover: true,
		});
	}
}

class IndexableFileStatuses extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_STATUS,
			file: "conditionsdiseases.json",
			listProp: "status",
			baseUrl: "conditionsdiseases.html",
			isHover: true,
		});
	}
}

class IndexableFileFeats extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_FEAT,
			file: "feats.json",
			listProp: "feat",
			baseUrl: "feats.html",
			isHover: true,
		});
	}
}

// region Optional features
class IndexableFileOptFeatures_EldritchInvocations extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_ELDRITCH_INVOCATION,
			file: "optionalfeatures.json",
			listProp: "optionalfeature",
			baseUrl: "optionalfeatures.html",
			isHover: true,
			include: (it) => it.featureType.includes("EI"),
		});
	}
}

class IndexableFileOptFeatures_Metamagic extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_METAMAGIC,
			file: "optionalfeatures.json",
			listProp: "optionalfeature",
			baseUrl: "optionalfeatures.html",
			isHover: true,
			include: (it) => it.featureType.includes("MM"),
		});
	}
}

class IndexableFileOptFeatures_ManeuverBattlemaster extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_MANEUVER_BATTLEMASTER,
			file: "optionalfeatures.json",
			listProp: "optionalfeature",
			baseUrl: "optionalfeatures.html",
			isHover: true,
			include: (it) => it.featureType.includes("MV:B"),
		});
	}
}

class IndexableFileOptFeatures_ManeuverCavalier extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_MANEUVER_CAVALIER,
			file: "optionalfeatures.json",
			listProp: "optionalfeature",
			baseUrl: "optionalfeatures.html",
			isHover: true,
			include: (it) => it.featureType.includes("MV:C2-UA"),
		});
	}
}

class IndexableFileOptFeatures_ArcaneShot extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_ARCANE_SHOT,
			file: "optionalfeatures.json",
			listProp: "optionalfeature",
			baseUrl: "optionalfeatures.html",
			isHover: true,
			include: (it) => it.featureType.includes("AS:V1-UA") || it.featureType.includes("AS:V2-UA") || it.featureType.includes("AS"),
		});
	}
}

class IndexableFileOptFeatures_Other extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_OPTIONAL_FEATURE_OTHER,
			file: "optionalfeatures.json",
			listProp: "optionalfeature",
			baseUrl: "optionalfeatures.html",
			isHover: true,
			include: (it) => {
				// Any optional features that don't have a known type (i.e. are custom homebrew types) get lumped into here
				return it.featureType.includes("OTH") || it.featureType.some(it => !Parser.OPT_FEATURE_TYPE_TO_FULL[it]);
			},
		});
	}
}

class IndexableFileOptFeatures_FightingStyle extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_FIGHTING_STYLE,
			file: "optionalfeatures.json",
			listProp: "optionalfeature",
			baseUrl: "optionalfeatures.html",
			isHover: true,
			include: (it) => it.featureType.includes("FS:F") || it.featureType.includes("FS:B") || it.featureType.includes("FS:R") || it.featureType.includes("FS:P"),
		});
	}
}

class IndexableFileOptFeatures_PactBoon extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_PACT_BOON,
			file: "optionalfeatures.json",
			listProp: "optionalfeature",
			baseUrl: "optionalfeatures.html",
			isHover: true,
			include: (it) => it.featureType.includes("PB"),
		});
	}
}

class IndexableFileOptFeatures_ElementalDiscipline extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_ELEMENTAL_DISCIPLINE,
			file: "optionalfeatures.json",
			listProp: "optionalfeature",
			baseUrl: "optionalfeatures.html",
			isHover: true,
			include: (it) => it.featureType.includes("ED"),
		});
	}
}

class IndexableFileOptFeatures_ArtificerInfusion extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_ARTIFICER_INFUSION,
			file: "optionalfeatures.json",
			listProp: "optionalfeature",
			baseUrl: "optionalfeatures.html",
			isHover: true,
			include: (it) => it.featureType.includes("AI"),
		});
	}
}

class IndexableFileOptFeatures_OnomancyResonant extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_ONOMANCY_RESONANT,
			file: "optionalfeatures.json",
			listProp: "optionalfeature",
			baseUrl: "optionalfeatures.html",
			isHover: true,
			include: (it) => it.featureType.includes("OR"),
		});
	}
}

class IndexableFileOptFeatures_RuneKnightRune extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_RUNE_KNIGHT_RUNE,
			file: "optionalfeatures.json",
			listProp: "optionalfeature",
			baseUrl: "optionalfeatures.html",
			isHover: true,
			include: (it) => it.featureType.includes("RN"),
		});
	}
}

class IndexableFileOptFeatures_AlchemicalFormula extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_ALCHEMICAL_FORMULA,
			file: "optionalfeatures.json",
			listProp: "optionalfeature",
			baseUrl: "optionalfeatures.html",
			isHover: true,
			include: (it) => it.featureType.includes("AF"),
		});
	}
}

class IndexableFileOptFeatures_Maneuver extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_MANEUVER,
			file: "optionalfeatures.json",
			listProp: "optionalfeature",
			baseUrl: "optionalfeatures.html",
			isHover: true,
			include: (it) => it.featureType.includes("MV"),
		});
	}
}
// endregion

class IndexableFilePsionics extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_PSIONIC,
			file: "psionics.json",
			listProp: "psionic",
			baseUrl: "psionics.html",
			isHover: true,
		});
	}

	pGetDeepIndex (indexer, primary, it) {
		if (!it.modes) return [];
		return it.modes.map(m => ({d: 1, n: `${primary.parentName}; ${m.name}`}));
	}
}

class IndexableFileRaces extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_RACE,
			file: "races.json",
			listProp: "race",
			baseUrl: "races.html",
			isHover: true,
			postLoad: data => {
				return DataUtil.race.getPostProcessedSiteJson(data, {isAddBaseRaces: true});
			},
			pFnPreProcBrew: async prereleaseBrew => {
				if (!prereleaseBrew.race?.length && !prereleaseBrew.subrace?.length) return prereleaseBrew;

				const site = await DataUtil.race.loadRawJSON();

				return DataUtil.race.getPostProcessedPrereleaseBrewJson(site, prereleaseBrew, {isAddBaseRaces: true});
			},
		});
	}
}

class IndexableFileRewards extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_OTHER_REWARD,
			file: "rewards.json",
			listProp: "reward",
			baseUrl: "rewards.html",
			isHover: true,
		});
	}
}

// region Variant rules
class IndexableFileVariantRules extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_VARIANT_OPTIONAL_RULE,
			file: "variantrules.json",
			listProp: "variantrule",
			baseUrl: "variantrules.html",
			isHover: true,
		});
	}
}
class IndexableFileVariantRulesGenerated extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_VARIANT_OPTIONAL_RULE,
			file: "generated/gendata-variantrules.json",
			listProp: "variantrule",
			baseUrl: "variantrules.html",
			isHover: true,
			isSkipBrew: true,
		});
	}
}
// endregion

class IndexableFileAdventures extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_ADVENTURE,
			file: "adventures.json",
			source: "id",
			listProp: "adventure",
			baseUrl: "adventure.html",
		});
	}
}

class IndexableFileBooks extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_BOOK,
			file: "books.json",
			source: "id",
			listProp: "book",
			baseUrl: "book.html",
		});
	}
}

class IndexableFileQuickReference extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_QUICKREF,
			file: "generated/bookref-quick.json",
			listProp: "data.bookref-quick",
			baseUrl: "quickreference.html",
			hashBuilder: (it, ix) => `bookref-quick,${ix}`,
			isOnlyDeep: true,
			isHover: true,
		});

		this._walker = MiscUtil.getWalker();
	}

	static getChapterNameMetas (it, {isRequireQuickrefFlag = true} = {}) {
		const trackedNames = [];
		const renderer = Renderer.get().setDepthTracker(trackedNames);
		renderer.render(it);

		const nameCounts = {};
		trackedNames.forEach(meta => {
			const lowName = meta.name.toLowerCase();
			nameCounts[lowName] = nameCounts[lowName] || 0;
			nameCounts[lowName]++;
			meta.ixBook = nameCounts[lowName] - 1;
		});

		return trackedNames
			.filter(it => {
				if (!isRequireQuickrefFlag) return true;

				if (!it.data) return false;
				return it.data.quickref != null || it.data.quickrefIndex;
			});
	}

	pGetDeepIndex (indexer, primary, it) {
		const out = it.entries
			.map(it => {
				return IndexableFileQuickReference.getChapterNameMetas(it).map(nameMeta => {
					return [
						IndexableFileQuickReference._getDeepDoc(indexer, primary, nameMeta),
						...(nameMeta.alias || []).map(alias => IndexableFileQuickReference._getDeepDoc(indexer, primary, nameMeta, alias)),
					];
				}).flat();
			})
			.flat();

		const seen = new Set();
		return out.filter(it => {
			if (!seen.has(it.u)) {
				seen.add(it.u);
				return true;
			}
			return false;
		});
	}

	static _getDeepDoc (indexer, primary, nameMeta, alias) {
		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_QUICKREF]({
			name: nameMeta.name,
			ixChapter: primary.ix,
			ixHeader: nameMeta.ixBook,
		});

		return {
			n: alias || nameMeta.name,
			u: hash,
			s: indexer.getMetaId("s", nameMeta.source),
			p: nameMeta.page,
		};
	}
}

class IndexableFileDeities extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_DEITY,
			file: "deities.json",
			postLoad: DataUtil.deity.doPostLoad,
			listProp: "deity",
			baseUrl: "deities.html",
			isHover: true,
			filter: (it) => it.reprinted,
		});
	}
}

class IndexableFileObjects extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_OBJECT,
			file: "objects.json",
			listProp: "object",
			baseUrl: "objects.html",
			isHover: true,
			fnGetToken: (ent) => {
				if (!ent.tokenUrl && !ent.hasToken) return null;
				return Renderer.object.getTokenUrl(ent);
			},
		});
	}
}

class IndexableFileTraps extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_TRAP,
			file: "trapshazards.json",
			listProp: "trap",
			baseUrl: "trapshazards.html",
			isHover: true,
		});
	}
}

class IndexableFileHazards extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_HAZARD,
			file: "trapshazards.json",
			listProp: "hazard",
			baseUrl: "trapshazards.html",
			isHover: true,
		});
	}
}

class IndexableFileCults extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_CULT,
			file: "cultsboons.json",
			listProp: "cult",
			baseUrl: "cultsboons.html",
			isHover: true,
		});
	}
}

class IndexableFileBoons extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_BOON,
			file: "cultsboons.json",
			listProp: "boon",
			baseUrl: "cultsboons.html",
			isHover: true,
		});
	}
}

// region Tables
class IndexableFileTables extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_TABLE,
			file: "tables.json",
			listProp: "table",
			baseUrl: "tables.html",
			isHover: true,
		});
	}
}

class IndexableFileTablesGenerated extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_TABLE,
			file: "generated/gendata-tables.json",
			listProp: "table",
			baseUrl: "tables.html",
			isHover: true,
			isSkipBrew: true,
		});
	}
}

class IndexableFileTableGroups extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_TABLE_GROUP,
			file: "generated/gendata-tables.json",
			listProp: "tableGroup",
			baseUrl: "tables.html",
			isHover: true,
		});
	}
}
// endregion

class IndexableFileVehicles extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_VEHICLE,
			file: "vehicles.json",
			listProp: "vehicle",
			baseUrl: "vehicles.html",
			isHover: true,
			fnGetToken: (ent) => {
				if (!ent.tokenUrl && !ent.hasToken) return null;
				return Renderer.vehicle.getTokenUrl(ent);
			},
		});
	}
}

class IndexableFileVehicles_ShipUpgrade extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_SHIP_UPGRADE,
			file: "vehicles.json",
			listProp: "vehicleUpgrade",
			baseUrl: "vehicles.html",
			isHover: true,
			include: (it) => it.upgradeType.includes("SHP:H") || it.upgradeType.includes("SHP:M") || it.upgradeType.includes("SHP:W") || it.upgradeType.includes("SHP:F"),
		});
	}
}

class IndexableFileVehicles_InfernalWarMachineUpgrade extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_INFERNAL_WAR_MACHINE_UPGRADE,
			file: "vehicles.json",
			listProp: "vehicleUpgrade",
			baseUrl: "vehicles.html",
			isHover: true,
			include: (it) => it.upgradeType.includes("IWM:W") || it.upgradeType.includes("IWM:A") || it.upgradeType.includes("IWM:G"),
		});
	}
}

class IndexableFileActions extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_ACTION,
			file: "actions.json",
			listProp: "action",
			baseUrl: "actions.html",
			isHover: true,
		});
	}
}

class IndexableFileLanguages extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_LANGUAGE,
			file: "languages.json",
			listProp: "language",
			baseUrl: "languages.html",
			isHover: true,
		});
	}

	pGetDeepIndex (indexer, primary, it) {
		return (it.dialects || []).map(d => ({
			n: d,
		}));
	}
}

class IndexableFileCharCreationOptions extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_CHAR_CREATION_OPTIONS,
			file: "charcreationoptions.json",
			listProp: "charoption",
			baseUrl: "charcreationoptions.html",
			isHover: true,
		});
	}
}

class IndexableFileRecipes extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_RECIPES,
			file: "recipes.json",
			listProp: "recipe",
			baseUrl: "recipes.html",
			isHover: true,
		});
	}
}

class IndexableFileSkills extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_SKILLS,
			file: "skills.json",
			listProp: "skill",
			baseUrl: "skill",
			isHover: true,
			isFauxPage: true,
		});
	}
}

class IndexableFileSenses extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_SENSES,
			file: "senses.json",
			listProp: "sense",
			baseUrl: "sense",
			isHover: true,
			isFauxPage: true,
		});
	}
}

class IndexableFileCards extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_CARD,
			file: "decks.json",
			listProp: "card",
			baseUrl: "card",
			isHover: true,
			isFauxPage: true,
		});
	}
}

class IndexableFileDecks extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_DECK,
			file: "decks.json",
			listProp: "deck",
			baseUrl: UrlUtil.PG_DECKS,
			isHover: true,
		});
	}
}

class IndexableLegendaryGroups extends IndexableFile {
	constructor () {
		super({
			category: Parser.CAT_ID_LEGENDARY_GROUP,
			file: "bestiary/legendarygroups.json",
			listProp: "legendaryGroup",
			baseUrl: "legendaryGroup",
			isHover: true,
			isFauxPage: true,
		});
	}
}

Omnidexer.TO_INDEX = [
	new IndexableFileBackgrounds(),
	new IndexableFileConditions(),
	new IndexableFileDiseases(),
	new IndexableFileStatuses(),
	new IndexableFileFeats(),

	new IndexableFileOptFeatures_EldritchInvocations(),
	new IndexableFileOptFeatures_Metamagic(),
	new IndexableFileOptFeatures_ManeuverBattlemaster(),
	new IndexableFileOptFeatures_ManeuverCavalier(),
	new IndexableFileOptFeatures_ArcaneShot(),
	new IndexableFileOptFeatures_Other(),
	new IndexableFileOptFeatures_FightingStyle(),
	new IndexableFileOptFeatures_PactBoon(),
	new IndexableFileOptFeatures_ElementalDiscipline(),
	new IndexableFileOptFeatures_ArtificerInfusion(),
	new IndexableFileOptFeatures_OnomancyResonant(),
	new IndexableFileOptFeatures_RuneKnightRune(),
	new IndexableFileOptFeatures_AlchemicalFormula(),
	new IndexableFileOptFeatures_Maneuver(),
	new IndexableFileItemsBase(),

	new IndexableFileItems(),
	new IndexableFileItemGroups(),
	new IndexableFileMagicVariants(),

	new IndexableFilePsionics(),
	new IndexableFileRaces(),
	new IndexableFileRewards(),
	new IndexableFileVariantRules(),
	new IndexableFileVariantRulesGenerated(),
	new IndexableFileAdventures(),
	new IndexableFileBooks(),
	new IndexableFileQuickReference(),
	new IndexableFileDeities(),
	new IndexableFileObjects(),
	new IndexableFileTraps(),
	new IndexableFileHazards(),
	new IndexableFileCults(),
	new IndexableFileBoons(),
	new IndexableFileTables(),
	new IndexableFileTablesGenerated(),
	new IndexableFileTableGroups(),
	new IndexableFileCards(),
	new IndexableFileDecks(),
	new IndexableLegendaryGroups(),

	new IndexableFileVehicles(),
	new IndexableFileVehicles_ShipUpgrade(),
	new IndexableFileVehicles_InfernalWarMachineUpgrade(),

	new IndexableFileActions(),
	new IndexableFileLanguages(),
	new IndexableFileCharCreationOptions(),
	new IndexableFileRecipes(),
	new IndexableFileSkills(),
	new IndexableFileSenses(),
];

class IndexableSpecial {
	pGetIndex () { throw new Error(`Unimplemented!`); }
}

class IndexableSpecialPages extends IndexableSpecial {
	pGetIndex () {
		return Object.entries(UrlUtil.PG_TO_NAME)
			.filter(([page]) => ![UrlUtil.PG_CLASS_SUBCLASS_FEATURES].includes(page))
			.map(([page, name]) => ({
				n: name,
				c: Parser.CAT_ID_PAGE,
				u: page,
				r: 1, // Consider basic pages to be "SRD friendly"
			}));
	}
}

Omnidexer.TO_INDEX__SPECIAL = [
	new IndexableSpecialPages(),
];

globalThis.Omnidexer = Omnidexer;
