"use strict";

window.addEventListener("load", () => doPageInit());

class ConverterUiUtil {
	static renderSideMenuDivider ($menu, heavy) { $menu.append(`<hr class="sidemenu__row__divider ${heavy ? "sidemenu__row__divider--heavy" : ""} w-100 hr-2">`); }

	static getAceMode (inputMode) {
		return {
			"md": "ace/mode/markdown",
			"html": "ace/mode/html",
		}[inputMode] || "ace/mode/text";
	}
}

class BaseConverter extends BaseComponent {
	static _getDisplayMode (mode) {
		switch (mode) {
			case "html": return "HTML";
			case "md": return "Markdown";
			case "txt": return "Text";
			default: throw new Error(`Unimplemented!`);
		}
	}

	/**
	 * @param ui Converter UI instance.
	 * @param opts Options object.
	 * @param opts.converterId Converter unique ID.
	 * @param [opts.canSaveLocal] If the output of this converter is suitable for saving to local homebrew.
	 * @param opts.modes Available converter parsing modes (e.g. "txt", "html", "md")
	 * @param [opts.hasPageNumbers] If the entity has page numbers.
	 * @param [opts.titleCaseFields] Array of fields to be (optionally) title-cased.
	 * @param [opts.hasSource] If the output entities can have a source field.
	 * @param opts.prop The data prop for the output entrity.
	 */
	constructor (ui, opts) {
		super();
		this._ui = ui;

		this._converterId = opts.converterId;
		this._canSaveLocal = !!opts.canSaveLocal;
		this._modes = opts.modes;
		this._hasPageNumbers = opts.hasPageNumbers;
		this._titleCaseFields = opts.titleCaseFields;
		this._hasSource = opts.hasSource;
		this._prop = opts.prop;

		// Add default starting state from options
		this._state.mode = this._modes[0];
		if (this._hasPageNumbers) this._state.page = 0;
		if (this._titleCaseFields) this._state.isTitleCase = false;
		if (this._hasSource) this._state.source = "";

		this._addHookAll("state", this._ui.saveSettingsDebounced);
	}

	get converterId () { return this._converterId; }
	get canSaveLocal () { return this._canSaveLocal; }
	get prop () { return this._prop; }

	get source () { return this._hasSource ? this._state.source : null; }
	set source (val) {
		if (!this._hasSource) return;
		this._state.source = val;
	}

	get mode () { return this._state.mode; }

	renderSidebar (parent, $parent) {
		const $wrpSidebar = $(`<div class="w-100 ve-flex-col"/>`).appendTo($parent);
		const hkShowSidebar = () => $wrpSidebar.toggleClass("hidden", parent.get("converter") !== this._converterId);
		parent.addHook("converter", hkShowSidebar);
		hkShowSidebar();

		this._renderSidebar(parent, $wrpSidebar);
		this._renderSidebarSamplesPart(parent, $wrpSidebar);
		this._renderSidebarConverterOptionsPart(parent, $wrpSidebar);
		this._renderSidebarPagePart(parent, $wrpSidebar);
		this._renderSidebarSourcePart(parent, $wrpSidebar);
	}

	_renderSidebar () { throw new Error("Unimplemented!"); }
	handleParse () { throw new Error("Unimplemented!"); }
	_getSample () { throw new Error("Unimplemented!"); }

	// region sidebar
	_renderSidebarSamplesPart (parent, $wrpSidebar) {
		const $btnsSamples = this._modes.map(mode => {
			return $(`<button class="btn btn-xs btn-default">Sample ${BaseConverter._getDisplayMode(mode)}</button>`)
				.click(() => {
					this._ui.inText = this._getSample(mode);
					this._state.mode = mode;
				});
		});

		$$`<div class="w-100 ve-flex-vh-center-around">${$btnsSamples}</div>`.appendTo($wrpSidebar);

		ConverterUiUtil.renderSideMenuDivider($wrpSidebar);
	}

	_renderSidebarConverterOptionsPart (parent, $wrpSidebar) {
		const hasModes = this._modes.length > 1;

		if (!hasModes && !this._titleCaseFields) return;

		const hkMode = () => {
			this._ui._editorIn.setOptions({
				mode: ConverterUiUtil.getAceMode(this._state.mode),
			});
		};
		this._addHookBase("mode", hkMode);
		hkMode();

		if (hasModes) {
			const $selMode = ComponentUiUtil.$getSelEnum(this, "mode", {values: this._modes, html: `<select class="form-control input-xs select-inline"></select>`, fnDisplay: it => `Parse as ${BaseConverter._getDisplayMode(it)}`});
			$$`<div class="w-100 mt-2 ve-flex-vh-center-around">${$selMode}</div>`.appendTo($wrpSidebar);
		}

		if (this._titleCaseFields) {
			const $cbTitleCase = ComponentUiUtil.$getCbBool(this, "isTitleCase");
			$$`<div class="w-100 mt-2 split-v-center">
				<label class="sidemenu__row__label sidemenu__row__label--cb-label" title="Should the creature's name be converted to title-case? Useful when pasting a name which is all-caps."><span>Title-Case Name</span>
				${$cbTitleCase}
			</label></div>`.appendTo($wrpSidebar);
		}
		ConverterUiUtil.renderSideMenuDivider($wrpSidebar);
	}

	_renderSidebarPagePart (parent, $wrpSidebar) {
		if (!this._hasPageNumbers) return;

		const getBtnIncrementDecrement = (dir) => {
			const verb = ~dir ? "Increment" : "Decrement";
			return $(`<button class="btn btn-xs btn-default h-100" title="${verb} Page Number (SHIFT to ${verb} by 5)"><span class="glyphicon glyphicon-${~dir ? "plus" : "minus"}"></span></button>`)
				.on("click", evt => this._state.page += dir * (evt.shiftKey ? 5 : 1));
		};

		const $iptPage = ComponentUiUtil.$getIptInt(this, "page", 0)
			.addClass("max-w-80p");
		$$`<div class="w-100 split-v-center">
			<div class="sidemenu__row__label mr-2 help" title="Note that a line of the form &quot;PAGE=&lt;page number&gt;&quot; in the Input will set the page in the Output, ignoring any value set here. This is especially useful when parsing multiple inputs delimited by a separator.">Page</div>
			<div class="btn-group input-group ve-flex-v-center h-100">
				${getBtnIncrementDecrement(-1)}
				${$iptPage}
				${getBtnIncrementDecrement(1)}
			</div>
		</div>`.appendTo($wrpSidebar);

		ConverterUiUtil.renderSideMenuDivider($wrpSidebar);
	}

