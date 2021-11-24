"use strict";

const RNG = RollerUtil.randomise;

// usage: _testRng(() => GenUtil.getFromTable(PARENTS_TIEFLING, RNG(8)))
function _testRng (rollFn) {
	const counts = {};
	for (let i = 0; i < 10000; ++i) {
		const roll = rollFn();
		const it = roll.display || roll.result;
		if (!counts[it]) counts[it] = 1;
		else counts[it]++;
	}
	return counts;
}

function rollSuppAlignment () {
	return GenUtil.getFromTable(SUPP_ALIGNMENT, RNG(6) + RNG(6) + RNG(6));
}
function rollSuppDeath () {
	return GenUtil.getFromTable(SUPP_DEATH, RNG(12));
}
function rollSuppClass () {
	return GenUtil.getFromTable(SUPP_CLASS, RNG(100));
}
function rollSuppOccupation () {
	return GenUtil.getFromTable(SUPP_OCCUPATION, RNG(100));
}
function rollSuppRace () {
	return GenUtil.getFromTable(SUPP_RACE, RNG(100));
}
function rollSuppRelationship () {
	return GenUtil.getFromTable(SUPP_RELATIONSHIP, RNG(4) + RNG(4) + RNG(4));
}
function rollSuppStatus () {
	return GenUtil.getFromTable(SUPP_STATUS, RNG(6) + RNG(6) + RNG(6));
}

/**
 * @param [opts] Options object.
 * @param [opts.isParent] If this person is a parent.
 * @param [opts.race] Race for this person (parent only).
 * @param [opts.gender] Gender for this person (parent only).
 * @param [opts.isSibling] If this person is a sibling.
 * @param opts.gender The gender of this person.
 * @param opts.parentRaces List of parent races for this person.
 * @param opts.isAdventurer Is the person is an adventurer (and therefore has a class as opposed to an occupation).
 */
function getPersonDetails (opts) {
	opts = opts || {};

	function addName (race, gender) {
		const raceSlug = Parser.stringToSlug(race);
		if (nameTables[raceSlug]) {
			const availNameTables = nameTables[raceSlug];

			const maleFirstTables = [];
			const femaleFirstTables = [];
			const surnameTables = [];

			availNameTables.tables.forEach(tbl => {
				const nameParts = tbl.option.replace(/,/g, " ").toLowerCase().split(/\s+/);
				if (nameParts.includes("male")) maleFirstTables.push(tbl);
				else if (nameParts.includes("female")) femaleFirstTables.push(tbl);
				else if (!nameParts.includes("child")) surnameTables.push(tbl);
			});

			const chooseFrom = gender === "Other"
				? maleFirstTables.concat(femaleFirstTables)
				: gender === "Male" ? maleFirstTables : femaleFirstTables;
			const nameTableMeta = rollOnArray(chooseFrom);
			const resultFirst = GenUtil.getFromTable(nameTableMeta.table, RNG(nameTableMeta.diceType));
			const resultLast = (() => {
				if (surnameTables.length) {
					const nameTableMeta = rollOnArray(chooseFrom);
					return GenUtil.getFromTable(nameTableMeta.table, RNG(nameTableMeta.diceType));
				} else return null;
			})();

			if (opts.isParent && !ptrParentLastName._) ptrParentLastName._ = resultLast ? resultLast.result : null;
			const lastName = (() => {
				if (ptrParentLastName._) {
					if (opts.isParent) return ptrParentLastName._;
					else if (opts.isSibling) {
						// 20% chance of sibling not having the same last name
						if (RNG(5) !== 5) return ptrParentLastName._;
					}
				}
				return resultLast ? resultLast.result : "";
			})();

			out.unshift(`<i><b title="Generated using the random name tables found in Xanathar's Guide to Everything">Name:</b> ${resultFirst.result}${lastName ? ` ${lastName}` : ""}</i>`);
		}
	}

	const status = rollSuppStatus();
	const align = rollSuppAlignment().result;
	const occ = rollSuppOccupation().result;
	const cls = rollSuppClass().result;
	const relate = rollSuppRelationship().result;
	const out = [
		`<b>Alignment:</b> ${align}`,
		opts.isAdventurer ? `<b>Class:</b> ${cls}` : `<b>Occupation:</b> ${occ}`,
		`<b>Relationship:</b> ${relate}`,
	];
	if (!opts.isParent) {
		out.push(`<b>Status:</b> ${status.result}`);
	}

	if (!opts.isParent) {
		const race = opts.parentRaces ? (() => {
			const useParent = RNG(100) > 15;
			if (useParent) return rollOnArray(opts.parentRaces);
			else return rollSuppRace().result;
		})() : rollSuppRace().result;

		out.unshift(`<i><b>Race:</b> ${race}</i>`);
		const gender = opts.gender ? opts.gender : rollUnofficialGender().result;
		out.unshift(`<i><b>Gender:</b> ${gender}</i>`);

		addName(race, gender);
	} else if (opts.race) {
		addName(opts.race, opts.gender || "Other");
	}
	return out;
}

function rollEvtAdventure () {
	return GenUtil.getFromTable(LIFE_EVENTS_ADVENTURES, RNG(100));
}
function rollEvtArcaneMatter () {
	return GenUtil.getFromTable(LIFE_EVENTS_ARCANE_MATTERS, RNG(10));
}
function rollEvtBoon () {
	return GenUtil.getFromTable(LIFE_EVENTS_BOONS, RNG(10));
}
function rollEvtCrime () {
	return GenUtil.getFromTable(LIFE_EVENTS_CRIME, RNG(8));
}
function rollEvtPunishment () {
	return GenUtil.getFromTable(LIFE_EVENTS_PUNISHMENT, RNG(12));
}
function rollEvtSupernatural () {
	return GenUtil.getFromTable(LIFE_EVENTS_SUPERNATURAL, RNG(100));
}
function rollEvtTragedy () {
	return GenUtil.getFromTable(LIFE_EVENTS_TRAGEDIES, RNG(12));
}
function rollEvtWar () {
	return GenUtil.getFromTable(LIFE_EVENTS_WAR, RNG(12));
}
function rollEvtWeird () {
	return GenUtil.getFromTable(LIFE_EVENTS_WEIRD_STUFF, RNG(12));
}

function rollUnofficialGender () {
	const GENDERS = [
		{min: 1, max: 49, result: "Male"},
		{min: 50, max: 98, result: "Female"},
		{min: 98, max: 100, result: "Other"},
	];
	return GenUtil.getFromTable(GENDERS, RNG(100));
}

function choose (...lst) {
	return fmtChoice(rollOnArray(lst));
}

function chooseRender (...lst) {
	return fmtChoice(rollOnArray(lst), true);
}

function fmtChoice (str, render) {
	const raw = `({@i ${str}})`;
	return render ? Renderer.get().render(raw) : raw;
}

function rollOnArray (lst) {
	return lst[RNG(lst.length) - 1];
}

const RACES_SELECTABLE = ["Dwarf", "Elf", "Half-Elf", "Half-Orc", "Tiefling"];
const RACES_UNSELECTABLE = ["Human", "Halfling", "Dragonborn", "Gnome"];

