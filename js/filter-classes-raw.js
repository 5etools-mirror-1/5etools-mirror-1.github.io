"use strict";

// TODO refactor the "feature" parts of this to a `PageFilterFeatures`
class PageFilterClassesRaw extends PageFilterClassesBase {
	async _pPopulateBoxOptions (opts) {
		await super._pPopulateBoxOptions(opts);
		opts.isCompact = false;
	}

	/**
	 * @param cls
	 * @param isExcluded
	 * @param opts Options object.
	 * @param [opts.subclassExclusions] Map of `source:name:bool` indicating if each subclass is excluded or not.
	 */
	addToFilters (cls, isExcluded, opts) {
		if (isExcluded) return;
		opts = opts || {};
		const subclassExclusions = opts.subclassExclusions || {};

		this._sourceFilter.addItem(cls.source);

		if (cls.fluff) cls.fluff.forEach(it => this._addEntrySourcesToFilter(it));

		cls.classFeatures.forEach(feature => feature.loadeds.forEach(ent => this._addEntrySourcesToFilter(ent.entity)));

		cls.subclasses.forEach(sc => {
			const isScExcluded = (subclassExclusions[sc.source] || {})[sc.name] || false;
			if (!isScExcluded) {
				this._sourceFilter.addItem(sc.source);
				sc.subclassFeatures.forEach(feature => feature.loadeds.forEach(ent => this._addEntrySourcesToFilter(ent.entity)));
			}
		});
	}

	// region Data loading
	static async _pGetParentClass (sc) {
		// Search in base classes
		let baseClass = (await DataUtil.class.loadRawJSON()).class.find(bc => bc.name.toLowerCase() === sc.className.toLowerCase() && (bc.source.toLowerCase() || SRC_PHB) === sc.classSource.toLowerCase());

		// Search in brew classes
		if (!baseClass) {
			baseClass = (BrewUtil.homebrew.class || []).find(bc => bc.name.toLowerCase() === sc.className.toLowerCase() && (bc.source.toLowerCase() || SRC_PHB) === sc.classSource.toLowerCase());
		}

		return baseClass;
	}