	_renderSidebarSourcePart (parent, $wrpSidebar) {
		if (!this._hasSource) return;

		const $wrpSourceOverlay = $(`<div class="h-100 w-100"/>`);
		let modalMeta = null;

		const rebuildStageSource = (options) => {
			SourceUiUtil.render({
				...options,
				$parent: $wrpSourceOverlay,
				cbConfirm: async (source) => {
					const isNewSource = options.mode !== "edit";

					if (isNewSource) await BrewUtil2.pAddSource(source);
					else await BrewUtil2.pEditSource(source);

					if (isNewSource) parent.doRefreshAvailableSources();
					this._state.source = source.json;

					if (modalMeta) modalMeta.doClose();
				},
				cbConfirmExisting: (source) => {
					this._state.source = source.json;

					if (modalMeta) modalMeta.doClose();
				},
				cbCancel: () => {
					if (modalMeta) modalMeta.doClose();
				},
			});
		};

		const $selSource = $$`
			<select class="form-control input-xs"><option value="">(None)</option></select>`
			.change(() => this._state.source = $selSource.val());

		$(`<option/>`, {val: "5e_divider", text: `\u2014`, disabled: true}).appendTo($selSource);

		Object.keys(Parser.SOURCE_JSON_TO_FULL)
			.forEach(src => $(`<option/>`, {val: src, text: Parser.sourceJsonToFull(src)}).appendTo($selSource));

		const hkAvailSources = () => {
			const curSources = new Set($selSource.find(`option`).map((i, e) => $(e).val()));
			curSources.add("");
			const nxtSources = new Set(parent.get("availableSources"));
			nxtSources.add("");
			nxtSources.add("5e_divider");
			Object.keys(Parser.SOURCE_JSON_TO_FULL).forEach(it => nxtSources.add(it));

			const optionsToAdd = [];

			parent.get("availableSources").forEach(source => {
				nxtSources.add(source);
				if (!curSources.has(source)) {
					optionsToAdd.push(source);
				}
			});

			if (optionsToAdd.length) {
				const $optBrewLast = $selSource.find(`option[disabled]`).prev();
				optionsToAdd.forEach(source => {
					const fullSource = BrewUtil2.sourceJsonToSource(source);
					$(`<option/>`, {val: fullSource.json, text: fullSource.full}).insertAfter($optBrewLast);
				});
			}

			const toDelete = CollectionUtil.setDiff(curSources, nxtSources);
			if (toDelete.size) $selSource.find(`option`).filter((i, e) => toDelete.has($(e).val())).remove();
		};
		parent.addHook("availableSources", hkAvailSources);
		hkAvailSources();

		const hkSource = () => $selSource.val(this._state.source);
		this._addHookBase("source", hkSource);
		hkSource();

		$$`<div class="w-100 mb-2 split-v-center"><div class="sidemenu__row__label mr-2">Source</div>${$selSource}</div>`.appendTo($wrpSidebar);

		const $btnSourceEdit = $(`<button class="btn btn-default btn-xs">Edit Selected</button>`)
			.click(() => {
				const curSourceJson = this._state.source;
				if (!curSourceJson) {
					JqueryUtil.doToast({type: "warning", content: "No source selected!"});
					return;
				}

				const curSource = BrewUtil2.sourceJsonToSource(curSourceJson);
				if (!curSource) return;
				rebuildStageSource({mode: "edit", source: MiscUtil.copy(curSource)});
				modalMeta = UiUtil.getShowModal({
					isHeight100: true,
					isUncappedHeight: true,
					cbClose: () => $wrpSourceOverlay.detach(),
				});
				$wrpSourceOverlay.appendTo(modalMeta.$modalInner);
			});

		const $btnSourceAdd = $(`<button class="btn btn-default btn-xs">Add New</button>`).click(() => {
			rebuildStageSource({mode: "add"});
			modalMeta = UiUtil.getShowModal({
				isHeight100: true,
				isUncappedHeight: true,
				cbClose: () => $wrpSourceOverlay.detach(),
			});
			$wrpSourceOverlay.appendTo(modalMeta.$modalInner);
		});
		$$`<div class="w-100 btn-group ve-flex-v-center ve-flex-h-right">${$btnSourceEdit}${$btnSourceAdd}</div>`.appendTo($wrpSidebar);

		ConverterUiUtil.renderSideMenuDivider($wrpSidebar);
	}
	// endregion
}

class CreatureConverter extends BaseConverter {
	constructor (ui) {
		super(
			ui,
			{
				converterId: "Creature",
				canSaveLocal: true,
				modes: ["txt", "md"],
				hasPageNumbers: true,
				titleCaseFields: ["name"],
				hasSource: true,
				prop: "monster",
			},
		);
	}

	_renderSidebar (parent, $wrpSidebar) {
		$wrpSidebar.empty();

		$(`<div class="w-100 split-v-center">
			<small>This parser is <span class="help" title="It is notably poor at handling text split across multiple lines, as Carriage Return is used to separate blocks of text.">very particular</span> about its input. Use at your own risk.</small>
		</div>`).appendTo($wrpSidebar);

		ConverterUiUtil.renderSideMenuDivider($wrpSidebar);
	}

	handleParse (input, cbOutput, cbWarning, isAppend) {
		const opts = {
			cbWarning,
			cbOutput,
			isAppend,
			titleCaseFields: this._titleCaseFields,
			isTitleCase: this._state.isTitleCase,
			source: this._state.source,
			page: this._state.page,
		};

		switch (this._state.mode) {
			case "txt": return CreatureParser.doParseText(input, opts);
			case "md": return CreatureParser.doParseMarkdown(input, opts);
			default: throw new Error(`Unimplemented!`);
		}
	}

