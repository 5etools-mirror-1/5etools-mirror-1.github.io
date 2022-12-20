"use strict";

/**
 * General notes:
 *  - Raw/`raw_` data *should* be left as-is from `DataUtil`, such that we match anything returned by a prop-specific
 *    `.loadRawJSON` in `DataUtil`. Note that this is generally *not* the same as the result of `DataUtil.loadRawJSON`,
 *    which is instead JSON prior to the application of `_copy`/etc.!
 *  - Other cached data (without `raw_`) should be ready for use, with all references resolved to the best of our
 *    capabilities.
 */

// region Utilities

class _DataLoaderConst {
	static SOURCE_SITE_ALL = Symbol("SOURCE_SITE_ALL");
	static SOURCE_BREW_ALL_CURRENT = Symbol("SOURCE_BREW_ALL_CURRENT");

	static ENTITY_NULL = Symbol("ENTITY_NULL");
}

class _DataLoaderInternalUtil {
	static getCleanPageSourceHash ({page, source, hash}) {
		return {
			page: this.getCleanPage({page}),
			source: this.getCleanSource({source}),
			hash: this.getCleanHash({hash}),
		};
	}

	static getCleanPage ({page}) { return page.toLowerCase(); }
	static getCleanSource ({source}) { return source.toLowerCase(); }
	static getCleanHash ({hash}) { return hash.toLowerCase(); }

	/* -------------------------------------------- */

	static getCleanPageFluff ({page}) { return `${this.getCleanPage({page})}fluff`; }

	/* -------------------------------------------- */

	static _NOTIFIED_FAILED_DEREFERENCES = new Set();

	static doNotifyFailedDereferences ({missingRefSets}) {
		// region Avoid repeatedly throwing errors for the same missing references
		const missingRefSetsUnseen = Object.entries(missingRefSets)
			.mergeMap(([prop, set]) => ({
				[prop]: new Set(
					[...set]
						.filter(ref => {
							const refLower = ref.toLowerCase();
							const out = !this._NOTIFIED_FAILED_DEREFERENCES.has(refLower);
							this._NOTIFIED_FAILED_DEREFERENCES.add(refLower);
							return out;
						}),
				),
			}));
		// endregion

		const cntMissingRefs = Object.values(missingRefSetsUnseen).map(({size}) => size).sum();
		if (!cntMissingRefs) return;

		const notificationRefs = Object.entries(missingRefSetsUnseen)
			.map(([k, v]) => `${k}: ${[...v].sort(SortUtil.ascSortLower).join(", ")}`)
			.join("; ");

		const msgStart = `Failed to load references for ${cntMissingRefs} entr${cntMissingRefs === 1 ? "y" : "ies"}!`;

		JqueryUtil.doToast({
			type: "danger",
			content: `${msgStart} Reference types and values were: ${notificationRefs}`,
			isAutoHide: false,
		});

		const cnslRefs = Object.entries(missingRefSetsUnseen)
			.map(([k, v]) => `${k}:\n\t${[...v].sort(SortUtil.ascSortLower).join("\n\t")}`)
			.join("\n");

		setTimeout(() => { throw new Error(`${msgStart}\nReference types and values were:\n${cnslRefs}`); });
	}
}

// endregion

/* -------------------------------------------- */

// region Dereferencer

class _DataLoaderDereferencerBase {
	static _DereferenceMeta = class {
		constructor ({cntReplaces = 0, offsetIx = 0}) {
			this.cntReplaces = cntReplaces;
			this.offsetIx = offsetIx;
		}
	};

	static _WALKER_MOD = MiscUtil.getWalker({
		keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST,
	});

	_pPreloadingRefContent = null;

	async pPreloadRefContent () {
		return (this._pPreloadingRefContent = this._pPreloadingRefContent || this._pPreloadRefContent());
	}

	async _pPreloadRefContent () { /* Implement as required */ }

	dereference ({ent, entriesWithoutRefs, toReplaceMeta, ixReplace}) { throw new Error("Unimplemented!"); }

	_getCopyFromCache ({page, entriesWithoutRefs, refUnpacked, refHash}) {
		if (page.toLowerCase().endsWith(".html")) throw new Error(`Could not dereference "${page}" content. Dereferencing is only supported for props!`);

		// Prefer content from our active load, where available
		return entriesWithoutRefs[page]?.[refHash]
			? MiscUtil.copyFast(entriesWithoutRefs[page]?.[refHash])
			: DataLoader.getFromCache(page, refUnpacked.source, refHash, {isCopy: true});
	}
}

class _DataLoaderDereferencerClassSubclassFeatures extends _DataLoaderDereferencerBase {
	dereference ({ent, entriesWithoutRefs, toReplaceMeta, ixReplace}) {
		const prop = toReplaceMeta.type === "refClassFeature" ? "classFeature" : "subclassFeature";
		const refUnpacked = toReplaceMeta.type === "refClassFeature"
			? DataUtil.class.unpackUidClassFeature(toReplaceMeta.classFeature)
			: DataUtil.class.unpackUidSubclassFeature(toReplaceMeta.subclassFeature);
		const refHash = UrlUtil.URL_TO_HASH_BUILDER[prop](refUnpacked);

		// Skip blocklisted
		if (ExcludeUtil.isInitialised && ExcludeUtil.isExcluded(refHash, prop, refUnpacked.source, {isNoCount: true})) {
			toReplaceMeta.array[toReplaceMeta.ix] = {};
			return new this.constructor._DereferenceMeta({cntReplaces: 1});
		}

		const cpy = this._getCopyFromCache({page: prop, entriesWithoutRefs, refUnpacked, refHash});
		if (!cpy) return new this.constructor._DereferenceMeta({cntReplaces: 0});

		delete cpy.level;
		delete cpy.header;
		if (toReplaceMeta.name) cpy.name = toReplaceMeta.name;
		toReplaceMeta.array[toReplaceMeta.ix] = cpy;
		return new this.constructor._DereferenceMeta({cntReplaces: 1});
	}
}

class _DataLoaderDereferencerOptionalfeatures extends _DataLoaderDereferencerBase {
	async _pPreloadRefContent () {
		await DataLoader.pCacheAndGetAllSite(UrlUtil.PG_OPT_FEATURES);
		await DataLoader.pCacheAndGetAllBrew(UrlUtil.PG_OPT_FEATURES);
	}

	dereference ({ent, entriesWithoutRefs, toReplaceMeta, ixReplace}) {
		const refUnpacked = DataUtil.generic.unpackUid(toReplaceMeta.optionalfeature, "optfeature");
		const refHash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_OPT_FEATURES](refUnpacked);

		// Skip blocklisted
		if (ExcludeUtil.isInitialised && ExcludeUtil.isExcluded(refHash, "optionalfeature", refUnpacked.source, {isNoCount: true})) {
			toReplaceMeta.array[toReplaceMeta.ix] = {};
			return new this.constructor._DereferenceMeta({cntReplaces: 1});
		}

		const cpy = this._getCopyFromCache({page: "optionalfeature", entriesWithoutRefs, refUnpacked, refHash});
		if (!cpy) return new this.constructor._DereferenceMeta({cntReplaces: 0});

		delete cpy.featureType;
		delete cpy.prerequisite;
		if (toReplaceMeta.name) cpy.name = toReplaceMeta.name;
		toReplaceMeta.array[toReplaceMeta.ix] = cpy;

		return new this.constructor._DereferenceMeta({cntReplaces: 1});
	}
}

class _DataLoaderDereferencerItemEntries extends _DataLoaderDereferencerBase {
	async _pPreloadRefContent () {
		await DataLoader.pCacheAndGetAllSite(UrlUtil.PG_ITEMS);
		await DataLoader.pCacheAndGetAllBrew(UrlUtil.PG_ITEMS);
	}

