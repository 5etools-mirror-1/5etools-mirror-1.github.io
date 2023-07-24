export class InitiativeTrackerConditionUtil {
	static getNewRowState ({name, color, turns}) {
		return {
			id: CryptUtil.uid(),
			entity: {
				name: name ?? "",
				color: color ?? MiscUtil.randomColor(),
				turns: turns ?? null,
			},
		};
	}
}