	_getSample (format) {
		switch (format) {
			case "txt": return CreatureConverter.SAMPLE_TEXT;
			case "md": return CreatureConverter.SAMPLE_MARKDOWN;
			default: throw new Error(`Unknown format "${format}"`);
		}
	}
}
// region samples
CreatureConverter.SAMPLE_TEXT =
	`Mammon
Huge fiend (devil), lawful evil
Armor Class 20 (natural armor)
Hit Points 378 (28d12 + 196)
Speed 50 ft.
STR DEX CON INT WIS CHA
22 (+6) 13 (+1) 24 (+7) 23 (+6) 21 (+5) 26 (+8)
Saving Throws Dex +9, Int +14, Wis +13, Cha +16
Skills Deception +16, Insight +13, Perception +13, Persuasion +16
Damage Resistances cold
Damage Immunities fire, poison; bludgeoning, piercing, and slashing from weapons that aren't silvered
Condition Immunities charmed, exhaustion, frightened, poisoned
Senses truesight 120 ft., passive Perception 23
Languages all, telepathy 120 ft.
Challenge 25 (75,000 XP)
Innate Spellcasting. Mammon's innate spellcasting ability is Charisma (spell save DC 24, +16 to hit with spell attacks). He can innately cast the following spells, requiring no material components:
At will: charm person, detect magic, dispel magic, fabricate (Mammon can create valuable objects), heat metal, arcanist's magic aura
3/day each: animate objects, counterspell, creation, instant summons, legend lore, teleport
1/day: imprisonment (minimus containment only, inside gems), sunburst
Spellcasting. Mammon is a 6th level spellcaster. His spellcasting ability is Intelligence (spell save DC 13; +5 to hit with spell attacks). He has the following wizard spells prepared:
Cantrips (at will): fire bolt, light, mage hand, prestidigitation
1st level (4 slots): mage armor, magic missile, shield
2nd level (3 slots): misty step, suggestion
3rd level (3 slots): fly, lightning bolt
Legendary Resistance (3/day). If Mammon fails a saving throw, he can choose to succeed instead.
Magic Resistance. Mammon has advantage on saving throws against spells and other magical effects.
Magic Weapons. Mammon's weapon attacks are magical.
ACTIONS
Multiattack. Mammon makes three attacks.
Purse. Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 19 (3d8 + 6) bludgeoning damage plus 18 (4d8) radiant damage.
Molten Coins. Ranged Weapon Attack: +14 to hit, range 40/120 ft., one target. Hit: 16 (3d6 + 6) bludgeoning damage plus 18 (4d8) fire damage.
Your Weight In Gold (Recharge 5\u20136). Mammon can use this ability as a bonus action immediately after hitting a creature with his purse attack. The creature must make a DC 24 Constitution saving throw. If the saving throw fails by 5 or more, the creature is instantly petrified by being turned to solid gold. Otherwise, a creature that fails the saving throw is restrained. A restrained creature repeats the saving throw at the end of its next turn, becoming petrified on a failure or ending the effect on a success. The petrification lasts until the creature receives a greater restoration spell or comparable magic.
LEGENDARY ACTIONS
Mammon can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. Mammon regains spent legendary actions at the start of his turn.
Attack. Mammon makes one purse or molten coins attack.
Make It Rain! Mammon casts gold and jewels into a 5-foot radius within 60 feet. One creature within 60 feet of the treasure that can see it must make a DC 24 Wisdom saving throw. On a failure, the creature must use its reaction to move its speed toward the trinkets, which vanish at the end of the turn.
Deep Pockets (3 actions). Mammon recharges his Your Weight In Gold ability.`;
CreatureConverter.SAMPLE_MARKDOWN =
	`___
>## Lich
>*Medium undead, any evil alignment*
>___
>- **Armor Class** 17
>- **Hit Points** 135 (18d8 + 54)
>- **Speed** 30 ft.
>___
>|STR|DEX|CON|INT|WIS|CHA|
>|:---:|:---:|:---:|:---:|:---:|:---:|
>|11 (+0)|16 (+3)|16 (+3)|20 (+5)|14 (+2)|16 (+3)|
>___
>- **Saving Throws** Con +10, Int +12, Wis +9
>- **Skills** Arcana +19, History +12, Insight +9, Perception +9
>- **Damage Resistances** cold, lightning, necrotic
>- **Damage Immunities** poison; bludgeoning, piercing, and slashing from nonmagical attacks
>- **Condition Immunities** charmed, exhaustion, frightened, paralyzed, poisoned
>- **Senses** truesight 120 ft., passive Perception 19
>- **Languages** Common plus up to five other languages
>- **Challenge** 21 (33000 XP)
>___
>***Legendary Resistance (3/Day).*** If the lich fails a saving throw, it can choose to succeed instead.
>
>***Rejuvenation.*** If it has a phylactery, a destroyed lich gains a new body in 1d10 days, regaining all its hit points and becoming active again. The new body appears within 5 feet of the phylactery.
>
>***Spellcasting.*** The lich is an 18th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 20, +12 to hit with spell attacks). The lich has the following wizard spells prepared:
>
>• Cantrips (at will): mage hand, prestidigitation, ray of frost
>• 1st level (4 slots): detect magic, magic missile, shield, thunderwave
>• 2nd level (3 slots): detect thoughts, invisibility, Melf's acid arrow, mirror image
>• 3rd level (3 slots): animate dead, counterspell, dispel magic, fireball
>• 4th level (3 slots): blight, dimension door
>• 5th level (3 slots): cloudkill, scrying
>• 6th level (1 slot): disintegrate, globe of invulnerability
>• 7th level (1 slot): finger of death, plane shift
>• 8th level (1 slot): dominate monster, power word stun
>• 9th level (1 slot): power word kill
>
>***Turn Resistance.*** The lich has advantage on saving throws against any effect that turns undead.
>
>### Actions
>***Paralyzing Touch.*** Melee Spell Attack: +12 to hit, reach 5 ft., one creature. *Hit*: 10 (3d6) cold damage. The target must succeed on a DC 18 Constitution saving throw or be paralyzed for 1 minute. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.
>
>### Legendary Actions
>The lich can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The lich regains spent legendary actions at the start of its turn.
>
>- **Cantrip.** The lich casts a cantrip.
>- **Paralyzing Touch (Costs 2 Actions).** The lich uses its Paralyzing Touch.
>- **Frightening Gaze (Costs 2 Actions).** The lich fixes its gaze on one creature it can see within 10 feet of it. The target must succeed on a DC 18 Wisdom saving throw against this magic or become frightened for 1 minute. The frightened target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. If a target's saving throw is successful or the effect ends for it, the target is immune to the lich's gaze for the next 24 hours.
>- **Disrupt Life (Costs 3 Actions).** Each non-undead creature within 20 feet of the lich must make a DC 18 Constitution saving throw against this magic, taking 21 (6d6) necrotic damage on a failed save, or half as much damage on a successful one.
>
>`;
// endregion

class SpellConverter extends BaseConverter {
	constructor (ui) {
		super(
			ui,
			{
				converterId: "Spell",
				canSaveLocal: true,
				modes: ["txt"],
				hasPageNumbers: true,
				titleCaseFields: ["name"],
				hasSource: true,
				prop: "spell",
			},
		);
	}

	_renderSidebar (parent, $wrpSidebar) {
		$wrpSidebar.empty();
	}

	handleParse (input, cbOutput, cbWarning, isAppend) {
		const opts = {
			cbWarning,
			cbOutput,
			isAppend,
			titleCaseFields: this._titleCaseFields,
			isTitleCase: this._state.isTitleCase,
			source: this._state.source,
			page: this._state.page,
		};

		switch (this._state.mode) {
			case "txt": return SpellParser.doParseText(input, opts);
			default: throw new Error(`Unimplemented!`);
		}
	}

	_getSample (format) {
		switch (format) {
			case "txt": return SpellConverter.SAMPLE_TEXT;
			default: throw new Error(`Unknown format "${format}"`);
		}
	}
}
// region sample
SpellConverter.SAMPLE_TEXT = `Chromatic Orb
1st-level evocation
Casting Time: 1 action
Range: 90 feet
Components: V, S, M (a diamond worth at least 50 gp)
Duration: Instantaneous
You hurl a 4-inch-diameter sphere of energy at a creature that you can see within range. You choose acid, cold, fire, lightning, poison, or thunder for the type of orb you create, and then make a ranged spell attack against the target. If the attack hits, the creature takes 3d8 damage of the type you chose.
At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d8 for each slot level above 1st.`;
// endregion

class ItemConverter extends BaseConverter {
	constructor (ui) {
		super(
			ui,
			{
				converterId: "Item",
				canSaveLocal: true,
				modes: ["txt"],
				hasPageNumbers: true,
				titleCaseFields: ["name"],
				hasSource: true,
				prop: "item",
			},
		);
	}

	_renderSidebar (parent, $wrpSidebar) {
		$wrpSidebar.empty();
	}

	handleParse (input, cbOutput, cbWarning, isAppend) {
		const opts = {
			cbWarning,
			cbOutput,
			isAppend,
			titleCaseFields: this._titleCaseFields,
			isTitleCase: this._state.isTitleCase,
			source: this._state.source,
			page: this._state.page,
		};

		switch (this._state.mode) {
			case "txt": return ItemParser.doParseText(input, opts);
			default: throw new Error(`Unimplemented!`);
		}
	}