	dereference ({ent, entriesWithoutRefs, toReplaceMeta, ixReplace}) {
		const refUnpacked = DataUtil.generic.unpackUid(toReplaceMeta.itemEntry, "itemEntry");
		const refHash = UrlUtil.URL_TO_HASH_BUILDER["itemEntry"](refUnpacked);

		const cpy = this._getCopyFromCache({page: "itemEntry", entriesWithoutRefs, refUnpacked, refHash});
		if (!cpy) return new this.constructor._DereferenceMeta({cntReplaces: 0});

		cpy.entriesTemplate = this.constructor._WALKER_MOD.walk(
			cpy.entriesTemplate,
			{
				string: (str) => {
					return Renderer.utils.applyTemplate(
						ent,
						str,
					);
				},
			},
		);

		toReplaceMeta.array.splice(toReplaceMeta.ix, 1, ...cpy.entriesTemplate);

		return new this.constructor._DereferenceMeta({
			cntReplaces: 1,
			// Offset by the length of the array we just merged in (minus one, since we replaced an
			//   element)
			offsetIx: cpy.entriesTemplate.length - 1,
		});
	}
}

class _DataLoaderDereferencer {
	static _REF_TYPE_TO_DEREFERENCER = {};

	static _init () {
		this._REF_TYPE_TO_DEREFERENCER["refClassFeature"] =
		this._REF_TYPE_TO_DEREFERENCER["refSubclassFeature"] =
			new _DataLoaderDereferencerClassSubclassFeatures();

		this._REF_TYPE_TO_DEREFERENCER["refOptionalfeature"] =
			new _DataLoaderDereferencerOptionalfeatures();

		this._REF_TYPE_TO_DEREFERENCER["refItemEntry"] =
			new _DataLoaderDereferencerItemEntries();

		return null;
	}

	static _ = this._init();

	static _WALKER_READ = MiscUtil.getWalker({
		keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST,
		isNoModification: true,
		isBreakOnReturn: true,
	});

	/**
	 *  Build an object of the form `{page: [...entities...]}` and return it.
	 * @param entities
	 * @param {string} page
	 * @param {string} propEntries
	 * @param {string} propIsRef
	 */
	static async pGetDereferenced (
		entities,
		page,
		{
			propEntries = "entries",
			propIsRef = null,
		} = {},
	) {
		if (page.toLowerCase().endsWith(".html")) throw new Error(`Could not dereference "${page}" content. Dereferencing is only supported for props!`);

		if (!entities || !entities.length) return {};

		const out = {};
		const entriesWithRefs = {};
		const entriesWithoutRefs = {};

		this._pGetDereferenced_doSegregateWithWithoutRefs({
			entities,
			page,
			propEntries,
			propIsRef,
			entriesWithRefs,
			entriesWithoutRefs,
		});

		await this._pGetDereferenced_pDoDereference({propEntries, entriesWithRefs, entriesWithoutRefs});
		this._pGetDereferenced_doNotifyFailed({entriesWithRefs});
		this._pGetDereferenced_doPopulateOutput({page, out, entriesWithoutRefs, entriesWithRefs});

		return out;
	}

	/* -------------------------------------------- */

	static _pGetDereferenced_doSegregateWithWithoutRefs ({entities, page, propEntries, propIsRef, entriesWithRefs, entriesWithoutRefs}) {
		const hashBuilder = UrlUtil.URL_TO_HASH_BUILDER[page];
		entities
			.forEach(ent => {
				const hash = hashBuilder(ent);
				const hasRefs = this._pGetDereferenced_hasRefs({ent, propEntries, propIsRef});

				(
					(hasRefs ? entriesWithRefs : entriesWithoutRefs)[page] = (hasRefs ? entriesWithRefs : entriesWithoutRefs)[page] || {}
				)[hash] = hasRefs ? MiscUtil.copyFast(ent) : ent;
			});
	}

	static _pGetDereferenced_hasRefs ({ent, propEntries, propIsRef}) {
		if (propIsRef != null) return !!ent[propIsRef];

		const ptrHasRef = {_: false};
		this._WALKER_READ.walk(ent[propEntries], this._pGetDereferenced_doPopulateRaw_getHandlers({ptrHasRef}));
		return ptrHasRef._;
	}

	static _pGetDereferenced_doPopulateRaw_getHandlers ({ptrHasRef}) {
		return {
			object: (obj) => {
				if (this._REF_TYPE_TO_DEREFERENCER[obj.type]) return ptrHasRef._ = true;
			},
			string: (str) => {
				if (str.startsWith("{#") && str.endsWith("}")) return ptrHasRef._ = true;
			},
		};
	}

	/* -------------------------------------------- */

	static _MAX_DEREFERENCE_LOOPS = 25; // conservatively avoid infinite looping

	static async _pGetDereferenced_pDoDereference ({propEntries, entriesWithRefs, entriesWithoutRefs}) {
		for (let i = 0; i < this._MAX_DEREFERENCE_LOOPS; ++i) {
			if (!Object.keys(entriesWithRefs).length) break;

			for (const [page, pageEntries] of Object.entries(entriesWithRefs)) {
				for (const [hash, ent] of Object.entries(pageEntries)) {
					const toReplaceMetas = [];
					this._WALKER_READ.walk(
						ent[propEntries],
						this._pGetDereferenced_doDereference_getHandlers({toReplaceMetas}),
					);

					for (const {type} of toReplaceMetas) {
						if (!this._REF_TYPE_TO_DEREFERENCER[type]) continue;
						await this._REF_TYPE_TO_DEREFERENCER[type].pPreloadRefContent();
					}

					let cntReplaces = 0;
					for (let ixReplace = 0; ixReplace < toReplaceMetas.length; ++ixReplace) {
						const toReplaceMeta = this._pGetDereferenced_doDereference_getToReplaceMeta(toReplaceMetas[ixReplace]);

						const derefMeta = this._REF_TYPE_TO_DEREFERENCER[toReplaceMeta.type].dereference({
							ent,
							entriesWithoutRefs,
							toReplaceMeta,
							ixReplace,
						});
						cntReplaces += derefMeta.cntReplaces;

						if (!derefMeta.offsetIx) continue;

						toReplaceMetas.slice(ixReplace + 1).forEach(it => it.ix += derefMeta.offsetIx);
					}

					if (cntReplaces === toReplaceMetas.length) {
						delete pageEntries[hash];
						(entriesWithoutRefs[page] = entriesWithoutRefs[page] || {})[hash] = ent;
					}
				}

				if (!Object.keys(pageEntries).length) delete entriesWithRefs[page];
			}
		}
	}

	static _pGetDereferenced_doDereference_getHandlers ({toReplaceMetas}) {
		return {
			array: (arr) => {
				arr.forEach((it, i) => {
					if (this._REF_TYPE_TO_DEREFERENCER[it.type]) {
						toReplaceMetas.push({
							...it,
							array: arr,
							ix: i,
						});
						return;
					}

					if (typeof it === "string" && it.startsWith("{#") && it.endsWith("}")) {
						toReplaceMetas.push({
							string: it,
							array: arr,
							ix: i,
						});
					}
				});
			},
		};
	}

	static _pGetDereferenced_doDereference_getToReplaceMeta (toReplaceMetaRaw) {
		if (toReplaceMetaRaw.string == null) return toReplaceMetaRaw;

		const str = toReplaceMetaRaw.string;
		delete toReplaceMetaRaw.string;
		return {...toReplaceMetaRaw, ...Renderer.hover.getRefMetaFromTag(str)};
	}

	/* -------------------------------------------- */

