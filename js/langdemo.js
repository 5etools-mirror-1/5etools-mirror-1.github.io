import {Ro_Lexer, Ro_Parser, Ro_Lang} from "./rolang.js";

class LangDemoUi {
	static init () {
		$(`#btn__run`).click(() => LangDemoUi.pRun());
		$(`#btn__validate`).click(async () => {
			const msg = await Ro_Lang.pValidate(LangDemoUi._$ipt.val(), LangDemoUi.RESOLVER);
			LangDemoUi._handleInvalidMessage(msg);
		});
		$(`#btn__resolve_dynamics`).click(async () => {
			const val = await Ro_Lang.pResolveDynamics(LangDemoUi._$ipt.val(), LangDemoUi.RESOLVER);
			LangDemoUi._$ipt.val(val);
		});
		$(`#btn__validate_dynamics`).click(async () => {
			const msg = await Ro_Lang.pValidateDynamics(LangDemoUi._$ipt.val(), LangDemoUi.RESOLVER);
			LangDemoUi._handleInvalidMessage(msg);
		});

		// region select sample
		const $selSample = $(`#sel__sample`);
		LangDemoUi._SAMPLES.forEach((it, i) => {
			$selSample.append(`<option value="${i}">${it.name}</option>`);
		});
		$selSample.change(() => {
			const sample = LangDemoUi._SAMPLES[$selSample.val()];
			LangDemoUi._$ipt.val(sample.code).change();
		});
		$selSample.val("-1");
		// endregion

		// region input
		LangDemoUi._$ipt = $(`#ipt`);
		LangDemoUi._$ipt.change(() => {
			StorageUtil.syncSetForPage("input", LangDemoUi._$ipt.val());
		});
		const prevInput = StorageUtil.syncGetForPage("input");
		if (prevInput && prevInput.trim()) LangDemoUi._$ipt.val(prevInput.trim());
		// endregion

		// region context
		const saveContext = () => {
			const toSave = LangDemoUi._metasContext.map(it => ({name: it.$iptName.val(), val: it.$iptVal.val()}));
			StorageUtil.syncSetForPage("context", toSave);
		};

		const loadContext = () => {
			const loaded = StorageUtil.syncGetForPage("context");
			if (loaded != null) {
				loaded.forEach(it => addContextRow(it.name, it.val));
			}
		};

		const addContextRow = (name, value) => {
			const $iptName = $(`<input class="form-control form-control--minimal input-xs mr-2 code" placeholder="Identifier">`)
				.change(() => saveContext())
				.val(name);

			const $iptVal = $(`<input class="form-control form-control--minimal input-xs mr-2 code" type="number" placeholder="Value">`)
				.change(() => saveContext())
				.val(value);

			const $btnDel = $(`<button class="btn btn-xs btn-danger" tabindex="-1"><span class="glyphicon glyphicon-trash"/></button>`)
				.click(() => {
					const ix = LangDemoUi._metasContext.indexOf(out);
					if (~ix) {
						LangDemoUi._metasContext.splice(ix, 1);
						$row.remove();
						saveContext();
					}
				});

			const out = {$iptName, $iptVal};
			LangDemoUi._metasContext.push(out);
			const $row = $$`<div class="mb-2 flex-v-center">${$iptName}<span class="mr-2">=</span>${$iptVal}${$btnDel}</div>`.appendTo(LangDemoUi._$wrpContext);
		};

		LangDemoUi._$wrpContext = $(`#wrp_context`);
		const $btnAdd = $(`<button class="btn btn-xs btn-default">Add Context</button>`)
			.click(() => addContextRow());
		$$`<div class="mb-2 flex-v-center">${$btnAdd}</div>`.appendTo(LangDemoUi._$wrpContext);

		loadContext();
		// endregion

		window.dispatchEvent(new Event("toolsLoaded"));
	}