	_getSample (format) {
		switch (format) {
			case "txt": return ItemConverter.SAMPLE_TEXT;
			default: throw new Error(`Unknown format "${format}"`);
		}
	}
}
// region sample
ItemConverter.SAMPLE_TEXT = `Wreath of the Prism
Wondrous Item, legendary (requires attunement)
This loop of golden thorns is inset with dozens of gems representing the five colors of Tiamat.
Dormant
While wearing the wreath in its dormant state, you have darkvision out to a range of 60 feet. If you already have darkvision, wearing the wreath increases the range of your darkvision by 60 feet.
When you hit a beast, dragon, or monstrosity of challenge rating 5 or lower with an attack, or when you grapple it, you can use the wreath to cast dominate monster on the creature (save DC 13). On a successful save, the target is immune to the power of the wreath for 24 hours. On a failure, a shimmering, golden image of the wreath appears as a collar around the target’s neck or as a crown on its head (your choice) until it is no longer charmed by the spell. If you use the wreath to charm a second creature, the first spell immediately ends. When the spell ends, the target knows it was charmed by you.
Awakened
Once the Wreath of the Prism reaches an awakened state, it gains the following benefits:
• You can affect creatures of challenge rating 10 or lower with the wreath.
• The save DC of the wreath’s spell increases to 15.
Exalted
Once the Wreath of the Prism reaches an exalted state, it gains the following benefits:
• You can affect creatures of challenge rating 15 or lower with the wreath.
• The save DC of the wreath’s spell increases to 17.`;
// endregion

class EntryConverter extends BaseConverter {
	constructor (ui) {
		super(
			ui,
			{
				converterId: "Entry",
				canSaveLocal: false,
				modes: ["md"],
				hasPageNumbers: false,
				hasSource: false,
			},
		);
	}

	_renderSidebar (parent, $wrpSidebar) {
		$wrpSidebar.empty();
	}

	handleParse (input, cbOutput) {
		switch (this._state.mode) {
			case "md": return cbOutput(MarkdownConverter.getEntries(input));
			default: throw new Error(`Unimplemented!`);
		}
	}

	_getSample (format) {
		switch (format) {
			case "md": return EntryConverter.SAMPLE_MD;
			default: throw new Error(`Unknown format "${format}"`);
		}
	}
}
// region sample
EntryConverter.SAMPLE_MD = `# Introduction

This book is written for the Dungeon Master. It contains a complete Dungeons & Dragons adventure, as well as descriptions for every creature and magic item that appears in the adventure. It also introduces the world of the Forgotten Realms, one of the game's most enduring settings, and it teaches you how to run a D&D game.

The smaller book that accompanies this one (hereafter called "the rulebook") contains the rules you need to adjudicate situations that arise during the adventure.

#### The Dungeon Master

The Dungeon Master (DM) has a special role in the Dungeons & Dragons game.

The DM is a **referee**. When it's not clear what ought to happen next, the DM decides how to apply the rules and keep the story going.


> ##### Rules to Game By
>
>As the Dungeon Master, you are the final authority when it comes to rules questions or disputes. Here are some guidelines to help you arbitrate issues as they come up.
>
>- **When in doubt, make it up!** It's better to keep the game moving than to get bogged down in the rules.
>- **It's not a competition.** The DM isn't competing against the player characters. You're there to run the monsters, referee the rules, and keep the story moving.
>- **It's a shared story.** It's the group's story, so let the players contribute to the outcome through the actions of their characters. Dungeons & Dragons is about imagination and coming together to tell a story as a group. Let the players participate in the storytelling.
>- **Be consistent.** If you decide that a rule works a certain way in one session, make sure it works that way the next time it comes into play.
>- **Make sure everyone is involved.** Ensure every character has a chance to shine. If some players are reluctant to speak up, remember to ask them what their characters are doing.
>- **Be fair.** Use your powers as Dungeon Master only for good. Treat the rules and the players in a fair and impartial manner.
>- **Pay attention.** Make sure you look around the table occasionally to see if the game is going well. If everyone seems to be having fun, relax and keep going. If the fun is waning, it might be time for a break, or you can try to liven things up.

#### Improvising Ability Checks

The adventure often tells you what ability checks characters might try in a certain situation and the Difficulty Class (DC) of those checks. Sometimes adventurers try things that the adventure can't possibly anticipate. It's up to you to decide whether their attempts are successful. If it seems like anyone should have an easy time doing it, don't ask for an ability check; just tell the player what happens. Likewise, if there's no way anyone could accomplish the task, just tell the player it doesn't work.

Otherwise, answer these three simple questions:

- What kind of ability check?
- How hard is it?
- What's the result?

Use the descriptions of the ability scores and their associated skills in the rulebook to help you decide what kind of ability check to use. Then determine how hard the task is so that you can set the DC for the check. The higher the DC, the more difficult the task. The easiest way to set a DC is to decide whether the task's difficulty is easy, moderate, or hard, and use these three DCs:

- **Easy (DC 10)**. An easy task requires a minimal level of competence or a modicum of luck to accomplish.
- **Moderate (DC 15)**. A moderate task requires a slightly higher level of competence to accomplish. A character with a combination of natural aptitude and specialized training can accomplish a moderate task more often than not.
- **Hard (DC 20)**. Hard tasks include any effort that is beyond the capabilities of most people without aid or exceptional ability.

#### Abbreviations

The following abbreviations are used in this adventure:

| Abbreviation          | Abbreviation           |
|-----------------------|------------------------|
| DC = Difficulty Class | XP = experience points |
| gp = gold piece(s)    | pp = platinum piece(s) |
| sp = silver piece(s)  | ep = electrum piece(s) |
| cp = copper piece(s)  | -                      |

`;
// endregion

class FeatConverter extends BaseConverter {
	constructor (ui) {
		super(
			ui,
			{
				converterId: "Feat",
				canSaveLocal: true,
				modes: ["txt"],
				hasPageNumbers: true,
				titleCaseFields: ["name"],
				hasSource: true,
				prop: "feat",
			},
		);
	}

	_renderSidebar (parent, $wrpSidebar) {
		$wrpSidebar.empty();
	}

	handleParse (input, cbOutput, cbWarning, isAppend) {
		const opts = {
			cbWarning,
			cbOutput,
			isAppend,
			titleCaseFields: this._titleCaseFields,
			isTitleCase: this._state.isTitleCase,
			source: this._state.source,
			page: this._state.page,
		};

		switch (this._state.mode) {
			case "txt": return FeatParser.doParseText(input, opts);
			default: throw new Error(`Unimplemented!`);
		}
	}

	_getSample (format) {
		switch (format) {
			case "txt": return FeatConverter.SAMPLE_TEXT;
			default: throw new Error(`Unknown format "${format}"`);
		}
	}
}
// region sample
FeatConverter.SAMPLE_TEXT = `Metamagic Adept
Prerequisite: Spellcasting or Pact Magic feature
You’ve learned how to exert your will on your spells to alter how they function. You gain the following benefits:
• Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20.
• You learn two Metamagic options of your choice from the sorcerer class. You can use only one Metamagic option on a spell when you cast it, unless the option says otherwise. Whenever you gain a level, you can replace one of your Metamagic options with another one from the sorcerer class.
• You gain 2 sorcery points to spend on Metamagic (these points are added to any sorcery points you have from another source but can be used only on Metamagic). You regain all spent sorcery points when you finish a long rest.
`;
// endregion

