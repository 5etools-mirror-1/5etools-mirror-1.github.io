"use strict";

class _BrewInternalUtil {
	static SOURCE_UNKNOWN_FULL = "(Unknown)";
	static SOURCE_UNKNOWN_ABBREVIATION = "(UNK)";
}

class BrewDoc {
	constructor (opts) {
		opts = opts || {};
		this.head = opts.head;
		this.body = opts.body;
	}

	toObject () { return MiscUtil.copyFast({...this}); }

	static fromValues ({head, body}) {
		return new this({
			head: BrewDocHead.fromValues(head),
			body,
		});
	}

	static fromObject (obj, opts = {}) {
		const {isCopy = false} = opts;
		return new this({
			head: BrewDocHead.fromObject(obj.head, opts),
			body: isCopy ? MiscUtil.copyFast(obj.body) : obj.body,
		});
	}

	mutUpdate ({json}) {
		this.body = json;
		this.head.mutUpdate({json, body: this.body});
		return this;
	}

	// region Conditions
	static isOperationPermitted_moveToEditable ({brew, isAllowLocal = false} = {}) {
		return !brew.head.isEditable
			&& (isAllowLocal || !brew.head.isLocal);
	}
	// endregion

	// region Merging
	mutMerge ({json, isLazy = false}) {
		this.body = this.constructor.mergeObjects({isCopy: !isLazy, isMutMakeCompatible: false}, this.body, json);
		this.head.mutMerge({json, body: this.body, isLazy});
		return this;
	}

	static mergeObjects ({isCopy = true, isMutMakeCompatible = true} = {}, ...jsons) {
		const out = {};

		jsons.forEach(json => {
			json = isCopy ? MiscUtil.copyFast(json) : json;

			if (isMutMakeCompatible) this._mergeObjects_mutMakeCompatible(json);

			Object.entries(json)
				.forEach(([prop, val]) => {
					switch (prop) {
						case "_meta": return this._mergeObjects_key__meta({out, prop, val});
						default: return this._mergeObjects_default({out, prop, val});
					}
				});
		});

		return out;
	}

	static _META_KEYS_MERGEABLE_OBJECTS = [
		"skills",
		"senses",
		"spellSchools",
		"spellDistanceUnits",
		"optionalFeatureTypes",
		"psionicTypes",
		"currencyConversions",
	];

	static _META_KEYS_MERGEABLE_SPECIAL = {
		"dateAdded": (a, b) => a != null && b != null ? Math.min(a, b) : a ?? b,
		"dateLastModified": (a, b) => a != null && b != null ? Math.max(a, b) : a ?? b,

		"dependencies": (a, b) => this._metaMerge_dependenciesIncludes(a, b),
		"includes": (a, b) => this._metaMerge_dependenciesIncludes(a, b),
		"internalCopies": (a, b) => [...(a || []), ...(b || [])].unique(),

		"otherSources": (a, b) => this._metaMerge_otherSources(a, b),

		"status": (a, b) => this._metaMerge_status(a, b),
	};

	static _metaMerge_dependenciesIncludes (a, b) {
		if (a != null && b != null) {
			Object.entries(b)
				.forEach(([prop, arr]) => a[prop] = [...(a[prop] || []), ...arr].unique());
			return a;
		}

		return a ?? b;
	}

	static _metaMerge_otherSources (a, b) {
		if (a != null && b != null) {
			// Note that this can clobber the values in the mapping, but we don't really care since they're not used.
			Object.entries(b)
				.forEach(([prop, obj]) => a[prop] = Object.assign(a[prop] || {}, obj));
			return a;
		}

		return a ?? b;
	}

	static _META_MERGE__STATUS_PRECEDENCE = [
		"invalid",
		"deprecated",
		"wip",
		"ready",
	];

	static _metaMerge_status (a, b) {
		return [a || "ready", b || "ready"]
			.sort((a, b) => this._META_MERGE__STATUS_PRECEDENCE.indexOf(a) - this._META_MERGE__STATUS_PRECEDENCE.indexOf(b))[0];
	}

	static _mergeObjects_key__meta ({out, val}) {
		out._meta = out._meta || {};

		out._meta.sources = [...(out._meta.sources || []), ...(val.sources || [])];

		Object.entries(val)
			.forEach(([metaProp, metaVal]) => {
				if (this._META_KEYS_MERGEABLE_SPECIAL[metaProp]) {
					out._meta[metaProp] = this._META_KEYS_MERGEABLE_SPECIAL[metaProp](out._meta[metaProp], metaVal);
					return;
				}
				if (!this._META_KEYS_MERGEABLE_OBJECTS.includes(metaProp)) return;
				Object.assign(out._meta[metaProp] = out._meta[metaProp] || {}, metaVal);
			});
	}

	static _mergeObjects_default ({out, prop, val}) {
		// If we cannot merge a prop, use the first value found for it, as a best-effort fallback
		if (!(val instanceof Array)) return out[prop] === undefined ? out[prop] = val : null;

		out[prop] = [...out[prop] || [], ...val];
	}

	static _mergeObjects_mutMakeCompatible (json) {
		// region Item
		if (json.variant) {
			// 2022-07-09
			json.magicvariant = json.variant;
			delete json.variant;
		}
		// endregion

		// region Race
		if (json.subrace) {
			json.subrace.forEach(sr => {
				if (!sr.race) return;
				sr.raceName = sr.race.name;
				sr.raceSource = sr.race.source || sr.source || Parser.SRC_PHB;
			});
		}
		// endregion

		// region Creature (monster)
		if (json.monster) {
			json.monster.forEach(mon => {
				// 2022-03-22
				if (typeof mon.size === "string") mon.size = [mon.size];

				// 2022=05-29
				if (mon.summonedBySpell && !mon.summonedBySpellLevel) mon.summonedBySpellLevel = 1;
			});
		}
		// endregion
	}
	// endregion
}

class BrewDocHead {
	constructor (opts) {
		opts = opts || {};

		this.docIdLocal = opts.docIdLocal;
		this.timeAdded = opts.timeAdded;
		this.checksum = opts.checksum;
		this.url = opts.url;
		this.filename = opts.filename;
		this.isLocal = opts.isLocal;
		this.isEditable = opts.isEditable;
	}

	toObject () { return MiscUtil.copyFast({...this}); }

	static fromValues (
		{
			json,
			url = null,
			filename = null,
			isLocal = false,
			isEditable = false,
		},
	) {
		return new this({
			docIdLocal: CryptUtil.uid(),
			timeAdded: Date.now(),
			checksum: CryptUtil.md5(JSON.stringify(json)),
			url: url,
			filename: filename,
			isLocal: isLocal,
			isEditable: isEditable,
		});
	}

	static fromObject (obj, {isCopy = false} = {}) {
		return new this(isCopy ? MiscUtil.copyFast(obj) : obj);
	}

	mutUpdate ({json}) {
		this.checksum = CryptUtil.md5(JSON.stringify(json));
		return this;
	}

	mutMerge ({json, body, isLazy}) {
		if (!isLazy) this.checksum = CryptUtil.md5(JSON.stringify(body ?? json));
		return this;
	}
}

class BrewUtilShared {
	/** Prevent any injection shenanigans */
	static getValidColor (color, {isExtended = false} = {}) {
		if (isExtended) return color.replace(/[^-a-zA-Z\d]/g, "");
		return color.replace(/[^a-fA-F\d]/g, "").slice(0, 8);
	}
}

globalThis.BrewUtilShared = BrewUtilShared;

class _BrewUtil2Base {
	_STORAGE_KEY_LEGACY;
	_STORAGE_KEY_LEGACY_META;

	// Keep these distinct from the OG brew key, so users can recover their old brew if required.
	_STORAGE_KEY;
	_STORAGE_KEY_META;

	_STORAGE_KEY_CUSTOM_URL;
	_STORAGE_KEY_MIGRATION_VERSION;

	_VERSION;

	_PATH_LOCAL_DIR;
	_PATH_LOCAL_INDEX;

	IS_EDITABLE;
	PAGE_MANAGE;
	URL_REPO_DEFAULT;
	DISPLAY_NAME;
	DISPLAY_NAME_PLURAL;
	DEFAULT_AUTHOR;
	STYLE_BTN;

	_LOCK = new VeLock();

	_cache_iteration = 0;
	_cache_brewsProc = null;
	_cache_metas = null;
	_cache_brewsLocal = null;

	_isDirty = false;

	_brewsTemp = [];
	_addLazy_brewsTemp = [];

	_storage = StorageUtil;

	/* -------------------------------------------- */

	_isInit = false;

	async pInit () {
		if (this._isInit) return;
		this._isInit = true;

		// region Ensure the local homebrew cache is hot, to allow us to fetch from it later in a sync manner.
		//   This is necessary to replicate the "meta" caching done for non-local brew.
		await this._pGetBrew_pGetLocalBrew();
		// endregion

		this._pInit_doBindDragDrop();
	}

	/** @abstract */
	_pInit_doBindDragDrop () { throw new Error("Unimplemented!"); }

	/* -------------------------------------------- */

	async pGetCustomUrl () { return this._storage.pGet(this._STORAGE_KEY_CUSTOM_URL); }

	async pSetCustomUrl (val) {
		return !val
			? this._storage.pRemove(this._STORAGE_KEY_CUSTOM_URL)
			: this._storage.pSet(this._STORAGE_KEY_CUSTOM_URL, val);
	}

	/* -------------------------------------------- */

	isReloadRequired () { return this._isDirty; }

	_getBrewMetas () {
		return [
			...(this._storage.syncGet(this._STORAGE_KEY_META) || []),
			...(this._cache_brewsLocal || []).map(brew => this._getBrewDocReduced(brew)),
		];
	}

	_setBrewMetas (val) {
		this._cache_metas = null;
		return this._storage.syncSet(this._STORAGE_KEY_META, val);
	}

	/** Fetch the brew as though it has been loaded from site URL. */
	async pGetBrewProcessed () {
		if (this._cache_brewsProc) return this._cache_brewsProc; // Short-circuit if the cache is already available

		try {
			const lockToken = await this._LOCK.pLock();
			await this._pGetBrewProcessed_({lockToken});
		} catch (e) {
			setTimeout(() => { throw e; });
		} finally {
			this._LOCK.unlock();
		}
		return this._cache_brewsProc;
	}

	async _pGetBrewProcessed_ ({lockToken}) {
		const cpyBrews = MiscUtil.copyFast([
			...await this.pGetBrew({lockToken}),
			...this._brewsTemp,
		]);
		if (!cpyBrews.length) return this._cache_brewsProc = {};

		await this._pGetBrewProcessed_pDoBlocklistExtension({cpyBrews});

		// Avoid caching the meta merge, as we have our own cache. We might edit the brew, so we don't want a stale copy.
		const cpyBrewsLoaded = await cpyBrews.pSerialAwaitMap(async ({head, body}) => {
			const cpyBrew = await DataUtil.pDoMetaMerge(head.url || head.docIdLocal, body, {isSkipMetaMergeCache: true});
			this._pGetBrewProcessed_mutDiagnostics({head, cpyBrew});
			return cpyBrew;
		});

		this._cache_brewsProc = this._pGetBrewProcessed_getMergedOutput({cpyBrewsLoaded});
		return this._cache_brewsProc;
	}

	/** Homebrew files can contain embedded blocklists. */
	async _pGetBrewProcessed_pDoBlocklistExtension ({cpyBrews}) {
		for (const {body} of cpyBrews) {
			if (!body?.blocklist?.length || !(body.blocklist instanceof Array)) continue;
			await ExcludeUtil.pExtendList(body.blocklist);
		}
	}

	_pGetBrewProcessed_mutDiagnostics ({head, cpyBrew}) {
		if (!head.filename) return;

		for (const arr of Object.values(cpyBrew)) {
			if (!(arr instanceof Array)) continue;
			for (const ent of arr) {
				if (!("__prop" in ent)) break;
				ent.__diagnostic = {filename: head.filename};
			}
		}
	}

	_pGetBrewProcessed_getMergedOutput ({cpyBrewsLoaded}) {
		return BrewDoc.mergeObjects(undefined, ...cpyBrewsLoaded);
	}

	/**
	 * TODO refactor such that this is not necessary
	 * @deprecated
	 */
	getBrewProcessedFromCache (prop) {
		return this._cache_brewsProc?.[prop] || [];
	}

	/* -------------------------------------------- */

	/** Fetch the raw brew from storage. */
	async pGetBrew ({lockToken} = {}) {
		try {
			lockToken = await this._LOCK.pLock({token: lockToken});

			const out = [
				...(await this._pGetBrewRaw({lockToken})),
				...(await this._pGetBrew_pGetLocalBrew({lockToken})),
			];

			return out
				// Ensure no brews which lack sources are loaded
				.filter(brew => brew?.body?._meta?.sources?.length);
		} finally {
			this._LOCK.unlock();
		}
	}

	/* -------------------------------------------- */

	async _pGetBrew_pGetLocalBrew ({lockToken} = {}) {
		if (this._cache_brewsLocal) return this._cache_brewsLocal;
		if (IS_VTT || IS_DEPLOYED || typeof window === "undefined") return this._cache_brewsLocal = [];

		try {
			await this._LOCK.pLock({token: lockToken});
			return (await this._pGetBrew_pGetLocalBrew_());
		} finally {
			this._LOCK.unlock();
		}
	}

	async _pGetBrew_pGetLocalBrew_ () {
		// auto-load from `prerelease/` and `homebrew/`, for custom versions of the site
		const indexLocal = await DataUtil.loadJSON(`${Renderer.get().baseUrl}${this._PATH_LOCAL_INDEX}`);
		if (!indexLocal?.toImport?.length) return this._cache_brewsLocal = [];

		const out = await indexLocal.toImport.pMap(async name => {
			name = `${name}`.trim();
			const url = /^https?:\/\//.test(name) ? name : `${Renderer.get().baseUrl}${this._PATH_LOCAL_DIR}/${name}`;
			const filename = UrlUtil.getFilename(url);
			try {
				const json = await DataUtil.loadRawJSON(url);
				return this._getBrewDoc({json, url, filename, isLocal: true});
			} catch (e) {
				JqueryUtil.doToast({type: "danger", content: `Failed to load local homebrew from URL "${url}"! ${VeCt.STR_SEE_CONSOLE}`});
				setTimeout(() => { throw e; });
				return null;
			}
		});

		return this._cache_brewsLocal = out.filter(Boolean);
	}

	/* -------------------------------------------- */

	async _pGetBrewRaw ({lockToken} = {}) {
		try {
			await this._LOCK.pLock({token: lockToken});
			return (await this._pGetBrewRaw_());
		} finally {
			this._LOCK.unlock();
		}
	}

	async _pGetBrewRaw_ () {
		const brewRaw = (await this._storage.pGet(this._STORAGE_KEY)) || [];

		// Assume that any potential migration has been completed if the user has new homebrew
		if (brewRaw.length) return brewRaw;

		const {version, existingMeta, existingBrew} = await this._pGetMigrationInfo();

		if (version === this._VERSION) return brewRaw;

		if (!existingMeta || !existingBrew) {
			await this._storage.pSet(this._STORAGE_KEY_MIGRATION_VERSION, this._VERSION);
			return brewRaw;
		}

		// If the user has no new homebrew, and some old homebrew, migrate the old homebrew.
		// Move the existing brew to the editable document--we do this as there is no guarantee that the user has not e.g.
		//   edited the brew they had saved.
		const brewEditable = this._getNewEditableBrewDoc();

		const cpyBrewEditableDoc = BrewDoc.fromObject(brewEditable, {isCopy: true})
			.mutMerge({
				json: {
					_meta: existingMeta || {},
					...existingBrew,
				},
			});

		await this._pSetBrew_({val: [cpyBrewEditableDoc], isInitialMigration: true});

		// Update the version, but do not delete the legacy brew--if the user really wants to get rid of it, they can
		//   clear their storage/etc.
		await this._storage.pSet(this._STORAGE_KEY_MIGRATION_VERSION, this._VERSION);

		JqueryUtil.doToast(`Migrated ${this.DISPLAY_NAME} from version ${version} to version ${this._VERSION}!`);

		return this._storage.pGet(this._STORAGE_KEY);
	}

