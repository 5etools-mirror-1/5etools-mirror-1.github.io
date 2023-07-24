"use strict";

class RenderMap {
	static _getZoom (mapData) {
		return this._ZOOM_LEVELS[mapData.ixZoom];
	}

	static async pShowViewer (evt, ele) {
		const mapData = JSON.parse(ele.dataset.rdPackedMap);

		if (!mapData.page) mapData.page = ele.dataset.rdAdventureBookMapPage;
		if (!mapData.source) mapData.source = ele.dataset.rdAdventureBookMapSource;
		if (!mapData.hash) mapData.hash = ele.dataset.rdAdventureBookMapHash;

		await RenderMap._pMutMapData(mapData);

		if (!mapData.loadedImage) return;

		const $content = this._$getWindowContent(mapData);

		Renderer.hover.getShowWindow(
			$content,
			// Open in the top-right corner of the screen
			Renderer.hover.getWindowPositionExact(document.body.clientWidth, 7, evt),
			{
				title: `Dynamic Map Viewer`,
				isPermanent: true,
				isBookContent: true,
				width: Math.min(Math.floor(document.body.clientWidth / 2), mapData.width),
				height: mapData.height + 32,
				$pFnGetPopoutContent: this._$getWindowContent.bind(this, mapData),
				fnGetPopoutSize: () => {
					return {
						width: Math.min(window.innerWidth, Math.round(this._getZoom(mapData) * mapData.width)),
						height: Math.min(window.innerHeight, Math.round(this._getZoom(mapData) * mapData.height) + 32),
					};
				},
				isPopout: !!evt.shiftKey,
			},
		);
	}

	static async $pGetRendered (mapData) {
		await RenderMap._pMutMapData(mapData);
		if (!mapData.loadedImage) return;
		return this._$getWindowContent(mapData);
	}

	static async _pMutMapData (mapData) {
		// Store some additional data on this mapData state object
		mapData.ixZoom = RenderMap._ZOOM_LEVELS.indexOf(1.0);
		mapData.activeWindows = {};
		mapData.loadedImage = await RenderMap._pLoadImage(mapData);
		if (mapData.loadedImage) {
			mapData.width = mapData.width || mapData.loadedImage.naturalWidth;
			mapData.height = mapData.height || mapData.loadedImage.naturalHeight;
		}
	}

	static async _pLoadImage (mapData) {
		const image = new Image();
		const pLoad = new Promise((resolve, reject) => {
			image.onload = () => resolve(image);
			image.onerror = err => reject(err);
		});
		image.src = mapData.href;

		let out = null;
		try {
			out = await pLoad;
		} catch (e) {
			JqueryUtil.doToast({type: "danger", content: `Failed to load image! ${VeCt.STR_SEE_CONSOLE}`});
			setTimeout(() => { throw e; });
		}
		return out;
	}