class RaceConverter extends BaseConverter {
	constructor (ui) {
		super(
			ui,
			{
				converterId: "Race",
				canSaveLocal: true,
				modes: ["txt", "md"],
				hasPageNumbers: true,
				titleCaseFields: ["name"],
				hasSource: true,
				prop: "race",
			},
		);
	}

	_renderSidebar (parent, $wrpSidebar) {
		$wrpSidebar.empty();
	}

	handleParse (input, cbOutput, cbWarning, isAppend) {
		const opts = {
			cbWarning,
			cbOutput,
			isAppend,
			titleCaseFields: this._titleCaseFields,
			isTitleCase: this._state.isTitleCase,
			source: this._state.source,
			page: this._state.page,
		};

		switch (this._state.mode) {
			case "txt": return RaceParser.doParseText(input, opts);
			case "md": return RaceParser.doParseMarkdown(input, opts);
			default: throw new Error(`Unimplemented!`);
		}
	}

	_getSample (format) {
		switch (format) {
			case "txt": return RaceConverter.SAMPLE_TEXT;
			case "md": return RaceConverter.SAMPLE_MD;
			default: throw new Error(`Unknown format "${format}"`);
		}
	}
}
// region sample
RaceConverter.SAMPLE_TEXT = `Aasimar

Creature Type. You are a humanoid.

Size. You are Medium or Small. You choose the size when you select this race.

Speed. Your walking speed is 30 feet.

Celestial Resistance. You have resistance to necrotic damage and radiant damage.

Darkvision. You can see in dim light within 60 feet of you as if it were bright light and in darkness as if it were dim light. You discern colors in that darkness only as shades of gray.

Healing Hands. As an action, you can touch a creature and roll a number of d4s equal to your proficiency bonus. The creature regains a number of hit points equal to the total rolled. Once you use this trait, you can’t use it again until you finish a long rest.

Light Bearer. You know the light cantrip. Charisma is your spellcasting ability for it.

Celestial Revelation. When you reach 3rd level, choose one of the revelation options below. Thereafter, you can use a bonus action to unleash the celestial energy within yourself, gaining the benefits of that revelation. Your transformation lasts for 1 minute or until you end it as a bonus action. While you’re transformed, Once you transform using your revelation below, you can’t use it again until you finish a long rest.

• Necrotic Shroud. Your eyes briefly become pools of darkness, and ghostly, flightless wings sprout from your back temporarily. Creatures other than your allies within 10 feet of you that can see you must succeed on a Charisma saving throw (DC 8 + your proficiency bonus + your Charisma modifier) or become frightened of you until the end of your next turn. Until the transformation ends, once on each of your turns, you can deal extra necrotic damage to one target when you deal damage to it with an attack or a spell. The extra damage equals your proficiency bonus.
• Radiant Consumption. Searing light temporarily radiates from your eyes and mouth. For the duration, you shed bright light in a 10-foot radius and dim light for an additional 10 feet, and at the end of each of your turns, each creature within 10 feet of you takes radiant damage equal to your proficiency bonus. Until the transformation ends, once on each of your turns, you can deal extra radiant damage to one target when you deal damage to it with an attack or a spell. The extra damage equals your proficiency bonus.
• Radiant Soul. Two luminous, spectral wings sprout from your back temporarily. Until the transformation ends, you have a flying speed equal to your walking speed, and once on each of your turns, you can deal extra radiant damage to one target when you deal damage to it with an attack or a spell. The extra damage equals your proficiency bonus.`;
RaceConverter.SAMPLE_MD = `Aasimar

**Creature Type.** You are a humanoid.

**Size**. You are Medium or Small. You choose the size when you select this race.

**Speed**. Your walking speed is 30 feet.

**Celestial Resistance.** You have resistance to necrotic damage and radiant damage.

**Darkvision**. You can see in dim light within 60 feet of you as if it were bright light and in darkness as if it were dim light. You discern colors in that darkness only as shades of gray.

**Healing Hands**. As an action, you can touch a creature and roll a number of d4s equal to your proficiency bonus. The creature regains a number of hit points equal to the total rolled. Once you use this trait, you can’t use it again until you finish a long rest.

**Light Bearer**. You know the light cantrip. Charisma is your spellcasting ability for it.

**Celestial Revelation. **When you reach 3rd level, choose one of the revelation options below. Thereafter, you can use a bonus action to unleash the celestial energy within yourself, gaining the benefits of that revelation. Your transformation lasts for 1 minute or until you end it as a bonus action. While you’re transformed, Once you transform using your revelation below, you can’t use it again until you finish a long rest.

* **Necrotic Shroud**. Your eyes briefly become pools of darkness, and ghostly, flightless wings sprout from your back temporarily. Creatures other than your allies within 10 feet of you that can see you must succeed on a Charisma saving throw (DC 8 + your proficiency bonus + your Charisma modifier) or become frightened of you until the end of your next turn. Until the transformation ends, once on each of your turns, you can deal extra necrotic damage to one target when you deal damage to it with an attack or a spell. The extra damage equals your proficiency bonus.
* **Radiant Consumption**. Searing light temporarily radiates from your eyes and mouth. For the duration, you shed bright light in a 10-foot radius and dim light for an additional 10 feet, and at the end of each of your turns, each creature within 10 feet of you takes radiant damage equal to your proficiency bonus. Until the transformation ends, once on each of your turns, you can deal extra radiant damage to one target when you deal damage to it with an attack or a spell. The extra damage equals your proficiency bonus.
* **Radiant Soul**. Two luminous, spectral wings sprout from your back temporarily. Until the transformation ends, you have a flying speed equal to your walking speed, and once on each of your turns, you can deal extra radiant damage to one target when you deal damage to it with an attack or a spell. The extra damage equals your proficiency bonus.`;
// endregion

class BackgroundConverter extends BaseConverter {
	constructor (ui) {
		super(
			ui,
			{
				converterId: "Background",
				canSaveLocal: true,
				modes: ["txt"],
				hasPageNumbers: true,
				titleCaseFields: ["name"],
				hasSource: true,
				prop: "background",
			},
		);
	}

	_renderSidebar (parent, $wrpSidebar) {
		$wrpSidebar.empty();
	}

	handleParse (input, cbOutput, cbWarning, isAppend) {
		const opts = {
			cbWarning,
			cbOutput,
			isAppend,
			titleCaseFields: this._titleCaseFields,
			isTitleCase: this._state.isTitleCase,
			source: this._state.source,
			page: this._state.page,
		};

		switch (this._state.mode) {
			case "txt": return BackgroundParser.doParseText(input, opts);
			default: throw new Error(`Unimplemented!`);
		}
	}