	_getNewEditableBrewDoc () {
		const json = {_meta: {sources: []}};
		return this._getBrewDoc({json, isEditable: true});
	}

	/* -------------------------------------------- */

	async _pGetMigrationInfo () {
		// If there is no migration support, return default info
		if (!this._STORAGE_KEY_LEGACY && !this._STORAGE_KEY_LEGACY_META) return {version: this._VERSION, existingBrew: null, existingMeta: null};

		const version = await this._storage.pGet(this._STORAGE_KEY_MIGRATION_VERSION);

		// Short-circuit if we know we're already on the right version, to avoid loading old data
		if (version === this._VERSION) return {version};

		const existingBrew = await this._storage.pGet(this._STORAGE_KEY_LEGACY);
		const existingMeta = await this._storage.syncGet(this._STORAGE_KEY_LEGACY_META);

		return {
			version: version ?? 1,
			existingBrew,
			existingMeta,
		};
	}

	getCacheIteration () { return this._cache_iteration; }

	async pSetBrew (val, {lockToken} = {}) {
		try {
			await this._LOCK.pLock({token: lockToken});
			await this._pSetBrew_({val});
		} finally {
			this._LOCK.unlock();
		}
	}

	async _pSetBrew_ ({val, isInitialMigration}) {
		this._mutBrewsForSet(val);

		if (!isInitialMigration) {
			if (this._cache_brewsProc) this._cache_iteration++;
			this._cache_brewsProc = null;
		}
		await this._storage.pSet(this._STORAGE_KEY, val);

		if (!isInitialMigration) this._isDirty = true;
	}

	_mutBrewsForSet (val) {
		if (!(val instanceof Array)) throw new Error(`${this.DISPLAY_NAME.uppercaseFirst()} array must be an array!`);

		this._setBrewMetas(val.map(brew => this._getBrewDocReduced(brew)));
	}

	_getBrewId (brew) {
		if (brew.head.url) return brew.head.url;
		if (brew.body._meta?.sources?.length) return brew.body._meta.sources.map(src => (src.json || "").toLowerCase()).sort(SortUtil.ascSortLower).join(" :: ");
		return null;
	}

	_getNextBrews (brews, brewsToAdd) {
		const idsToAdd = new Set(brewsToAdd.map(brews => this._getBrewId(brews)).filter(Boolean));
		brews = brews.filter(brew => {
			const id = this._getBrewId(brew);
			if (id == null) return true;
			return !idsToAdd.has(id);
		});
		return [...brews, ...brewsToAdd];
	}

	async _pAddBrewDependencies ({brewDocs, brewsRaw = null, brewsRawLocal = null, lockToken}) {
		try {
			lockToken = await this._LOCK.pLock({token: lockToken});
			return (await this._pAddBrewDependencies_({brewDocs, brewsRaw, brewsRawLocal, lockToken}));
		} finally {
			this._LOCK.unlock();
		}
	}

	async _pAddBrewDependencies_ ({brewDocs, brewsRaw = null, brewsRawLocal = null, lockToken}) {
		const urlRoot = await this.pGetCustomUrl();
		const brewIndex = await this._pGetSourceIndex(urlRoot);

		const toLoadSources = [];
		const loadedSources = new Set();
		const out = [];

		brewsRaw = brewsRaw || await this._pGetBrewRaw({lockToken});
		brewsRawLocal = brewsRawLocal || await this._pGetBrew_pGetLocalBrew({lockToken});

		const trackLoaded = brew => (brew.body._meta?.sources || [])
			.filter(src => src.json)
			.forEach(src => loadedSources.add(src.json));
		brewsRaw.forEach(brew => trackLoaded(brew));
		brewsRawLocal.forEach(brew => trackLoaded(brew));

		brewDocs.forEach(brewDoc => toLoadSources.push(...this._getBrewDependencySources({brewDoc, brewIndex})));

		while (toLoadSources.length) {
			const src = toLoadSources.pop();
			if (loadedSources.has(src)) continue;
			loadedSources.add(src);

			const url = this.getFileUrl(brewIndex[src], urlRoot);
			const brewDocDep = await this._pGetBrewDocFromUrl({url});
			out.push(brewDocDep);
			trackLoaded(brewDocDep);

			toLoadSources.push(...this._getBrewDependencySources({brewDoc: brewDocDep, brewIndex}));
		}

		return out;
	}

	async pGetSourceUrl (source) {
		const urlRoot = await this.pGetCustomUrl();
		const brewIndex = await this._pGetSourceIndex(urlRoot);

		if (brewIndex[source]) return this.getFileUrl(brewIndex[source], urlRoot);

		const sourceLower = source.toLowerCase();
		if (brewIndex[sourceLower]) return this.getFileUrl(brewIndex[sourceLower], urlRoot);

		const sourceOriginal = Object.keys(brewIndex).find(k => k.toLowerCase() === sourceLower);
		if (!brewIndex[sourceOriginal]) return null;
		return this.getFileUrl(brewIndex[sourceOriginal], urlRoot);
	}

	/** @abstract */
	async _pGetSourceIndex (urlRoot) { throw new Error("Unimplemented!"); }
	/** @abstract */
	getFileUrl (path, urlRoot) { throw new Error("Unimplemented!"); }
	/** @abstract */
	pLoadTimestamps (urlRoot) { throw new Error("Unimplemented!"); }
	/** @abstract */
	pLoadPropIndex (urlRoot) { throw new Error("Unimplemented!"); }
	/** @abstract */
	pLoadMetaIndex (urlRoot) { throw new Error("Unimplemented!"); }

	_PROPS_DEPS = ["dependencies", "includes"];
	_PROPS_DEPS_DEEP = ["otherSources"];

	_getBrewDependencySources ({brewDoc, brewIndex}) {
		const out = new Set();

		this._PROPS_DEPS.forEach(prop => {
			const obj = brewDoc.body._meta?.[prop];
			if (!obj || !Object.keys(obj).length) return;
			Object.values(obj)
				.flat()
				.filter(src => brewIndex[src])
				.forEach(src => out.add(src));
		});

		this._PROPS_DEPS_DEEP.forEach(prop => {
			const obj = brewDoc.body._meta?.[prop];
			if (!obj || !Object.keys(obj).length) return;
			return Object.values(obj)
				.map(objSub => Object.keys(objSub))
				.flat()
				.filter(src => brewIndex[src])
				.forEach(src => out.add(src));
		});

		return out;
	}

	async pAddBrewFromUrl (url, {lockToken, isLazy} = {}) {
		try {
			return (await this._pAddBrewFromUrl({url, lockToken, isLazy}));
		} catch (e) {
			JqueryUtil.doToast({type: "danger", content: `Failed to load ${this.DISPLAY_NAME} from URL "${url}"! ${VeCt.STR_SEE_CONSOLE}`});
			setTimeout(() => { throw e; });
		}
		return [];
	}

	async _pGetBrewDocFromUrl ({url}) {
		const json = await DataUtil.loadRawJSON(url);
		return this._getBrewDoc({json, url, filename: UrlUtil.getFilename(url)});
	}

	async _pAddBrewFromUrl ({url, lockToken, isLazy}) {
		const brewDoc = await this._pGetBrewDocFromUrl({url});

		if (isLazy) {
			try {
				await this._LOCK.pLock({token: lockToken});
				this._addLazy_brewsTemp.push(brewDoc);
			} finally {
				this._LOCK.unlock();
			}

			return [brewDoc];
		}

		const brewDocs = [brewDoc];
		try {
			lockToken = await this._LOCK.pLock({token: lockToken});
			const brews = MiscUtil.copyFast(await this._pGetBrewRaw({lockToken}));

			const brewDocsDependencies = await this._pAddBrewDependencies({brewDocs: [brewDoc], brewsRaw: brews, lockToken});
			brewDocs.push(...brewDocsDependencies);

			const brewsNxt = this._getNextBrews(brews, brewDocs);
			await this.pSetBrew(brewsNxt, {lockToken});
		} finally {
			this._LOCK.unlock();
		}

		return brewDocs;
	}

	async pAddBrewsFromFiles (files) {
		try {
			const lockToken = await this._LOCK.pLock();
			return (await this._pAddBrewsFromFiles({files, lockToken}));
		} catch (e) {
			JqueryUtil.doToast({type: "danger", content: `Failed to load ${this.DISPLAY_NAME} from file(s)! ${VeCt.STR_SEE_CONSOLE}`});
			setTimeout(() => { throw e; });
		} finally {
			this._LOCK.unlock();
		}
		return [];
	}

	async _pAddBrewsFromFiles ({files, lockToken}) {
		const brewDocs = files.map(file => this._getBrewDoc({json: file.json, filename: file.name}));

		const brews = MiscUtil.copyFast(await this._pGetBrewRaw({lockToken}));

		const brewDocsDependencies = await this._pAddBrewDependencies({brewDocs, brewsRaw: brews, lockToken});
		brewDocs.push(...brewDocsDependencies);

		const brewsNxt = this._getNextBrews(brews, brewDocs);
		await this.pSetBrew(brewsNxt, {lockToken});

		return brewDocs;
	}

	async pAddBrewsLazyFinalize ({lockToken} = {}) {
		try {
			lockToken = await this._LOCK.pLock({token: lockToken});
			return (await this._pAddBrewsLazyFinalize_({lockToken}));
		} finally {
			this._LOCK.unlock();
		}
	}

	async _pAddBrewsLazyFinalize_ ({lockToken}) {
		const brews = MiscUtil.copyFast(await this._pGetBrewRaw({lockToken}));
		const brewsNxt = this._getNextBrews(brews, this._addLazy_brewsTemp);
		await this.pSetBrew(brewsNxt, {lockToken});
		this._addLazy_brewsTemp = [];
	}

	async pPullAllBrews ({brews} = {}) {
		try {
			const lockToken = await this._LOCK.pLock();
			return (await this._pPullAllBrews_({lockToken, brews}));
		} finally {
			this._LOCK.unlock();
		}
	}

	async _pPullAllBrews_ ({lockToken, brews}) {
		let cntPulls = 0;

		brews = brews || MiscUtil.copyFast(await this._pGetBrewRaw({lockToken}));
		const brewsNxt = await brews.pMap(async brew => {
			if (!this.isPullable(brew)) return brew;

			const json = await DataUtil.loadRawJSON(brew.head.url, {isBustCache: true});

			const localLastModified = brew.body._meta?.dateLastModified ?? 0;
			const sourceLastModified = json._meta?.dateLastModified ?? 0;

			if (sourceLastModified <= localLastModified) return brew;

			cntPulls++;
			return BrewDoc.fromObject(brew).mutUpdate({json}).toObject();
		});

		if (!cntPulls) return cntPulls;

		await this.pSetBrew(brewsNxt, {lockToken});
		return cntPulls;
	}

	isPullable (brew) { return !brew.head.isEditable && !!brew.head.url; }

	async pPullBrew (brew) {
		try {
			const lockToken = await this._LOCK.pLock();
			return (await this._pPullBrew_({brew, lockToken}));
		} finally {
			this._LOCK.unlock();
		}
	}

	async _pPullBrew_ ({brew, lockToken}) {
		const brews = await this._pGetBrewRaw({lockToken});
		if (!brews?.length) return;

		let isPull = false;
		const brewsNxt = await brews.pMap(async it => {
			if (it.head.docIdLocal !== brew.head.docIdLocal || !this.isPullable(it)) return it;

			const json = await DataUtil.loadRawJSON(it.head.url, {isBustCache: true});

			const localLastModified = it.body._meta?.dateLastModified ?? 0;
			const sourceLastModified = json._meta?.dateLastModified ?? 0;

			if (sourceLastModified <= localLastModified) return it;

			isPull = true;
			return BrewDoc.fromObject(it).mutUpdate({json}).toObject();
		});

		if (!isPull) return isPull;

		await this.pSetBrew(brewsNxt, {lockToken});
		return isPull;
	}

	async pAddBrewFromLoaderTag (ele) {
		const $ele = $(ele);
		if (!$ele.hasClass("rd__wrp-loadbrew--ready")) return; // an existing click is being handled
		let jsonPath = ele.dataset.rdLoaderPath;
		const name = ele.dataset.rdLoaderName;
		const cached = $ele.html();
		const cachedTitle = $ele.title();
		$ele.title("");
		$ele.removeClass("rd__wrp-loadbrew--ready").html(`${name.qq()}<span class="glyphicon glyphicon-refresh rd__loadbrew-icon rd__loadbrew-icon--active"></span>`);

		jsonPath = jsonPath.unescapeQuotes();
		if (!UrlUtil.isFullUrl(jsonPath)) {
			const brewUrl = await this.pGetCustomUrl();
			jsonPath = this.getFileUrl(jsonPath, brewUrl);
		}

		await this.pAddBrewFromUrl(jsonPath);
		$ele.html(`${name.qq()}<span class="glyphicon glyphicon-saved rd__loadbrew-icon"></span>`);
		setTimeout(() => $ele.html(cached).addClass("rd__wrp-loadbrew--ready").title(cachedTitle), 500);
	}

	_getBrewDoc ({json, url = null, filename = null, isLocal = false, isEditable = false}) {
		return BrewDoc.fromValues({
			head: {
				json,
				url,
				filename,
				isLocal,
				isEditable,
			},
			body: json,
		}).toObject();
	}

	_getBrewDocReduced (brewDoc) { return {docIdLocal: brewDoc.head.docIdLocal, _meta: brewDoc.body._meta}; }

	async pDeleteBrews (brews) {
		try {
			const lockToken = await this._LOCK.pLock();
			await this._pDeleteBrews_({brews, lockToken});
		} finally {
			this._LOCK.unlock();
		}
	}

	async _pDeleteBrews_ ({brews, lockToken}) {
		const brewsStored = await this._pGetBrewRaw({lockToken});
		if (!brewsStored?.length) return;

		const idsToDelete = new Set(brews.map(brew => brew.head.docIdLocal));

		const nxtBrews = brewsStored.filter(brew => !idsToDelete.has(brew.head.docIdLocal));
		await this.pSetBrew(nxtBrews, {lockToken});
	}

	async pUpdateBrew (brew) {
		try {
			const lockToken = await this._LOCK.pLock();
			await this._pUpdateBrew_({brew, lockToken});
		} finally {
			this._LOCK.unlock();
		}
	}

	async _pUpdateBrew_ ({brew, lockToken}) {
		const brews = await this._pGetBrewRaw({lockToken});
		if (!brews?.length) return;

		const nxtBrews = brews.map(it => it.head.docIdLocal !== brew.head.docIdLocal ? it : brew);
		await this.pSetBrew(nxtBrews, {lockToken});
	}

	// region Editable
	/** @abstract */
	pGetEditableBrewDoc (brew) { throw new Error("Unimplemented"); }
	/** @abstract */
	pGetOrCreateEditableBrewDoc () { throw new Error("Unimplemented"); }
	/** @abstract */
	pSetEditableBrewDoc () { throw new Error("Unimplemented"); }
	/** @abstract */
	pGetEditableBrewEntity (prop, uniqueId, {isDuplicate = false} = {}) { throw new Error("Unimplemented"); }
	/** @abstract */
	pPersistEditableBrewEntity (prop, ent) { throw new Error("Unimplemented"); }
	/** @abstract */
	pRemoveEditableBrewEntity (prop, uniqueId) { throw new Error("Unimplemented"); }
	/** @abstract */
	pAddSource (sourceObj) { throw new Error("Unimplemented"); }
	/** @abstract */
	pEditSource (sourceObj) { throw new Error("Unimplemented"); }
	/** @abstract */
	pIsEditableSourceJson (sourceJson) { throw new Error("Unimplemented"); }
	/** @abstract */
	pMoveOrCopyToEditableBySourceJson (sourceJson) { throw new Error("Unimplemented"); }
	/** @abstract */
	pMoveToEditable ({brews}) { throw new Error("Unimplemented"); }
	/** @abstract */
	pCopyToEditable ({brews}) { throw new Error("Unimplemented"); }
	// endregion

