require("../js/utils.js");
require("../js/utils-dataloader.js");
require("../js/render.js");
require("../js/omnidexer.js");
const ut = require("./util.js");

class UtilSearchIndex {
	/**
	 * Prefer "core" sources, then official sources, then others.
	 */
	static _sortSources (a, b) {
		const aCore = Number(Parser.SOURCES_VANILLA.has(a));
		const bCore = Number(Parser.SOURCES_VANILLA.has(b));
		if (aCore !== bCore) return bCore - aCore;
		const aStandard = Number(!SourceUtil.isNonstandardSource(a));
		const bStandard = Number(!SourceUtil.isNonstandardSource(b));
		return aStandard !== bStandard ? bStandard - aStandard : SortUtil.ascSortLower(a, b);
	}

	static async pGetIndex ({doLogging = true, noFilter = false} = {}) {
		return UtilSearchIndex._pGetIndex({doLogging, noFilter});
	}

	static async pGetIndexAlternate (forProp, {doLogging = true, noFilter = false} = {}) {
		const opts = {alternate: forProp};
		return UtilSearchIndex._pGetIndex({opts, doLogging, noFilter});
	}

	static async pGetIndexFoundry ({doLogging = true, noFilter = false} = {}) {
		const opts = {
			isSkipSpecial: true,
		};
		const optsAddToIndex = {
			isIncludeTag: true,
			isIncludeUid: true,
			isIncludeImg: true,
		};
		return UtilSearchIndex._pGetIndex({opts, optsAddToIndex, doLogging, noFilter});
	}

	static async _pGetIndex ({opts = {}, optsAddToIndex = {}, doLogging = true, noFilter = false} = {}) {
		ut.patchLoadJson();

		const indexer = new Omnidexer();

		// region Index entities from directories, e.g. creatures and spells
		const toIndexMultiPart = Omnidexer.TO_INDEX__FROM_INDEX_JSON
			.filter(indexMeta => opts.alternate ? indexMeta.alternateIndexes && indexMeta.alternateIndexes[opts.alternate] : true);

		for (const indexMeta of toIndexMultiPart) {
			const dataIndex = ut.readJson(`./data/${indexMeta.dir}/index.json`);

			const loadedFiles = Object.entries(dataIndex)
				.sort(([kA], [kB]) => UtilSearchIndex._sortSources(kA, kB))
				.map(([_, filename]) => filename);

			for (const filename of loadedFiles) {
				const filePath = `./data/${indexMeta.dir}/${filename}`;
				const contents = ut.readJson(filePath);
				if (doLogging) console.log(`\tindexing ${filePath}`);
				const optsNxt = {isNoFilter: noFilter};
				if (opts.alternate) optsNxt.alt = indexMeta.alternateIndexes[opts.alternate];
				await indexer.pAddToIndex(indexMeta, contents, {...optsNxt, ...optsAddToIndex});
			}
		}
		// endregion

		// region Index entities from single files
		const toIndexSingle = Omnidexer.TO_INDEX
			.filter(indexMeta => opts.alternate ? indexMeta.alternateIndexes && indexMeta.alternateIndexes[opts.alternate] : true);

		for (const indexMeta of toIndexSingle) {
			const filePath = `./data/${indexMeta.file}`;
			const data = ut.readJson(filePath);

			if (indexMeta.postLoad) indexMeta.postLoad(data);

			if (doLogging) console.log(`\tindexing ${filePath}`);
			Object.values(data)
				.filter(it => it instanceof Array)
				.forEach(it => it.sort((a, b) => UtilSearchIndex._sortSources(SourceUtil.getEntitySource(a), SourceUtil.getEntitySource(b)) || SortUtil.ascSortLower(a.name || MiscUtil.get(a, "inherits", "name") || "", b.name || MiscUtil.get(b, "inherits", "name") || "")));

			const optsNxt = {isNoFilter: noFilter};
			if (opts.alternate) optsNxt.alt = indexMeta.alternateIndexes[opts.alternate];
			await indexer.pAddToIndex(indexMeta, data, {...optsNxt, ...optsAddToIndex});
		}
		// endregion

		// region Index special
		if (!opts.alternate && !opts.isSkipSpecial) {
			for (const indexMeta of Omnidexer.TO_INDEX__SPECIAL) {
				const toIndex = await indexMeta.pGetIndex();
				toIndex.forEach(it => indexer.pushToIndex(it));
			}
		}
		// endregion

		const out = indexer.getIndex();
		ut.unpatchLoadJson();
		return out;
	}

	// this should be generalised if further specific indexes are required
	static async pGetIndexAdditionalItem ({baseIndex = 0, doLogging = true} = {}) {
		ut.patchLoadJson();

		const indexer = new Omnidexer(baseIndex);

		await Promise.all(Omnidexer.TO_INDEX.filter(it => it.category === Parser.CAT_ID_ITEM).map(async ti => {
			const filename = `./data/${ti.file}`;
			const data = ut.readJson(filename);

			if (ti.postLoad) ti.postLoad(data);

			if (ti.additionalIndexes && ti.additionalIndexes.item) {
				if (doLogging) console.log(`\tindexing ${filename}`);
				const extra = await ti.additionalIndexes.item(indexer, data);
				extra.forEach(add => indexer.pushToIndex(add));
			}
		}));

		const out = indexer.getIndex();
		ut.unpatchLoadJson();
		return out;
	}
}

module.exports = {UtilSearchIndex};