	_getSample (format) {
		switch (format) {
			case "txt": return BackgroundConverter.SAMPLE_TEXT;
			default: throw new Error(`Unknown format "${format}"`);
		}
	}
}
// region sample
BackgroundConverter.SAMPLE_TEXT = `Giant Foundling 
Skill Proficiencies: Intimidation, Survival
Languages: Giant and one other language of your choice
Equipment: A backpack, a set of traveler’s clothes, a small stone or sprig that reminds you of home, and a pouch containing 10 gp

Origin Stories
How you came to live among colossal creatures is up to you to determine, but the Foundling Origin table suggests a variety of possibilities.

Foundling Origin
d6 Origin
1 You were found as a baby by a family of nomadic giants who raised you as one of their own.
2 A family of stone giants rescued you when you fell into a mountain chasm, and you have lived with them underground ever since.
3 You were lost or abandoned as a child in a jungle that teemed with ravenous dinosaurs. There, you found an equally lost frost giant; together, you survived.
4 Your farm was crushed and your family killed in a battle between warring groups of giants. Racked with guilt over the destruction, a sympathetic giant soldier promised to care for you.
5 After you had a series of strange dreams as a child, your superstitious parents sent you to study with a powerful but aloof storm giant oracle.
6 While playing hide-and-seek with your friends, you stumbled into the castle of a cloud giant, who immediately adopted you.

Building a Giant Foundling Character
Your life among giants has given you a unique perspective. Though you are unusually large for your kind, you’re no larger than a giant child, so you might be very mindful of your size.

Feature: Strike of the Giants
You gain the Strike of the Giants feat.

Suggested Characteristics
The Giant Foundling Personality Traits table suggests a variety of traits you might adopt for your character.

d6 Personality Trait
1 What I lack in stature compared to giants, I make up for with sheer spite.
2 I insist on being taken seriously as a full-grown adult. Nobody talks down to me!
3 Crowded spaces make me uncomfortable. I’d much rather be in an open field than a bustling tavern.
4 I embrace my shorter stature. It helps me stay unnoticed—and underestimated.
5 Every avalanche begins as a single pebble.
6 The world always feels too big, and I’m afraid I’ll never find my place in it.`;
// endregion

class TableConverter extends BaseConverter {
	constructor (ui) {
		super(
			ui,
			{
				converterId: "Table",
				modes: ["html", "md"],
				prop: "table",
			},
		);
	}

	_renderSidebar (parent, $wrpSidebar) {
		$wrpSidebar.empty();
	}

	handleParse (input, cbOutput, cbWarning, isAppend) {
		const opts = {
			cbWarning,
			cbOutput,
			isAppend,
			titleCaseFields: this._titleCaseFields,
			isTitleCase: this._state.isTitleCase,
			source: this._state.source,
			page: this._state.page,
		};

		switch (this._state.mode) {
			case "html": return TableParser.doParseHtml(input, opts);
			case "md": return TableParser.doParseMarkdown(input, opts);
			default: throw new Error(`Unimplemented!`);
		}
	}

	_getSample (format) {
		switch (format) {
			case "html": return TableConverter.SAMPLE_HTML;
			case "md": return TableConverter.SAMPLE_MARKDOWN;
			default: throw new Error(`Unknown format "${format}"`);
		}
	}
}
// region samples
TableConverter.SAMPLE_HTML =
	`<table>
  <thead>
    <tr>
      <td><p><strong>Character Level</strong></p></td>
      <td><p><strong>Low Magic Campaign</strong></p></td>
      <td><p><strong>Standard Campaign</strong></p></td>
      <td><p><strong>High Magic Campaign</strong></p></td>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><p>1st–4th</p></td>
      <td><p>Normal starting equipment</p></td>
      <td><p>Normal starting equipment</p></td>
      <td><p>Normal starting equipment</p></td>
    </tr>
    <tr>
      <td><p>5th–10th</p></td>
      <td><p>500 gp plus 1d10 × 25 gp, normal starting equipment</p></td>
      <td><p>500 gp plus 1d10 × 25 gp, normal starting equipment</p></td>
      <td><p>500 gp plus 1d10 × 25 gp, one uncommon magic item, normal starting equipment</p></td>
    </tr>
    <tr>
      <td><p>11th–16th</p></td>
      <td><p>5,000 gp plus 1d10 × 250 gp, one uncommon magic item, normal starting equipment</p></td>
      <td><p>5,000 gp plus 1d10 × 250 gp, two uncommon magic items, normal starting equipment</p></td>
      <td><p>5,000 gp plus 1d10 × 250 gp, three uncommon magic items, one rare item, normal starting equipment</p></td>
    </tr>
    <tr>
      <td><p>17th–20th</p></td>
      <td><p>20,000 gp plus 1d10 × 250 gp, two uncommon magic items, normal starting equipment</p></td>
      <td><p>20,000 gp plus 1d10 × 250 gp, two uncommon magic items, one rare item, normal starting equipment</p></td>
      <td><p>20,000 gp plus 1d10 × 250 gp, three uncommon magic items, two rare items, one very rare item, normal starting equipment</p></td>
    </tr>
  </tbody>
</table>`;
TableConverter.SAMPLE_MARKDOWN =
	`| Character Level | Low Magic Campaign                                                                | Standard Campaign                                                                                | High Magic Campaign                                                                                                     |
|-----------------|-----------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| 1st–4th         | Normal starting equipment                                                         | Normal starting equipment                                                                        | Normal starting equipment                                                                                               |
| 5th–10th        | 500 gp plus 1d10 × 25 gp, normal starting equipment                               | 500 gp plus 1d10 × 25 gp, normal starting equipment                                              | 500 gp plus 1d10 × 25 gp, one uncommon magic item, normal starting equipment                                            |
| 11th–16th       | 5,000 gp plus 1d10 × 250 gp, one uncommon magic item, normal starting equipment   | 5,000 gp plus 1d10 × 250 gp, two uncommon magic items, normal starting equipment                 | 5,000 gp plus 1d10 × 250 gp, three uncommon magic items, one rare item, normal starting equipment                       |
| 17th–20th       | 20,000 gp plus 1d10 × 250 gp, two uncommon magic items, normal starting equipment | 20,000 gp plus 1d10 × 250 gp, two uncommon magic items, one rare item, normal starting equipment | 20,000 gp plus 1d10 × 250 gp, three uncommon magic items, two rare items, one very rare item, normal starting equipment |`;
// endregion

class ConverterUi extends BaseComponent {
	constructor () {
		super();

		this._editorIn = null;
		this._editorOut = null;

		this._converters = {};

		this._saveInputDebounced = MiscUtil.debounce(() => StorageUtil.pSetForPage(ConverterUi.STORAGE_INPUT, this._editorIn.getValue()), 50);
		this.saveSettingsDebounced = MiscUtil.debounce(() => StorageUtil.pSetForPage(ConverterUi.STORAGE_STATE, this.getBaseSaveableState()), 50);

		this._addHookAll("state", () => this.saveSettingsDebounced());
	}

	set converters (converters) { this._converters = converters; }
	get activeConverter () { return this._converters[this._state.converter]; }

	getBaseSaveableState () {
		return {
			...super.getBaseSaveableState(),
			...Object.values(this._converters).mergeMap(it => ({[it.converterId]: it.getBaseSaveableState()})),
		};
	}

	getPod () {
		return {
			...super.getPod(),
			doRefreshAvailableSources: this._doRefreshAvailableSources.bind(this),
		};
	}