	// region Rendering/etc.
	_PAGE_TO_PROPS__SPELLS = [...UrlUtil.PAGE_TO_PROPS[UrlUtil.PG_SPELLS], "spellFluff"];
	_PAGE_TO_PROPS__BESTIARY = ["monster", "legendaryGroup", "monsterFluff"];

	_PAGE_TO_PROPS = {
		[UrlUtil.PG_SPELLS]: this._PAGE_TO_PROPS__SPELLS,
		[UrlUtil.PG_CLASSES]: ["class", "subclass", "classFeature", "subclassFeature"],
		[UrlUtil.PG_BESTIARY]: this._PAGE_TO_PROPS__BESTIARY,
		[UrlUtil.PG_BACKGROUNDS]: ["background"],
		[UrlUtil.PG_FEATS]: ["feat"],
		[UrlUtil.PG_OPT_FEATURES]: ["optionalfeature"],
		[UrlUtil.PG_RACES]: ["race", "raceFluff", "subrace"],
		[UrlUtil.PG_OBJECTS]: ["object"],
		[UrlUtil.PG_TRAPS_HAZARDS]: ["trap", "hazard"],
		[UrlUtil.PG_DEITIES]: ["deity"],
		[UrlUtil.PG_ITEMS]: [...UrlUtil.PAGE_TO_PROPS[UrlUtil.PG_ITEMS], "itemFluff"],
		[UrlUtil.PG_REWARDS]: ["reward"],
		[UrlUtil.PG_PSIONICS]: ["psionic"],
		[UrlUtil.PG_VARIANTRULES]: ["variantrule"],
		[UrlUtil.PG_CONDITIONS_DISEASES]: ["condition", "disease", "status"],
		[UrlUtil.PG_ADVENTURES]: ["adventure", "adventureData"],
		[UrlUtil.PG_BOOKS]: ["book", "bookData"],
		[UrlUtil.PG_TABLES]: ["table", "tableGroup"],
		[UrlUtil.PG_MAKE_BREW]: [
			...this._PAGE_TO_PROPS__SPELLS,
			...this._PAGE_TO_PROPS__BESTIARY,
			"makebrewCreatureTrait",
		],
		[UrlUtil.PG_MANAGE_BREW]: ["*"],
		[UrlUtil.PG_MANAGE_PRERELEASE]: ["*"],
		[UrlUtil.PG_DEMO_RENDER]: ["*"],
		[UrlUtil.PG_VEHICLES]: ["vehicle", "vehicleUpgrade"],
		[UrlUtil.PG_ACTIONS]: ["action"],
		[UrlUtil.PG_CULTS_BOONS]: ["cult", "boon"],
		[UrlUtil.PG_LANGUAGES]: ["language", "languageScript"],
		[UrlUtil.PG_CHAR_CREATION_OPTIONS]: ["charoption"],
		[UrlUtil.PG_RECIPES]: ["recipe"],
		[UrlUtil.PG_CLASS_SUBCLASS_FEATURES]: ["classFeature", "subclassFeature"],
		[UrlUtil.PG_DECKS]: ["card", "deck"],
	};

	getPageProps ({page, isStrict = false, fallback = null} = {}) {
		page = this._getBrewPage(page);

		const out = this._PAGE_TO_PROPS[page];
		if (out) return out;
		if (fallback) return fallback;

		if (isStrict) throw new Error(`No ${this.DISPLAY_NAME} properties defined for category ${page}`);

		return null;
	}

	getPropPages () {
		return Object.entries(this._PAGE_TO_PROPS)
			.map(([page, props]) => [page, props.filter(it => it !== "*")])
			.filter(([, props]) => props.length)
			.map(([page]) => page);
	}

	_getBrewPage (page) {
		return page || (IS_VTT ? this.PAGE_MANAGE : UrlUtil.getCurrentPage());
	}

	getDirProp (dir) {
		switch (dir) {
			case "creature": return "monster";
			case "makebrew": return "makebrewCreatureTrait";
		}
		return dir;
	}

	getPropDisplayName (prop) {
		switch (prop) {
			case "adventure": return "Adventure Contents/Info";
			case "book": return "Book Contents/Info";
		}
		return Parser.getPropDisplayName(prop);
	}
	// endregion

	// region Sources
	_doCacheMetas () {
		if (this._cache_metas) return;

		this._cache_metas = {};

		(this._getBrewMetas() || [])
			.forEach(({_meta}) => {
				Object.entries(_meta || {})
					.forEach(([prop, val]) => {
						if (!val) return;
						if (typeof val !== "object") return;

						if (val instanceof Array) {
							(this._cache_metas[prop] = this._cache_metas[prop] || []).push(...MiscUtil.copyFast(val));
							return;
						}

						this._cache_metas[prop] = this._cache_metas[prop] || {};
						Object.assign(this._cache_metas[prop], MiscUtil.copyFast(val));
					});
			});

		// Add a special "_sources" cache, which is a lookup-friendly object (rather than "sources", which is an array)
		this._cache_metas["_sources"] = (this._getBrewMetas() || [])
			.mergeMap(({_meta}) => {
				return (_meta?.sources || [])
					.mergeMap(src => ({[(src.json || "").toLowerCase()]: MiscUtil.copyFast(src)}));
			});
	}

	hasSourceJson (source) {
		if (!source) return false;
		source = source.toLowerCase();
		return !!this.getMetaLookup("_sources")[source];
	}

	sourceJsonToFull (source) {
		if (!source) return "";
		source = source.toLowerCase();
		return this.getMetaLookup("_sources")[source]?.full || source;
	}

	sourceJsonToAbv (source) {
		if (!source) return "";
		source = source.toLowerCase();
		return this.getMetaLookup("_sources")[source]?.abbreviation || source;
	}

	sourceJsonToDate (source) {
		if (!source) return "";
		source = source.toLowerCase();
		return this.getMetaLookup("_sources")[source]?.dateReleased || "1970-01-01";
	}

	sourceJsonToSource (source) {
		if (!source) return null;
		source = source.toLowerCase();
		return this.getMetaLookup("_sources")[source];
	}

	sourceJsonToStyle (source) {
		const stylePart = this.sourceJsonToStylePart(source);
		if (!stylePart) return stylePart;
		return `style="${stylePart}"`;
	}

	sourceToStyle (source) {
		const stylePart = this.sourceToStylePart(source);
		if (!stylePart) return stylePart;
		return `style="${stylePart}"`;
	}

	sourceJsonToStylePart (source) {
		if (!source) return "";
		const color = this.sourceJsonToColor(source);
		if (color) return this._getColorStylePart(color);
		return "";
	}

	sourceToStylePart (source) {
		if (!source) return "";
		const color = this.sourceToColor(source);
		if (color) return this._getColorStylePart(color);
		return "";
	}

	_getColorStylePart (color) { return `color: #${color} !important; border-color: #${color} !important; text-decoration-color: #${color} !important;`; }

	sourceJsonToColor (source) {
		if (!source) return "";
		source = source.toLowerCase();
		if (!this.getMetaLookup("_sources")[source]?.color) return "";
		return BrewUtilShared.getValidColor(this.getMetaLookup("_sources")[source].color);
	}

	sourceToColor (source) {
		if (!source?.color) return "";
		return BrewUtilShared.getValidColor(source.color);
	}

	getSources () {
		this._doCacheMetas();
		return Object.values(this._cache_metas["_sources"]);
	}
	// endregion

	// region Other meta
	getMetaLookup (type) {
		if (!type) return null;
		this._doCacheMetas();
		return this._cache_metas[type];
	}
	// endregion

	/**
	 * Merge together a loaded JSON (or loaded-JSON-like) object and a processed homebrew object.
	 * @param data
	 * @param homebrew
	 */
	getMergedData (data, homebrew) {
		const out = {};
		Object.entries(data)
			.forEach(([prop, val]) => {
				if (!homebrew[prop]) {
					out[prop] = [...val];
					return;
				}

				if (!(homebrew[prop] instanceof Array)) throw new Error(`${this.DISPLAY_NAME.uppercaseFirst()} was not array!`);
				if (!(val instanceof Array)) throw new Error(`Data was not array!`);
				out[prop] = [...val, ...homebrew[prop]];
			});

		return out;
	}

	// region Search
	/**
	 * Get data in a format similar to the main search index
	 */
	async pGetSearchIndex ({id = 0} = {}) {
		const indexer = new Omnidexer(id);

		const brew = await this.pGetBrewProcessed();

		// Run these in serial, to prevent any ID race condition antics
		await [...Omnidexer.TO_INDEX__FROM_INDEX_JSON, ...Omnidexer.TO_INDEX]
			.pSerialAwaitMap(async arbiter => {
				if (arbiter.isSkipBrew) return;
				if (!brew[arbiter.brewProp || arbiter.listProp]?.length) return;

				if (arbiter.pFnPreProcBrew) {
					const toProc = await arbiter.pFnPreProcBrew.bind(arbiter)(brew);
					await indexer.pAddToIndex(arbiter, toProc);
					return;
				}

				await indexer.pAddToIndex(arbiter, brew);
			});

		return Omnidexer.decompressIndex(indexer.getIndex());
	}

	async pGetAdditionalSearchIndices (highestId, addiProp) {
		const indexer = new Omnidexer(highestId + 1);

		const brew = await this.pGetBrewProcessed();

		await [...Omnidexer.TO_INDEX__FROM_INDEX_JSON, ...Omnidexer.TO_INDEX]
			.filter(it => it.additionalIndexes && (brew[it.listProp] || []).length)
			.pMap(it => {
				Object.entries(it.additionalIndexes)
					.filter(([prop]) => prop === addiProp)
					.pMap(async ([, pGetIndex]) => {
						const toIndex = await pGetIndex(indexer, {[it.listProp]: brew[it.listProp]});
						toIndex.forEach(add => indexer.pushToIndex(add));
					});
			});

		return Omnidexer.decompressIndex(indexer.getIndex());
	}

	async pGetAlternateSearchIndices (highestId, altProp) {
		const indexer = new Omnidexer(highestId + 1);

		const brew = await this.pGetBrewProcessed();

		await [...Omnidexer.TO_INDEX__FROM_INDEX_JSON, ...Omnidexer.TO_INDEX]
			.filter(ti => ti.alternateIndexes && (brew[ti.listProp] || []).length)
			.pSerialAwaitMap(async arbiter => {
				await Object.keys(arbiter.alternateIndexes)
					.filter(prop => prop === altProp)
					.pSerialAwaitMap(async prop => {
						await indexer.pAddToIndex(arbiter, brew, {alt: arbiter.alternateIndexes[prop]});
					});
			});

		return Omnidexer.decompressIndex(indexer.getIndex());
	}
	// endregion
}

class _BrewUtil2 extends _BrewUtil2Base {
	_STORAGE_KEY_LEGACY = "HOMEBREW_STORAGE";
	_STORAGE_KEY_LEGACY_META = "HOMEBREW_META_STORAGE";

	// Keep these distinct from the OG brew key, so users can recover their old brew if required.
	_STORAGE_KEY = "HOMEBREW_2_STORAGE";
	_STORAGE_KEY_META = "HOMEBREW_2_STORAGE_METAS";

	_STORAGE_KEY_CUSTOM_URL = "HOMEBREW_CUSTOM_REPO_URL";
	_STORAGE_KEY_MIGRATION_VERSION = "HOMEBREW_2_STORAGE_MIGRATION";

	_VERSION = 2;

	_PATH_LOCAL_DIR = "homebrew";
	_PATH_LOCAL_INDEX = VeCt.JSON_BREW_INDEX;

	IS_EDITABLE = true;
	PAGE_MANAGE = UrlUtil.PG_MANAGE_BREW;
	URL_REPO_DEFAULT = VeCt.URL_BREW;
	DISPLAY_NAME = "homebrew";
	DISPLAY_NAME_PLURAL = "homebrews";
	DEFAULT_AUTHOR = "";
	STYLE_BTN = "btn-info";

	/* -------------------------------------------- */

	_pInit_doBindDragDrop () {
		document.body.addEventListener("drop", async evt => {
			if (EventUtil.isInInput(evt)) return;

			evt.stopPropagation();
			evt.preventDefault();

			const files = evt.dataTransfer?.files;
			if (!files?.length) return;

			const pFiles = [...files].map((file, i) => {
				if (!/\.json$/i.test(file.name)) return null;

				return new Promise(resolve => {
					const reader = new FileReader();
					reader.onload = () => {
						let json;
						try {
							json = JSON.parse(reader.result);
						} catch (ignored) {
							return resolve(null);
						}

						resolve({name: file.name, json});
					};

					reader.readAsText(files[i]);
				});
			});

			const fileMetas = (await Promise.allSettled(pFiles))
				.filter(({status}) => status === "fulfilled")
				.map(({value}) => value)
				.filter(Boolean);

			await this.pAddBrewsFromFiles(fileMetas);

			if (this.isReloadRequired()) location.reload();
		});

		document.body.addEventListener("dragover", evt => {
			if (EventUtil.isInInput(evt)) return;

			evt.stopPropagation();
			evt.preventDefault();
		});
	}

	/* -------------------------------------------- */

	async _pGetSourceIndex (urlRoot) { return DataUtil.brew.pLoadSourceIndex(urlRoot); }

	getFileUrl (path, urlRoot) { return DataUtil.brew.getFileUrl(path, urlRoot); }

	pLoadTimestamps (brewIndex, src, urlRoot) { return DataUtil.brew.pLoadTimestamps(urlRoot); }

	pLoadPropIndex (brewIndex, src, urlRoot) { return DataUtil.brew.pLoadPropIndex(urlRoot); }

	pLoadMetaIndex (brewIndex, src, urlRoot) { return DataUtil.brew.pLoadMetaIndex(urlRoot); }

	/* -------------------------------------------- */

	// region Editable
	async pGetEditableBrewDoc () {
		return this._findEditableBrewDoc({brewRaw: await this._pGetBrewRaw()});
	}

	_findEditableBrewDoc ({brewRaw}) {
		return brewRaw.find(it => it.head.isEditable);
	}

	async pGetOrCreateEditableBrewDoc () {
		const existing = await this.pGetEditableBrewDoc();
		if (existing) return existing;

		const brew = this._getNewEditableBrewDoc();
		const brews = [...MiscUtil.copyFast(await this._pGetBrewRaw()), brew];
		await this.pSetBrew(brews);

		return brew;
	}

	async pSetEditableBrewDoc (brew) {
		if (!brew?.head?.docIdLocal || !brew?.body) throw new Error(`Invalid editable brew document!`); // Sanity check
		await this.pUpdateBrew(brew);
	}

	/**
	 * @param prop
	 * @param uniqueId
	 * @param isDuplicate If the entity should be a duplicate, i.e. have a new `uniqueId`.
	 */
	async pGetEditableBrewEntity (prop, uniqueId, {isDuplicate = false} = {}) {
		if (!uniqueId) throw new Error(`A "uniqueId" must be provided!`);

		const brew = await this.pGetOrCreateEditableBrewDoc();

		const out = (brew.body?.[prop] || []).find(it => it.uniqueId === uniqueId);
		if (!out || !isDuplicate) return out;

		if (isDuplicate) out.uniqueId = CryptUtil.uid();

		return out;
	}

	async pPersistEditableBrewEntity (prop, ent) {
		if (!ent.uniqueId) throw new Error(`Entity did not have a "uniqueId"!`);

		const brew = await this.pGetOrCreateEditableBrewDoc();

		const ixExisting = (brew.body?.[prop] || []).findIndex(it => it.uniqueId === ent.uniqueId);
		if (!~ixExisting) {
			const nxt = MiscUtil.copyFast(brew);
			MiscUtil.getOrSet(nxt.body, prop, []).push(ent);

			await this.pUpdateBrew(nxt);

			return;
		}

		const nxt = MiscUtil.copyFast(brew);
		nxt.body[prop][ixExisting] = ent;

		await this.pUpdateBrew(nxt);
	}