	static _$getWindowContent (mapData) {
		const X = 0;
		const Y = 1;

		const $cvs = $(`<canvas class="p-0 m-0"/>`);
		const cvs = $cvs[0];
		cvs.width = mapData.width;
		cvs.height = mapData.height;
		const ctx = cvs.getContext("2d");

		const zoomChange = (direction) => {
			if (direction != null) {
				if ((mapData.ixZoom === 0 && direction === "out")
					|| (mapData.ixZoom === RenderMap._ZOOM_LEVELS.length - 1 && direction === "in")) return;

				const lastIxZoom = mapData.ixZoom;

				switch (direction) {
					case "in": mapData.ixZoom++; break;
					case "out": mapData.ixZoom--; break;
					case "reset": mapData.ixZoom = RenderMap._ZOOM_LEVELS.indexOf(1.0);
				}

				if (lastIxZoom === mapData.ixZoom) return;
			}

			const zoom = this._getZoom(mapData);

			const nxtWidth = Math.round(mapData.width * zoom);
			const nxtHeight = Math.round(mapData.height * zoom);

			const diffWidth = nxtWidth - cvs.width;
			const diffHeight = nxtHeight - cvs.height;

			const eleWrpCvs = $wrpCvs[0];
			const scrollLeft = eleWrpCvs.scrollLeft;
			const scrollTop = eleWrpCvs.scrollTop;

			cvs.width = nxtWidth;
			cvs.height = nxtHeight;

			// Scroll to offset the zoom, keeping the same region centred
			eleWrpCvs.scrollTo(
				scrollLeft + Math.round(diffWidth / 2),
				scrollTop + Math.round(diffHeight / 2),
			);
			paint();
		};

		const zoomChangeDebounced = MiscUtil.debounce(zoomChange, 20);

		const getZoomedPoint = (pt) => {
			const zoom = this._getZoom(mapData);

			return [
				Math.round(pt[X] * zoom),
				Math.round(pt[Y] * zoom),
			];
		};

		const paint = () => {
			ctx.clearRect(0, 0, cvs.width, cvs.height);
			ctx.drawImage(mapData.loadedImage, 0, 0, cvs.width, cvs.height);

			mapData.regions.forEach(region => {
				ctx.lineWidth = 2;
				ctx.strokeStyle = "#337ab7";
				ctx.fillStyle = "#337ab760";

				ctx.beginPath();
				region.points.forEach(pt => {
					pt = getZoomedPoint(pt);
					ctx.lineTo(pt[X], pt[Y]);
				});

				let firstPoint = region.points[0];
				firstPoint = getZoomedPoint(firstPoint);
				ctx.lineTo(firstPoint[X], firstPoint[Y]);

				ctx.fill();
				ctx.stroke();
				ctx.closePath();
			});
		};

		const getEventPoint = evt => {
			const {top: cvsTopPos, left: cvsLeftPos} = cvs.getBoundingClientRect();
			const clientX = EventUtil.getClientX(evt);
			const clientY = EventUtil.getClientY(evt);

			const cvsSpaceX = clientX - cvsLeftPos;
			const cvsSpaceY = clientY - cvsTopPos;

			const zoom = this._getZoom(mapData);

			const cvsZoomedSpaceX = Math.round((1 / zoom) * cvsSpaceX);
			const cvsZoomedSpaceY = Math.round((1 / zoom) * cvsSpaceY);

			return [
				cvsZoomedSpaceX,
				cvsZoomedSpaceY,
			];
		};

		const lastRmbMeta = {
			body: null,
			point: null,
			time: null,
			scrollPos: null,
		};

		$cvs
			.click(async evt => {
				const clickPt = getEventPoint(evt);

				const intersectedRegions = RenderMap._getIntersectedRegions(mapData.regions, clickPt);

				// Arbitrarily choose the first region if we intersect multiple
				const intersectedRegion = intersectedRegions[0];
				if (!intersectedRegion) return;

				const area = await RenderMap._pGetArea(intersectedRegion.area, mapData);

				// When in book mode, shift-click a region to navigate to it
				if (evt.shiftKey && typeof BookUtil !== "undefined") {
					const oldHash = location.hash;
					location.hash = `#${BookUtil.curRender.curBookId},${area.chapter},${UrlUtil.encodeForHash(area.entry.name)},0`;
					if (oldHash.toLowerCase() === location.hash.toLowerCase()) {
						BookUtil.isHashReload = true;
						BookUtil.booksHashChange();
					}
					return;
				}

				// If the window already exists, maximize it and bring it to the front
				if (mapData.activeWindows[area.entry.id]) {
					const windowMeta = mapData.activeWindows[area.entry.id];
					windowMeta.doZIndexToFront();
					windowMeta.doMaximize();
					return;
				}

				const $content = Renderer.hover.$getHoverContent_generic(area.entry, {isLargeBookContent: true, depth: area.depth});
				mapData.activeWindows[area.entry.id] = Renderer.hover.getShowWindow(
					$content,
					Renderer.hover.getWindowPositionExactVisibleBottom(
						EventUtil.getClientX(evt),
						EventUtil.getClientY(evt),
						evt,
					),
					{
						title: area.entry.name || "",
						isPermanent: true,
						isBookContent: true,
						cbClose: () => {
							delete mapData.activeWindows[area.entry.id];
						},
					},
				);
			})
			.mousedown(evt => {
				if (evt.button !== 2) return; // RMB

				const eleWrpCvs = $wrpCvs[0];
				cvs.style.cursor = "grabbing";

				// Find the nearest body, in case we're in a popout window
				lastRmbMeta.body = lastRmbMeta.body || $out.closest("body")[0];
				lastRmbMeta.point = [EventUtil.getClientX(evt), EventUtil.getClientY(evt)];
				lastRmbMeta.time = Date.now();
				lastRmbMeta.scrollPos = [eleWrpCvs.scrollLeft, eleWrpCvs.scrollTop];

				$(lastRmbMeta.body)
					.off(`mouseup.rd__map`)
					.on(`mouseup.rd__map`, evt => {
						if (evt.button !== 2) return; // RMB

						$(lastRmbMeta.body)
							.off(`mouseup.rd__map`)
							.off(`mousemove.rd__map`);

						cvs.style.cursor = "";

						lastRmbMeta.point = null;
						lastRmbMeta.time = null;
						lastRmbMeta.scrollPos = null;
					})
					.off(`mousemove.rd__map`)
					.on(`mousemove.rd__map`, evt => {
						if (lastRmbMeta.point == null) return;

						const movePt = [EventUtil.getClientX(evt), EventUtil.getClientY(evt)];

						const diffX = lastRmbMeta.point[X] - movePt[X];
						const diffY = lastRmbMeta.point[Y] - movePt[Y];

						lastRmbMeta.time = Date.now();

						eleWrpCvs.scrollTo(
							lastRmbMeta.scrollPos[X] + diffX,
							lastRmbMeta.scrollPos[Y] + diffY,
						);
					})
					// Bind a document-wide handler to block the context menu at the end of the pan
					.off(`contextmenu.rd__map`)
					.on(`contextmenu.rd__map`, evt => {
						evt.stopPropagation();
						evt.preventDefault();

						$(lastRmbMeta.body).off(`contextmenu.rd__map`);
					});
			});

		const $btnZoomMinus = $(`<button class="btn btn-xs btn-default"><span class="glyphicon glyphicon-zoom-out"/> Zoom Out</button>`)
			.click(() => zoomChange("out"));

		const $btnZoomPlus = $(`<button class="btn btn-xs btn-default"><span class="glyphicon glyphicon-zoom-in"/> Zoom In</button>`)
			.click(() => zoomChange("in"));

		const $btnZoomReset = $(`<button class="btn btn-xs btn-default" title="Reset Zoom"><span class="glyphicon glyphicon-search"/> Reset Zoom</button>`)
			.click(() => zoomChange("reset"));

		const $btnHelp = $(`<button class="btn btn-xs btn-default ml-auto mr-4" title="Help"><span class="glyphicon glyphicon-info-sign"/> Help</button>`)
			.click(evt => {
				const {$modalInner} = UiUtil.getShowModal({
					title: "Help",
					isMinHeight0: true,
					window: evt.view?.window,
				});

				$modalInner.append(`
					<p><i>Use of the &quot;Open as Popup Window&quot; button in the window title bar is recommended.</i></p>
					<ul>
						<li>Left-click to open an area as a new window.</li>
						<li><kbd>SHIFT</kbd>-left-click to jump to an area.</li>
						<li>Right-click and drag to pan.</li>
						<li><kbd>CTRL</kbd>-scroll to zoom.</li>
					</ul>
				`);
			});

		const $wrpCvs = $$`<div class="w-100 h-100 overflow-x-scroll overflow-y-scroll rd__scroller-viewer">
			${$cvs}
		</div>`
			.on("mousewheel DOMMouseScroll", evt => {
				if (!EventUtil.isCtrlMetaKey(evt)) return;
				evt.stopPropagation();
				evt.preventDefault();
				evt = evt.originalEvent; // Access the underlying properties

				const direction = (evt.wheelDelta != null && evt.wheelDelta > 0)
					|| (evt.deltaY != null && evt.deltaY < 0)
					// `evt.detail` seems to work on Firefox
					|| (evt.detail != null && !isNaN(evt.detail) && evt.detail < 0) ? "in" : "out";
				zoomChangeDebounced(direction);
			});

		const $out = $$`<div class="ve-flex-col w-100 h-100">
			<div class="ve-flex no-shrink p-2">
				<div class="btn-group ve-flex mr-2">
					${$btnZoomMinus}
					${$btnZoomPlus}
				</div>
				${$btnZoomReset}
				${$btnHelp}
			</div>
			${$wrpCvs}
		</div>`;

		zoomChange();

		return $out;
	}