	static async pPostLoad (data) {
		data = MiscUtil.copy(data);

		// Ensure homebrew is initialised
		await BrewUtil.pAddBrewData();

		if (!data.class) data.class = [];

		// Attach subclasses to parent classes
		if (data.subclass) {
			// Do this sequentially, to avoid double-adding the same base classes
			for (const sc of data.subclass) {
				if (!sc.className) continue; // Subclass class name is required
				sc.classSource = sc.classSource || SRC_PHB;

				let cls = data.class.find(it => (it.name || "").toLowerCase() === sc.className.toLowerCase() && (it.source || SRC_PHB).toLowerCase() === sc.classSource.toLowerCase());

				if (!cls) {
					cls = await this._pGetParentClass(sc);
					if (cls) {
						// If a base class exists, make a stripped-down copy and override its subclasses with our own
						cls = MiscUtil.copy(cls);
						cls.subclasses = [];
						data.class.push(cls);
					} else {
						// Fall back on pushing a dummy class to the array, and we can handle its lack of content elsewhere
						cls = {name: sc.className, source: sc.classSource};
						data.class.push(cls);
					}
				}

				(cls.subclasses = cls.subclasses || []).push(sc);
			}

			delete data.subclass;
		}

		// Clean and initialise fields; sort arrays
		data.class.forEach(cls => {
			cls.source = cls.source || SRC_PHB;

			cls.subclasses = cls.subclasses || [];

			cls.subclasses.forEach(sc => {
				sc.name = sc.name || "(Unnamed subclass)";
				sc.source = sc.source || cls.source;
				sc.className = sc.className || cls.name;
				sc.classSource = sc.classSource || cls.source || SRC_PHB;
			});

			cls.subclasses.sort((a, b) => SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source || cls.source, b.source || cls.source));

			cls._cntStartingSkillChoices = (MiscUtil.get(cls, "startingProficiencies", "skills") || [])
				.map(it => it.choose ? (it.choose.count || 1) : 0)
				.reduce((a, b) => a + b, 0);

			cls._cntStartingSkillChoicesMutliclass = (MiscUtil.get(cls, "multiclassing", "proficienciesGained", "skills") || [])
				.map(it => it.choose ? (it.choose.count || 1) : 0)
				.reduce((a, b) => a + b, 0);
		});
		data.class.sort((a, b) => SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source));

		// Expand class/subclass feature references to "object" form
		data.class.forEach(cls => {
			cls.classFeatures = (cls.classFeatures || []).map(cf => typeof cf === "string" ? {classFeature: cf} : cf);

			(cls.subclasses || []).forEach(sc => {
				sc.subclassFeatures = (sc.subclassFeatures || []).map(cf => typeof cf === "string" ? {subclassFeature: cf} : cf);
			});
		});

		// Load linked features
		// Load the data once before diving into nested promises, to avoid needless context switching
		await this._pPreloadSideData();

		await Promise.all(data.class.map(async cls => {
			await Promise.all((cls.classFeatures || []).map(cf => this.pInitClassFeatureLoadeds({classFeature: cf, className: cls.name})));

			if (cls.classFeatures) cls.classFeatures = cls.classFeatures.filter(it => !it.isIgnored);

			await Promise.all((cls.subclasses || []).map(async sc => {
				await Promise.all((sc.subclassFeatures || []).map(scf => this.pInitSubclassFeatureLoadeds({subclassFeature: scf, className: cls.name, subclassName: sc.name})));

				if (sc.subclassFeatures) sc.subclassFeatures = sc.subclassFeatures.filter(it => !it.isIgnored);
			}));
		}));

		return data.class;
	}

	static async pInitClassFeatureLoadeds ({classFeature, className}) {
		if (typeof classFeature !== "object") throw new Error(`Expected an object of the form {classFeature: "<UID>"}`);

		const unpacked = DataUtil.class.unpackUidClassFeature(classFeature.classFeature);

		classFeature.hash = UrlUtil.URL_TO_HASH_BUILDER["classFeature"](unpacked);

		const {name, level, source} = unpacked;
		classFeature.name = name;
		classFeature.level = level;
		classFeature.source = source;

		const entityRoot = await Renderer.hover.pCacheAndGet("raw_classFeature", classFeature.source, classFeature.hash, {isCopy: true});
		const loadedRoot = {
			type: "classFeature",
			entity: entityRoot,
			page: "classFeature",
			source: classFeature.source,
			hash: classFeature.hash,
			className,
		};

		const isIgnored = await this._pGetIgnoredAndApplySideData(entityRoot, "classFeature");
		if (isIgnored) {
			classFeature.isIgnored = true;
			return;
		}

		const subLoadeds = await this._pLoadSubEntries(
			this._getPostLoadWalker(),
			entityRoot,
			{
				ancestorType: "classFeature",
				ancestorMeta: {
					_ancestorClassName: className,
				},
			},
		);

		classFeature.loadeds = [loadedRoot, ...subLoadeds];
	}

	static async pInitSubclassFeatureLoadeds ({subclassFeature, className, subclassName}) {
		if (typeof subclassFeature !== "object") throw new Error(`Expected an object of the form {subclassFeature: "<UID>"}`);

		const unpacked = DataUtil.class.unpackUidSubclassFeature(subclassFeature.subclassFeature);

		subclassFeature.hash = UrlUtil.URL_TO_HASH_BUILDER["subclassFeature"](unpacked);

		const {name, level, source} = unpacked;
		subclassFeature.name = name;
		subclassFeature.level = level;
		subclassFeature.source = source;

		const entityRoot = await Renderer.hover.pCacheAndGet("raw_subclassFeature", subclassFeature.source, subclassFeature.hash, {isCopy: true});
		const loadedRoot = {
			type: "subclassFeature",
			entity: entityRoot,
			page: "subclassFeature",
			source: subclassFeature.source,
			hash: subclassFeature.hash,
			className,
			subclassName,
		};

		const isIgnored = await this._pGetIgnoredAndApplySideData(entityRoot, "subclassFeature");
		if (isIgnored) {
			subclassFeature.isIgnored = true;
			return;
		}

		if (entityRoot.isGainAtNextFeatureLevel) {
			subclassFeature.isGainAtNextFeatureLevel = true;
		}

		const subLoadeds = await this._pLoadSubEntries(
			this._getPostLoadWalker(),
			entityRoot,
			{
				ancestorType: "subclassFeature",
				ancestorMeta: {
					_ancestorClassName: className,
					_ancestorSubclassName: subclassName,
				},
			},
		);

		subclassFeature.loadeds = [loadedRoot, ...subLoadeds];
	}

	static async pInitFeatLoadeds ({feat, raw}) {
		return this._pInitGenericLoadeds({
			ent: feat,
			prop: "feat",
			page: UrlUtil.PG_FEATS,
			propAncestorName: "_ancestorFeatName",
			raw,
		});
	}

	static async pInitOptionalFeatureLoadeds ({optionalfeature, raw}) {
		return this._pInitGenericLoadeds({
			ent: optionalfeature,
			prop: "optionalfeature",
			page: UrlUtil.PG_OPT_FEATURES,
			propAncestorName: "_ancestorOptionalfeatureName",
			raw,
		});
	}

	static async pInitRewardLoadeds ({reward, raw}) {
		return this._pInitGenericLoadeds({
			ent: reward,
			prop: "reward",
			page: UrlUtil.PG_REWARDS,
			propAncestorName: "_ancestorRewardName",
			raw,
		});
	}

	static async pInitCharCreationOptionLoadeds ({charoption, raw}) {
		return this._pInitGenericLoadeds({
			ent: charoption,
			prop: "charoption",
			page: UrlUtil.PG_CHAR_CREATION_OPTIONS,
			propAncestorName: "_ancestorCharoptionName",
			raw,
		});
	}

	static async _pInitGenericLoadeds ({ent, prop, page, propAncestorName, raw}) {
		if (typeof ent !== "object") throw new Error(`Expected an object of the form {${prop}: "<UID>"}`);

		const unpacked = DataUtil.generic.unpackUid(ent[prop]);

		ent.hash = UrlUtil.URL_TO_HASH_BUILDER[page](unpacked);

		const {name, source} = unpacked;
		ent.name = name;
		ent.source = source;

		const entityRoot = raw != null ? MiscUtil.copy(raw) : await Renderer.hover.pCacheAndGet(`raw_${prop}`, ent.source, ent.hash, {isCopy: true});
		const loadedRoot = {
			type: prop,
			entity: entityRoot,
			page,
			source: ent.source,
			hash: ent.hash,
		};

		const isIgnored = await this._pGetIgnoredAndApplySideData(entityRoot, prop);
		if (isIgnored) {
			ent.isIgnored = true;
			return;
		}

		const subLoadeds = await this._pLoadSubEntries(
			this._getPostLoadWalker(),
			entityRoot,
			{
				ancestorType: prop,
				ancestorMeta: {
					[propAncestorName]: entityRoot.name,
				},
			},
		);

		ent.loadeds = [loadedRoot, ...subLoadeds];
	}

	/**
	 * Pre-load any side data which is to be merged into the main data.
	 */
	static async _pPreloadSideData () { /* Implement as required */ }

	/**
	 * Get side data which is to be merged into the main data.
	 */
	static async _pGetSideData (entity, type) { return null; }

	/**
	 *  Apply side data, and check for ignored features.
	 */
	static async _pGetIgnoredAndApplySideData (entity, type) {
		switch (type) {
			case "classFeature":
			case "subclassFeature":
			case "optionalfeature":
			case "feat":
			case "reward":
			default: {
				const sideData = await this._pGetSideData(entity, type);

				if (!sideData) return false;
				if (sideData.isIgnored) return true;

				if (sideData.entries) entity.entries = MiscUtil.copy(sideData.entries);
				if (sideData.entryData) entity.entryData = MiscUtil.copy(sideData.entryData);

				break;
			}
		}
		return false;
	}

	/**
	 * Walk the data, loading references.
	 */
	static async _pLoadSubEntries (walker, loadedRoot, {ancestorType, ancestorMeta}) {
		const out = [];

		const pRecurse = async toWalk => {
			const references = [];
			const path = [];

			walker.walk(
				toWalk,
				{
					array: (arr) => {
						arr = arr.filter(it => {
							if (it.type !== "refClassFeature" && it.type !== "refSubclassFeature" && it.type !== "refOptionalfeature") return true;

							it.parentName = (path.last() || {}).name;
							references.push(it);

							return false;
						});
						return arr;
					},
					preObject: (obj) => {
						if (obj.type === "options") {
							// Add metadata to options--only if they have a "count" specified, otherwise we assume
							//   that the entire option set is to be imported as per regular features.
							if (obj.count != null) {
								const optionSetId = CryptUtil.uid();
								obj.entries.forEach(ent => {
									ent._optionsMeta = {
										setId: optionSetId,
										count: obj.count,
										name: (path.last() || {}).name,
									};
								});
							}

							const parentName = MiscUtil.get(path.last(), "name");
							if (parentName) {
								obj.entries.forEach(ent => {
									if (typeof ent !== "object") return;
									ent._displayNamePrefix = `${parentName}: `;
								});
							}
						}

						if (obj.name) path.push(obj);
					},
					postObject: (obj) => {
						if (obj.name) path.pop();
					},
				},
			);

			for (const ent of references) {
				const isRequiredOption = !!MiscUtil.get(ent, "data", "isRequiredOption");
				switch (ent.type) {
					case "refClassFeature": {
						const unpacked = DataUtil.class.unpackUidClassFeature(ent.classFeature);
						const {source} = unpacked;
						const hash = UrlUtil.URL_TO_HASH_BUILDER["classFeature"](unpacked);

						const entity = await Renderer.hover.pCacheAndGet("raw_classFeature", source, hash, {isCopy: true});

						if (!entity) {
							this._handleReferenceError(`Failed to load "classFeature" reference "${ent.classFeature}"`);
							continue;
						}

						const isIgnored = await this._pGetIgnoredAndApplySideData(entity, "classFeature");
						if (isIgnored) continue;

						this.populateEntityTempData({
							entity,
							displayName: ent._displayNamePrefix ? `${ent._displayNamePrefix}${entity.name}` : null,
							...ancestorMeta,
						});

						out.push({
							type: "classFeature",
							entry: `{@classFeature ${ent.classFeature}}`,
							entity,
							optionsMeta: ent._optionsMeta,
							page: "classFeature",
							source,
							hash,
							isRequiredOption,
						});

						await pRecurse(entity);

						break;
					}
					case "refSubclassFeature": {
						const unpacked = DataUtil.class.unpackUidSubclassFeature(ent.subclassFeature);
						const {source} = unpacked;
						const hash = UrlUtil.URL_TO_HASH_BUILDER["subclassFeature"](unpacked);

						const entity = await Renderer.hover.pCacheAndGet("raw_subclassFeature", source, hash, {isCopy: true});

						if (!entity) {
							this._handleReferenceError(`Failed to load "subclassFeature" reference "${ent.subclassFeature}"`);
							continue;
						}

						const isIgnored = await this._pGetIgnoredAndApplySideData(entity, "subclassFeature");
						if (isIgnored) continue;

						this.populateEntityTempData({
							entity,
							displayName: ent._displayNamePrefix ? `${ent._displayNamePrefix}${entity.name}` : null,
							...ancestorMeta,
						});

						out.push({
							type: "subclassFeature",
							entry: `{@subclassFeature ${ent.subclassFeature}}`,
							entity,
							optionsMeta: ent._optionsMeta,
							page: "subclassFeature",
							source,
							hash,
							isRequiredOption,
						});

						await pRecurse(entity);

						break;
					}
					case "refOptionalfeature": {
						const unpacked = DataUtil.generic.unpackUid(ent.optionalfeature, "optfeature");
						const page = UrlUtil.PG_OPT_FEATURES;
						const {source} = unpacked;
						const hash = UrlUtil.URL_TO_HASH_BUILDER[page](unpacked);

						const entity = await Renderer.hover.pCacheAndGet(page, source, hash, {isCopy: true});

						if (!entity) {
							this._handleReferenceError(`Failed to load "optfeature" reference "${ent.optionalfeature}"`);
							continue;
						}

						const isIgnored = await this._pGetIgnoredAndApplySideData(entity, "optionalfeature");
						if (isIgnored) continue;

						this.populateEntityTempData({
							entity,
							// Cache this so we can determine if this optional feature is from a "classFeature" or a "subclassFeature"
							ancestorType,
							displayName: ent._displayNamePrefix ? `${ent._displayNamePrefix}${entity.name}` : null,
							...ancestorMeta,
							foundryData: {
								requirements: `${loadedRoot.className} ${loadedRoot.level}${loadedRoot.subclassShortName ? ` (${loadedRoot.subclassShortName})` : ""}`,
							},
						});

						out.push({
							type: "optionalfeature",
							entry: `{@optfeature ${ent.optionalfeature}}`,
							entity,
							optionsMeta: ent._optionsMeta,
							page,
							source,
							hash,
							isRequiredOption,
						});

						break;
					}
					default: throw new Error(`Unhandled type "${ent.type}"`);
				}
			}
		};

		await pRecurse(loadedRoot);

		return out;
	}

	static populateEntityTempData (
		{
			entity,
			ancestorType,
			displayName,
			foundryData,
			...others
		},
	) {
		if (ancestorType) entity._ancestorType = ancestorType;
		if (displayName) entity._displayName = displayName;
		if (foundryData) entity._foundryData = foundryData;
		Object.assign(entity, {...others});
	}

	static _handleReferenceError (msg) {
		JqueryUtil.doToast({type: "danger", content: msg});
	}

	static _getPostLoadWalker () {
		PageFilterClassesRaw._WALKER = PageFilterClassesRaw._WALKER || MiscUtil.getWalker({
			keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST,
			isDepthFirst: true,
			isNoModification: true,
		});
		return PageFilterClassesRaw._WALKER;
	}
	// endregion
}
PageFilterClassesRaw._WALKER = null;