	async pRemoveEditableBrewEntity (prop, uniqueId) {
		if (!uniqueId) throw new Error(`A "uniqueId" must be provided!`);

		const brew = await this.pGetOrCreateEditableBrewDoc();

		if (!brew.body?.[prop]?.length) return;

		const nxt = MiscUtil.copyFast(brew);
		nxt.body[prop] = nxt.body[prop].filter(it => it.uniqueId !== uniqueId);

		if (nxt.body[prop].length === brew.body[prop]) return; // Silently allow no-op deletes

		await this.pUpdateBrew(nxt);
	}

	async pAddSource (sourceObj) {
		const existing = await this.pGetEditableBrewDoc();

		if (existing) {
			const nxt = MiscUtil.copyFast(existing);
			const sources = MiscUtil.getOrSet(nxt.body, "_meta", "sources", []);
			sources.push(sourceObj);

			await this.pUpdateBrew(nxt);

			return;
		}

		const json = {_meta: {sources: [sourceObj]}};
		const brew = this._getBrewDoc({json, isEditable: true});
		const brews = [...MiscUtil.copyFast(await this._pGetBrewRaw()), brew];
		await this.pSetBrew(brews);
	}

	async pEditSource (sourceObj) {
		const existing = await this.pGetEditableBrewDoc();
		if (!existing) throw new Error(`Editable brew document does not exist!`);

		const nxt = MiscUtil.copyFast(existing);
		const sources = MiscUtil.get(nxt.body, "_meta", "sources");
		if (!sources) throw new Error(`Source "${sourceObj.json}" does not exist in editable brew document!`);

		const existingSourceObj = sources.find(it => it.json === sourceObj.json);
		if (!existingSourceObj) throw new Error(`Source "${sourceObj.json}" does not exist in editable brew document!`);
		Object.assign(existingSourceObj, sourceObj);

		await this.pUpdateBrew(nxt);
	}

	async pIsEditableSourceJson (sourceJson) {
		const brew = await this.pGetEditableBrewDoc();
		if (!brew) return false;

		const sources = MiscUtil.get(brew.body, "_meta", "sources") || [];
		return sources.some(it => it.json === sourceJson);
	}

	/**
	 * Move the brews containing a given source to the editable document. If a brew cannot be moved to the editable
	 *   document, copy the source to the editable document instead.
	 */
	async pMoveOrCopyToEditableBySourceJson (sourceJson) {
		if (await this.pIsEditableSourceJson(sourceJson)) return;

		// Fetch all candidate brews
		const brews = (await this._pGetBrewRaw()).filter(brew => (brew.body._meta?.sources || []).some(src => src.json === sourceJson));
		const brewsLocal = (await this._pGetBrew_pGetLocalBrew()).filter(brew => (brew.body._meta?.sources || []).some(src => src.json === sourceJson));

		// Arbitrarily select one, preferring non-local
		let brew = brews.find(brew => BrewDoc.isOperationPermitted_moveToEditable({brew}));
		if (!brew) brew = brewsLocal.find(brew => BrewDoc.isOperationPermitted_moveToEditable({brew, isAllowLocal: true}));

		if (!brew) return;

		if (brew.head.isLocal) return this.pCopyToEditable({brews: [brew]});

		return this.pMoveToEditable({brews: [brew]});
	}

	async pMoveToEditable ({brews}) {
		const out = await this.pCopyToEditable({brews});
		await this.pDeleteBrews(brews);
		return out;
	}

	async pCopyToEditable ({brews}) {
		const brewEditable = await this.pGetOrCreateEditableBrewDoc();

		const cpyBrewEditableDoc = BrewDoc.fromObject(brewEditable, {isCopy: true});
		brews.forEach((brew, i) => cpyBrewEditableDoc.mutMerge({json: brew.body, isLazy: i !== brews.length - 1}));

		await this.pSetEditableBrewDoc(cpyBrewEditableDoc.toObject());

		return cpyBrewEditableDoc;
	}
	// endregion
}

class _PrereleaseUtil extends _BrewUtil2Base {
	_STORAGE_KEY_LEGACY = null;
	_STORAGE_KEY_LEGACY_META = null;

	_STORAGE_KEY = "PRERELEASE_STORAGE";
	_STORAGE_KEY_META = "PRERELEASE_META_STORAGE";

	_STORAGE_KEY_CUSTOM_URL = "PRERELEASE_CUSTOM_REPO_URL";
	_STORAGE_KEY_MIGRATION_VERSION = "PRERELEASE_STORAGE_MIGRATION";

	_PATH_LOCAL_DIR = "prerelease";
	_PATH_LOCAL_INDEX = VeCt.JSON_PRERELEASE_INDEX;

	_VERSION = 1;

	IS_EDITABLE = false;
	PAGE_MANAGE = UrlUtil.PG_MANAGE_PRERELEASE;
	URL_REPO_DEFAULT = VeCt.URL_PRERELEASE;
	DISPLAY_NAME = "prerelease content";
	DISPLAY_NAME_PLURAL = "prereleases";
	DEFAULT_AUTHOR = "Wizards of the Coast";
	STYLE_BTN = "btn-primary";

	/* -------------------------------------------- */

	_pInit_doBindDragDrop () { /* No-op */ }

	/* -------------------------------------------- */

	async _pGetSourceIndex (urlRoot) { return DataUtil.prerelease.pLoadSourceIndex(urlRoot); }

	getFileUrl (path, urlRoot) { return DataUtil.prerelease.getFileUrl(path, urlRoot); }

	pLoadTimestamps (brewIndex, src, urlRoot) { return DataUtil.prerelease.pLoadTimestamps(urlRoot); }

	pLoadPropIndex (brewIndex, src, urlRoot) { return DataUtil.prerelease.pLoadPropIndex(urlRoot); }

	pLoadMetaIndex (brewIndex, src, urlRoot) { return DataUtil.prerelease.pLoadMetaIndex(urlRoot); }

	/* -------------------------------------------- */

	// region Editable

	pGetEditableBrewDoc (brew) { return super.pGetEditableBrewDoc(brew); }
	pGetOrCreateEditableBrewDoc () { return super.pGetOrCreateEditableBrewDoc(); }
	pSetEditableBrewDoc () { return super.pSetEditableBrewDoc(); }
	pGetEditableBrewEntity (prop, uniqueId, {isDuplicate = false} = {}) { return super.pGetEditableBrewEntity(prop, uniqueId, {isDuplicate}); }
	pPersistEditableBrewEntity (prop, ent) { return super.pPersistEditableBrewEntity(prop, ent); }
	pRemoveEditableBrewEntity (prop, uniqueId) { return super.pRemoveEditableBrewEntity(prop, uniqueId); }
	pAddSource (sourceObj) { return super.pAddSource(sourceObj); }
	pEditSource (sourceObj) { return super.pEditSource(sourceObj); }
	pIsEditableSourceJson (sourceJson) { return super.pIsEditableSourceJson(sourceJson); }
	pMoveOrCopyToEditableBySourceJson (sourceJson) { return super.pMoveOrCopyToEditableBySourceJson(sourceJson); }
	pMoveToEditable ({brews}) { return super.pMoveToEditable({brews}); }
	pCopyToEditable ({brews}) { return super.pCopyToEditable({brews}); }

	// endregion
}

globalThis.BrewUtil2 = new _BrewUtil2();
globalThis.PrereleaseUtil = new _PrereleaseUtil();

class ManageBrewUi {
	static _RenderState = class {
		constructor () {
			this.$stgBrewList = null;
			this.list = null;
			this.listSelectClickHandler = null;
			this.brews = [];
			this.menuListMass = null;
			this.rowMetas = [];
		}
	};

	constructor ({brewUtil, isModal = false} = {}) {
		this._brewUtil = brewUtil;
		this._isModal = isModal;
	}

	static bindBtnOpen ($btn, {brewUtil = null} = {}) {
		brewUtil = brewUtil || BrewUtil2;

		$btn.click(evt => {
			if (evt.shiftKey) return window.location = brewUtil.PAGE_MANAGE;
			return this.pDoManageBrew({brewUtil});
		});
	}

	static async pDoManageBrew ({brewUtil = null} = {}) {
		brewUtil = brewUtil || BrewUtil2;

		const ui = new this({isModal: true, brewUtil});
		const rdState = new this._RenderState();
		const {$modalInner} = UiUtil.getShowModal({
			isHeight100: true,
			isWidth100: true,
			title: `Manage ${brewUtil.DISPLAY_NAME.toTitleCase()}`,
			isUncappedHeight: true,
			$titleSplit: $$`<div class="ve-flex-v-center btn-group">
				${ui._$getBtnPullAll(rdState)}
				${ui._$getBtnDeleteAll(rdState)}
			</div>`,
			isHeaderBorder: true,
			cbClose: () => {
				if (!brewUtil.isReloadRequired()) return;

				window.location.hash = "";
				location.reload();
			},
		});
		await ui.pRender($modalInner, {rdState});
	}

	_$getBtnDeleteAll (rdState) {
		return $(`<button class="btn btn-danger">Delete All</button>`)
			.addClass(this._isModal ? "btn-xs" : "btn-sm")
			.click(async () => {
				if (!await InputUiUtil.pGetUserBoolean({title: `Delete All ${this._brewUtil.DISPLAY_NAME.toTitleCase()}`, htmlDescription: "Are you sure?", textYes: "Yes", textNo: "Cancel"})) return;

				await this._pDoDeleteAll(rdState);
			});
	}

	_$getBtnPullAll (rdState) {
		const $btn = $(`<button class="btn btn-default">Update All</button>`)
			.addClass(this._isModal ? "btn-xs w-70p" : "btn-sm w-80p")
			.click(async () => {
				const cachedHtml = $btn.html();

				try {
					$btn.text(`Updating...`).prop("disabled", true);
					await this._pDoPullAll({rdState});
				} catch (e) {
					$btn.text(`Failed!`);
					setTimeout(() => $btn.html(cachedHtml).prop("disabled", false), VeCt.DUR_INLINE_NOTIFY);
					throw e;
				}

				$btn.text(`Done!`);
				setTimeout(() => $btn.html(cachedHtml).prop("disabled", false), VeCt.DUR_INLINE_NOTIFY);
			});
		return $btn;
	}

	async _pDoDeleteAll (rdState) {
		await this._brewUtil.pSetBrew([]);

		rdState.list.removeAllItems();
		rdState.list.update();
	}

	async _pDoPullAll ({rdState, brews = null}) {
		if (brews && !brews.length) return;

		let cntPulls;
		try {
			cntPulls = await this._brewUtil.pPullAllBrews({brews});
		} catch (e) {
			JqueryUtil.doToast({content: `Update failed! ${VeCt.STR_SEE_CONSOLE}`, type: "danger"});
			throw e;
		}
		if (!cntPulls) return JqueryUtil.doToast(`Update complete! No ${this._brewUtil.DISPLAY_NAME} was updated.`);

		await this._pRender_pBrewList(rdState);
		JqueryUtil.doToast(`Update complete! ${cntPulls} ${cntPulls === 1 ? `${this._brewUtil.DISPLAY_NAME} was` : `${this._brewUtil.DISPLAY_NAME_PLURAL} were`} updated.`);
	}

	async pRender ($wrp, {rdState = null} = {}) {
		rdState = rdState || new this.constructor._RenderState();

		rdState.$stgBrewList = $(`<div class="manbrew__current_brew ve-flex-col h-100 mt-1"></div>`);

		await this._pRender_pBrewList(rdState);

		const $btnLoadFromFile = $(`<button class="btn btn-default btn-sm">Load from File</button>`)
			.click(() => this._pHandleClick_btnLoadFromFile(rdState));

		const $btnLoadFromUrl = $(`<button class="btn btn-default btn-sm">Load from URL</button>`)
			.click(() => this._pHandleClick_btnLoadFromUrl(rdState));

		const $btnGet = $(`<button class="btn ${this._brewUtil.STYLE_BTN} btn-sm">Get ${this._brewUtil.DISPLAY_NAME.toTitleCase()}</button>`)
			.click(() => this._pHandleClick_btnGetBrew(rdState));

		const $btnCustomUrl = $(`<button class="btn ${this._brewUtil.STYLE_BTN} btn-sm px-2" title="Set Custom Repository URL"><span class="glyphicon glyphicon-cog"></span></button>`)
			.click(() => this._pHandleClick_btnSetCustomRepo());

		const $btnPullAll = this._isModal ? null : this._$getBtnPullAll(rdState);
		const $btnDeleteAll = this._isModal ? null : this._$getBtnDeleteAll(rdState);

		const $wrpBtns = $$`<div class="ve-flex-v-center no-shrink mobile__ve-flex-col">
			<div class="ve-flex-v-center mobile__mb-2">
				<div class="ve-flex-v-center btn-group mr-2">
					${$btnGet}
					${$btnCustomUrl}
				</div>
				<div class="ve-flex-v-center btn-group mr-2">
					${$btnLoadFromFile}
					${$btnLoadFromUrl}
				</div>
			</div>
			<div class="ve-flex-v-center">
				<a href="${this._brewUtil.URL_REPO_DEFAULT}" class="ve-flex-v-center" target="_blank" rel="noopener noreferrer"><button class="btn btn-default btn-sm mr-2">Browse Source Repository</button></a>

				<div class="ve-flex-v-center btn-group">
					${$btnPullAll}
					${$btnDeleteAll}
				</div>
			</div>
		</div>`;

		if (this._isModal) {
			$$($wrp)`
			${rdState.$stgBrewList}
			${$wrpBtns.addClass("mb-2")}`;
		} else {
			$$($wrp)`
			${$wrpBtns.addClass("mb-3")}
			${rdState.$stgBrewList}`;
		}
	}

	async _pHandleClick_btnLoadFromFile (rdState) {
		const {files, errors} = await DataUtil.pUserUpload({isMultiple: true});

		DataUtil.doHandleFileLoadErrorsGeneric(errors);

		await this._brewUtil.pAddBrewsFromFiles(files);
		await this._pRender_pBrewList(rdState);
	}

	async _pHandleClick_btnLoadFromUrl (rdState) {
		const enteredUrl = await InputUiUtil.pGetUserString({title: `${this._brewUtil.DISPLAY_NAME.toTitleCase()} URL`});
		if (!enteredUrl || !enteredUrl.trim()) return;

		const parsedUrl = this.constructor._getParsedCustomUrl(enteredUrl);
		if (!parsedUrl) {
			return JqueryUtil.doToast({
				content: `The URL was not valid!`,
				type: "danger",
			});
		}

		await this._brewUtil.pAddBrewFromUrl(parsedUrl.href);
		await this._pRender_pBrewList(rdState);
	}

	static _getParsedCustomUrl (enteredUrl) {
		try {
			return new URL(enteredUrl);
		} catch (e) {
			return null;
		}
	}

	async _pHandleClick_btnGetBrew (rdState) {
		await GetBrewUi.pDoGetBrew({brewUtil: this._brewUtil, isModal: this._isModal});
		await this._pRender_pBrewList(rdState);
	}

	async _pHandleClick_btnSetCustomRepo () {
		const customBrewUtl = await this._brewUtil.pGetCustomUrl();

		const nxtUrl = await InputUiUtil.pGetUserString({
			title: `${this._brewUtil.DISPLAY_NAME.toTitleCase()} Repository URL`,
			$elePre: $(`<div>
				<p>Leave blank to use the <a href="${this._brewUtil.URL_REPO_DEFAULT}" rel="noopener noreferrer" target="_blank">default ${this._brewUtil.DISPLAY_NAME} repo</a>.</p>
				<div>Note that for GitHub URLs, the <code>raw.</code> URL must be used. For example, <code>${this._brewUtil.URL_REPO_DEFAULT.replace(/TheGiddyLimit/g, "YourUsernameHere")}</code></div>
				<hr class="hr-3">
			</div>`),
			default: customBrewUtl,
		});
		if (nxtUrl == null) return;

		await this._brewUtil.pSetCustomUrl(nxtUrl);
	}

