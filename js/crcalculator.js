"use strict";

const MONSTER_STATS_BY_CR_JSON_URL = "data/msbcr.json";
const MONSTER_FEATURES_JSON_URL = "data/monsterfeatures.json";
let msbcr;
let monsterFeatures;

window.addEventListener("load", async () => {
	await Promise.all([
		PrereleaseUtil.pInit(),
		BrewUtil2.pInit(),
	]);
	ExcludeUtil.pInitialise().then(null); // don't await, as this is only used for search
	msbcr = await DataUtil.loadJSON(MONSTER_STATS_BY_CR_JSON_URL);
	const mfData = await DataUtil.loadJSON(MONSTER_FEATURES_JSON_URL);
	addMonsterFeatures(mfData);

	window.dispatchEvent(new Event("toolsLoaded"));
});

function addMonsterFeatures (mfData) {
	monsterFeatures = mfData.monsterfeatures;
	for (let i = 0; i < msbcr.cr.length; i++) {
		const curCr = msbcr.cr[i];
		$("#msbcr").append(`<tr><td>${curCr._cr}</td><td>${Parser.crToXp(curCr._cr)}</td><td>${curCr.pb}</td><td>${curCr.ac}</td><td>${curCr.hpMin}-${curCr.hpMax}</td><td>${curCr.attackBonus}</td><td>${curCr.dprMin}-${curCr.dprMax}</td><td>${curCr.saveDc}</td></tr>`);
	}

	$("#crcalc input").change(calculateCr);
	$("#saveprofs, #resistances").change(calculateCr);

	$("#saveinstead").change(function () {
		const curVal = parseInt($("#attackbonus").val());
		if (!$(this).is(":checked")) $("#attackbonus").val(curVal - 10);
		if ($(this).is(":checked")) $("#attackbonus").val(curVal + 10);
		calculateCr();
	});

	function changeSize ($selSize) {
		const newSize = $selSize.val();
		if (newSize === "Tiny") $("#hdval").html("d4");
		if (newSize === "Small") $("#hdval").html("d6");
		if (newSize === "Medium") $("#hdval").html("d8");
		if (newSize === "Large") $("#hdval").html("d10");
		if (newSize === "Huge") $("#hdval").html("d12");
		if (newSize === "Gargantuan") $("#hdval").html("d20");
		$("#hp").val(calculateHp());
	}

	$("select#size").change(function () {
		changeSize($(this));
		calculateCr();
	});

	$("#hd, #con").change(function () {
		$("#hp").val(calculateHp());
		calculateCr();
	});

	// when clicking a row in the "Monster Statistics by Challenge Rating" table
	$("#msbcr tr").not(":has(th)").click(function () {
		if (!confirm("This will reset the calculator. Are you sure?")) return;
		$("#expectedcr").val($(this).children("td:eq(0)").html());
		const [minHp, maxHp] = $(this).children("td:eq(4)").html().split("-").map(it => parseInt(it));
		$("#hp").val(minHp + (maxHp - minHp) / 2);
		$("#hd").val(calculateHd());
		$("#ac").val($(this).children("td:eq(3)").html());
		$("#dpr").val($(this).children("td:eq(6)").html().split("-")[0]);
		$("#attackbonus").val($(this).children("td:eq(5)").html());
		if ($("#saveinstead").is(":checked")) $("#attackbonus").val($(this).children("td:eq(7)").html());
		calculateCr();
	});

	$("#hp").change(function () {
		$("#hd").val(calculateHd());
		calculateCr();
	});

	// parse monsterfeatures
	const $wrpMonFeatures = $(`#monsterfeatures .crc__wrp_mon_features`);
	monsterFeatures.forEach(f => {
		const effectOnCr = [];
		if (f.hp) effectOnCr.push(`HP: ${f.hp}`);
		if (f.ac) effectOnCr.push(`AC: ${f.ac}`);
		if (f.dpr) effectOnCr.push(`DPR: ${f.dpr}`);
		if (f.attackBonus) effectOnCr.push(`AB: ${f.attackBonus}`);

		const numBox = f.hasNumberParam ? `<input type="number" value="0" min="0" class="form-control form-control--minimal crc__mon_feature_num input-xs ml-2">` : "";

		$wrpMonFeatures.append(`
			<label class="row crc__mon_feature ui-tip__parent">
				<div class="col-1 crc__mon_feature_wrp_cb">
					<input type="checkbox" id="mf-${Parser.stringToSlug(f.name)}" title="${f.name}" data-hp="${f.hp || ""}" data-ac="${f.ac || ""}" data-dpr="${f.dpr || ""}" data-attackbonus="${f.attackBonus || ""}" class="crc__mon_feature_cb">${numBox}
				</div>
				<div class="col-2">${f.name}</div>
				<div class="col-2">${Renderer.get().render(`{@creature ${f.example}}`)}</div>
				<div class="col-7"><span title="${effectOnCr.join(", ")}">${Renderer.get().render(f.effect)}</span></div>
			</label>
		`);
	});

	function parseUrl () {
		if (window.location.hash) {
			let curData = window.location.hash.split("#")[1].split(",");
			$("#expectedcr").val(curData[0]);
			$("#ac").val(curData[1]);
			$("#dpr").val(curData[2]);
			$("#attackbonus").val(curData[3]);
			if (curData[4] === "true") $("#saveinstead").attr("checked", true);
			changeSize($("#size").val(curData[5]));
			$("#hd").val(curData[6]);
			$("#con").val(curData[7]);
			$("#hp").val(calculateHp());
			if (curData[8] === "true") $("#vulnerabilities").attr("checked", true);
			$("#resistances").val(curData[9]);
			if (curData[10] === "true") $("#flying").attr("checked", true);
			$("#saveprofs").val(curData[11]);

			$(`.crc__mon_feature_cb`).each((i, e) => {
				const $cb = $(e);
				const idCb = $cb.attr("id");
				const val = Hist.getSubHash(idCb);
				if (val) {
					$cb.prop("checked", true);
					if (val !== "true") {
						$cb.siblings("input[type=number]").val(val);
					}
				}
			});
		}

		calculateCr();
	}

	function handleMonsterFeaturesChange ($cbFeature, $iptNum) {
		const curFeature = $cbFeature.attr("id");

		if ($cbFeature.prop("checked")) {
			Hist.setSubhash(curFeature, $iptNum.length ? $iptNum.val() : true);
		} else {
			Hist.setSubhash(curFeature, null);
		}
	}

	// Monster Features table
	$(".crc__mon_feature_cb").change(function () {
		const $cbFeature = $(this);
		const $iptNum = $(this).siblings("input[type=number]");
		handleMonsterFeaturesChange($cbFeature, $iptNum);
	});

	$(`.crc__mon_feature_num`).change(function () {
		const $iptNum = $(this);
		const $cbFeature = $(this).siblings("input[type=checkbox]");
		handleMonsterFeaturesChange($cbFeature, $iptNum);
	});

	$("#monsterfeatures .crc__wrp_mon_features input").change(calculateCr);

	$("#crcalc_reset").click(() => {
		confirm("Are you sure?") && (() => {
			window.location = "";
			parseUrl();
		})();
	});

	parseUrl();
}