class ModalFilterClasses extends ModalFilter {
	/**
	 * @param opts
	 * @param opts.namespace
	 */
	constructor (opts) {
		opts = opts || {};

		super({
			modalTitle: "Class and Subclass",
			pageFilter: new PageFilterClassesRaw(),
			namespace: opts.namespace,
			fnSort: ModalFilterClasses.fnSort,
		});

		this._pLoadingAllData = null;
		this._allData = null;

		this._ixPrevSelectedClass = null;
		this._isClassDisabled = false;
		this._isSubclassDisabled = false;
	}

	get pageFilter () { return this._pageFilter; }

	static fnSort (a, b, opts) {
		const out = SortUtil.listSort(a, b, opts);

		if (opts.sortDir === "desc" && a.data.ixClass === b.data.ixClass && (a.data.ixSubclass != null || b.data.ixSubclass != null)) {
			return a.data.ixSubclass != null ? -1 : 1;
		}

		return out;
	}

	/** Used to fetch the data for a level, given some identifying information from a previous user selection. */
	async pGetSelection (classSubclassMeta) {
		const {className, classSource, subclassName, subclassSource} = classSubclassMeta;

		const allData = await this._pLoadAllData();

		const cls = allData.find(it => it.name === className && it.source === classSource);
		if (!cls) throw new Error(`Could not find class with name "${className}" and source "${classSource}"`);

		const out = {
			class: cls,
		};

		if (subclassName && subclassSource) {
			const sc = cls.subclasses.find(it => it.name === subclassName && it.source === subclassSource);
			if (!sc) throw new Error(`Could not find subclass with name "${subclassName}" and source "${subclassSource}" on class with name "${className}" and source "${classSource}"`);

			out.subclass = sc;
		}

		return out;
	}