const PARENTS_HALF_ELF = [
	{min: 1, max: 5, result: () => { const p = RNG(2); return `One parent ${fmtChoice(p === 1 ? "mother" : "father")} was an elf and the other ${fmtChoice(p === 1 ? "father" : "mother")} was a human.`; }, display: "One parent was an elf and the other was a human.", _races: ["Elf", "Human"]},
	{min: 6, result: () => { const p = RNG(2); return `One parent ${fmtChoice(p === 1 ? "mother" : "father")} was an elf and the other ${fmtChoice(p === 1 ? "father" : "mother")} was a half-elf.`; }, display: "One parent was an elf and the other was a half-elf.", _races: ["Elf", "Half-Elf"]},
	{min: 7, result: () => { const p = RNG(2); return `One parent ${fmtChoice(p === 1 ? "mother" : "father")} was a human and the other ${fmtChoice(p === 1 ? "father" : "mother")} was a half-elf.`; }, display: "One parent was a human and the other was a half-elf.", _races: ["Half-Elf", "Human"]},
	{min: 8, result: "Both parents were half-elves.", _races: ["Half-Elf", "Half-Elf"]},
];

const PARENTS_HALF_ORC = [
	{min: 1, max: 3, result: () => { const p = RNG(2); return `One parent ${fmtChoice(p === 1 ? "mother" : "father")} was an orc and the other ${fmtChoice(p === 1 ? "father" : "mother")} was a human.`; }, display: "One parent was an orc and the other was a human.", _races: ["Orc", "Human"]},
	{min: 4, max: 5, result: () => { const p = RNG(2); return `One parent ${fmtChoice(p === 1 ? "mother" : "father")} was an orc and the other ${fmtChoice(p === 1 ? "father" : "mother")} was a half-orc.`; }, display: "One parent was an orc and the other was a half-orc.", _races: ["Orc", "Half-Orc"]},
	{min: 6, max: 7, result: () => { const p = RNG(2); return `One parent ${fmtChoice(p === 1 ? "mother" : "father")} was a human and the other ${fmtChoice(p === 1 ? "father" : "mother")} was a half-orc.`; }, display: "One parent was a human and the other was a half-orc.", _races: ["Human", "Half-Orc"]},
	{min: 8, display: "Both parents were half-orcs.", _races: ["Half-Orc", "Half-Orc"]},
];

const PARENTS_TIEFLING = [
	{min: 1, max: 4, display: "Both parents were humans, their infernal heritage dormant until you came along.", _races: ["Human", "Human"]},
	{min: 5, max: 6, result: () => { const p = RNG(2); return `One parent ${fmtChoice(p === 1 ? "mother" : "father")} was a tiefling and the other ${fmtChoice(p === 1 ? "father" : "mother")} was a human.`; }, display: "One parent was a tiefling and the other was a human.", _races: ["Human", "Tiefling"]},
	{min: 7, result: () => { const p = RNG(2); return `One parent ${fmtChoice(p === 1 ? "mother" : "father")} was a tiefling and the other ${fmtChoice(p === 1 ? "father" : "mother")} was a devil.`; }, display: "One parent was a tiefling and the other was a devil.", _races: ["Devil", "Tiefling"]},
	{min: 8, result: () => { const p = RNG(2); return `One parent ${fmtChoice(p === 1 ? "mother" : "father")} was a human and the other ${fmtChoice(p === 1 ? "father" : "mother")} was a devil.`; }, display: "One parent was a human and the other was a devil.", _races: ["Human", "Devil"]},
];

const BIRTHPLACES = [
	{min: 1, max: 50, result: "Home"},
	{min: 51, max: 55, result: "Home of a family friend"},
	{min: 56, max: 63, result: () => `Home of a healer or midwife ${choose("healer", "midwife")}`, display: "Home of a healer or midwife"},
	{min: 64, max: 65, result: () => `Carriage, cart, or wagon ${choose("carriage", "cart", "wagon")}`, display: "Carriage, cart, or wagon"},
	{min: 66, max: 68, result: () => `Barn, shed, or other outbuilding ${choose("barn", "shed", "outbuilding")}`, display: "Barn, shed, or other outbuilding"},
	{min: 69, max: 70, result: "Cave"},
	{min: 71, max: 72, result: "Field"},
	{min: 73, max: 74, result: "Forest"},
	{min: 75, max: 77, result: "Temple"},
	{min: 78, result: "Battlefield"},
	{min: 79, max: 80, result: () => `Alley or street ${choose("alley", "street")}`, display: "Alley or street"},
	{min: 81, max: 82, result: () => `Brothel, tavern, or inn ${choose("brothel", "tavern", "inn")}`, display: "Brothel, tavern, or inn"},
	{min: 83, max: 84, result: () => `Castle, keep, tower, or palace ${choose("castle", "keep", "tower", "palace")}`, display: "Castle, keep, tower, or palace"},
	{min: 85, result: () => `Sewer or rubbish heap ${choose("sewer", "rubbish heap")}`, display: "Sewer or rubbish heap"},
	{min: 86, max: 88, result: "Among people of a different race"},
	{min: 89, max: 91, result: () => `On board a boat or a ship ${choose("boat", "ship")}`, display: "On board a boat or a ship"},
	{min: 92, max: 93, result: () => `In a prison or in the headquarters of a secret organization ${choose("prison", "headquarters of a secret organization")}`, display: "In a prison or in the headquarters of a secret organization"},
	{min: 94, max: 95, result: "In a sage's laboratory"},
	{min: 96, result: "In the Feywild"},
	{min: 97, result: "In the Shadowfell"},
	{min: 98, result: () => `On the Astral Plane or the Ethereal Plane ${choose("Astral Plane", "Ethereal Plane")}`, display: "On the Astral Plane or the Ethereal Plane"},
	{min: 99, result: "On an Inner Plane of your choice"},
	{min: 100, result: "On an Outer Plane of your choice"},
];

function absentParent (parent) {
	return GenUtil.getFromTable(ABSENT_PARENT, RNG(4)).result.replace("parent", `$& ${fmtChoice(parent)}</i>`);
}

function absentBothParents () {
	const p = ["mother", "father"][RNG(2) - 1];
	return `${absentParent(p)} ${absentParent(otherParent(p))}`;
}

function otherParent (parent) {
	return parent === "mother" ? "father" : "mother";
}

function singleParentOrStep (parent) {
	const p = RNG(2);
	return `Single ${parent} or step${parent} ${fmtChoice(p === 1 ? parent : `step${parent}`)}. ${p === 1 ? `${absentParent(otherParent(parent))}` : absentBothParents()}`;
}

const FAMILY = [
	{min: 1, result: () => `None. ${absentBothParents()}`, display: "None"},
	{min: 2, result: () => `Institution, such as an asylum. ${absentBothParents()}`, display: "Institution, such as an asylum"},
	{min: 3, result: () => `Temple. ${absentBothParents()}`, display: "Temple"},
	{min: 4, max: 5, result: () => `Orphanage. ${absentBothParents()}`, display: "Orphanage"},
	{min: 6, max: 7, result: () => `Guardian. ${absentBothParents()}`, display: "Guardian"},
	{min: 8, max: 15, result: () => `Paternal or maternal aunt, uncle, or both; or extended family such as a tribe or clan ${choose("paternal uncle", "maternal aunt", "paternal uncle and maternal aunt", "extended family such as a tribe or clan")}. ${absentBothParents()}`, display: "Paternal or maternal aunt, uncle, or both; or extended family such as a tribe or clan"},
	{min: 16, max: 25, result: () => `Paternal or maternal grandparent(s) ${choose("paternal grandfather", "maternal grandmother", "paternal grandfather and maternal grandmother")}. ${absentBothParents()}`, display: "Paternal or maternal grandparent(s)"},
	{min: 26, max: 35, result: () => `Adoptive family (same or different race) ${choose("same race", "different race")}. ${absentBothParents()}`, display: "Adoptive family (same or different race)"},
	{min: 36, max: 55, result: () => singleParentOrStep("father"), display: "Single father or stepfather"},
	{min: 56, max: 75, result: () => singleParentOrStep("mother"), display: "Single mother or stepmother"},
	{min: 76, max: 100, result: "Mother and father"},
];

