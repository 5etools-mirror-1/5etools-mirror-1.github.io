"use strict";

class ListPageMultiSource extends ListPage {
	constructor ({jsonDir, ...rest}) {
		super({
			...rest,
			isLoadDataAfterFilterInit: true,
			isBindHashHandlerUnknown: true,
		});

		this._jsonDir = jsonDir;
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

	async _pLoadSource (src, nextFilterVal) {
		// We only act when the user changes the filter to "yes", i.e. "load/view the source"
		if (nextFilterVal !== "yes") return;

		const toLoad = this._loadedSources[src] || this._loadedSources[Object.keys(this._loadedSources).find(k => k.toLowerCase() === src)];
		if (toLoad.loaded) return;

		const data = await DataUtil.loadJSON(toLoad.url);
		this._addData(data);
		toLoad.loaded = true;
	}

	async _pOnLoad_pGetData () {
		const src2UrlMap = Object.entries(await DataUtil.loadJSON(`${this._jsonDir}index.json`))
			.filter(([source]) => !ExcludeUtil.isExcluded("*", "*", source, {isNoCount: true}))
			.mergeMap(([source, filename]) => ({[source]: filename}));

		// track loaded sources
		Object.keys(src2UrlMap).forEach(src => this._loadedSources[src] = {url: this._jsonDir + src2UrlMap[src], loaded: false});

		// collect a list of sources to load
		const sources = Object.keys(src2UrlMap);
		const defaultSel = sources.filter(s => PageFilter.defaultSourceSelFn(s));
		const hashSourceRaw = Hist.getHashSource();
		const hashSource = hashSourceRaw ? Object.keys(src2UrlMap).find(it => it.toLowerCase() === hashSourceRaw.toLowerCase()) : null;
		const filterSel = await this._filterBox.pGetStoredActiveSources() || defaultSel;
		const listSel = await ListUtil.pGetSelectedSources() || [];
		const userSel = [...new Set([...filterSel, ...listSel, hashSource].filter(Boolean))];

		const allSources = [];

		// add any sources from the user's saved filters, provided they have URLs and haven't already been added
		if (userSel) {
			userSel
				.filter(src => src2UrlMap[src] && !allSources.includes(src))
				.forEach(src => allSources.push(src));
		}

		// if there's no saved filters, load the defaults
		if (allSources.length === 0) {
			// remove any sources that don't have URLs
			defaultSel.filter(src => src2UrlMap[src]).forEach(src => allSources.push(src));
		}

		// add source from the current hash, if there is one
		if (window.location.hash.length) {
			const [link] = Hist.getHashParts();
			const src = link.split(HASH_LIST_SEP)[1];
			const hashSrcs = {};
			sources.forEach(src => hashSrcs[UrlUtil.encodeForHash(src)] = src);
			const mapped = hashSrcs[src];
			if (mapped && !allSources.includes(mapped)) {
				allSources.push(mapped);
			}
		}

		// make a list of src : url objects
		const toLoads = allSources.map(src => ({src: src, url: this._jsonDir + src2UrlMap[src]}));

		// load the sources
		let toAdd = {};
		if (toLoads.length > 0) {
			const dataStack = (await Promise.all(toLoads.map(async toLoad => {
				const data = await DataUtil.loadJSON(toLoad.url);
				this._loadedSources[toLoad.src].loaded = true;
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

		return toAdd;
	}
}
