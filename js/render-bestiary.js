"use strict";

class RenderBestiary {
	/**
	 * @param mon Creature data.
	 * @param [options]
	 * @param [options.$btnScaleCr] CR scaler button.
	 * @param [options.$btnResetScaleCr] CR scaler reset button.
	 * @param [options.selSummonSpellLevel] Summon spell level selector.
	 * @param [options.selSummonClassLevel] Summon spell level selector.
	 * @param [options.isSkipExcludesRender] If the "this entity is blocklisted" display should be skipped.
	 */
	static $getRenderedCreature (mon, options) {
		const renderer = Renderer.get();
		return Renderer.monster.getRenderWithPlugins({
			renderer,
			mon,
			fn: () => RenderBestiary._$getRenderedCreature(mon, options, renderer),
		});
	}

	static _$getRenderedCreature (mon, options, renderer) {
		options = options || {};
		Renderer.monster.initParsed(mon);

		const fnGetSpellTraits = Renderer.monster.getSpellcastingRenderedTraits.bind(Renderer.monster, renderer);
		const allTraits = Renderer.monster.getOrderedTraits(mon, {fnGetSpellTraits});
		const allActions = Renderer.monster.getOrderedActions(mon, {fnGetSpellTraits});
		const legGroup = DataUtil.monster.getMetaGroup(mon);

		const renderedVariants = Renderer.monster.getRenderedVariants(mon, {renderer});

		const htmlSourceAndEnvironment = this._$getRenderedCreature_getHtmlSourceAndEnvironment(mon, legGroup);

		const hasToken = mon.tokenUrl || mon.hasToken;
		const extraThClasses = hasToken ? ["mon__name--token"] : null;

		const ptsResource = mon.resource?.length
			? mon.resource
				.map(res => `<tr><td colspan="6"><div ${hasToken ? `class="mon__wrp-avoid-token"` : ""}><strong>${res.name}</strong> ${Renderer.monster.getRenderedResource(res)}</div></td></tr>`)
			: [];

		return $$`
		${Renderer.utils.getBorderTr()}
		${!options.isSkipExcludesRender ? Renderer.utils.getExcludedTr({entity: mon, dataProp: "monster", page: UrlUtil.PG_BESTIARY}) : null}
		${Renderer.utils.getNameTr(mon, {controlRhs: mon.soundClip ? RenderBestiary._getPronunciationButton(mon) : "", extraThClasses, page: UrlUtil.PG_BESTIARY, extensionData: {_scaledCr: mon._scaledCr, _scaledSpellSummonLevel: mon._scaledSpellSummonLevel, _scaledClassSummonLevel: mon._scaledClassSummonLevel}})}
		<tr><td colspan="6">
			<div ${hasToken ? `class="mon__wrp-size-type-align--token"` : ""}><i>${Renderer.monster.getTypeAlignmentPart(mon)}</i></div>
		</td></tr>
		<tr><td class="divider" colspan="6"><div></div></td></tr>

		<tr><td colspan="6"><div ${hasToken ? `class="mon__wrp-avoid-token"` : ""}><strong>Armor Class</strong> ${Parser.acToFull(mon.ac)}</div></td></tr>
		<tr><td colspan="6"><div ${hasToken ? `class="mon__wrp-avoid-token"` : ""}><strong>Hit Points</strong> ${Renderer.monster.getRenderedHp(mon.hp)}</div></td></tr>
		${ptsResource.join("")}
		<tr><td colspan="6"><strong>Speed</strong> ${Parser.getSpeedString(mon)}</td></tr>
		<tr><td class="divider" colspan="6"><div></div></td></tr>

		${Renderer.monster.getRenderedAbilityScores(mon)}
		<tr><td class="divider" colspan="6"><div></div></td></tr>

		${mon.save ? `<tr><td colspan="6"><strong>Saving Throws</strong> ${Renderer.monster.getSavesPart(mon)}</td></tr>` : ""}
		${mon.skill ? `<tr><td colspan="6"><strong>Skills</strong> ${Renderer.monster.getSkillsString(renderer, mon)}</td></tr>` : ""}
		${mon.vulnerable ? `<tr><td colspan="6"><strong>Damage Vulnerabilities</strong> ${Parser.getFullImmRes(mon.vulnerable)}</td></tr>` : ""}
		${mon.resist ? `<tr><td colspan="6"><strong>Damage Resistances</strong> ${Parser.getFullImmRes(mon.resist)}</td></tr>` : ""}
		${mon.immune ? `<tr><td colspan="6"><strong>Damage Immunities</strong> ${Parser.getFullImmRes(mon.immune)}</td></tr>` : ""}
		${mon.conditionImmune ? `<tr><td colspan="6"><strong>Condition Immunities</strong> ${Parser.getFullCondImm(mon.conditionImmune)}</td></tr>` : ""}
		<tr><td colspan="6"><strong>Senses</strong> ${Renderer.monster.getSensesPart(mon)}</td></tr>
		<tr><td colspan="6"><strong>Languages</strong> ${Renderer.monster.getRenderedLanguages(mon.languages)}</td></tr>

		<tr class="relative">${Parser.crToNumber(mon.cr) < VeCt.CR_UNKNOWN ? $$`
		<td colspan="3"><strong>Challenge</strong>
			<span>${Parser.monCrToFull(mon.cr, {isMythic: !!mon.mythic})}</span>
			${options.$btnScaleCr || ""}
			${options.$btnResetScaleCr || ""}
		</td>
		` : `<td colspan="3"><strong>Challenge</strong> <span>\u2014</span></td>`}${mon.pbNote || Parser.crToNumber(mon.cr) < VeCt.CR_CUSTOM ? `<td colspan="3" class="text-right"><strong>Proficiency Bonus</strong> ${mon.pbNote ?? UiUtil.intToBonus(Parser.crToPb(mon.cr), {isPretty: true})}</td>` : ""}</tr>

		<tr>${options.selSummonSpellLevel ? $$`<td colspan="6"><strong>Spell Level</strong> ${options.selSummonSpellLevel}</td>` : ""}</tr>
		<tr>${options.selSummonClassLevel ? $$`<td colspan="6"><strong>Class Level</strong> ${options.selSummonClassLevel}</td>` : ""}</tr>

		${allTraits ? `<tr><td class="divider" colspan="6"><div></div></td></tr>${RenderBestiary._getRenderedSection({prop: "trait", entries: allTraits})}` : ""}
		${allActions ? `${this._getRenderedSectionHeader({mon, title: "Actions", prop: "action"})}
		${RenderBestiary._getRenderedSection({mon, prop: "action", entries: allActions})}` : ""}
		${mon.bonus ? `${this._getRenderedSectionHeader({mon, title: "Bonus Actions", prop: "bonus"})}
		${RenderBestiary._getRenderedSection({mon, prop: "bonus", entries: mon.bonus})}` : ""}
		${mon.reaction ? `${this._getRenderedSectionHeader({mon, title: "Reactions", prop: "reaction"})}
		${RenderBestiary._getRenderedSection({mon, prop: "reaction", entries: mon.reaction})}` : ""}
		${mon.legendary ? `${this._getRenderedSectionHeader({mon, title: "Legendary Actions", prop: "legendary"})}
		${RenderBestiary._getRenderedSection({mon, prop: "legendary", entries: mon.legendary, fnGetHeader: Renderer.monster.getLegendaryActionIntro.bind(Renderer.monster)})}` : ""}
		${mon.mythic ? `${this._getRenderedSectionHeader({mon, title: "Mythic Actions", prop: "mythic"})}
		${RenderBestiary._getRenderedSection({mon, prop: "mythic", entries: mon.mythic})}` : ""}

		${legGroup && legGroup.lairActions ? `<tr><td colspan="6" class="mon__stat-header-underline"><h3 class="mon__sect-header-inner">Lair Actions</h3></td></tr>
		${RenderBestiary._getRenderedSection({prop: "lairaction", entries: legGroup.lairActions, depth: -1})}` : ""}
		${legGroup && legGroup.regionalEffects ? `<tr><td colspan="6" class="mon__stat-header-underline"><h3 class="mon__sect-header-inner">Regional Effects</h3></td></tr>
		${RenderBestiary._getRenderedSection({prop: "regionaleffect", entries: legGroup.regionalEffects, depth: -1})}` : ""}

		${renderedVariants ? `<tr><td colspan=6>${renderedVariants}</td></tr>` : ""}
		${mon.footer ? `<tr><td colspan=6 class="mon__sect-row-inner">${renderer.render({entries: mon.footer})}</td></tr>` : ""}
		${mon.summonedBySpell ? `<tr><td colspan="6"><b>Summoned By:</b> ${renderer.render(`{@spell ${mon.summonedBySpell}}`)}</td></tr>` : ""}
		${htmlSourceAndEnvironment.length === 2 ? `<tr><td colspan="6">${htmlSourceAndEnvironment[1]}</td></tr>` : ""}
		<tr><td colspan="6">${htmlSourceAndEnvironment[0]}</td></tr>
		${Renderer.utils.getBorderTr()}`;
	}