	async pGetUserSelection ({filterExpression = null, selectedClass = null, selectedSubclass = null, isClassDisabled = false, isSubclassDisabled = false} = {}) {
		// eslint-disable-next-line no-async-promise-executor
		return new Promise(async resolve => {
			const {$modalInner, doClose} = this._getShowModal(resolve);

			await this.pPreloadHidden($modalInner);

			this._doApplyFilterExpression(filterExpression);

			this._filterCache.$btnConfirm.off("click").click(async () => {
				// Note: use invisible items, as this might be the parent class of a selected subclass
				const checked = this._filterCache.list.items.filter(it => it.data.tglSel.classList.contains("active"));
				const out = {};
				checked.forEach(it => {
					if (it.data.ixSubclass == null) out.class = this._filterCache.allData[it.data.ixClass];
					else out.subclass = this._filterCache.allData[it.data.ixClass].subclasses[it.data.ixSubclass];
				});
				resolve(MiscUtil.copy(out));

				doClose(true);

				ModalFilterClasses._doListDeselectAll(this._filterCache.list);
			});

			// Since the UI gets moved to a new filter window on every call to this method, this state modification is correct.
			this._ixPrevSelectedClass = selectedClass != null
				? this._filterCache.allData.findIndex(it => it.name === selectedClass.name && it.source === selectedClass.source)
				: null;
			this._isClassDisabled = isClassDisabled;
			this._isSubclassDisabled = isSubclassDisabled;
			this._filterCache.list.items.forEach(li => {
				const isScLi = li.data.ixSubclass != null;
				if (isScLi) {
					li.data.tglSel.classList.toggle("disabled", this._isSubclassDisabled || (this._isClassDisabled && li.data.ixClass !== this._ixPrevSelectedClass));
				} else {
					li.data.tglSel.classList.toggle("disabled", this._isClassDisabled)
				}
			});

			if (selectedClass != null) {
				// region Restore selection
				const ixSubclass = ~this._ixPrevSelectedClass && selectedSubclass != null ? this._filterCache.allData[this._ixPrevSelectedClass].subclasses.findIndex(it => it.name === selectedSubclass.name && it.source === selectedSubclass.source) : -1

				if (~this._ixPrevSelectedClass) {
					ModalFilterClasses._doListDeselectAll(this._filterCache.list);

					const clsItem = this._filterCache.list.items.find(it => it.data.ixClass === this._ixPrevSelectedClass && it.data.ixSubclass == null);
					if (clsItem) {
						clsItem.data.tglSel.classList.add("active");
						clsItem.ele.classList.add("list-multi-selected");
					}

					if (~ixSubclass && clsItem) {
						const scItem = this._filterCache.list.items.find(it => it.data.ixClass === this._ixPrevSelectedClass && it.data.ixSubclass === ixSubclass);
						scItem.data.tglSel.classList.add("active");
						scItem.ele.classList.add("list-multi-selected");
					}
				}
				// endregion

				// region Hide unwanted classes
				this._filterCache.list.setFnSearch((li, searchTerm) => {
					if (li.data.ixClass !== this._ixPrevSelectedClass) return false;
					return List.isVisibleDefaultSearch(li, searchTerm);
				});
				// endregion
			} else {
				this._filterCache.list.setFnSearch(null);
			}

			// Handle changes to `fnSearch`
			this._filterCache.list.update();

			await UiUtil.pDoForceFocus(this._filterCache.$iptSearch[0]);
		});
	}

