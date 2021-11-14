class RenderRaces {
	static $getRenderedRace (race) {
		const renderer = Renderer.get().setFirstSection(true);

		const $ptHeightWeight = RenderRaces._$getHeightAndWeightPart(race);

		return $$`
		${Renderer.utils.getBorderTr()}
		${Renderer.utils.getExcludedTr({entity: race, dataProp: "race"})}
		${Renderer.utils.getNameTr(race, {controlRhs: race.soundClip ? RenderRaces._getPronunciationButton(race) : "", page: UrlUtil.PG_RACES})}
		<tr><td colspan="6"><b>Ability Scores:</b> ${(race.ability ? Renderer.getAbilityData(race.ability) : {asText: "None"}).asText}</td></tr>
		${(race.creatureTypes || []).filter(it => `${it}`.toLowerCase() !== "humanoid").length ? `<tr><td colspan="6"><b>Creature Type:</b> ${Parser.raceCreatureTypesToFull(race.creatureTypes)}</td></tr>` : ""}
		<tr><td colspan="6"><b>Size:</b> ${(race.size || [SZ_VARIES]).map(sz => Parser.sizeAbvToFull(sz)).join("/")}</td></tr>
		<tr><td colspan="6"><b>Speed:</b> ${Parser.getSpeedString(race)}</td></tr>
		<tr><td class="divider" colspan="6"><div></div></td></tr>
		${race._isBaseRace ? `<tr class="text"><td colspan="6">${renderer.render({type: "entries", entries: race._baseRaceEntries}, 1)}</td></tr>` : `<tr class="text"><td colspan="6">${renderer.render({type: "entries", entries: race.entries}, 1)}</td></tr>`}

		${race.traitTags && race.traitTags.includes("NPC Race") ? `<tr class="text"><td colspan="6"><section class="text-muted">
			${renderer.render(`{@i Note: This race is listed in the {@i Dungeon Master's Guide} as an option for creating NPCs. It is not designed for use as a playable race.}`, 2)}
		 </section></td></tr>` : ""}

		${$ptHeightWeight ? $$`<tr class="text"><td colspan="6"><hr class="rd__hr">${$ptHeightWeight}</td></tr>` : ""}

		${Renderer.utils.getPageTr(race)}
		${Renderer.utils.getBorderTr()}`;
	}

	static _getPronunciationButton (race) {
		return `<button class="btn btn-xs btn-default btn-name-pronounce ml-2 mb-2 self-flex-end">
			<span class="glyphicon glyphicon-volume-up name-pronounce-icon"></span>
			<audio class="name-pronounce">
			   <source src="${Renderer.utils.getMediaUrl(race, "soundClip", "audio")}" type="audio/mpeg">
			</audio>
		</button>`;
	}

	static _$getHeightAndWeightPart (race) {
		if (!race.heightAndWeight) return null;
		if (race._isBaseRace) return null;

		const getRenderedHeight = (height) => {
			const heightFeet = Math.floor(height / 12);
			const heightInches = height % 12;
			return `${heightFeet ? `${heightFeet}'` : ""}${heightInches ? `${heightInches}"` : ""}`;
		};

		const entries = [
			"You may roll for your character's height and weight on the Random Height and Weight table. The roll in the Height Modifier column adds a number (in inches) to the character's base height. To get a weight, multiply the number you rolled for height by the roll in the Weight Modifier column and add the result (in pounds) to the base weight.",
			{
				type: "table",
				caption: "Random Height and Weight",
				colLabels: ["Base Height", "Base Weight", "Height Modifier", "Weight Modifier", ""],
				colStyles: ["col-2-3 text-center", "col-2-3 text-center", "col-2-3 text-center", "col-2 text-center", "col-3-1 text-center"],
				rows: [
					[
						getRenderedHeight(race.heightAndWeight.baseHeight),
						`${race.heightAndWeight.baseWeight} lb.`,
						`+<span data-race-heightmod="true"></span>`,
						`× <span data-race-weightmod="true"></span> lb.`,
						`<div class="flex-vh-center">
							<div class="ve-hidden race__disp-result-height-weight flex-v-baseline">
								<div class="mr-1">=</div>
								<div class="race__disp-result-height"></div>
								<div class="mr-2">; </div>
								<div class="race__disp-result-weight mr-1"></div>
								<div class="small">lb.</div>
							</div>
							<button class="btn btn-default btn-xs my-1 race__btn-roll-height-weight">Roll</button>
						</div>`,
					],
				],
			},
		];

		const $render = $$`${Renderer.get().render({entries})}`;

		// {@dice ${race.heightAndWeight.heightMod}||Height Modifier}
		// ${ptWeightMod}

		const $dispResult = $render.find(`.race__disp-result-height-weight`);
		const $dispHeight = $render.find(`.race__disp-result-height`);
		const $dispWeight = $render.find(`.race__disp-result-weight`);

		const lock = new VeLock();
		let hasRolled = false;
		let resultHeight;
		let resultWeightMod;

		const $btnRollHeight = $render
			.find(`[data-race-heightmod="true"]`)
			.html(race.heightAndWeight.heightMod)
			.addClass("roller")
			.mousedown(evt => evt.preventDefault())
			.click(async () => {
				try {
					await lock.pLock();

					if (!hasRolled) return pDoFullRoll(true);
					await pRollHeight();
					updateDisplay();
				} finally {
					lock.unlock();
				}
			});

		const isWeightRoller = race.heightAndWeight.weightMod && isNaN(race.heightAndWeight.weightMod);
		const $btnRollWeight = $render
			.find(`[data-race-weightmod="true"]`)
			.html(isWeightRoller ? `(<span class="roller">${race.heightAndWeight.weightMod}</span>)` : race.heightAndWeight.weightMod || "1")
			.click(async () => {
				try {
					await lock.pLock();

					if (!hasRolled) return pDoFullRoll(true);
					await pRollWeight();
					updateDisplay();
				} finally {
					lock.unlock();
				}
			});
		if (isWeightRoller) $btnRollWeight.mousedown(evt => evt.preventDefault());

		const $btnRoll = $render
			.find(`button.race__btn-roll-height-weight`)
			.click(async () => pDoFullRoll());

		const pRollHeight = async () => {
			const mResultHeight = await Renderer.dice.pRoll2(race.heightAndWeight.heightMod, {
				isUser: false,
				label: "Height Modifier",
				name: race.name,
			});
			if (mResultHeight == null) return;
			resultHeight = mResultHeight;
		};

		const pRollWeight = async () => {
			const weightModRaw = race.heightAndWeight.weightMod || "1";
			const mResultWeightMod = isNaN(weightModRaw) ? await Renderer.dice.pRoll2(weightModRaw, {
				isUser: false,
				label: "Weight Modifier",
				name: race.name,
			}) : Number(weightModRaw);
			if (mResultWeightMod == null) return;
			resultWeightMod = mResultWeightMod;
		};

		const updateDisplay = () => {
			const renderedHeight = getRenderedHeight(race.heightAndWeight.baseHeight + resultHeight);
			const totalWeight = race.heightAndWeight.baseWeight + (resultWeightMod * resultHeight);
			$dispHeight.text(renderedHeight);
			$dispWeight.text(totalWeight);
		};

		const pDoFullRoll = async isPreLocked => {
			try {
				if (!isPreLocked) await lock.pLock();

				$btnRoll.parent().removeClass(`flex-vh-center`).addClass(`split-v-center`);
				await pRollHeight();
				await pRollWeight();
				$dispResult.removeClass(`ve-hidden`);
				updateDisplay();

				hasRolled = true;
			} finally {
				if (!isPreLocked) lock.unlock();
			}
		};

		return $render;
	}
}