	static _pGetDereferenced_doNotifyFailed ({entriesWithRefs}) {
		const entriesWithRefsVals = Object.values(entriesWithRefs)
			.map(hashToEntry => Object.values(hashToEntry))
			.flat();

		if (!entriesWithRefsVals.length) return;

		const missingRefSets = {};
		this._WALKER_READ.walk(
			entriesWithRefsVals,
			{
				object: (obj) => {
					switch (obj.type) {
						case "refClassFeature": (missingRefSets["classFeature"] = missingRefSets["classFeature"] || new Set()).add(obj.classFeature); break;
						case "refSubclassFeature": (missingRefSets["subclassFeature"] = missingRefSets["subclassFeature"] || new Set()).add(obj.subclassFeature); break;
						case "refOptionalfeature": (missingRefSets["optionalfeature"] = missingRefSets["optionalfeature"] || new Set()).add(obj.optionalfeature); break;
						case "refItemEntry": (missingRefSets["itemEntry"] = missingRefSets["itemEntry"] || new Set()).add(obj.itemEntry); break;
					}
				},
			},
		);

		_DataLoaderInternalUtil.doNotifyFailedDereferences({missingRefSets});
	}

	/* -------------------------------------------- */

	static _pGetDereferenced_doPopulateOutput ({isOverwrite, out, entriesWithoutRefs, entriesWithRefs}) {
		[
			...Object.entries(entriesWithoutRefs),
			// Add the failed-to-resolve entities to the cache; the missing refs will simply not be rendered
			...Object.entries(entriesWithRefs),
		]
			.forEach(([page, hashToEnt]) => {
				Object.entries(hashToEnt)
					.forEach(([hash, ent]) => {
						if (!isOverwrite && DataLoader.getFromCache(page, ent.source, hash)) return;
						(out[page] = out[page] || []).push(ent);
					});
			});
	}
}

// endregion

/* -------------------------------------------- */

// region Cache

class _DataLoaderCache {
	_cache = {};
	_cacheSiteLists = {};
	_cacheBrewLists = {};

	get (pageClean, sourceClean, hashClean) {
		return this._cache[pageClean]?.[sourceClean]?.[hashClean];
	}

	getAllSite (pageClean) {
		return Object.values(this._cacheSiteLists[pageClean] || {});
	}

	getAllBrew (pageClean) {
		return Object.values(this._cacheBrewLists[pageClean] || {});
	}

	set (pageClean, sourceClean, hashClean, ent) {
		// region Set primary cache
		let pageCache = this._cache[pageClean];
		if (!pageCache) {
			pageCache = {};
			this._cache[pageClean] = pageCache;
		}

		let sourceCache = pageCache[sourceClean];
		if (!sourceCache) {
			sourceCache = {};
			pageCache[sourceClean] = sourceCache;
		}

		sourceCache[hashClean] = ent;
		// endregion

		if (ent === _DataLoaderConst.ENTITY_NULL) return;

		// region Set site/brew list cache
		const isSiteSource = SourceUtil.isSiteSource(Parser.sourceJsonToJson(sourceClean));

		this._set_addToPartition({
			isSite: true,
			cache: this._cacheSiteLists,
			isSiteSource,
			pageClean,
			hashClean,
			ent,
		});

		this._set_addToPartition({
			isSite: false,
			cache: this._cacheBrewLists,
			isSiteSource,
			pageClean,
			hashClean,
			ent,
		});
		// endregion
	}

	_set_addToPartition ({isSite, isSiteSource, cache, pageClean, hashClean, ent}) {
		if (isSiteSource !== isSite) return;
		let siteListCache = cache[pageClean];
		if (!siteListCache) {
			siteListCache = {};
			cache[pageClean] = siteListCache;
		}
		siteListCache[hashClean] = ent;
	}
}

// endregion

/* -------------------------------------------- */

// region Data type loading

class _DataTypeLoader {
	static _getAsRawPrefixed (json, {propsRaw}) {
		return {
			...propsRaw.mergeMap(prop => ({[`raw_${prop}`]: json[prop]})),
		};
	}

	/* -------------------------------------------- */

	/**
	 * Props which are (loosely) associated with this loader. Can be specified to optimize load time.
	 * Note that for the dereferencer to function, this list should include all props which may be required by the
	 *   dereferencing process for this entity type.
	 */
	propAllowlist;

	/** Used to reduce phase 1 caching for a loader where phase 2 is the primary caching step. */
	phase1CachePropAllowlist;

	/** (Unused) */
	phase2CachePropAllowlist;

	hasPhase2Cache = false;

	_cache_pSiteData = {};
	_cache_pPostCaches = {};

	/**
	 * @param pageClean
	 * @param sourceClean
	 * @return {string}
	 */
	_getSiteIdent ({pageClean, sourceClean}) { throw new Error("Unimplemented!"); }

	_isBrewAvailable () { return typeof BrewUtil2 !== "undefined"; }

	async _pPrePopulate ({data, isBrew}) { /* Implement as required */ }

	async pGetSiteData ({pageClean, sourceClean}) {
		const propCache = this._getSiteIdent({pageClean, sourceClean});
		this._cache_pSiteData[propCache] = this._cache_pSiteData[propCache] || this._pGetSiteData({pageClean, sourceClean});
		return this._cache_pSiteData[propCache];
	}

	async _pGetSiteData ({pageClean, sourceClean}) { throw new Error("Unimplemented!"); }

	async pGetStoredBrewData () {
		if (!this._isBrewAvailable()) return {};
		return this._pGetStoredBrewData();
	}

	async _pGetStoredBrewData () {
		const brewData = await BrewUtil2.pGetBrewProcessed();
		await this._pPrePopulate({data: brewData, isBrew: true});
		return brewData;
	}

	async pGetPostCacheData ({siteData = null, brewData = null, lockToken2}) { /* Implement as required */ }

	async _pGetPostCacheData_obj_withCache ({obj, propCache, lockToken2}) {
		this._cache_pPostCaches[propCache] = this._cache_pPostCaches[propCache] || this._pGetPostCacheData_obj({obj, lockToken2});
		return this._cache_pPostCaches[propCache];
	}

	async _pGetPostCacheData_obj ({obj, lockToken2}) { throw new Error("Unimplemented!"); }

	hasCustomCacheStrategy ({obj}) { return false; }

	addToCacheCustom ({cache, obj}) { /* Implement as required */ }
}

class _DataTypeLoaderSingleSource extends _DataTypeLoader {
	_filename;

	constructor ({filename}) {
		super();
		this._filename = filename;
	}

	_getSiteIdent ({pageClean, sourceClean}) { return this._filename; }

	async _pGetSiteData ({pageClean, sourceClean}) {
		return DataUtil.loadJSON(`${Renderer.get().baseUrl}data/${this._filename}`);
	}
}

class _DataTypeLoaderPredefined extends _DataTypeLoader {
	_loader;
	_loadJsonArgs;
	_loadBrewArgs;

	/**
	 * @param {string} loader
	 * @param {object|undefined} loaderLoadJsonArgs
	 * @param {object|undefined} loadBrewArgs
	 */
	constructor ({loader, loadJsonArgs, loadBrewArgs}) {
		super();
		this._loader = loader;
		this._loadJsonArgs = loadJsonArgs;
		this._loadBrewArgs = loadBrewArgs;
	}

	_getSiteIdent ({pageClean, sourceClean}) { return this._loader; }

	async _pGetSiteData ({pageClean, sourceClean}) {
		return DataUtil[this._loader].loadJSON(this._loadJsonArgs);
	}

	async _pGetStoredBrewData () {
		if (!DataUtil[this._loader].loadBrew) return super._pGetStoredBrewData();
		return DataUtil[this._loader].loadBrew(this._loadBrewArgs);
	}
}

class _DataTypeLoaderMultiSource extends _DataTypeLoader {
	_prop;

	constructor ({prop}) {
		super();
		this._prop = prop;
	}

	_getSiteIdent ({pageClean, sourceClean}) { return `${this._prop}__${sourceClean}`; }

	_pPrePopulate ({data}) { /* Implement as required */ }