const ABSENT_PARENT = [
	{min: 1, result: () => `Your parent died (${rollSuppDeath().result.lowercaseFirst()}).`, display: "Your parent died (roll on the {@table Supplemental Tables; Cause of Death|XGE|Cause of Death} supplemental table)."},
	{min: 2, result: () => `Your parent was imprisoned, enslaved, or otherwise taken away ${choose("imprisoned", "enslaved", "otherwise taken away")}.`, display: "Your parent was imprisoned, enslaved, or otherwise taken away."},
	{min: 3, result: "Your parent abandoned you."},
	{min: 4, result: "Your parent disappeared to an unknown fate."},
];

const FAMILY_LIFESTYLE = [
	{min: 3, result: "Wretched (-40)", "modifier": -40},
	{min: 4, max: 5, result: "Squalid (-20)", "modifier": -20},
	{min: 6, max: 8, result: "Poor (-10)", "modifier": -10},
	{min: 9, max: 12, result: "Modest (+0)", "modifier": 0},
	{min: 13, max: 15, result: "Comfortable (+10)", "modifier": 10},
	{min: 16, max: 17, result: "Wealthy (+20)", "modifier": 20},
	{min: 18, result: "Aristocratic (+40)", "modifier": 40},
];

const CHILDHOOD_HOME = [
	{min: 0, result: "On the streets"},
	{min: 1, max: 20, result: "Rundown shack"},
	{min: 21, max: 30, result: "No permanent residence; you moved around a lot"},
	{min: 31, max: 40, result: () => `Encampment or village ${choose("encampment", "village")} in the wilderness`, display: "Encampment or village in the wilderness"},
	{min: 41, max: 50, result: "Apartment in a rundown neighborhood"},
	{min: 51, max: 70, result: "Small house"},
	{min: 71, max: 90, result: "Large house"},
	{min: 91, max: 110, result: "Mansion"},
	{min: 111, result: () => `Palace or castle ${choose("palace", "castle")}`, display: "Palace or castle"},
];

const CHILDHOOD_MEMORIES = [
	{min: 3, result: "I am still haunted by my childhood, when I was treated badly by my peers."},
	{min: 4, max: 5, result: "I spent most of my childhood alone, with no close friends."},
	{min: 6, max: 8, result: "Others saw me as being different or strange, and so I had few companions."},
	{min: 9, max: 12, result: "I had a few close friends and lived an ordinary childhood."},
	{min: 13, max: 15, result: "I had several friends, and my childhood was generally a happy one."},
	{min: 16, max: 17, result: "I always found it easy to make friends, and I loved being around people."},
	{min: 18, result: "Everyone knew who I was, and I had friends everywhere I went."},
];

const LIFE_EVENTS_AGE = [
	{min: 1, max: 20, "age": () => RNG(20), result: "20 years or younger", "events": 1},
	{min: 21, max: 59, "age": () => RNG(10) + 20, result: "21\u201430 years", "events": () => RNG(4)},
	{min: 60, max: 69, "age": () => RNG(10) + 30, result: "31\u201440 years", "events": () => RNG(6)},
	{min: 70, max: 89, "age": () => RNG(10) + 40, result: "41\u201450 years", "events": () => RNG(8)},
	{min: 90, max: 99, "age": () => RNG(10) + 50, result: "51\u201460 years", "events": () => RNG(10)},
	{min: 100, "age": () => RNG(690) + 60, result: "61 years or older", "events": () => RNG(12)}, // max age = 750; max elven age
];

function _lifeEvtResult (title, rollResult) {
	const out = {
		result: `${title}: ${rollResult.result}`,
	};
	if (rollResult.nextRoll) out.nextRoll = rollResult.nextRoll;
	return out;
}

function _lifeEvtResultArr (title, titles, ...rollResults) {
	return {
		title: title,
		result: titles.map((it, i) => `${it}: ${rollResults[i].result}`),
	};
}

let marriageIndex = 0;
function _lifeEvtPerson (title, personDetails) {
	return {
		title: title,
		result: personDetails,
	};
}

const LIFE_EVENTS = [
	{min: 1, max: 10, result: "You suffered a tragedy. Roll on the Tragedies table.", nextRoll: () => _lifeEvtResult("Tragedy", rollEvtTragedy())},
	{min: 11, max: 20, result: "You gained a bit of good fortune. Roll on the Boons table.", nextRoll: () => _lifeEvtResult("Boon", rollEvtBoon())},
	{min: 21, max: 30, result: "You fell in love or got married. If you get this result more than once, you can choose to have a child instead. Work with your DM to determine the identity of your love interest.", nextRoll: () => _lifeEvtPerson(marriageIndex++ === 0 ? "Spouse" : "Spouse/Child", getPersonDetails())},
	{min: 31, max: 40, result: () => `You made an enemy of an adventurer. Roll a {@dice d6} ${fmtChoice(RNG(6))}. An odd number indicates you are to blame for the rift, and an even number indicates you are blameless. Use the supplemental tables and work with your DM to determine this hostile character's identity and the danger this enemy poses to you.`, display: "You made an enemy of an adventurer. Roll a {@dice d6}. An odd number indicates you are to blame for the rift, and an even number indicates you are blameless. Use the supplemental tables and work with your DM to determine this hostile character's identity and the danger this enemy poses to you.", nextRoll: () => _lifeEvtPerson("Enemy", getPersonDetails({isAdventurer: true}))},
	{min: 41, max: 50, result: "You made a friend of an adventurer. Use the supplemental tables and work with your DM to add more detail to this friendly character and establish how your friendship began.", nextRoll: () => _lifeEvtPerson("Friend", getPersonDetails({isAdventurer: true}))},
	{min: 51, max: 70, result: () => `You spent time working in a job related to your background. Start the game with an extra {@dice 2d6} ${fmtChoice(RNG(6) + RNG(6))} gp.`, display: "You spent time working in a job related to your background. Start the game with an extra {@dice 2d6} gp."},
	{min: 71, max: 75, result: "You met someone important. Use the supplemental tables to determine this character's identity and how this individual feels about you. Work out additional details with your DM as needed to fit this character into your backstory.", nextRoll: () => _lifeEvtPerson("Meeting", getPersonDetails())},
	{min: 76, max: 80, result: "You went on an adventure. Roll on the Adventures table to see what happened to you. Work with your DM to determine the nature of the adventure and the creatures you encountered.", nextRoll: () => _lifeEvtResult("Adventure", rollEvtAdventure())},
	{min: 81, max: 85, result: "You had a supernatural experience. Roll on the Supernatural Events table to find out what it was.", nextRoll: () => _lifeEvtResult("Supernatural Experience", rollEvtSupernatural())},
	{min: 86, max: 90, result: "You fought in a battle. Roll on the War table to learn what happened to you. Work with your DM to come up with the reason for the battle and the factions involved. It might have been a small conflict between your community and a band of orcs, or it could have been a major battle in a larger war.", nextRoll: () => _lifeEvtResult("War", rollEvtWar())},
	{min: 91, max: 95, result: "You committed a crime or were wrongly accused of doing so. Roll on the Crime table to determine the nature of the offense and on the Punishment table to see what became of you.", nextRoll: () => _lifeEvtResultArr("Crime and Punishment", ["Crime", "Punishment"], rollEvtCrime(), rollEvtPunishment())},
	{min: 96, max: 99, result: "You encountered something magical. Roll on the Arcane Matters table.", nextRoll: () => _lifeEvtResult("Arcane Matter", rollEvtArcaneMatter())},
	{min: 100, result: "Something truly strange happened to you. Roll on the Weird Stuff table.", nextRoll: () => _lifeEvtResult("Weird Stuff", rollEvtWeird())},
];

