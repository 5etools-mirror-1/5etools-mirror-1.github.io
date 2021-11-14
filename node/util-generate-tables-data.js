"use strict";

if (typeof module !== "undefined") {
	require("../js/utils");
	require("../js/render");
}

class UtilGenTables {
	static _getTableSectionIndex (sectionOrders, chapterName, sectionName) {
		((sectionOrders[chapterName] =
			sectionOrders[chapterName] || {})[sectionName] =
			sectionOrders[chapterName][sectionName] || 1);
		const val = sectionOrders[chapterName][sectionName];
		sectionOrders[chapterName][sectionName]++;
		return val;
	}

	/**
	 * @param opts
	 * @param opts.sectionOrders
	 * @param opts.path
	 * @param opts.tmpMeta
	 * @param opts.section
	 * @param opts.data
	 * @param opts.stacks
	 * @param opts.isRequireIncludes
	 */
	static _doSearch (opts) {
		const {sectionOrders, path, tmpMeta, section, data, stacks, isRequireIncludes} = opts;

		if (data.data && data.data.tableIgnore) return;

		if (data.entries) {
			const nxtSection = data.name || section;
			if (data.name || data.page) {
				const {name, page} = data;
				path.push({name, page});
			}
			data.entries.forEach(ent => this._doSearch({...opts, section: nxtSection, data: ent}));
			if (data.name || data.page) path.pop();
		} else if (data.items) {
			if (data.name || data.page) {
				const {name, page} = data;
				path.push({name, page});
			}
			data.items.forEach(item => this._doSearch({...opts, data: item}));
			if (data.name || data.page) path.pop();
		} else if (data.type === "table" || data.type === "tableGroup") {
			if (isRequireIncludes && !(data.data && data.data[VeCt.ENTDATA_TABLE_INCLUDE])) return;

			const cpy = MiscUtil.copy(data);

			cpy._tmpMeta = MiscUtil.copy(tmpMeta);
			cpy.path = MiscUtil.copy(path);
			cpy.section = section;
			cpy.sectionIndex = this._getTableSectionIndex(sectionOrders, tmpMeta.name, section);

			stacks[data.type].push(cpy);
		}
	}

	static _getCleanSectionName (name) {
		return name.replace(/^(?:Step )?[-\d]+[:.]?\s*/, "");
	}

	static _isSectionInTitle (sections, title) {
		const lowTitle = title.toLowerCase();
		return sections.some(section => lowTitle.includes(section.toLowerCase()));
	}

	static _mutDataAddPage (table) {
		for (let i = table.path.length - 1; i >= 0; --i) {
			if (table.path[i].page) {
				table.page = table.path[i].page;
				break;
			}
		}
	}

	static _mutCleanData (table) {
		delete table.path;
		delete table.section;
		delete table.sectionIndex;

		if (table._tmpMeta.metaType === "adventure-book") {
			table.chapter = table._tmpMeta;
			delete table._tmpMeta;

			// clean chapter
			if (table.data && table.data.tableChapterIgnore) {
				delete table.chapter;
			} else {
				const chapterOut = {};
				chapterOut.name = table.chapter.name;
				chapterOut.ordinal = table.chapter.ordinal;
				chapterOut.index = table.chapter.index;
				table.chapter = chapterOut;
			}
		} else if (table._tmpMeta.metaType === "class") {
			table.class = {name: table._tmpMeta.className, source: table._tmpMeta.classSource};
			delete table._tmpMeta;
		} else if (table._tmpMeta.metaType === "subclass") {
			table.subclass = {
				name: table._tmpMeta.subclassName,
				source: table._tmpMeta.subclassSource,
				className: table._tmpMeta.className,
				classSource: table._tmpMeta.classSource,
			};
			delete table._tmpMeta;
		} else if (table._tmpMeta.metaType === "variantrule") {
			table.variantrule = {name: table._tmpMeta.name, source: table._tmpMeta.source};
			delete table._tmpMeta;
		}

		if (table.type === "table") delete table.type;
		delete table.data;

		if (table.name) table.name = Renderer.stripTags(table.name);
	}