	async _pGetSiteData ({pageClean, sourceClean}) {
		const source = Parser.sourceJsonToJson(sourceClean);
		const data = await DataUtil[this._prop].pLoadSingleSource(source);

		if (data == null) return {};

		await this._pPrePopulate({data});

		return data;
	}
}

class _DataTypeLoaderCustomBestiary extends _DataTypeLoaderMultiSource {
	propAllowlist = new Set(["monster", "monsterFluff", "legendaryGroup", "makebrewCreatureTrait"]);

	constructor () {
		super({prop: "monster"});
	}

	async _pGetSiteData ({pageClean, sourceClean}) {
		await DataUtil.monster.pPreloadMeta();
		return super._pGetSiteData({pageClean, sourceClean});
	}

	async _pPrePopulate ({data, isBrew}) {
		DataUtil.monster.populateMetaReference(data);
	}
}

class _DataTypeLoaderCustomSpells extends _DataTypeLoaderMultiSource {
	constructor () {
		super({prop: "spell"});
	}

	async _pPrePopulate ({data, isBrew}) {
		Renderer.spell.prePopulateHover(data, {isBrew});
	}
}

class _DataTypeLoaderCustomClassesSubclasses extends _DataTypeLoader {
	// Note that this only loads these specific props, to avoid deadlock incurred by dereferencing class/subclass features
	static _PROPS = ["class", "subclass"];

	constructor ({hasPhase2Cache = false} = {}) {
		super();
		this.hasPhase2Cache = hasPhase2Cache;
	}

	_getSiteIdent ({pageClean, sourceClean}) { return `${pageClean}__${this.constructor.name}`; }

	async _pGetSiteData ({pageClean, sourceClean}) {
		const json = await DataUtil.class.loadRawJSON();
		return this.constructor._getAsRawPrefixed(json, {propsRaw: this.constructor._PROPS});
	}

	async _pGetStoredBrewData () {
		const brew = await BrewUtil2.pGetBrewProcessed();
		return this.constructor._getAsRawPrefixed(brew, {propsRaw: this.constructor._PROPS});
	}

	async _pGetPostCacheData_obj ({obj, lockToken2}) {
		if (!obj) return null;

		const out = {};

		if (obj.raw_class?.length) out.class = await obj.raw_class.pSerialAwaitMap(cls => this.constructor._pGetDereferencedClassData(cls, {lockToken2}));
		if (obj.raw_subclass?.length) out.subclass = await obj.raw_subclass.pSerialAwaitMap(sc => this.constructor._pGetDereferencedSubclassData(sc, {lockToken2}));

		return out;
	}

	static _mutEntryNestLevel (feature) {
		const depth = (feature.header == null ? 1 : feature.header) - 1;
		for (let i = 0; i < depth; ++i) {
			const nxt = MiscUtil.copyFast(feature);
			feature.entries = [nxt];
			delete feature.name;
			delete feature.page;
			delete feature.source;
		}
	}

	static async _pGetDereferencedClassData (cls, {lockToken2}) {
		// Gracefully handle legacy class data
		if (cls.classFeatures && cls.classFeatures.every(it => typeof it !== "string" && !it.classFeature)) return cls;

		cls = MiscUtil.copyFast(cls);

		const byLevel = await this._pGetDereferencedClassSubclassData(
			cls,
			{
				lockToken2,
				propFeatures: "classFeatures",
				propFeature: "classFeature",
				fnUnpackUid: DataUtil.class.unpackUidClassFeature.bind(DataUtil.class),
				fnIsInvalidUnpackedUid: ({name, className, level}) => !name || !className || !level || isNaN(level),
			},
		);

		cls.classFeatures = [...new Array(Math.max(0, ...Object.keys(byLevel).map(Number)))]
			.map((_, i) => byLevel[i + 1] || []);

		return cls;
	}

	static async _pGetDereferencedSubclassData (sc, {lockToken2}) {
		// Gracefully handle legacy class data
		if (sc.subclassFeatures && sc.subclassFeatures.every(it => typeof it !== "string" && !it.subclassFeature)) return sc;

		sc = MiscUtil.copyFast(sc);

		const byLevel = await this._pGetDereferencedClassSubclassData(
			sc,
			{
				lockToken2,
				propFeatures: "subclassFeatures",
				propFeature: "subclassFeature",
				fnUnpackUid: DataUtil.class.unpackUidSubclassFeature.bind(DataUtil.class),
				fnIsInvalidUnpackedUid: ({name, className, subclassShortName, level}) => !name || !className || !subclassShortName || !level || isNaN(level),
			},
		);

		sc.subclassFeatures = Object.keys(byLevel)
			.map(Number)
			.sort(SortUtil.ascSort)
			.map(k => byLevel[k]);

		return sc;
	}

	static async _pGetDereferencedClassSubclassData (
		clsOrSc,
		{
			lockToken2,
			propFeatures,
			propFeature,
			fnUnpackUid,
			fnIsInvalidUnpackedUid,
		},
	) {
		// Gracefully handle legacy data
		if (clsOrSc[propFeatures] && clsOrSc[propFeatures].every(it => typeof it !== "string" && !it[propFeature])) return clsOrSc;

		clsOrSc = MiscUtil.copyFast(clsOrSc);

		const byLevel = {}; // Build a map of `level: [ ...feature... ]`
		const notFoundUids = [];

		await (clsOrSc[propFeatures] || [])
			.pSerialAwaitMap(async featureRef => {
				const uid = featureRef[propFeature] ? featureRef[propFeature] : featureRef;
				const unpackedUid = fnUnpackUid(uid);
				const {source, displayText} = unpackedUid;

				// Skip over broken links
				if (fnIsInvalidUnpackedUid(unpackedUid)) return;

				// Skip over temp/nonexistent links
				if (source === SRC_5ETOOLS_TMP) return;

				const hash = UrlUtil.URL_TO_HASH_BUILDER[propFeature](unpackedUid);

				// Skip blocklisted
				if (ExcludeUtil.isInitialised && ExcludeUtil.isExcluded(hash, propFeature, source, {isNoCount: true})) return;

				const feature = await DataLoader.pCacheAndGet(propFeature, source, hash, {isCopy: true, lockToken2});
				// Skip over missing links
				if (!feature) return notFoundUids.push(uid);

				if (displayText) feature._displayName = displayText;
				if (featureRef.tableDisplayName) feature._displayNameTable = featureRef.tableDisplayName;

				if (featureRef.gainSubclassFeature) feature.gainSubclassFeature = true;
				if (featureRef.gainSubclassFeatureHasContent) feature.gainSubclassFeatureHasContent = true;

				if (clsOrSc.otherSources && clsOrSc.source === feature.source) feature.otherSources = MiscUtil.copyFast(clsOrSc.otherSources);

				this._mutEntryNestLevel(feature);

				(byLevel[feature.level || 1] = byLevel[feature.level || 1] || []).push(feature);
			});

		this._pGetDereferencedData_doNotifyFailed({uids: notFoundUids, prop: propFeature});

		return byLevel;
	}

	static _pGetDereferencedData_doNotifyFailed ({uids, prop}) {
		const missingRefSets = {
			[prop]: new Set(uids),
		};

		_DataLoaderInternalUtil.doNotifyFailedDereferences({missingRefSets});
	}

	async pGetPostCacheData ({siteData = null, brewData = null, lockToken2}) {
		return {
			siteDataPostCache: await this._pGetPostCacheData_obj_withCache({obj: siteData, lockToken2, propCache: "site"}),
			brewDataPostCache: await this._pGetPostCacheData_obj({obj: brewData, lockToken2}),
		};
	}
}

class _DataTypeLoaderCustomClassSubclassFeatures extends _DataTypeLoader {
	static _PROPS = ["classFeature", "subclassFeature"];