	static async _pGetArea (areaId, mapData) {
		// When in book mode, we already have the area info cached
		if (typeof BookUtil !== "undefined") return BookUtil.curRender.headerMap[areaId] || {entry: {name: ""}};

		if (mapData.page && mapData.source && mapData.hash) {
			const fromCache = MiscUtil.get(RenderMap._AREA_CACHE, mapData.source, mapData.hash, areaId);
			if (fromCache) return fromCache;

			const loaded = await DataLoader.pCacheAndGet(mapData.page, mapData.source, mapData.hash);
			(RenderMap._AREA_CACHE[mapData.source] =
				RenderMap._AREA_CACHE[mapData.source] || {})[mapData.hash] =
				Renderer.adventureBook.getEntryIdLookup((loaded.adventureData || loaded.bookData).data);
			return RenderMap._AREA_CACHE[mapData.source][mapData.hash][areaId];
		}

		throw new Error(`Could not load area "${areaId}"`);
	}

	static _getIntersectedRegions (regions, pt) {
		return regions.filter(region => this._getIntersectedRegions_isIntersected(region.points.map(it => ({x: it[0], y: it[1]})), pt));
	}

	// Based on: https://rosettacode.org/wiki/Ray-casting_algorithm
	static _getIntersectedRegions_isIntersected (bounds, pt) {
		const [x, y] = pt;

		let count = 0;
		const len = bounds.length;
		for (let i = 0; i < len; ++i) {
			const vertex1 = bounds[i];
			const vertex2 = bounds[(i + 1) % len];
			if (this._getIntersectedRegions_isWest(vertex1, vertex2, x, y)) ++count;
		}

		return count % 2;
	}

	/**
	 * @return {boolean} true if (x,y) is west of the line segment connecting A and B
	 */
	static _getIntersectedRegions_isWest (A, B, x, y) {
		if (A.y <= B.y) {
			if (y <= A.y || y > B.y || (x >= A.x && x >= B.x)) {
				return false;
			} else if (x < A.x && x < B.x) {
				return true;
			} else {
				return (y - A.y) / (x - A.x) > (B.y - A.y) / (B.x - A.x);
			}
		} else {
			return this._getIntersectedRegions_isWest(B, A, x, y);
		}
	}
}
RenderMap._ZOOM_LEVELS = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0];
RenderMap._AREA_CACHE = {};
