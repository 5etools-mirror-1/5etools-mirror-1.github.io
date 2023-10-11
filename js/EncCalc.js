//CR values and the corresponding XP
const crValues = ['0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14',
  '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30'];

const crXpValues = [10, 25, 50, 100, 200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400,
  10000, 11500, 13000, 15000, 18000, 20000, 22000, 25000, 33000, 41000, 50000, 62000, 75000, 90000,
  105000, 120000, 135000, 155000];

// XP tolerance of the party per player based on player level and encounter difficulty
const xpTolerance = [
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

var diffArr = [
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

//this function returns the range of monsters needed for this player dificulty
function getMonRange(CR_Rating, lower, upper){
	let i = 1;
	let xp = crXpValues[CR_Rating];
	if (xp > upper){
		return "-"
	}
	while(((xp * i) * xpMultiplier(i)) < lower){
		i++;
	}
	if (i > 25){
		return ""
	}
	let ret = i;
	let ii = i;
	while(((xp * ii) * xpMultiplier(ii)) <= upper){
		ii++;
	}
	if (ii >26){ii=26}
	if (ii > i){
		ii--; // Subtract 1 from ii to get the correct upper bound
		if (ii > i){
			ret += "-" + ii;
		}
	}
	return ret;
}

function genTable(difficulty, Player_Count){
	diffArr = xpTolerance.map((row) => row.map((element) => element * Player_Count));
	let ret = '<table><tr><td rowspan="2">CR Rating</td><td colspan="20">Player Level</td></tr>';
	ret += '<tr>';
	for (let lvl = 1; lvl <= 20; lvl++) {
		ret += '<td>' + lvl + '</td>';
	}
	ret += '</tr>';
	for (let CRi = 0; CRi < crValues.length; CRi ++){
		ret +='<tr><td>' + crValues[CRi] + '</td>'
		for (let i = 0; i<20;i++){
			ret += '<td>'
			if (difficulty == 'any'){
				ret += getMonRange(CRi, diffArr[i][0], diffArr[i][3])
			} else if (difficulty == 'easy') {
				ret += getMonRange(CRi, diffArr[i][0], diffArr[i][1])
			}else if (difficulty == 'medium') {
				ret += getMonRange(CRi, diffArr[i][1], diffArr[i][2])
			} else if (difficulty == 'hard') {
				ret += getMonRange(CRi, diffArr[i][2], diffArr[i][3])
			}
			ret += '</td>'
		}
		ret += '</tr>'
	}
	return ret
}
	
function EncCalc() {
    var count = document.getElementById("PCount").value;
    var selectElement = document.getElementById("difficulty");
    var dif = selectElement.value;
    var element = document.getElementById("EncTable");
    element.innerHTML = genTable(dif, count);
}

function clearTable(){
	var element = document.getElementById("EncTable");
    element.innerHTML = "";
}