const LIFE_EVENTS_ADVENTURES = [
	{min: 1, max: 10, result: () => `You nearly died. You have nasty scars on your body, and you are missing an ear, {@dice 1d3} ${fmtChoice(RNG(3))} fingers, or {@dice 1d4} ${fmtChoice(RNG(4))} toes.`, display: "You nearly died. You have nasty scars on your body, and you are missing an ear, {@dice 1d3} fingers, or {@dice 1d4} toes."},
	{min: 11, max: 20, result: "You suffered a grievous injury. Although the wound healed, it still pains you from time to time."},
	{min: 21, max: 30, result: "You were wounded, but in time you fully recovered."},
	{min: 31, max: 40, result: "You contracted a disease while exploring a filthy warren. You recovered from the disease, but you have a persistent cough, pockmarks on your skin, or prematurely gray hair."},
	{min: 41, max: 50, result: "You were poisoned by a trap or a monster. You recovered, but the next time you must make a saving throw against poison, you make the saving throw with disadvantage."},
	{min: 51, max: 60, result: "You lost something of sentimental value to you during your adventure. Remove one trinket from your possessions."},
	{min: 61, max: 70, result: "You were terribly frightened by something you encountered and ran away, abandoning your companions to their fate."},
	{min: 71, max: 80, result: "You learned a great deal during your adventure. The next time you make an ability check or a saving throw, you have advantage on the roll."},
	{min: 81, max: 90, result: () => `You found some treasure on your adventure. You have {@dice 2d6} ${fmtChoice(RNG(6) + RNG(6))} gp left from your share of it.`, display: "You found some treasure on your adventure. You have {@dice 2d6} gp left from your share of it."},
	{min: 91, max: 99, result: () => `You found a considerable amount of treasure on your adventure. You have {@dice 1d20 + 50} ${fmtChoice(RNG(20) + 50)} gp left from your share of it.`, display: "You found a considerable amount of treasure on your adventure. You have {@dice 1d20 + 50} gp left from your share of it."},
	{min: 100, result: "You came across a common magic item (of the DM's choice)."},
];

const LIFE_EVENTS_ARCANE_MATTERS = [
	{min: 1, result: "You were charmed or frightened by a spell."},
	{min: 2, result: "You were injured by the effect of a spell."},
	{min: 3, result: "You witnessed a powerful spell being cast by a cleric, a druid, a sorcerer, a warlock, or a wizard."},
	{min: 4, result: "You drank a potion (of the DM's choice)."},
	{min: 5, result: "You found a spell scroll (of the DM's choice) and succeeded in casting the spell it contained."},
	{min: 6, result: "You were affected by teleportation magic."},
	{min: 7, result: "You turned invisible for a time."},
	{min: 8, result: "You identified an illusion for what it was."},
	{min: 9, result: "You saw a creature being conjured by magic."},
	{min: 10, result: () => `Your fortune was read by a diviner. Roll twice on the Life Events table, but don't apply the results. Instead, the DM picks one event as a portent of your future (which might or might not come true). ${fmtChoice(GenUtil.getFromTable(LIFE_EVENTS, RNG(100)).display || GenUtil.getFromTable(LIFE_EVENTS, RNG(100)).result)} ${fmtChoice(GenUtil.getFromTable(LIFE_EVENTS, RNG(100)).display || GenUtil.getFromTable(LIFE_EVENTS, RNG(100)).result)}`, display: "Your fortune was read by a diviner. Roll twice on the Life Events table, but don't apply the results. Instead, the DM picks one event as a portent of your future (which might or might not come true)."},
];

const LIFE_EVENTS_BOONS = [
	{min: 1, result: "A friendly wizard gave you a spell scroll containing one cantrip (of the DM's choice)."},
	{min: 2, result: "You saved the life of a commoner, who now owes you a life debt. This individual accompanies you on your travels and performs mundane tasks for you, but will leave if neglected, abused, or imperiled. Determine details about this character by using the supplemental tables and working with your DM."},
	{min: 3, result: "You found a {@item riding horse}."},
	{min: 4, result: () => `You found some money. You have {@dice 1d20} ${fmtChoice(RNG(20))} gp in addition to your regular starting funds.`, display: "You found some money. You have {@dice 1d20} gp in addition to your regular starting funds."},
	{min: 5, result: "A relative bequeathed you a simple weapon of your choice."},
	{min: 6, result: () => `You found something interesting. You gain one additional trinket ${fmtChoice(rollTrinket())}.`, display: "You found something interesting. You gain one additional trinket."},
	{min: 7, result: "You once performed a service for a local temple. The next time you visit the temple, you can receive healing up to your hit point maximum."},
	{min: 8, result: "A friendly alchemist gifted you with a potion of healing or a flask of acid, as you choose."},
	{min: 9, result: "You found a treasure map."},
	{min: 10, result: () => `A distant relative left you a stipend that enables you to live at the comfortable lifestyle for {@dice 1d20} ${fmtChoice(RNG(20))} years. If you choose to live at a higher lifestyle, you reduce the price of the lifestyle by 2 gp during that time period.`, display: "A distant relative left you a stipend that enables you to live at the comfortable lifestyle for {@dice 1d20} years. If you choose to live at a higher lifestyle, you reduce the price of the lifestyle by 2 gp during that time period."},
];

const LIFE_EVENTS_CRIME = [
	{min: 1, result: "Murder"},
	{min: 2, result: "Theft"},
	{min: 3, result: "Burglary"},
	{min: 4, result: "Assault"},
	{min: 5, result: "Smuggling"},
	{min: 6, result: "Kidnapping"},
	{min: 7, result: "Extortion"},
	{min: 8, result: "Counterfeiting"},
];

const LIFE_EVENTS_PUNISHMENT = [
	{min: 1, max: 3, result: "You did not commit the crime and were exonerated after being accused."},
	{min: 4, max: 6, result: "You committed the crime or helped do so, but nonetheless the authorities found you not guilty."},
	{min: 7, max: 8, result: "You were nearly caught in the act. You had to flee and are wanted in the community where the crime occurred."},
	{min: 9, max: 12, result: () => `You were caught and convicted. You spent time in jail, chained to an oar, or performing hard labor. You served a sentence of {@dice 1d4} years ${fmtChoice(RNG(4))} or succeeded in escaping after that much time.`, display: "You were caught and convicted. You spent time in jail, chained to an oar, or performing hard labor. You served a sentence of {@dice 1d4} years or succeeded in escaping after that much time."},
];

