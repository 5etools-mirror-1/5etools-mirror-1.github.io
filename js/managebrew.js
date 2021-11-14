"use strict";

class ManageBrew {
	static async pInitialise () {
		await BrewUtil.pAddBrewData();
		return ManageBrew.pRender();
	}

	static async pRender () {
		// standard brew manager
		const $brew = $(`#brewmanager`).empty();
		await BrewUtil._pRenderBrewScreen($brew);

		// brew meta manager
		if (BrewUtil.homebrewMeta) {
			const $meta = $(`#metamanager`).empty();
			const metaKeys = Object.keys(BrewUtil.homebrewMeta).filter(it => it !== "sources");
			if (metaKeys.length) {
				$meta.append(`
					<hr>
					<h4>Metadata</h4>
					<p><i>Warning: deleting metadata may invalidate or otherwise corrupt homebrew that depends on it. Use with caution.</i></p>
				`);

				const handleSecChange = (i) => {
					if (i < metaKeys.length - 1) {
						$meta.append(`<br>`);
					}
				};

				metaKeys.sort(SortUtil.ascSort).forEach((metaType, i) => {
					const populateGenericSection = (title, displayFn) => {
						const $wrpSect = $(`<div/>`).appendTo($meta);

						const renderSection = () => {
							const keys = Object.keys(BrewUtil.homebrewMeta[metaType] || {});

							$wrpSect.empty();
							if (keys.length) {
								$wrpSect.append(`<div class="bold">${title}:</div>`);
								const $lst = $(`<div class="list-display-only pt-0"></div>`).appendTo($wrpSect);

								keys.forEach(k => {
									const toDisplay = displayFn ? displayFn(BrewUtil.homebrewMeta, metaType, k) : k.toTitleCase();

									const $row = $(`<div class="lst__row manbrew__row lst--border flex-v-center lst__row-inner">
										<span class="action col-10">${toDisplay}</span>
									</div>`).appendTo($lst);

									const $btns = $(`<span class="col-2 text-right"/>`).appendTo($row);
									$(`<button class="btn btn-danger btn-sm"><span class="glyphicon glyphicon-trash"></span></button>`).appendTo($btns).click(() => {
										delete BrewUtil.homebrewMeta[metaType][k];
										if (!Object.keys(BrewUtil.homebrewMeta[metaType]).length) delete BrewUtil.homebrewMeta[metaType];
										StorageUtil.syncSet(VeCt.STORAGE_HOMEBREW_META, BrewUtil.homebrewMeta);
										renderSection();
									});
								});
							}
						};

						renderSection();
					};

					switch (metaType) {
						case "spellDistanceUnits": populateGenericSection("Spell Distance Units"); break;
						case "spellSchools": populateGenericSection("Spell Schools", (brew, metaType, k) => brew[metaType][k].full || k); break;
						case "currencyConversions": populateGenericSection("Currency Conversion Tables", (brew, metaType, k) => `${k}: ${brew[metaType][k].map(it => `${it.coin}=${it.mult}`).join(", ")}`); break;
						case "skills": populateGenericSection("Skills"); break;
						case "senses": populateGenericSection("Senses"); break;
						case "optionalFeatureTypes": populateGenericSection("Optional Feature Types", (brew, metaType, k) => brew[metaType][k] || k); break;
						case "charOption": populateGenericSection("Character Creation Option Types", (brew, metaType, k) => brew[metaType][k] || k); break;
						case "psionicTypes": populateGenericSection("Psionic Types", (brew, metaType, k) => brew[metaType][k].full || k); break;
					}
					handleSecChange(i);
				});
			}
		}
	}
}

window.addEventListener("load", async () => {
	ExcludeUtil.pInitialise(); // don't await, as this is only used for search
	await ManageBrew.pInitialise();

	window.dispatchEvent(new Event("toolsLoaded"));
});