	_doRefreshAvailableSources () {
		this._state.availableSources = BrewUtil2.getSources().sort((a, b) => SortUtil.ascSortLower(a.full, b.full))
			.map(it => it.json);
	}

	async pInit () {
		// region load state
		const savedState = await StorageUtil.pGetForPage(ConverterUi.STORAGE_STATE);
		if (savedState) {
			this.setBaseSaveableStateFrom(savedState);
			Object.values(this._converters)
				.filter(it => savedState[it.converterId])
				.forEach(it => it.setBaseSaveableStateFrom(savedState[it.converterId]));
		}

		// forcibly overwrite available sources with fresh data
		this._doRefreshAvailableSources();
		Object.values(this._converters)
			.filter(it => it.source && !this._state.availableSources.includes(it.source))
			.forEach(it => it.source = "");

		// reset this temp flag
		this._state.hasAppended = false;
		// endregion

		this._editorIn = EditorUtil.initEditor("converter_input");
		try {
			const prevInput = await StorageUtil.pGetForPage(ConverterUi.STORAGE_INPUT);
			if (prevInput) this._editorIn.setValue(prevInput, -1);
		} catch (ignored) { setTimeout(() => { throw ignored; }); }
		this._editorIn.on("change", () => this._saveInputDebounced());

		this._editorOut = EditorUtil.initEditor("converter_output", {readOnly: true, mode: "ace/mode/json"});

		$(`#editable`).click(() => {
			this._outReadOnly = false;
			JqueryUtil.doToast({type: "warning", content: "Enabled editing. Note that edits will be overwritten as you parse new stat blocks."});
		});

		const $btnSaveLocal = $(`#save_local`).click(async () => {
			const output = this._outText;

			if (!(output || "").trim()) {
				return JqueryUtil.doToast({
					content: "Nothing to save!",
					type: "warning",
				});
			}

			try {
				const prop = this.activeConverter.prop;
				const entries = JSON.parse(`[${output}]`);

				const invalidSources = entries.map(it => !it.source || !BrewUtil2.hasSourceJson(it.source) ? (it.name || it.caption || "(Unnamed)").trim() : false).filter(Boolean);
				if (invalidSources.length) {
					JqueryUtil.doToast({
						content: `One or more entries have missing or unknown sources: ${invalidSources.join(", ")}`,
						type: "danger",
					});
					return;
				}

				const brewDocEditable = await BrewUtil2.pGetEditableBrewDoc();
				const uneditableSources = entries
					.filter(ent => !(brewDocEditable?.body?._meta?.sources || []).some(src => src.json === ent.source))
					.map(ent => ent.source);
				if (uneditableSources.length) {
					JqueryUtil.doToast({
						content: `One or more entries have sources which belong to non-editable homebrew: ${uneditableSources.join(", ")}`,
						type: "danger",
					});
					return;
				}

				// ignore duplicates
				const _dupes = {};
				const dupes = [];
				const dedupedEntries = entries
					.map(it => {
						const lSource = it.source.toLowerCase();
						const lName = it.name.toLowerCase();
						_dupes[lSource] = _dupes[lSource] || {};
						if (_dupes[lSource][lName]) {
							dupes.push(it.name);
							return null;
						} else {
							_dupes[lSource][lName] = true;
							return it;
						}
					})
					.filter(Boolean);

				if (dupes.length) {
					JqueryUtil.doToast({
						type: "warning",
						content: `Ignored ${dupes.length} duplicate entr${dupes.length === 1 ? "y" : "ies"}`,
					});
				}

				if (!dedupedEntries.length) {
					return JqueryUtil.doToast({
						content: "Nothing to save!",
						type: "warning",
					});
				}

				// handle overwrites
				const brewDoc = await BrewUtil2.pGetOrCreateEditableBrewDoc();
				const overwriteMeta = dedupedEntries
					.map(it => {
						if (!brewDoc?.body?.[prop]) return {entry: it, isOverwrite: false};

						const ix = brewDoc.body[prop].findIndex(bru => bru.name.toLowerCase() === it.name.toLowerCase() && bru.source.toLowerCase() === it.source.toLowerCase());
						if (!~ix) return {entry: it, isOverwrite: false};

						return {
							isOverwrite: true,
							ix,
							entry: it,
						};
					})
					.filter(Boolean);

				const willOverwrite = overwriteMeta.map(it => it.isOverwrite).filter(Boolean);
				if (
					willOverwrite.length
					&& !await InputUiUtil.pGetUserBoolean({title: "Overwrite Entries", htmlDescription: `This will overwrite ${willOverwrite.length} entr${willOverwrite.length === 1 ? "y" : "ies"}. Are you sure?`, textYes: "Yes", textNo: "Cancel"})
				) {
					return;
				}

				const cpyBrewDoc = MiscUtil.copy(brewDoc);
				overwriteMeta.forEach(meta => {
					if (meta.isOverwrite) return cpyBrewDoc.body[prop][meta.ix] = MiscUtil.copy(meta.entry);
					(cpyBrewDoc.body[prop] = cpyBrewDoc.body[prop] || []).push(MiscUtil.copy(meta.entry));
				});

				await BrewUtil2.pSetEditableBrewDoc(cpyBrewDoc);

				JqueryUtil.doToast({
					type: "success",
					content: `Saved!`,
				});
			} catch (e) {
				JqueryUtil.doToast({
					content: `Current output was not valid JSON!`,
					type: "danger",
				});
				setTimeout(() => { throw e; });
			}
		});
		const hkConverter = () => {
			$btnSaveLocal.toggleClass("hidden", !this.activeConverter.canSaveLocal);
		};
		this._addHookBase("converter", hkConverter);
		hkConverter();

		$(`#btn-output-download`).click(() => {
			const output = this._outText;
			if (!output || !output.trim()) {
				return JqueryUtil.doToast({
					content: "Nothing to download!",
					type: "danger",
				});
			}

			try {
				const prop = this.activeConverter.prop;
				const out = {[prop]: JSON.parse(`[${output}]`)};
				DataUtil.userDownload(`converter-output`, out);
			} catch (e) {
				JqueryUtil.doToast({
					content: `Current output was not valid JSON. Downloading as <span class="code">.txt</span> instead.`,
					type: "warning",
				});
				DataUtil.userDownloadText(`converter-output.txt`, output);
				setTimeout(() => { throw e; });
			}
		});

		$(`#btn-output-copy`).click(async evt => {
			const output = this._outText;
			if (!output || !output.trim()) {
				return JqueryUtil.doToast({
					content: "Nothing to copy!",
					type: "danger",
				});
			}

			await MiscUtil.pCopyTextToClipboard(output);
			JqueryUtil.showCopiedEffect(evt.currentTarget, "Copied!");
		});

		/**
		 * Wrap a function in an error handler which will wipe the error output, and append future errors to it.
		 * @param pToRun
		 */
		const catchErrors = async (pToRun) => {
			try {
				$(`#lastWarnings`).hide().html("");
				$(`#lastError`).hide().html("");
				this._editorOut.resize();
				await pToRun();
			} catch (x) {
				const splitStack = x.stack.split("\n");
				const atPos = splitStack.length > 1 ? splitStack[1].trim() : "(Unknown location)";
				const message = `[Error] ${x.message} ${atPos}`;
				$(`#lastError`).show().html(message);
				this._editorOut.resize();
				setTimeout(() => { throw x; });
			}
		};

		const doConversion = (isAppend) => {
			catchErrors(async () => {
				if (
					isAppend
					&& !this._state.hasAppended
					&& !await InputUiUtil.pGetUserBoolean({title: "Are you Sure?", htmlDescription: "You're about to overwrite multiple entries. Are you sure?", textYes: "Yes", textNo: "Cancel"})
				) return;

				const chunks = (this._state.inputSeparator
					? this.inText.split(this._state.inputSeparator)
					: [this.inText]).map(it => it.trim()).filter(Boolean);
				if (!chunks.length) return this.showWarning("No input!");

				chunks
					.reverse() // reverse as the append is actually a prepend
					.forEach((chunk, i) => {
						this.activeConverter.handleParse(
							chunk,
							this.doCleanAndOutput.bind(this),
							this.showWarning.bind(this),
							isAppend || i !== 0, // always clear the output for the first non-append chunk, then append
						);
					});
			});
		};

		$("#parsestatblock").on("click", () => doConversion(false));
		$(`#parsestatblockadd`).on("click", () => doConversion(true));

		this.initSideMenu();

		window.dispatchEvent(new Event("toolsLoaded"));
	}