	constructor ({hasPhase2Cache = false} = {}) {
		super();
		this.hasPhase2Cache = hasPhase2Cache;
	}

	_getSiteIdent ({pageClean, sourceClean}) { return `${pageClean}__${this.constructor.name}`; }

	async _pGetSiteData ({pageClean, sourceClean}) {
		const json = await DataUtil.class.loadRawJSON();
		return this.constructor._getAsRawPrefixed(json, {propsRaw: this.constructor._PROPS});
	}

	async _pGetStoredBrewData () {
		const brew = await BrewUtil2.pGetBrewProcessed();
		return this.constructor._getAsRawPrefixed(brew, {propsRaw: this.constructor._PROPS});
	}

	async _pGetPostCacheData_obj ({obj, lockToken2}) {
		if (!obj) return null;

		const out = {};

		if (obj.raw_classFeature?.length) out.classFeature = (await _DataLoaderDereferencer.pGetDereferenced(obj.raw_classFeature, "classFeature"))?.classFeature || [];
		if (obj.raw_subclassFeature?.length) out.subclassFeature = (await _DataLoaderDereferencer.pGetDereferenced(obj.raw_subclassFeature, "subclassFeature"))?.subclassFeature || [];

		return out;
	}

	async pGetPostCacheData ({siteData = null, brewData = null, lockToken2}) {
		return {
			siteDataPostCache: await this._pGetPostCacheData_obj_withCache({obj: siteData, lockToken2, propCache: "site"}),
			brewDataPostCache: await this._pGetPostCacheData_obj({obj: brewData, lockToken2}),
		};
	}
}

class _DataTypeLoaderCustomItems extends _DataTypeLoader {
	propAllowlist = new Set(["item", "itemGroup", "itemType", "itemEntry", "itemProperty", "baseitem", "itemFluff"]);

	/**
	 * Avoid adding phase 1 items to the cache. Adding them as `raw_item` is inaccurate, as we have already e.g. merged
	 *   generic variants, and enhanced the items.
	 * Adding them as `item` is also inaccurate, as we have yet to run our phase 2 post-processing to remove any
	 *   `itemEntry` references.
	 * We could cache them under, say, `phase1_item`, but this would mean supporting `phase1_item` everywhere (has
	 *   builders, etc.), polluting other areas with our implementation details.
	 * Therefore, cache only the essentials in phase 1.
	 */
	phase1CachePropAllowlist = new Set(["itemEntry"]);

	hasPhase2Cache = true;

	_getSiteIdent ({pageClean, sourceClean}) { return this.constructor.name; }

	async _pGetSiteData ({pageClean, sourceClean}) {
		return Renderer.item.pGetSiteUnresolvedRefItems();
	}

	async _pGetStoredBrewData () {
		const brew = await BrewUtil2.pGetBrewProcessed();

		return {
			item: await Renderer.item.pGetSiteUnresolvedRefItemsFromHomebrew(brew),
			itemEntry: brew.itemEntry || [],
		};
	}

	async _pGetPostCacheData_obj ({siteData, obj, lockToken2}) {
		if (!obj) return null;

		const out = {};

		if (obj.item?.length) {
			out.item = (await _DataLoaderDereferencer.pGetDereferenced(obj.item, "item", {entryProp: "entries", propIsRef: "hasRefs"}))?.item || [];
			out.item = (await _DataLoaderDereferencer.pGetDereferenced(out.item, "item", {entryProp: "_fullEntries", propIsRef: "hasRefs"}))?.item || [];
		}

		return out;
	}

	async pGetPostCacheData ({siteData = null, brewData = null, lockToken2}) {
		return {
			siteDataPostCache: await this._pGetPostCacheData_obj_withCache({obj: siteData, lockToken2, propCache: "site"}),
			brewDataPostCache: await this._pGetPostCacheData_obj({obj: brewData, lockToken2}),
		};
	}
}

class _DataTypeLoaderCustomQuickref extends _DataTypeLoader {
	static _PROPS = ["reference", "referenceData"];

	_getSiteIdent ({pageClean, sourceClean}) { return this.constructor.name; }

	_isBrewAvailable () { return false; }

	async _pGetSiteData ({pageClean, sourceClean}) {
		const json = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/generated/bookref-quick.json`);
		return {
			reference: json.reference["bookref-quick"],
			referenceData: json.data["bookref-quick"],
		};
	}

	hasCustomCacheStrategy ({obj}) { return this.constructor._PROPS.some(prop => obj[prop]?.length); }

	addToCacheCustom ({cache, obj}) {
		obj.referenceData.forEach((chapter, ixChapter) => this._addToCacheCustom_chapter({cache, chapter, ixChapter}));
		return [...this.constructor._PROPS];
	}

	_addToCacheCustom_chapter ({cache, chapter, ixChapter}) {
		const metas = IndexableFileQuickReference.getChapterNameMetas(chapter, {isRequireQuickrefFlag: false});

		metas.forEach(nameMeta => {
			const hashParts = [
				"bookref-quick",
				ixChapter,
				UrlUtil.encodeForHash(nameMeta.name.toLowerCase()),
			];
			if (nameMeta.ixBook) hashParts.push(nameMeta.ixBook);

			const hash = hashParts.join(HASH_PART_SEP);

			const {page: pageClean, source: sourceClean, hash: hashClean} = _DataLoaderInternalUtil.getCleanPageSourceHash({
				page: UrlUtil.PG_QUICKREF,
				source: nameMeta.source,
				hash,
			});
			cache.set(pageClean, sourceClean, hashClean, nameMeta.entry);

			if (nameMeta.ixBook) return;

			// region Add the hash with the redundant `0` header included
			hashParts.push(nameMeta.ixBook);
			const hashAlt = hashParts.join(HASH_PART_SEP);
			const hashAltClean = _DataLoaderInternalUtil.getCleanHash({hash: hashAlt});
			cache.set(pageClean, sourceClean, hashAltClean, nameMeta.entry);
			// endregion
		});
	}
}

class _DataTypeLoaderCustomAdventureBook extends _DataTypeLoader {
	_page;
	_prop;
	_propData;
	_filename;

	_getSiteIdent ({pageClean, sourceClean}) { return `${pageClean}__${sourceClean}`; }

	hasCustomCacheStrategy ({obj}) { return [this._prop, this._propData].some(prop => obj[prop]?.length); }

	addToCacheCustom ({cache, obj}) {
		// Get only the ids that exist in both data + contents
		const dataIds = (obj[this._propData] || []).filter(it => it.id).map(it => it.id);
		const contentsIds = new Set((obj[this._prop] || []).filter(it => it.id).map(it => it.id));
		const matchingIds = dataIds.filter(id => contentsIds.has(id));

		matchingIds.forEach(id => {
			const data = (obj[this._propData] || []).find(it => it.id === id);
			const contents = (obj[this._prop] || []).find(it => it.id === id);

			const hash = UrlUtil.URL_TO_HASH_BUILDER[this._page](contents);
			this._addImageBackReferences(data, this._page, contents.source, hash);

			const {page: pageClean, source: sourceClean, hash: hashClean} = _DataLoaderInternalUtil.getCleanPageSourceHash({
				page: this._page,
				source: contents.source,
				hash,
			});

			const pack = {
				[this._prop]: contents,
				[this._propData]: data,
			};

			cache.set(pageClean, sourceClean, hashClean, pack);
		});

		return [this._prop, this._propData];
	}

	async _pGetSiteData ({pageClean, sourceClean}) {
		const index = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/${this._filename}`);
		const contents = index[this._prop].find(contents => _DataLoaderInternalUtil.getCleanSource({source: contents.source}) === sourceClean);

		if (!contents) return {};