const LIFE_EVENTS_SUPERNATURAL = [
	{min: 1, max: 5, result: () => `You were ensorcelled by a fey and enslaved for {@dice 1d6} ${fmtChoice(RNG(6))} years before you escaped.`, display: "You were ensorcelled by a fey and enslaved for {@dice 1d6} years before you escaped."},
	{min: 6, max: 10, result: "You saw a demon and ran away before it could do anything to you."},
	{min: 11, max: 15, result: () => `A devil tempted you. Make a DC 10 Wisdom saving throw. On a failed save, your alignment shifts one step toward evil (if it's not evil already), and you start the game with an additional {@dice 1d20 + 50} ${fmtChoice(RNG(20) + 50)} gp.`, display: "A devil tempted you. Make a DC 10 Wisdom saving throw. On a failed save, your alignment shifts one step toward evil (if it's not evil already), and you start the game with an additional {@dice 1d20 + 50} gp."},
	{min: 16, max: 20, result: "You woke up one morning miles from your home, with no idea how you got there."},
	{min: 21, max: 30, result: "You visited a holy site and felt the presence of the divine there."},
	{min: 31, max: 40, result: "You witnessed a falling red star, a face appearing in the frost, or some other bizarre happening. You are certain that it was an omen of some sort."},
	{min: 41, max: 50, result: "You escaped certain death and believe it was the intervention of a god that saved you."},
	{min: 51, max: 60, result: "You witnessed a minor miracle."},
	{min: 61, max: 70, result: "You explored an empty house and found it to be haunted."},
	{min: 71, max: 75, result: () => { const p = RNG(6); return `You were briefly possessed. Roll a {@dice d6} to determine what type of creature possessed you: 1, celestial; 2, devil; 3, demon; 4, fey; 5, elemental; 6, undead ${fmtChoice(`${p}; ${["celestial", "devil", "demon", "fey", "elemental", "undead"][p - 1]}`)}.`; }, display: "You were briefly possessed. Roll a {@dice d6} to determine what type of creature possessed you: 1, celestial; 2, devil; 3, demon; 4, fey; 5, elemental; 6, undead."},
	{min: 76, max: 80, result: "You saw a ghost."},
	{min: 81, max: 85, result: "You saw a ghoul feeding on a corpse."},
	{min: 86, max: 90, result: "A celestial or a fiend visited you in your dreams to give a warning of dangers to come."},
	{min: 91, max: 95, result: () => `You briefly visited the Feywild or the Shadowfell ${choose("Feywild", "Shadowfell")}.`, "results": "You briefly visited the Feywild or the Shadowfell."},
	{min: 96, max: 100, result: "You saw a portal that you believe leads to another plane of existence."},
];

const LIFE_EVENTS_TRAGEDIES = [
	{min: 1, max: 2, result: () => `A family member or a close friend died. Roll on the {@table Supplemental Tables; Cause of Death|XGE|Cause of Death} supplemental table to find out how.`, display: "A family member or a close friend died. Roll on the Cause of Death supplemental table to find out how.", nextRoll: () => _lifeEvtResult("Cause of Death", rollSuppDeath())},
	{min: 3, result: "A friendship ended bitterly, and the other person is now hostile to you. The cause might have been a misunderstanding or something you or the former friend did."},
	{min: 4, result: "You lost all your possessions in a disaster, and you had to rebuild your life."},
	{min: 5, result: () => `You were imprisoned for a crime you didn't commit and spent {@dice 1d6} ${fmtChoice(RNG(6))} years at hard labor, in jail, or shackled to an oar in a slave galley.`, display: "You were imprisoned for a crime you didn't commit and spent {@dice 1d6} years at hard labor, in jail, or shackled to an oar in a slave galley."},
	{min: 6, result: "War ravaged your home community, reducing everything to rubble and ruin. In the aftermath, you either helped your town rebuild or moved somewhere else."},
	{min: 7, result: "A lover disappeared without a trace. You have been looking for that person ever since."},
	{min: 8, result: "A terrible blight in your home community caused crops to fail, and many starved. You lost a sibling or some other family member."},
	{min: 9, result: "You did something that brought terrible shame to you in the eyes of your family. You might have been involved in a scandal, dabbled in dark magic, or offended someone important. The attitude of your family members toward you becomes indifferent at best, though they might eventually forgive you."},
	{min: 10, result: "For a reason you were never told, you were exiled from your community. You then either wandered in the wilderness for a time or promptly found a new place to live."},
	{min: 11, result: () => `A romantic relationship ended. Roll a {@dice d6} ${fmtChoice(RNG(6))}. An odd number means it ended with bad feelings, while an even number means it ended amicably.`, display: "A romantic relationship ended. Roll a {@dice d6}. An odd number means it ended with bad feelings, while an even number means it ended amicably."},
	{min: 12, result: () => `A current or prospective romantic partner of yours died. Roll on the {@table Supplemental Tables; Cause of Death|XGE|Cause of Death} supplemental table to find out how. If the result is murder, roll a {@dice d12}. On a 1, you were responsible, whether directly or indirectly.`, display: "A current or prospective romantic partner of yours died. Roll on the {@table Supplemental Tables; Cause of Death|XGE|Cause of Death} supplemental table to find out how. If the result is murder, roll a {@dice d12}. On a 1, you were responsible, whether directly or indirectly.", nextRoll: () => _lifeEvtResult("Cause of Death", (() => { const r = RNG(12); const p = GenUtil.getFromTable(SUPP_DEATH, r); return {result: `${p.result}${r === 2 && RNG(12) === 1 ? ` ${fmtChoice("you were responsible")}` : ""}`}; })())},
];

const LIFE_EVENTS_WAR = [
	{min: 1, result: "You were knocked out and left for dead. You woke up hours later with no recollection of the battle."},
	{min: 2, max: 3, result: "You were badly injured in the fight, and you still bear the awful scars of those wounds."},
	{min: 4, result: "You ran away from the battle to save your life, but you still feel shame for your cowardice."},
	{min: 5, max: 7, result: "You suffered only minor injuries, and the wounds all healed without leaving scars."},
	{min: 8, max: 9, result: "You survived the battle, but you suffer from terrible nightmares in which you relive the experience."},
	{min: 10, max: 11, result: "You escaped the battle unscathed, though many of your friends were injured or lost."},
	{min: 12, result: "You acquitted yourself well in battle and are remembered as a hero. You might have received a medal for your bravery."},
];

