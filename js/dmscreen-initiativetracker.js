"use strict";

class InitiativeTracker {
	static make$Tracker (board, state) {
		const ALPHA = "ALPHA";
		const NUM = "NUMBER";
		const ASC = "ASC";
		const DESC = "DESC";

		const _propDefaultFalse = (savedVal) => !!savedVal;
		const _propDefaultTrue = (savedVal) => savedVal == null ? true : !!savedVal;

		const cfg = {
			sort: state.s || NUM,
			dir: state.d || DESC,
			isLocked: false,
			isRollInit: _propDefaultTrue(state.m),
			isRollHp: _propDefaultFalse(state.m),
			importIsRollGroups: _propDefaultTrue(state.g),
			importIsAddPlayers: _propDefaultTrue(state.p),
			importIsAppend: _propDefaultFalse(state.a),
			statsAddColumns: _propDefaultFalse(state.k),
			playerInitShowExactPlayerHp: _propDefaultFalse(state.piHp),
			playerInitShowExactMonsterHp: _propDefaultFalse(state.piHm),
			playerInitHideNewMonster: _propDefaultTrue(state.piV),
			playerInitShowOrdinals: _propDefaultFalse(state.piO),
			statsCols: state.c || [],
		};

		const $wrpTracker = $(`<div class="dm-init dm__panel-bg dm__data-anchor"/>`);

		// Unused; to be considered for other applications
		const handleResize = () => {
			// if ($wrpTracker.width() > 420) { // approx width of a long name + controls
			// 	$wrpTracker.find(`.dm-init-row-mid`).show();
			// } else {
			// 	$wrpTracker.find(`.dm-init-row-mid`).hide();
			// }
		};
		const evtId = CryptUtil.uid();
		board.$creen.on(`panelResize.${evtId}`, handleResize);
		$wrpTracker.on("destroyed", () => board.$creen.off(`panelResize.${evtId}`));

		const p2pMetaV1 = {rows: [], serverInfo: null, serverPeer: null};
		const p2pMetaV0 = {rows: [], serverInfo: null};
		const _sendStateToClients = () => {
			// region V1
			if (p2pMetaV1.serverPeer) {
				if (!p2pMetaV1.serverPeer.hasConnections()) return;

				const toSend = getPlayerFriendlyState();
				p2pMetaV1.serverPeer.sendMessage(toSend);
			}
			// endregion

			// region V0
			if (p2pMetaV0.serverInfo) {
				p2pMetaV0.rows = p2pMetaV0.rows.filter(r => !r.isDeleted);
				p2pMetaV0.serverInfo = p2pMetaV0.serverInfo.filter(r => {
					if (r.isDeleted) {
						r.server.close();
						return false;
					}
					return true;
				});

				const toSend = getPlayerFriendlyState();
				try {
					p2pMetaV0.serverInfo.filter(info => info.server.isActive).forEach(info => info.server.sendMessage(toSend));
				} catch (e) { setTimeout(() => { throw e; }); }
			}
			// endregion
		};
		const sendStateToClientsDebounced = MiscUtil.debounce(_sendStateToClients, 100); // long delay to avoid network spam

		const doUpdateExternalStates = () => {
			board.doSaveStateDebounced();
			sendStateToClientsDebounced();
		};

		const makeImportSettingsModal = () => {
			const {$modalInner} = UiUtil.getShowModal({title: "Import Settings", cbClose: () => doUpdateExternalStates()});
			UiUtil.addModalSep($modalInner);
			UiUtil.$getAddModalRowCb($modalInner, "Roll creature initiative", cfg, "isRollInit");
			UiUtil.$getAddModalRowCb($modalInner, "Roll creature hit points", cfg, "isRollHp");
			UiUtil.$getAddModalRowCb($modalInner, "Roll groups of creatures together", cfg, "importIsRollGroups");
			UiUtil.$getAddModalRowCb($modalInner, "Add players", cfg, "importIsAddPlayers");
			UiUtil.$getAddModalRowCb($modalInner, "Add to existing tracker state", cfg, "importIsAppend");
		};

		// initialise "upload" context menu
		const menu = ContextUtil.getMenu([
			...ListUtilBestiary.getContextOptionsLoadSublist({
				pFnOnSelect: pDoLoadEncounter,
			}),
			null,
			new ContextUtil.Action(
				"Import Settings",
				() => {
					makeImportSettingsModal();
				},
			),
		]);

		const $wrpTop = $(`<div class="dm-init-wrp-header-outer"/>`).appendTo($wrpTracker);
		const $wrpHeader = $(`
			<div class="dm-init-wrp-header">
				<div class="dm-init-row-lhs dm-init-header">
					<div class="w-100">Creature/Status</div>
				</div>

				<div class="dm-init-row-mid"/>

				<div class="dm-init-row-rhs">
					<div class="dm-init-header dm-init-header--input dm-init-header--input-wide" title="Hit Points">HP</div>
					<div class="dm-init-header dm-init-header--input" title="Initiative Score">#</div>
					<div style="width: 52px;"/>
				</div>
			</div>
		`).appendTo($wrpTop);

		const $wrpEntries = $(`<div class="dm-init-wrp-entries"/>`).appendTo($wrpTop);

		const $wrpControls = $(`<div class="dm-init-wrp-controls"/>`).appendTo($wrpTracker);

		const $wrpAddNext = $(`<div class="ve-flex"/>`).appendTo($wrpControls);
		const $wrpAdd = $(`<div class="btn-group ve-flex"/>`).appendTo($wrpAddNext);
		const $btnAdd = $(`<button class="btn btn-primary btn-xs dm-init-lockable" title="Add Player"><span class="glyphicon glyphicon-plus"/></button>`).appendTo($wrpAdd);
		const $btnAddMonster = $(`<button class="btn btn-success btn-xs dm-init-lockable mr-2" title="Add Monster"><span class="glyphicon glyphicon-print"/></button>`).appendTo($wrpAdd);
		const $btnSetPrevActive = $(`<button class="btn btn-default btn-xs" title="Previous Turn"><span class="glyphicon glyphicon-step-backward"/></button>`)
			.click(() => setPrevActive());
		const $btnSetNextActive = $(`<button class="btn btn-default btn-xs mr-2" title="Next Turn"><span class="glyphicon glyphicon-step-forward"/></button>`)
			.click(() => setNextActive());
		$$`<div class="btn-group">${$btnSetPrevActive}${$btnSetNextActive}</div>`.appendTo($wrpAddNext);
		const $iptRound = $(`<input class="form-control ipt-sm dm_init__rounds" type="number" min="1" title="Round">`)
			.val(state.n || 1)
			.change(() => doUpdateExternalStates())
			.appendTo($wrpAddNext);

		const $wrpSort = $(`<div class="btn-group ve-flex"/>`).appendTo($wrpControls);
		$(`<button title="Sort Alphabetically" class="btn btn-default btn-xs"><span class="glyphicon glyphicon-sort-by-alphabet"/></button>`).appendTo($wrpSort)
			.click(() => {
				if (cfg.sort === ALPHA) flipDir();
				else cfg.sort = ALPHA;
				doSort(ALPHA);
			});
		$(`<button title="Sort Numerically" class="btn btn-default btn-xs"><span class="glyphicon glyphicon-sort-by-order"/></button>`).appendTo($wrpSort)
			.click(() => {
				if (cfg.sort === NUM) flipDir();
				else cfg.sort = NUM;
				doSort(NUM);
			});

		const $wrpUtils = $(`<div class="ve-flex"/>`).appendTo($wrpControls);

		const menuPlayerWindow = ContextUtil.getMenu([
			new ContextUtil.Action(
				"Standard",
				async () => {
					this._handleClick_playerWindowV1({board, cfg, p2pMetaV1, doUpdateExternalStates});
				},
			),
			new ContextUtil.Action(
				"Manual (Legacy)",
				async () => {
					this._handleClick_playerWindowV0({board, cfg, p2pMetaV0, doUpdateExternalStates});
				},
			),
		]);

		$(`<button class="btn btn-primary btn-xs mr-2" title="Player View"><span class="glyphicon glyphicon-user"/></button>`)
			.click(evt => {
				ContextUtil.pOpenMenu(evt, menuPlayerWindow);
			})
			.appendTo($wrpUtils);

		$wrpTracker.data("pDoConnectLocalV1", async () => {
			await this._startServerV1({p2pMetaV1, doUpdateExternalStates});
			return p2pMetaV1.serverPeer.token;
		});

		$wrpTracker.data("pDoConnectLocalV0", async (clientView) => {
			// generate a stub/fake row meta
			const rowMeta = {
				id: CryptUtil.uid(),
				$row: $(),
				$iptName: $(`<input value="local">`),
				$iptTokenServer: $(),
				$btnGenServerToken: $(),
				$iptTokenClient: $(),
				$btnAcceptClientToken: $(),
			};

			p2pMetaV0.rows.push(rowMeta);

			const serverTokens = await this._playerWindowV0_pGetServerTokens({cfg, p2pMetaV0, rowMetas: [rowMeta]});
			const clientData = await PeerUtilV0.pInitialiseClient(
				serverTokens[0],
				msg => clientView.handleMessage(msg),
				() => {}, // ignore local errors
			);
			clientView.clientData = clientData;
			await PeerUtilV0.pConnectClientsToServers([rowMeta.serverInfo], clientData.textifiedSdp);
			sendStateToClientsDebounced();
		});

		const $wrpLockSettings = $(`<div class="btn-group ve-flex"/>`).appendTo($wrpUtils);
		const $btnLock = $(`<button class="btn btn-danger btn-xs" title="Lock Tracker"><span class="glyphicon glyphicon-lock"></span></button>`).appendTo($wrpLockSettings);
		$btnLock.on("click", () => {
			if (cfg.isLocked) {
				$btnLock.removeClass("btn-success").addClass("btn-danger").title("Lock Tracker");
				$(".dm-init-lockable").removeClass("disabled");
				$("input.dm-init-lockable").prop("disabled", false);
			} else {
				$btnLock.removeClass("btn-danger").addClass("btn-success").title("Unlock Tracker");
				$(".dm-init-lockable").addClass("disabled");
				$("input.dm-init-lockable").prop("disabled", true);
			}
			cfg.isLocked = !cfg.isLocked;
			handleStatColsChange();
		});

		$(`<button class="btn btn-default btn-xs mr-2"><span class="glyphicon glyphicon-cog"></span></button>`)
			.appendTo($wrpLockSettings)
			.click(() => {
				const {$modalInner} = UiUtil.getShowModal({
					title: "Settings",
					cbClose: () => {
						handleStatColsChange();
						doUpdateExternalStates();
					},
				});
				UiUtil.addModalSep($modalInner);
				UiUtil.$getAddModalRowCb($modalInner, "Roll initiative", cfg, "isRollInit");
				UiUtil.$getAddModalRowCb($modalInner, "Roll hit points", cfg, "isRollHp");
				UiUtil.addModalSep($modalInner);
				UiUtil.$getAddModalRowCb($modalInner, "Player View: Show exact player HP", cfg, "playerInitShowExactPlayerHp");
				UiUtil.$getAddModalRowCb($modalInner, "Player View: Show exact monster HP", cfg, "playerInitShowExactMonsterHp");
				UiUtil.$getAddModalRowCb($modalInner, "Player View: Auto-hide new monsters", cfg, "playerInitHideNewMonster");
				UiUtil.$getAddModalRowCb($modalInner, "Player View: Show ordinals", cfg, "playerInitShowOrdinals", "For example, if you add two Goblins, one will be Goblin (1) and the other Goblin (2), rather than having identical names.");
				UiUtil.addModalSep($modalInner);

				const $cbStats = UiUtil.$getAddModalRowCb($modalInner, "Additional Columns", cfg, "statsAddColumns");
				const $wrpTblStatsHead = UiUtil.$getAddModalRow($modalInner, "div")
					.addClass("ui-modal__row--stats-header")
					// intentional difference in column widths compared to the rows, to position the long header
					//  ("Editable?") correctly
					.append(`
						<div class="row dm_init__stats_row">
							<div class="col-1-3"/>
							<div class="col-4-9">Contains...</div>
							<div class="col-2-5">Abbreviation</div>
							<div class="col-1-7 text-center help" title="Only affects creatures. Players are always editable.">Editable?</div>
						</div>
					`);
				const $wrpTblStats = UiUtil.$getAddModalRow($modalInner, "div").addClass("ui-modal__row--stats");

				(() => {
					const $wrpStatsRows = $(`<div class="dm_init__stats_rows mb-2"/>`).appendTo($wrpTblStats);
					const $wrpBtn = $(`<div class="text-center"/>`).appendTo($wrpTblStats);

					const addRow = (thisCfg) => {
						if (!thisCfg) { // if new row
							thisCfg = {
								id: CryptUtil.uid(),
								v: 0, // is player-visible (0 = none, 1 = all, 2 = player units only)
								o: cfg.statsCols.filter(it => !it.isDeleted).length + 1, // order
								e: true, // editable

								// input data
								p: "", // populate with...
								po: null, // populate with... (previous value)
								a: "", // abbreviation
							};
							cfg.statsCols.push(thisCfg);
						}

						const $selPre = $(`
								<select class="form-control input-xs">
									<option value="">(Empty)</option>
									${Object.entries(InitiativeTracker.STAT_COLUMNS).map(([k, v]) => v.isHr ? `<option disabled>\u2014</option>` : `<option value="${k}">${v.name}</option>`)}
								</select>
							`).change(() => {
							const sel = InitiativeTracker.STAT_COLUMNS[$selPre.val()] || {};
							thisCfg.a = sel.abv || "";
							$iptAbv.val(thisCfg.a);
							thisCfg.po = thisCfg.p || null;
							thisCfg.p = $selPre.val() || "";

							doUpdateExternalStates();
						});
						if (thisCfg.p) {
							$selPre.val(thisCfg.p);
						}

						const $iptAbv = $(`<input class="form-control input-xs" value="${(thisCfg.a || "").escapeQuotes()}">`).change(() => {
							thisCfg.a = $iptAbv.val();
							doUpdateExternalStates();
						});

						const $cbEditable = $(`<input type="checkbox">`).prop("checked", !!thisCfg.e).change(() => {
							thisCfg.e = $cbEditable.prop("checked");
							doUpdateExternalStates();
						});

						const $btnVisible = InitiativeTracker.get$btnPlayerVisible(thisCfg.v, () => {
							thisCfg.v = $btnVisible.hasClass("btn-primary--half") ? 2 : $btnVisible.hasClass("btn-primary") ? 1 : 0;
							doUpdateExternalStates();
						}, true);

						const $btnDel = $(`<button class="btn btn-xs btn-danger"><span class="glyphicon glyphicon-trash"/></button>`).click(() => {
							$row.remove();
							thisCfg.isDeleted = true;
							if (!$wrpTblStats.find(`.dm_init__stats_row`).length) {
								addRow();
							}
							doUpdateExternalStates();
						});

						const saveOrders = () => {
							const curr = {};
							$wrpTblStats.find(`.dm_init__stats_row`).each((i, e) => curr[$(e).attr("data-id")] = i);
							cfg.statsCols.forEach(it => {
								const newOrder = curr[it.id];
								if (newOrder != null) {
									it.o = newOrder;
								} else {
									it.o = -1;
								}
							});
						};

						const $btnUp = $(`<button class="btn btn-xs btn-default"><span class="glyphicon glyphicon-arrow-up"/></button>`).click(() => {
							if ($row.prev().length) {
								$row.prev().before($row);
								saveOrders();
								doUpdateExternalStates();
							}
						});

						const $btnDown = $(`<button class="btn btn-xs btn-default"><span class="glyphicon glyphicon-arrow-down dm_init__stats_down"/></button>`).click(() => {
							if ($row.next().length) {
								$row.next().after($row);
								saveOrders();
								doUpdateExternalStates();
							}
						});

						const $row = $$`
							<div class="row dm_init__stats_row dm_init__stats_row--item" data-id="${thisCfg.id}">
								<div class="col-1-3 btn-group text-center dm_init__stats_up_down">${$btnUp}${$btnDown}</div>
								<div class="col-1-3 dm_init__stats_up_down--spacer"></div>

								<div class="col-4-9">${$selPre}</div>
								<div class="col-2-8">${$iptAbv}</div>
								<div class="col-1 text-center">${$cbEditable}</div>
								<div class="col-1 text-center">${$btnVisible}</div>
								<div class="col-1 text-center dm_init__stats_del">${$btnDel}</div>
							</div>
						`.appendTo($wrpStatsRows);
					};

					$(`<button class="btn btn-xs btn-default"><span class="glyphicon-plus glyphicon dm_init__stats_add"/></button>`)
						.appendTo($wrpBtn)
						.click(() => addRow());

					if (!cfg.statsCols.length) addRow();
					else cfg.statsCols.forEach(it => addRow(it));
				})();

				$cbStats.change(() => {
					$wrpTblStatsHead.toggle($cbStats.prop("checked"));
					$wrpTblStats.toggle($cbStats.prop("checked"));
				});
				$wrpTblStatsHead.toggle($cbStats.prop("checked"));
				$wrpTblStats.toggle($cbStats.prop("checked"));
			});

		const $wrpLoadReset = $(`<div class="btn-group"/>`).appendTo($wrpUtils);
		const $btnLoad = $(`<button title="Import an encounter from the Bestiary" class="btn btn-success btn-xs dm-init-lockable"><span class="glyphicon glyphicon-upload"/></button>`).appendTo($wrpLoadReset)
			.click((evt) => {
				if (cfg.isLocked) return;
				ContextUtil.pOpenMenu(evt, menu);
			});
		$(`<button title="Reset" class="btn btn-danger btn-xs dm-init-lockable"><span class="glyphicon glyphicon-trash"/></button>`).appendTo($wrpLoadReset)
			.click(() => {
				if (cfg.isLocked) return;
				confirm("Are you sure?") && doReset();
			});

		$btnAdd.on("click", async () => {
			if (cfg.isLocked) return;
			await pMakeRow({isVisible: true});
			doSort(cfg.sort);
			checkSetFirstActive({isSkipUpdateRound: true});
		});

		$btnAddMonster.on("click", () => {
			if (cfg.isLocked) return;
			const flags = {
				doClickFirst: false,
				isWait: false,
			};

			const {$modalInner, doClose} = UiUtil.getShowModal();

			const $controls = $(`<div class="split" style="flex-shrink: 0"/>`).appendTo($modalInner);
			const $iptSearch = $(`<input class="ui-search__ipt-search search form-control" autocomplete="off" placeholder="Search...">`).blurOnEsc().appendTo($controls);
			const $wrpCount = $(`
				<div class="ui-search__ipt-search-sub-wrp" style="padding-right: 0;">
					<div style="margin-right: 7px;">Add</div>
					<label class="ui-search__ipt-search-sub-lbl"><input type="radio" name="mon-count" class="ui-search__ipt-search-sub-ipt" value="1" checked> 1</label>
					<label class="ui-search__ipt-search-sub-lbl"><input type="radio" name="mon-count" class="ui-search__ipt-search-sub-ipt" value="2"> 2</label>
					<label class="ui-search__ipt-search-sub-lbl"><input type="radio" name="mon-count" class="ui-search__ipt-search-sub-ipt" value="3"> 3</label>
					<label class="ui-search__ipt-search-sub-lbl"><input type="radio" name="mon-count" class="ui-search__ipt-search-sub-ipt" value="5"> 5</label>
					<label class="ui-search__ipt-search-sub-lbl"><input type="radio" name="mon-count" class="ui-search__ipt-search-sub-ipt" value="8"> 8</label>
					<label class="ui-search__ipt-search-sub-lbl"><input type="radio" name="mon-count" class="ui-search__ipt-search-sub-ipt" value="-1"> <input type="number" class="form-control ui-search__ipt-search-sub-ipt-custom" value="13" min="1"></label>
				</div>
			`).appendTo($controls);
			$wrpCount.find(`.ui-search__ipt-search-sub-ipt-custom`).click(function () {
				$wrpCount.find(`.ui-search__ipt-search-sub-ipt[value=-1]`).prop("checked", true);
				$(this).select();
			});
			const getCount = () => {
				const val = $wrpCount.find(`[name="mon-count"]`).filter(":checked").val();
				if (val === "-1") return Number($wrpCount.find(`.ui-search__ipt-search-sub-ipt-custom`).val());
				return Number(val);
			};

			const $wrpCbRoll = $(`<label class="ui-search__ipt-search-sub-wrp ve-flex-vh-center"> <span>Roll HP</span></label>`).appendTo($controls);
			const $cbRoll = $(`<input class="mr-1" type="checkbox">`).prop("checked", cfg.isRollHp).on("change", () => cfg.isRollHp = $cbRoll.prop("checked")).prependTo($wrpCbRoll);
			const $results = $(`<div class="ui-search__wrp-results"/>`).appendTo($modalInner);

			const showMsgIpt = () => {
				flags.isWait = true;
				$results.empty().append(SearchWidget.getSearchEnter());
			};

			const showMsgDots = () => $results.empty().append(SearchWidget.getSearchLoading());

			const showNoResults = () => {
				flags.isWait = true;
				$results.empty().append(SearchWidget.getSearchNoResults());
			};

			const $ptrRows = {_: []};

			const doSearch = () => {
				const srch = $iptSearch.val().trim();
				const MAX_RESULTS = 75; // hard cap results

				const index = board.availContent["Creature"];
				const results = index.search(srch, {
					fields: {
						n: {boost: 5, expand: true},
						s: {expand: true},
					},
					bool: "AND",
					expand: true,
				});
				const resultCount = results.length ? results.length : index.documentStore.length;
				const toProcess = results.length ? results : Object.values(index.documentStore.docs).slice(0, 75).map(it => ({doc: it}));

				$results.empty();
				$ptrRows._ = [];
				if (toProcess.length) {
					const handleClick = async r => {
						const name = r.doc.n;
						const source = r.doc.s;
						const count = getCount();
						if (isNaN(count) || count < 1) return;

						await pMakeRow({
							nameOrMeta: name,
							source,
							isRollHp: $cbRoll.prop("checked"),
						});
						if (count > 1) {
							for (let i = 1; i < count; ++i) {
								await pMakeRow({
									nameOrMeta: name,
									source,
									isRollHp: $cbRoll.prop("checked"),
								});
							}
						}
						doSort(cfg.sort);
						checkSetFirstActive({isSkipUpdateRound: true});
						doUpdateExternalStates();
						doClose();
					};

					const $getRow = (r) => {
						return $(`
							<div class="ui-search__row" tabindex="0">
								<span>${r.doc.n}</span>
								<span>${r.doc.s ? `<i title="${Parser.sourceJsonToFull(r.doc.s)}">${Parser.sourceJsonToAbv(r.doc.s)}${r.doc.p ? ` p${r.doc.p}` : ""}</i>` : ""}</span>
							</div>
						`);
					};

					if (flags.doClickFirst) {
						handleClick(toProcess[0]);
						flags.doClickFirst = false;
						return;
					}

					const res = toProcess.slice(0, MAX_RESULTS); // hard cap at 75 results

					res.forEach(r => {
						const $row = $getRow(r).appendTo($results);
						SearchWidget.bindRowHandlers({result: r, $row, $ptrRows, fnHandleClick: handleClick});
						$ptrRows._.push($row);
					});

					if (resultCount > MAX_RESULTS) {
						const diff = resultCount - MAX_RESULTS;
						$results.append(`<div class="ui-search__row ui-search__row--readonly">...${diff} more result${diff === 1 ? " was" : "s were"} hidden. Refine your search!</div>`);
					}
				} else {
					if (!srch.trim()) showMsgIpt();
					else showNoResults();
				}
			};

			SearchWidget.bindAutoSearch($iptSearch, {
				flags,
				fnSearch: doSearch,
				fnShowWait: showMsgDots,
				$ptrRows,
			});

			$iptSearch.focus();
			doSearch();
		});

		function getStatColsState ($row) {
			return $row.find(`.dm_init__stat`).map((i, e) => {
				const $ipt = $(e).find(`input`);
				const isCb = $ipt.attr("type") === "checkbox";
				return {
					v: isCb ? $ipt.prop("checked") : $ipt.val(),
					id: $(e).attr("data-id"),
				};
			}).get();
		}

		function getSaveableState () {
			const rows = $wrpEntries.find(`.dm-init-row`).map((i, e) => {
				const $row = $(e);
				const $conds = $row.find(`.init__cond`);
				const $iptDisplayName = $row.find(`input.displayName`);
				const customName = $row.hasClass(`dm-init-row-rename`) ? $row.find(`.dm-init-row-link-name`).text() : null;
				const n = $iptDisplayName.length ? {
					n: $row.find(`input.name`).val(),
					d: $iptDisplayName.val(),
					scr: $row.find(`input.scaledCr`).val() || "",
					ssp: $row.find(`input.scaledSummonSpellLevel`).val() || "",
					scl: $row.find(`input.scaledSummonClassLevel`).val() || "",
				} : $row.find(`input.name`).val();
				const out = {
					n,
					k: getStatColsState($row),
					h: $row.find(`input.hp`).val(),
					g: $row.find(`input.hp-max`).val(),
					i: $row.find(`input.score`).val(),
					a: 0 + $row.hasClass(`dm-init-row-active`),
					s: $row.find(`input.source`).val(),
					c: $conds.length ? $conds.map((i, e) => $(e).data("getState")()).get() : [],
					v: $row.find(`.dm_init__btn_eye`).hasClass(`btn-primary`),
				};
				if (customName) out.m = customName;
				return out;
			}).get();
			return {
				r: rows,
				s: cfg.sort,
				d: cfg.dir,
				m: cfg.isRollHp,
				g: cfg.importIsRollGroups,
				p: cfg.importIsAddPlayers,
				a: cfg.importIsAppend,
				k: cfg.statsAddColumns,
				piHp: cfg.playerInitShowExactPlayerHp,
				piHm: cfg.playerInitShowExactMonsterHp,
				piV: cfg.playerInitHideNewMonster,
				piO: cfg.playerInitShowOrdinals,
				c: cfg.statsCols.filter(it => !it.isDeleted),
				n: $iptRound.val(),
			};
		}

		function getPlayerFriendlyState () {
			const visibleStatsCols = cfg.statsCols.filter(it => !it.isDeleted && it.v).map(({id, a, o, v}) => ({id, a, o, v})); // id, abbreviation, order, visibility mode (delete this later)

			const rows = $wrpEntries.find(`.dm-init-row`).map((i, e) => {
				const $row = $(e);

				// if the row is player-hidden
				if (!$row.find(`.dm_init__btn_eye`).hasClass(`btn-primary`)) return false;

				const isMonster = !!$row.find(`.init-wrp-creature`).length;

				const statCols = getStatColsState($row);
				const statsVals = statCols.map(it => {
					const mappedCol = visibleStatsCols.find(sc => sc.id === it.id);
					if (mappedCol) {
						if (mappedCol.v === 1 || !isMonster) return it;
						else return {u: true}; // "unknown"
					} else return null;
				}).filter(Boolean);

				const $conds = $row.find(`.init__cond`);

				const out = {
					n: $row.find(`input.name`).val(),
					i: $row.find(`input.score`).val(),
					a: 0 + $row.hasClass(`dm-init-row-active`),
					c: $conds.length ? $conds.map((i, e) => $(e).data("getState")()).get() : [],
					k: statsVals,
				};

				if ($row.hasClass("dm-init-row-rename")) out.m = $row.find(`.dm-init-row-link-name`).text();

				const hp = Number($row.find(`input.hp`).val());
				const hpMax = Number($row.find(`input.hp-max`).val());
				if ((!isMonster && cfg.playerInitShowExactPlayerHp) || (isMonster && cfg.playerInitShowExactMonsterHp)) {
					out.h = hp;
					out.g = hpMax;
				} else {
					out.hh = isNaN(hp) || isNaN(hpMax) ? -1 : InitiativeTrackerUtil.getWoundLevel(100 * hp / hpMax);
				}
				if (cfg.playerInitShowOrdinals) out.o = $row.find(`.dm_init__number`).attr("data-number");

				return out;
			}).get().filter(Boolean);
			visibleStatsCols.forEach(it => delete it.v); // clean up any visibility mode flags
			return {
				r: rows,
				c: visibleStatsCols,
				n: $iptRound.val(),
			};
		}

		$wrpTracker.data("getState", getSaveableState);
		$wrpTracker.data("getSummary", () => {
			const nameList = $wrpEntries.find(`.dm-init-row`).map((i, e) => $(e).find(`input.name`).val()).get();
			const nameListFilt = nameList.filter(it => it.trim());
			return `${nameList.length} creature${nameList.length === 1 ? "" : "s"} ${nameListFilt.length ? `(${nameListFilt.slice(0, 3).join(", ")}${nameListFilt.length > 3 ? "..." : ""})` : ""}`;
		});

		function shiftActiveRow (direction) {
			const $rows = $wrpEntries.find(`.dm-init-row`);

			const $rowsActive = $rows.filter(`.dm-init-row-active`);

			(~direction ? $rowsActive.get() : $rowsActive.get().reverse())
				.forEach(e => {
					const $e = $(e);

					if (~direction) {
						// tick down any conditions
						const $conds = $e.find(`.init__cond`);
						if ($conds.length) $conds.each((i, e) => $(e).data("doTickDown")());
					}

					$e.removeClass(`dm-init-row-active`);
				});

			let ix = $rows.index($rowsActive.get(~direction ? $rowsActive.length - 1 : 0)) + direction;

			const nxt = $rows.get(ix);
			ix += direction;
			if (nxt) {
				const $nxt = $(nxt);
				let $curr = $nxt;
				do {
					// if names and initiatives are the same, skip forwards (groups of monsters)
					if ($curr.find(`input.name`).val() === $nxt.find(`input.name`).val()
						&& $curr.find(`input.score`).val() === $nxt.find(`input.score`).val()) {
						handleTurnStart($curr);
						const curr = $rows.get(ix);
						ix += direction;
						if (curr) $curr = $(curr);
						else $curr = null;
					} else break;
				} while ($curr);
			} else checkSetFirstActive();
			doUpdateExternalStates();
		}

		function setNextActive () { shiftActiveRow(1); }
		function setPrevActive () { shiftActiveRow(-1); }

		function handleTurnStart ($row) {
			$row.addClass(`dm-init-row-active`);
			if (cfg.statsAddColumns) {
				const cbMetas = cfg.statsCols.filter(c => c.p && (InitiativeTracker.isCheckboxColAuto(c.p)));

				cbMetas.forEach(c => {
					const $lbl = $row.find(`[data-id=${c.id}]`);
					if (c.p === "cbAutoLow") {
						$lbl.find(`input`).prop("checked", false);
					} else if (c.p === "cbAutoHigh") {
						$lbl.find(`input`).prop("checked", true);
					}
				});
			}
		}

		async function pMakeRow (opts) {
			let {
				nameOrMeta,
				customName,
				hp,
				hpMax,
				init,
				isActive,
				source,
				conditions,
				isRollInit,
				isRollHp,
				statsCols,
				isVisible,
			} = Object.assign({
				nameOrMeta: "",
				customName: "",
				hp: "",
				hpMax: "",
				init: "",
				conditions: [],
				isRollInit: cfg.isRollInit,
				isRollHp: false,
				isVisible: !cfg.playerInitHideNewMonster,
			}, opts || {});

			const isMon = !!source;
			if (nameOrMeta instanceof Object) {
				// unpack saved
				nameOrMeta.name = nameOrMeta.name || nameOrMeta.n;
				nameOrMeta.displayName = nameOrMeta.displayName || nameOrMeta.d;
				nameOrMeta.scaledToCr = nameOrMeta.scaledToCr || (nameOrMeta.scr ? Number(nameOrMeta.scr) : null);
				nameOrMeta.scaledToSummonSpellLevel = nameOrMeta.scaledToSummonSpellLevel || (nameOrMeta.ssp ? Number(nameOrMeta.ssp) : null);
				nameOrMeta.scaledToSummonClassLevel = nameOrMeta.scaledToSummonClassLevel || (nameOrMeta.scl ? Number(nameOrMeta.scl) : null);
			}
			const displayName = nameOrMeta instanceof Object ? nameOrMeta.displayName : null;
			const name = nameOrMeta instanceof Object ? nameOrMeta.name : nameOrMeta;

			const $wrpRow = $(`<div class="dm-init-row ${isActive ? "dm-init-row-active" : ""} overflow-hidden"/>`);

			const $wrpLhs = $(`<div class="dm-init-row-lhs"/>`).appendTo($wrpRow);
			const $iptName = $(`<input class="form-control input-sm name dm-init-name dm-init-lockable dm-init-row-input ${isMon ? "hidden" : ""}" placeholder="Name">`)
				.disableSpellcheck()
				.val(name)
				.appendTo($wrpLhs);
			$iptName.on("change", () => {
				doSort(ALPHA);
				doUpdateExternalStates();
			});
			if (isMon) {
				const $rows = $wrpEntries.find(`.dm-init-row`);
				const curMon = $rows.find(".init-wrp-creature").filter((i, e) => $(e).parent().find(`input.name`).val() === name && $(e).parent().find(`input.source`).val() === source);
				let monNum = null;
				if (curMon.length) {
					const $dispsNumber = curMon.map((i, e) => $(e).find(`span[data-number]`).data("number"));
					if (curMon.length === 1 && !$dispsNumber.length) {
						const r = $(curMon.get(0));
						r.find(`.init-wrp-creature-link`).append(`<span data-number="1" class="dm_init__number">(1)</span>`);
						monNum = 2;
					} else {
						monNum = $dispsNumber.get().reduce((a, b) => Math.max(Number(a), Number(b)), 0) + 1;
					}
				}

				const getLink = () => {
					if (typeof nameOrMeta === "string" || (nameOrMeta.scaledToCr == null && nameOrMeta.scaledToSummonSpellLevel == null && nameOrMeta.scaledToSummonClassLevel == null)) return Renderer.get().render(`{@creature ${name}|${source}}`);
					else {
						const parts = [name, source, displayName, nameOrMeta.scaledToCr != null ? `${VeCt.HASH_SCALED}=${Parser.numberToCr(nameOrMeta.scaledToCr)}` : nameOrMeta.scaledToSummonSpellLevel != null ? `${VeCt.HASH_SCALED_SPELL_SUMMON}=${nameOrMeta.scaledToSummonSpellLevel}` : nameOrMeta.scaledToSummonClassLevel != null ? `${VeCt.HASH_SCALED_CLASS_SUMMON}=${nameOrMeta.scaledToSummonClassLevel}` : null];
						return Renderer.get().render(`{@creature ${parts.join("|")}}`);
					}
				};

				const $monName = $(`
					<div class="init-wrp-creature split">
						<span class="init-wrp-creature-link">
							${$(getLink()).attr("tabindex", "-1")[0].outerHTML}
							${monNum ? ` <span data-number="${monNum}" class="dm_init__number">(${monNum})</span>` : ""}
						</span>
					</div>
				`).appendTo($wrpLhs);

				const setCustomName = (name) => {
					$monName.find(`a`).addClass("dm-init-row-link-name").text(name);
					$wrpRow.addClass("dm-init-row-rename");
				};

				if (customName) setCustomName(customName);

				const $wrpBtnsRhs = $(`<div/>`).appendTo($monName);
				$(`<button class="btn btn-default btn-xs dm-init-lockable" title="Rename" tabindex="-1"><span class="glyphicon glyphicon-pencil"></span></button>`)
					.click(async () => {
						if (cfg.isLocked) return;
						const nuName = await InputUiUtil.pGetUserString({title: "Enter Name"});
						if (nuName == null || !nuName.trim()) return;
						setCustomName(nuName);
						doSort(cfg.sort);
					}).appendTo($wrpBtnsRhs);
				$(`<button class="btn btn-success btn-xs dm-init-lockable" title="Add Another (SHIFT for Roll New)" tabindex="-1"><span class="glyphicon glyphicon-plus"></span></button>`)
					.click(async (evt) => {
						if (cfg.isLocked) return;
						await pMakeRow({
							nameOrMeta,
							init: evt.shiftKey ? "" : $iptScore.val(),
							isActive: !evt.shiftKey && $wrpRow.hasClass("dm-init-row-active"),
							source,
							isRollHp: cfg.isRollHp,
							statsCols: evt.shiftKey ? null : getStatColsState($wrpRow),
							isVisible: $wrpRow.find(`.dm_init__btn_eye`).hasClass("btn-primary"),
						});
						doSort(cfg.sort);
					}).appendTo($wrpBtnsRhs);

				$(`<input class="source hidden" value="${source}">`).appendTo($wrpLhs);

				if (nameOrMeta instanceof Object && (nameOrMeta.scaledToCr != null || nameOrMeta.scaledToSummonSpellLevel != null || nameOrMeta.scaledToSummonClassLevel != null)) {
					$(`<input class="displayName hidden" value="${displayName}">`).appendTo($wrpLhs);
					if (nameOrMeta.scaledToCr != null) $(`<input class="scaledCr hidden" value="${nameOrMeta.scaledToCr}">`).appendTo($wrpLhs);
					if (nameOrMeta.scaledToSummonSpellLevel != null) $(`<input class="scaledSummonSpellLevel hidden" value="${nameOrMeta.scaledToSummonSpellLevel}">`).appendTo($wrpLhs);
					if (nameOrMeta.scaledToSummonClassLevel != null) $(`<input class="scaledSummonClassLevel hidden" value="${nameOrMeta.scaledToSummonClassLevel}">`).appendTo($wrpLhs);
				}
			}

			function addCondition (name, color, turns) {
				const $cond = InitiativeTrackerUtil.get$condition({
					name,
					color,
					turns,
					onStateChange: () => doUpdateExternalStates(),
				});
				$cond.appendTo($conds);
			}

			const $wrpConds = $(`<div class="split"/>`).appendTo($wrpLhs);
			const $conds = $(`<div class="init__wrp_conds"/>`).appendTo($wrpConds);
			$(`<button class="btn btn-warning btn-xs dm-init-row-btn dm-init-row-btn-flag" title="Add Condition" tabindex="-1"><span class="glyphicon glyphicon-flag"/></button>`)
				.appendTo($wrpConds)
				.on("click", () => {
					const {$modalInner, doClose} = UiUtil.getShowModal({isMinHeight0: true});

					const $wrpRows = $(`<div class="dm-init-modal-wrp-rows"/>`).appendTo($modalInner);

					const conds = InitiativeTrackerUtil.CONDITIONS;
					for (let i = 0; i < conds.length; i += 3) {
						const $row = $(`<div class="ve-flex-v-center mb-2"/>`).appendTo($wrpRows);
						const populateCol = (cond) => {
							const $col = $(`<div class="col-4 text-center"/>`).appendTo($row);
							if (cond) {
								$(`<button class="btn btn-default btn-xs btn-dm-init-cond" style="background-color: ${cond.color} !important;">${cond.name}</button>`).appendTo($col).click(() => {
									$iptName.val(cond.name);
									$iptColor.val(cond.color);
								});
							}
						};
						[conds[i], conds[i + 1], conds[i + 2]].forEach(populateCol);
					}

					$wrpRows.append(`<hr>`);

					$(`<div class="ve-flex-v-center mb-2">
						<div class="col-5 pr-2">Name (optional)</div>
						<div class="col-2 text-center">Color</div>
						<div class="col-5 pl-2">Duration (optional)</div>
					</div>`).appendTo($wrpRows);
					const $controls = $(`<div class="ve-flex-v-center mb-2"/>`).appendTo($wrpRows);
					const [$wrpName, $wrpColor, $wrpTurns] = ["pr-2", "", "pl-2"].map(it => $(`<div class="col-${it ? 5 : 2} ${it} text-center"/>`).appendTo($controls));
					const $iptName = $(`<input class="form-control">`)
						.on("keydown", (e) => {
							if (e.which === 13) $btnAdd.click();
						})
						.appendTo($wrpName);
					const $iptColor = $(`<input class="form-control" type="color" value="${MiscUtil.randomColor()}">`).appendTo($wrpColor);
					const $iptTurns = $(`<input class="form-control" type="number" step="1" min="1" placeholder="Unlimited">`)
						.on("keydown", (e) => {
							if (e.which === 13) $btnAdd.click();
						})
						.appendTo($wrpTurns);
					const $wrpAdd = $(`<div class="ve-flex-v-center">`).appendTo($wrpRows);
					const $wrpAddInner = $(`<div class="col-12 text-center">`).appendTo($wrpAdd);
					const $btnAdd = $(`<button class="btn btn-primary">Set Condition</button>`)
						.click(() => {
							addCondition($iptName.val().trim(), $iptColor.val(), $iptTurns.val());
							doClose();
						})
						.appendTo($wrpAddInner);
				});

			$(`<div class="dm-init-row-mid"/>`).appendTo($wrpRow);

			const $wrpRhs = $(`<div class="dm-init-row-rhs"/>`).appendTo($wrpRow);
			const hpVals = {
				curHp: hp,
				maxHp: hpMax,
			};

			const doUpdateHpColors = () => {
				const woundLevel = InitiativeTrackerUtil.getWoundLevel(100 * Number($iptHp.val()) / Number($iptHpMax.val()));
				if (~woundLevel) {
					const woundMeta = InitiativeTrackerUtil.getWoundMeta(woundLevel);
					$iptHp.css("color", woundMeta.color);
					$iptHpMax.css("color", woundMeta.color);
				} else {
					$iptHp.css("color", "");
					$iptHpMax.css("color", "");
				}
			};

			const $iptHp = $(`<input class="form-control input-sm hp dm-init-row-input text-right dm_init__hp dm_init__hp--current" value="${hpVals.curHp}">`)
				.change(() => {
					handleMathInput($iptHp, "curHp");
					doUpdateExternalStates();
					doUpdateHpColors();
				})
				.click(() => $iptHp.select())
				.appendTo($wrpRhs);
			$wrpRhs.append(`<div class="dm_init__hp_slash">/</div>`);
			const $iptHpMax = $(`<input class="form-control input-sm hp-max dm-init-row-input dm_init__hp dm_init__hp--max" value="${hpVals.maxHp}">`)
				.change(() => {
					handleMathInput($iptHpMax, "maxHp");
					doUpdateExternalStates();
					doUpdateHpColors();
				})
				.click(() => $iptHpMax.select())
				.appendTo($wrpRhs);

			doUpdateHpColors();

			const $iptScore = $(`<input class="form-control input-sm score dm-init-lockable dm-init-row-input text-center dm_init__ipt--rhs" type="number">`)
				.on("change", () => doSort(NUM))
				.click(() => $iptScore.select())
				.val(init)
				.appendTo($wrpRhs);

			if (isMon && (hpVals.curHp === "" || hpVals.maxHp === "" || init === "")) {
				const doUpdate = async () => {
					const m = await DataLoader.pCacheAndGet(UrlUtil.PG_BESTIARY, source, hash);

					// set or roll HP
					if (!isRollHp && m.hp.average) {
						hpVals.curHp = hpVals.maxHp = m.hp.average;
						$iptHp.val(hpVals.curHp);
						$iptHpMax.val(hpVals.maxHp);
					} else if (isRollHp && m.hp.formula) {
						const roll = await Renderer.dice.pRoll2(m.hp.formula, {
							isUser: false,
							name: getRollName(m),
							label: "HP",
						}, {isResultUsed: true});
						hpVals.curHp = hpVals.maxHp = roll;
						$iptHp.val(roll);
						$iptHpMax.val(roll);
					}

					// roll initiative
					if (!init && isRollInit) {
						$iptScore.val(await pRollInitiative(m));
					}

					doUpdateHpColors();
				};

				const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BESTIARY]({name: name, source: source});
				await doUpdate();
			}

			const handleMathInput = ($ipt, prop) => {
				const nxt = $ipt.val().trim();
				if (nxt && /^[-+0-9]*$/.exec(hpVals[prop]) && /^[-+0-9]*$/.exec(nxt)) {
					const m = /^[+-]\d+/.exec(nxt);
					const parts = nxt.split(/([+-]\d+)/).filter(it => it);
					let temp = 0;
					parts.forEach(p => temp += Number(p));
					if (m) {
						hpVals[prop] = Number(hpVals[prop]) + temp;
					} else if (/[-+]/.exec(nxt)) {
						hpVals[prop] = temp;
					} else {
						hpVals[prop] = Number(nxt);
					}
					$ipt.val(hpVals[prop]);
				} else hpVals[prop] = nxt;
			};

			InitiativeTracker.get$btnPlayerVisible(isVisible, doUpdateExternalStates, false, "dm-init-row-btn", "dm_init__btn_eye")
				.appendTo($wrpRhs);

			$(`<button class="btn btn-danger btn-xs dm-init-row-btn dm-init-lockable" title="Delete" tabindex="-1"><span class="glyphicon glyphicon-trash"/></button>`)
				.appendTo($wrpRhs)
				.on("click", () => {
					if (cfg.isLocked) return;
					if ($wrpRow.hasClass(`dm-init-row-active`) && $wrpEntries.find(`.dm-init-row`).length > 1) setNextActive();
					$wrpRow.remove();
					doUpdateExternalStates();
				});

			populateRowStatCols($wrpRow, statsCols);
			conditions.forEach(c => addCondition(c.name, c.color, c.turns));
			$wrpRow.appendTo($wrpEntries);

			doUpdateExternalStates();

			return $wrpRow;
		}

