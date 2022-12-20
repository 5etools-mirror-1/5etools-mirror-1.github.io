"use strict";

class ListPageMultiSource extends ListPage {
	constructor ({propLoader, ...rest}) {
		super({
			...rest,
			isLoadDataAfterFilterInit: true,
			isBindHashHandlerUnknown: true,
		});

		this._propLoader = propLoader;
		this._loadedSources = {};
		this._lastFilterValues = null;
	}

	_onFilterChangeMulti (multiList, filterValues) {
		FilterBox.selectFirstVisible(multiList);

		if (!this._lastFilterValues) {
			this._lastFilterValues = filterValues;
			return;
		}

		if (!filterValues.Source._isActive && this._lastFilterValues.Source._isActive) {
			this._lastFilterValues = filterValues;
			this._pForceLoadDefaultSources();
		}
	}

	async _pForceLoadDefaultSources () {
		const defaultSources = Object.keys(this._loadedSources)
			.filter(s => PageFilter.defaultSourceSelFn(s));
		await Promise.all(defaultSources.map(src => this._pLoadSource(src, "yes")));
	}

	async pDoLoadExportedSublistSources (exportedSublist) {
		if (!exportedSublist?.sources?.length) return;
		await (exportedSublist.sources || [])
			.filter(src => SourceUtil.isSiteSource(src))
			.pMap(src => this._pLoadSource(src, "yes"));

		// region Note that we can't e.g. load the sources in the background, because the list won't update, and therefore
		//   the sublist can't find the matching list elements.
		// TODO(Future) have the notification include a button which, when clicked, will attempt to:
		//    - load the brew from the repo
		//    - cache the to-be-loaded sublist in local storage
		//    - reload the page
		//    - load the cached sublist
		const sourcesUnknown = (exportedSublist.sources || [])
			.filter(src => !SourceUtil.isSiteSource(src) && !BrewUtil2.hasSourceJson(src));
		if (!sourcesUnknown.length) return;

		JqueryUtil.doToast({
			content: `Could not load content from the following source${sourcesUnknown.length === 1 ? "" : "s"}: ${sourcesUnknown.map(it => `"${it}"`).join(", ")}. You may need to load ${sourcesUnknown.length === 1 ? "it" : "them"} as homebrew first.`,
			type: "danger",
			isAutoHide: false,
		});
		// endregion
	}

	async _pLoadSource (src, nextFilterVal) {
		// We only act when the user changes the filter to "yes", i.e. "load/view the source"
		if (nextFilterVal !== "yes") return;

		const toLoad = this._loadedSources[src] || this._loadedSources[Object.keys(this._loadedSources).find(k => k.toLowerCase() === src)];
		if (toLoad.loaded) return;

		const data = await DataUtil[this._propLoader].pLoadSingleSource(src);
		this._addData(data);
		toLoad.loaded = true;
	}

	async _pOnLoad_pGetData () {
		const siteSourcesAvail = new Set(
			Object.keys(await DataUtil[this._propLoader].pLoadIndex())
				.filter(source => !ExcludeUtil.isExcluded("*", "*", source, {isNoCount: true})),
		);

		// track loaded sources
		siteSourcesAvail
			.forEach(src => this._loadedSources[src] = {source: src, loaded: false});

		// collect a list of sources to load
		const defaultSel = [...siteSourcesAvail].filter(s => PageFilter.defaultSourceSelFn(s));

		const userSel = [
			// Selected in filter
			...await this._filterBox.pGetStoredActiveSources() || defaultSel,
			// From entities in sublist
			...await this._sublistManager.pGetSelectedSources() || [],
			// From current link
			this._pOnLoad_getLinkHashSource({siteSourcesAvail}),
		]
			.filter(Boolean)
			.unique();

		const allSources = [];

		// add any sources from the user's saved filters, provided they have URLs and haven't already been added
		if (userSel) {
			userSel
				.filter(src => siteSourcesAvail.has(src) && !allSources.includes(src))
				.forEach(src => allSources.push(src));
		}

		// if there's no saved filters, load the defaults
		if (allSources.length === 0) {
			// remove any sources that don't have URLs
			defaultSel
				.filter(src => siteSourcesAvail.has(src))
				.forEach(src => allSources.push(src));
		}

		// add source from the current hash, if there is one
		if (window.location.hash.length) {
			const [link] = Hist.getHashParts();
			const src = link.split(HASH_LIST_SEP)[1];
			const hashSrcs = {};
			siteSourcesAvail.forEach(src => hashSrcs[UrlUtil.encodeForHash(src)] = src);
			const mapped = hashSrcs[src];
			if (mapped && !allSources.includes(mapped)) {
				allSources.push(mapped);
			}
		}

		// make a list of src : url objects
		// load the sources
		let toAdd = {};
		if (allSources.length > 0) {
			const dataStack = (await Promise.all(allSources.map(async src => {
				const data = await DataUtil[this._propLoader].pLoadSingleSource(src);
				this._loadedSources[src].loaded = true;
				return data;
			}))).flat();

			dataStack.forEach(d => {
				Object.entries(d)
					.forEach(([prop, arr]) => {
						if (!(arr instanceof Array)) return;
						toAdd[prop] = (toAdd[prop] || []).concat(arr);
					});
			});
		}

		Object.keys(this._loadedSources)
			.map(src => new FilterItem({item: src, pFnChange: this._pLoadSource.bind(this)}))
			.forEach(fi => this._pageFilter.sourceFilter.addItem(fi));

		const homebrew = await (this._brewDataSource ? this._brewDataSource() : BrewUtil2.pGetBrewProcessed());

		return BrewUtil2.getMergedData(toAdd, homebrew);
	}

	_pOnLoad_getLinkHashSource ({siteSourcesAvail}) {
		const hashSourceRaw = Hist.getHashSource();
		return hashSourceRaw
			? [...siteSourcesAvail].find(it => it.toLowerCase() === hashSourceRaw.toLowerCase())
			: null;
	}
}