const LIFE_EVENTS_WEIRD_STUFF = [
	{min: 1, result: () => `You were turned into a toad and remained in that form for {@dice 1d4} ${fmtChoice(RNG(4))} weeks.`, display: "You were turned into a toad and remained in that form for {@dice 1d4} weeks."},
	{min: 2, result: "You were petrified and remained a stone statue for a time until someone freed you."},
	{min: 3, result: () => `You were enslaved by a hag, a satyr, or some other being and lived in that creature's thrall for {@dice 1d6} ${fmtChoice(RNG(6))} years.`, display: "You were enslaved by a hag, a satyr, or some other being and lived in that creature’s thrall for {@dice 1d6} years."},
	{min: 4, result: () => `A dragon held you as a prisoner for {@dice 1d4} ${fmtChoice(RNG(4))} months until adventurers killed it.`, display: "A dragon held you as a prisoner for {@dice 1d4} months until adventurers killed it."},
	{min: 5, result: "You were taken captive by a race of evil humanoids such as drow, kuo-toa, or quaggoths. You lived as a slave in the Underdark until you escaped."},
	{min: 6, result: "You served a powerful adventurer as a hireling. You have only recently left that service. Use the supplemental tables and work with your DM to determine the basic details about your former employer.", nextRoll: () => _lifeEvtPerson("Employer", getPersonDetails({isAdventurer: true}))},
	{min: 7, result: () => `You went insane for {@dice 1d6} ${fmtChoice(RNG(6))} years and recently regained your sanity. A tic or some other bit of odd behavior might linger.`, display: "You went insane for {@dice 1d6} years and recently regained your sanity. A tic or some other bit of odd behavior might linger."},
	{min: 8, result: "A lover of yours was secretly a silver dragon."},
	{min: 9, result: "You were captured by a cult and nearly sacrificed on an altar to the foul being the cultists served. You escaped, but you fear they will find you."},
	{min: 10, result: () => `You met a demigod, an archdevil, an archfey, a demon lord, or a titan, ${choose("demigod", "archdevil", "archfey", "demon lord", "titan")} and you lived to tell the tale.`, display: "You met a demigod, an archdevil, an archfey, a demon lord, or a titan, and you lived to tell the tale."},
	{min: 11, result: "You were swallowed by a giant fish and spent a month in its gullet before you escaped."},
	{min: 12, result: () => `A powerful being granted you a wish, but you squandered it on something frivolous.`, display: "A powerful being granted you a wish, but you squandered it on something frivolous."},
];

const SUPP_ALIGNMENT = [
	{min: 1, max: 3, result: () => rollOnArray(["Chaotic evil", "Chaotic neutral"]), display: "Chaotic evil (50%) or chaotic neutral (50%)"},
	{min: 4, max: 5, result: "Lawful evil"},
	{min: 6, max: 8, result: "Neutral evil"},
	{min: 9, max: 12, result: "Neutral"},
	{min: 13, max: 15, result: "Neutral good"},
	{min: 16, max: 17, result: () => rollOnArray(["Lawful good", "Lawful neutral"]), display: "Lawful good (50%) or lawful neutral (50%)"},
	{min: 18, result: () => rollOnArray(["Chaotic good", "Chaotic neutral"]), display: "Chaotic good (50%) or chaotic neutral (50%)"},
];

const SUPP_DEATH = [
	{min: 1, result: "Cause unknown"},
	{min: 2, result: "Murdered"},
	{min: 3, result: "Killed in battle"},
	{min: 4, result: "Accident related to class or occupation"},
	{min: 5, result: "Accident unrelated to class or occupation"},
	{min: 6, max: 7, result: "Natural causes, such as disease or old age"},
	{min: 8, result: "Apparent suicide"},
	{min: 9, result: () => `Torn apart by an animal or a natural disaster ${choose("animal", "natural disaster")}`, display: "Torn apart by an animal or a natural disaster"},
	{min: 10, result: () => "Consumed by a monster"},
	{min: 11, result: () => `Executed for a crime or tortured to death ${choose("executed for a crime", "tortured to death")}`, display: "Executed for a crime or tortured to death"},
	{min: 12, result: "Bizarre event, such as being hit by a meteorite, struck down by an angry god, or killed by a hatching slaad egg"},
];

const SUPP_CLASS = [
	{min: 1, max: 7, result: "Barbarian"},
	{min: 8, max: 14, result: "Bard"},
	{min: 15, max: 29, result: "Cleric"},
	{min: 30, max: 36, result: "Druid"},
	{min: 37, max: 52, result: "Fighter"},
	{min: 53, max: 58, result: "Monk"},
	{min: 59, max: 64, result: "Paladin"},
	{min: 65, max: 70, result: "Ranger"},
	{min: 71, max: 84, result: "Rogue"},
	{min: 85, max: 89, result: "Sorcerer"},
	{min: 90, max: 94, result: "Warlock"},
	{min: 95, max: 100, result: "Wizard"},
];

const SUPP_OCCUPATION = [
	{min: 1, max: 5, result: "Academic"},
	{min: 6, max: 10, result: () => `Adventurer (${rollSuppClass().result})`, display: "Adventurer (roll on the Class table)"},
	{min: 11, result: "Aristocrat"},
	{min: 12, max: 26, result: () => `Artisan or guild member ${choose("artisan", "guild member")}`, display: "Artisan or guild member"},
	{min: 27, max: 31, result: "Criminal"},
	{min: 32, max: 36, result: "Entertainer"},
	{min: 37, max: 38, result: () => `Exile, hermit, or refugee ${choose("exile", "hermit", "refugee")}`, display: "Exile, hermit, or refugee"},
	{min: 39, max: 43, result: () => `Explorer or wanderer ${choose("explorer", "wanderer")}`, display: "Explorer or wanderer"},
	{min: 44, max: 55, result: () => `Farmer or herder ${choose("farmer", "herder")}`, display: "Farmer or herder"},
	{min: 56, max: 60, result: () => `Hunter or trapper ${choose("hunter", "trapper")}`, display: "Hunter or trapper"},
	{min: 61, max: 75, result: "Laborer"},
	{min: 76, max: 80, result: "Merchant"},
	{min: 81, max: 85, result: () => `Politician or bureaucrat ${choose("politician", "bureaucrat")}`, display: "Politician or bureaucrat"},
	{min: 86, max: 90, result: "Priest"},
	{min: 91, max: 95, result: "Sailor"},
	{min: 96, max: 100, result: "Soldier"},
];

const SUPP_RACE = [
	{min: 1, max: 40, result: "Human"},
	{min: 41, max: 50, result: "Dwarf"},
	{min: 51, max: 60, result: "Elf"},
	{min: 61, max: 70, result: "Halfling"},
	{min: 71, max: 75, result: "Dragonborn"},
	{min: 76, max: 80, result: "Gnome"},
	{min: 81, max: 85, result: "Half-elf"},
	{min: 86, max: 90, result: "Half-orc"},
	{min: 91, max: 95, result: "Tiefling"},
	{min: 96, max: 100, result: "DM’s choice"},
];

const SUPP_RELATIONSHIP = [
	{min: 3, max: 4, result: "Hostile"},
	{min: 5, max: 10, result: "Friendly"},
	{min: 11, max: 12, result: "Indifferent"},
];

const SUPP_STATUS = [
	{min: 3, result: () => { return `Dead (${rollSuppDeath().result.lowercaseFirst()})`; }, display: "Dead (roll on the Cause of Death table)", "dead": true},
	{min: 4, max: 5, result: () => `Missing or status unknown ${choose("missing", "status unknown")}`, display: "Missing or status unknown"},
	{min: 6, max: 8, result: () => `Alive, but doing poorly due to injury, financial trouble, or relationship difficulties ${choose("injury", "financial trouble", "relationship difficulties")}`, display: "Alive, but doing poorly due to injury, financial trouble, or relationship difficulties"},
	{min: 9, max: 12, result: "Alive and well"},
	{min: 13, max: 15, result: "Alive and quite successful"},
	{min: 16, max: 17, result: "Alive and infamous"},
	{min: 18, result: "Alive and famous"},
];

let classList;
let bgList;
let trinketList;
let nameTables;
let $selCha;
let $selRace;
let $selBg;
let $selClass;
let $selAge;

function rollTrinket () {
	return rollOnArray(trinketList);
}