	async _pRender_pBrewList (rdState) {
		rdState.$stgBrewList.empty();
		rdState.rowMetas.splice(0, rdState.rowMetas.length)
			.forEach(({menu}) => ContextUtil.deleteMenu(menu));

		const $btnMass = $(`<button class="btn btn-default">Mass...</button>`)
			.click(evt => this._pHandleClick_btnListMass({evt, rdState}));
		const $iptSearch = $(`<input type="search" class="search manbrew__search form-control" placeholder="Search ${this._brewUtil.DISPLAY_NAME}...">`);
		const $cbAll = $(`<input type="checkbox">`);
		const $wrpList = $(`<div class="list-display-only max-h-unset smooth-scroll overflow-y-auto h-100 brew-list brew-list--target manbrew__list relative ve-flex-col w-100 mb-3"></div>`);

		rdState.list = new List({
			$iptSearch,
			$wrpList,
			isUseJquery: true,
			isFuzzy: true,
			sortByInitial: rdState.list ? rdState.list.sortBy : undefined,
			sortDirInitial: rdState.list ? rdState.list.sortDir : undefined,
		});

		const $wrpBtnsSort = $$`<div class="filtertools manbrew__filtertools btn-group input-group input-group--bottom ve-flex no-shrink">
			<label class="col-0-5 pr-0 btn btn-default btn-xs ve-flex-vh-center">${$cbAll}</label>
			<button class="col-1 btn btn-default btn-xs" disabled>Type</button>
			<button class="col-3 btn btn-default btn-xs" data-sort="source">Source</button>
			<button class="col-3 btn btn-default btn-xs" data-sort="authors">Authors</button>
			<button class="col-3 btn btn-default btn-xs" disabled>Origin</button>
			<button class="col-1-5 btn btn-default btn-xs ve-grow" disabled>&nbsp;</button>
		</div>`;

		$$(rdState.$stgBrewList)`
		<div class="ve-flex-col h-100">
			<div class="input-group ve-flex-vh-center">
				${$btnMass}
				${$iptSearch}
			</div>
			${$wrpBtnsSort}
			<div class="ve-flex w-100 h-100 overflow-y-auto relative">${$wrpList}</div>
		</div>`;

		rdState.listSelectClickHandler = new ListSelectClickHandler({list: rdState.list});
		rdState.listSelectClickHandler.bindSelectAllCheckbox($cbAll);
		SortUtil.initBtnSortHandlers($wrpBtnsSort, rdState.list);

		rdState.brews = (await this._brewUtil.pGetBrew()).map(brew => this._pRender_getProcBrew(brew));

		rdState.brews.forEach((brew, ix) => {
			const meta = this._pRender_getLoadedRowMeta(rdState, brew, ix);
			rdState.rowMetas.push(meta);
			rdState.list.addItem(meta.listItem);
		});

		rdState.list.init();
		$iptSearch.focus();
	}

	get _LBL_LIST_UPDATE () { return "Update"; }
	get _LBL_LIST_MANAGE_CONTENTS () { return "Manage Contents"; }
	get _LBL_LIST_EXPORT () { return "Export"; }
	get _LBL_LIST_VIEW_JSON () { return "View JSON"; }
	get _LBL_LIST_DELETE () { return "Delete"; }
	get _LBL_LIST_MOVE_TO_EDITABLE () { return `Move to Editable ${this._brewUtil.DISPLAY_NAME.toTitleCase()} Document`; }

	_initListMassMenu ({rdState}) {
		if (rdState.menuListMass) return;

		const getSelBrews = ({fnFilter = null} = {}) => {
			const brews = rdState.list.items
				.filter(li => li.data.cbSel.checked)
				.map(li => rdState.brews[li.ix])
				.filter(brew => fnFilter ? fnFilter(brew) : true);

			if (!brews.length) JqueryUtil.doToast({content: `Please select some suitable ${this._brewUtil.DISPLAY_NAME_PLURAL} first!`, type: "warning"});

			return brews;
		};

		rdState.menuListMass = ContextUtil.getMenu([
			new ContextUtil.Action(
				this._LBL_LIST_UPDATE,
				async () => this._pDoPullAll({
					rdState,
					brews: getSelBrews({
						fnFilter: brew => this._isBrewOperationPermitted_update(brew),
					}),
				}),
			),
			new ContextUtil.Action(
				this._LBL_LIST_EXPORT,
				async () => {
					for (const brew of getSelBrews()) await this._pRender_pDoDownloadBrew({brew});
				},
			),
			this._brewUtil.IS_EDITABLE
				? new ContextUtil.Action(
					this._LBL_LIST_MOVE_TO_EDITABLE,
					async () => this._pRender_pDoMoveToEditable({
						rdState,
						brews: getSelBrews({
							fnFilter: brew => this._isBrewOperationPermitted_moveToEditable(brew),
						}),
					}),
				)
				: null,
			new ContextUtil.Action(
				this._LBL_LIST_DELETE,
				async () => this._pRender_pDoDelete({
					rdState,
					brews: getSelBrews({
						fnFilter: brew => this._isBrewOperationPermitted_delete(brew),
					}),
				}),
			),
		].filter(Boolean));
	}

	_isBrewOperationPermitted_update (brew) { return !brew.head.isEditable && this._brewUtil.isPullable(brew); }
	_isBrewOperationPermitted_moveToEditable (brew) { return BrewDoc.isOperationPermitted_moveToEditable({brew}); }
	_isBrewOperationPermitted_delete (brew) { return !brew.head.isLocal; }

	async _pHandleClick_btnListMass ({evt, rdState}) {
		this._initListMassMenu({rdState});
		await ContextUtil.pOpenMenu(evt, rdState.menuListMass);
	}

	static _getBrewName (brew) {
		const sources = brew.body._meta?.sources || [];

		return sources
			.map(brewSource => brewSource.full || _BrewInternalUtil.SOURCE_UNKNOWN_FULL)
			.sort(SortUtil.ascSortLower)
			.join(", ");
	}

	_pRender_getLoadedRowMeta (rdState, brew, ix) {
		const sources = brew.body._meta?.sources || [];

		const rowsSubMetas = sources
			.map(brewSource => {
				const hasConverters = !!brewSource.convertedBy?.length;
				const btnConvertedBy = e_({
					tag: "button",
					clazz: `btn btn-xxs btn-default ${!hasConverters ? "disabled" : ""}`,
					title: hasConverters ? `Converted by: ${brewSource.convertedBy.join(", ").qq()}` : "(No conversion credit given)",
					children: [
						e_({tag: "span", clazz: "mobile__hidden", text: "View Converters"}),
						e_({tag: "span", clazz: "mobile__visible", text: "Convs.", title: "View Converters"}),
					],
					click: () => {
						if (!hasConverters) return;
						const {$modalInner} = UiUtil.getShowModal({
							title: `Converted By:${brewSource.convertedBy.length === 1 ? ` ${brewSource.convertedBy.join("")}` : ""}`,
							isMinHeight0: true,
						});

						if (brewSource.convertedBy.length === 1) return;
						$modalInner.append(`<ul>${brewSource.convertedBy.map(it => `<li>${it.qq()}</li>`).join("")}</ul>`);
					},
				});

				const authorsFull = [(brewSource.authors || [])].flat(2).join(", ");

				const lnkUrl = brewSource.url
					? e_({
						tag: "a",
						clazz: "col-2 text-center",
						href: brewSource.url,
						attrs: {
							target: "_blank",
							rel: "noopener noreferrer",
						},
						text: "View Source",
					})
					: e_({
						tag: "span",
						clazz: "col-2 text-center",
					});

				const eleRow = e_({
					tag: "div",
					clazz: `w-100 ve-flex-v-center`,
					children: [
						e_({
							tag: "span",
							clazz: `col-4 manbrew__source px-1`,
							text: brewSource.full,
						}),
						e_({
							tag: "span",
							clazz: `col-4 px-1`,
							text: authorsFull,
						}),
						lnkUrl,
						e_({
							tag: "div",
							clazz: `ve-flex-vh-center ve-grow`,
							children: [
								btnConvertedBy,
							],
						}),
					],
				});

				return {
					eleRow,
					authorsFull,
					name: brewSource.full || _BrewInternalUtil.SOURCE_UNKNOWN_FULL,
					abbreviation: brewSource.abbreviation || _BrewInternalUtil.SOURCE_UNKNOWN_ABBREVIATION,
				};
			})
			.sort((a, b) => SortUtil.ascSortLower(a.name, b.name));

		const brewName = this.constructor._getBrewName(brew);

		// region These are mutually exclusive
		const btnPull = this._pRender_getBtnPull({rdState, brew});
		const btnEdit = this._pRender_getBtnEdit({rdState, brew});
		const btnPullEditPlaceholder = (btnPull || btnEdit) ? null : this.constructor._pRender_getBtnPlaceholder();
		// endregion

		const btnDownload = e_({
			tag: "button",
			clazz: `btn btn-default btn-xs mobile__hidden w-24p`,
			title: this._LBL_LIST_EXPORT,
			children: [
				e_({
					tag: "span",
					clazz: "glyphicon glyphicon-download manbrew-row__icn-btn",
				}),
			],
			click: () => this._pRender_pDoDownloadBrew({brew, brewName}),
		});

		const btnViewJson = e_({
			tag: "button",
			clazz: `btn btn-default btn-xs mobile-ish__hidden w-24p`,
			title: `${this._LBL_LIST_VIEW_JSON}: ${this.constructor._getBrewJsonTitle({brew, brewName})}`,
			children: [
				e_({
					tag: "span",
					clazz: "ve-bolder code relative manbrew-row__icn-btn--text",
					text: "{}",
				}),
			],
			click: evt => this._pRender_doViewBrew({evt, brew, brewName}),
		});

		const btnOpenMenu = e_({
			tag: "button",
			clazz: `btn btn-default btn-xs w-24p`,
			title: "Menu",
			children: [
				e_({
					tag: "span",
					clazz: "glyphicon glyphicon-option-vertical manbrew-row__icn-btn",
				}),
			],
			click: evt => this._pRender_pDoOpenBrewMenu({evt, rdState, brew, brewName, rowMeta}),
		});

		const btnDelete = this._isBrewOperationPermitted_delete(brew) ? e_({
			tag: "button",
			clazz: `btn btn-danger btn-xs mobile__hidden w-24p`,
			title: this._LBL_LIST_DELETE,
			children: [
				e_({
					tag: "span",
					clazz: "glyphicon glyphicon-trash manbrew-row__icn-btn",
				}),
			],
			click: () => this._pRender_pDoDelete({rdState, brews: [brew]}),
		}) : this.constructor._pRender_getBtnPlaceholder();

		// Weave in HRs
		const elesSub = rowsSubMetas.map(it => it.eleRow);
		for (let i = rowsSubMetas.length - 1; i > 0; --i) elesSub.splice(i, 0, e_({tag: "hr", clazz: `hr-1 hr--dotted`}));

		const cbSel = e_({
			tag: "input",
			clazz: "no-events",
			type: "checkbox",
		});

		const ptCategory = brew.head.isLocal
			? {short: `Local`, title: `Local Document`}
			: brew.head.isEditable
				? {short: `Editable`, title: `Editable Document`}
				: {short: `Standard`, title: `Standard Document`};

		const eleLi = e_({
			tag: "div",
			clazz: `manbrew__row ve-flex-v-center lst__row lst--border lst__row-inner no-shrink py-1 no-select`,
			children: [
				e_({
					tag: "label",
					clazz: `col-0-5 ve-flex-vh-center ve-self-flex-stretch`,
					children: [cbSel],
				}),
				e_({
					tag: "div",
					clazz: `col-1 text-center italic mobile__text-clip-ellipsis`,
					title: ptCategory.title,
					text: ptCategory.short,
				}),
				e_({
					tag: "div",
					clazz: `col-9 ve-flex-col`,
					children: elesSub,
				}),
				e_({
					tag: "div",
					clazz: `col-1-5 btn-group ve-flex-vh-center`,
					children: [
						btnPull,
						btnEdit,
						btnPullEditPlaceholder,
						btnDownload,
						btnViewJson,
						btnOpenMenu,
						btnDelete,
					],
				}),
			],
		});

		const listItem = new ListItem(
			ix,
			eleLi,
			brewName,
			{
				authors: rowsSubMetas.map(it => it.authorsFull).join(", "),
				abbreviation: rowsSubMetas.map(it => it.abbreviation).join(", "),
			},
			{
				cbSel,
			},
		);

		eleLi.addEventListener("click", evt => rdState.listSelectClickHandler.handleSelectClick(listItem, evt, {isPassThroughEvents: true}));

		const rowMeta = {
			listItem,
			menu: null,
		};
		return rowMeta;
	}

	static _pRender_getBtnPlaceholder () {
		return e_({
			tag: "button",
			clazz: `btn btn-default btn-xs mobile__hidden w-24p`,
			html: "&nbsp;",
		})
			.attr("disabled", true);
	}

	_pRender_getBtnPull ({rdState, brew}) {
		if (!this._isBrewOperationPermitted_update(brew)) return null;

		const btnPull = e_({
			tag: "button",
			clazz: `btn btn-default btn-xs mobile__hidden w-24p`,
			title: this._LBL_LIST_UPDATE,
			children: [
				e_({
					tag: "span",
					clazz: "glyphicon glyphicon-refresh manbrew-row__icn-btn",
				}),
			],
			click: () => this._pRender_pDoPullBrew({rdState, brew}),
		});
		if (!this._brewUtil.isPullable(brew)) btnPull.attr("disabled", true).attr("title", `(Update disabled\u2014no URL available)`);
		return btnPull;
	}

	_pRender_getBtnEdit ({rdState, brew}) {
		if (!brew.head.isEditable) return null;

		return e_({
			tag: "button",
			clazz: `btn btn-default btn-xs mobile__hidden w-24p`,
			title: this._LBL_LIST_MANAGE_CONTENTS,
			children: [
				e_({
					tag: "span",
					clazz: "glyphicon glyphicon-pencil manbrew-row__icn-btn",
				}),
			],
			click: () => this._pRender_pDoEditBrew({rdState, brew}),
		});
	}

	async _pRender_pDoPullBrew ({rdState, brew}) {
		const isPull = await this._brewUtil.pPullBrew(brew);

		JqueryUtil.doToast(
			isPull
				? `${this._brewUtil.DISPLAY_NAME.uppercaseFirst()} updated!`
				: `${this._brewUtil.DISPLAY_NAME.uppercaseFirst()} is already up-to-date.`,
		);

		if (!isPull) return;

		await this._pRender_pBrewList(rdState);
	}

	async _pRender_pDoEditBrew ({rdState, brew}) {
		const {isDirty, brew: nxtBrew} = await ManageEditableBrewContentsUi.pDoOpen({brewUtil: this._brewUtil, brew, isModal: this._isModal});
		if (!isDirty) return;

		await this._brewUtil.pUpdateBrew(nxtBrew);
		await this._pRender_pBrewList(rdState);
	}

