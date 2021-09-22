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
			playerInitShortTokens: _propDefaultTrue(state.piS),
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

		let srvPeer = null;
		const p2pMeta = {rows: [], serverInfo: null};
		const _sendStateToClients = () => {
			if (srvPeer) {
				if (!srvPeer.hasConnections()) return;

				const toSend = getPlayerFriendlyState();
				srvPeer.sendMessage(toSend);
			}
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
			new ContextUtil.Action(
				"From Current Bestiary Encounter",
				async () => {
					const savedState = await EncounterUtil.pGetInitialState();
					if (savedState) await pConvertAndLoadBestiaryList(savedState.data);
					else {
						JqueryUtil.doToast({
							content: `No saved encounter! Please first go to the Bestiary and create one.`,
							type: "warning",
						});
					}
				},
			),
			new ContextUtil.Action(
				"From Saved Bestiary Encounter",
				async () => {
					const allSaves = Object.values((await EncounterUtil.pGetSavedState()).savedEncounters || {});
					if (!allSaves.length) return JqueryUtil.doToast({type: "warning", content: "No saved encounters were found! Go to the Bestiary and create some first."});
					const selected = await InputUiUtil.pGetUserEnum({
						values: allSaves.map(it => it.name),
						placeholder: "Select a save",
						title: "Select Saved Encounter",
					});
					if (selected != null) await pConvertAndLoadBestiaryList(allSaves[selected].data);
				},
			),
			new ContextUtil.Action(
				"From Bestiary Encounter File",
				async () => {
					const {jsons, errors} = await DataUtil.pUserUpload();

					DataUtil.doHandleFileLoadErrorsGeneric(errors);

					if (jsons?.length) await pConvertAndLoadBestiaryList(jsons[0]);
				},
			),
			null,
			new ContextUtil.Action(
				"Import Settings",
				() => {
					makeImportSettingsModal();
				},
			),
		])

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
					<div style="width: 43px;"/>
				</div>
			</div>
		`).appendTo($wrpTop);

		const $wrpEntries = $(`<div class="dm-init-wrp-entries"/>`).appendTo($wrpTop);

		const $wrpControls = $(`<div class="dm-init-wrp-controls"/>`).appendTo($wrpTracker);

		const $wrpAddNext = $(`<div class="flex"/>`).appendTo($wrpControls);
		const $wrpAdd = $(`<div class="btn-group flex"/>`).appendTo($wrpAddNext);
		const $btnAdd = $(`<button class="btn btn-primary btn-xs dm-init-lockable" title="Add Player"><span class="glyphicon glyphicon-plus"/></button>`).appendTo($wrpAdd);
		const $btnAddMonster = $(`<button class="btn btn-success btn-xs dm-init-lockable mr-2" title="Add Monster"><span class="glyphicon glyphicon-print"/></button>`).appendTo($wrpAdd);
		$(`<button class="btn btn-default btn-xs mr-2" title="Next Turn"><span class="glyphicon glyphicon-step-forward"/></button>`).appendTo($wrpAddNext)
			.click(() => setNextActive());
		const $iptRound = $(`<input class="form-control ipt-sm dm_init__rounds" type="number" min="1" title="Round">`)
			.val(state.n || 1)
			.change(() => doUpdateExternalStates())
			.appendTo($wrpAddNext);

		const $wrpSort = $(`<div class="btn-group flex"/>`).appendTo($wrpControls);
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

		/**
		 * @param [opts]
		 * @param [opts.$btnStartServer]
		 * @param [opts.$btnGetToken]
		 * @param [opts.fnDispServerStoppedState]
		 * @param [opts.fnDispServerRunningState]
		 */
		const startServer = async (opts) => {
			opts = opts || {};

			if (srvPeer) {
				await srvPeer.pInit();
				return true;
			}

			try {
				if (opts.$btnStartServer) opts.$btnStartServer.prop("disabled", true);
				srvPeer = new PeerVeServer();
				await srvPeer.pInit();
				if (opts.$btnGetToken) opts.$btnGetToken.prop("disabled", false);

				srvPeer.on("connection", connection => {
					const pConnected = new Promise(resolve => {
						connection.on("open", () => {
							resolve(true);
							doUpdateExternalStates();
						});
					});
					const pTimeout = MiscUtil.pDelay(5 * 1000, false);
					Promise.race([pConnected, pTimeout])
						.then(didConnect => {
							if (!didConnect) {
								JqueryUtil.doToast({content: `Connecting to "${connection.label.escapeQuotes()}" has taken more than 5 seconds! The connection may need to be re-attempted.`, type: "warning"})
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
				srvPeer = null;
				JqueryUtil.doToast({content: `Failed to start server! ${VeCt.STR_SEE_CONSOLE}`, type: "danger"});
				setTimeout(() => { throw e; });
			}

			return false;
		};

		const $wrpUtils = $(`<div class="flex"/>`).appendTo($wrpControls);
		$(`<button class="btn btn-primary btn-xs mr-2" title="Player Window"><span class="glyphicon glyphicon-user"/></button>`)
			.appendTo($wrpUtils)
			.click(() => {
				const {$modalInner} = UiUtil.getShowModal({
					title: "Configure Player View",
					isUncappedHeight: true,
					isHeight100: true,
					cbClose: () => {
						if (p2pMeta.rows.length) p2pMeta.rows.forEach(row => row.$row.detach());
						if (srvPeer) srvPeer.offTemp("connection")
					},
				});

				const $wrpHelp = UiUtil.$getAddModalRow($modalInner, "div");

				const fnDispServerStoppedState = () => {
					$btnStartServer.html(`<span class="glyphicon glyphicon-play"/> Start Server`).prop("disabled", false);
					$btnGetToken.prop("disabled", true);
				};

				const fnDispServerRunningState = () => {
					$btnStartServer.html(`<span class="glyphicon glyphicon-play"/> Server Running`).prop("disabled", true);
					$btnGetToken.prop("disabled", false);
				};

				const $btnStartServer = $(`<button class="btn btn-default mr-2"></button>`)
					.click(async () => {
						const isRunning = await startServer({$btnStartServer, $btnGetToken, fnDispServerStoppedState, fnDispServerRunningState});
						if (isRunning) {
							srvPeer.onTemp("connection", showConnected);
							showConnected();
						}
					});

				const $btnGetToken = $(`<button class="btn btn-default" disabled><span class="glyphicon glyphicon-copy"/> Copy Token</button>`).appendTo($wrpHelp)
					.click(() => {
						MiscUtil.pCopyTextToClipboard(srvPeer.token);
						JqueryUtil.showCopiedEffect($btnGetToken);
					});

				if (srvPeer) fnDispServerRunningState();
				else fnDispServerStoppedState();

				$$`<div class="row w-100">
					<div class="col-12">
						<p>
						The Player View is part of a peer-to-peer system to allow players to connect to a DM's initiative tracker. Players should use the <a href="inittrackerplayerview.html">Initiative Tracker Player View</a> page to connect to the DM's instance. As a DM, the usage is as follows:
						<ol>
							<li>Start the server.</li>
							<li>Copy your token and share it with your players.</li>
							<li>Wait for them to connect!</li>
						</ol>
						</p>
						<p>${$btnStartServer}${$btnGetToken}</p>
						<p><i>Please note that this system is highly experimental. Your experience may vary.</i></p>
					</div>
				</div>`.appendTo($wrpHelp);

				UiUtil.addModalSep($modalInner);

				const $wrpConnected = UiUtil.$getAddModalRow($modalInner, "div").addClass("flx-col");

				const showConnected = () => {
					if (!srvPeer) return $wrpConnected.html(`<div class="w-100 flex-vh-center"><i>No clients connected.</i></div>`);

					let stack = `<div class="w-100"><h5>Connected Clients:</h5><ul>`;
					srvPeer.getActiveConnections()
						.map(it => it.label || "(Unknown)")
						.sort(SortUtil.ascSortLower)
						.forEach(it => stack += `<li>${it.escapeQuotes()}</li>`);
					stack += "</ul></div>";
					$wrpConnected.html(stack);
				};

				if (srvPeer) srvPeer.onTemp("connection", showConnected);

				showConnected();
			});

		$wrpTracker.data("pDoConnectLocal", async () => {
			await startServer();
			return srvPeer.token;
		});

		const $wrpLockSettings = $(`<div class="btn-group flex"/>`).appendTo($wrpUtils);
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
				UiUtil.$getAddModalRowCb($modalInner, "Player View: Shorten server tokens", cfg, "playerInitShortTokens", "Server tokens will be roughly half as many characters, but will contain non-standard characters.");
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
			checkSetFirstActive();
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

			const $wrpCbRoll = $(`<label class="ui-search__ipt-search-sub-wrp flex-vh-center"> <span>Roll HP</span></label>`).appendTo($controls);
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
						checkSetFirstActive();
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
				piS: cfg.playerInitShortTokens,
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
			return `${nameList.length} creature${nameList.length === 1 ? "" : "s"} ${nameListFilt.length ? `(${nameListFilt.slice(0, 3).join(", ")}${nameListFilt.length > 3 ? "..." : ""})` : ""}`
		});

		function setNextActive () {
			const $rows = $wrpEntries.find(`.dm-init-row`);

			const $rowsActive = $rows.filter(`.dm-init-row-active`).each((i, e) => {
				const $e = $(e);

				// tick down any conditions
				const $conds = $e.find(`.init__cond`);
				if ($conds.length) $conds.each((i, e) => $(e).data("doTickDown")());

				$e.removeClass(`dm-init-row-active`);
			});

			let ix = $rows.index($rowsActive.get($rowsActive.length - 1)) + 1;

			const nxt = $rows.get(ix++);
			if (nxt) {
				const $nxt = $(nxt);
				let $curr = $nxt;
				do {
					// if names and initiatives are the same, skip forwards (groups of monsters)
					if ($curr.find(`input.name`).val() === $nxt.find(`input.name`).val()
						&& $curr.find(`input.score`).val() === $nxt.find(`input.score`).val()) {
						handleTurnStart($curr);
						const curr = $rows.get(ix++);
						if (curr) $curr = $(curr);
						else $curr = null;
					} else break;
				} while ($curr);
			} else checkSetFirstActive();
			doUpdateExternalStates();
		}

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
						const $row = $(`<div class="flex-v-center mb-2"/>`).appendTo($wrpRows);
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

					$(`<div class="flex-v-center mb-2">
						<div class="col-5 pr-2">Name (optional)</div>
						<div class="col-2 text-center">Color</div>
						<div class="col-5 pl-2">Duration (optional)</div>
					</div>`).appendTo($wrpRows);
					const $controls = $(`<div class="flex-v-center mb-2"/>`).appendTo($wrpRows);
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
					const $wrpAdd = $(`<div class="flex-v-center">`).appendTo($wrpRows);
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
					const m = await Renderer.hover.pCacheAndGet(UrlUtil.PG_BESTIARY, source, hash);

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
							$ipt.attr("populate-running", true);
							const meta = InitiativeTracker.STAT_COLUMNS[c.p];
							if (isMon && meta) {
								const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BESTIARY]({name: name, source: source});
								const populateStats = async () => {
									const mon = await Renderer.hover.pCacheAndGet(UrlUtil.PG_BESTIARY, source, hash);
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
				$$`<${eleType} class="dm_init__stat ${isCheckbox ? "flex-vh-center" : ""}" data-id="${c.id}">${$ipt}</${eleType}>`.appendTo($mid);
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

		function checkSetFirstActive () {
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

				$iptRound.val(Number($iptRound.val() || 0) + 1);

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
			checkSetFirstActive();
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

		async function pConvertAndLoadBestiaryList (bestiaryList) {
			const toLoad = {
				s: "NUM",
				d: "DESC",
				m: false,
				g: true,
				r: [],
			};

			if (cfg.importIsAddPlayers) {
				if (bestiaryList.a) { // advanced encounter builder
					if (bestiaryList.d) {
						const colNameIndex = {};
						bestiaryList.c = bestiaryList.c || [];
						if (bestiaryList.c.length) cfg.statsAddColumns = true;

						bestiaryList.c.forEach((colName, i) => colNameIndex[i] = (colName || "").toLowerCase());

						// mark all old stats cols for deletion
						cfg.statsCols.forEach(col => col.isDeleted = true);

						const colIndex = {};
						let hpIndex = null;
						bestiaryList.c.forEach((colName, i) => {
							colName = colName || "";
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

						bestiaryList.d.forEach(playerDetails => {
							const row = {
								n: playerDetails.n || "", // name
								i: "", // score
								a: 0, // is active?
								c: [], // conditions
								v: true,
							};

							if (playerDetails.x && playerDetails.x.length) { // extra stats
								row.k = playerDetails.x.map((val, i) => {
									if (i === hpIndex) return null;
									return {id: colIndex[i].id, v: val || ""};
								}).filter(Boolean);

								if (hpIndex != null) {
									row.h = row.g = (playerDetails.x[hpIndex] || "").trim();
								} else row.h = row.g = "";
							} else row.h = row.g = "";

							toLoad.r.push(row);
						});
					}
				} else {
					if (bestiaryList.p) {
						bestiaryList.p.forEach(playerGroup => {
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

			// convert Bestiary sublist files
			if (bestiaryList.items && bestiaryList.sources) bestiaryList.l = {items: bestiaryList.items, sources: bestiaryList.sources};

			if (bestiaryList.l && bestiaryList.l.items) {
				const toAdd = await Promise.all(bestiaryList.l.items.map(it => {
					const count = Number(it.c);
					const hash = it.h;

					const {_scaledCr: scaledCr, _scaledSpellSummonLevel: scaledSpellSummonLevel, _scaledClassSummonLevel: scaledClassSummonLevel} = Renderer.monster.getUnpackedCustomHashId(it.customHashId) || {};

					const source = UrlUtil.decodeHash(hash)[1];
					if (!source) return null;
					return new Promise(resolve => {
						Renderer.hover.pCacheAndGet(UrlUtil.PG_BESTIARY, source, hash)
							.then(mon => {
								if (scaledCr != null) {
									ScaleCreature.scale(mon, scaledCr).then(scaled => {
										resolve({
											count,
											monster: scaled,
										});
									});
								} else if (scaledSpellSummonLevel != null) {
									ScaleSpellSummonedCreature.scale(mon, scaledSpellSummonLevel).then(scaled => {
										resolve({
											count,
											monster: scaled,
										});
									});
								} else if (scaledClassSummonLevel != null) {
									ScaleClassSummonedCreature.scale(mon, scaledClassSummonLevel).then(scaled => {
										resolve({
											count,
											monster: scaled,
										});
									});
								} else {
									resolve({
										count,
										monster: mon,
									});
								}
							});
					})
				}));
				await Promise.all(toAdd.filter(Boolean).map(async it => {
					const groupInit = cfg.importIsRollGroups && cfg.isRollInit ? await pRollInitiative(it.monster) : null;
					const groupHp = cfg.importIsRollGroups ? await pGetOrRollHp(it.monster) : null;

					await Promise.all([...new Array(it.count || 1)].map(async () => {
						const hp = `${cfg.importIsRollGroups ? groupHp : await pGetOrRollHp(it.monster)}`;
						toLoad.r.push({
							n: {
								name: it.monster.name,
								displayName: it.monster._displayName,
								scaledToCr: it.monster._scaledCr,
								scaledToSummonSpellLevel: it.monster._summonedBySpell_level,
								scaledToSummonClassLevel: it.monster._summonedByClass_level,
							},
							i: cfg.isRollInit ? `${cfg.importIsRollGroups ? groupInit : await pRollInitiative(it.monster)}` : null,
							a: 0,
							s: it.monster.source,
							c: [],
							h: hp,
							g: hp,
						});
					}));
				}));
				await pLoadState(toLoad, cfg.importIsAppend);
			} else await pLoadState(toLoad, cfg.importIsAppend);
		}

		$wrpTracker.data("doConvertAndLoadBestiaryList", (bestiaryList) => pConvertAndLoadBestiaryList(bestiaryList));

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
				}).filter(Boolean)
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
