"use strict";

class Hist {
	static hashChange (forceLoad) {
		if (Hist.isHistorySuppressed) {
			Hist.setSuppressHistory(false);
			return;
		}

		const [link, ...sub] = Hist.getHashParts();

		let blankFilterLoad = false;
		if (link !== Hist.lastLoadedLink || sub.length === 0 || forceLoad) {
			Hist.lastLoadedLink = link;
			if (link === HASH_BLANK) {
				blankFilterLoad = true;
			} else {
				const listItem = Hist.getActiveListItem(link);

				if (listItem == null) {
					if (typeof pHandleUnknownHash === "function" && window.location.hash.length && Hist._lastUnknownLink !== link) {
						Hist._lastUnknownLink = link;
						pHandleUnknownHash(link, sub);
						return;
					} else {
						Hist._freshLoad();
						return;
					}
				}

				const toLoad = listItem.ix;
				if (toLoad === undefined) Hist._freshLoad();
				else {
					Hist.lastLoadedId = listItem.ix;
					loadHash(listItem.ix);
					document.title = `${listItem.name ? `${listItem.name} - ` : ""}5etools`;
				}
			}
		}

		if (typeof loadSubHash === "function" && (sub.length > 0 || forceLoad)) loadSubHash(sub);
		if (blankFilterLoad) Hist._freshLoad();
	}

	static init (initialLoadComplete) {
		window.onhashchange = Hist.hashChange;
		if (window.location.hash.length) {
			Hist.hashChange();
		} else {
			Hist._freshLoad();
		}
		if (initialLoadComplete) Hist.initialLoad = false;
	}

	/**
	 * Allows the hash to be modified without triggering a hashchange
	 * @param val
	 */
	static setSuppressHistory (val) {
		Hist.isHistorySuppressed = val;
	}

	static getSelectedListItem () {
		const [link] = Hist.getHashParts();
		return Hist.getActiveListItem(link);
	}

	static getSelectedListElementWithLocation () {
		const [link] = Hist.getHashParts();
		return Hist.getActiveListItem(link, true);
	}

	static getHashParts () {
		return Hist.util.getHashParts(window.location.hash);
	}

	static getActiveListItem (link, getIndex) {
		const primaryLists = ListUtil.getPrimaryLists();
		if (primaryLists && primaryLists.length) {
			for (let x = 0; x < primaryLists.length; ++x) {
				const list = primaryLists[x];

				const foundItemIx = list.items.findIndex(it => it.values.hash === link);
				if (~foundItemIx) {
					if (getIndex) return {item: list.items[foundItemIx], x: x, y: foundItemIx, list};
					return list.items[foundItemIx];
				}
			}
		}
	}

	static _freshLoad () {
		// defer this, in case the list needs to filter first
		setTimeout(() => {
			const goTo = $("#listcontainer").find(".list a").attr("href");
			if (goTo) {
				const parts = location.hash.split(HASH_PART_SEP);
				const fullHash = `${goTo}${parts.length > 1 ? `${HASH_PART_SEP}${parts.slice(1).join(HASH_PART_SEP)}` : ""}`;
				location.replace(fullHash);
			}
		}, 1);
	}

	static cleanSetHash (toSet) {
		window.location.hash = Hist.util.getCleanHash(toSet);
	}

	static getHashSource () {
		const [link] = Hist.getHashParts();
		// by convention, the source is the last hash segment
		return link ? link.split(HASH_LIST_SEP).last() : null;
	}

	static getSubHash (key) {
		return Hist.util.getSubHash(window.location.hash, key);
	}

	/**
	 * Sets a subhash with the key specified, overwriting any existing.
	 * @param key Subhash key.
	 * @param val Subhash value. Passing a nully object removes the k/v pair.
	 */
	static setSubhash (key, val) {
		const nxtHash = Hist.util.setSubhash(window.location.hash, key, val);
		Hist.cleanSetHash(nxtHash);
	}

	static setMainHash (hash) {
		const subHashPart = Hist.util.getHashParts(window.location.hash, key, val).slice(1).join(HASH_PART_SEP);
		Hist.cleanSetHash([hash, subHashPart].filter(Boolean).join(HASH_PART_SEP));
	}

	static replaceHistoryHash (hash) {
		window.history.replaceState(
			{},
			document.title,
			`${location.origin}${location.pathname}${hash ? `#${hash}` : ""}`,
		);
	}
}
Hist.lastLoadedLink = null;
Hist._lastUnknownLink = null;
Hist.lastLoadedId = null;
Hist.initialLoad = true;
Hist.isHistorySuppressed = false;

Hist.util = class {
	static getCleanHash (hash) {
		return hash.replace(/,+/g, ",").replace(/,$/, "").toLowerCase();
	}

	static getHashParts (location) {
		if (location[0] === "#") location = location.slice(1);
		return location.toLowerCase().replace(/%27/g, "'").split(HASH_PART_SEP);
	}

	static getSubHash (location, key) {
		const [link, ...sub] = Hist.util.getHashParts(location);
		const hKey = `${key}${HASH_SUB_KV_SEP}`;
		const part = sub.find(it => it.startsWith(hKey));
		if (part) return part.slice(hKey.length);
		return null;
	}

	static setSubhash (location, key, val) {
		if (key.endsWith(HASH_SUB_KV_SEP)) key = key.slice(0, -1);

		const [link, ...sub] = Hist.util.getHashParts(location);
		if (!link) return "";

		const hKey = `${key}${HASH_SUB_KV_SEP}`;
		const out = [link];
		if (sub.length) sub.filter(it => !it.startsWith(hKey)).forEach(it => out.push(it));
		if (val != null) out.push(`${hKey}${val}`);

		return Hist.util.getCleanHash(out.join(HASH_PART_SEP));
	}
};

if (typeof module !== "undefined") {
	module.exports = {Hist};
}