	async _pRender_pDoDownloadBrew ({brew, brewName = null}) {
		const filename = (brew.head.filename || "").split(".").slice(0, -1).join(".");

		// For the editable brew, if there are multiple sources, present the user with a selection screen. We then filter
		//   the editable brew down to whichever sources they selected.
		const isChooseSources = brew.head.isEditable && (brew.body._meta?.sources || []).length > 1;

		if (!isChooseSources) {
			const outFilename = filename || brewName || this.constructor._getBrewName(brew);
			const json = brew.head.isEditable ? MiscUtil.copyFast(brew.body) : brew.body;
			this.constructor._mutExportableEditableData({json: json});
			return DataUtil.userDownload(outFilename, json, {isSkipAdditionalMetadata: true});
		}

		// region Get chosen sources
		const getSourceAsText = source => `[${(source.abbreviation || "").qq()}] ${(source.full || "").qq()}`;

		const choices = await InputUiUtil.pGetUserMultipleChoice({
			title: `Choose Sources`,
			values: brew.body._meta.sources,
			fnDisplay: getSourceAsText,
			isResolveItems: true,
			max: Number.MAX_SAFE_INTEGER,
			isSearchable: true,
			fnGetSearchText: getSourceAsText,
		});
		if (choices == null || choices.length === 0) return;
		// endregion

		// region Filter output by selected sources
		const cpyBrew = MiscUtil.copyFast(brew.body);
		const sourceAllowlist = new Set(choices.map(it => it.json));

		cpyBrew._meta.sources = cpyBrew._meta.sources.filter(it => sourceAllowlist.has(it.json));

		Object.entries(cpyBrew)
			.forEach(([k, v]) => {
				if (!v || !(v instanceof Array)) return;
				if (k.startsWith("_")) return;
				cpyBrew[k] = v.filter(it => {
					const source = SourceUtil.getEntitySource(it);
					if (!source) return true;
					return sourceAllowlist.has(source);
				});
			});
		// endregion

		const reducedFilename = filename || this.constructor._getBrewName({body: cpyBrew});

		this.constructor._mutExportableEditableData({json: cpyBrew});

		return DataUtil.userDownload(reducedFilename, cpyBrew, {isSkipAdditionalMetadata: true});
	}

	/**
	 * The editable brew may contain `uniqueId` references from the builder, which should be stripped before export.
	 */
	static _mutExportableEditableData ({json}) {
		Object.values(json)
			.forEach(arr => {
				if (arr == null || !(arr instanceof Array)) return;
				arr.forEach(ent => delete ent.uniqueId);
			});
		return json;
	}

	static _getBrewJsonTitle ({brew, brewName}) {
		brewName = brewName || this._getBrewName(brew);
		return brew.head.filename || brewName;
	}

	_pRender_doViewBrew ({evt, brew, brewName}) {
		const title = this.constructor._getBrewJsonTitle({brew, brewName});
		const $content = Renderer.hover.$getHoverContent_statsCode(brew.body, {isSkipClean: true, title});
		Renderer.hover.getShowWindow(
			$content,
			Renderer.hover.getWindowPositionFromEvent(evt),
			{
				title,
				isPermanent: true,
				isBookContent: true,
			},
		);
	}

	async _pRender_pDoOpenBrewMenu ({evt, rdState, brew, brewName, rowMeta}) {
		rowMeta.menu = rowMeta.menu || this._pRender_getBrewMenu({rdState, brew, brewName});

		await ContextUtil.pOpenMenu(evt, rowMeta.menu);
	}

	_pRender_getBrewMenu ({rdState, brew, brewName}) {
		const menuItems = [];

		if (this._isBrewOperationPermitted_update(brew)) {
			menuItems.push(
				new ContextUtil.Action(
					this._LBL_LIST_UPDATE,
					async () => this._pRender_pDoPullBrew({rdState, brew}),
				),
			);
		} else if (brew.head.isEditable) {
			menuItems.push(
				new ContextUtil.Action(
					this._LBL_LIST_MANAGE_CONTENTS,
					async () => this._pRender_pDoEditBrew({rdState, brew}),
				),
			);
		}

		menuItems.push(
			new ContextUtil.Action(
				this._LBL_LIST_EXPORT,
				async () => this._pRender_pDoDownloadBrew({brew, brewName}),
			),
			new ContextUtil.Action(
				this._LBL_LIST_VIEW_JSON,
				async evt => this._pRender_doViewBrew({evt, brew, brewName}),
			),
		);

		if (this._brewUtil.IS_EDITABLE && this._isBrewOperationPermitted_moveToEditable(brew)) {
			menuItems.push(
				new ContextUtil.Action(
					this._LBL_LIST_MOVE_TO_EDITABLE,
					async () => this._pRender_pDoMoveToEditable({rdState, brews: [brew]}),
				),
			);
		}

		if (this._isBrewOperationPermitted_delete(brew)) {
			menuItems.push(
				new ContextUtil.Action(
					this._LBL_LIST_DELETE,
					async () => this._pRender_pDoDelete({rdState, brews: [brew]}),
				),
			);
		}

		return ContextUtil.getMenu(menuItems);
	}

	_pGetUserBoolean_isMoveBrewsToEditable ({brews}) {
		return InputUiUtil.pGetUserBoolean({
			title: `Move to Editable ${this._brewUtil.DISPLAY_NAME.toTitleCase()} Document`,
			htmlDescription: `Moving ${brews.length === 1 ? `this ${this._brewUtil.DISPLAY_NAME}` : `these
			${this._brewUtil.DISPLAY_NAME_PLURAL}`} to the editable document will prevent ${brews.length === 1 ? "it" : "them"} from being automatically updated in future.<br>Are you sure you want to move ${brews.length === 1 ? "it" : "them"}?`,
			textYes: "Yes",
			textNo: "Cancel",
		});
	}

	async _pRender_pDoMoveToEditable ({rdState, brews}) {
		if (!brews?.length) return;

		if (!await this._pGetUserBoolean_isMoveBrewsToEditable({brews})) return;

		await this._brewUtil.pMoveToEditable({brews});

		await this._pRender_pBrewList(rdState);

		JqueryUtil.doToast(`${`${brews.length === 1 ? this._brewUtil.DISPLAY_NAME : this._brewUtil.DISPLAY_NAME_PLURAL}`.uppercaseFirst()} moved to editable document!`);
	}

	_pGetUserBoolean_isDeleteBrews ({brews}) {
		if (!brews.some(brew => brew.head.isEditable)) return true;

		const htmlDescription = brews.length === 1
			? `This document contains all your locally-created or edited ${this._brewUtil.DISPLAY_NAME_PLURAL}.<br>Are you sure you want to delete it?`
			: `One of the documents you are about to delete contains all your locally-created or edited ${this._brewUtil.DISPLAY_NAME_PLURAL}.<br>Are you sure you want to delete these documents?`;

		return InputUiUtil.pGetUserBoolean({
			title: `Delete ${this._brewUtil.DISPLAY_NAME}`,
			htmlDescription,
			textYes: "Yes",
			textNo: "Cancel",
		});
	}

	async _pRender_pDoDelete ({rdState, brews}) {
		if (!brews?.length) return;

		if (!await this._pGetUserBoolean_isDeleteBrews({brews})) return;

		await this._brewUtil.pDeleteBrews(brews);

		await this._pRender_pBrewList(rdState);
	}

	_pRender_getProcBrew (brew) {
		brew = MiscUtil.copyFast(brew);
		brew.body._meta.sources.sort((a, b) => SortUtil.ascSortLower(a.full || "", b.full || ""));
		return brew;
	}
}

class GetBrewUi {
	static _RenderState = class {
		constructor () {
			this.pageFilter = null;
			this.list = null;
			this.listSelectClickHandler = null;
			this.cbAll = null;
		}
	};

	static _TypeFilter = class extends Filter {
		constructor ({brewUtil}) {
			const pageProps = brewUtil.getPageProps({fallback: ["*"]});
			super({
				header: "Category",
				items: [],
				displayFn: brewUtil.getPropDisplayName.bind(brewUtil),
				selFn: prop => pageProps.includes("*") || pageProps.includes(prop),
				isSortByDisplayItems: true,
			});
			this._brewUtil = brewUtil;
		}

		_getHeaderControls_addExtraStateBtns (opts, wrpStateBtnsOuter) {
			const menu = ContextUtil.getMenu(
				this._brewUtil.getPropPages()
					.map(page => ({page, displayPage: UrlUtil.pageToDisplayPage(page)}))
					.sort(SortUtil.ascSortProp.bind(SortUtil, "displayPage"))
					.map(({page, displayPage}) => {
						return new ContextUtil.Action(
							displayPage,
							() => {
								const propsActive = new Set(this._brewUtil.getPageProps({page, fallback: []}));
								Object.keys(this._state).forEach(prop => this._state[prop] = propsActive.has(prop) ? 1 : 0);
							},
						);
					}),
			);

			const btnPage = e_({
				tag: "button",
				clazz: `btn btn-default w-100 btn-xs`,
				text: `Select for Page...`,
				click: evt => ContextUtil.pOpenMenu(evt, menu),
			});

			e_({
				tag: "div",
				clazz: `btn-group mr-2 w-100 ve-flex-v-center`,
				children: [
					btnPage,
				],
			}).prependTo(wrpStateBtnsOuter);
		}
	};

	static _PageFilterGetBrew = class extends PageFilter {
		static _STATUS_FILTER_DEFAULT_DESELECTED = new Set(["wip", "deprecated", "invalid"]);

		constructor ({brewUtil}) {
			super();

			this._brewUtil = brewUtil;

			this._typeFilter = new GetBrewUi._TypeFilter({brewUtil});
			this._statusFilter = new Filter({
				header: "Status",
				items: [
					"ready",
					"wip",
					"deprecated",
					"invalid",
				],
				displayFn: StrUtil.toTitleCase,
				itemSortFn: null,
				deselFn: it => this.constructor._STATUS_FILTER_DEFAULT_DESELECTED.has(it),
			});
			this._miscFilter = new Filter({
				header: "Miscellaneous",
				items: ["Sample"],
				deselFn: it => it === "Sample",
			});
		}

		static mutateForFilters (brewInfo) {
			if (brewInfo._brewAuthor && brewInfo._brewAuthor.toLowerCase().startsWith("sample -")) brewInfo._fMisc = ["Sample"];
		}

		addToFilters (it, isExcluded) {
			if (isExcluded) return;

			this._typeFilter.addItem(it.props);
		}

		async _pPopulateBoxOptions (opts) {
			opts.filters = [
				this._typeFilter,
				this._statusFilter,
				this._miscFilter,
			];
		}

		toDisplay (values, it) {
			return this._filterBox.toDisplay(
				values,
				it.props,
				it._brewStatus,
				it._fMisc,
			);
		}
	};

	static async pDoGetBrew ({brewUtil, isModal: isParentModal = false} = {}) {
		return new Promise((resolve, reject) => {
			const ui = new this({brewUtil, isModal: true});
			const rdState = new this._RenderState();
			const {$modalInner} = UiUtil.getShowModal({
				isHeight100: true,
				title: `Get ${brewUtil.DISPLAY_NAME.toTitleCase()}`,
				isUncappedHeight: true,
				isWidth100: true,
				overlayColor: isParentModal ? "transparent" : undefined,
				isHeaderBorder: true,
				cbClose: async () => {
					await ui.pHandlePreCloseModal({rdState});
					resolve([...ui._brewsLoaded]);
				},
			});
			ui.pInit()
				.then(() => ui.pRender($modalInner, {rdState}))
				.catch(e => reject(e));
		});
	}

	_sortUrlList (a, b, o) {
		a = this._dataList[a.ix];
		b = this._dataList[b.ix];

		switch (o.sortBy) {
			case "name": return this.constructor._sortUrlList_byName(a, b);
			case "author": return this.constructor._sortUrlList_orFallback(a, b, SortUtil.ascSortLower, "_brewAuthor");
			case "category": return this.constructor._sortUrlList_orFallback(a, b, SortUtil.ascSortLower, "_brewPropDisplayName");
			case "added": return this.constructor._sortUrlList_orFallback(a, b, SortUtil.ascSort, "_brewAdded");
			case "modified": return this.constructor._sortUrlList_orFallback(a, b, SortUtil.ascSort, "_brewModified");
			default: throw new Error(`No sort order defined for property "${o.sortBy}"`);
		}
	}

	static _sortUrlList_byName (a, b) { return SortUtil.ascSortLower(a._brewName, b._brewName); }
	static _sortUrlList_orFallback (a, b, fn, prop) { return fn(a[prop], b[prop]) || this._sortUrlList_byName(a, b); }

	constructor ({brewUtil, isModal} = {}) {
		this._brewUtil = brewUtil;
		this._isModal = isModal;

		this._dataList = null;

		this._brewsLoaded = []; // Track the brews we load during our lifetime
	}

	async pInit () {
		const urlRoot = await this._brewUtil.pGetCustomUrl();
		const [timestamps, propIndex, metaIndex] = await Promise.all([
			this._brewUtil.pLoadTimestamps(urlRoot),
			this._brewUtil.pLoadPropIndex(urlRoot),
			this._brewUtil.pLoadMetaIndex(urlRoot),
		]);

		const pathToMeta = {};
		Object.entries(propIndex)
			.forEach(([prop, pathToDir]) => {
				Object.entries(pathToDir)
					.forEach(([path, dir]) => {
						pathToMeta[path] = pathToMeta[path] || {dir, props: []};
						pathToMeta[path].props.push(prop);
					});
			});

		this._dataList = Object.entries(pathToMeta)
			.map(([path, meta]) => {
				const out = {
					download_url: this._brewUtil.getFileUrl(path, urlRoot),
					path,
					name: UrlUtil.getFilename(path),
					dirProp: this._brewUtil.getDirProp(meta.dir),
					props: meta.props,
				};

				const spl = out.name.trim().replace(/\.json$/, "").split(";").map(it => it.trim());
				if (spl.length > 1) {
					out._brewName = spl[1];
					out._brewAuthor = spl[0];
				} else {
					out._brewName = spl[0];
					out._brewAuthor = this._brewUtil.DEFAULT_AUTHOR;
				}

				out._brewAdded = timestamps[out.path]?.a ?? 0;
				out._brewModified = timestamps[out.path]?.m ?? 0;
				out._brewInternalSources = metaIndex[out.name]?.n || [];
				out._brewStatus = metaIndex[out.name]?.s || "ready";
				out._brewPropDisplayName = this._brewUtil.getPropDisplayName(out.dirProp);

				return out;
			})
			.sort((a, b) => SortUtil.ascSortLower(a._brewName, b._brewName));
	}

	async pHandlePreCloseModal ({rdState}) {
		// region If the user has selected list items, prompt to load them before closing the modal
		const cntSel = rdState.list.items.filter(it => it.data.cbSel.checked).length;
		if (!cntSel) return;

		const isSave = await InputUiUtil.pGetUserBoolean({
			title: `Selected ${this._brewUtil.DISPLAY_NAME}`,
			htmlDescription: `You have ${cntSel} ${cntSel === 1 ? this._brewUtil.DISPLAY_NAME : this._brewUtil.DISPLAY_NAME_PLURAL} selected which ${cntSel === 1 ? "is" : "are"} not yet loaded. Would you like to load ${cntSel === 1 ? "it" : "them"}?`,
			textYes: "Load",
			textNo: "Discard",
		});
		if (!isSave) return;

		await this._pHandleClick_btnAddSelected({rdState});
		// endregion
	}

