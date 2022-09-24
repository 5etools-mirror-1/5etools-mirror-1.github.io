"use strict";

class Disallowlist {
	static async pInit () {
		const data = await DisallowlistUtil.pLoadData();
		const ui = new DisallowlistUi({$wrpContent: $(`#disallowlist-content`), data});
		await ui.pInit();
		window.dispatchEvent(new Event("toolsLoaded"));
	}
}

window.addEventListener("load", async () => {
	await BrewUtil2.pInit();
	await ExcludeUtil.pInitialise();
	await Disallowlist.pInit();
});
