export class InitiativeTrackerRoller {
	static _getRollName (name) {
		return `Initiative Tracker${name ? ` \u2014 ${name}` : ""}`;
	}

	async pGetRollInitiative ({mon, name, initiativeModifier}) {
		name ??= mon?.name;
		initiativeModifier ??= mon ? Parser.getAbilityModifier(mon.dex) : 0;

		return Renderer.dice.pRoll2(`1d20${UiUtil.intToBonus(initiativeModifier)}`, {
			isUser: false,
			name: this.constructor._getRollName(name ?? mon?.name),
			label: "Initiative",
		}, {isResultUsed: true});
	}

	async pGetOrRollHp (mon, {isRollHp}) {
		if (!isRollHp && mon.hp.average && !isNaN(mon.hp.average)) return Number(mon.hp.average);

		if (isRollHp && mon.hp.formula) {
			return Renderer.dice.pRoll2(mon.hp.formula, {
				isUser: false,
				name: this.constructor._getRollName(mon?.name),
				label: "HP",
			}, {isResultUsed: true});
		}

		return null;
	}
}