	async pPreloadHidden ($modalInner) {
		// If we're rendering in "hidden" mode, create a dummy element to attach the UI to.
		$modalInner = $modalInner || $(`<div></div>`);

		if (this._filterCache) {
			this._filterCache.$wrpModalInner.appendTo($modalInner);
		} else {
			await this._pInit();

			const $ovlLoading = $(`<div class="w-100 h-100 flex-vh-center"><i class="dnd-font ve-muted">Loading...</i></div>`).appendTo($modalInner);

			const $iptSearch = $(`<input class="form-control" type="search" placeholder="Search...">`);
			const $btnReset = $(`<button class="btn btn-default">Reset</button>`);
			const $wrpFormTop = $$`<div class="flex input-group btn-group w-100 lst__form-top">${$iptSearch}${$btnReset}</div>`;

			const $wrpFormBottom = $(`<div class="w-100"></div>`);

			const $wrpFormHeaders = $(`<div class="input-group input-group--bottom flex no-shrink">
				<div class="btn btn-default disabled col-1 pl-0"></div>
				<button class="col-9 sort btn btn-default btn-xs" data-sort="name">Name</button>
				<button class="col-2 pr-0 sort btn btn-default btn-xs ve-grow" data-sort="source">Source</button>
			</div>`);

			const $wrpForm = $$`<div class="flex-col w-100 mb-2">${$wrpFormTop}${$wrpFormBottom}${$wrpFormHeaders}</div>`;
			const $wrpList = this._$getWrpList();

			const $btnConfirm = $(`<button class="btn btn-default">Confirm</button>`);

			const list = new List({
				$iptSearch,
				$wrpList,
				fnSort: this._fnSort,
			});

			SortUtil.initBtnSortHandlers($wrpFormHeaders, list);

			const allData = await this._pLoadAllData();
			const pageFilter = this._pageFilter;

			await pageFilter.pInitFilterBox({
				$wrpFormTop,
				$btnReset,
				$wrpMiniPills: $wrpFormBottom,
				namespace: this._namespace,
			});

			allData.forEach((it, i) => {
				pageFilter.mutateAndAddToFilters(it);
				const filterListItems = this._getListItems(pageFilter, it, i);
				filterListItems.forEach(li => {
					list.addItem(li);
					li.ele.addEventListener("click", evt => {
						const isScLi = li.data.ixSubclass != null;

						if (isScLi) {
							if (this._isSubclassDisabled) return;
							if (this._isClassDisabled && li.data.ixClass !== this._ixPrevSelectedClass) return;
						} else {
							if (this._isClassDisabled) return;
						}

						this._handleSelectClick({list,
							filterListItems,
							filterListItem: li,
							evt,
						});
					});
				});
			});

			list.init();
			list.update();

			const handleFilterChange = () => {
				const f = pageFilter.filterBox.getValues();

				// Find all the classes which have visible subclasses so we can force them to remain visible.
				const ixsVisibleCls = new Set();
				list.items.forEach(li => {
					if (li.data.ixSubclass == null) return;
					const sc = allData[li.data.ixClass].subclasses[li.data.ixSubclass];
					const isVisible = pageFilter.toDisplay(f, sc);
					if (isVisible) ixsVisibleCls.add(li.data.ixClass);
				});

				list.filter(li => {
					if (li.data.ixSubclass == null) return ixsVisibleCls.has(li.data.ixClass) || pageFilter.toDisplay(f, allData[li.data.ixClass]);
					else return pageFilter.toDisplay(f, allData[li.data.ixClass].subclasses[li.data.ixSubclass]);
				});
			};

			pageFilter.filterBox.on(FilterBox.EVNT_VALCHANGE, handleFilterChange);
			pageFilter.filterBox.render();
			handleFilterChange();

			$ovlLoading.remove();

			const $wrpModalInner = $$`<div class="flex-col h-100">
				${$wrpForm}
				${$wrpList}
				<div class="flex-vh-center">${$btnConfirm}</div>
			</div>`.appendTo($modalInner);

			this._filterCache = {$wrpModalInner, $btnConfirm, pageFilter, list, allData, $iptSearch};
		}
	}

