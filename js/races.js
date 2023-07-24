"use strict";

class RacesSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "subraces",
		});
	}

	pGetSublistItem (race, hash) {
		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col">
				<a href="#${UrlUtil.autoEncodeHash(race)}" class="lst--border lst__row-inner">
					<span class="bold col-5 pl-0">${race.name}</span>
					<span class="col-5 ${race._slAbility === "Lineage (choose)" ? "italic" : ""}">${race._slAbility}</span>
					<span class="col-2 ve-text-center pr-0">${(race.size || [Parser.SZ_VARIES]).map(sz => Parser.sizeAbvToFull(sz)).join("/")}</span>
				</a>
			</div>
		`)
			.contextmenu(evt => this._handleSublistItemContextMenu(evt, listItem))
			.click(evt => this._listSub.doSelect(listItem, evt));

		const listItem = new ListItem(
			hash,
			$ele,
			race.name,
			{
				hash,
				ability: race._slAbility,
			},
			{
				entity: race,
			},
		);
		return listItem;
	}
}

class RacesPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterRaces();
		super({
			dataSource: DataUtil.race.loadJSON.bind(DataUtil.race, {isAddBaseRaces: true}),
			dataSourceFluff: DataUtil.raceFluff.loadJSON.bind(DataUtil.raceFluff),
			prereleaseDataSource: DataUtil.race.loadPrerelease.bind(DataUtil.race),
			brewDataSource: DataUtil.race.loadBrew.bind(DataUtil.race),

			pFnGetFluff: Renderer.race.pGetFluff.bind(Renderer.race),

			pageFilter,

			listClass: "races",

			dataProps: ["race"],

			hasAudio: true,
		});
	}

	_addData (data) {
		if (data.race && data.race.length) super._addData(data);
		if (!data.subrace || !data.subrace.length) return;

		// Attach each subrace to a parent race, and recurse
		const nxtData = Renderer.race.adoptSubraces(this._dataList, data.subrace);

		if (nxtData.length) this._addData({race: Renderer.race.mergeSubraces(nxtData)});
	}

	getListItem (race, rcI, isExcluded) {
		const hash = UrlUtil.autoEncodeHash(race);
		if (this._seenHashes.has(hash)) return null;
		this._seenHashes.add(hash);

		this._pageFilter.mutateAndAddToFilters(race, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const size = (race.size || [Parser.SZ_VARIES]).map(sz => Parser.sizeAbvToFull(sz)).join("/");
		const source = Parser.sourceJsonToAbv(race.source);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="bold col-4 pl-0">${race.name}</span>
			<span class="col-4 ${race._slAbility === "Lineage (choose)" ? "italic" : ""}">${race._slAbility}</span>
			<span class="col-2 ve-text-center">${size}</span>
			<span class="col-2 ve-text-center ${Parser.sourceJsonToColor(race.source)} pr-0" title="${Parser.sourceJsonToFull(race.source)}" ${Parser.sourceJsonToStyle(race.source)}>${source}</span>
		</a>`;

		const listItem = new ListItem(
			rcI,
			eleLi,
			race.name,
			{
				hash,
				ability: race._slAbility,
				size,
				source,
				cleanName: PageFilterRaces.getInvertedName(race.name) || "",
				alias: PageFilterRaces.getListAliases(race),
			},
			{
				isExcluded,
			},
		);

		eleLi.addEventListener("click", (evt) => this._list.doSelect(listItem, evt));
		eleLi.addEventListener("contextmenu", (evt) => this._openContextMenu(evt, this._list, listItem));

		return listItem;
	}

	_renderStats_doBuildStatsTab ({ent}) {
		this._$pgContent.empty().append(RenderRaces.$getRenderedRace(ent));
	}
}

const racesPage = new RacesPage();
racesPage.sublistManager = new RacesSublistManager();
window.addEventListener("load", () => racesPage.pOnLoad());