function onJsonLoad (lifeData, nameData) {
	bgList = lifeData.lifeBackground.sort((a, b) => SortUtil.ascSort(a.name, b.name));
	classList = lifeData.lifeClass.sort((a, b) => SortUtil.ascSort(a.name, b.name));
	trinketList = lifeData.lifeTrinket;

	$selRace = $(`#race`).empty().attr("disabled", false);
	$selCha = $(`#cha`).empty().attr("disabled", false);
	$selBg = $(`#background`).empty().attr("disabled", false);
	$selClass = $(`#class`).empty().attr("disabled", false);
	$selAge = $(`#age`).empty().attr("disabled", false);

	$selRace.append(`<option value="Random" selected>Random</option>`);
	$selRace.append(`<option value="Other">Other</option>`);
	RACES_SELECTABLE.forEach(r => $selRace.append(`<option value="${r}">${r}</option>`));
	RACES_UNSELECTABLE.forEach(r => $selRace.append(`<option class="italic" value="${r}">${r}</option>`));
	$selCha.append(`<option value="Random">Random</option>`);
	for (let i = -5; i <= 5; ++i) {
		$selCha.append(`<option value="${i}" ${i === 0 ? "selected" : ""}>${i >= 0 ? "+" : ""}${i}</option>`);
	}
	$selBg.append(`<option value="-1" selected>Random</option>`);
	bgList.forEach((b, i) => $selBg.append(`<option value="${i}">${b.name}</option>`));
	$selClass.append(`<option value="-1" selected>Random</option>`);
	classList.forEach((c, i) => $selClass.append(`<option value="${i}">${c.name}</option>`));

	[
		{val: "", text: "Random", style: "font-style: normal;"},
		{val: "1", text: "20 years or younger", class: "italic"},
		{val: "21", text: "21&mdash;30 years", class: "italic"},
		{val: "60", text: "31&mdash;40 years", class: "italic"},
		{val: "70", text: "41&mdash;50 years", class: "italic"},
		{val: "90", text: "51&mdash;60 years", class: "italic"},
		{val: "100", text: "61 years or older", class: "italic"},
	].forEach(age => $selAge.append(`<option value="${age.val}" ${age.style ? `style="${age.style}"` : ""} ${age.class ? `class="${age.class}"` : ""}>${age.text}</option>`));

	nameTables = {};
	nameData.name.filter(it => it.source === SRC_XGE)
		.forEach(nameMeta => {
			nameTables[Parser.stringToSlug(nameMeta.name)] = nameMeta;

			if (nameMeta.name === "Elf" || nameMeta.name === "Human") {
				const cpy = MiscUtil.copy(nameMeta);
				if (nameTables["halfelf"]) nameTables["halfelf"].tables.push(...cpy.tables);
				else nameTables["halfelf"] = cpy;
			} else if (nameMeta.name === "Half-Orc") {
				nameTables["orc"] = MiscUtil.copy(nameMeta);
			} else if (nameMeta.name === "Tiefling") {
				const cpy = MiscUtil.copy(nameMeta);
				cpy.tables = cpy.tables.filter(it => it.option !== "Virtue");
				nameTables["devil"] = MiscUtil.copy(nameMeta);
			}
		});
}

function concatSentences (...lst) {
	const stack = [];
	lst.filter(it => it).forEach(it => {
		if (typeof it === "string" || typeof it === "number") {
			stack.push(it);
		} else if (typeof it === "function") {
			stack.push(it());
		} else { // array
			Array.prototype.push.apply(stack, ...it);
		}
	});
	return joinParaList(stack);
}

function joinParaList (lst) {
	if (lst.join) return lst.join(`<br>`);
	return lst;
}

const _VOWELS = ["a", "e", "i", "o", "u"];
function addN (name) {
	const c = name[0].toLowerCase();
	return _VOWELS.includes(c) ? "n" : "";
}

// SECTIONS ============================================================================================================
// generated in Parents, but used throughout
let knowParents;
let race;
let parentRaces;
let ptrParentLastName = {}; // store the last name so we can use it for both parents, maybe
// PARENTS
function sectParents () {
	knowParents = RNG(100) > 5;
	const selRace = $selRace.val();
	race = (() => {
		if (selRace === "Random") return GenUtil.getFromTable(SUPP_RACE, RNG(100)).result;
		else if (selRace === "Other") {
			// generate anything besides the values displayed in the dropdown
			let out;
			do out = GenUtil.getFromTable(SUPP_RACE, RNG(100)).result;
			while (RACES_SELECTABLE.includes(out));
			return out;
		} else return selRace;
	})();

	const $parents = $(`#parents`);
	const knowParentsStr = knowParents ? "<b>Parents:</b> You know who your parents are or were." : "<b>Parents:</b> You do not know who your parents were.";

	let parentage = null;
	if (knowParents) {
		switch (race.toLowerCase()) {
			case "half-elf": {
				const rolled = GenUtil.getFromTable(PARENTS_HALF_ELF, RNG(8));
				parentage = `<b>${race} parents:</b> ${rolled.result}`;
				parentRaces = rolled._races;
				break;
			}
			case "half-orc": {
				const rolled = GenUtil.getFromTable(PARENTS_HALF_ORC, RNG(8));
				parentage = `<b>${race} parents:</b> ${rolled.result}`;
				parentRaces = rolled._races;
				break;
			}
			case "tiefling": {
				const rolled = GenUtil.getFromTable(PARENTS_TIEFLING, RNG(8));
				parentage = `<b>${race} parents:</b> ${rolled.result}`;
				parentRaces = rolled._races;
				break;
			}
			default:
				parentRaces = [race];
				break;
		}
	}

	if (selRace === "Other") {
		$parents.html(concatSentences(`<b>Race:</b> Other ${fmtChoice(`${race}; generated using the {@table Supplemental Tables; Race|XGE|Supplemental Race} table`, true)}`, knowParentsStr, parentage));
	} else {
		$parents.html(concatSentences(`<b>Race:</b> ${race}${selRace === "Random" ? ` ${fmtChoice("generated using the {@table Supplemental Tables; Race|XGE|Supplemental Race} table", true)}` : ""}`, knowParentsStr, parentage));
	}

	if (knowParents) {
		parentRaces.shuffle();
		const mum = getPersonDetails({
			isParent: true,
			race: parentRaces[0],
			gender: "Female",
		});
		if (RNG(2) === 1) delete ptrParentLastName._; // 50% chance not to share a last name
		const dad = getPersonDetails({
			isParent: true,
			race: parentRaces.length > 1 ? parentRaces[1] : parentRaces[0],
			gender: "Male",
		});
		$parents.append(`<h5>Mother</h5>`);
		$parents.append(joinParaList(mum));
		$parents.append(`<h5>Father</h5>`);
		$parents.append(joinParaList(dad));
	}
}

// BIRTHPLACE
function sectBirthplace () {
	const $birthplace = $(`#birthplace`);
	const rollBirth = RNG(100);
	const birth = `<b>Birthplace:</b> ${GenUtil.getFromTable(BIRTHPLACES, rollBirth).result}`;

	const strangeBirth = RNG(100) === 100 ? "A strange event coincided with your birth: the moon briefly turning red, all the milk within a mile spoiling, the water in the area freezing solid in midsummer, all the iron in the home rusting or turning to silver, or some other unusual event of your choice" : "";
	$birthplace.html(concatSentences(birth, strangeBirth));
}