		const json = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/${this._prop}/${this._prop}-${UrlUtil.encodeForHash(contents.id.toLowerCase())}.json`);

		return {
			[this._prop]: [contents],
			[this._propData]: [
				{
					source: contents.source,
					id: contents.id,
					...json,
				},
			],
		};
	}

	_addImageBackReferences (json, page, source, hash) {
		if (!json) return;

		const walker = MiscUtil.getWalker({keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST, isNoModification: true});
		walker.walk(
			json,
			{
				object: (obj) => {
					if (obj.type === "image" && obj.mapRegions) {
						obj.page = obj.page || page;
						obj.source = obj.source || source;
						obj.hash = obj.hash || hash;
					}
				},
			},
		);
	}
}

class _DataTypeLoaderCustomAdventure extends _DataTypeLoaderCustomAdventureBook {
	_page = UrlUtil.PG_ADVENTURE;
	_prop = "adventure";
	_propData = "adventureData";
	_filename = "adventures.json";
}

class _DataTypeLoaderCustomBook extends _DataTypeLoaderCustomAdventureBook {
	_page = UrlUtil.PG_BOOK;
	_prop = "book";
	_propData = "bookData";
	_filename = "books.json";
}

// endregion

/* -------------------------------------------- */

// region Data loader

class DataLoader {
	static _PROP_TO_HASH_PAGE = {
		"monster": UrlUtil.PG_BESTIARY,
		"spell": UrlUtil.PG_SPELLS,
		"class": UrlUtil.PG_CLASSES,
		"subclass": UrlUtil.PG_CLASSES,
		"item": UrlUtil.PG_ITEMS,
		"background": UrlUtil.PG_BACKGROUNDS,
		"psionic": UrlUtil.PG_PSIONICS,
		"object": UrlUtil.PG_OBJECTS,
		"action": UrlUtil.PG_ACTIONS,
		"trap": UrlUtil.PG_TRAPS_HAZARDS,
		"hazard": UrlUtil.PG_TRAPS_HAZARDS,
		"cult": UrlUtil.PG_CULTS_BOONS,
		"boon": UrlUtil.PG_CULTS_BOONS,
		"condition": UrlUtil.PG_CONDITIONS_DISEASES,
		"disease": UrlUtil.PG_CONDITIONS_DISEASES,
		"status": UrlUtil.PG_CONDITIONS_DISEASES,
		"vehicle": UrlUtil.PG_VEHICLES,
		"vehicleUpgrade": UrlUtil.PG_VEHICLES,
		"feat": UrlUtil.PG_FEATS,
		"optionalfeature": UrlUtil.PG_OPT_FEATURES,
		"reward": UrlUtil.PG_REWARDS,
		"charoption": UrlUtil.PG_CHAR_CREATION_OPTIONS,
		"race": UrlUtil.PG_RACES,
		"subrace": UrlUtil.PG_RACES,
		"deity": UrlUtil.PG_DEITIES,
		"variantrule": UrlUtil.PG_VARIANTRULES,
		"table": UrlUtil.PG_TABLES,
		"tableGroup": UrlUtil.PG_TABLES,
		"language": UrlUtil.PG_LANGUAGES,
		"recipe": UrlUtil.PG_RECIPES,
		"classFeature": UrlUtil.PG_CLASS_SUBCLASS_FEATURES,
		"subclassFeature": UrlUtil.PG_CLASS_SUBCLASS_FEATURES,
		"reference": UrlUtil.PG_QUICKREF,
		"referenceData": UrlUtil.PG_QUICKREF,
		"adventure": UrlUtil.PG_ADVENTURE,
		"adventureData": UrlUtil.PG_ADVENTURE,
		"book": UrlUtil.PG_BOOK,
		"bookData": UrlUtil.PG_BOOK,
	};

	static _DATA_TYPE_LOADERS = {};
	static _DATA_TYPE_LOADER_LIST = [];

	static _init () {
		this._registerPropToHashPages();
		this._registerDataTypeLoaders();
		return null;
	}

	static _registerPropToHashPages () {
		Object.entries(this._PROP_TO_HASH_PAGE)
			.forEach(([k, v]) => this._PROP_TO_HASH_PAGE[`${k}Fluff`] = _DataLoaderInternalUtil.getCleanPageFluff({page: v}));
	}

	static _registerDataTypeLoader (loader) {
		this._DATA_TYPE_LOADER_LIST.push(loader);
		return loader;
	}

	static _registerDataTypeLoaders () {
		// region Multi-file
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "monster"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_BESTIARY})] =
			this._registerDataTypeLoader(new _DataTypeLoaderCustomBestiary());

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "monsterFluff"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPageFluff({page: UrlUtil.PG_BESTIARY})] =
			this._registerDataTypeLoader(new _DataTypeLoaderMultiSource({prop: "monsterFluff"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "spell"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_SPELLS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderCustomSpells());

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "spellFluff"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPageFluff({page: UrlUtil.PG_SPELLS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderMultiSource({prop: "spellFluff"}));

		// endregion

		// region Predefined
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "race"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "subrace"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_RACES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderPredefined({loader: "race", loadJsonArgs: {isAddBaseRaces: true}, loadBrewArgs: {isAddBaseRaces: true}}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "deity"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_DEITIES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderPredefined({loader: "deity"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "variantrule"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_VARIANTRULES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderPredefined({loader: "variantrule"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "table"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "tableGroup"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_TABLES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderPredefined({loader: "table"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "language"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_LANGUAGES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderPredefined({loader: "language"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "recipe"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_RECIPES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderPredefined({loader: "recipe"}));

		// endregion

		// region Special
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "raw_class"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "raw_subclass"})] =
				this._registerDataTypeLoader(new _DataTypeLoaderCustomClassesSubclasses());

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "class"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "subclass"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_CLASSES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderCustomClassesSubclasses({hasPhase2Cache: true}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "raw_classfeature"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "raw_subclassfeature"})] =
			this._registerDataTypeLoader(new _DataTypeLoaderCustomClassSubclassFeatures());

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "classFeature"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "subclassFeature"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_CLASS_SUBCLASS_FEATURES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderCustomClassSubclassFeatures({hasPhase2Cache: true}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "item"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_ITEMS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderCustomItems());

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "reference"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "referenceData"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_QUICKREF})] =
			this._registerDataTypeLoader(new _DataTypeLoaderCustomQuickref());

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "adventure"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "adventureData"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_ADVENTURE})] =
			this._registerDataTypeLoader(new _DataTypeLoaderCustomAdventure());

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "book"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "bookData"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_BOOK})] =
			this._registerDataTypeLoader(new _DataTypeLoaderCustomBook());
		// endregion

		// region Single file
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "background"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_BACKGROUNDS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "backgrounds.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "psionic"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_PSIONICS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "psionics.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "object"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_OBJECTS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "objects.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "action"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_ACTIONS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "actions.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "trap"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "hazard"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_TRAPS_HAZARDS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "trapshazards.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "cult"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "boon"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_CULTS_BOONS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "cultsboons.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "condition"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "disease"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "status"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_CONDITIONS_DISEASES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "conditionsdiseases.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "vehicle"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "vehicleUpgrade"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_VEHICLES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "vehicles.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "feat"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "raw_feat"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_FEATS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "feats.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "optionalfeature"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "raw_optionalfeature"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_OPT_FEATURES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "optionalfeatures.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "reward"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "raw_reward"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_REWARDS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "rewards.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "charoption"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "raw_charoption"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: UrlUtil.PG_CHAR_CREATION_OPTIONS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "charcreationoptions.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "skill"})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "skills.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "sense"})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "senses.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "legendaryGroup"})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "bestiary/legendarygroups.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "itemEntry"})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "items-base.json"}));
		// endregion

		// region Fluff
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "backgroundFluff"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPageFluff({page: UrlUtil.PG_BACKGROUNDS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "fluff-backgrounds.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "featFluff"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPageFluff({page: UrlUtil.PG_FEATS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "fluff-feats.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "itemFluff"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPageFluff({page: UrlUtil.PG_ITEMS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "fluff-items.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "conditionFluff"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "diseaseFluff"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "statusFluff"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPageFluff({page: UrlUtil.PG_CONDITIONS_DISEASES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "fluff-conditionsdiseases.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "raceFluff"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPageFluff({page: UrlUtil.PG_RACES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "fluff-races.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "languageFluff"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPageFluff({page: UrlUtil.PG_LANGUAGES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "fluff-languages.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "vehicleFluff"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPageFluff({page: UrlUtil.PG_VEHICLES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "fluff-vehicles.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "objectFluff"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPageFluff({page: UrlUtil.PG_OBJECTS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "fluff-objects.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "charoptionFluff"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPageFluff({page: UrlUtil.PG_CHAR_CREATION_OPTIONS})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "fluff-charcreationoptions.json"}));

		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: "recipeFluff"})] =
		this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPageFluff({page: UrlUtil.PG_RECIPES})] =
			this._registerDataTypeLoader(new _DataTypeLoaderSingleSource({filename: "fluff-recipes.json"}));

		// endregion
	}

	static _ = this._init();

	static _CACHE = new _DataLoaderCache();
	static _LOCK_0 = new VeLock({isDbg: false, name: "loader-lock-0"});
	static _LOCK_1 = new VeLock({isDbg: false, name: "loader-lock-1"});
	static _LOCK_2 = new VeLock({isDbg: false, name: "loader-lock-2"});

	/* -------------------------------------------- */

	/**
	 * @param page
	 * @param source
	 * @param hash
	 * @param [isCopy] If a copy, rather than the original entity, should be returned.
	 * @param [isRequired] If an error should be thrown on a missing entity.
	 * @param [_isReturnSentinel] If a null sentinel should be returned, if it exists.
	 * @param [_isInsertSentinelOnMiss] If a null sentinel should be inserted on cache miss.
	 */
	static getFromCache (
		page,
		source,
		hash,
		{
			isCopy = false,
			isRequired = false,
			_isReturnSentinel = false,
			_isInsertSentinelOnMiss = false,
		} = {},
	) {
		const {page: pageClean, source: sourceClean, hash: hashClean} = _DataLoaderInternalUtil.getCleanPageSourceHash({page, source, hash});
		const ent = this._getFromCache({pageClean, sourceClean, hashClean, isCopy, _isReturnSentinel, _isInsertSentinelOnMiss});
		return this._getVerifiedRequiredEntity({pageClean, sourceClean, hashClean, ent, isRequired});
	}

	static _getFromCache (
		{
			pageClean,
			sourceClean,
			hashClean,
			isCopy = false,
			_isInsertSentinelOnMiss = false,
			_isReturnSentinel = false,
		},
	) {
		const out = this._CACHE.get(pageClean, sourceClean, hashClean);

		if (out === _DataLoaderConst.ENTITY_NULL) {
			if (_isReturnSentinel) return out;
			if (!_isReturnSentinel) return null;
		}

		if (out == null && _isInsertSentinelOnMiss) {
			this._CACHE.set(pageClean, sourceClean, hashClean, _DataLoaderConst.ENTITY_NULL);
		}

		if (!isCopy || out == null) return out;
		return MiscUtil.copyFast(out);
	}

	/* -------------------------------------------- */

	static _getVerifiedRequiredEntity ({pageClean, sourceClean, hashClean, ent, isRequired}) {
		if (ent || !isRequired) return ent;
		throw new Error(`Could not find entity for page/prop "${pageClean}" with source "${sourceClean}" and hash "${hashClean}"`);
	}

	/* -------------------------------------------- */

	static async pCacheAndGetAllSite (page, {isSilent = false} = {}) {
		const pageClean = _DataLoaderInternalUtil.getCleanPage({page});

		if (this._PAGES_NO_CONTENT.has(pageClean)) return null;

		const dataLoader = this._pCache_getDataTypeLoader({pageClean, isSilent});
		if (!dataLoader) return null;

		// (Avoid preloading missing brew here, as we only return site data.)

		const {siteData} = await this._pCacheAndGet_getCacheMeta({pageClean, sourceClean: _DataLoaderConst.SOURCE_SITE_ALL, dataLoader});
		await this._pCacheAndGet_processCacheMeta({dataLoader, siteData});

		return this._CACHE.getAllSite(pageClean);
	}

	static async pCacheAndGetAllBrew (page, {isSilent = false} = {}) {
		const pageClean = _DataLoaderInternalUtil.getCleanPage({page});

		if (this._PAGES_NO_CONTENT.has(pageClean)) return null;

		const dataLoader = this._pCache_getDataTypeLoader({pageClean, isSilent});
		if (!dataLoader) return null;

		// (Avoid preloading missing brew here, as we only return currently-loaded brew.)

		const {brewData} = await this._pCacheAndGet_getCacheMeta({pageClean, sourceClean: _DataLoaderConst.SOURCE_BREW_ALL_CURRENT, dataLoader});
		await this._pCacheAndGet_processCacheMeta({dataLoader, brewData});

		return this._CACHE.getAllBrew(pageClean);
	}

	/* -------------------------------------------- */

	static _PAGES_NO_CONTENT = new Set([
		_DataLoaderInternalUtil.getCleanPage({page: "generic"}),
		_DataLoaderInternalUtil.getCleanPage({page: "hover"}),
	]);

	/**
	 * @param page
	 * @param source
	 * @param hash
	 * @param [isCopy] If a copy, rather than the original entity, should be returned.
	 * @param [isRequired] If an error should be thrown on a missing entity.
	 * @param [isSilent] If errors should not be thrown on a missing implementation.
	 * @param [lockToken2] Post-process lock token for recursive calls.
	 */
	static async pCacheAndGet (page, source, hash, {isCopy = false, isRequired = false, isSilent = false, lockToken2} = {}) {
		const fromCache = this.getFromCache(page, source, hash, {isCopy, _isReturnSentinel: true});
		if (fromCache === _DataLoaderConst.ENTITY_NULL) return null;
		if (fromCache) return fromCache;

		const {page: pageClean, source: sourceClean, hash: hashClean} = _DataLoaderInternalUtil.getCleanPageSourceHash({page, source, hash});

		if (this._PAGES_NO_CONTENT.has(pageClean)) return this._getVerifiedRequiredEntity({pageClean, sourceClean, hashClean, ent: null, isRequired});

		const dataLoader = this._pCache_getDataTypeLoader({pageClean, isSilent});
		if (!dataLoader) return this._getVerifiedRequiredEntity({pageClean, sourceClean, hashClean, ent: null, isRequired});

		const isUnavailableBrew = await this._pCacheAndGet_preloadMissingBrew({sourceClean});
		if (isUnavailableBrew) return this._getVerifiedRequiredEntity({pageClean, sourceClean, hashClean, ent: null, isRequired});

		const {siteData = null, brewData = null} = await this._pCacheAndGet_getCacheMeta({pageClean, sourceClean, dataLoader});
		await this._pCacheAndGet_processCacheMeta({dataLoader, siteData, brewData, lockToken2});

		return this.getFromCache(page, source, hash, {isCopy, _isInsertSentinelOnMiss: true});
	}

	static async pCacheAndGetHash (page, hash, opts) {
		const source = UrlUtil.decodeHash(hash).last();
		return DataLoader.pCacheAndGet(page, source, hash, opts);
	}

	/**
	 * Phase 0: check if homebrew, and if so, check/load the source (if available).
	 *   Track failures (i.e., there is no available JSON for the brew source requested), and skip repeated failures.
	 *   This allows us to avoid an expensive mass re-cache, if a brew source which does not exist is requested for
	 *   loading multiple times.
	 */
	static async _pCacheAndGet_preloadMissingBrew ({sourceClean}) {
		try {
			await this._LOCK_0.pLock();
			return (await this._pPreloadMissingBrew({sourceClean}));
		} finally {
			this._LOCK_0.unlock();
		}
	}

	/**
	 * @param sourceClean
	 * @return {Promise<boolean>} `true` if the brew does not exist and could not be loaded, false otherwise.
	 */
	static async _pPreloadMissingBrew ({sourceClean}) {
		if (this._isExistingBrewMiss({sourceClean})) return true;

		if (this._isSiteSource({sourceClean})) return false;
		if (sourceClean === _DataLoaderConst.SOURCE_BREW_ALL_CURRENT) return false;

		if (typeof BrewUtil2 === "undefined") {
			this._setExistingBrewMiss({sourceClean});
			return true;
		}

		if (BrewUtil2.hasSourceJson(sourceClean)) return false;

		const urlBrew = await this._pGetBrewUrl({sourceClean});
		if (!urlBrew) {
			this._setExistingBrewMiss({sourceClean});
			return true;
		}

		await BrewUtil2.pAddBrewFromUrl(urlBrew);
		return false;
	}

	static async _pCacheAndGet_getCacheMeta ({pageClean, sourceClean, dataLoader}) {
		try {
			await this._LOCK_1.pLock();
			return (await this._pCache({pageClean, sourceClean, dataLoader}));
		} finally {
			this._LOCK_1.unlock();
		}
	}

	static async _pCache ({pageClean, sourceClean, dataLoader}) {
		// region Fetch from site data
		const siteData = await dataLoader.pGetSiteData({pageClean, sourceClean});
		this._pCache_addToCache({allDataMerged: siteData, propAllowlist: dataLoader.phase1CachePropAllowlist || dataLoader.propAllowlist});
		// Always early-exit, regardless of whether the entity was found in the cache, if we know this is a site source
		if (this._isSiteSource({sourceClean})) return {siteData};
		// endregion

		if (typeof BrewUtil2 === "undefined") return {siteData};

		// region Fetch from already-stored brew data
		//   As we have preloaded missing brew earlier in the flow, we know that a brew is either present, or unavailable
		let brewData = await dataLoader.pGetStoredBrewData();
		this._pCache_addToCache({allDataMerged: brewData, propAllowlist: dataLoader.phase1CachePropAllowlist || dataLoader.propAllowlist});
		// endregion

		return {siteData, brewData};
	}

	static async _pCacheAndGet_processCacheMeta ({dataLoader, siteData = null, brewData = null, lockToken2 = null}) {
		if (!dataLoader.hasPhase2Cache) return;

		try {
			lockToken2 = await this._LOCK_2.pLock({token: lockToken2});
			await this._pCacheAndGet_processCacheMeta_({dataLoader, siteData, brewData, lockToken2});
		} finally {
			this._LOCK_2.unlock();
		}
	}

	static async _pCacheAndGet_processCacheMeta_ ({dataLoader, siteData = null, brewData = null, lockToken2 = null}) {
		const {siteDataPostCache, brewDataPostCache} = await dataLoader.pGetPostCacheData({siteData, brewData, lockToken2});

		this._pCache_addToCache({allDataMerged: siteDataPostCache, propAllowlist: dataLoader.phase2CachePropAllowlist || dataLoader.propAllowlist});
		this._pCache_addToCache({allDataMerged: brewDataPostCache, propAllowlist: dataLoader.phase2CachePropAllowlist || dataLoader.propAllowlist});
	}

	static _pCache_getDataTypeLoader ({pageClean, isSilent}) {
		const dataLoader = this._DATA_TYPE_LOADERS[pageClean];
		if (!dataLoader && !isSilent) throw new Error(`No loading strategy found for page "${pageClean}"!`);
		return dataLoader;
	}

	static _pCache_addToCache ({allDataMerged, propAllowlist = null}) {
		if (!allDataMerged) return;

		allDataMerged = {...allDataMerged};

		this._DATA_TYPE_LOADER_LIST
			.filter(loader => loader.hasCustomCacheStrategy({obj: allDataMerged}))
			.forEach(loader => {
				const propsToRemove = loader.addToCacheCustom({cache: this._CACHE, obj: allDataMerged});
				propsToRemove.forEach(prop => delete allDataMerged[prop]);
			});

		Object.keys(allDataMerged)
			.forEach(prop => {
				if (propAllowlist && !propAllowlist.has(prop)) return;

				const arr = allDataMerged[prop];
				if (!arr?.length || !(arr instanceof Array)) return;

				const hashBuilder = UrlUtil.URL_TO_HASH_BUILDER[prop];
				if (!hashBuilder) return;

				arr.forEach(ent => {
					ent.__prop = ent.__prop || prop;

					const page = this._PROP_TO_HASH_PAGE[prop];
					const source = SourceUtil.getEntitySource(ent);
					const hash = hashBuilder(ent);

					const {page: propClean, source: sourceClean, hash: hashClean} = _DataLoaderInternalUtil.getCleanPageSourceHash({page: prop, source, hash});
					const pageClean = page ? _DataLoaderInternalUtil.getCleanPage({page}) : null;

					this._CACHE.set(propClean, sourceClean, hashClean, ent);
					if (pageClean) this._CACHE.set(pageClean, sourceClean, hashClean, ent);
				});
			});
	}

	/* -------------------------------------------- */

	static _BREW_SOURCES_ATTEMPTED = new Set();

	static _isExistingBrewMiss ({sourceClean}) {
		return this._BREW_SOURCES_ATTEMPTED.has(sourceClean);
	}

	static _setExistingBrewMiss ({sourceClean}) {
		this._BREW_SOURCES_ATTEMPTED.add(sourceClean);
	}

	/* -------------------------------------------- */

	static _CACHE_SITE_SOURCE_CLEAN = null;

	static _isSiteSource ({sourceClean}) {
		if (sourceClean === _DataLoaderConst.SOURCE_SITE_ALL) return true;
		if (sourceClean === _DataLoaderConst.SOURCE_BREW_ALL_CURRENT) return false;

		this._CACHE_SITE_SOURCE_CLEAN = this._CACHE_SITE_SOURCE_CLEAN || new Set(Object.keys(Parser.SOURCE_JSON_TO_FULL)
			.map(src => _DataLoaderInternalUtil.getCleanSource({source: src})));
		return this._CACHE_SITE_SOURCE_CLEAN.has(sourceClean);
	}

	/* -------------------------------------------- */

	/** Cache of clean (lowercase) source -> brew URL. */
	static _CACHE_BREW_SOURCE_CLEAN_TO_URL = null;

	static async _pInitCacheBrewSourceToUrl () {
		if (this._CACHE_BREW_SOURCE_CLEAN_TO_URL) return;

		const index = await this._pGetBrewUrlIndex();
		if (!index) return this._CACHE_BREW_SOURCE_CLEAN_TO_URL = {};

		const urlRoot = await BrewUtil2.pGetCustomUrl();

		this._CACHE_BREW_SOURCE_CLEAN_TO_URL = Object.entries(index)
			.mergeMap(([src, url]) => ({[_DataLoaderInternalUtil.getCleanSource({source: src})]: DataUtil.brew.getFileUrl(url, urlRoot)}));
	}

	static async _pGetBrewUrlIndex () {
		try {
			return (await DataUtil.brew.pLoadSourceIndex());
		} catch (e) {
			setTimeout(() => { throw e; });
			return null;
		}
	}

	static async _pGetBrewUrl ({sourceClean}) {
		await this._pInitCacheBrewSourceToUrl();
		return this._CACHE_BREW_SOURCE_CLEAN_TO_URL[sourceClean];
	}

	/* -------------------------------------------- */
}

// endregion

/* -------------------------------------------- */

// region Exports

globalThis.DataLoader = DataLoader;

// endregion