	static _doListDeselectAll (list, {isSubclassItemsOnly = false} = {}) {
		list.items.forEach(it => {
			if (isSubclassItemsOnly && it.data.ixSubclass == null) return;

			if (it.data.tglSel) it.data.tglSel.classList.remove("active");
			it.ele.classList.remove("list-multi-selected");
		});
	}

	_handleSelectClick ({list, filterListItems, filterListItem, evt}) {
		evt.preventDefault();
		evt.stopPropagation();

		const isScLi = filterListItem.data.ixSubclass != null;

		// When only allowing subclass to be changed, avoid de-selecting the entire list
		if (this._isClassDisabled && this._ixPrevSelectedClass != null && isScLi) {
			if (!filterListItem.data.tglSel.classList.contains("active")) this.constructor._doListDeselectAll(list, {isSubclassItemsOnly: true});
			filterListItem.data.tglSel.classList.toggle("active");
			filterListItem.ele.classList.toggle("list-multi-selected");
			return;
		}

		// region De-selecting the currently-selected item
		if (filterListItem.data.tglSel.classList.contains("active")) {
			this.constructor._doListDeselectAll(list);
			return;
		}
		// endregion

		// region Selecting an item
		this.constructor._doListDeselectAll(list);

		if (isScLi) {
			const classItem = filterListItems[0];
			classItem.data.tglSel.classList.add("active");
			classItem.ele.classList.add("list-multi-selected");
		}

		filterListItem.data.tglSel.classList.add("active");
		filterListItem.ele.classList.add("list-multi-selected");
		// endregion
	}