	static _getRenderedSectionHeader ({mon, title, prop}) {
		const propNote = `${prop}Note`;
		return `<tr><td colspan="6" class="mon__stat-header-underline"><h3 class="mon__sect-header-inner">${title}${mon[propNote] ? ` (<span class="small">${mon[propNote]}</span>)` : ""}</h3></td></tr>`;
	}

	static _getRenderedSection ({mon = null, prop, entries, depth = 1, fnGetHeader = null}) {
		const renderer = Renderer.get();
		const renderStack = [];

		switch (prop) {
			case "lairaction":
			case "regionaleffect": {
				renderer.setFirstSection(true).recursiveRender({entries: entries}, renderStack, {depth: depth + 1});
				break;
			}

			case "legendary":
			case "mythic": {
				const cpy = MiscUtil.copy(entries).map(it => {
					if (it.name && it.entries) {
						it.name = `${it.name}.`;
						it.type = it.type || "item";
					}
					return it;
				});
				const toRender = {type: "list", style: "list-hang-notitle", items: cpy};
				renderer.setFirstSection(true).recursiveRender(toRender, renderStack, {depth: depth});
				break;
			}

			default: {
				entries.forEach(e => {
					if (e.rendered) renderStack.push(e.rendered);
					else renderer.setFirstSection(true).recursiveRender(e, renderStack, {depth: depth + 1});
				});
			}
		}

		const ptHeader = mon
			? (fnGetHeader ? fnGetHeader(mon) : Renderer.monster.getSectionIntro(mon, {prop}))
			: "";

		return `${ptHeader ? `<tr><td colspan="6">${ptHeader}</td></tr>` : ""}
			<tr><td colspan="6" class="mon__sect-row-inner">${renderStack.join("")}</td></tr>`;
	}