function calculateCr () {
	const expectedCr = parseInt($("#expectedcr").val());

	let hp = parseInt($("#crcalc #hp").val());

	if ($("#vulnerabilities").prop("checked")) hp *= 0.5;
	if ($("#resistances").val() === "res") {
		if (expectedCr >= 0 && expectedCr <= 4) hp *= 2;
		if (expectedCr >= 5 && expectedCr <= 10) hp *= 1.5;
		if (expectedCr >= 11 && expectedCr <= 16) hp *= 1.25;
	}
	if ($("#resistances").val() === "imm") {
		if (expectedCr >= 0 && expectedCr <= 4) hp *= 2;
		if (expectedCr >= 5 && expectedCr <= 10) hp *= 2;
		if (expectedCr >= 11 && expectedCr <= 16) hp *= 1.5;
		if (expectedCr >= 17) hp *= 1.25;
	}

	let ac = parseInt($("#crcalc #ac").val()) + parseInt($("#saveprofs").val()) + parseInt($("#flying").prop("checked") * 2);
	let dpr = parseInt($("#crcalc #dpr").val());

	let attackBonus = parseInt($("#crcalc #attackbonus").val());
	const useSaveDc = $("#saveinstead").prop("checked");

	let offensiveCR = -1;
	let defensiveCR = -1;

	// go through monster features
	$("#monsterfeatures input:checked").each(function () {
		// `trait` is used within the "eval"s below
		let trait = 0;
		if ($(this).siblings("input[type=number]").length) trait = $(this).siblings("input[type=number]").val();

		/* eslint-disable */
		if ($(this).attr("data-hp") !== "") hp += Number(eval($(this).attr("data-hp")));
		if ($(this).attr("data-ac") !== "") ac += Number(eval($(this).attr("data-ac")));
		if ($(this).attr("data-dpr") !== "") dpr += Number(eval($(this).attr("data-dpr")));
		/* eslint-enable */
		if (!useSaveDc && $(this).attr("data-attackbonus") !== "") attackBonus += Number($(this).attr("data-attackbonus"));
	});

	hp = Math.floor(hp);
	dpr = Math.floor(dpr);

	const effectiveHp = hp;
	const effectiveDpr = dpr;

	// make sure we don't break the CR
	if (hp > 850) hp = 850;
	if (dpr > 320) dpr = 320;

	for (let i = 0; i < msbcr.cr.length; i++) {
		const curCr = msbcr.cr[i];
		if (hp >= parseInt(curCr.hpMin) && hp <= parseInt(curCr.hpMax)) {
			let defenseDifference = parseInt(curCr.ac) - ac;
			if (defenseDifference > 0) defenseDifference = Math.floor(defenseDifference / 2);
			if (defenseDifference < 0) defenseDifference = Math.ceil(defenseDifference / 2);
			defenseDifference = i - defenseDifference;
			if (defenseDifference < 0) defenseDifference = 0;
			if (defenseDifference >= msbcr.cr.length) defenseDifference = msbcr.cr.length - 1;
			defensiveCR = msbcr.cr[defenseDifference]._cr;
		}
		if (dpr >= curCr.dprMin && dpr <= curCr.dprMax) {
			let adjuster = parseInt(curCr.attackBonus);
			if (useSaveDc) adjuster = parseInt(curCr.saveDc);
			let attackDifference = adjuster - attackBonus;
			if (attackDifference > 0) attackDifference = Math.floor(attackDifference / 2);
			if (attackDifference < 0) attackDifference = Math.ceil(attackDifference / 2);
			attackDifference = i - attackDifference;
			if (attackDifference < 0) attackDifference = 0;
			if (attackDifference >= msbcr.cr.length) attackDifference = msbcr.cr.length - 1;
			offensiveCR = msbcr.cr[attackDifference]._cr;
		}
	}

	if (offensiveCR === -1) offensiveCR = "0";
	if (defensiveCR === -1) defensiveCR = "0";
	let cr = ((fractionStrToDecimal(offensiveCR) + fractionStrToDecimal(defensiveCR)) / 2).toString();

	if (cr === "0.5625") cr = "1/2";
	if (cr === "0.5") cr = "1/2";
	if (cr === "0.375") cr = "1/4";
	if (cr === "0.3125") cr = "1/4";
	if (cr === "0.25") cr = "1/4";
	if (cr === "0.1875") cr = "1/8";
	if (cr === "0.125") cr = "1/8";
	if (cr === "0.0625") cr = "1/8";
	if (cr.indexOf(".") !== -1) cr = Math.round(cr).toString();

	let finalCr = 0;
	for (let i = 0; i < msbcr.cr.length; i++) {
		if (msbcr.cr[i]._cr === cr) {
			finalCr = i;
			break;
		}
	}

	const hitDice = calculateHd();
	const hitDiceSize = $("#hdval").html();
	const conMod = Parser.getAbilityModNumber($("#con").val());
	const hashParts = [
		$("#expectedcr").val(), // 0
		$("#ac").val(), // 1
		$("#dpr").val(), // 2
		$("#attackbonus").val(), // 3
		useSaveDc, // 4
		$("#size").val(), // 5
		$("#hd").val(), // 6
		$("#con").val(), // 7
		$("#vulnerabilities").prop("checked"), // 8
		$("#resistances").val(), // 9
		$("#flying").prop("checked"), // 10
		$("#saveprofs").val(), // 11
		$(`.crc__mon_feature_cb`).map((i, e) => {
			const $cb = $(e);
			if ($cb.prop("checked")) {
				const $iptNum = $cb.siblings("input[type=number]");
				return `${$cb.attr("id")}:${$iptNum.length ? $iptNum.val() : true}`;
			} else return false;
		}).get().filter(Boolean).join(","),
	];
	window.location = `#${hashParts.join(",")}`;

	$("#croutput").html(`
		<h4>Challenge Rating: ${cr}</h4>
		<p>Offensive CR: ${offensiveCR}</p>
		<p>Defensive CR: ${defensiveCR}</p>
		<p>Proficiency Bonus: +${msbcr.cr[finalCr].pb}</p>
		<p>Effective HP: ${effectiveHp} (${hitDice}${hitDiceSize}${conMod < 0 ? "" : "+"}${conMod * hitDice})</p>
		<p>Effective AC: ${ac}</p>
		<p>Average Damage Per Round: ${effectiveDpr}</p>
		<p>${useSaveDc ? "Save DC: " : "Effective Attack Bonus: +"}${attackBonus}</p>
		<p>Experience Points: ${Parser.crToXp(msbcr.cr[finalCr]._cr)}</p>
	`);
}

function calculateHd () {
	const avgHp = $("#hdval").html().split("d")[1] / 2 + 0.5;
	const conMod = Parser.getAbilityModNumber($("#con").val());
	let curHd = Math.round(parseInt($("#hp").val()) / (avgHp + conMod));
	if (!curHd) curHd = 1;
	return curHd;
}

function calculateHp () {
	const avgHp = $("#hdval").html().split("d")[1] / 2 + 0.5;
	const conMod = Parser.getAbilityModNumber($("#con").val());
	return Math.floor((avgHp + conMod) * $("#hd").val());
}

function fractionStrToDecimal (str) {
	return str === "0" ? 0 : parseFloat(str.split("/").reduce((numerator, denominator) => numerator / denominator));
}
