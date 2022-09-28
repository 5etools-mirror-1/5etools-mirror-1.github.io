"use strict";

class Blocklist {
	static async pInit () {
		const data = await BlocklistUtil.pLoadData();
		const ui = new BlocklistUi({$wrpContent: $(`#blocklist-content`), data});
		await ui.pInit();
		window.dispatchEvent(new Event("toolsLoaded"));
	}
}

window.addEventListener("load", async () => {
	await BrewUtil2.pInit();
	await ExcludeUtil.pInitialise();
	await Blocklist.pInit();
});