	static _getPronunciationButton (mon) {
		return `<button class="btn btn-xs btn-default btn-name-pronounce ml-2 mb-2 ve-self-flex-end">
			<span class="glyphicon glyphicon-volume-up name-pronounce-icon"></span>
			<audio class="name-pronounce" preload="none">
			   <source src="${Renderer.utils.getMediaUrl(mon, "soundClip", "audio")}" type="audio/mpeg">
			</audio>
		</button>`;
	}

	static _$getRenderedCreature_getHtmlSourceAndEnvironment (mon, legGroup) {
		const srcCpy = {
			source: mon.source,
			page: mon.page,
			srd: mon.srd,
			sourceSub: mon.sourceSub,
			otherSources: mon.otherSources,
			additionalSources: mon.additionalSources,
			externalSources: mon.externalSources,
			reprintedAs: mon.reprintedAs,
		};
		const additional = mon.additionalSources ? MiscUtil.copy(mon.additionalSources) : [];
		if (mon.variant?.length) {
			mon.variant.forEach(v => {
				if (!v.source) return "";
				additional.push({
					source: v.source,
					page: v.page,
				});
			});
		}
		if (legGroup) {
			if (legGroup.source !== mon.source) additional.push({source: legGroup.source, page: legGroup.page});
			if (legGroup.additionalSources) additional.push(...MiscUtil.copy(legGroup.additionalSources));
		}
		srcCpy.additionalSources = additional;

		const pageTrInner = Renderer.utils.getSourceAndPageTrHtml(srcCpy, {tag: "creature", fnUnpackUid: (uid) => DataUtil.generic.unpackUid(uid, "creature")});
		if (!mon.environment?.length) return [pageTrInner];
		return [pageTrInner, `<div class="mb-1 mt-2"><b>Environment:</b> ${Renderer.monster.getRenderedEnvironment(mon.environment)}</div>`];
	}

	static $getRenderedLegendaryGroup (legGroup) {
		return $$`
		${Renderer.utils.getBorderTr()}
		${Renderer.utils.getNameTr(legGroup)}
		<tr class="text"><td colspan="6" class="text">
			${legGroup.lairActions && legGroup.lairActions.length ? Renderer.get().render({type: "entries", entries: [{type: "entries", name: "Lair Actions", entries: legGroup.lairActions}]}) : ""}
			${legGroup.regionalEffects && legGroup.regionalEffects.length ? Renderer.get().render({type: "entries", entries: [{type: "entries", name: "Regional Effects", entries: legGroup.regionalEffects}]}) : ""}
			${legGroup.mythicEncounter && legGroup.mythicEncounter.length ? Renderer.get().render({type: "entries", entries: [{type: "entries", name: `<i title="This will display the creature's name when this legendary group is referenced from a creature statblock." class="help-subtle">&lt;Creature Name&gt;</i> as a Mythic Encounter`, entries: legGroup.mythicEncounter}]}) : ""}
		</td></tr>
		${Renderer.utils.getBorderTr()}`;
	}
}