	async pRender ($wrp, {rdState} = {}) {
		rdState = rdState || new this.constructor._RenderState();

		rdState.pageFilter = new this.constructor._PageFilterGetBrew({brewUtil: this._brewUtil});

		const $btnAddSelected = $(`<button class="btn ${this._brewUtil.STYLE_BTN} btn-sm col-0-5 text-center" disabled title="Add Selected"><span class="glyphicon glyphicon-save"></button>`);

		const $wrpRows = $$`<div class="list smooth-scroll max-h-unset"><div class="lst__row ve-flex-col"><div class="lst__wrp-cells lst--border lst__row-inner ve-flex w-100"><i>Loading...</i></div></div></div>`;

		const $btnFilter = $(`<button class="btn btn-default btn-sm">Filter</button>`);

		const $btnToggleSummaryHidden = $(`<button class="btn btn-default" title="Toggle Filter Summary Display"><span class="glyphicon glyphicon-resize-small"></span></button>`);

		const $iptSearch = $(`<input type="search" class="search manbrew__search form-control w-100 lst__search lst__search--no-border-h" placeholder="Find ${this._brewUtil.DISPLAY_NAME}...">`)
			.keydown(evt => this._pHandleKeydown_iptSearch(evt, rdState));
		const $dispCntVisible = $(`<div class="lst__wrp-search-visible no-events ve-flex-vh-center"></div>`);

		rdState.cbAll = e_({
			tag: "input",
			type: "checkbox",
		});

		const $btnReset = $(`<button class="btn btn-default btn-sm">Reset</button>`);

		const $wrpMiniPills = $(`<div class="fltr__mini-view btn-group"></div>`);

		const $wrpSort = $$`<div class="filtertools manbrew__filtertools btn-group input-group input-group--bottom ve-flex no-shrink">
			<label class="col-0-5 pr-0 btn btn-default btn-xs ve-flex-vh-center">${rdState.cbAll}</label>
			<button class="col-3-5 sort btn btn-default btn-xs" data-sort="name">Name</button>
			<button class="col-3 sort btn btn-default btn-xs" data-sort="author">Author</button>
			<button class="col-1-2 sort btn btn-default btn-xs" data-sort="category">Category</button>
			<button class="col-1-4 sort btn btn-default btn-xs" data-sort="modified">Modified</button>
			<button class="col-1-4 sort btn btn-default btn-xs" data-sort="added">Added</button>
			<button class="sort btn btn-default btn-xs ve-grow" disabled>Source</button>
		</div>`;

		$$($wrp)`
		<div class="mt-1"><i>A list of ${this._brewUtil.DISPLAY_NAME} available in the public repository. Click a name to load the ${this._brewUtil.DISPLAY_NAME}, or view the source directly.${this._brewUtil.IS_EDITABLE ? `<br>
		Contributions are welcome; see the <a href="${this._brewUtil.URL_REPO_DEFAULT}/blob/master/README.md" target="_blank" rel="noopener noreferrer">README</a>, or stop by our <a href="https://discord.gg/5etools" target="_blank" rel="noopener noreferrer">Discord</a>.` : ""}</i></div>
		<hr class="hr-3">
		<div class="lst__form-top">
			${$btnAddSelected}
			${$btnFilter}
			${$btnToggleSummaryHidden}
			<div class="w-100 relative">
				${$iptSearch}
				<div id="lst__search-glass" class="lst__wrp-search-glass no-events ve-flex-vh-center"><span class="glyphicon glyphicon-search"></span></div>
				${$dispCntVisible}
			</div>
			${$btnReset}
		</div>
		${$wrpMiniPills}
		${$wrpSort}
		${$wrpRows}`;

		rdState.list = new List({
			$iptSearch,
			$wrpList: $wrpRows,
			fnSort: this._sortUrlList.bind(this),
			isUseJquery: true,
			isFuzzy: true,
			isSkipSearchKeybindingEnter: true,
		});

		rdState.list.on("updated", () => $dispCntVisible.html(`${rdState.list.visibleItems.length}/${rdState.list.items.length}`));

		rdState.listSelectClickHandler = new ListSelectClickHandler({list: rdState.list});
		rdState.listSelectClickHandler.bindSelectAllCheckbox($(rdState.cbAll));
		SortUtil.initBtnSortHandlers($wrpSort, rdState.list);

		this._dataList.forEach((brewInfo, ix) => {
			const {listItem} = this._pRender_getUrlRowMeta(rdState, brewInfo, ix);
			rdState.list.addItem(listItem);
		});

		await rdState.pageFilter.pInitFilterBox({
			$iptSearch: $iptSearch,
			$btnReset: $btnReset,
			$btnOpen: $btnFilter,
			$btnToggleSummaryHidden,
			$wrpMiniPills,
			namespace: `get-homebrew-${UrlUtil.getCurrentPage()}`,
		});

		this._dataList.forEach(it => rdState.pageFilter.mutateAndAddToFilters(it));

		rdState.list.init();

		rdState.pageFilter.trimState();
		rdState.pageFilter.filterBox.render();

		rdState.pageFilter.filterBox.on(
			FilterBox.EVNT_VALCHANGE,
			this._handleFilterChange.bind(this, rdState),
		);

		this._handleFilterChange(rdState);

		$btnAddSelected
			.prop("disabled", false)
			.click(() => this._pHandleClick_btnAddSelected({rdState}));

		$iptSearch.focus();
	}

	_handleFilterChange (rdState) {
		const f = rdState.pageFilter.filterBox.getValues();
		rdState.list.filter(li => rdState.pageFilter.toDisplay(f, this._dataList[li.ix]));
	}

	_pRender_getUrlRowMeta (rdState, brewInfo, ix) {
		const timestampAdded = brewInfo._brewAdded
			? DatetimeUtil.getDateStr({date: new Date(brewInfo._brewAdded * 1000), isShort: true, isPad: true})
			: "";
		const timestampModified = brewInfo._brewModified
			? DatetimeUtil.getDateStr({date: new Date(brewInfo._brewModified * 1000), isShort: true, isPad: true})
			: "";

		const cbSel = e_({
			tag: "input",
			clazz: "no-events",
			type: "checkbox",
		});

		const btnAdd = e_({
			tag: "span",
			clazz: `col-3-5 bold manbrew__load_from_url pl-0 clickable`,
			text: brewInfo._brewName,
			click: evt => this._pHandleClick_btnGetRemote({evt, btn: btnAdd, url: brewInfo.download_url}),
		});

		const eleLi = e_({
			tag: "div",
			clazz: `lst__row lst__row-inner not-clickable lst--border lst__row--focusable no-select`,
			children: [
				e_({
					tag: "div",
					clazz: `lst__wrp-cells ve-flex w-100`,
					children: [
						e_({
							tag: "label",
							clazz: `col-0-5 ve-flex-vh-center ve-self-flex-stretch`,
							children: [cbSel],
						}),
						btnAdd,
						e_({tag: "span", clazz: "col-3", text: brewInfo._brewAuthor}),
						e_({tag: "span", clazz: "col-1-2 text-center mobile__text-clip-ellipsis", text: brewInfo._brewPropDisplayName, title: brewInfo._brewPropDisplayName}),
						e_({tag: "span", clazz: "col-1-4 text-center code", text: timestampModified}),
						e_({tag: "span", clazz: "col-1-4 text-center code", text: timestampAdded}),
						e_({
							tag: "span",
							clazz: "col-1 manbrew__source text-center pr-0",
							children: [
								e_({
									tag: "a",
									text: `View Raw`,
								})
									.attr("href", brewInfo.download_url)
									.attr("target", "_blank")
									.attr("rel", "noopener noreferrer"),
							],
						}),
					],
				}),
			],
			keydown: evt => this._pHandleKeydown_row(evt, {rdState, btnAdd, url: brewInfo.download_url, listItem}),
		})
			.attr("tabindex", ix);

		const listItem = new ListItem(
			ix,
			eleLi,
			brewInfo._brewName,
			{
				author: brewInfo._brewAuthor,
				// category: brewInfo._brewPropDisplayName, // Unwanted in search
				internalSources: brewInfo._brewInternalSources, // Used for search
			},
			{
				btnAdd,
				cbSel,
				pFnDoDownload: ({isLazy = false} = {}) => this._pHandleClick_btnGetRemote({btn: btnAdd, url: brewInfo.download_url, isLazy}),
			},
		);

		eleLi.addEventListener("click", evt => rdState.listSelectClickHandler.handleSelectClick(listItem, evt, {isPassThroughEvents: true}));

		return {
			listItem,
		};
	}

	async _pHandleKeydown_iptSearch (evt, rdState) {
		switch (evt.key) {
			case "Enter": {
				const firstItem = rdState.list.visibleItems[0];
				if (!firstItem) return;
				await firstItem.data.pFnDoDownload();
				return;
			}

			case "ArrowDown": {
				const firstItem = rdState.list.visibleItems[0];
				if (firstItem) {
					evt.stopPropagation();
					evt.preventDefault();
					firstItem.ele.focus();
				}
			}
		}
	}

	async _pHandleClick_btnAddSelected ({rdState}) {
		const listItems = rdState.list.items.filter(it => it.data.cbSel.checked);

		if (!listItems.length) return JqueryUtil.doToast({type: "warning", content: `Please select some ${this._brewUtil.DISPLAY_NAME_PLURAL} first!`});

		if (listItems.length > 25 && !await InputUiUtil.pGetUserBoolean({title: "Are you sure?", htmlDescription: `<div>You area about to load ${listItems.length} ${this._brewUtil.DISPLAY_NAME} files.<br>Loading large quantities of ${this._brewUtil.DISPLAY_NAME_PLURAL} can lead to performance and stability issues.</div>`, textYes: "Continue"})) return;

		rdState.cbAll.checked = false;
		rdState.list.items.forEach(item => {
			item.data.cbSel.checked = false;
			item.ele.classList.remove("list-multi-selected");
		});

		await Promise.allSettled(listItems.map(it => it.data.pFnDoDownload({isLazy: true})));
		await this._brewUtil.pAddBrewsLazyFinalize();
		JqueryUtil.doToast(`Finished loading selected ${this._brewUtil.DISPLAY_NAME}!`);
	}

	async _pHandleClick_btnGetRemote ({evt, btn, url, isLazy}) {
		if (!(url || "").trim()) return JqueryUtil.doToast({type: "danger", content: `${this._brewUtil.DISPLAY_NAME.uppercaseFirst()} had no download URL!`});

		if (evt) {
			evt.stopPropagation();
			evt.preventDefault();
		}

		const cachedHtml = btn.html();
		btn.txt("Loading...").attr("disabled", true);
		const brewsAdded = await this._brewUtil.pAddBrewFromUrl(url, {isLazy});
		this._brewsLoaded.push(...brewsAdded);
		btn.txt("Done!");
		setTimeout(() => btn.html(cachedHtml).attr("disabled", false), VeCt.DUR_INLINE_NOTIFY);
	}

	async _pHandleKeydown_row (evt, {rdState, btnAdd, url, listItem}) {
		switch (evt.key) {
			case "Enter": return this._pHandleClick_btnGetRemote({evt, btn: btnAdd, url});

			case "ArrowUp": {
				const ixCur = rdState.list.visibleItems.indexOf(listItem);

				if (~ixCur) {
					const prevItem = rdState.list.visibleItems[ixCur - 1];
					if (prevItem) {
						evt.stopPropagation();
						evt.preventDefault();
						prevItem.ele.focus();
					}
					return;
				}

				const firstItem = rdState.list.visibleItems[0];
				if (firstItem) {
					evt.stopPropagation();
					evt.preventDefault();
					firstItem.ele.focus();
				}
				return;
			}

			case "ArrowDown": {
				const ixCur = rdState.list.visibleItems.indexOf(listItem);

				if (~ixCur) {
					const nxtItem = rdState.list.visibleItems[ixCur + 1];
					if (nxtItem) {
						evt.stopPropagation();
						evt.preventDefault();
						nxtItem.ele.focus();
					}
					return;
				}

				const lastItem = rdState.list.visibleItems.last();
				if (lastItem) {
					evt.stopPropagation();
					evt.preventDefault();
					lastItem.ele.focus();
				}
			}
		}
	}
}

class ManageEditableBrewContentsUi extends BaseComponent {
	static _RenderState = class {
		constructor () {
			this.tabMetaEntities = null;
			this.tabMetaSources = null;

			this.listEntities = null;
			this.listEntitiesSelectClickHandler = null;
			this.listSources = null;
			this.listSourcesSelectClickHandler = null;

			this.contentEntities = null;
			this.pageFilterEntities = new ManageEditableBrewContentsUi._PageFilter();
		}
	};

	static _PageFilter = class extends PageFilter {
		constructor () {
			super();
			this._categoryFilter = new Filter({header: "Category"});
		}

		static mutateForFilters (meta) {
			const {ent, prop} = meta;
			meta._fSource = SourceUtil.getEntitySource(ent);
			meta._fCategory = ManageEditableBrewContentsUi._getDisplayProp({ent, prop});
		}

		addToFilters (meta) {
			this._sourceFilter.addItem(meta._fSource);
			this._categoryFilter.addItem(meta._fCategory);
		}

		async _pPopulateBoxOptions (opts) {
			opts.filters = [
				this._sourceFilter,
				this._categoryFilter,
			];
		}

		toDisplay (values, meta) {
			return this._filterBox.toDisplay(
				values,
				meta._fSource,
				meta._fCategory,
			);
		}
	};

	static async pDoOpen ({brewUtil, brew, isModal: isParentModal = false}) {
		return new Promise((resolve, reject) => {
			const ui = new this({brewUtil, brew, isModal: true});
			const rdState = new this._RenderState();
			const {$modalInner} = UiUtil.getShowModal({
				isHeight100: true,
				title: `Manage Document Contents`,
				isUncappedHeight: true,
				isWidth100: true,
				$titleSplit: $$`<div class="ve-flex-v-center btn-group">
					${ui._$getBtnDeleteSelected({rdState})}
				</div>`,
				overlayColor: isParentModal ? "transparent" : undefined,
				cbClose: () => {
					resolve(ui._getFormData());
					rdState.pageFilterEntities.filterBox.teardown();
				},
			});
			ui.pRender($modalInner, {rdState})
				.catch(e => reject(e));
		});
	}

	constructor ({brewUtil, brew, isModal}) {
		super();

		TabUiUtil.decorate(this, {isInitMeta: true});

		this._brewUtil = brewUtil;
		this._brew = MiscUtil.copyFast(brew);
		this._isModal = isModal;

		this._isDirty = false;
	}

	_getFormData () {
		return {
			isDirty: this._isDirty,
			brew: this._brew,
		};
	}

	_$getBtnDeleteSelected ({rdState}) {
		return $(`<button class="btn btn-danger btn-xs">Delete Selected</button>`)
			.click(() => this._handleClick_pButtonDeleteSelected({rdState}));
	}

	async _handleClick_pButtonDeleteSelected ({rdState}) {
		if (this._getActiveTab() === rdState.tabMetaEntities) return this._handleClick_pButtonDeleteSelected_entities({rdState});
		if (this._getActiveTab() === rdState.tabMetaSources) return this._handleClick_pButtonDeleteSelected_sources({rdState});
		// (The metadata tab does not have any selectable elements, so, no-op)
	}

	async _handleClick_pButtonDeleteSelected_entities ({rdState}) {
		const listItemsSel = rdState.listEntities.items
			.filter(it => it.data.cbSel.checked);

		if (!listItemsSel.length) return;

		if (!await InputUiUtil.pGetUserBoolean({title: "Delete Entities", htmlDescription: `Are you sure you want to delete the ${listItemsSel.length === 1 ? "selected entity" : `${listItemsSel.length} selected entities`}?`, textYes: "Yes", textNo: "Cancel"})) return;

		this._isDirty = true;

		// Remove the array items from our copy of the brew, and remove the corresponding list items
		listItemsSel
			.forEach(li => this._doEntityListDelete({rdState, li}));
		rdState.listEntities.update();
	}

	_doEntityListDelete ({rdState, li}) {
		const ix = this._brew.body[li.data.prop].indexOf(li.data.ent);
		if (!~ix) return;
		this._brew.body[li.data.prop].splice(ix, 1);
		if (!this._brew.body[li.data.prop].length) delete this._brew.body[li.data.prop];
		rdState.listEntities.removeItem(li);
	}

