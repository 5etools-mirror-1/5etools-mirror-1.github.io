export class InitiativeTrackerDataSerializerBase {
	static _FIELD_MAPPINGS = {};

	static _getFieldMappings () {
		return Object.entries(this._FIELD_MAPPINGS)
			.map(([kFull, kSerial]) => {
				const kFullParts = kFull.split(".");
				return {
					kFullParts,
					kSerial,
				};
			});
	}

	static registerMapping ({kFull, kSerial, isAllowDuplicates = false}) {
		if (!isAllowDuplicates) {
			if (this._FIELD_MAPPINGS[kFull]) throw new Error(`Serializer key "${kFull}" was already registered!`);
		}

		if (!isAllowDuplicates || this._FIELD_MAPPINGS[kFull] == null) {
			if (Object.values(this._FIELD_MAPPINGS).some(k => k === kSerial)) throw new Error(`Serializer value "${kFull}" was already registered!`);
		}

		this._FIELD_MAPPINGS[kFull] = kSerial;
	}

	/* -------------------------------------------- */

	static fromSerial (dataSerial) {
		const out = {};

		this._getFieldMappings()
			.filter(({kSerial}) => dataSerial[kSerial] != null)
			.forEach(({kFullParts, kSerial}) => MiscUtil.set(out, ...kFullParts, dataSerial[kSerial]));

		return out;
	}

	static toSerial (data) {
		return this._getFieldMappings()
			.filter(({kFullParts}) => MiscUtil.get(data, ...kFullParts) != null)
			.mergeMap(({kFullParts, kSerial}) => ({[kSerial]: MiscUtil.get(data, ...kFullParts)}));
	}
}
