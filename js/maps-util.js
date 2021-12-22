class MapsUtil {
	static _IMAGE_TYPES = new Set(["map", "mapPlayer"]);

	static getImageData ({prop, head, body}) {
		if (!head || !body) throw new Error(`Both a "head" and a "body" must be specified!`);

		const walker = MiscUtil.getWalker({keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST, isNoModification: true});

		const out = [];

		const len = Math.min(head.contents.length, body.length);
		for (let i = 0; i < len; ++i) {
			const contentsItem = head.contents[i];
			const chapter = body[i];

			const outChapter = {
				name: `${Parser.bookOrdinalToAbv(contentsItem.ordinal)}${contentsItem.name}`,
				images: [],
			};

			walker.walk(
				chapter,
				{
					object: (obj) => {
						// if (obj.type === "image" && head.id === "LMoP") debugger
						if (
							obj.type !== "image"
							|| !this._IMAGE_TYPES.has(obj.imageType)
						) return obj;

						outChapter.images.push(obj);
					},
				},
			);

			if (outChapter.images.length) out.push(outChapter);
		}

		return out.length
			? {
				[head.source]: {
					prop,
					parentSource: head.parentSource,
					chapters: out,
				},
			}
			: null;
	}
}

if (typeof module !== "undefined") {
	module.exports = {MapsUtil};
}