	async _handleClick_pButtonDeleteSelected_sources ({rdState}) {
		const listItemsSel = rdState.listSources.items
			.filter(it => it.data.cbSel.checked);

		if (!listItemsSel.length) return;

		if (
			!await InputUiUtil.pGetUserBoolean({
				title: "Delete Sources",
				htmlDescription: `<div>Are you sure you want to delete the ${listItemsSel.length === 1 ? "selected source" : `${listItemsSel.length} selected sources`}?<br><b>This will delete all entities with ${listItemsSel.length === 1 ? "that source" : `these sources`}</b>.</div>`,
				textYes: "Yes",
				textNo: "Cancel",
			})
		) return;

		this._isDirty = true;

		// Remove the sources from our copy of the brew, and remove the corresponding list items
		listItemsSel
			.forEach(li => {
				const ix = this._brew.body._meta.sources.indexOf(li.data.source);
				if (!~ix) return;
				this._brew.body._meta.sources.splice(ix, 1);
				rdState.listSources.removeItem(li);
			});
		rdState.listSources.update();

		// Remove all entities with matching sources, and remove the corresponding list items
		const sourceSetRemoved = new Set(listItemsSel.map(li => li.data.source.json));
		rdState.listEntities.visibleItems
			.forEach(li => {
				const source = SourceUtil.getEntitySource(li.data.ent);
				if (!sourceSetRemoved.has(source)) return;

				this._doEntityListDelete({rdState, li});
			});
		rdState.listEntities.update();
	}

	async pRender ($wrp, {rdState = null} = {}) {
		rdState = rdState || new this.constructor._RenderState();

		const iptTabMetas = [
			new TabUiUtil.TabMeta({name: "Entities", hasBorder: true}),
			new TabUiUtil.TabMeta({name: "Metadata", hasBorder: true}),
			new TabUiUtil.TabMeta({name: "Sources", hasBorder: true}),
		];

		const tabMetas = this._renderTabs(iptTabMetas, {$parent: $wrp});
		const [tabMetaEntities, tabMetaMetadata, tabMetaSources] = tabMetas;

		rdState.tabMetaEntities = tabMetaEntities;
		rdState.tabMetaSources = tabMetaSources;

		this._pRender_tabEntities({tabMeta: tabMetaEntities, rdState});
		this._pRender_tabMetadata({tabMeta: tabMetaMetadata, rdState});
		this._pRender_tabSources({tabMeta: tabMetaSources, rdState});
	}

	_pRender_tabEntities ({tabMeta, rdState}) {
		const $btnFilter = $(`<button class="btn btn-default">Filter</button>`);

		const $btnToggleSummaryHidden = $(`<button class="btn btn-default" title="Toggle Filter Summary Display"><span class="glyphicon glyphicon-resize-small"></span></button>`);

		const $btnReset = $(`<button class="btn btn-default">Reset</button>`);

		const $wrpMiniPills = $(`<div class="fltr__mini-view btn-group"></div>`);

		const $cbAll = $(`<input type="checkbox">`);
		const $wrpRows = $$`<div class="list ve-flex-col w-100 max-h-unset"></div>`;
		const $iptSearch = $(`<input type="search" class="search manbrew__search form-control w-100 lst__search lst__search--no-border-h" placeholder="Search entries...">`);
		const $dispCntVisible = $(`<div class="lst__wrp-search-visible no-events ve-flex-vh-center"></div>`);
		const $wrpBtnsSort = $$`<div class="filtertools manbrew__filtertools input-group input-group--bottom ve-flex no-shrink">
			<label class="btn btn-default btn-xs col-1 pr-0 ve-flex-vh-center">${$cbAll}</label>
			<button class="col-5 sort btn btn-default btn-xs" data-sort="name">Name</button>
			<button class="col-1 sort btn btn-default btn-xs" data-sort="source">Source</button>
			<button class="col-5 sort btn btn-default btn-xs" data-sort="category">Category</button>
		</div>`;

		$$(tabMeta.$wrpTab)`
		<div class="ve-flex-v-stretch input-group input-group--top no-shrink mt-1">
			${$btnFilter}
			${$btnToggleSummaryHidden}
			<div class="w-100 relative">
				${$iptSearch}
				<div id="lst__search-glass" class="lst__wrp-search-glass no-events ve-flex-vh-center"><span class="glyphicon glyphicon-search"></span></div>
				${$dispCntVisible}
			</div>
			${$btnReset}
		</div>

		${$wrpMiniPills}

		${$wrpBtnsSort}
		${$wrpRows}`;

		rdState.listEntities = new List({
			$iptSearch,
			$wrpList: $wrpRows,
			fnSort: SortUtil.listSort,
		});

		rdState.listEntities.on("updated", () => $dispCntVisible.html(`${rdState.listEntities.visibleItems.length}/${rdState.listEntities.items.length}`));

		rdState.listEntitiesSelectClickHandler = new ListSelectClickHandler({list: rdState.listEntities});
		rdState.listEntitiesSelectClickHandler.bindSelectAllCheckbox($cbAll);
		SortUtil.initBtnSortHandlers($wrpBtnsSort, rdState.listEntities);

		let ixParent = 0;
		rdState.contentEntities = Object.entries(this._brew.body)
			.filter(([, v]) => v instanceof Array && v.length)
			.map(([prop, arr]) => arr.map(ent => ({ent, prop, ixParent: ixParent++})))
			.flat();

		rdState.contentEntities.forEach(({ent, prop, ixParent}) => {
			const {listItem} = this._pRender_getEntityRowMeta({rdState, prop, ent, ixParent});
			rdState.listEntities.addItem(listItem);
		});

		rdState.pageFilterEntities.pInitFilterBox({
			$iptSearch: $iptSearch,
			$btnReset: $btnReset,
			$btnOpen: $btnFilter,
			$btnToggleSummaryHidden: $btnToggleSummaryHidden,
			$wrpMiniPills: $wrpMiniPills,
			namespace: `${this.constructor.name}__tabEntities`,
		}).then(async () => {
			rdState.contentEntities.forEach(meta => rdState.pageFilterEntities.mutateAndAddToFilters(meta));

			rdState.listEntities.init();

			rdState.pageFilterEntities.trimState();
			rdState.pageFilterEntities.filterBox.render();

			rdState.pageFilterEntities.filterBox.on(
				FilterBox.EVNT_VALCHANGE,
				this._handleFilterChange_entities.bind(this, {rdState}),
			);

			this._handleFilterChange_entities({rdState});

			$iptSearch.focus();
		});
	}

	_handleFilterChange_entities ({rdState}) {
		const f = rdState.pageFilterEntities.filterBox.getValues();
		rdState.listEntities.filter(li => rdState.pageFilterEntities.toDisplay(f, rdState.contentEntities[li.ix]));
	}

	_pRender_getEntityRowMeta ({rdState, prop, ent, ixParent}) {
		const eleLi = document.createElement("div");
		eleLi.className = "lst__row ve-flex-col px-0";

		const dispName = this.constructor._getDisplayName({brew: this._brew, ent, prop});
		const sourceMeta = this.constructor._getSourceMeta({brew: this._brew, ent});
		const dispProp = this.constructor._getDisplayProp({ent, prop});

		eleLi.innerHTML = `<label class="lst--border lst__row-inner no-select mb-0 ve-flex-v-center">
			<div class="pl-0 col-1 ve-flex-vh-center"><input type="checkbox" class="no-events"></div>
			<div class="col-5 bold">${dispName}</div>
			<div class="col-1 text-center" title="${(sourceMeta.full || "").qq()}" ${this._brewUtil.sourceToStyle(sourceMeta)}>${sourceMeta.abbreviation}</div>
			<div class="col-5 ve-flex-vh-center pr-0">${dispProp}</div>
		</label>`;

		const listItem = new ListItem(
			ixParent, // We identify the item in the list according to its position across all props
			eleLi,
			dispName,
			{
				source: sourceMeta.abbreviation,
				category: dispProp,
			},
			{
				cbSel: eleLi.firstElementChild.firstElementChild.firstElementChild,
				prop,
				ent,
			},
		);

		eleLi.addEventListener("click", evt => rdState.listEntitiesSelectClickHandler.handleSelectClick(listItem, evt));

		return {
			listItem,
		};
	}

	_pRender_tabMetadata ({tabMeta, rdState}) {
		const infoTuples = Object.entries(this.constructor._PROP_INFOS_META).filter(([k]) => Object.keys(this._brew.body?._meta?.[k] || {}).length);

		if (!infoTuples.length) {
			$$(tabMeta.$wrpTab)`
				<h4>Metadata</h4>
				<p><i>No metadata found.</i></p>
			`;
			return;
		}

		const metasSections = infoTuples
			.map(([prop, info]) => this._pRender_getMetaRowMeta({prop, info}));

		$$(tabMeta.$wrpTab)`
			<div class="pt-2"><i>Warning: deleting metadata may invalidate or otherwise corrupt homebrew which depends on it. Use with caution.</i></div>
			<hr class="hr-3">
			${metasSections.map(({$wrp}) => $wrp)}
		`;
	}

	_pRender_getMetaRowMeta ({prop, info}) {
		const displayName = info.displayName || prop.toTitleCase();
		const displayFn = info.displayFn || ((...args) => args.last().toTitleCase());

		const $rows = Object.keys(this._brew.body._meta[prop])
			.map(k => {
				const $btnDelete = $(`<button class="btn btn-danger btn-xs" title="Delete"><span class="glyphicon glyphicon-trash"></span></button>`)
					.click(() => {
						this._isDirty = true;
						MiscUtil.deleteObjectPath(this._brew.body._meta, prop, k);
						$row.remove();

						// If we deleted the last key and the whole prop has therefore been cleaned up, delete the section
						if (this._brew.body._meta[prop]) return;

						$wrp.remove();
					});

				const $row = $$`<div class="lst__row ve-flex-col px-0">
					<div class="split-v-center lst--border lst__row-inner no-select mb-0 ve-flex-v-center">
						<div class="col-10">${displayFn(this._brew, prop, k)}</div>
						<div class="col-2 btn-group ve-flex-v-center ve-flex-h-right">
							${$btnDelete}
						</div>
					</div>
				</div>`;

				return $row;
			});

		const $wrp = $$`<div class="ve-flex-col mb-4">
			<div class="bold mb-2">${displayName}:</div>
			<div class="ve-flex-col list-display-only">${$rows}</div>
		</div>`;

		return {
			$wrp,
		};
	}

	_pRender_tabSources ({tabMeta, rdState}) {
		const $cbAll = $(`<input type="checkbox">`);
		const $wrpRows = $$`<div class="list ve-flex-col w-100 max-h-unset"></div>`;
		const $iptSearch = $(`<input type="search" class="search manbrew__search form-control w-100 mt-1" placeholder="Search source...">`);
		const $wrpBtnsSort = $$`<div class="filtertools manbrew__filtertools input-group input-group--bottom ve-flex no-shrink">
			<label class="btn btn-default btn-xs col-1 pr-0 ve-flex-vh-center">${$cbAll}</label>
			<button class="col-5 sort btn btn-default btn-xs" data-sort="name">Name</button>
			<button class="col-2 sort btn btn-default btn-xs" data-sort="abbreviation">Abbreviation</button>
			<button class="col-4 sort btn btn-default btn-xs" data-sort="json">JSON</button>
		</div>`;

		$$(tabMeta.$wrpTab)`
		${$iptSearch}
		${$wrpBtnsSort}
		${$wrpRows}`;

		rdState.listSources = new List({
			$iptSearch,
			$wrpList: $wrpRows,
			fnSort: SortUtil.listSort,
		});

		rdState.listSourcesSelectClickHandler = new ListSelectClickHandler({list: rdState.listSources});
		rdState.listSourcesSelectClickHandler.bindSelectAllCheckbox($cbAll);
		SortUtil.initBtnSortHandlers($wrpBtnsSort, rdState.listSources);

		(this._brew.body?._meta?.sources || [])
			.forEach((source, ix) => {
				const {listItem} = this._pRender_getSourceRowMeta({rdState, source, ix});
				rdState.listSources.addItem(listItem);
			});

		rdState.listSources.init();
		$iptSearch.focus();
	}

	_pRender_getSourceRowMeta ({rdState, source, ix}) {
		const eleLi = document.createElement("div");
		eleLi.className = "lst__row ve-flex-col px-0";

		const name = source.full || _BrewInternalUtil.SOURCE_UNKNOWN_FULL;
		const abv = source.abbreviation || _BrewInternalUtil.SOURCE_UNKNOWN_ABBREVIATION;

		eleLi.innerHTML = `<label class="lst--border lst__row-inner no-select mb-0 ve-flex-v-center">
			<div class="pl-0 col-1 ve-flex-vh-center"><input type="checkbox" class="no-events"></div>
			<div class="col-5 bold">${name}</div>
			<div class="col-2 text-center">${abv}</div>
			<div class="col-4 ve-flex-vh-center pr-0">${source.json}</div>
		</label>`;

		const listItem = new ListItem(
			ix,
			eleLi,
			name,
			{
				abbreviation: abv,
				json: source.json,
			},
			{
				cbSel: eleLi.firstElementChild.firstElementChild.firstElementChild,
				source,
			},
		);

		eleLi.addEventListener("click", evt => rdState.listSourcesSelectClickHandler.handleSelectClick(listItem, evt));

		return {
			listItem,
		};
	}

	static _NAME_UNKNOWN = "(Unknown)";

	static _getDisplayName ({brew, ent, prop}) {
		switch (prop) {
			case "itemProperty": {
				if (ent.name) return ent.name || this._NAME_UNKNOWN;
				if (ent.entries) {
					const name = Renderer.findName(ent.entries);
					if (name) return name;
				}
				if (ent.entriesTemplate) {
					const name = Renderer.findName(ent.entriesTemplate);
					if (name) return name;
				}
				return ent.abbreviation || this._NAME_UNKNOWN;
			}

			case "adventureData":
			case "bookData": {
				const propContents = prop === "adventureData" ? "adventure" : "book";

				if (!brew[propContents]) return ent.id || this._NAME_UNKNOWN;

				return brew[propContents].find(it => it.id === ent.id)?.name || ent.id || this._NAME_UNKNOWN;
			}

			default: return ent.name || this._NAME_UNKNOWN;
		}
	}

	static _getSourceMeta ({brew, ent}) {
		const entSource = SourceUtil.getEntitySource(ent);
		if (!entSource) return {abbreviation: _BrewInternalUtil.SOURCE_UNKNOWN_ABBREVIATION, full: _BrewInternalUtil.SOURCE_UNKNOWN_FULL};
		const source = (brew.body?._meta?.sources || []).find(src => src.json === entSource);
		if (!source) return {abbreviation: _BrewInternalUtil.SOURCE_UNKNOWN_ABBREVIATION, full: _BrewInternalUtil.SOURCE_UNKNOWN_FULL};
		return source;
	}

	static _getDisplayProp ({ent, prop}) {
		const out = [Parser.getPropDisplayName(prop)];

		switch (prop) {
			case "subclass": out.push(` (${ent.className})`); break;
			case "subrace": out.push(` (${ent.raceName})`); break;
			case "psionic": out.push(` (${Parser.psiTypeToMeta(ent.type).short})`); break;
		}

		return out.filter(Boolean).join(" ");
	}

	/** These are props found in "_meta" sections of files */
	static _PROP_INFOS_META = {
		"spellDistanceUnits": {
			displayName: "Spell Distance Units",
		},
		"spellSchools": {
			displayName: "Spell Schools",
			displayFn: (brew, propMeta, k) => brew.body._meta[propMeta][k].full || k,
		},
		"currencyConversions": {
			displayName: "Currency Conversion Tables",
			displayFn: (brew, propMeta, k) => `${k}: ${brew.body._meta[propMeta][k].map(it => `${it.coin}=${it.mult}`).join(", ")}`,
		},
		"skills": {
			displayName: "Skills",
		},
		"senses": {
			displayName: "Senses",
		},
		"optionalFeatureTypes": {
			displayName: "Optional Feature Types",
			displayFn: (brew, propMeta, k) => brew.body._meta[propMeta][k] || k,
		},
		"charOption": {
			displayName: "Character Creation Option Types",
			displayFn: (brew, propMeta, k) => brew.body._meta[propMeta][k] || k,
		},
		"psionicTypes": {
			displayName: "Psionic Types",
			displayFn: (brew, propMeta, k) => brew.body._meta[propMeta][k].full || k,
		},
	};
}