	initSideMenu () {
		const $mnu = $(`.sidemenu`);

		const $selConverter = ComponentUiUtil.$getSelEnum(
			this,
			"converter",
			{
				values: Object.keys(this._converters),
			},
		);

		$$`<div class="w-100 split-v-center"><div class="sidemenu__row__label">Mode</div>${$selConverter}</div>`
			.appendTo($mnu);

		ConverterUiUtil.renderSideMenuDivider($mnu);

		// region mult-part parsing options
		const $iptInputSeparator = ComponentUiUtil.$getIptStr(this, "inputSeparator").addClass("code");
		$$`<div class="w-100 split-v-center mb-2"><div class="sidemenu__row__label help mr-2" title="A separator used to mark the end of one to-be-converted entity (creature, spell, etc.) so that multiple entities can be converted in one run. If left blank, the entire input text will be parsed as one entity.">Separator</div>${$iptInputSeparator}</div>`
			.appendTo($mnu);

		const $selAppendPrependMode = ComponentUiUtil.$getSelEnum(
			this,
			"appendPrependMode",
			{
				values: [
					ConverterUi._APPEND_PREPEND_MODE__APPEND,
					ConverterUi._APPEND_PREPEND_MODE__PREPEND,
				],
				fnDisplay: val => val.toTitleCase(),
			},
		);
		$$`<div class="w-100 split-v-center"><div class="sidemenu__row__label mr-2" title="Sets output order when using the &quot;Parse and Add&quot; button, or parsing multiple blocks of text using a separator.">On Add</div>${$selAppendPrependMode}</div>`
			.appendTo($mnu);

		ConverterUiUtil.renderSideMenuDivider($mnu);
		// endregion

		const $wrpConverters = $(`<div class="w-100 ve-flex-col"/>`).appendTo($mnu);
		Object
			.keys(this._converters)
			.sort(SortUtil.ascSortLower)
			.forEach(k => this._converters[k].renderSidebar(this.getPod(), $wrpConverters));

		const hkMode = () => {
			this._editorIn.setOptions({
				mode: ConverterUiUtil.getAceMode(this.activeConverter?.mode),
			});
		};
		this._addHookBase("converter", hkMode);
		hkMode();
	}

	showWarning (text) {
		$(`#lastWarnings`).show().append(`<div>[Warning] ${text}</div>`);
		this._editorOut.resize();
	}

	doCleanAndOutput (obj, append) {
		const asCleanString = CleanUtil.getCleanJson(obj, {isFast: false});
		if (append) {
			const strs = [asCleanString, this._outText];
			if (this._state.appendPrependMode === "prepend") strs.reverse();
			this._outText = strs.join(",\n");
			this._state.hasAppended = true;
		} else {
			this._outText = asCleanString;
			this._state.hasAppended = false;
		}
	}

	set _outReadOnly (val) { this._editorOut.setOptions({readOnly: val}); }

	get _outText () { return this._editorOut.getValue(); }
	set _outText (text) { this._editorOut.setValue(text, -1); }

	get inText () { return CleanUtil.getCleanString((this._editorIn.getValue() || "").trim(), {isFast: false}); }
	set inText (text) { this._editorIn.setValue(text, -1); }

	_getDefaultState () { return MiscUtil.copy(ConverterUi._DEFAULT_STATE); }
}
ConverterUi.STORAGE_INPUT = "converterInput";
ConverterUi.STORAGE_STATE = "converterState";
ConverterUi._APPEND_PREPEND_MODE__APPEND = "append";
ConverterUi._APPEND_PREPEND_MODE__PREPEND = "prepend";
ConverterUi._DEFAULT_STATE = {
	hasAppended: false,
	appendPrependMode: ConverterUi._APPEND_PREPEND_MODE__APPEND,
	converter: "Creature",
	sourceJson: "",
	inputSeparator: "===",
};

async function doPageInit () {
	await Promise.all([
		PrereleaseUtil.pInit(),
		BrewUtil2.pInit(),
	]);
	ExcludeUtil.pInitialise().then(null); // don't await, as this is only used for search
	const [spells, items, itemsRaw, legendaryGroups, classes, brew] = await Promise.all([
		DataUtil.spell.pLoadAll(),
		Renderer.item.pBuildList(),
		DataUtil.item.loadRawJSON(),
		DataUtil.legendaryGroup.pLoadAll(),
		DataUtil.class.loadJSON(),
		BrewUtil2.pGetBrewProcessed(), // init homebrew
	]);
	const itemsNoGroups = items.filter(it => !it._isItemGroup);
	SpellcastingTraitConvert.init(spells);
	ItemParser.init(itemsNoGroups, classes);
	AcConvert.init(itemsNoGroups);
	TaggerUtils.init({legendaryGroups, spells});
	await TagJsons.pInit({spells});
	RaceTraitTag.init({itemsRaw});
	MiscTag.init({items});
	AttachedItemTag.init({items});
	TagCondition.init({conditionsBrew: brew.condition});

	const ui = new ConverterUi();

	const creatureConverter = new CreatureConverter(ui);
	const itemConverter = new ItemConverter(ui);
	const featConverter = new FeatConverter(ui);
	const raceConverter = new RaceConverter(ui);
	const backgroundConverter = new BackgroundConverter(ui);
	const spellConverter = new SpellConverter(ui);
	const tableConverter = new TableConverter(ui);
	const entryConverter = new EntryConverter(ui);

	ui.converters = {
		[creatureConverter.converterId]: creatureConverter,
		[spellConverter.converterId]: spellConverter,
		[itemConverter.converterId]: itemConverter,
		[raceConverter.converterId]: raceConverter,
		[backgroundConverter.converterId]: backgroundConverter,
		[featConverter.converterId]: featConverter,
		[tableConverter.converterId]: tableConverter,
		[entryConverter.converterId]: entryConverter,
	};

	return ui.pInit();
}