		const populateRowStatCols = ($row, statsCols) => {
			const $mid = $row.find(`.dm-init-row-mid`);

			if (!cfg.statsAddColumns) return $mid.empty();

			const name = $row.find(`.name`).val();
			const source = $row.find(`.source`).val();
			const isMon = !!source;

			const existing = (() => {
				const existing = {};
				if (statsCols) {
					statsCols.forEach(it => existing[it.id] = {id: it.id, v: it.v});
				} else {
					$mid.find(`.dm_init__stat`).each((i, e) => {
						const $e = $(e);
						const id = $e.attr("data-id");
						const $ipt = $e.find(`input`);

						// avoid race conditions -- the input is still to be populated
						if ($ipt.attr("populate-running") === "true") return;

						const isCb = $ipt.attr("type") === "checkbox";
						existing[id] = {
							v: isCb ? $ipt.prop("checked") : $ipt.val(),
							id,
						};
					});
				}
				return existing;
			})();

			$mid.empty();

			cfg.statsCols.forEach(c => {
				const isCheckbox = c.p && (InitiativeTracker.isCheckboxCol(c.p));
				const $ipt = (() => {
					if (isCheckbox) {
						const $cb = $(`<input type="checkbox" class="dm_init__stat_ipt" ${!cfg.isLocked && (c.e || !isMon) ? "" : "disabled"}>`)
							.change(() => doUpdateExternalStates());

						const populate = () => {
							const meta = InitiativeTracker.STAT_COLUMNS[c.p];
							$cb.prop("checked", meta.get());
							doUpdateExternalStates();
						};

						if (c.p && c.po && isMon) { // on changing populate type, re-populate
							populate();
						} else if (existing[c.id]) { // otherwise (or for players) use existing value
							$cb.prop("checked", existing[c.id].v);
						} else if (c.p) { // otherwise, populate
							populate();
						}

						return $cb;
					} else {
						const $ipt = $(`<input class="form-control input-sm dm_init__stat_ipt text-center" ${!cfg.isLocked && (c.e || !isMon) ? "" : "disabled"}>`)
							.change(() => doUpdateExternalStates());

						const populateFromBlock = () => {
							const meta = InitiativeTracker.STAT_COLUMNS[c.p];
							if (isMon && meta) {
								$ipt.attr("populate-running", true);
								const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BESTIARY]({name: name, source: source});
								const populateStats = async () => {
									const mon = await DataLoader.pCacheAndGet(UrlUtil.PG_BESTIARY, source, hash);
									$ipt.val(meta.get(mon));
									$ipt.removeAttr("populate-running");
									doUpdateExternalStates();
								};
								populateStats();
							}
						};

						if (c.p && c.po && isMon) { // on changing populate type, re-populate
							populateFromBlock();
						} else if (existing[c.id]) { // otherwise (or for players) use existing value
							$ipt.val(existing[c.id].v);
						} else if (c.p) { // otherwise, populate
							populateFromBlock();
						}
						return $ipt;
					}
				})();

				const eleType = isCheckbox ? "label" : "div";
				$$`<${eleType} class="dm_init__stat ${isCheckbox ? "ve-flex-vh-center" : ""}" data-id="${c.id}">${$ipt}</${eleType}>`.appendTo($mid);
			});
		};

		const handleStatColsChange = () => {
			// remove any deleted records; apply order
			cfg.statsCols = cfg.statsCols.filter(it => !it.isDeleted).sort((a, b) => a.o - b.o);

			const $wrpHead = $wrpHeader.find(`.dm-init-row-mid`).empty();

			if (cfg.statsAddColumns) {
				cfg.statsCols.forEach(c => {
					$wrpHead.append(`<div class="dm_init__stat_head" ${c.p && InitiativeTracker.STAT_COLUMNS[c.p] ? `title="${InitiativeTracker.STAT_COLUMNS[c.p].name}"` : ""}>${c.a || ""}</div>`);
				});
			}

			const $rows = $wrpEntries.find(`.dm-init-row`);
			$rows.each((i, e) => populateRowStatCols($(e)));
			cfg.statsCols.forEach(c => c.po = null);
		};

		function checkSetFirstActive ({isSkipUpdateRound = false} = {}) {
			if ($wrpEntries.find(`.dm-init-row`).length && !$wrpEntries.find(`.dm-init-row-active`).length) {
				const $rows = $wrpEntries.find(`.dm-init-row`);
				const $first = $($rows.get(0));
				handleTurnStart($first);
				if ($rows.length > 1) {
					for (let i = 1; i < $rows.length; ++i) {
						const $nxt = $($rows.get(i));
						if ($nxt.find(`input.name`).val() === $first.find(`input.name`).val()
							&& $nxt.find(`input.score`).val() === $first.find(`input.score`).val()) {
							handleTurnStart($nxt);
						} else break;
					}
				}

				if (!isSkipUpdateRound) $iptRound.val(Number($iptRound.val() || 0) + 1);

				doUpdateExternalStates();
			}
		}

		function doSort (mode) {
			if (cfg.sort !== mode) return;
			const sorted = $wrpEntries.find(`.dm-init-row`).sort((a, b) => {
				let aVal;
				let bVal;

				if (cfg.sort === ALPHA && $(a).hasClass("dm-init-row-rename")) {
					aVal = $(a).find(".dm-init-row-link-name").text();
				} else aVal = $(a).find(`input.${cfg.sort === ALPHA ? "name" : "score"}`).val();
				if (cfg.sort === ALPHA && $(b).hasClass("dm-init-row-rename")) {
					bVal = $(b).find(".dm-init-row-link-name").text();
				} else bVal = $(b).find(`input.${cfg.sort === ALPHA ? "name" : "score"}`).val();

				let first = 0;
				let second = 0;
				if (cfg.sort === NUM) {
					aVal = Number(aVal);
					bVal = Number(bVal);
					first = cfg.dir === ASC ? SortUtil.ascSort(aVal, bVal) : SortUtil.ascSort(bVal, aVal);
				} else {
					let aVal2 = 0;
					let bVal2 = 0;

					const $aNum = $(a).find(`span[data-number]`);
					if ($aNum.length) aVal2 = $aNum.data("number");
					const $bNum = $(b).find(`span[data-number]`);
					if ($bNum.length) bVal2 = $bNum.data("number");

					first = cfg.dir === ASC ? SortUtil.ascSortLower(aVal, bVal) : SortUtil.ascSortLower(bVal, aVal);
					second = cfg.dir === ASC ? SortUtil.ascSort(aVal2, bVal2) : SortUtil.ascSort(bVal2, aVal2);
				}
				return first || second;
			});
			$wrpEntries.append(sorted);
			doUpdateExternalStates();
		}

		function flipDir () {
			cfg.dir = cfg.dir === ASC ? DESC : ASC;
		}

		function doReset () {
			$wrpEntries.empty();
			cfg.sort = NUM;
			cfg.dir = DESC;
			$(`.dm_init__rounds`).val(1);
			doUpdateExternalStates();
		}

		let firstLoad = true;
		async function pLoadState (state, noReset) {
			if (!firstLoad && !noReset) doReset();
			firstLoad = false;

			for (const row of (state.r || [])) {
				await pMakeRow({
					nameOrMeta: row.n,
					customName: row.m,
					hp: row.h,
					hpMax: row.g,
					init: row.i,
					isActive: row.a,
					source: row.s,
					conditions: row.c,
					statsCols: row.k,
					isVisible: row.v,
					isRollInit: row.i == null && cfg.isRollInit,
				});
			}

			doSort(cfg.sort);
			checkSetFirstActive({isSkipUpdateRound: true});
			handleStatColsChange();
			doUpdateExternalStates();
			if (!firstLoad && !noReset) $(`.dm_init__rounds`).val(1);
		}

		function getRollName (monster) {
			return `Initiative Tracker \u2014 ${monster.name}`;
		}

		function pRollInitiative (monster) {
			return Renderer.dice.pRoll2(`1d20${Parser.getAbilityModifier(monster.dex)}`, {
				isUser: false,
				name: getRollName(monster),
				label: "Initiative",
			}, {isResultUsed: true});
		}

		async function pGetOrRollHp (monster) {
			if (!cfg.isRollHp && monster.hp.average) {
				return `${monster.hp.average}`;
			} else if (cfg.isRollHp && monster.hp.formula) {
				return `${await Renderer.dice.pRoll2(monster.hp.formula, {
					isUser: false,
					name: getRollName(monster),
					label: "HP",
				}, {isResultUsed: true})}`;
			}
			return "";
		}

		async function pDoLoadEncounter ({entityInfos, encounterInfo}) {
			const toLoad = {
				s: "NUM",
				d: "DESC",
				m: false,
				g: true,
				r: [],
			};

			if (cfg.importIsAddPlayers) {
				if (encounterInfo.isAdvanced) { // advanced encounter builder
					if (encounterInfo.playersAdvanced) {
						const colNameIndex = {};
						encounterInfo.colsExtraAdvanced = encounterInfo.colsExtraAdvanced || [];
						if (encounterInfo.colsExtraAdvanced.length) cfg.statsAddColumns = true;

						encounterInfo.colsExtraAdvanced.forEach((col, i) => colNameIndex[i] = (col?.name || "").toLowerCase());

						// mark all old stats cols for deletion
						cfg.statsCols.forEach(col => col.isDeleted = true);

						const colIndex = {};
						let hpIndex = null;
						encounterInfo.colsExtraAdvanced.forEach((col, i) => {
							let colName = col?.name || "";
							if (colName.toLowerCase() === "hp") {
								hpIndex = i;
								return;
							}
							const populateEntry = Object.entries(InitiativeTracker.STAT_COLUMNS).find(([_, v]) => v.abv && v.abv.toLowerCase() === colName.toLowerCase());

							const newCol = {
								id: CryptUtil.uid(),
								e: true, // editable
								v: 2, // is player-visible (0 = none, 1 = all, 2 = player units only)
								o: i, // order

								// input data
								p: populateEntry ? populateEntry[0] : "", // populate with...
								po: null, // populate with... (previous value)
								a: colName, // abbreviation
							};
							colIndex[i] = newCol;
							cfg.statsCols.push(newCol);
						});

						encounterInfo.playersAdvanced.forEach(playerDetails => {
							const row = {
								n: playerDetails.name || "", // name
								i: "", // score
								a: 0, // is active?
								c: [], // conditions
								v: true,
							};

							if (playerDetails.extras?.length) { // extra stats
								row.k = playerDetails.extras.map((extra, i) => {
									const val = extra?.value || "";
									if (i === hpIndex) return null;
									return {id: colIndex[i].id, v: val || ""};
								}).filter(Boolean);

								if (hpIndex != null) {
									[row.h, row.g] = (playerDetails.extras[hpIndex]?.value || "")
										.split("/")
										.map(it => it.trim());
									if (row.g == null) row.g = row.h;
								} else row.h = row.g = "";
							} else row.h = row.g = "";

							toLoad.r.push(row);
						});
					}
				} else {
					if (encounterInfo.playersSimple) {
						encounterInfo.playersSimple.forEach(playerGroup => {
							[...new Array(playerGroup.count || 1)].forEach(() => {
								toLoad.r.push({
									n: ``,
									h: "",
									g: "",
									i: "",
									a: 0,
									c: [],
									v: true,
								});
							});
						});
					}
				}
			}

			if (entityInfos?.length) {
				await entityInfos
					.filter(Boolean)
					.pSerialAwaitMap(async it => {
						const groupInit = cfg.importIsRollGroups && cfg.isRollInit ? await pRollInitiative(it.entity) : null;
						const groupHp = cfg.importIsRollGroups ? await pGetOrRollHp(it.entity) : null;

						await Promise.all([...new Array(it.count || 1)].map(async () => {
							const hp = `${cfg.importIsRollGroups ? groupHp : await pGetOrRollHp(it.entity)}`;
							toLoad.r.push({
								n: {
									name: it.entity.name,
									displayName: it.entity._displayName,
									scaledToCr: it.entity._scaledCr,
									scaledToSummonSpellLevel: it.entity._summonedBySpell_level,
									scaledToSummonClassLevel: it.entity._summonedByClass_level,
								},
								i: cfg.isRollInit ? `${cfg.importIsRollGroups ? groupInit : await pRollInitiative(it.entity)}` : null,
								a: 0,
								s: it.entity.source,
								c: [],
								h: hp,
								g: hp,
							});
						}));
					});
			}

			await pLoadState(toLoad, cfg.importIsAppend);
		}

		$wrpTracker.data("pDoLoadEncounter", ({entityInfos, encounterInfo}) => pDoLoadEncounter({entityInfos, encounterInfo}));

		pLoadState(state)
			.then(() => doSort(cfg.sort));

		return $wrpTracker;
	}

	static get$btnPlayerVisible (isVisible, fnOnClick, isTriState, ...additionalClasses) {
		let isVisNum = Number(isVisible || false);

		const getTitle = () => isVisNum === 0 ? `Hidden in player view` : isVisNum === 1 ? `Shown in player view` : `Shown in player view on player characters, hidden in player view on monsters`;
		const getClasses = () => `${isVisNum === 0 ? `btn-default` : isVisNum === 1 ? `btn-primary` : `btn-primary btn-primary--half`} btn btn-xs ${additionalClasses.join(" ")}`;
		const getIconClasses = () => isVisNum === 0 ? `glyphicon glyphicon-eye-close` : `glyphicon glyphicon-eye-open`;

		const $dispIcon = $(`<span class="glyphicon ${getIconClasses()}"/>`);
		const $btnVisible = $$`<button class="${getClasses()}" title="${getTitle()}" tabindex="-1">${$dispIcon}</button>`
			.on("click", () => {
				if (isVisNum === 0) isVisNum++;
				else if (isVisNum === 1) isVisNum = isTriState ? 2 : 0;
				else if (isVisNum === 2) isVisNum = 0;

				$btnVisible.title(getTitle());
				$btnVisible.attr("class", getClasses());
				$dispIcon.attr("class", getIconClasses());

				fnOnClick();
			});
		return $btnVisible;
	}

	static isCheckboxCol (key) {
		return key === "cbAutoLow" || key === "cbNeutral" || key === "cbAutoHigh";
	}

	static isCheckboxColAuto (key) {
		return key === "cbAutoLow" || key === "cbAutoHigh";
	}

	/**
	 * @param opts
	 * @param opts.p2pMetaV1
	 * @param opts.doUpdateExternalStates
	 * @param [opts.$btnStartServer]
	 * @param [opts.$btnGetToken]
	 * @param [opts.$btnGetLink]
	 * @param [opts.fnDispServerStoppedState]
	 * @param [opts.fnDispServerRunningState]
	 */
	static async _startServerV1 (opts) {
		opts = opts || {};

		if (opts.p2pMetaV1.serverPeer) {
			await opts.p2pMetaV1.serverPeer.pInit();
			return true;
		}

		try {
			if (opts.$btnStartServer) opts.$btnStartServer.prop("disabled", true);
			opts.p2pMetaV1.serverPeer = new PeerVeServer();
			await opts.p2pMetaV1.serverPeer.pInit();
			if (opts.$btnGetToken) opts.$btnGetToken.prop("disabled", false);
			if (opts.$btnGetLink) opts.$btnGetLink.prop("disabled", false);

			opts.p2pMetaV1.serverPeer.on("connection", connection => {
				const pConnected = new Promise(resolve => {
					connection.on("open", () => {
						resolve(true);
						opts.doUpdateExternalStates();
					});
				});
				const pTimeout = MiscUtil.pDelay(5 * 1000, false);
				Promise.race([pConnected, pTimeout])
					.then(didConnect => {
						if (!didConnect) {
							JqueryUtil.doToast({content: `Connecting to "${connection.label.escapeQuotes()}" has taken more than 5 seconds! The connection may need to be re-attempted.`, type: "warning"});
						}
					});
			});

			$(window).on("beforeunload", evt => {
				const message = `The connection will be closed`;
				(evt || window.event).message = message;
				return message;
			});

			if (opts.fnDispServerRunningState) opts.fnDispServerRunningState();

			return true;
		} catch (e) {
			if (opts.fnDispServerStoppedState) opts.fnDispServerStoppedState();
			if (opts.$btnStartServer) opts.$btnStartServer.prop("disabled", false);
			opts.p2pMetaV1.serverPeer = null;
			JqueryUtil.doToast({content: `Failed to start server! ${VeCt.STR_SEE_CONSOLE}`, type: "danger"});
			setTimeout(() => { throw e; });
		}

		return false;
	}

	static _handleClick_playerWindowV1 ({board, cfg, p2pMetaV1, doUpdateExternalStates}) {
		const {$modalInner} = UiUtil.getShowModal({
			title: "Configure Player View",
			isUncappedHeight: true,
			isHeight100: true,
			cbClose: () => {
				if (p2pMetaV1.rows.length) p2pMetaV1.rows.forEach(row => row.$row.detach());
				if (p2pMetaV1.serverPeer) p2pMetaV1.serverPeer.offTemp("connection");
			},
		});

		const $wrpHelp = UiUtil.$getAddModalRow($modalInner, "div");

		const fnDispServerStoppedState = () => {
			$btnStartServer.html(`<span class="glyphicon glyphicon-play"/> Start Server`).prop("disabled", false);
			$btnGetToken.prop("disabled", true);
			$btnGetLink.prop("disabled", true);
		};

		const fnDispServerRunningState = () => {
			$btnStartServer.html(`<span class="glyphicon glyphicon-play"/> Server Running`).prop("disabled", true);
			$btnGetToken.prop("disabled", false);
			$btnGetLink.prop("disabled", false);
		};

		const $btnStartServer = $(`<button class="btn btn-default mr-2"></button>`)
			.click(async () => {
				const isRunning = await this._startServerV1({p2pMetaV1, doUpdateExternalStates, $btnStartServer, $btnGetToken, $btnGetLink, fnDispServerStoppedState, fnDispServerRunningState});
				if (isRunning) {
					p2pMetaV1.serverPeer.onTemp("connection", showConnected);
					showConnected();
				}
			});

		const $btnGetToken = $(`<button class="btn btn-default mr-2" disabled><span class="glyphicon glyphicon-copy"/> Copy Token</button>`).appendTo($wrpHelp)
			.click(() => {
				MiscUtil.pCopyTextToClipboard(p2pMetaV1.serverPeer.token);
				JqueryUtil.showCopiedEffect($btnGetToken);
			});

		const $btnGetLink = $(`<button class="btn btn-default" disabled><span class="glyphicon glyphicon-link"/> Copy Link</button>`).appendTo($wrpHelp)
			.click(() => {
				const cleanOrigin = window.location.origin.replace(/\/+$/, "");
				const url = `${cleanOrigin}/inittrackerplayerview.html#v1:${p2pMetaV1.serverPeer.token}`;
				MiscUtil.pCopyTextToClipboard(url);
				JqueryUtil.showCopiedEffect($btnGetLink);
			});

		if (p2pMetaV1.serverPeer) fnDispServerRunningState();
		else fnDispServerStoppedState();

		$$`<div class="row w-100">
					<div class="col-12">
						<p>
						The Player View is part of a peer-to-peer system to allow players to connect to a DM's initiative tracker. Players should use the <a href="inittrackerplayerview.html">Initiative Tracker Player View</a> page to connect to the DM's instance. As a DM, the usage is as follows:
						<ol>
							<li>Start the server.</li>
							<li>Copy your link/token and share it with your players.</li>
							<li>Wait for them to connect!</li>
						</ol>
						</p>
						<p>${$btnStartServer}${$btnGetLink}${$btnGetToken}</p>
						<p><i>Please note that this system is highly experimental. Your experience may vary.</i></p>
					</div>
				</div>`.appendTo($wrpHelp);

		UiUtil.addModalSep($modalInner);

		const $wrpConnected = UiUtil.$getAddModalRow($modalInner, "div").addClass("flx-col");

		const showConnected = () => {
			if (!p2pMetaV1.serverPeer) return $wrpConnected.html(`<div class="w-100 ve-flex-vh-center"><i>No clients connected.</i></div>`);

			let stack = `<div class="w-100"><h5>Connected Clients:</h5><ul>`;
			p2pMetaV1.serverPeer.getActiveConnections()
				.map(it => it.label || "(Unknown)")
				.sort(SortUtil.ascSortLower)
				.forEach(it => stack += `<li>${it.escapeQuotes()}</li>`);
			stack += "</ul></div>";
			$wrpConnected.html(stack);
		};

		if (p2pMetaV1.serverPeer) p2pMetaV1.serverPeer.onTemp("connection", showConnected);

		showConnected();
	}

	// nop on receiving a message; we want to send only
	// TODO expand this, to allow e.g. players to set statuses or assign damage/healing (at DM approval?)
	static _playerWindowV0_DM_MESSAGE_RECEIVER = function () {};

	static _playerWindowV0_DM_ERROR_HANDLER = function (err) {
		if (!this.isClosed) {
			// TODO: this could be better at handling `err.error == "RTCError: User-Initiated Abort, reason=Close called"`
			JqueryUtil.doToast({
				content: `Server error:\n${err ? (err.message || err.error || err) : "(Unknown error)"}`,
				type: "danger",
			});
		}
	};

	static async _playerWindowV0_pGetServerTokens ({cfg, p2pMetaV0, rowMetas}) {
		const targetRows = rowMetas.filter(it => !it.isDeleted).filter(it => !it.isActive);
		if (targetRows.every(it => it.isActive)) {
			return JqueryUtil.doToast({
				content: "No rows require Server Token generation!",
				type: "warning",
			});
		}

		let anyInvalidNames = false;
		targetRows.forEach(r => {
			r.$iptName.removeClass("error-background");
			if (!r.$iptName.val().trim()) {
				anyInvalidNames = true;
				r.$iptName.addClass("error-background");
			}
		});
		if (anyInvalidNames) return;

		const names = targetRows.map(r => {
			r.isActive = true;

			r.$iptName.attr("disabled", true);
			r.$btnGenServerToken.attr("disabled", true);

			return r.$iptName.val();
		});

		if (p2pMetaV0.serverInfo) {
			await p2pMetaV0.serverInfo;

			const serverInfo = await PeerUtilV0.pInitialiseServersAddToExisting(
				names,
				p2pMetaV0.serverInfo,
				this._playerWindowV0_DM_MESSAGE_RECEIVER,
				this._playerWindowV0_DM_ERROR_HANDLER,
			);

			return targetRows.map((r, i) => {
				r.name = serverInfo[i].name;
				r.serverInfo = serverInfo[i];
				r.$iptTokenServer.val(serverInfo[i].textifiedSdp).attr("disabled", false);

				serverInfo[i].rowMeta = r;

				r.$iptTokenClient.attr("disabled", false);
				r.$btnAcceptClientToken.attr("disabled", false);

				return serverInfo[i].textifiedSdp;
			});
		} else {
			p2pMetaV0.serverInfo = (async () => {
				p2pMetaV0.serverInfo = await PeerUtilV0.pInitialiseServers(names, this._playerWindowV0_DM_MESSAGE_RECEIVER, this._playerWindowV0_DM_ERROR_HANDLER);

				targetRows.forEach((r, i) => {
					r.name = p2pMetaV0.serverInfo[i].name;
					r.serverInfo = p2pMetaV0.serverInfo[i];
					r.$iptTokenServer.val(p2pMetaV0.serverInfo[i].textifiedSdp).attr("disabled", false);

					p2pMetaV0.serverInfo[i].rowMeta = r;

					r.$iptTokenClient.attr("disabled", false);
					r.$btnAcceptClientToken.attr("disabled", false);
				});
			})();

			await p2pMetaV0.serverInfo;
			return targetRows.map(r => r.serverInfo.textifiedSdp);
		}
	}

	static _handleClick_playerWindowV0 ({board, cfg, p2pMetaV0, doUpdateExternalStates}) {
		const {$modalInner} = UiUtil.getShowModal({
			title: "Configure Player View",
			isUncappedHeight: true,
			isHeight100: true,
			cbClose: () => {
				if (p2pMetaV0.rows.length) p2pMetaV0.rows.forEach(row => row.$row.detach());
			},
		});

		const $wrpHelp = UiUtil.$getAddModalRow($modalInner, "div");
		const $btnAltGenAll = $(`<button class="btn btn-primary btn-text-insert">Generate All</button>`).click(() => $btnGenServerTokens.click());
		const $btnAltCopyAll = $(`<button class="btn btn-primary btn-text-insert">Copy Server Tokens</button>`).click(() => $btnCopyServers.click());
		$$`<div class="ve-flex w-100">
			<div class="col-12">
				<p>
				The Player View is part of a peer-to-peer (i.e., serverless) system to allow players to connect to a DM's initiative tracker. Players should use the <a href="inittrackerplayerview.html">Initiative Tracker Player View</a> page to connect to the DM's instance. As a DM, the usage is as follows:
				<ol>
						<li>Add the required number of players, and input (preferably unique) player names.</li>
						<li>Click "${$btnAltGenAll}," which will generate a "server token" per player. You can click "${$btnAltCopyAll}" to copy them all as a single block of text, or click on the "Server Token" values to copy them individually. Distribute these tokens to your players (via a messaging service of your choice; we recommend <a href="https://discordapp.com/">Discord</a>). Each player should paste their token into the <a href="inittrackerplayerview.html">Initiative Tracker Player View</a>, following the instructions provided therein.</li>
						<li>
							Get a resulting "client token" from each player via a messaging service of your choice. Then, either:
							<ol type="a">
								<li>Click the "Accept Multiple Clients" button, and paste in text containing multiple client tokens. <b>This will try to find tokens in <i>any</i> text, ignoring everything else.</b> Pasting a chatroom log (containing, for example, usernames and timestamps mixed with tokens) is the expected usage.</li>
								<li>Paste each token into the appropriate "Client Token" field and "Accept Client" on each. A token can be identified by the slugified player name in the first few characters.</li>
							</ol>
						</li>
					</ol>
				</p>
				<p>Once a player's client has been "accepted," it will receive updates from the DM's tracker. <i>Please note that this system is highly experimental. Your experience may vary.</i></p>
			</div>
		</div>`.appendTo($wrpHelp);

		UiUtil.addModalSep($modalInner);

		const $wrpTop = UiUtil.$getAddModalRow($modalInner, "div");

		const $btnAddClient = $(`<button class="btn btn-xs btn-primary" title="Add Client">Add Player</button>`).click(() => addClientRow());

		const $btnCopyServers = $(`<button class="btn btn-xs btn-primary" title="Copy any available server tokens to the clipboard">Copy Server Tokens</button>`)
			.click(async () => {
				const targetRows = p2pMetaV0.rows.filter(it => !it.isDeleted && !it.$iptTokenClient.attr("disabled"));
				if (!targetRows.length) {
					JqueryUtil.doToast({
						content: `No free server tokens to copy. Generate some!`,
						type: "warning",
					});
				} else {
					await MiscUtil.pCopyTextToClipboard(targetRows.map(it => it.$iptTokenServer.val()).join("\n\n"));
					JqueryUtil.showCopiedEffect($btnGenServerTokens);
				}
			});

		const $btnAcceptClients = $(`<button class="btn btn-xs btn-primary" title="Open a prompt into which text containing client tokens can be pasted">Accept Multiple Clients</button>`)
			.click(() => {
				const {$modalInner, doClose} = UiUtil.getShowModal({title: "Accept Multiple Clients"});

				const $iptText = $(`<textarea class="form-control dm_init__pl_textarea block mb-2"/>`)
					.keydown(() => $iptText.removeClass("error-background"));

				const $btnAccept = $(`<button class="btn btn-xs btn-primary block text-center" title="Add Client">Accept Multiple Clients</button>`)
					.click(async () => {
						$iptText.removeClass("error-background");
						const txt = $iptText.val();
						if (!txt.trim() || !PeerUtilV0.containsAnyTokens(txt)) {
							$iptText.addClass("error-background");
						} else {
							const connected = await PeerUtilV0.pConnectClientsToServers(p2pMetaV0.serverInfo, txt);
							board.doBindAlertOnNavigation();
							connected.forEach(serverInfo => {
								serverInfo.rowMeta.$iptTokenClient.val(serverInfo._tempTokenToDisplay || "").attr("disabled", true);
								serverInfo.rowMeta.$btnAcceptClientToken.attr("disabled", true);
								delete serverInfo._tempTokenToDisplay;
							});
							doClose();
							doUpdateExternalStates();
						}
					});

				$$`<div>
					<p>Paste text containing one or more client tokens, and click "Accept Multiple Clients"</p>
					${$iptText}
					<div class="ve-flex-vh-center">${$btnAccept}</div>
				</div>`.appendTo($modalInner);
			});

		$$`
			<div class="ve-flex w-100">
				<div class="col-12">
					<div class="ve-flex-inline-v-center mr-2">
						<span class="mr-1">Add a player (client):</span>
						${$btnAddClient}
					</div>
					<div class="ve-flex-inline-v-center mr-2">
						<span class="mr-1">Copy all un-paired server tokens:</span>
						${$btnCopyServers}
					</div>
					<div class="ve-flex-inline-v-center mr-2">
						<span class="mr-1">Mass-accept clients:</span>
						${$btnAcceptClients}
					</div>
				</div>
			</div>
		`.appendTo($wrpTop);

		UiUtil.addModalSep($modalInner);

		const $btnGenServerTokens = $(`<button class="btn btn-primary btn-xs">Generate All</button>`)
			.click(() => this._playerWindowV0_pGetServerTokens({cfg, p2pMetaV0, rowMetas: p2pMetaV0.rows}));

		UiUtil.$getAddModalRow($modalInner, "div")
			.append($$`
			<div class="ve-flex w-100">
				<div class="col-2 bold">Player Name</div>
				<div class="col-3-5 bold">Server Token</div>
				<div class="col-1 text-center">${$btnGenServerTokens}</div>
				<div class="col-3-5 bold">Client Token</div>
			</div>
		`);

		const _get$rowTemplate = (
			$iptName,
			$iptTokenServer,
			$btnGenServerToken,
			$iptTokenClient,
			$btnAcceptClientToken,
			$btnDeleteClient,
		) => $$`<div class="w-100 mb-2 ve-flex">
			<div class="col-2 pr-1">${$iptName}</div>
			<div class="col-3-5 px-1">${$iptTokenServer}</div>
			<div class="col-1 px-1 ve-flex-vh-center">${$btnGenServerToken}</div>
			<div class="col-3-5 px-1">${$iptTokenClient}</div>
			<div class="col-1-5 px-1 ve-flex-vh-center">${$btnAcceptClientToken}</div>
			<div class="col-0-5 pl-1 ve-flex-vh-center">${$btnDeleteClient}</div>
		</div>`;

		const clientRowMetas = [];
		const addClientRow = () => {
			const rowMeta = {id: CryptUtil.uid()};
			clientRowMetas.push(rowMeta);

			const $iptName = $(`<input class="form-control input-sm">`)
				.keydown(evt => {
					$iptName.removeClass("error-background");
					if (evt.key === "Enter") $btnGenServerToken.click();
				});

			const $iptTokenServer = $(`<input class="form-control input-sm copyable code" readonly disabled>`)
				.click(async () => {
					await MiscUtil.pCopyTextToClipboard($iptTokenServer.val());
					JqueryUtil.showCopiedEffect($iptTokenServer);
				}).disableSpellcheck();

			const $btnGenServerToken = $(`<button class="btn btn-xs btn-primary" title="Generate Server Token">Generate</button>`)
				.click(() => this._playerWindowV0_pGetServerTokens({cfg, p2pMetaV0, rowMetas: [rowMeta]}));

			const $iptTokenClient = $(`<input class="form-control input-sm code" disabled>`)
				.keydown(evt => {
					$iptTokenClient.removeClass("error-background");
					if (evt.key === "Enter") $btnAcceptClientToken.click();
				}).disableSpellcheck();

			const $btnAcceptClientToken = $(`<button class="btn btn-xs btn-primary" title="Accept Client Token" disabled>Accept Client</button>`)
				.click(async () => {
					const token = $iptTokenClient.val();
					if (PeerUtilV0.isValidToken(token)) {
						try {
							await PeerUtilV0.pConnectClientsToServers([rowMeta.serverInfo], token);
							board.doBindAlertOnNavigation();
							$iptTokenClient.prop("disabled", true);
							$btnAcceptClientToken.prop("disabled", true);
							doUpdateExternalStates();
						} catch (e) {
							JqueryUtil.doToast({
								content: `Failed to accept client token! Are you sure it was valid? (See the log for more details.)`,
								type: "danger",
							});
							setTimeout(() => { throw e; });
						}
					} else $iptTokenClient.addClass("error-background");
				});

			const $btnDeleteClient = $(`<button class="btn btn-xs btn-danger"><span class="glyphicon glyphicon-trash"/></button>`)
				.click(() => {
					rowMeta.$row.remove();
					rowMeta.isDeleted = true;
					if (rowMeta.serverInfo) {
						rowMeta.serverInfo.server.close();
						rowMeta.serverInfo.isDeleted = true;
					}
					const ix = clientRowMetas.indexOf(rowMeta);
					if (~ix) clientRowMetas.splice(ix, 1);

					if (!clientRowMetas.length) addClientRow();
				});

			rowMeta.$row = _get$rowTemplate(
				$iptName,
				$iptTokenServer,
				$btnGenServerToken,
				$iptTokenClient,
				$btnAcceptClientToken,
				$btnDeleteClient,
			).appendTo($wrpRowsInner);

			rowMeta.$iptName = $iptName;
			rowMeta.$iptTokenServer = $iptTokenServer;
			rowMeta.$btnGenServerToken = $btnGenServerToken;
			rowMeta.$iptTokenClient = $iptTokenClient;
			rowMeta.$btnAcceptClientToken = $btnAcceptClientToken;
			p2pMetaV0.rows.push(rowMeta);

			return rowMeta;
		};

		const $wrpRows = UiUtil.$getAddModalRow($modalInner, "div");
		const $wrpRowsInner = $(`<div class="w-100"/>`).appendTo($wrpRows);

		if (p2pMetaV0.rows.length) p2pMetaV0.rows.forEach(row => row.$row.appendTo($wrpRowsInner));
		else addClientRow();
	}
}
InitiativeTracker._GET_STAT_COLUMN_HR = () => ({isHr: true});
InitiativeTracker.STAT_COLUMNS = {
	hr0: InitiativeTracker._GET_STAT_COLUMN_HR(),
	hpFormula: {
		name: "HP Formula",
		get: mon => (mon.hp || {}).formula,
	},
	armorClass: {
		name: "Armor Class",
		abv: "AC",
		get: mon => mon.ac[0] ? (mon.ac[0].ac || mon.ac[0]) : null,
	},
	passivePerception: {
		name: "Passive Perception",
		abv: "PP",
		get: mon => mon.passive,
	},
	speed: {
		name: "Speed",
		abv: "SPD",
		get: mon => Math.max(0, ...Object.values(mon.speed || {})
			.map(it => it.number ? it.number : it)
			.filter(it => typeof it === "number")),
	},
	spellDc: {
		name: "Spell DC",
		abv: "DC",
		get: mon => Math.max(0, ...(mon.spellcasting || [])
			.filter(it => it.headerEntries)
			.map(it => {
				return it.headerEntries.map(it => {
					const found = [0];
					it.replace(/DC (\d+)/g, (...m) => found.push(Number(m[1])));
					return Math.max(...found);
				}).filter(Boolean);
			})),
	},
	legendaryActions: {
		name: "Legendary Actions",
		abv: "LA",
		get: mon => mon.legendaryActions || mon.legendary ? 3 : null,
	},
	hr1: InitiativeTracker._GET_STAT_COLUMN_HR(),
	...(() => {
		const out = {};
		Parser.ABIL_ABVS.forEach(it => {
			out[`${it}Save`] = {
				name: `${Parser.attAbvToFull(it)} Save`,
				abv: it.toUpperCase(),
				get: mon => mon.save && mon.save[it] ? mon.save[it] : Parser.getAbilityModifier(mon[it]),
			};
		});
		return out;
	})(),
	hr2: InitiativeTracker._GET_STAT_COLUMN_HR(),
	...(() => {
		const out = {};
		Parser.ABIL_ABVS.forEach(it => {
			out[`${it}Bonus`] = {
				name: `${Parser.attAbvToFull(it)} Bonus`,
				abv: it.toUpperCase(),
				get: mon => Parser.getAbilityModifier(mon[it]),
			};
		});
		return out;
	})(),
	hr3: InitiativeTracker._GET_STAT_COLUMN_HR(),
	...(() => {
		const out = {};
		Parser.ABIL_ABVS.forEach(it => {
			out[`${it}Score`] = {
				name: `${Parser.attAbvToFull(it)} Score`,
				abv: it.toUpperCase(),
				get: mon => mon[it],
			};
		});
		return out;
	})(),
	hr4: InitiativeTracker._GET_STAT_COLUMN_HR(),
	...(() => {
		const out = {};
		Object.keys(Parser.SKILL_TO_ATB_ABV).sort(SortUtil.ascSort).forEach(s => {
			out[s.toCamelCase()] = {
				name: s.toTitleCase(),
				abv: Parser.skillToShort(s).toUpperCase(),
				get: mon => mon.skill && mon.skill[s] ? mon.skill[s] : Parser.getAbilityModifier(mon[Parser.skillToAbilityAbv(s)]),
			};
		});
		return out;
	})(),
	hr5: InitiativeTracker._GET_STAT_COLUMN_HR(),
	cbAutoLow: {
		name: "Checkbox; clears at start of turn",
		isCb: true,
		autoMode: -1,
		get: () => false,
	},
	cbNeutral: {
		name: "Checkbox",
		isCb: true,
		get: () => false,
	},
	cbAutoHigh: {
		name: "Checkbox; ticks at start of turn",
		isCb: true,
		autoMode: 1,
		get: () => true,
	},
};
