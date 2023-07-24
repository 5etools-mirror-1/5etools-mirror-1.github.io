import {InitiativeTrackerDataSerializerBase} from "./dmscreen-initiativetracker-util.js";

export class InitiativeTrackerStatColumnDataSerializer extends InitiativeTrackerDataSerializerBase {
	static _FIELD_MAPPINGS = {
		"id": "id",
		"isEditable": "e",
		"isPlayerVisible": "v",
		"populateWith": "p",
		"abbreviation": "a",
	};
}

export class InitiativeTrackerConditionCustomSerializer extends InitiativeTrackerDataSerializerBase {
	static _FIELD_MAPPINGS = {
		"id": "id",
		"entity.name": "n",
		"entity.color": "c",
		"entity.turns": "t",
	};
}

export class InitiativeTrackerRowStatsColDataSerializer extends InitiativeTrackerDataSerializerBase {
	static _FIELD_MAPPINGS = {
		"id": "id",
		"entity.value": "v",
		"entity.current": "cur",
		"entity.max": "max",
	};
}

export class InitiativeTrackerRowDataSerializer extends InitiativeTrackerDataSerializerBase {
	static _FIELD_MAPPINGS = {
		"id": "id",

		// region Flattened `"nameMeta"`
		"entity.name": "n",

		"entity.displayName": "n_d",
		"entity.scaledCr": "n_scr",
		"entity.scaledSummonSpellLevel": "n_ssp",
		"entity.scaledSummonClassLevel": "n_scl",

		// region Used by player tracker
		"entity.customName": "n_m",
		// endregion
		// endregion

		"entity.hpCurrent": "h",
		"entity.hpMax": "g",
		"entity.initiative": "i",
		"entity.isActive": "a",
		"entity.source": "s",
		"entity.conditions": "c",
		"entity.isPlayerVisible": "v",

		// region Used by player tracker
		"entity.hpWoundLevel": "hh",
		"entity.ordinal": "o",
		// endregion

		// region Specific handling
		// "entity.rowStatColData": "k",
		// endregion
	};

	static fromSerial (dataSerial) {
		// Handle legacy data format
		if (dataSerial.n instanceof Object) {
			dataSerial.n_d = dataSerial.n.d || null;
			dataSerial.n_scr = dataSerial.n.scr || null;
			dataSerial.n_ssp = dataSerial.n.ssp || null;
			dataSerial.n_scl = dataSerial.n.scl || null;
			dataSerial.n_m = dataSerial.n.m || null;

			dataSerial.n = dataSerial.n.n;
		}

		const out = super.fromSerial(dataSerial);

		// Convert legacy data
		out.id = out.id || CryptUtil.uid();

		out.entity.rowStatColData = (dataSerial.k || [])
			.map(rowStatColData => {
				const out = InitiativeTrackerRowStatsColDataSerializer.fromSerial(rowStatColData);
				// If the cell had no data, the `entity` prop may have been serialized away. Ensure it exists.
				if (!out.entity) out.entity = {};
				return out;
			});

		// Convert legacy data
		if (out.entity.conditions?.length) {
			out.entity.conditions = out.entity.conditions
				.map(cond => {
					if (cond.id) return cond;
					return {
						id: CryptUtil.uid(),
						entity: {
							...cond,
						},
					};
				});
		}

		// Convert legacy data
		if (out.entity.ordinal == null) out.entity.ordinal = 1;

		// Convert legacy numbers
		[
			"scaledCr",
			"scaledSummonSpellLevel",
			"scaledSummonClassLevel",
			"hpCurrent",
			"hpMax",
			"initiative",
			"ordinal",
		]
			.forEach(prop => {
				if (out.entity?.[prop] == null) return;
				if (isNaN(out.entity?.[prop])) return delete out.entity[prop];
				out.entity[prop] = Number(out.entity[prop]);
			});

		// Convert legacy booleans
		[
			"isActive",
		]
			.forEach(prop => {
				if (out.entity?.[prop] == null) return;
				out.entity[prop] = !!out.entity[prop];
			});

		return out;
	}

	static toSerial (data) {
		const out = super.toSerial(data);

		out.k = (data.entity.rowStatColData || [])
			.map(rowStatColData => InitiativeTrackerRowStatsColDataSerializer.toSerial(rowStatColData));

		return out;
	}
}