	/**
	 * @param doc
	 * @param opts
	 * @param opts.headProp
	 * @param opts.bodyProp
	 * @param [opts.isRequireIncludes]
	 */
	static getAdventureBookTables (doc, opts) {
		const sectionOrders = {};
		const stacks = {table: [], tableGroup: []};

		if (!(doc[opts.headProp] && doc[opts.bodyProp])) return;

		doc[opts.bodyProp].data.forEach((chapter, ixChapter) => {
			const tmpMeta = MiscUtil.copy(doc[opts.headProp].contents[ixChapter]);
			tmpMeta.index = ixChapter;
			tmpMeta.metaType = "adventure-book";

			const path = [];
			this._doSearch({
				sectionOrders,
				path,
				tmpMeta: tmpMeta,
				section: doc[opts.headProp].name,
				data: chapter,
				stacks: stacks,
				isRequireIncludes: opts.isRequireIncludes,
			});
		});

		stacks.table.forEach(tbl => {
			const cleanSectionNames = tbl.path.filter(ent => ent.name).map(ent => this._getCleanSectionName(ent.name));

			if (tbl.data && tbl.data.tableNamePrefix && tbl.caption) {
				tbl.name = `${tbl.data.tableNamePrefix}; ${tbl.caption}`;
			} else if (tbl.data && tbl.data.tableName) {
				tbl.name = tbl.data.tableName;
			} else if (tbl.caption) {
				if (this._isSectionInTitle(cleanSectionNames, tbl.caption) || (tbl.data && tbl.data.skipSectionPrefix)) {
					tbl.name = tbl.caption;
				} else {
					tbl.name = `${cleanSectionNames.last()}; ${tbl.caption}`;
				}
			} else {
				// If this is the only table in this section, remove the numerical suffix
				if (tbl.sectionIndex === 1 && sectionOrders[tbl._tmpMeta.name][tbl.section] === 2) {
					tbl.name = cleanSectionNames.last();
				} else {
					tbl.name = `${cleanSectionNames.last()}; ${tbl.sectionIndex}`;
				}
			}

			this._mutDataAddPage(tbl);
			tbl.source = doc[opts.headProp].id;
			this._mutCleanData(tbl);
		});

		stacks.tableGroup.forEach(tg => {
			const cleanSections = tg.path.filter(ent => ent.name).map(ent => this._getCleanSectionName(ent.name));
			if (!tg.name) throw new Error("Group had no name!");

			if (!this._isSectionInTitle(cleanSections, tg.name)) {
				tg.name = `${cleanSections.last()}; ${tg.name}`;
			}

			this._mutDataAddPage(tg);
			tg.source = doc[opts.headProp].id;
			this._mutCleanData(tg);
		});

		return stacks;
	}

	static getClassTables (cls) {
		const sectionOrders = {};
		const stacks = {table: [], tableGroup: []};
		const path = [];

		cls.classFeatures.forEach((lvl, lvlI) => {
			const tmpMeta = {
				metaType: "class",
				className: cls.name,
				classSource: cls.source || SRC_PHB,
				level: lvlI + 1,
			};

			lvl.forEach(feat => this._doSearch({
				sectionOrders,
				path,
				tmpMeta,
				section: cls.name,
				data: feat,
				stacks: stacks,
				isRequireIncludes: true,

				// Used to deduplicate headers
				name: cls.name,
			}));
		});

		stacks.table.forEach(it => {
			it.name = it.caption;
			it.source = it._tmpMeta.subclassSource || it._tmpMeta.classSource;

			this._mutDataAddPage(it);
			this._mutCleanData(it);
		});

		return stacks;
	}

	static getSubclassTables (sc) {
		const sectionOrders = {};
		const stacks = {table: [], tableGroup: []};
		const path = [];

		sc.subclassFeatures.forEach(lvl => {
			const level = lvl[0].level;

			const tmpMeta = {
				metaType: "subclass",
				className: sc.className,
				classSource: sc.classSource || SRC_PHB,
				level,
				subclassName: sc.name,
				subclassSource: sc.source || sc.classSource || SRC_PHB,

				// Used to deduplicate headers
				name: sc.name,
			};

			lvl.forEach(feat => this._doSearch({
				sectionOrders,
				path,
				tmpMeta,
				section: sc.className,
				data: feat,
				stacks: stacks,
				isRequireIncludes: true,
			}));
		});

		stacks.table.forEach(it => {
			it.name = it.caption;
			it.source = it._tmpMeta.subclassSource || it._tmpMeta.classSource;

			this._mutDataAddPage(it);
			this._mutCleanData(it);
		});

		return stacks;
	}

	static getGenericTables (entity, metaType, ...props) {
		const sectionOrders = {};
		const stacks = {table: [], tableGroup: []};
		const path = [];

		props.forEach(prop => {
			if (!entity[prop]) return;
			const tmpMeta = {
				metaType: metaType,
				name: entity.name,
				source: entity.source,
			};

			entity[prop].forEach(ent => {
				this._doSearch({
					sectionOrders,
					path,
					tmpMeta,
					section: entity.name,
					data: ent,
					stacks: stacks,
					isRequireIncludes: true,

					// Used to deduplicate headers
					name: entity.name,
				});
			});
		});

		stacks.table.forEach(it => {
			it.name = it.caption;
			it.source = it._tmpMeta.source;

			this._mutDataAddPage(it);
			this._mutCleanData(it);
		});

		return stacks;
	}
}

if (typeof module !== "undefined") module.exports = UtilGenTables;
