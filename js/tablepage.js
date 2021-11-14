"use strict";

class TablePage {
	constructor (opts) {
		this._jsonUrl = opts.jsonUrl;
		this._dataProp = opts.dataProp;
		this._listClass = opts.listClass;
		this._tableCol1 = opts.tableCol1;
		this._fnGetTableName = opts.fnGetTableName;
		this._fnGetTableHash = opts.fnGetTableHash;

		this._list = null;
		this._dataList = null;
	}

	static _pad (number) {
		return String(number).padStart(2, "0");
	}

	async pInit () {
		window.addEventListener("hashchange", this._handleHashChange.bind(this));
		window.loadHash = this._doLoadHash.bind(this);

		ExcludeUtil.pInitialise(); // don't await, as this is only used for search
		this._dataList = (await DataUtil.loadJSON(this._jsonUrl))[this._dataProp];
		this._list = ListUtil.initList({listClass: this._listClass, isUseJquery: true, isBindFindHotkey: true});
		ListUtil.setOptions({primaryLists: [this._list]});

		for (let i = 0; i < this._dataList.length; i++) {
			const loc = this._dataList[i];

			const $dispShowHide = $(`<div class="lst__tgl-item-group mr-1">[\u2013]</div>`);

			const $btnHeader = $$`<div class="lst__item-group-header my-2 split-v-center" title="Source: ${Parser.sourceJsonToFull(loc.source)}">
				<div>${loc.name}</div>
				${$dispShowHide}
			</div>`
				.click(() => {
					$ulContents.toggleVe();
					if ($ulContents.hasClass("ve-hidden")) $dispShowHide.html(`[+]`);
					else $dispShowHide.html(`[\u2013]`);
				});

			const $ulContents = this._$getContentsBlock(i, loc);

			const $wrp = $$`<div>
				${$btnHeader}
				${$ulContents}
			</div>`;

			const listItem = new ListItem(i, $wrp, loc.name);

			this._list.addItem(listItem);
		}

		this._list.init();
		this._handleHashChange();

		window.dispatchEvent(new Event("toolsLoaded"));
	}

	_handleHashChange () {
		const [link] = Hist.getHashParts();
		const $a = $(`a[href="#${link}"]`);
		if (!$a.length || !link) {
			window.location.hash = $(`.list.${this._listClass}`).find("a").attr("href");
			return;
		}
		const id = $a.attr("id");
		document.title = `${$a.title()} - 5etools`;
		this._doLoadHash(id);
	}

	_$getContentsBlock (i, meta) {
		const $out = $(`<div class="flex-col w-100"></div>`);
		let stack = "";
		meta.tables.forEach((table, j) => {
			const tableName = this._fnGetTableName(meta, table);
			stack += `<div class="lst__row flex-col"><a id="${i},${j}" class="lst--border lst__row-inner" href="#${this._fnGetTableHash(meta, table)}" title="${tableName}">${tableName}</a></div>`;
		});
		$out.fastSetHtml(stack);
		return $out;
	}

	_doLoadHash (id) {
		Renderer.get().setFirstSection(true);

		const [iLoad, jLoad] = id.split(",").map(n => Number(n));
		const meta = this._dataList[iLoad];
		const table = meta.tables[jLoad].table;
		const tableName = this._fnGetTableName(meta, meta.tables[jLoad]);
		const diceType = meta.tables[jLoad].diceType;

		const htmlRows = table.map(it => {
			const range = it.min === it.max ? TablePage._pad(it.min) : `${TablePage._pad(it.min)}-${TablePage._pad(it.max)}`;
			return `<tr><td class="text-center p-0">${range}</td><td class="p-0">${Renderer.get().render(it.result)}</td></tr>`;
		});

		let htmlText = `
		<tr>
			<td colspan="6">
				<table class="stripe-odd-table">
					<caption>${tableName}</caption>
					<thead>
						<tr>
							<th class="col-2 text-center">
								<span class="roller" onclick="tablePage.roll('${id}')">d${diceType}</span>
							</th>
							<th class="col-10">${this._tableCol1}</th>
						</tr>
					</thead>
					<tbody>
						${htmlRows.join("")}
					</tbody>
				</table>
			</td>
		</tr>`;

		$("#pagecontent").html(htmlText);

		// update list highlights
		$(`.list.${this._listClass}`).find(`.list-multi-selected`).removeClass("list-multi-selected");
		$(`a[id="${id}"]`).parent().addClass("list-multi-selected");
	}

	roll (id) {
		const [ixMeta, ixTable] = id.split(",").map(n => Number(n));
		const meta = this._dataList[ixMeta];
		const table = meta.tables[ixTable];
		const rollTable = table.table;

		rollTable._rMax = rollTable._rMax == null
			? Math.max(...rollTable.filter(it => it.min != null).map(it => it.min), ...rollTable.filter(it => it.max != null).map(it => it.max))
			: rollTable._rMax;
		rollTable._rMin = rollTable._rMin == null
			? Math.min(...rollTable.filter(it => it.min != null).map(it => it.min), ...rollTable.filter(it => it.max != null).map(it => it.max))
			: rollTable._rMin;

		const roll = RollerUtil.randomise(rollTable._rMax, rollTable._rMin);

		let result;
		for (let i = 0; i < rollTable.length; i++) {
			const row = rollTable[i];
			const trueMin = row.max != null && row.max < row.min ? row.max : row.min;
			const trueMax = row.max != null && row.max > row.min ? row.max : row.min;
			if (roll >= trueMin && roll <= trueMax) {
				result = Renderer.get().render(row.result);
				break;
			}
		}

		// add dice results
		result = result.replace(RollerUtil.DICE_REGEX, function (match) {
			const r = Renderer.dice.parseRandomise2(match);
			return `<span class="roller" onmousedown="event.preventDefault()" onclick="tablePage.reroll(this)">${match}</span> (<span class="result">${r}</span>)`;
		});

		Renderer.dice.addRoll({name: this._fnGetTableName(meta, table)}, `<span><strong>${TablePage._pad(roll)}</strong> ${result}</span>`);
	}

	reroll (ele) {
		const $ele = $(ele);
		const resultRoll = Renderer.dice.parseRandomise2($ele.html());
		const $result = $ele.next(".result");
		const oldText = $result.text().replace(/\(\)/g, "");
		$result.html(resultRoll);
		JqueryUtil.showCopiedEffect($result, oldText, true);
	}
}