// SIBLINGS
function sectSiblings () {
	const $siblings = $(`#siblings`);
	function getBirthOrder () {
		const rollBirthOrder = RNG(6) + RNG(6);
		if (rollBirthOrder < 3) {
			return "Twin, triplet, or quadruplet";
		} else if (rollBirthOrder < 8) {
			return "Older";
		} else {
			return "Younger";
		}
	}

	const rollSibCount = RNG(5);
	let sibCount = 0;
	switch (rollSibCount) {
		case 2:
			sibCount = RNG(3);
			break;
		case 3:
			sibCount = RNG(4) + 1;
			break;
		case 4:
			sibCount = RNG(6) + 2;
			break;
		case 5:
			sibCount = RNG(8) + 3;
			break;
	}
	if (race === "Elf" || race === "Dwarf") {
		sibCount = Math.max(sibCount - 2, 0);
	}

	if (sibCount > 0) {
		$siblings.empty();
		$siblings.append(`<p>You have ${sibCount} sibling${sibCount > 1 ? "s" : ""}.</p>`);
		for (let i = 0; i < sibCount; ++i) {
			const siblingType = rollOnArray(["brother", "sister"]);
			$siblings.append(`<h5>${getBirthOrder()} sibling ${fmtChoice(siblingType, true)}</h5>`);
			$siblings.append(joinParaList(getPersonDetails({
				gender: siblingType === "brother" ? "Male" : "Female",
				parentRaces: parentRaces,
				isSibling: true,
			})));
		}
	} else {
		$siblings.html("You are an only child.");
	}
}

// FAMILY
function sectFamily () {
	function getChaVal () {
		const raw = $selCha.val();
		if (raw === "Random") return RollerUtil.randomise(11) - 6;
		else return Number(raw);
	}

	const $family = $(`#family`);
	$family.empty();
	$family.append(`<b>Family:</b> ${GenUtil.getFromTable(FAMILY, RNG(100)).result}<br>`);
	let famIndex = 1;
	const $btnSuppFam = $(`<button class="btn btn-xs btn-default btn-supp-fam no-print"></button>`).on("click", () => {
		const supDetails = getPersonDetails();
		const $wrpRes = $(`<div class="life__output-wrp-border p-3 my-2"/>`);
		$wrpRes.append(`<h5 class="mt-0">Family Member Roll ${famIndex++}</h5>`);
		$wrpRes.append(joinParaList(supDetails));
		$btnSuppFam.css("margin-bottom", 5);
		$btnSuppFam.after($wrpRes);
	});
	$family.append(`<span class="note">You can roll on the Relationship table to determine how your family members or other important figures in your life feel about you. You can also use the Race, Occupation, and Alignment tables to learn more about the family members or guardians who raised you.</span>`);
	$family.append($btnSuppFam);

	const rollFamLifestyle = GenUtil.getFromTable(FAMILY_LIFESTYLE, RNG(6) + RNG(6) + RNG(6));
	$family.append(`<b>Family lifestyle:</b> ${rollFamLifestyle.result}<br>`);
	const rollFamHome = Math.min(Math.max(RNG(100) + rollFamLifestyle.modifier, 0), 111);
	const rollFamHomeRes = GenUtil.getFromTable(CHILDHOOD_HOME, rollFamHome).result;
	$family.append(`<b>Childhood Home:</b> ${rollFamHomeRes}<br>`);

	const rollChildMems = Math.min(Math.max(RNG(6) + RNG(6) + RNG(6) + getChaVal(), 3), 18);
	$family.append(`<b>Childhood memories</b>: ${GenUtil.getFromTable(CHILDHOOD_MEMORIES, rollChildMems).result}`);
}

// PERSONAL DECISIONS
function sectPersonalDecisions () {
	const $personal = $(`#personal`).empty();
	const selBg = Number($selBg.val());
	const myBg = selBg === -1 ? rollOnArray(bgList) : bgList[selBg];
	$personal.append(`<b>Background:</b> ${myBg.name}<br>`);
	$personal.append(`<b>I became a${addN(myBg.name)} ${myBg.name} because:</b> ${rollOnArray(myBg.reasons)}`);
}

// CLASS TRAINING
function sectClassTraining () {
	const $clss = $(`#clss`).empty();
	const selClass = Number($selClass.val());
	const myClass = selClass === -1 ? rollOnArray(classList) : classList[selClass];
	$clss.append(`<b>Class:</b> ${myClass.name}<br>`);
	$clss.append(`<b>I became a${addN(myClass.name)} ${myClass.name} because:</b> ${rollOnArray(myClass.reasons)}`);
}

// LIFE EVENTS
function sectLifeEvents () {
	const $events = $(`#events`).empty();
	marriageIndex = 0;
	const age = GenUtil.getFromTable(LIFE_EVENTS_AGE, Number($selAge.val()) || RNG(100));
	$events.append(`<b>Current age:</b> ${age.result} ${fmtChoice(`${age.age} year${age.age > 1 ? "s" : ""} old`, true)}`);

	for (let i = 0; i < age.events; ++i) {
		const $dispResult = $(`<div></div>`);
		const $dispNextRoll = $(`<div></div>`);

		const recurseNextRolls = (evt) => {
			if (!evt.nextRoll) return;

			if (evt.nextRoll.title) {
				$(`<div class="life__output-wrp-border p-3 my-2">
					<h5 class="mt-0">${evt.nextRoll.title}</h5>
					${joinParaList(evt.nextRoll.result)}
				</div>`).appendTo($dispNextRoll);
			} else {
				$dispNextRoll.append(`${joinParaList(evt.nextRoll.result)}<br>`);
			}

			return recurseNextRolls(evt.nextRoll);
		};

		const doRollAndDisplay = ({isScrollIntoView = false} = {}) => {
			const evt = GenUtil.getFromTable(LIFE_EVENTS, RNG(100));
			$dispResult.html(evt.result);
			$dispNextRoll.empty();
			recurseNextRolls(evt);
			if (isScrollIntoView) $wrpEvent[0].scrollIntoView({block: "nearest", inline: "nearest"});
		};

		doRollAndDisplay();

		const $btnReroll = $(`<button class="btn btn-default btn-xxs">Reroll</button>`)
			.click(() => doRollAndDisplay({isScrollIntoView: true}));

		const $wrpEvent = $$`<div class="flex-col">
			<div class="flex-v-center mb-1 mt-2">
				<h5 class="my-0 mr-2">Life Event ${i + 1}</h5>
				${$btnReroll}
			</div>
			${$dispResult}
			${$dispNextRoll}
		</div>`.appendTo($events);
	}
}

function roll () {
	$(`.life__output`).removeClass("ve-hidden");

	sectParents();
	sectBirthplace();
	sectSiblings();
	sectFamily();
	sectPersonalDecisions();
	sectClassTraining();
	sectLifeEvents();
}

window.addEventListener("load", async () => {
	ExcludeUtil.pInitialise(); // don't await, as this is only used for search
	const [lifeData, nameData] = await Promise.all([
		DataUtil.loadJSON("data/life.json"),
		DataUtil.loadJSON("data/names.json"),
	]);
	onJsonLoad(lifeData, nameData);

	$(`#age`).on("change", function () {
		if ($(this).val()) {
			$(this).addClass("italic");
		} else {
			$(this).removeClass("italic");
		}
	});

	$(`#xge_link`).replaceWith(Renderer.get().render(`{@book Xanathar's Guide to Everything|XGE|1|This Is Your Life}`));

	window.dispatchEvent(new Event("toolsLoaded"));
});