	/** Caches the result for fast re-querying. Note that brew added after the initial load will not be available. */
	async _pLoadAllData () {
		this._pLoadingAllData = this._pLoadingAllData || (async () => {
			const [data, brew] = await Promise.all([
				MiscUtil.copy(await DataUtil.class.loadRawJSON()),
				BrewUtil.pAddBrewData(),
			]);

			// Combine main data with brew
			const clsProps = BrewUtil.getPageProps(UrlUtil.PG_CLASSES);
			clsProps.forEach(prop => data[prop] = [...data[prop] || [], ...MiscUtil.copy(brew[prop] || [])]);

			this._allData = await PageFilterClassesRaw.pPostLoad(data);
		})();

		await this._pLoadingAllData;
		return this._allData;
	}

	_getListItems (pageFilter, cls, clsI) {
		return [
			this._getListItems_getClassItem(pageFilter, cls, clsI),
			...cls.subclasses.map((sc, scI) => this._getListItems_getSubclassItem(pageFilter, cls, clsI, sc, scI)),
		]
	}

	_getListItems_getClassItem (pageFilter, cls, clsI) {
		const eleLabel = document.createElement("label");
		eleLabel.className = "w-100 flex lst--border no-select lst__wrp-cells";

		const source = Parser.sourceJsonToAbv(cls.source);

		eleLabel.innerHTML = `<div class="col-1 pl-0 flex-vh-center"><div class="fltr-cls__tgl"></div></div>
		<div class="bold col-9">${cls.name}</div>
		<div class="col-2 pr-0 text-center ${Parser.sourceJsonToColor(cls.source)}" title="${Parser.sourceJsonToFull(cls.source)}" ${BrewUtil.sourceJsonToStyle(cls.source)}>${source}</div>`;

		return new ListItem(
			clsI,
			eleLabel,
			`${cls.name} -- ${cls.source}`,
			{
				source: `${source} -- ${cls.name}`,
			},
			{
				ixClass: clsI,
				tglSel: eleLabel.firstElementChild.firstElementChild,
			},
		);
	}

	_getListItems_getSubclassItem (pageFilter, cls, clsI, sc, scI) {
		const eleLabel = document.createElement("label");
		eleLabel.className = "w-100 flex lst--border no-select lst__wrp-cells";

		const source = Parser.sourceJsonToAbv(sc.source);

		eleLabel.innerHTML = `<div class="col-1 pl-0 flex-vh-center"><div class="fltr-cls__tgl"></div></div>
		<div class="col-9 pl-1 flex-v-center"><span class="mx-3">\u2014</span> ${sc.name}</div>
		<div class="col-2 pr-0 text-center ${Parser.sourceJsonToColor(sc.source)}" title="${Parser.sourceJsonToFull(sc.source)}" ${BrewUtil.sourceJsonToStyle(sc.source)}>${source}</div>`;

		return new ListItem(
			`${clsI}--${scI}`,
			eleLabel,
			`${cls.name} -- ${cls.source} -- ${sc.name} -- ${sc.source}`,
			{
				source: `${cls.source} -- ${cls.name} -- ${source} -- ${sc.name}`,
			},
			{
				ixClass: clsI,
				ixSubclass: scI,
				tglSel: eleLabel.firstElementChild.firstElementChild,
			},
		);
	}
}
