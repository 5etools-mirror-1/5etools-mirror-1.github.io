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
	static SOURCE_PRERELEASE_ALL_CURRENT = Symbol("SOURCE_PRERELEASE_ALL_CURRENT");
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

	static doNotifyFailedDereferences ({missingRefSets, diagnostics}) {
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

		const ptDiagnostics = DataLoader.getDiagnosticsSummary(diagnostics);
		const msgStart = `Failed to load references for ${cntMissingRefs} entr${cntMissingRefs === 1 ? "y" : "ies"}!`;

		JqueryUtil.doToast({
			type: "danger",
			content: `${msgStart} Reference types and values were: ${[notificationRefs, ptDiagnostics].join(" ")}`,
			isAutoHide: false,
		});

		const cnslRefs = [
			...Object.entries(missingRefSetsUnseen)
				.map(([k, v]) => `${k}:\n\t${[...v].sort(SortUtil.ascSortLower).join("\n\t")}`),
			ptDiagnostics,
		]
			.filter(Boolean)
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

	/* -------------------------------------------- */

	_pPreloadingRefContentSite = null;
	_pPreloadingRefContentPrerelease = null;
	_pPreloadingRefContentBrew = null;

	_preloadingPrereleaseLastIdent = null;
	_preloadingBrewLastIdent = null;

	async pPreloadRefContent () {
		await (this._pPreloadingRefContentSite = this._pPreloadingRefContentSite || this._pPreloadRefContentSite());

		if (typeof PrereleaseUtil !== "undefined") {
			const identPrerelease = PrereleaseUtil.getCacheIteration();
			if (identPrerelease !== this._preloadingPrereleaseLastIdent) this._pPreloadingRefContentPrerelease = null;
			this._preloadingPrereleaseLastIdent = identPrerelease;
			await (this._pPreloadingRefContentPrerelease = this._pPreloadingRefContentPrerelease || this._pPreloadRefContentPrerelease());
		}

		if (typeof BrewUtil2 !== "undefined") {
			const identBrew = BrewUtil2.getCacheIteration();
			if (identBrew !== this._preloadingBrewLastIdent) this._pPreloadingRefContentBrew = null;
			this._preloadingBrewLastIdent = identBrew;
			await (this._pPreloadingRefContentBrew = this._pPreloadingRefContentBrew || this._pPreloadRefContentBrew());
		}
	}

	async _pPreloadRefContentSite () { /* Implement as required */ }
	async _pPreloadRefContentPrerelease () { /* Implement as required */ }
	async _pPreloadRefContentBrew () { /* Implement as required */ }

	/* -------------------------------------------- */

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
	async _pPreloadRefContentSite () { await DataLoader.pCacheAndGetAllSite(UrlUtil.PG_OPT_FEATURES); }
	async _pPreloadRefContentPrerelease () { await DataLoader.pCacheAndGetAllPrerelease(UrlUtil.PG_OPT_FEATURES); }
	async _pPreloadRefContentBrew () { await DataLoader.pCacheAndGetAllBrew(UrlUtil.PG_OPT_FEATURES); }

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
	async _pPreloadRefContentSite () { await DataLoader.pCacheAndGetAllSite(UrlUtil.PG_ITEMS); }
	async _pPreloadRefContentPrerelease () { await DataLoader.pCacheAndGetAllPrerelease(UrlUtil.PG_ITEMS); }
	async _pPreloadRefContentBrew () { await DataLoader.pCacheAndGetAllBrew(UrlUtil.PG_ITEMS); }

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
		this._pGetDereferenced_doNotifyFailed({entriesWithRefs, entities});
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

	static _pGetDereferenced_doNotifyFailed ({entriesWithRefs, entities}) {
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

		_DataLoaderInternalUtil.doNotifyFailedDereferences({
			missingRefSets,
			diagnostics: entities
				.map(ent => ent.__diagnostic)
				.filter(Boolean),
		});
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
	_cachePrereleaseLists = {};
	_cacheBrewLists = {};

	get (pageClean, sourceClean, hashClean) {
		return this._cache[pageClean]?.[sourceClean]?.[hashClean];
	}

	getAllSite (pageClean) {
		return Object.values(this._cacheSiteLists[pageClean] || {});
	}

	getAllPrerelease (pageClean) {
		return Object.values(this._cachePrereleaseLists[pageClean] || {});
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

		// region Set site/prerelease/brew list cache
		const sourceJson = Parser.sourceJsonToJson(sourceClean);
		if (SourceUtil.isSiteSource(sourceJson)) {
			this._set_addToPartition({
				cache: this._cacheSiteLists,
				pageClean,
				hashClean,
				ent,
			});
			return;
		}

		if (PrereleaseUtil.hasSourceJson(sourceJson)) {
			this._set_addToPartition({
				cache: this._cachePrereleaseLists,
				pageClean,
				hashClean,
				ent,
			});
			return;
		}

		if (BrewUtil2.hasSourceJson(sourceJson)) {
			this._set_addToPartition({
				cache: this._cacheBrewLists,
				pageClean,
				hashClean,
				ent,
			});
		}
		// endregion
	}

	_set_addToPartition ({cache, pageClean, hashClean, ent}) {
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
	static PROPS = [];
	static PAGE = null;
	static IS_FLUFF = false;

	static register ({fnRegister}) {
		fnRegister({
			loader: new this(),
			props: this.PROPS,
			page: this.PAGE,
			isFluff: this.IS_FLUFF,
		});
	}

	static _getAsRawPrefixed (json, {propsRaw}) {
		return {
			...propsRaw.mergeMap(prop => ({[`raw_${prop}`]: json[prop]})),
		};
	}

	/* -------------------------------------------- */

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

	_isPrereleaseAvailable () { return typeof PrereleaseUtil !== "undefined"; }

	_isBrewAvailable () { return typeof BrewUtil2 !== "undefined"; }

	async _pPrePopulate ({data, isPrerelease, isBrew}) { /* Implement as required */ }

	async pGetSiteData ({pageClean, sourceClean}) {
		const propCache = this._getSiteIdent({pageClean, sourceClean});
		this._cache_pSiteData[propCache] = this._cache_pSiteData[propCache] || this._pGetSiteData({pageClean, sourceClean});
		return this._cache_pSiteData[propCache];
	}

	async _pGetSiteData ({pageClean, sourceClean}) { throw new Error("Unimplemented!"); }

	async pGetStoredPrereleaseData () {
		if (!this._isPrereleaseAvailable()) return {};
		return this._pGetStoredPrereleaseData();
	}

	async pGetStoredBrewData () {
		if (!this._isBrewAvailable()) return {};
		return this._pGetStoredBrewData();
	}

	async _pGetStoredPrereleaseData () {
		return this._pGetStoredPrereleaseBrewData({brewUtil: PrereleaseUtil, isPrerelease: true});
	}

	async _pGetStoredBrewData () {
		return this._pGetStoredPrereleaseBrewData({brewUtil: BrewUtil2, isBrew: true});
	}

	async _pGetStoredPrereleaseBrewData ({brewUtil, isPrerelease, isBrew}) {
		const prereleaseBrewData = await brewUtil.pGetBrewProcessed();
		await this._pPrePopulate({data: prereleaseBrewData, isPrerelease, isBrew});
		return prereleaseBrewData;
	}

	async pGetPostCacheData ({siteData = null, prereleaseData = null, brewData = null, lockToken2}) { /* Implement as required */ }

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

	_getSiteIdent ({pageClean, sourceClean}) { return this._filename; }

	async _pGetSiteData ({pageClean, sourceClean}) {
		return DataUtil.loadJSON(`${Renderer.get().baseUrl}data/${this._filename}`);
	}
}

class _DataTypeLoaderBackground extends _DataTypeLoaderSingleSource {
	static PROPS = ["background"];
	static PAGE = UrlUtil.PG_BACKGROUNDS;

	_filename = "backgrounds.json";
}

class _DataTypeLoaderPsionic extends _DataTypeLoaderSingleSource {
	static PROPS = ["psionic"];
	static PAGE = UrlUtil.PG_PSIONICS;

	_filename = "psionics.json";
}

class _DataTypeLoaderObject extends _DataTypeLoaderSingleSource {
	static PROPS = ["object"];
	static PAGE = UrlUtil.PG_OBJECTS;

	_filename = "objects.json";
}

class _DataTypeLoaderAction extends _DataTypeLoaderSingleSource {
	static PROPS = ["action"];
	static PAGE = UrlUtil.PG_ACTIONS;

	_filename = "actions.json";
}

class _DataTypeLoaderFeat extends _DataTypeLoaderSingleSource {
	static PROPS = ["feat"];
	static PAGE = UrlUtil.PG_FEATS;

	_filename = "feats.json";
}

class _DataTypeLoaderOptionalfeature extends _DataTypeLoaderSingleSource {
	static PROPS = ["optionalfeature"];
	static PAGE = UrlUtil.PG_OPT_FEATURES;

	_filename = "optionalfeatures.json";
}

class _DataTypeLoaderReward extends _DataTypeLoaderSingleSource {
	static PROPS = ["reward"];
	static PAGE = UrlUtil.PG_REWARDS;

	_filename = "rewards.json";
}

class _DataTypeLoaderCharoption extends _DataTypeLoaderSingleSource {
	static PROPS = ["charoption"];
	static PAGE = UrlUtil.PG_CHAR_CREATION_OPTIONS;

	_filename = "charcreationoptions.json";
}

class _DataTypeLoaderTrapHazard extends _DataTypeLoaderSingleSource {
	static PROPS = ["trap", "hazard"];
	static PAGE = UrlUtil.PG_TRAPS_HAZARDS;

	_filename = "trapshazards.json";
}

class _DataTypeLoaderCultBoon extends _DataTypeLoaderSingleSource {
	static PROPS = ["cult", "boon"];
	static PAGE = UrlUtil.PG_CULTS_BOONS;

	_filename = "cultsboons.json";
}

class _DataTypeLoaderVehicle extends _DataTypeLoaderSingleSource {
	static PROPS = ["vehicle", "vehicleUpgrade"];
	static PAGE = UrlUtil.PG_VEHICLES;

	_filename = "vehicles.json";
}

class _DataTypeLoaderConditionDisease extends _DataTypeLoaderSingleSource {
	static PROPS = ["condition", "disease", "status"];
	static PAGE = UrlUtil.PG_CONDITIONS_DISEASES;

	_filename = "conditionsdiseases.json";
}

class _DataTypeLoaderSkill extends _DataTypeLoaderSingleSource {
	static PROPS = ["skill"];

	_filename = "skills.json";
}

class _DataTypeLoaderSense extends _DataTypeLoaderSingleSource {
	static PROPS = ["sense"];

	_filename = "senses.json";
}

class _DataTypeLoaderLegendaryGroup extends _DataTypeLoaderSingleSource {
	static PROPS = ["legendaryGroup"];

	_filename = "bestiary/legendarygroups.json";
}

class _DataTypeLoaderItemEntry extends _DataTypeLoaderSingleSource {
	static PROPS = ["itemEntry"];

	_filename = "items-base.json";
}

class _DataTypeLoaderItemMastery extends _DataTypeLoaderSingleSource {
	static PROPS = ["itemMastery"];

	_filename = "items-base.json";
}

class _DataTypeLoaderBackgroundFluff extends _DataTypeLoaderSingleSource {
	static PROPS = ["backgroundFluff"];
	static PAGE = UrlUtil.PG_BACKGROUNDS;
	static IS_FLUFF = true;

	_filename = "fluff-backgrounds.json";
}

class _DataTypeLoaderFeatFluff extends _DataTypeLoaderSingleSource {
	static PROPS = ["featFluff"];
	static PAGE = UrlUtil.PG_FEATS;
	static IS_FLUFF = true;

	_filename = "fluff-feats.json";
}

class _DataTypeLoaderItemFluff extends _DataTypeLoaderSingleSource {
	static PROPS = ["itemFluff"];
	static PAGE = UrlUtil.PG_ITEMS;
	static IS_FLUFF = true;

	_filename = "fluff-items.json";
}

class _DataTypeLoaderRaceFluff extends _DataTypeLoaderSingleSource {
	static PROPS = ["raceFluff"];
	static PAGE = UrlUtil.PG_RACES;
	static IS_FLUFF = true;

	_filename = "fluff-races.json";
}

class _DataTypeLoaderLanguageFluff extends _DataTypeLoaderSingleSource {
	static PROPS = ["languageFluff"];
	static PAGE = UrlUtil.PG_LANGUAGES;
	static IS_FLUFF = true;

	_filename = "fluff-languages.json";
}

class _DataTypeLoaderVehicleFluff extends _DataTypeLoaderSingleSource {
	static PROPS = ["vehicleFluff"];
	static PAGE = UrlUtil.PG_VEHICLES;
	static IS_FLUFF = true;

	_filename = "fluff-vehicles.json";
}

class _DataTypeLoaderObjectFluff extends _DataTypeLoaderSingleSource {
	static PROPS = ["objectFluff"];
	static PAGE = UrlUtil.PG_OBJECTS;
	static IS_FLUFF = true;

	_filename = "fluff-objects.json";
}

class _DataTypeLoaderCharoptionFluff extends _DataTypeLoaderSingleSource {
	static PROPS = ["charoptionFluff"];
	static PAGE = UrlUtil.PG_CHAR_CREATION_OPTIONS;
	static IS_FLUFF = true;

	_filename = "fluff-charcreationoptions.json";
}

class _DataTypeLoaderRecipeFluff extends _DataTypeLoaderSingleSource {
	static PROPS = ["recipeFluff"];
	static PAGE = UrlUtil.PG_RECIPES;
	static IS_FLUFF = true;

	_filename = "fluff-recipes.json";
}

class _DataTypeLoaderConditionDiseaseFluff extends _DataTypeLoaderSingleSource {
	static PROPS = ["conditionFluff", "diseaseFluff", "statusFluff"];
	static PAGE = UrlUtil.PG_CONDITIONS_DISEASES;
	static IS_FLUFF = true;

	_filename = "fluff-conditionsdiseases.json";
}

class _DataTypeLoaderPredefined extends _DataTypeLoader {
	_loader;
	_loadJsonArgs = null;
	_loadPrereleaseArgs = null;
	_loadBrewArgs = null;

	_getSiteIdent ({pageClean, sourceClean}) { return this._loader; }

	async _pGetSiteData ({pageClean, sourceClean}) {
		return DataUtil[this._loader].loadJSON(this._loadJsonArgs);
	}

	async _pGetStoredPrereleaseData () {
		if (!DataUtil[this._loader].loadPrerelease) return super._pGetStoredPrereleaseData();
		return DataUtil[this._loader].loadPrerelease(this._loadPrereleaseArgs);
	}

	async _pGetStoredBrewData () {
		if (!DataUtil[this._loader].loadBrew) return super._pGetStoredBrewData();
		return DataUtil[this._loader].loadBrew(this._loadBrewArgs);
	}
}

class _DataTypeLoaderRace extends _DataTypeLoaderPredefined {
	static PROPS = ["race", "subrace"];
	static PAGE = UrlUtil.PG_RACES;

	_loader = "race";
	_loadJsonArgs = {isAddBaseRaces: true};
	_loadPrereleaseArgs = {isAddBaseRaces: true};
	_loadBrewArgs = {isAddBaseRaces: true};
}

class _DataTypeLoaderDeity extends _DataTypeLoaderPredefined {
	static PROPS = ["deity"];
	static PAGE = UrlUtil.PG_DEITIES;

	_loader = "deity";
}

class _DataTypeLoaderVariantrule extends _DataTypeLoaderPredefined {
	static PROPS = ["variantrule"];
	static PAGE = UrlUtil.PG_VARIANTRULES;

	_loader = "variantrule";
}

class _DataTypeLoaderTable extends _DataTypeLoaderPredefined {
	static PROPS = ["table", "tableGroup"];
	static PAGE = UrlUtil.PG_TABLES;

	_loader = "table";
}

class _DataTypeLoaderLanguage extends _DataTypeLoaderPredefined {
	static PROPS = ["language"];
	static PAGE = UrlUtil.PG_LANGUAGES;

	_loader = "language";
}

class _DataTypeLoaderRecipe extends _DataTypeLoaderPredefined {
	static PROPS = ["recipe"];
	static PAGE = UrlUtil.PG_RECIPES;

	_loader = "recipe";
}

class _DataTypeLoaderMultiSource extends _DataTypeLoader {
	_prop;

	_getSiteIdent ({pageClean, sourceClean}) { return `${this._prop}__${sourceClean}`; }

	async _pGetSiteData ({pageClean, sourceClean}) {
		const source = Parser.sourceJsonToJson(sourceClean);
		const data = await DataUtil[this._prop].pLoadSingleSource(source);

		if (data == null) return {};

		await this._pPrePopulate({data});

		return data;
	}
}

class _DataTypeLoaderCustomMonster extends _DataTypeLoaderMultiSource {
	static PROPS = ["monster"];
	static PAGE = UrlUtil.PG_BESTIARY;

	_prop = "monster";

	async _pGetSiteData ({pageClean, sourceClean}) {
		await DataUtil.monster.pPreloadMeta();
		return super._pGetSiteData({pageClean, sourceClean});
	}

	async _pPrePopulate ({data, isPrerelease, isBrew}) {
		DataUtil.monster.populateMetaReference(data);
	}
}

class _DataTypeLoaderCustomMonsterFluff extends _DataTypeLoaderMultiSource {
	static PROPS = ["monsterFluff"];
	static PAGE = UrlUtil.PG_BESTIARY;
	static IS_FLUFF = true;

	_prop = "monsterFluff";
}

class _DataTypeLoaderCustomSpell extends _DataTypeLoaderMultiSource {
	static PROPS = [...UrlUtil.PAGE_TO_PROPS[UrlUtil.PG_SPELLS]];
	static PAGE = UrlUtil.PG_SPELLS;

	_prop = "spell";

	async _pPrePopulate ({data, isPrerelease, isBrew}) {
		Renderer.spell.prePopulateHover(data);
		if (isPrerelease) Renderer.spell.prePopulateHoverPrerelease(data);
		if (isBrew) Renderer.spell.prePopulateHoverBrew(data);
	}
}

class _DataTypeLoaderCustomSpellFluff extends _DataTypeLoaderMultiSource {
	static PROPS = ["spellFluff"];
	static PAGE = UrlUtil.PG_SPELLS;
	static IS_FLUFF = true;

	_prop = "spellFluff";
}

/** @abstract */
class _DataTypeLoaderCustomRawable extends _DataTypeLoader {
	static _PROPS_RAWABLE;

	hasPhase2Cache = true;

	_getSiteIdent ({pageClean, sourceClean}) { return `${pageClean}__${this.constructor.name}`; }

	async _pGetSiteData ({pageClean, sourceClean}) {
		const json = await this._pGetRawSiteData();
		return this.constructor._getAsRawPrefixed(json, {propsRaw: this.constructor._PROPS_RAWABLE});
	}

	/** @abstract */
	async _pGetRawSiteData () { throw new Error("Unimplemented!"); }

	async _pGetStoredPrereleaseBrewData ({brewUtil, isPrerelease, isBrew}) {
		const prereleaseBrew = await brewUtil.pGetBrewProcessed();
		return this.constructor._getAsRawPrefixed(prereleaseBrew, {propsRaw: this.constructor._PROPS_RAWABLE});
	}

	static _pGetDereferencedData_doNotifyFailed ({ent, uids, prop}) {
		const missingRefSets = {
			[prop]: new Set(uids),
		};

		_DataLoaderInternalUtil.doNotifyFailedDereferences({
			missingRefSets,
			diagnostics: [ent.__diagnostic].filter(Boolean),
		});
	}
}

class _DataTypeLoaderCustomClassesSubclass extends _DataTypeLoaderCustomRawable {
	static PROPS = ["raw_class", "raw_subclass", "class", "subclass"];
	static PAGE = UrlUtil.PG_CLASSES;

	// Note that this only loads these specific props, to avoid deadlock incurred by dereferencing class/subclass features
	static _PROPS_RAWABLE = ["class", "subclass"];

	async _pGetRawSiteData () { return DataUtil.class.loadRawJSON(); }

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
				if (source === Parser.SRC_5ETOOLS_TMP) return;

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

		this._pGetDereferencedData_doNotifyFailed({ent: clsOrSc, uids: notFoundUids, prop: propFeature});

		return byLevel;
	}

	async pGetPostCacheData ({siteData = null, prereleaseData = null, brewData = null, lockToken2}) {
		return {
			siteDataPostCache: await this._pGetPostCacheData_obj_withCache({obj: siteData, lockToken2, propCache: "site"}),
			prereleaseDataPostCache: await this._pGetPostCacheData_obj({obj: prereleaseData, lockToken2}),
			brewDataPostCache: await this._pGetPostCacheData_obj({obj: brewData, lockToken2}),
		};
	}
}

class _DataTypeLoaderCustomClassSubclassFeature extends _DataTypeLoader {
	static PROPS = ["raw_classFeature", "raw_subclassFeature", "classFeature", "subclassFeature"];
	static PAGE = UrlUtil.PG_CLASS_SUBCLASS_FEATURES;

	static _PROPS_RAWABLE = ["classFeature", "subclassFeature"];

	hasPhase2Cache = true;

	_getSiteIdent ({pageClean, sourceClean}) { return `${pageClean}__${this.constructor.name}`; }

	async _pGetSiteData ({pageClean, sourceClean}) {
		const json = await DataUtil.class.loadRawJSON();
		return this.constructor._getAsRawPrefixed(json, {propsRaw: this.constructor._PROPS_RAWABLE});
	}

	async _pGetStoredPrereleaseBrewData ({brewUtil, isPrerelease, isBrew}) {
		const prereleaseBrew = await brewUtil.pGetBrewProcessed();
		return this.constructor._getAsRawPrefixed(prereleaseBrew, {propsRaw: this.constructor._PROPS_RAWABLE});
	}

	async _pGetPostCacheData_obj ({obj, lockToken2}) {
		if (!obj) return null;

		const out = {};

		if (obj.raw_classFeature?.length) out.classFeature = (await _DataLoaderDereferencer.pGetDereferenced(obj.raw_classFeature, "classFeature"))?.classFeature || [];
		if (obj.raw_subclassFeature?.length) out.subclassFeature = (await _DataLoaderDereferencer.pGetDereferenced(obj.raw_subclassFeature, "subclassFeature"))?.subclassFeature || [];

		return out;
	}

	async pGetPostCacheData ({siteData = null, prereleaseData = null, brewData = null, lockToken2}) {
		return {
			siteDataPostCache: await this._pGetPostCacheData_obj_withCache({obj: siteData, lockToken2, propCache: "site"}),
			prereleaseDataPostCache: await this._pGetPostCacheData_obj({obj: prereleaseData, lockToken2}),
			brewDataPostCache: await this._pGetPostCacheData_obj({obj: brewData, lockToken2}),
		};
	}
}

class _DataTypeLoaderCustomItem extends _DataTypeLoader {
	static PROPS = [...UrlUtil.PAGE_TO_PROPS[UrlUtil.PG_ITEMS]];
	static PAGE = UrlUtil.PG_ITEMS;

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

	async _pGetStoredPrereleaseBrewData ({brewUtil, isPrerelease, isBrew}) {
		const prereleaseBrew = await brewUtil.pGetBrewProcessed();

		return {
			item: await Renderer.item.pGetSiteUnresolvedRefItemsFromPrereleaseBrew({brewUtil, brew: prereleaseBrew}),
			itemEntry: prereleaseBrew.itemEntry || [],
		};
	}

	async _pGetPostCacheData_obj ({siteData, obj, lockToken2}) {
		if (!obj) return null;

		const out = {};

		if (obj.item?.length) {
			out.item = (await _DataLoaderDereferencer.pGetDereferenced(obj.item, "item", {propEntries: "entries", propIsRef: "hasRefs"}))?.item || [];
			out.item = (await _DataLoaderDereferencer.pGetDereferenced(out.item, "item", {propEntries: "_fullEntries", propIsRef: "hasRefs"}))?.item || [];
		}

		return out;
	}

	async pGetPostCacheData ({siteData = null, prereleaseData = null, brewData = null, lockToken2}) {
		return {
			siteDataPostCache: await this._pGetPostCacheData_obj_withCache({obj: siteData, lockToken2, propCache: "site"}),
			prereleaseDataPostCache: await this._pGetPostCacheData_obj({obj: prereleaseData, lockToken2}),
			brewDataPostCache: await this._pGetPostCacheData_obj({obj: brewData, lockToken2}),
		};
	}
}

class _DataTypeLoaderCustomCard extends _DataTypeLoader {
	static PROPS = ["card"];
	static PAGE = UrlUtil.PG_DECKS;

	_getSiteIdent ({pageClean, sourceClean}) { return `${pageClean}__${this.constructor.name}`; }

	async _pGetSiteData ({pageClean, sourceClean}) {
		const json = await DataUtil.deck.loadRawJSON();
		return {card: json.card};
	}
}

class _DataTypeLoaderCustomDeck extends _DataTypeLoaderCustomRawable {
	static PROPS = ["raw_deck", "deck"];
	static PAGE = UrlUtil.PG_DECKS;

	static _PROPS_RAWABLE = ["deck"];

	async _pGetRawSiteData () { return DataUtil.deck.loadRawJSON(); }

	async _pGetPostCacheData_obj ({obj, lockToken2}) {
		if (!obj) return null;

		const out = {};

		if (obj.raw_deck?.length) out.deck = await obj.raw_deck.pSerialAwaitMap(ent => this.constructor._pGetDereferencedDeckData(ent, {lockToken2}));

		return out;
	}

	static async _pGetDereferencedDeckData (deck, {lockToken2}) {
		deck = MiscUtil.copyFast(deck);

		deck.cards = await this._pGetDereferencedCardData(deck, {lockToken2});

		return deck;
	}

	static async _pGetDereferencedCardData (deck, {lockToken2}) {
		const notFoundUids = [];

		const out = (await (deck.cards || [])
			.pSerialAwaitMap(async cardMeta => {
				const uid = typeof cardMeta === "string" ? cardMeta : cardMeta.uid;
				const count = typeof cardMeta === "string" ? 1 : cardMeta.count ?? 1;
				const isReplacement = typeof cardMeta === "string" ? false : cardMeta.replacement ?? false;

				const unpackedUid = DataUtil.deck.unpackUidCard(uid);
				const {source} = unpackedUid;

				// Skip over broken links
				if (unpackedUid.name == null || unpackedUid.set == null || unpackedUid.source == null) return;

				const hash = UrlUtil.URL_TO_HASH_BUILDER["card"](unpackedUid);

				// Skip blocklisted
				if (ExcludeUtil.isInitialised && ExcludeUtil.isExcluded(hash, "card", source, {isNoCount: true})) return;

				const card = await DataLoader.pCacheAndGet("card", source, hash, {isCopy: true, lockToken2});
				// Skip over missing links
				if (!card) return notFoundUids.push(uid);

				if (deck.otherSources && deck.source === card.source) card.otherSources = MiscUtil.copyFast(deck.otherSources);
				if (isReplacement) card._isReplacement = true;

				return [...new Array(count)].map(() => MiscUtil.copyFast(card));
			}))
			.flat()
			.filter(Boolean);

		this._pGetDereferencedData_doNotifyFailed({ent: deck, uids: notFoundUids, prop: "card"});

		return out;
	}

	async pGetPostCacheData ({siteData = null, prereleaseData = null, brewData = null, lockToken2}) {
		return {
			siteDataPostCache: await this._pGetPostCacheData_obj_withCache({obj: siteData, lockToken2, propCache: "site"}),
			prereleaseDataPostCache: await this._pGetPostCacheData_obj({obj: prereleaseData, lockToken2}),
			brewDataPostCache: await this._pGetPostCacheData_obj({obj: brewData, lockToken2}),
		};
	}
}

class _DataTypeLoaderCustomQuickref extends _DataTypeLoader {
	static PROPS = ["reference", "referenceData"];
	static PAGE = UrlUtil.PG_QUICKREF;

	_getSiteIdent ({pageClean, sourceClean}) { return this.constructor.name; }

	_isPrereleaseAvailable () { return false; }

	_isBrewAvailable () { return false; }

	async _pGetSiteData ({pageClean, sourceClean}) {
		const json = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/generated/bookref-quick.json`);
		return {
			reference: json.reference["bookref-quick"],
			referenceData: json.data["bookref-quick"],
		};
	}

	hasCustomCacheStrategy ({obj}) { return this.constructor.PROPS.some(prop => obj[prop]?.length); }

	addToCacheCustom ({cache, obj}) {
		obj.referenceData.forEach((chapter, ixChapter) => this._addToCacheCustom_chapter({cache, chapter, ixChapter}));
		return [...this.constructor.PROPS];
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
	_filename;

	_getSiteIdent ({pageClean, sourceClean}) { return `${pageClean}__${sourceClean}`; }

	hasCustomCacheStrategy ({obj}) { return this.constructor.PROPS.some(prop => obj[prop]?.length); }

	addToCacheCustom ({cache, obj}) {
		const [prop, propData] = this.constructor.PROPS;

		// Get only the ids that exist in both data + contents
		const dataIds = (obj[propData] || []).filter(it => it.id).map(it => it.id);
		const contentsIds = new Set((obj[prop] || []).filter(it => it.id).map(it => it.id));
		const matchingIds = dataIds.filter(id => contentsIds.has(id));

		matchingIds.forEach(id => {
			const data = (obj[propData] || []).find(it => it.id === id);
			const contents = (obj[prop] || []).find(it => it.id === id);

			const hash = UrlUtil.URL_TO_HASH_BUILDER[this.constructor.PAGE](contents);
			this._addImageBackReferences(data, this.constructor.PAGE, contents.source, hash);

			const {page: pageClean, source: sourceClean, hash: hashClean} = _DataLoaderInternalUtil.getCleanPageSourceHash({
				page: this.constructor.PAGE,
				source: contents.source,
				hash,
			});

			const pack = {
				[prop]: contents,
				[propData]: data,
			};

			cache.set(pageClean, sourceClean, hashClean, pack);
		});

		return [prop, propData];
	}

	async _pGetSiteData ({pageClean, sourceClean}) {
		const [prop, propData] = this.constructor.PROPS;

		const index = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/${this._filename}`);
		const contents = index[prop].find(contents => _DataLoaderInternalUtil.getCleanSource({source: contents.source}) === sourceClean);

		if (!contents) return {};

		const json = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/${prop}/${prop}-${UrlUtil.encodeForHash(contents.id.toLowerCase())}.json`);

		return {
			[prop]: [contents],
			[propData]: [
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
	static PROPS = ["adventure", "adventureData"];
	static PAGE = UrlUtil.PG_ADVENTURE;

	_filename = "adventures.json";
}

class _DataTypeLoaderCustomBook extends _DataTypeLoaderCustomAdventureBook {
	static PROPS = ["book", "bookData"];
	static PAGE = UrlUtil.PG_BOOK;

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
		"deck": UrlUtil.PG_DECKS,
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

	static _registerDataTypeLoader ({loader, props, page, isFluff}) {
		this._DATA_TYPE_LOADER_LIST.push(loader);

		if (!props?.length) throw new Error(`No "props" specified for loader "${loader.constructor.name}"!`);

		props.forEach(prop => this._DATA_TYPE_LOADERS[_DataLoaderInternalUtil.getCleanPage({page: prop})] = loader);

		if (!page) return;

		this._DATA_TYPE_LOADERS[
			isFluff
				? _DataLoaderInternalUtil.getCleanPageFluff({page})
				: _DataLoaderInternalUtil.getCleanPage({page})
		] = loader;
	}

	static _registerDataTypeLoaders () {
		const fnRegister = this._registerDataTypeLoader.bind(this);

		// region Multi-file
		_DataTypeLoaderCustomMonster.register({fnRegister});
		_DataTypeLoaderCustomMonsterFluff.register({fnRegister});
		_DataTypeLoaderCustomSpell.register({fnRegister});
		_DataTypeLoaderCustomSpellFluff.register({fnRegister});
		// endregion

		// region Predefined
		_DataTypeLoaderRace.register({fnRegister});
		_DataTypeLoaderDeity.register({fnRegister});
		_DataTypeLoaderVariantrule.register({fnRegister});
		_DataTypeLoaderTable.register({fnRegister});
		_DataTypeLoaderLanguage.register({fnRegister});
		_DataTypeLoaderRecipe.register({fnRegister});
		// endregion

		// region Special
		_DataTypeLoaderCustomClassesSubclass.register({fnRegister});
		_DataTypeLoaderCustomClassSubclassFeature.register({fnRegister});
		_DataTypeLoaderCustomItem.register({fnRegister});
		_DataTypeLoaderCustomCard.register({fnRegister});
		_DataTypeLoaderCustomDeck.register({fnRegister});
		_DataTypeLoaderCustomQuickref.register({fnRegister});
		_DataTypeLoaderCustomAdventure.register({fnRegister});
		_DataTypeLoaderCustomBook.register({fnRegister});
		// endregion

		// region Single file
		_DataTypeLoaderBackground.register({fnRegister});
		_DataTypeLoaderPsionic.register({fnRegister});
		_DataTypeLoaderObject.register({fnRegister});
		_DataTypeLoaderAction.register({fnRegister});
		_DataTypeLoaderFeat.register({fnRegister});
		_DataTypeLoaderOptionalfeature.register({fnRegister});
		_DataTypeLoaderReward.register({fnRegister});
		_DataTypeLoaderCharoption.register({fnRegister});

		_DataTypeLoaderTrapHazard.register({fnRegister});
		_DataTypeLoaderCultBoon.register({fnRegister});
		_DataTypeLoaderVehicle.register({fnRegister});

		_DataTypeLoaderConditionDisease.register({fnRegister});

		_DataTypeLoaderSkill.register({fnRegister});
		_DataTypeLoaderSense.register({fnRegister});
		_DataTypeLoaderLegendaryGroup.register({fnRegister});
		_DataTypeLoaderItemEntry.register({fnRegister});
		_DataTypeLoaderItemMastery.register({fnRegister});
		// endregion

		// region Fluff
		_DataTypeLoaderBackgroundFluff.register({fnRegister});
		_DataTypeLoaderFeatFluff.register({fnRegister});
		_DataTypeLoaderItemFluff.register({fnRegister});
		_DataTypeLoaderRaceFluff.register({fnRegister});
		_DataTypeLoaderLanguageFluff.register({fnRegister});
		_DataTypeLoaderVehicleFluff.register({fnRegister});
		_DataTypeLoaderObjectFluff.register({fnRegister});
		_DataTypeLoaderCharoptionFluff.register({fnRegister});
		_DataTypeLoaderRecipeFluff.register({fnRegister});

		_DataTypeLoaderConditionDiseaseFluff.register({fnRegister});
		// endregion
	}

	static _ = this._init();

	static _CACHE = new _DataLoaderCache();
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

	static async pCacheAndGetAllPrerelease (page, {isSilent = false} = {}) {
		return this._CacheAndGetAllPrerelease.pCacheAndGetAll({parent: this, page, isSilent});
	}

	static async pCacheAndGetAllBrew (page, {isSilent = false} = {}) {
		return this._CacheAndGetAllBrew.pCacheAndGetAll({parent: this, page, isSilent});
	}

	static _CacheAndGetAllPrereleaseBrew = class {
		static _SOURCE_ALL;
		static _PROP_DATA;

		static async pCacheAndGetAll (
			{
				parent,
				page,
				isSilent,
			},
		) {
			const pageClean = _DataLoaderInternalUtil.getCleanPage({page});

			if (parent._PAGES_NO_CONTENT.has(pageClean)) return null;

			const dataLoader = parent._pCache_getDataTypeLoader({pageClean, isSilent});
			if (!dataLoader) return null;

			// (Avoid preloading missing prerelease/homebrew here, as we only return currently-loaded prerelease/homebrew.)

			const cacheMeta = await parent._pCacheAndGet_getCacheMeta({pageClean, sourceClean: this._SOURCE_ALL, dataLoader});
			await parent._pCacheAndGet_processCacheMeta({dataLoader, [this._PROP_DATA]: cacheMeta[this._PROP_DATA]});

			return this._getAllCached({parent, pageClean});
		}

		/** @abstract */
		static _getAllCached ({parent, pageClean}) { throw new Error("Unimplemented!"); }
	};

	static _CacheAndGetAllPrerelease = class extends this._CacheAndGetAllPrereleaseBrew {
		static _SOURCE_ALL = _DataLoaderConst.SOURCE_PRERELEASE_ALL_CURRENT;
		static _PROP_DATA = "prereleaseData";

		static _getAllCached ({parent, pageClean}) { return parent._CACHE.getAllPrerelease(pageClean); }
	};

	static _CacheAndGetAllBrew = class extends this._CacheAndGetAllPrereleaseBrew {
		static _SOURCE_ALL = _DataLoaderConst.SOURCE_BREW_ALL_CURRENT;
		static _PROP_DATA = "brewData";

		static _getAllCached ({parent, pageClean}) { return parent._CACHE.getAllBrew(pageClean); }
	};

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

		const isUnavailablePrerelease = await this._PrereleasePreloader._pPreloadMissing({parent: this, sourceClean});
		if (isUnavailablePrerelease) return this._getVerifiedRequiredEntity({pageClean, sourceClean, hashClean, ent: null, isRequired});

		const isUnavailableBrew = await this._BrewPreloader._pPreloadMissing({parent: this, sourceClean});
		if (isUnavailableBrew) return this._getVerifiedRequiredEntity({pageClean, sourceClean, hashClean, ent: null, isRequired});

		const {siteData = null, prereleaseData = null, brewData = null} = await this._pCacheAndGet_getCacheMeta({pageClean, sourceClean, dataLoader});
		await this._pCacheAndGet_processCacheMeta({dataLoader, siteData, prereleaseData, brewData, lockToken2});

		return this.getFromCache(page, source, hash, {isCopy, _isInsertSentinelOnMiss: true});
	}

	static async pCacheAndGetHash (page, hash, opts) {
		const source = UrlUtil.decodeHash(hash).last();
		return DataLoader.pCacheAndGet(page, source, hash, opts);
	}

	static _PrereleaseBrewPreloader = class {
		static _LOCK_0;
		static _SOURCES_ATTEMPTED;
		/** Cache of clean (lowercase) source -> URL. */
		static _CACHE_SOURCE_CLEAN_TO_URL;
		static _SOURCE_ALL;

		/**
		 * Phase 0: check if prerelease/homebrew, and if so, check/load the source (if available).
		 *   Track failures (i.e., there is no available JSON for the source requested), and skip repeated failures.
		 *   This allows us to avoid an expensive mass re-cache, if a source which does not exist is requested for
		 *   loading multiple times.
		 */
		static async pPreloadMissing ({parent, sourceClean}) {
			try {
				await this._LOCK_0.pLock();
				return (await this._pPreloadMissing({parent, sourceClean}));
			} finally {
				this._LOCK_0.unlock();
			}
		}

		/**
		 * @param parent
		 * @param sourceClean
		 * @return {Promise<boolean>} `true` if the source does not exist and could not be loaded, false otherwise.
		 */
		static async _pPreloadMissing ({parent, sourceClean}) {
			if (this._isExistingMiss({parent, sourceClean})) return true;

			if (!this._isPossibleSource({parent, sourceClean})) return false;
			if (sourceClean === this._SOURCE_ALL) return false;

			const brewUtil = this._getBrewUtil();
			if (!brewUtil) {
				this._setExistingMiss({parent, sourceClean});
				return true;
			}

			if (brewUtil.hasSourceJson(sourceClean)) return false;

			const urlBrew = await this._pGetSourceUrl({parent, sourceClean});
			if (!urlBrew) {
				this._setExistingMiss({parent, sourceClean});
				return true;
			}

			await brewUtil.pAddBrewFromUrl(urlBrew);
			return false;
		}

		static _isExistingMiss ({sourceClean}) {
			return this._SOURCES_ATTEMPTED.has(sourceClean);
		}

		static _setExistingMiss ({sourceClean}) {
			this._SOURCES_ATTEMPTED.add(sourceClean);
		}

		/* -------------------------------------------- */

		static async _pInitCacheSourceToUrl () {
			if (this._CACHE_SOURCE_CLEAN_TO_URL) return;

			const index = await this._pGetUrlIndex();
			if (!index) return this._CACHE_SOURCE_CLEAN_TO_URL = {};

			const brewUtil = this._getBrewUtil();
			const urlRoot = await brewUtil.pGetCustomUrl();

			this._CACHE_SOURCE_CLEAN_TO_URL = Object.entries(index)
				.mergeMap(([src, url]) => ({[_DataLoaderInternalUtil.getCleanSource({source: src})]: brewUtil.getFileUrl(url, urlRoot)}));
		}

		static async _pGetUrlIndex () {
			try {
				return (await this._pGetSourceIndex());
			} catch (e) {
				setTimeout(() => { throw e; });
				return null;
			}
		}

		static async _pGetSourceUrl ({sourceClean}) {
			await this._pInitCacheSourceToUrl();
			return this._CACHE_SOURCE_CLEAN_TO_URL[sourceClean];
		}

		/** @abstract */
		static _isPossibleSource ({parent, sourceClean}) { throw new Error("Unimplemented!"); }
		/** @abstract */
		static _getBrewUtil () { throw new Error("Unimplemented!"); }
		/** @abstract */
		static _pGetSourceIndex () { throw new Error("Unimplemented!"); }
	};

	static _PrereleasePreloader = class extends this._PrereleaseBrewPreloader {
		static _LOCK_0 = new VeLock({isDbg: false, name: "loader-lock-0--prerelease"});
		static _SOURCE_ALL = _DataLoaderConst.SOURCE_BREW_ALL_CURRENT;
		static _SOURCES_ATTEMPTED = new Set();
		static _CACHE_SOURCE_CLEAN_TO_URL = null;

		static _isPossibleSource ({parent, sourceClean}) { return parent._isPrereleaseSource({sourceClean}) && !Parser.SOURCE_JSON_TO_FULL[Parser.sourceJsonToJson(sourceClean)]; }
		static _getBrewUtil () { return typeof PrereleaseUtil !== "undefined" ? PrereleaseUtil : null; }
		static _pGetSourceIndex () { return DataUtil.prerelease.pLoadSourceIndex(); }
	};

	static _BrewPreloader = class extends this._PrereleaseBrewPreloader {
		static _LOCK_0 = new VeLock({isDbg: false, name: "loader-lock-0--brew"});
		static _SOURCE_ALL = _DataLoaderConst.SOURCE_PRERELEASE_ALL_CURRENT;
		static _SOURCES_ATTEMPTED = new Set();
		static _CACHE_SOURCE_CLEAN_TO_URL = null;

		static _isPossibleSource ({parent, sourceClean}) { return !parent._isSiteSource({sourceClean}) && !parent._isPrereleaseSource({sourceClean}); }
		static _getBrewUtil () { return typeof BrewUtil2 !== "undefined" ? BrewUtil2 : null; }
		static _pGetSourceIndex () { return DataUtil.brew.pLoadSourceIndex(); }
	};

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
		this._pCache_addToCache({allDataMerged: siteData, propAllowlist: dataLoader.phase1CachePropAllowlist || new Set(dataLoader.constructor.PROPS)});
		// Always early-exit, regardless of whether the entity was found in the cache, if we know this is a site source
		if (this._isSiteSource({sourceClean})) return {siteData};
		// endregion

		const out = {siteData};

		// region Fetch from already-stored prerelease/brew data
		//   As we have preloaded missing prerelease/brew earlier in the flow, we know that a prerelease/brew is either
		//   present, or unavailable
		if (typeof PrereleaseUtil !== "undefined") {
			const prereleaseData = await dataLoader.pGetStoredPrereleaseData();
			this._pCache_addToCache({allDataMerged: prereleaseData, propAllowlist: dataLoader.phase1CachePropAllowlist || new Set(dataLoader.constructor.PROPS)});
			out.prereleaseData = prereleaseData;
		}

		if (typeof BrewUtil2 !== "undefined") {
			const brewData = await dataLoader.pGetStoredBrewData();
			this._pCache_addToCache({allDataMerged: brewData, propAllowlist: dataLoader.phase1CachePropAllowlist || new Set(dataLoader.constructor.PROPS)});
			out.brewData = brewData;
		}
		// endregion

		return out;
	}

	static async _pCacheAndGet_processCacheMeta ({dataLoader, siteData = null, prereleaseData = null, brewData = null, lockToken2 = null}) {
		if (!dataLoader.hasPhase2Cache) return;

		try {
			lockToken2 = await this._LOCK_2.pLock({token: lockToken2});
			await this._pCacheAndGet_processCacheMeta_({dataLoader, siteData, prereleaseData, brewData, lockToken2});
		} finally {
			this._LOCK_2.unlock();
		}
	}

	static async _pCacheAndGet_processCacheMeta_ ({dataLoader, siteData = null, prereleaseData = null, brewData = null, lockToken2 = null}) {
		const {siteDataPostCache, prereleaseDataPostCache, brewDataPostCache} = await dataLoader.pGetPostCacheData({siteData, prereleaseData, brewData, lockToken2});

		this._pCache_addToCache({allDataMerged: siteDataPostCache, propAllowlist: dataLoader.phase2CachePropAllowlist || new Set(dataLoader.constructor.PROPS)});
		this._pCache_addToCache({allDataMerged: prereleaseDataPostCache, propAllowlist: dataLoader.phase2CachePropAllowlist || new Set(dataLoader.constructor.PROPS)});
		this._pCache_addToCache({allDataMerged: brewDataPostCache, propAllowlist: dataLoader.phase2CachePropAllowlist || new Set(dataLoader.constructor.PROPS)});
	}

	static _pCache_getDataTypeLoader ({pageClean, isSilent}) {
		const dataLoader = this._DATA_TYPE_LOADERS[pageClean];
		if (!dataLoader && !isSilent) throw new Error(`No loading strategy found for page "${pageClean}"!`);
		return dataLoader;
	}

	static _pCache_addToCache ({allDataMerged, propAllowlist}) {
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
				if (!propAllowlist.has(prop)) return;

				const arr = allDataMerged[prop];
				if (!arr?.length || !(arr instanceof Array)) return;

				const hashBuilder = UrlUtil.URL_TO_HASH_BUILDER[prop];
				if (!hashBuilder) return;

				arr.forEach(ent => {
					this._pCache_addEntityToCache({prop, hashBuilder, ent});
					DataUtil.proxy.getVersions(prop, ent)
						.forEach(entVer => this._pCache_addEntityToCache({prop, hashBuilder, ent: entVer}));
				});
			});
	}

	static _pCache_addEntityToCache ({prop, hashBuilder, ent}) {
		ent.__prop = ent.__prop || prop;

		const page = this._PROP_TO_HASH_PAGE[prop];
		const source = SourceUtil.getEntitySource(ent);
		const hash = hashBuilder(ent);

		const {page: propClean, source: sourceClean, hash: hashClean} = _DataLoaderInternalUtil.getCleanPageSourceHash({page: prop, source, hash});
		const pageClean = page ? _DataLoaderInternalUtil.getCleanPage({page}) : null;

		this._CACHE.set(propClean, sourceClean, hashClean, ent);
		if (pageClean) this._CACHE.set(pageClean, sourceClean, hashClean, ent);
	}

	/* -------------------------------------------- */

	static _CACHE_SITE_SOURCE_CLEAN = null;

	static _doBuildSourceCaches () {
		this._CACHE_SITE_SOURCE_CLEAN = this._CACHE_SITE_SOURCE_CLEAN || new Set(Object.keys(Parser.SOURCE_JSON_TO_FULL)
			.map(src => _DataLoaderInternalUtil.getCleanSource({source: src})));
	}

	static _isSiteSource ({sourceClean}) {
		if (sourceClean === _DataLoaderConst.SOURCE_SITE_ALL) return true;
		if (sourceClean === _DataLoaderConst.SOURCE_BREW_ALL_CURRENT) return false;
		if (sourceClean === _DataLoaderConst.SOURCE_PRERELEASE_ALL_CURRENT) return false;

		this._doBuildSourceCaches();

		return this._CACHE_SITE_SOURCE_CLEAN.has(sourceClean);
	}

	static _isPrereleaseSource ({sourceClean}) {
		if (sourceClean === _DataLoaderConst.SOURCE_SITE_ALL) return false;
		if (sourceClean === _DataLoaderConst.SOURCE_BREW_ALL_CURRENT) return false;
		if (sourceClean === _DataLoaderConst.SOURCE_PRERELEASE_ALL_CURRENT) return true;

		this._doBuildSourceCaches();

		return sourceClean.startsWith(_DataLoaderInternalUtil.getCleanSource({source: Parser.SRC_UA_PREFIX}))
			|| sourceClean.startsWith(_DataLoaderInternalUtil.getCleanSource({source: Parser.SRC_UA_ONE_PREFIX}));
	}

	/* -------------------------------------------- */

	static getDiagnosticsSummary (diagnostics) {
		diagnostics = diagnostics.filter(Boolean);
		if (!diagnostics.length) return "";

		const filenames = diagnostics
			.map(it => it.filename)
			.filter(Boolean)
			.unique()
			.sort(SortUtil.ascSortLower);

		if (!filenames.length) return "";

		return `Filename${filenames.length === 1 ? " was" : "s were"}: ${filenames.map(it => `"${it}"`).join("; ")}.`;
	}
}

// endregion

/* -------------------------------------------- */

// region Exports

globalThis.DataLoader = DataLoader;

// endregion