	static _handleInvalidMessage (msg) {
		if (msg) JqueryUtil.doToast({content: `Invalid \u2014 ${msg}`, type: "danger"});
		else JqueryUtil.doToast({content: `Valid!`, type: "success"});
	}

	static async pRun () {
		const ipt = LangDemoUi._$ipt.val().trim();

		// Check if valid, but continue execution regardless to ease debugging
		const invalidMsg = await Ro_Lang.pValidate(ipt, LangDemoUi.RESOLVER);
		if (invalidMsg) LangDemoUi._handleInvalidMessage(invalidMsg);

		const $dispOutLexed = $(`#out_lexed`).html("");
		const $dispOutParsed = $(`#out_parsed`).html("");
		const $dispOutResult = $(`#out_result`).html("");

		const lexer = new Ro_Lexer();
		const lexed = lexer.lex(ipt);

		$dispOutLexed.html(lexed.map(it => it ? it.toDebugString() : "").join("\n"));

		const parser = new Ro_Parser(lexed);
		const parsed = parser.parse();

		$dispOutParsed.html(`${parsed}`);

		const ctx = LangDemoUi._metasContext
			.mergeMap(it => ({[it.$iptName.val().trim()]: Number(it.$iptVal.val()) || 0}));
		const result = await parsed.pEvl(ctx, LangDemoUi.RESOLVER);
		if (result.isCancelled) $dispOutResult.text("Cancelled!");
		else $dispOutResult.text(result.val == null ? `(null)` : result.val);
	}
}
LangDemoUi._$ipt = null;
LangDemoUi._$wrpContext = null;
LangDemoUi._metasContext = [];
LangDemoUi._SAMPLES = [
	{
		name: "Empty",
		code: `



`,
	},
	{
		name: "Number",
		code: `1`,
	},
	{
		name: "Sum",
		code: `1 + 1`,
	},
	{
		name: "Multiplication",
		code: `2 * 3`,
	},
	{
		name: "Exponent",
		code: `3^3^2  # Should equal 19683`,
	},
	{
		name: "If-elif-else",
		code: `if r == 20: 1
elif r > 1:
  2
else:
  3
4`,
	},
	{
		name: "If-elif",
		code: `if r == 20: 1
elif r > 1:
  2`,
	},
	{
		name: "If-else",
		code: `if r == 20: 1
else:
  2`,
	},
	{
		name: "If",
		code: `if r == 20: 1`,
	},
	{
		name: "If (trailing return)",
		code: `if r == 20: 1
2`,
	},
	{
		name: "Condition Negation",
		code: `if not r: 2`,
	},
	{
		name: "Parentheses",
		code: `(2 + 3) * 4  # Should equal 20`,
	},
	{
		name: "Dynamic Int",
		code: `if @user_int > 10: 2`,
	},
	{
		name: "Labelled Dynamic Int",
		code: `if (@user_int|Enter: a /*+-^,!= (Number)) > 10: 2`,
	},
	{
		name: "Selectable Dynamic Int",
		code: `if (@user_int|| 1 = One Apple| 2 = Two Bananas |3|4|11=11 Oranges) > 10: 2`,
	},
	{
		name: "Dynamic Bool",
		code: `if not @user_bool: 3`,
	},
	{
		name: "Labelled Dynamic Bool",
		code: `if not (@user_bool|Choose: /*+-^,!= (Yes\\No)): 4`,
	},
	{
		name: "Custom Buttons Dynamic Bool",
		code: `if (@user_bool||Good | Evil): 2`,
	},
	{
		name: "Selectable Dynamic Bool",
		code: `if not (@user_bool|Pick| true = Good| false = Evil |true|false|true=Lawful): 2`,
	},
];
LangDemoUi.RESOLVER = {
	has: () => true,
	get: (path) => {
		const out = Math.round(Math.random() * 50);
		JqueryUtil.doToast(`Randomized ${path} as ${out}`);
		return out;
	},
};

window.addEventListener("load", () => LangDemoUi.init());
