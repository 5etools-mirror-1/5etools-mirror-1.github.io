"use strict";

const JSON_URL = "data/renderdemo.json";
const STORAGE_LOCATION = "demoInput";

window.addEventListener("load", async () => {
	await Promise.all([
		PrereleaseUtil.pInit(),
		BrewUtil2.pInit(),
	]);
	const rendererType = await StorageUtil.pGetForPage("renderer");
	ExcludeUtil.pInitialise().then(null); // don't await, as this is only used for search
	PrereleaseUtil.pGetBrewProcessed().then(null); // don't await, as this is only used for tags
	BrewUtil2.pGetBrewProcessed().then(null); // don't await, as this is only used for tags
	const data = await DataUtil.loadJSON(JSON_URL);
	return initDemo(data, rendererType);
});

async function initDemo (data, rendererType) {
	const defaultJson = data.data[0];

	let renderer;

	const $msg = $(`#message`);
	const $in = $(`#jsoninput`);
	const $out = $(`#pagecontent`);

	const $selRenderer = $(`#demoSelectRenderer`);
	const $btnRender = $(`#demoRender`);
	const $btnReset = $(`#demoReset`);

	function setRenderer (rendererType) {
		switch (rendererType) {
			case "html": {
				renderer = Renderer.get();
				$out.removeClass("whitespace-pre").removeClass("code");
				break;
			}
			case "md": {
				renderer = RendererMarkdown.get();
				$out.addClass("whitespace-pre").addClass("code");
				break;
			}
			case "cards": {
				renderer = RendererCard.get();
				$out.addClass("whitespace-pre").addClass("code");
				break;
			}
			default: throw new Error(`Unhandled renderer!`);
		}
	}

	setRenderer(rendererType || "html");
	$selRenderer.val(rendererType || "html");

	// init editor
	const editor = EditorUtil.initEditor("jsoninput", {mode: "ace/mode/json"});

	function demoRender () {
		$msg.html("");
		const renderStack = [];
		let json;
		try {
			json = JSON.parse(editor.getValue());
		} catch (e) {
			$msg.html(`Invalid JSON! We recommend using <a href="https://jsonlint.com/" target="_blank" rel="noopener noreferrer">JSONLint</a>.`);
			setTimeout(() => {
				throw e;
			});
		}

		renderer.setFirstSection(true);
		renderer.resetHeaderIndex();
		renderer.recursiveRender(json, renderStack);
		$out.html(`
			<tr><th class="border" colspan="6"></th></tr>
			<tr class="text"><td colspan="6">${renderStack.join("")}</td></tr>
			<tr><th class="border" colspan="6"></th></tr>
		`);
	}

	function demoReset () {
		editor.setValue(JSON.stringify(defaultJson, null, "\t"));
		editor.clearSelection();
		demoRender();
		editor.selection.moveCursorToPosition({row: 0, column: 0});
	}

	try {
		const prevInput = await StorageUtil.pGetForPage(STORAGE_LOCATION);
		if (prevInput) {
			editor.setValue(prevInput, -1);
			demoRender();
		} else demoReset();
	} catch (ignored) {
		setTimeout(() => { throw ignored; });
		demoReset();
	}

	const renderAndSaveDebounced = MiscUtil.debounce(() => {
		demoRender();
		StorageUtil.pSetForPage(STORAGE_LOCATION, editor.getValue());
	}, 150);

	$selRenderer.change(() => {
		const val = $selRenderer.val();
		setRenderer(val);
		demoRender();
		StorageUtil.pSetForPage("renderer", val);
	});
	$btnReset.click(() => demoReset());
	$btnRender.click(() => demoRender());
	editor.on("change", () => renderAndSaveDebounced()); // N.B. specific "change" format required by Ace.js

	window.dispatchEvent(new Event("toolsLoaded"));
}
