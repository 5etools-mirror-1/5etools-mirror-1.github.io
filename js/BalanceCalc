//CR values and the corresponding XP
const MonXpValues = [10, 25, 50, 100, 200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400,
  10000, 11500, 13000, 15000, 18000, 20000, 22000, 25000, 33000, 41000, 50000, 62000, 75000, 90000,
  105000, 120000, 135000, 155000];

// XP tolerance of the party per player based on player level and encounter difficulty
const playXpTolerance = [
  [25, 50, 75, 100],
  [50, 100, 150, 200],
  [75, 150, 225, 400],
  [125, 250, 375, 500],
  [250, 500, 750, 1100],
  [300, 600, 900, 1400],
  [350, 750, 1100, 1700],
  [450, 900, 1400, 2100],
  [550, 1100, 1600, 2400],
  [600, 1200, 1900, 2800],
  [800, 1600, 2400, 3600],
  [1000, 2000, 3000, 4500],
  [1100, 2200, 3400, 5100],
  [1250, 2500, 3800, 5700],
  [1400, 2800, 4300, 6400],
  [1600, 3200, 4800, 7200],
  [2000, 3900, 5900, 8800],
  [2100, 4200, 6300, 9500],
  [2400, 4900, 7300, 10900],
  [2800, 5700, 8500, 12700],
];

//Work out the monster XP multiplier 
function xpMultiplier(monCount) {
	if (monCount === 1) {
		return 1;
	} else if (monCount === 2) {
		return 1.5;
	} else if (monCount >= 3 && monCount <= 6) {
		return 2;
	} else if (monCount >= 7 && monCount <= 10) {
		return 2.5;
	} else if (monCount >= 11 && monCount <= 14) {
		return 3;
	} else if (monCount > 14) {
		return 4;
	} else {
		return 0; // Handle the case where monCount is not within the expected ranges
	}
}

//calculate the monster XP level
function monsterXP(){
	let ret = 0;
	let tmp = 0;
	tmp = MonXpValues[document.getElementById("MonCR1").value];
	ret += (tmp * xpMultiplier(document.getElementById("MonCount1").value))*document.getElementById("MonCount1").value;
	tmp = MonXpValues[document.getElementById("MonCR2").value];
	ret += (tmp * xpMultiplier(document.getElementById("MonCount2").value))*document.getElementById("MonCount2").value;
	tmp = MonXpValues[document.getElementById("MonCR3").value];
	ret += (tmp * xpMultiplier(document.getElementById("MonCount3").value))*document.getElementById("MonCount3").value;
	tmp = MonXpValues[document.getElementById("MonCR4").value];
	ret += (tmp * xpMultiplier(document.getElementById("MonCount4").value))*document.getElementById("MonCount4").value;
	tmp = MonXpValues[document.getElementById("MonCR5").value];
	ret += (tmp * xpMultiplier(document.getElementById("MonCount5").value))*document.getElementById("MonCount5").value;
	return ret;
}

//calculate the players XP tollerence
function playerXP(){
	return playXpTolerance[document.getElementById("PartyLVL").value-1].map((element) => element * document.getElementById("PlayerCount").value);
}

function BalanceCalc() {
  	let mxp = monsterXP();
	let pxp = playerXP();
	var element = document.getElementById("CalcOut");
    
	if (mxp<pxp[0]){
		element.style.color = 'red'
		element.innerHTML = "<b>Encounter is too easy</b>";
	} else if (mxp>pxp[0] && mxp<pxp[1]){
		element.style.color = 'orange'
		element.innerHTML = "<b>Encounter is easy</b>";
	} else if (mxp>pxp[1] && mxp<pxp[2]){
		element.style.color = 'green'
		element.innerHTML = "<b>Encounter is medium</b>";
	} else if (mxp>pxp[2] && mxp<pxp[3]){
		element.style.color = 'orange'
		element.innerHTML = "<b>Encounter is hard</b>";
	} else if (mxp>pxp[3]){
		element.style.color = 'red'
		element.innerHTML = "<b>Encounter is deadly</b>";
	}
	element = document.getElementById("CalcMethod");
	element.innerHTML = "Moster dificulty rating is " + mxp + "<br> An easy encounter should be in the range ";
	element.innerHTML += pxp[0] + "-" + pxp[1]
	element.innerHTML += "<br> a medium encounter should be in the range "
	element.innerHTML += pxp[1] + "-" + pxp[2]
	element.innerHTML += "<br> a hard encounter should be in the range "
	element.innerHTML += pxp[2] + "-" + pxp[3]
}
