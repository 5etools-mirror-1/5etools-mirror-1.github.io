import {PANEL_TYP_INITIATIVE_TRACKER} from "./dmscreen-consts.js";
import {DmScreenUtil} from "./dmscreen-util.js";

const _TIME_TRACKER_MOON_SPRITE = new Image();
export const TIME_TRACKER_MOON_SPRITE_LOADER = new Promise(resolve => {
	_TIME_TRACKER_MOON_SPRITE.onload = resolve;
	_TIME_TRACKER_MOON_SPRITE.onerror = () => {
		_TIME_TRACKER_MOON_SPRITE.hasError = true;
		resolve();
	};
});
_TIME_TRACKER_MOON_SPRITE.src = "img/dmscreen/moon.png";

export class TimeTracker {
	static $getTracker (board, state) {
		const $wrpPanel = $(`<div class="w-100 h-100 dm-time__root dm__panel-bg dm__data-anchor"/>`) // root class used to identify for saving
			.data("getState", () => tracker.getSaveableState());
		const tracker = new TimeTrackerRoot(board, $wrpPanel);
		state = TimeTrackerUtil.getMigratedState(state);
		tracker.setStateFrom(state);
		tracker.render($wrpPanel);
		return $wrpPanel;
	}
}

class TimeTrackerUtil {
	static pGetUserWindBearing (def) {
		return InputUiUtil.pGetUserDirection({
			title: "Wind Bearing (Direction)",
			default: def,
			stepButtons: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
		});
	}

	static revSlugToText (it) {
		return it.split("-").reverse().map(s => s.split("|").join("- ")).join(" ").toTitleCase();
	}

	static getMigratedState (state) {
		if (!state?.state) return state;

		// region Migrate legacy sub-objects
		["days", "months", "years", "eras", "moons", "seasons"]
			.forEach(prop => {
				if (!state.state[prop]) return;
				if (state.state[prop] instanceof Array) return;
				if (typeof state.state[prop] !== "object") return;

				state.state[prop] = Object.values(state.state[prop])
					.map(({id, ...rest}) => ({id, data: rest}));
			});
		// endregion

		return state;
	}
}

class TimeTrackerComponent extends BaseComponent {
	/**
	 * @param board DM Screen board.
	 * @param $wrpPanel Panel wrapper element for us to populate.
	 * @param [opts] Options object.
	 * @param [opts.isTemporary] If this object should not save state to the board.
	 */
	constructor (board, $wrpPanel, opts) {
		super();
		opts = opts || {};

		this._board = board;
		this._$wrpPanel = $wrpPanel;
		if (!opts.isTemporary) this._addHookAll("state", () => this._board.doSaveStateDebounced());
	}

	getPod () {
		const out = super.getPod();
		out.triggerMapUpdate = (prop) => this._triggerMapUpdate(prop);
		return out;
	}

	/**
	 * Trigger an update for a collection, auto-filtering deleted entries. The collection stored
	 * at the prop should be a map of `id:state`.
	 * @param prop The state property.
	 */
	_triggerMapUpdate (prop) {
		this._state[prop] = Object.values(this._state[prop])
			.filter(it => !it.isDeleted)
			.mergeMap(it => ({[it.id]: it}));
	}
}

class TimeTrackerBase extends TimeTrackerComponent {
	/**
	 * @param [opts] Options object.
	 * @param [opts.isBase] True to forcibly use base time, false to let the component decide.
	 * @returns {object}
	 */
	_getTimeInfo (opts) {
		opts = opts || {};

		let numSecs;
		// Discard millis
		if (opts.numSecs != null) numSecs = opts.numSecs;
		else if (!opts.isBase && this._state.isBrowseMode && this._state.browseTime != null) numSecs = Math.round(this._state.browseTime / 1000);
		else numSecs = Math.round(this._state.time / 1000);
		numSecs = Math.max(0, numSecs);

		const secsPerMinute = this._state.secondsPerMinute;
		const secsPerHour = secsPerMinute * this._state.minutesPerHour;
		const secsPerDay = secsPerHour * this._state.hoursPerDay;

		const numDays = Math.floor(numSecs / secsPerDay);
		numSecs = numSecs - (numDays * secsPerDay);

		const numHours = Math.floor(numSecs / secsPerHour);
		numSecs = numSecs - (numHours * secsPerHour);

		const numMinutes = Math.floor(numSecs / secsPerMinute);
		numSecs = numSecs - (numMinutes * secsPerMinute);

		const dayInfos = this._state.days
			.map(it => it.data);

		const monthInfos = this._state.months
			.map(it => it.data);

		const seasonInfos = this._state.seasons
			.map(it => it.data)
			.sort((a, b) => SortUtil.ascSort(a.startDay, b.startDay));

		const yearInfos = this._state.years
			.map(it => it.data)
			.sort((a, b) => SortUtil.ascSort(a.year, b.year));

		const eraInfos = this._state.eras
			.map(it => it.data)
			.sort((a, b) => SortUtil.ascSort(a.startYear, b.startYear));

		const secsPerYear = secsPerDay * monthInfos.map(it => it.days).reduce((a, b) => a + b, 0);
		const daysPerWeek = dayInfos.length;
		const secsPerWeek = secsPerDay * daysPerWeek;
		const dayOfWeek = numDays % daysPerWeek;
		const daysPerYear = monthInfos.map(it => it.days).reduce((a, b) => a + b, 0);
		const dayOfYear = numDays % daysPerYear;

		const out = {
			// handy stats
			secsPerMinute,
			minutesPerHour: this._state.minutesPerHour,
			hoursPerDay: this._state.hoursPerDay,
			secsPerHour,
			secsPerDay,
			secsPerWeek,
			secsPerYear,
			daysPerWeek,
			daysPerYear,
			monthsPerYear: monthInfos.length,

			// clock
			numSecs,
			numMinutes,
			numHours,
			numDays,
			timeOfDaySecs: numSecs + (numMinutes * secsPerMinute) + (numHours * secsPerHour),

			// calendar
			date: 0, // current day in month, i.e. 0-30 for a 31-day month
			month: 0, // current month in year, i.e. 0-11 for a 12-month year
			year: 0,
			dayOfWeek,
			dayOfYear,
			monthStartDay: 0, // day the current month starts on, i.e. 0-6 for a 7-day week; e.g. if the first day of the current month is a Wednesday, this will be set to 2
			monthInfo: {...monthInfos[0]},
			prevMonthInfo: {...monthInfos.last()},
			nextMonthInfo: {...(monthInfos[1] || monthInfos[0])},
			dayInfo: {...dayInfos[dayOfWeek]},
			monthStartDayOfYear: 0, // day in the current year that the current month starts on, e.g. "31" for the first day of February, or "58" for the first day of March
			weekOfYear: 0,
			seasonInfos: [],
			yearInfos: [],
			eraInfos: [],
		};

		let tmpDays = numDays;
		outer: while (tmpDays > 0) {
			for (let i = 0; i < monthInfos.length; ++i) {
				const m = monthInfos[i];
				for (let j = 0; j < m.days; ++j, --tmpDays) {
					if (tmpDays === 0) {
						out.date = j;
						out.month = i;
						out.monthInfo = {...m};

						if (i > 0) out.prevMonthInfo = monthInfos[i - 1];
						if (i < monthInfos.length - 1) out.nextMonthInfo = monthInfos[i + 1];
						else out.nextMonthInfo = monthInfos[0];

						break outer;
					}
				}
				out.monthStartDayOfYear += m.days;
			}
			out.year++;
			out.monthStartDayOfYear = out.monthStartDayOfYear % daysPerYear;
		}
		out.monthStartDay = (numDays - out.date) % daysPerWeek;
		if (seasonInfos.length) out.seasonInfos = seasonInfos.filter(it => dayOfYear >= it.startDay && dayOfYear <= it.endDay);

		// offsets
		out.year += this._state.offsetYears;
		out.monthStartDay += this._state.offsetMonthStartDay; out.monthStartDay %= daysPerWeek;
		out.dayInfo = dayInfos[(dayOfWeek + this._state.offsetMonthStartDay) % daysPerWeek];

		// track the current week of the year, compensated for offsets
		out.weekOfYear = (out.year * (daysPerYear % daysPerWeek)) % daysPerWeek;
		// collect year/era info after offsets, so the user doesn't have to do math
		if (yearInfos.length) out.yearInfos = yearInfos.filter(it => out.year === it.year);
		if (eraInfos.length) {
			out.eraInfos = eraInfos.filter(it => out.year >= it.startYear && out.year <= it.endYear)
				.map(it => {
					const cpy = MiscUtil.copy(it);
					cpy.dayOfEra = out.year - cpy.startYear;
					return cpy;
				});
		}

		if (opts.year != null || opts.dayOfYear != null) {
			const now = Math.round((this._state.isBrowseMode && this._state.browseTime != null ? this._state.browseTime : this._state.time) / 1000);

			const diffSecsYear = opts.year != null ? (out.year - opts.year) * secsPerYear : 0;
			const diffSecsDay = opts.dayOfYear != null ? (dayOfYear - opts.dayOfYear) * secsPerDay : 0;
			return this._getTimeInfo({numSecs: now - (diffSecsYear + diffSecsDay)});
		} else return out;
	}

	_getEvents (year, dayOfYear) { return this._getEncountersEvents("events", year, dayOfYear); }

	_getEncounters (year, dayOfYear) { return this._getEncountersEvents("encounters", year, dayOfYear); }

	_getEncountersEvents (prop, year, dayOfYear) {
		return Object.values(this._state[prop])
			.filter(it => !it.isDeleted)
			.filter(it => {
				if (it.when.year != null && it.when.day != null) {
					return it.when.year === year && it.when.day === dayOfYear;
				}

				// TODO consider expanding this in future
				//  - will also require changes to the event creation/management UI
				// else if (it.when.weekday != null) {...}
				// else if (it.when.fortnightDay != null) {...}
				// ... etc
			})
			.sort((a, b) => {
				if (a.hasTime && !b.hasTime) return 1;
				if (!a.hasTime && b.hasTime) return -1;
				if (a.hasTime && b.hasTime) return SortUtil.ascSort(a.timeOfDaySecs, b.timeOfDaySecs) || SortUtil.ascSort(a.pos, b.pos);
				return SortUtil.ascSort(a.pos, b.pos);
			});
	}

	_getMoonInfos (numDays) {
		const moons = this._state.moons
			.map(it => it.data)
			.sort((a, b) => SortUtil.ascSort(a.phaseOffset, b.phaseOffset) || SortUtil.ascSort(a.name, b.name));

		return moons.map(moon => {
			// this should be never occur
			if (moon.period <= 0) throw new Error(`Invalid moon period "${moon.period}", should be greater than zero!`);

			const offsetNumDays = numDays - moon.phaseOffset;
			let dayOfPeriod = offsetNumDays % moon.period;
			while (dayOfPeriod < 0) dayOfPeriod += moon.period;

			const ixPhase = Math.floor((dayOfPeriod / moon.period) * 8);
			const phaseNameSlug = TimeTrackerBase._MOON_PHASES[ixPhase === 8 ? 0 : ixPhase];
			const phaseFirstDay = (Math.floor(((dayOfPeriod - 1) / moon.period) * 8) === ixPhase - 1); // going back a day would take us to the previous phase

			return {
				color: moon.color,
				name: moon.name,
				period: moon.period,
				phaseName: phaseNameSlug.split("-").map(it => it.uppercaseFirst()).join(" "),
				phaseFirstDay: phaseFirstDay,
				phaseIndex: ixPhase,
				dayOfPeriod,
			};
		});
	}

	_getAllDayInfos () {
		return this._state.days
			.map(it => it.data);
	}

	/**
	 * @param deltaSecs Time modification, in seconds.
	 * @param [opts] Options object.
	 * @param [opts.isBase] True if the base time should be forcibly modified; false if the method should choose.
	 */
	_doModTime (deltaSecs, opts) {
		opts = opts || {};
		const prop = !opts.isBase && this._state.isBrowseMode && this._state.browseTime != null ? "browseTime" : "time";
		const oldTime = this._state[prop];
		this._state[prop] = Math.max(0, oldTime + Math.round(deltaSecs * 1000));
	}

	_getDefaultState () { return MiscUtil.copy(TimeTrackerBase._DEFAULT_STATE); }

	get _rendered () { return this.__rendered; }

	getPod () {
		const pod = super.getPod();
		pod.getTimeInfo = this._getTimeInfo.bind(this);
		pod.getEvents = this._getEvents.bind(this);
		pod.getEncounters = this._getEncounters.bind(this);
		pod.getMoonInfos = this._getMoonInfos.bind(this);
		pod.doModTime = this._doModTime.bind(this);
		pod.getAllDayInfos = this._getAllDayInfos.bind(this);
		return pod;
	}

	static getGenericDay (i) {
		return {
			id: CryptUtil.uid(),
			data: {
				...TimeTrackerBase._DEFAULT_STATE__DAY,
				name: `${Parser.numberToText(i + 1)}day`.uppercaseFirst(),
			},
		};
	}

	static getGenericMonth (i) {
		return {
			id: CryptUtil.uid(),
			data: {
				...TimeTrackerBase._DEFAULT_STATE__MONTH,
				name: `${Parser.numberToText(i + 1)}uary`.uppercaseFirst(),
				days: 30,
			},
		};
	}

	static getGenericEvent (pos, year, eventDay, timeOfDaySecs) {
		const out = {
			...MiscUtil.copy(TimeTrackerBase._DEFAULT_STATE__EVENT),
			id: CryptUtil.uid(),
			pos,
		};
		if (year != null) out.when.year = year;
		if (eventDay != null) out.when.day = eventDay;
		if (timeOfDaySecs != null) {
			out.timeOfDaySecs = timeOfDaySecs;
			out.hasTime = true;
		}
		return out;
	}

	static getGenericEncounter (pos, year, encounterDay, timeOfDaySecs) {
		const out = {
			...MiscUtil.copy(TimeTrackerBase._DEFAULT_STATE__ENCOUNTER),
			id: CryptUtil.uid(),
			pos,
		};
		if (year != null) out.when.year = year;
		if (encounterDay != null) out.when.day = encounterDay;
		if (timeOfDaySecs != null) {
			out.timeOfDaySecs = timeOfDaySecs;
			out.hasTime = true;
		}
		return out;
	}

	static getGenericSeason (i) {
		return {
			id: CryptUtil.uid(),
			data: {
				...TimeTrackerBase._DEFAULT_STATE__SEASON,
				name: `Season ${i + 1}`,
				startDay: i * 90,
				endDay: ((i + 1) * 90) - 1,
			},
		};
	}

	static getGenericYear (i) {
		return {
			id: CryptUtil.uid(),
			data: {
				...TimeTrackerBase._DEFAULT_STATE__YEAR,
				name: `Year of the ${Parser.numberToText(i + 1).uppercaseFirst()}s`,
				year: i,
			},
		};
	}

	static getGenericEra (i) {
		const symbol = Parser.ALPHABET[i % Parser.ALPHABET.length];
		return {
			id: CryptUtil.uid(),
			data: {
				...TimeTrackerBase._DEFAULT_STATE__ERA,
				name: `${Parser.getOrdinalForm(i + 1)} Era`,
				abbreviation: `${symbol}E`,
				startYear: i,
				endYear: i,
			},
		};
	}

	static getGenericMoon (i) {
		return {
			id: CryptUtil.uid(),
			data: {
				...TimeTrackerBase._DEFAULT_STATE__MOON,
				name: `Moon ${i + 1}`,
			},
		};
	}

	static formatDateInfo (dayInfo, date, monthInfo, seasonInfos) {
		return `${dayInfo.name || "[Nameless day]"} ${Parser.getOrdinalForm(date + 1)} ${monthInfo.name || "[Nameless month]"}${seasonInfos.length ? ` (${seasonInfos.map(it => it.name || "[Nameless season]").join("/")})` : ""}`;
	}

	static formatYearInfo (year, yearInfos, eraInfos, abbreviate) {
		return `Year ${year + 1}${yearInfos.length ? ` (<span class="italic">${yearInfos.map(it => it.name.escapeQuotes()).join("/")}</span>)` : ""}${eraInfos.length ? `, ${eraInfos.map(it => `${it.dayOfEra + 1} <span ${abbreviate ? `title="${it.name.escapeQuotes()}"` : ``}>${(abbreviate ? it.abbreviation : it.name).escapeQuotes()}</span>${abbreviate ? "" : ` (${it.abbreviation.escapeQuotes()})`}`).join("/")}` : ""}`;
	}

	static $getCvsMoon (moonInfo) {
		const $canvas = $(`<canvas title="${moonInfo.name.escapeQuotes()}\u2014${moonInfo.phaseName}" class="dm-time__cvs-moon" width="${TimeTrackerBase._MOON_RENDER_RES}" height="${TimeTrackerBase._MOON_RENDER_RES}"/>`);
		const c = $canvas[0];
		const ctx = c.getContext("2d");

		// draw image
		if (!_TIME_TRACKER_MOON_SPRITE.hasError) {
			ctx.drawImage(
				_TIME_TRACKER_MOON_SPRITE,
				moonInfo.phaseIndex * TimeTrackerBase._MOON_RENDER_RES, // source x
				0, // source y
				TimeTrackerBase._MOON_RENDER_RES, // source w
				TimeTrackerBase._MOON_RENDER_RES, // source h
				0, // dest x
				0, // dest y
				TimeTrackerBase._MOON_RENDER_RES, // dest w
				TimeTrackerBase._MOON_RENDER_RES, // dest h
			);
		}

		// overlay color
		ctx.globalCompositeOperation = "multiply";
		ctx.fillStyle = moonInfo.color;
		ctx.rect(0, 0, TimeTrackerBase._MOON_RENDER_RES, TimeTrackerBase._MOON_RENDER_RES);
		ctx.fill();
		ctx.closePath();
		ctx.globalCompositeOperation = "source-over";

		// draw border
		ctx.beginPath();
		ctx.arc(TimeTrackerBase._MOON_RENDER_RES / 2, TimeTrackerBase._MOON_RENDER_RES / 2, TimeTrackerBase._MOON_RENDER_RES / 2, 0, 2 * Math.PI);
		ctx.lineWidth = 6;
		ctx.stroke();
		ctx.closePath();

		return $canvas;
	}

	static getClockInputs (timeInfo, vals, fnOnChange) {
		const getIptNum = ($ipt) => {
			return Number($ipt.val().trim().replace(/^0+/g, ""));
		};

		let lastTimeSecs = vals.timeOfDaySecs;
		const doUpdateTime = () => {
			const curTimeSecs = metas
				.map(it => getIptNum(it.$ipt) * it.mult)
				.reduce((a, b) => a + b, 0);

			if (lastTimeSecs !== curTimeSecs) {
				lastTimeSecs = curTimeSecs;
				fnOnChange(curTimeSecs);
			}
		};

		const metas = [];

		const $getIpt = (title, propMax, valProp, propMult) => {
			const $ipt = $(`<input class="form-control input-xs form-control--minimal ve-text-center dm-time__ipt-event-time code mx-1" title="${title}">`)
				.change(() => {
					const maxVal = timeInfo[propMax] - 1;
					const nxtRaw = getIptNum($ipt);
					const nxtVal = Math.max(0, Math.min(maxVal, nxtRaw));
					$ipt.val(TimeTrackerBase.getPaddedNum(nxtVal, timeInfo[propMax]));

					doUpdateTime();
				})
				.click(() => $ipt.select())
				.val(TimeTrackerBase.getPaddedNum(vals[valProp], timeInfo[propMax]));
			return {$ipt, propMax, mult: propMult ? timeInfo[propMult] : 1};
		};

		const metaHours = $getIpt("Hours", "hoursPerDay", "hours", "secsPerHour");
		const metaMinutes = $getIpt("Minutes", "minutesPerHour", "minutes", "secsPerMinute");
		const metaSeconds = $getIpt("Seconds", "secsPerMinute", "seconds");
		metas.push(metaHours, metaMinutes, metaSeconds);
		const out = {$iptHours: metaHours.$ipt, $iptMinutes: metaMinutes.$ipt, $iptSeconds: metaSeconds.$ipt};
		doUpdateTime();
		return out;
	}

	static getHoursMinutesSecondsFromSeconds (secsPerHour, secsPerMinute, numSecs) {
		const numHours = Math.floor(numSecs / secsPerHour);
		numSecs = numSecs - (numHours * secsPerHour);

		const numMinutes = Math.floor(numSecs / secsPerMinute);
		numSecs = numSecs - (numMinutes * secsPerMinute);

		return {
			seconds: numSecs,
			minutes: numMinutes,
			hours: numHours,
		};
	}

	static getPaddedNum (num, max) {
		return `${num}`.padStart(`${max}`.length, "0");
	}
}
TimeTrackerBase._DEFAULT_STATE__DAY = {
	name: "Day",
};
TimeTrackerBase._DEFAULT_STATE__MONTH = {
	name: "Month",
	days: 30,
};
TimeTrackerBase._DEFAULT_STATE__EVENT = {
	name: "Event",
	entries: [],
	when: {
		year: 0,
		day: 0,
	},
	isDeleted: false,
	isHidden: false,
};
TimeTrackerBase._DEFAULT_STATE__ENCOUNTER = {
	name: "Encounter",
	when: {
		year: 0,
		day: 0,
	},
	isDeleted: false,
	countUses: 0,
};
TimeTrackerBase._DEFAULT_STATE__SEASON = {
	name: "Season",
	startDay: 0,
	endDay: 0,
	sunriseHour: 6,
	sunsetHour: 22,
};
TimeTrackerBase._DEFAULT_STATE__YEAR = {
	name: "Year",
	year: 0,
};
TimeTrackerBase._DEFAULT_STATE__ERA = {
	name: "Era",
	abbreviation: "E",
	startYear: 0,
	endYear: 0,
};
TimeTrackerBase._DEFAULT_STATE__MOON = {
	name: "Moon",
	color: "#ffffff",
	phaseOffset: 0,
	period: 24,
};
TimeTrackerBase._DEFAULT_STATE = {
	time: 0,

	// Store these in the base class, even though they are only effectively useful in the subclass
	browseTime: null,
	isBrowseMode: false,

	// clock
	hoursPerDay: 24,
	minutesPerHour: 60,
	secondsPerMinute: 60,

	// game mechanics
	hoursPerLongRest: 8,
	minutesPerShortRest: 60,
	secondsPerRound: 6,

	// offsets
	offsetYears: 0,
	offsetMonthStartDay: 0,

	// calendar
	days: [...new Array(7)]
		.map((_, i) => TimeTrackerBase.getGenericDay(i)),
	months: [...new Array(12)]
		.map((_, i) => TimeTrackerBase.getGenericMonth(i)),
	events: {},
	encounters: {},
	seasons: [...new Array(4)]
		.map((_, i) => TimeTrackerBase.getGenericSeason(i)),
	years: [],
	eras: [],
	moons: [...new Array(1)]
		.map((_, i) => TimeTrackerBase.getGenericMoon(i)),
};
TimeTrackerBase._MOON_PHASES = [
	"new-moon",
	"waxing-crescent",
	"first-quarter",
	"waxing-gibbous",
	"full-moon",
	"waning-gibbous",
	"last-quarter",
	"waning-crescent",
];
TimeTrackerBase._MOON_RENDER_RES = 32;
TimeTrackerBase._MIN_TIME = 1;
TimeTrackerBase._MAX_TIME = 9999;

class TimeTrackerRoot extends TimeTrackerBase {
	constructor (tracker, $wrpPanel) {
		super(tracker, $wrpPanel);

		// components
		this._compClock = new TimeTrackerRoot_Clock(tracker, $wrpPanel);
		this._compCalendar = new TimeTrackerRoot_Calendar(tracker, $wrpPanel);
		this._compSettings = new TimeTrackerRoot_Settings(tracker, $wrpPanel);
	}

	getSaveableState () {
		return {
			...this.getBaseSaveableState(),
			compClockState: this._compClock.getSaveableState(),
			compCalendarState: this._compCalendar.getSaveableState(),
			compSettingsState: this._compSettings.getSaveableState(),
		};
	}

	setStateFrom (toLoad) {
		this.setBaseSaveableStateFrom(toLoad);
		if (toLoad.compClockState) this._compClock.setStateFrom(toLoad.compClockState);
		if (toLoad.compCalendarState) this._compCalendar.setStateFrom(toLoad.compCalendarState);
		if (toLoad.compSettingsState) this._compSettings.setStateFrom(toLoad.compSettingsState);
	}

	render ($parent) {
		$parent.empty();

		const $wrpClock = $(`<div class="ve-flex-col w-100 h-100 overflow-y-auto">`);
		const $wrpCalendar = $(`<div class="ve-flex-col w-100 h-100 overflow-y-auto ve-flex-h-center">`);
		const $wrpSettings = $(`<div class="ve-flex-col w-100 h-100 overflow-y-auto">`);

		const pod = this.getPod();

		this._compClock.render($wrpClock, pod);
		this._compCalendar.render($wrpCalendar, pod);
		this._compSettings.render($wrpSettings, pod);

		const $btnShowClock = $(`<button class="btn btn-xs btn-default mr-2" title="Clock"><span class="glyphicon glyphicon-time"></span></button>`)
			.click(() => this._state.tab = 0);
		const $btnShowCalendar = $(`<button class="btn btn-xs btn-default mr-3" title="Calendar"><span class="glyphicon glyphicon-calendar"></span></button>`)
			.click(() => this._state.tab = 1);
		const $btnShowSettings = $(`<button class="btn btn-xs btn-default mr-3" title="Settings"><span class="glyphicon glyphicon-cog"></span></button>`)
			.click(() => this._state.tab = 2);
		const hookShowTab = () => {
			$btnShowClock.toggleClass("active", this._state.tab === 0);
			$btnShowCalendar.toggleClass("active", this._state.tab === 1);
			$btnShowSettings.toggleClass("active", this._state.tab === 2);
			$wrpClock.toggleClass("hidden", this._state.tab !== 0);
			$wrpCalendar.toggleClass("hidden", this._state.tab !== 1);
			$wrpSettings.toggleClass("hidden", this._state.tab !== 2);
		};
		this._addHookBase("tab", hookShowTab);
		hookShowTab();

		const $btnReset = $(`<button class="btn btn-xs btn-danger" title="Reset Clock/Calendar Time to First Day"><span class="glyphicon glyphicon-refresh"></span></button>`)
			.click(() => confirm("Are you sure?") && Object.assign(this._state, {time: 0, isBrowseMode: false, browseTime: null}));

		$$`<div class="ve-flex-col h-100">
			<div class="ve-flex p-1 no-shrink">
				${$btnShowClock}${$btnShowCalendar}${$btnShowSettings}${$btnReset}
			</div>
			<hr class="hr-0 mb-2 no-shrink">
			${$wrpClock}
			${$wrpCalendar}
			${$wrpSettings}
		</div>`.appendTo($parent);

		// Prevent events and encounters from being lost on month changes (i.e. reduced number of days in the year)
		const _hookSettingsMonths_handleProp = (daysPerYear, prop) => {
			let isMod = false;
			Object.values(this._state[prop]).forEach(it => {
				if (it.when.year != null && it.when.day != null) {
					if (it.when.day >= daysPerYear) {
						it.when.day = daysPerYear - 1;
						isMod = true;
					}
				}
			});
			if (isMod) this._triggerMapUpdate(prop);
		};
		const hookSettingsMonths = () => {
			const {daysPerYear} = this._getTimeInfo({isBase: true});
			_hookSettingsMonths_handleProp(daysPerYear, "events");
			_hookSettingsMonths_handleProp(daysPerYear, "encounters");
		};
		this._addHookBase("months", hookSettingsMonths);
		hookSettingsMonths();

		// Prevent event/encounter times from exceeding day bounds on clock setting changes
		const _hookSettingsClock_handleProp = (secsPerDay, prop) => {
			let isMod = false;
			Object.values(this._state[prop]).forEach(it => {
				if (it.timeOfDaySecs != null) {
					if (it.timeOfDaySecs >= secsPerDay) {
						it.timeOfDaySecs = secsPerDay - 1;
						isMod = true;
					}
				}
			});
			if (isMod) this._triggerMapUpdate(prop);
		};
		const hookSettingsClock = () => {
			const {secsPerDay} = this._getTimeInfo({isBase: true});
			_hookSettingsClock_handleProp(secsPerDay, "events");
			_hookSettingsClock_handleProp(secsPerDay, "encounters");
		};
		this._addHookBase("secondsPerMinute", hookSettingsClock);
		this._addHookBase("minutesPerHour", hookSettingsClock);
		this._addHookBase("hoursPerDay", hookSettingsClock);
		hookSettingsClock();
	}

	_getDefaultState () {
		return {
			...MiscUtil.copy(super._getDefaultState()),
			...MiscUtil.copy(TimeTrackerRoot._DEFAULT_STATE),
		};
	}
}
TimeTrackerRoot._DEFAULT_STATE = {
	tab: 0,

	isPaused: false,
	isAutoPaused: false,

	hasCalendarLabelsColumns: true,
	hasCalendarLabelsRows: false,

	unitsWindSpeed: "mph",

	isClockSectionHidden: false,
	isCalendarSectionHidden: false,
	isMechanicsSectionHidden: false,
	isOffsetsSectionHidden: false,
	isDaysSectionHidden: false,
	isMonthsSectionHidden: false,
	isSeasonsSectionHidden: false,
	isYearsSectionHidden: false,
	isErasSectionHidden: false,
	isMoonsSectionHidden: false,
};

class TimeTrackerRoot_Clock extends TimeTrackerComponent {
	constructor (board, $wrpPanel) {
		super(board, $wrpPanel);

		this._compWeather = new TimeTrackerRoot_Clock_Weather(board, $wrpPanel);

		this._ivTimer = null;
	}

	getSaveableState () {
		return {
			...this.getBaseSaveableState(),
			compWeatherState: this._compWeather.getSaveableState(),
		};
	}

	setStateFrom (toLoad) {
		this.setBaseSaveableStateFrom(toLoad);
		if (toLoad.compWeatherState) this._compWeather.setStateFrom(toLoad.compWeatherState);
	}

	render ($parent, parent) {
		$parent.empty();
		this._parent = parent;
		const {getTimeInfo, getMoonInfos, doModTime, getEvents, getEncounters} = parent;

		clearInterval(this._ivTimer);
		let time = Date.now();
		this._ivTimer = setInterval(() => {
			const timeNext = Date.now();
			const timeDelta = timeNext - time;
			time = timeNext;

			if (this._parent.get("isPaused") || this._parent.get("isAutoPaused")) return;

			this._parent.set("time", this._parent.get("time") + timeDelta);
		}, 1000);
		this._$wrpPanel.data("onDestroy", () => clearInterval(this._ivTimer));

		const $dispReadableDate = $(`<div class="small-caps"/>`);
		const $dispReadableYear = $(`<div class="small-caps small text-muted mb-2"/>`);
		const $wrpMoons = $(`<div class="ve-flex ve-flex-wrap w-100 no-shrink ve-flex-vh-center mb-3"/>`);

		const $wrpDayNight = $(`<div class="ve-flex w-100 no-shrink ve-flex-h-center ve-flex-v-baseline mt-2"/>`);

		const getSecsToNextDay = (timeInfo) => {
			const {
				secsPerMinute,
				secsPerHour,
				secsPerDay,
				numSecs,
				numMinutes,
				numHours,
			} = timeInfo;

			return secsPerDay - (
				numHours * secsPerHour
				+ numMinutes * secsPerMinute
				+ numSecs
			);
		};

		const $btnNextSunrise = $(`<button class="btn btn-xs btn-default mr-2" title="Skip time to the next sunrise. Skips to later today if it is currently night time, or to tomorrow otherwise.">Next Sunrise</button>`)
			.click(() => {
				const timeInfo = getTimeInfo({isBase: true});
				const {
					seasonInfos,
					numHours,
					numMinutes,
					numSecs,
					secsPerHour,
					secsPerMinute,
				} = timeInfo;

				const sunriseHour = seasonInfos[0].sunriseHour;
				if (sunriseHour > this._parent.get("hoursPerDay")) {
					return JqueryUtil.doToast({content: "Could not skip to next sunrise\u2014sunrise time is greater than the number of hours in a day!", type: "warning"});
				}

				if (numHours < sunriseHour) {
					// skip to sunrise later today
					const targetSecs = sunriseHour * secsPerHour;
					const currentSecs = (secsPerHour * numHours) + (secsPerMinute * numMinutes) + numSecs;
					const toAdvance = targetSecs - currentSecs;
					doModTime(toAdvance, {isBase: true});
				} else {
					// skip to sunrise the next day
					const toNextDay = getSecsToNextDay(timeInfo);
					const toAdvance = toNextDay + (secsPerHour * sunriseHour);
					doModTime(toAdvance, {isBase: true});
				}
			});

		const $btnNextDay = $(`<button class="btn btn-xs btn-default" title="Skip time to next midnight.">Next Day</button>`)
			.click(() => doModTime(getSecsToNextDay(getTimeInfo({isBase: true})), {isBase: true}));

		const $getIpt = (propMax, timeProp, multProp) => {
			const $ipt = $(`<input class="form-control form-control--minimal ve-text-center dm-time__ipt-time code mx-1">`)
				.change(() => {
					const timeInfo = getTimeInfo({isBase: true});
					const multiplier = (multProp ? timeInfo[multProp] : 1);
					const curSecs = timeInfo[timeProp] * multiplier;

					const nxtRaw = Number($ipt.val().trim().replace(/^0+/g, ""));
					const nxtSecs = (isNaN(nxtRaw) ? 0 : nxtRaw) * multiplier;

					doModTime(nxtSecs - curSecs, {isBase: true});
				})
				.click(() => $ipt.select())
				.focus(() => this._parent.set("isAutoPaused", true))
				.blur(() => this._parent.set("isAutoPaused", false));
			const hookDisplay = () => {
				const maxDigits = `${this._parent.get(propMax)}`.length;
				$ipt.css("width", 20 * maxDigits);
			};
			this._parent.addHook(propMax, hookDisplay);
			hookDisplay();
			return $ipt;
		};

		const doUpdate$Ipt = ($ipt, propMax, num) => {
			if ($ipt.is(":focus")) return; // freeze selected inputs
			$ipt.val(TimeTrackerBase.getPaddedNum(num, this._parent.get(propMax)));
		};

		const $iptHours = $getIpt("hoursPerDay", "numHours", "secsPerHour");
		const $iptMinutes = $getIpt("minutesPerHour", "numMinutes", "secsPerMinute");
		const $iptSeconds = $getIpt("secondsPerMinute", "numSecs");

		const $wrpDays = $(`<div class="small-caps ve-text-center mb-1"/>`);
		const $wrpHours = $$`<div class="ve-flex ve-flex-vh-center">${$iptHours}</div>`;
		const $wrpMinutes = $$`<div class="ve-flex ve-flex-vh-center">${$iptMinutes}</div>`;
		const $wrpSeconds = $$`<div class="ve-flex ve-flex-vh-center">${$iptSeconds}</div>`;

		const $wrpEventsEncounters = $(`<div class="ve-flex-vh-center relative ve-flex-wrap dm-time__wrp-clock-events"/>`);
		const $hrEventsEncounters = $(`<hr class="hr-2">`);

		// cache rendering
		let lastReadableDate = null;
		let lastReadableYearHtml = null;
		let lastDay = null;
		let lastMoonInfo = null;
		let lastDayNightHtml = null;
		let lastEvents = null;
		let lastEncounters = null;
		const hookClock = () => {
			const {
				numDays,
				numHours,
				numMinutes,
				numSecs,
				dayInfo,
				date,
				monthInfo,
				seasonInfos,
				year,
				yearInfos,
				eraInfos,
				dayOfYear,
				secsPerHour,
				secsPerMinute,
				minutesPerHour,
				hoursPerDay,
			} = getTimeInfo({isBase: true});

			const todayMoonInfos = getMoonInfos(numDays);
			if (!CollectionUtil.deepEquals(lastMoonInfo, todayMoonInfos)) {
				lastMoonInfo = todayMoonInfos;
				$wrpMoons.empty();
				if (!todayMoonInfos.length) {
					$wrpMoons.hide();
				} else {
					$wrpMoons.show();
					todayMoonInfos.forEach(moon => {
						$$`<div class="ve-flex-v-center mr-2 ui-tip__parent">
							${TimeTrackerBase.$getCvsMoon(moon).addClass("mr-2").addClass("dm-time__clock-moon-phase").title(null)}
							<div class="ve-flex-col ui-tip__child">
								<div class="ve-flex">${moon.name}</div>
								<div class="ve-flex small"><i class="mr-1 no-wrap">${moon.phaseName}</i><span class="text-muted no-wrap">(Day ${moon.dayOfPeriod + 1}/${moon.period})</span></div>
							</div>
						</div>`.appendTo($wrpMoons);
					});
				}
			}

			const readableDate = TimeTrackerBase.formatDateInfo(dayInfo, date, monthInfo, seasonInfos);
			if (readableDate !== lastReadableDate) {
				lastReadableDate = readableDate;
				$dispReadableDate.text(readableDate);
			}
			const readableYear = TimeTrackerBase.formatYearInfo(year, yearInfos, eraInfos, true);
			if (readableYear !== lastReadableYearHtml) {
				lastReadableYearHtml = readableYear;
				$dispReadableYear.html(readableYear);
			}
			if (lastDay !== numDays) {
				lastDay = numDays;
				$wrpDays.text(`Day ${numDays + 1}`);
			}

			doUpdate$Ipt($iptHours, "hoursPerDay", numHours);
			doUpdate$Ipt($iptMinutes, "minutesPerHour", numMinutes);
			doUpdate$Ipt($iptSeconds, "secondsPerMinute", numSecs);

			if (seasonInfos.length) {
				$wrpDayNight.removeClass("hidden");
				const dayNightHtml = seasonInfos.map(it => {
					const isDay = numHours >= it.sunriseHour && numHours < it.sunsetHour;
					const hoursToDayNight = isDay ? it.sunsetHour - numHours
						: numHours < it.sunriseHour ? it.sunriseHour - numHours : (this._parent.get("hoursPerDay") + it.sunriseHour) - numHours;
					return `<b class="mr-2">${isDay ? "Day" : "Night"}</b> <span class="small text-muted">(${hoursToDayNight === 1 ? `Less than 1 hour` : `More than ${hoursToDayNight - 1} hour${hoursToDayNight === 2 ? "" : "s"}`} to sun${isDay ? "set" : "rise"})</span>`;
				}).join("/");

				if (dayNightHtml !== lastDayNightHtml) {
					$wrpDayNight.html(dayNightHtml);
					lastDayNightHtml = dayNightHtml;
				}

				$btnNextSunrise.removeClass("hidden");
			} else {
				$wrpDayNight.addClass("hidden");
				$btnNextSunrise.addClass("hidden");
			}

			const todayEvents = MiscUtil.copy(getEvents(year, dayOfYear));
			const todayEncounters = MiscUtil.copy(getEncounters(year, dayOfYear));
			if (!CollectionUtil.deepEquals(lastEvents, todayEvents) || !CollectionUtil.deepEquals(lastEncounters, todayEncounters)) {
				lastEvents = todayEvents;
				lastEncounters = todayEncounters;

				$wrpEventsEncounters.empty();
				if (!lastEvents.length && !lastEncounters.length) {
					$hrEventsEncounters.hide();
					$wrpEventsEncounters.hide();
				} else {
					$hrEventsEncounters.show();
					$wrpEventsEncounters.show();

					todayEvents.forEach(event => {
						const hoverMeta = Renderer.hover.getMakePredefinedHover({type: "entries", entries: []}, {isBookContent: true});
						const doUpdateMeta = () => {
							let name = event.name;
							if (event.hasTime) {
								const {hours, minutes, seconds} = TimeTrackerBase.getHoursMinutesSecondsFromSeconds(secsPerHour, secsPerMinute, event.timeOfDaySecs);
								name = `${name} at ${TimeTrackerBase.getPaddedNum(hours, hoursPerDay)}:${TimeTrackerBase.getPaddedNum(minutes, minutesPerHour)}:${TimeTrackerBase.getPaddedNum(seconds, secsPerMinute)}`;
							}
							const toShow = {
								name,
								type: "entries",
								entries: event.entries,
								data: {hoverTitle: name},
							};
							Renderer.hover.updatePredefinedHover(hoverMeta.id, toShow);
						};

						const $dispEvent = $$`<div class="dm-time__disp-clock-entry dm-time__disp-clock-entry--event">*</div>`
							.mouseover(evt => {
								doUpdateMeta();
								hoverMeta.mouseOver(evt, $dispEvent[0]);
							})
							.mousemove(evt => hoverMeta.mouseMove(evt, $dispEvent[0]))
							.mouseleave(evt => hoverMeta.mouseLeave(evt, $dispEvent[0]))
							.click(() => {
								const comp = TimeTrackerRoot_Settings_Event.getInstance(this._board, this._$wrpPanel, this._parent, event);
								comp.doOpenEditModal(null);
							})
							.appendTo($wrpEventsEncounters);
					});

					todayEncounters.forEach(encounter => {
						const hoverMeta = Renderer.hover.getMakePredefinedHover({type: "entries", entries: []}, {isBookContent: true});

						const pDoUpdateMeta = async () => {
							let name = encounter.displayName != null ? encounter.displayName : (encounter.name || "(Unnamed Encounter)");
							if (encounter.hasTime) {
								const {hours, minutes, seconds} = TimeTrackerBase.getHoursMinutesSecondsFromSeconds(secsPerHour, secsPerMinute, encounter.timeOfDaySecs);
								name = `${name} at ${TimeTrackerBase.getPaddedNum(hours, hoursPerDay)}:${TimeTrackerBase.getPaddedNum(minutes, minutesPerHour)}:${TimeTrackerBase.getPaddedNum(seconds, secsPerMinute)}`;
							}

							const entityInfos = await ListUtil.pGetSublistEntities_fromHover({
								exportedSublist: encounter.data,
								page: UrlUtil.PG_BESTIARY,
							});

							const toShow = {
								name,
								type: "entries",
								entries: [
									{
										type: "list",
										items: entityInfos.map(it => {
											return `${it.count || 1}× ${Renderer.hover.getEntityLink(it.entity)}`;
										}),
									},
								],
								data: {hoverTitle: name},
							};
							Renderer.hover.updatePredefinedHover(hoverMeta.id, toShow);
						};

						const $dispEncounter = $$`<div class="dm-time__disp-clock-entry dm-time__disp-clock-entry--encounter ${encounter.countUses ? "dm-time__disp-clock-entry--used-encounter" : ""}" title="${encounter.countUses ? "(Encounter has been used)" : "Run Encounter (Add to Initiative Tracker)"}">*</div>`
							.mouseover(async evt => {
								await pDoUpdateMeta();
								hoverMeta.mouseOver(evt, $dispEncounter[0]);
							})
							.mousemove(evt => hoverMeta.mouseMove(evt, $dispEncounter[0]))
							.mouseleave(evt => hoverMeta.mouseLeave(evt, $dispEncounter[0]))
							.click(async () => {
								const liveEncounter = this._parent.get("encounters")[encounter.id];
								if (encounter.countUses) {
									liveEncounter.countUses = 0;
									this._parent.triggerMapUpdate("encounters");
								} else {
									await TimeTrackerRoot_Calendar.pDoRunEncounter(this._parent, liveEncounter);
								}
							})
							.appendTo($wrpEventsEncounters);
					});
				}
			}
		};
		this._parent.addHook("time", hookClock);
		// clock settings
		this._parent.addHook("offsetYears", hookClock);
		this._parent.addHook("offsetMonthStartDay", hookClock);
		this._parent.addHook("hoursPerDay", hookClock);
		this._parent.addHook("minutesPerHour", hookClock);
		this._parent.addHook("secondsPerMinute", hookClock);
		// calendar periods
		this._parent.addHook("days", hookClock);
		this._parent.addHook("months", hookClock);
		this._parent.addHook("seasons", hookClock);
		// special
		this._parent.addHook("events", hookClock);
		this._parent.addHook("encounters", hookClock);
		this._parent.addHook("moons", hookClock);
		hookClock();

		const $btnSubDay = $(`<button class="btn btn-xxs btn-default dm-time__btn-day"  title="Subtract Day (SHIFT for 5)">-</button>`)
			.click(evt => doModTime(-1 * this._parent.get("hoursPerDay") * this._parent.get("minutesPerHour") * this._parent.get("secondsPerMinute") * (evt.shiftKey ? 5 : 1), {isBase: true}));
		const $btnAddDay = $(`<button class="btn btn-xxs btn-default dm-time__btn-day" title="Add Day (SHIFT for 5)">+</button>`)
			.click(evt => doModTime(this._parent.get("hoursPerDay") * this._parent.get("minutesPerHour") * this._parent.get("secondsPerMinute") * (evt.shiftKey ? 5 : 1), {isBase: true}));

		const $btnAddHour = $(`<button class="btn btn-xs btn-default dm-time__btn-time dm-time__btn-time--top" title="Add Hour (SHIFT for 5, CTRL for 12)">+</button>`)
			.click(evt => doModTime(this._parent.get("minutesPerHour") * this._parent.get("secondsPerMinute") * (evt.shiftKey ? 5 : (EventUtil.isCtrlMetaKey(evt) ? 12 : 1)), {isBase: true}));
		const $btnSubHour = $(`<button class="btn btn-xs btn-default dm-time__btn-time dm-time__btn-time--bottom" title="Subtract Hour (SHIFT for 5, CTRL for 12)">-</button>`)
			.click(evt => doModTime(-1 * this._parent.get("minutesPerHour") * this._parent.get("secondsPerMinute") * (evt.shiftKey ? 5 : (EventUtil.isCtrlMetaKey(evt) ? 12 : 1)), {isBase: true}));

		const $btnAddMinute = $(`<button class="btn btn-xs btn-default dm-time__btn-time dm-time__btn-time--top" title="Add Minute (SHIFT for 5, CTRL for 15, Both for 30)">+</button>`)
			.click(evt => doModTime(this._parent.get("secondsPerMinute") * (evt.shiftKey && (EventUtil.isCtrlMetaKey(evt)) ? 30 : (EventUtil.isCtrlMetaKey(evt) ? 15 : (evt.shiftKey ? 5 : 1))), {isBase: true}));
		const $btnSubMinute = $(`<button class="btn btn-xs btn-default dm-time__btn-time dm-time__btn-time--bottom" title="Subtract Minute (SHIFT for 5, CTRL for 15, Both for 30)">-</button>`)
			.click(evt => doModTime(-1 * this._parent.get("secondsPerMinute") * (evt.shiftKey && (EventUtil.isCtrlMetaKey(evt)) ? 30 : (EventUtil.isCtrlMetaKey(evt) ? 15 : (evt.shiftKey ? 5 : 1))), {isBase: true}));

		const $btnAddSecond = $(`<button class="btn btn-xs btn-default dm-time__btn-time dm-time__btn-time--top" title="Add Second (SHIFT for 5, CTRL for 15, Both for 30)">+</button>`)
			.click(evt => doModTime((evt.shiftKey && (EventUtil.isCtrlMetaKey(evt)) ? 30 : (EventUtil.isCtrlMetaKey(evt) ? 15 : (evt.shiftKey ? 5 : 1))), {isBase: true}));
		const $btnSubSecond = $(`<button class="btn btn-xs btn-default dm-time__btn-time dm-time__btn-time--bottom" title="Subtract Second (SHIFT for 5, CTRL for 15, Both for 30)">-</button>`)
			.click(evt => doModTime(-1 * (evt.shiftKey && (EventUtil.isCtrlMetaKey(evt)) ? 30 : (EventUtil.isCtrlMetaKey(evt) ? 15 : (evt.shiftKey ? 5 : 1))), {isBase: true}));

		const $btnIsPaused = $(`<button class="btn btn-default"><span class="glyphicon glyphicon-pause"></span></button>`)
			.click(() => this._parent.set("isPaused", !this._parent.get("isPaused")));
		const hookPaused = () => $btnIsPaused.toggleClass("active", this._parent.get("isPaused") || this._parent.get("isAutoPaused"));
		this._parent.addHook("isPaused", hookPaused);
		this._parent.addHook("isAutoPaused", hookPaused);
		hookPaused();

		const $btnAddLongRest = $(`<button class="btn btn-xs btn-default mr-2" title="Add Long Rest (SHIFT for Subtract)">Long Rest</button>`)
			.click(evt => doModTime((evt.shiftKey ? -1 : 1) * this._parent.get("hoursPerLongRest") * this._parent.get("minutesPerHour") * this._parent.get("secondsPerMinute"), {isBase: true}));
		const $btnAddShortRest = $(`<button class="btn btn-xs btn-default mr-2" title="Add Short Rest (SHIFT for Subtract)">Short Rest</button>`)
			.click(evt => doModTime((evt.shiftKey ? -1 : 1) * this._parent.get("minutesPerShortRest") * this._parent.get("secondsPerMinute"), {isBase: true}));
		const $btnAddTurn = $(`<button class="btn btn-xs btn-default" title="Add Round (6 seconds) (SHIFT for Subtract)">Add Round</button>`)
			.click(evt => doModTime((evt.shiftKey ? -1 : 1) * this._parent.get("secondsPerRound"), {isBase: true}));

		const $wrpWeather = $(`<div class="ve-flex dm-time__wrp-weather">`);
		this._compWeather.render($wrpWeather, this._parent);

		$$`<div class="ve-flex h-100">
			<div class="ve-flex-col ve-flex-vh-center w-100">
				${$dispReadableDate}
				${$dispReadableYear}
				${$wrpMoons}
				<div class="ve-flex ve-flex-v-center relative">
					<div class="ve-flex-col">
						<div class="ve-flex-vh-center">${$btnAddHour}</div>
						${$wrpHours}
						<div class="ve-flex-vh-center">${$btnSubHour}</div>
					</div>
					<div class="dm-time__sep-time">:</div>
					<div class="ve-flex-col">
						<div class="ve-flex-vh-center">${$btnAddMinute}</div>
						${$wrpMinutes}
						<div class="ve-flex-vh-center">${$btnSubMinute}</div>
					</div>
					<div class="dm-time__sep-time">:</div>
					<div class="ve-flex-col">
						<div class="ve-flex-vh-center">${$btnAddSecond}</div>
						${$wrpSeconds}
						<div class="ve-flex-vh-center">${$btnSubSecond}</div>
					</div>
					<div class="ve-flex-col ml-2">${$btnIsPaused}</div>
				</div>
				${$wrpDayNight}
				<hr class="hr-3">
				<div class="ve-flex-col">
					<div class="ve-flex mb-2">
						${$btnAddLongRest}${$btnAddShortRest}${$btnAddTurn}
					</div>
					<div class="ve-flex">
						${$btnNextSunrise}
						${$btnNextDay}
					</div>
				</div>
			</div>

			<div class="dm-time__bar-clock"></div>

			<div class="ve-flex-col no-shrink pr-1 ve-flex-h-center">
				${$wrpDays}
				<div class="small ve-flex-vh-center btn-group">
					${$btnSubDay}${$btnAddDay}
				</div>
				<hr class="hr-2">

				${$wrpEventsEncounters}
				${$hrEventsEncounters}

				${$wrpWeather}
			</div>
		</div>`.appendTo($parent);
	}
}

class TimeTrackerRoot_Clock_Weather extends TimeTrackerComponent {
	render ($parent, parent) {
		$parent.empty();
		this._parent = parent;
		const {getTimeInfo} = parent;

		const $btnRandomise = $(`<button class="btn btn-xxs btn-default dm-time__btn-random-weather" title="Roll Weather (SHIFT to Reroll Using Previous Settings)"><span class="fal fa-dice"/></button>`)
			.click(async evt => {
				const randomState = await TimeTrackerRoot_Clock_RandomWeather.pGetUserInput(
					{
						temperature: this._state.temperature,
						precipitation: this._state.precipitation,
						windDirection: this._state.windDirection,
						windSpeed: this._state.windSpeed,
					},
					{
						unitsWindSpeed: this._parent.get("unitsWindSpeed"),
						isReroll: evt.shiftKey,
					},
				);
				if (randomState == null) return;
				Object.assign(this._state, randomState);
			});

		const $btnTemperature = $(`<button class="btn btn-default btn-sm dm-time__btn-weather mr-2"/>`)
			.click(async () => {
				let ixCur = TimeTrackerRoot_Clock_Weather._TEMPERATURES.indexOf(this._state.temperature);
				if (!~ixCur) ixCur = 2;

				const ix = await InputUiUtil.pGetUserIcon({
					values: TimeTrackerRoot_Clock_Weather._TEMPERATURES.map((it, i) => {
						const meta = TimeTrackerRoot_Clock_Weather._TEMPERATURE_META[i];
						return {
							name: it.uppercaseFirst(),
							buttonClassActive: meta.class ? `${meta.class} active` : null,
							iconClass: `fal ${meta.icon}`,
						};
					}),
					title: "Temperature",
					default: ixCur,
				});

				if (ix != null) this._state.temperature = TimeTrackerRoot_Clock_Weather._TEMPERATURES[ix];
			});
		const hookTemperature = () => {
			TimeTrackerRoot_Clock_Weather._TEMPERATURE_META.forEach(it => $btnTemperature.removeClass(it.class));
			let ix = TimeTrackerRoot_Clock_Weather._TEMPERATURES.indexOf(this._state.temperature);
			if (!~ix) ix = 0;
			const meta = TimeTrackerRoot_Clock_Weather._TEMPERATURE_META[ix];
			$btnTemperature.addClass(meta.class);
			$btnTemperature.title(this._state.temperature.uppercaseFirst()).html(`<div class="fal ${meta.icon}"/>`);
		};
		this._addHookBase("temperature", hookTemperature);
		hookTemperature();

		const $btnPrecipitation = $(`<button class="btn btn-default btn-sm dm-time__btn-weather mr-2"/>`)
			.click(async () => {
				const {
					numHours,
					seasonInfos,
				} = getTimeInfo({isBase: true});
				const useNightIcon = seasonInfos.length && !(numHours >= seasonInfos[0].sunriseHour && numHours < seasonInfos[0].sunsetHour);

				let ixCur = TimeTrackerRoot_Clock_Weather._PRECIPICATION.indexOf(this._state.precipitation);
				if (!~ixCur) ixCur = 0;

				const ix = await InputUiUtil.pGetUserIcon({
					values: TimeTrackerRoot_Clock_Weather._PRECIPICATION.map((it, i) => {
						const meta = TimeTrackerRoot_Clock_Weather._PRECIPICATION_META[i];
						return {
							name: TimeTrackerUtil.revSlugToText(it),
							iconClass: `fal ${useNightIcon && meta.iconNight ? meta.iconNight : meta.icon}`,
							buttonClass: `btn-default`,
						};
					}),
					title: "Weather",
					default: ixCur,
				});

				if (ix != null) this._state.precipitation = TimeTrackerRoot_Clock_Weather._PRECIPICATION[ix];
			});
		let lastPrecipitationTimeInfo = null;
		const hookPrecipitation = (prop) => {
			const {
				numHours,
				seasonInfos,
			} = getTimeInfo({isBase: true});

			const precipitationTimeInfo = {numHours, seasonInfos};

			if (prop === "time" && CollectionUtil.deepEquals(lastPrecipitationTimeInfo, precipitationTimeInfo)) return;
			lastPrecipitationTimeInfo = precipitationTimeInfo;
			const useNightIcon = seasonInfos.length && !(numHours >= seasonInfos[0].sunriseHour && numHours < seasonInfos[0].sunsetHour);

			let ix = TimeTrackerRoot_Clock_Weather._PRECIPICATION.indexOf(this._state.precipitation);
			if (!~ix) ix = 0;
			const meta = TimeTrackerRoot_Clock_Weather._PRECIPICATION_META[ix];
			$btnPrecipitation.title(TimeTrackerUtil.revSlugToText(this._state.precipitation)).html(`<div class="fal ${useNightIcon && meta.iconNight ? meta.iconNight : meta.icon}"/>`);
		};
		this._addHookBase("precipitation", hookPrecipitation);
		this._parent.addHook("time", hookPrecipitation);
		hookPrecipitation();

		const $btnWindDirection = $(`<button class="btn btn-default btn-sm dm-time__btn-weather"/>`)
			.click(async () => {
				const bearing = await TimeTrackerUtil.pGetUserWindBearing(this._state.windDirection);
				if (bearing != null) this._state.windDirection = bearing;
			});
		const hookWindDirection = () => {
			let ixCur = TimeTrackerRoot_Clock_Weather._WIND_SPEEDS.indexOf(this._state.windSpeed);
			if (!~ixCur) ixCur = 0;

			if (ixCur) {
				const speedClass = ixCur >= 5 ? "fas" : ixCur >= 3 ? "far" : "fal";
				$btnWindDirection.html(`<div class="${speedClass} fa-arrow-up" style="transform: rotate(${this._state.windDirection}deg);"/>`);
			} else $btnWindDirection.html(`<div class="fal fa-ellipsis-h"/>`);
		};
		this._addHookBase("windDirection", hookWindDirection);
		this._addHookBase("windSpeed", hookWindDirection);
		hookWindDirection();

		const $btnWindSpeed = $(`<button class="btn btn-default btn-xs"/>`)
			.click(async () => {
				let ixCur = TimeTrackerRoot_Clock_Weather._WIND_SPEEDS.indexOf(this._state.windSpeed);
				if (!~ixCur) ixCur = 0;

				const ix = await InputUiUtil.pGetUserIcon({
					values: TimeTrackerRoot_Clock_Weather._WIND_SPEEDS.map((it, i) => {
						const meta = TimeTrackerRoot_Clock_Weather._WIND_SPEEDS_META[i];
						return {
							name: TimeTrackerUtil.revSlugToText(it),
							buttonClass: `btn-default`,
							iconContent: `<div class="mb-1 whitespace-normal dm-time__wind-speed">${this._parent.get("unitsWindSpeed") === "mph" ? `${meta.mph} mph` : `${meta.kmph} km/h`}</div>`,
						};
					}),
					title: "Wind Speed",
					default: ixCur,
				});

				if (ix != null) this._state.windSpeed = TimeTrackerRoot_Clock_Weather._WIND_SPEEDS[ix];
			});
		const hookWindSpeed = () => {
			let ix = TimeTrackerRoot_Clock_Weather._WIND_SPEEDS.indexOf(this._state.windSpeed);
			if (!~ix) ix = 0;
			const meta = TimeTrackerRoot_Clock_Weather._WIND_SPEEDS_META[ix];
			$btnWindSpeed.text(TimeTrackerUtil.revSlugToText(this._state.windSpeed)).title(this._parent.get("unitsWindSpeed") === "mph" ? `${meta.mph} mph` : `${meta.kmph} km/h`);
		};
		this._addHookBase("windSpeed", hookWindSpeed);
		this._parent.addHook("unitsWindSpeed", hookWindSpeed);
		hookWindSpeed();

		const $hovEnvEffects = $(`<div><span class="glyphicon glyphicon-info-sign"/></div>`);
		const $wrpEnvEffects = $$`<div class="mt-2">${$hovEnvEffects}</div>`;
		let hoverMetaEnvEffects = null;
		const hookEnvEffects = () => {
			$hovEnvEffects.off("mouseover").off("mousemove").off("mouseleave");
			const hashes = [];
			const fnGetHash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_TRAPS_HAZARDS];
			if (this._state.temperature === TimeTrackerRoot_Clock_Weather._TEMPERATURES[0]) {
				hashes.push(fnGetHash(({name: "Extreme Cold", source: Parser.SRC_DMG})));
			}

			if (this._state.temperature === TimeTrackerRoot_Clock_Weather._TEMPERATURES.last()) {
				hashes.push(fnGetHash(({name: "Extreme Heat", source: Parser.SRC_DMG})));
			}

			if (["rain-heavy", "thunderstorm", "snow"].includes(this._state.precipitation)) {
				hashes.push(fnGetHash(({name: "Heavy Precipitation", source: Parser.SRC_DMG})));
			}

			if (TimeTrackerRoot_Clock_Weather._WIND_SPEEDS.indexOf(this._state.windSpeed) >= 3) {
				hashes.push(fnGetHash(({name: "Strong Wind", source: Parser.SRC_DMG})));
			}

			$hovEnvEffects.show();
			if (hashes.length === 1) {
				const ele = $hovEnvEffects[0];
				$hovEnvEffects.mouseover(evt => Renderer.hover.pHandleLinkMouseOver(evt, ele, {page: UrlUtil.PG_TRAPS_HAZARDS, source: Parser.SRC_DMG, hash: hashes[0]}));
				$hovEnvEffects.mouseleave(evt => Renderer.hover.handleLinkMouseLeave(evt, ele));
				$hovEnvEffects.mousemove(evt => Renderer.hover.handleLinkMouseMove(evt, ele));
			} else if (hashes.length) {
				if (hoverMetaEnvEffects == null) hoverMetaEnvEffects = Renderer.hover.getMakePredefinedHover({type: "entries", entries: []});

				$hovEnvEffects
					.mouseover(async evt => {
						// load the first on its own, to avoid racing to fill the cache
						const first = await DataLoader.pCacheAndGet(UrlUtil.PG_TRAPS_HAZARDS, Parser.SRC_DMG, hashes[0]);
						const others = await Promise.all(hashes.slice(1).map(hash => DataLoader.pCacheAndGet(UrlUtil.PG_TRAPS_HAZARDS, Parser.SRC_DMG, hash)));
						const allEntries = [first, ...others].map(it => ({type: "statblockInline", dataType: "hazard", data: MiscUtil.copy(it)}));
						const toShow = {
							type: "entries",
							entries: allEntries,
							data: {hoverTitle: `Weather Effects`},
						};
						Renderer.hover.updatePredefinedHover(hoverMetaEnvEffects.id, toShow);
						hoverMetaEnvEffects.mouseOver(evt, $hovEnvEffects[0]);
					})
					.mousemove(evt => hoverMetaEnvEffects.mouseMove(evt, $hovEnvEffects[0]))
					.mouseleave(evt => hoverMetaEnvEffects.mouseLeave(evt, $hovEnvEffects[0]));
			} else $hovEnvEffects.hide();
		};
		this._addHookBase("temperature", hookEnvEffects);
		this._addHookBase("precipitation", hookEnvEffects);
		this._addHookBase("windSpeed", hookEnvEffects);
		hookEnvEffects();

		$$`<div class="ve-flex-col w-100 ve-flex-vh-center">
			<div class="ve-flex-vh-center small mb-1"><span class="small-caps mr-2">Weather</span>${$btnRandomise}</div>
			<div class="mb-2">${$btnTemperature}${$btnPrecipitation}</div>

			<div class="ve-flex-col ve-flex-vh-center">
				<div class="small small-caps">Wind</div>
				<div class="mb-1">${$btnWindDirection}</div>
				<div>${$btnWindSpeed}</div>
			</div>

			${$wrpEnvEffects}
		</div>`.appendTo($parent);
	}

	_getDefaultState () { return MiscUtil.copy(TimeTrackerRoot_Clock_Weather._DEFAULT_STATE); }
}
TimeTrackerRoot_Clock_Weather._TEMPERATURES = [
	"freezing",
	"cold",
	"mild",
	"hot",
	"scorching",
];
TimeTrackerRoot_Clock_Weather._PRECIPICATION = [
	"sunny",
	"cloudy",
	"foggy",
	"rain-light",
	"rain-heavy",
	"thunderstorm",
	"hail",
	"snow",
];
TimeTrackerRoot_Clock_Weather._WIND_SPEEDS = [
	"calm",
	"breeze-light",
	"breeze-moderate",
	"breeze-strong",
	"gale-near",
	"gale",
	"gale-severe",
	"storm",
	"hurricane",
];
TimeTrackerRoot_Clock_Weather._DEFAULT_STATE = {
	temperature: TimeTrackerRoot_Clock_Weather._TEMPERATURES[2],
	precipitation: TimeTrackerRoot_Clock_Weather._PRECIPICATION[0],
	windDirection: 0,
	windSpeed: TimeTrackerRoot_Clock_Weather._WIND_SPEEDS[0],
};
TimeTrackerRoot_Clock_Weather._TEMPERATURE_META = [
	{icon: "fa-temperature-frigid", class: "btn-primary"},
	{icon: "fa-thermometer-quarter", class: "btn-info"},
	{icon: "fa-thermometer-half"},
	{icon: "fa-thermometer-three-quarters", class: "btn-warning"},
	{icon: "fa-temperature-hot", class: "btn-danger"},
];
TimeTrackerRoot_Clock_Weather._PRECIPICATION_META = [
	{icon: "fa-sun", iconNight: "fa-moon"},
	{icon: "fa-clouds-sun", iconNight: "fa-clouds-moon"},
	{icon: "fa-fog"},
	{icon: "fa-cloud-drizzle"},
	{icon: "fa-cloud-showers-heavy"},
	{icon: "fa-thunderstorm"},
	{icon: "fa-cloud-hail"},
	{icon: "fa-cloud-snow"},
];
TimeTrackerRoot_Clock_Weather._WIND_SPEEDS_META = [ // (Beaufort scale equivalent)
	{mph: "<1", kmph: "<2"}, // 0-2
	{mph: "1-7", kmph: "2-11"}, // 1-2
	{mph: "8-18", kmph: "12-28"}, // 3-4
	{mph: "19-31", kmph: "29-49"}, // 5-6
	{mph: "32-38", kmph: "50-61"}, // 7
	{mph: "39-46", kmph: "62-74"}, // 8
	{mph: "47-54", kmph: "75-88"}, // 9
	{mph: "55-72", kmph: "89-117"}, // 10-11
	{mph: "≥73", kmph: "≥118"}, // 12
];

class TimeTrackerRoot_Clock_RandomWeather extends BaseComponent {
	constructor (opts) {
		super();

		this._unitsWindSpeed = opts.unitsWindSpeed;
	}

	render ($modalInner, doClose) {
		$modalInner.empty();

		const $btnsTemperature = TimeTrackerRoot_Clock_Weather._TEMPERATURES
			.map((it, i) => {
				const meta = TimeTrackerRoot_Clock_Weather._TEMPERATURE_META[i];
				return {
					temperature: it,
					name: it.uppercaseFirst(),
					buttonClass: meta.class,
					iconClass: `fal ${meta.icon}`,
				};
			})
			.map(v => {
				const $btn = $$`<div class="m-2 btn btn-default ui__btn-xxl-square ve-flex-col ve-flex-h-center">
						<div class="ui-icn__wrp-icon ${v.iconClass} mb-1"></div>
						<div class="whitespace-normal w-100">${v.name}</div>
					</div>`
					.click(() => {
						if (this._state.allowedTemperatures.includes(v.temperature)) this._state.allowedTemperatures = this._state.allowedTemperatures.filter(it => it !== v.temperature);
						else this._state.allowedTemperatures = [...this._state.allowedTemperatures, v.temperature];
					});

				const hookTemperature = () => {
					const isActive = this._state.allowedTemperatures.includes(v.temperature);
					if (v.buttonClass) {
						$btn.toggleClass("btn-default", !isActive);
						$btn.toggleClass(v.buttonClass, isActive);
					}
					$btn.toggleClass("active", isActive);
				};
				this._addHookBase("allowedTemperatures", hookTemperature);
				hookTemperature();

				return $btn;
			});

		const $btnsPrecipitation = TimeTrackerRoot_Clock_Weather._PRECIPICATION
			.map((it, i) => {
				const meta = TimeTrackerRoot_Clock_Weather._PRECIPICATION_META[i];
				return {
					precipitation: it,
					name: TimeTrackerUtil.revSlugToText(it),
					iconClass: `fal ${meta.icon}`,
				};
			})
			.map(v => {
				const $btn = $$`<div class="m-2 btn btn-default ui__btn-xxl-square ve-flex-col ve-flex-h-center">
						<div class="ui-icn__wrp-icon ${v.iconClass} mb-1"></div>
						<div class="whitespace-normal w-100">${v.name}</div>
					</div>`
					.click(() => {
						if (this._state.allowedPrecipitations.includes(v.precipitation)) this._state.allowedPrecipitations = this._state.allowedPrecipitations.filter(it => it !== v.precipitation);
						else this._state.allowedPrecipitations = [...this._state.allowedPrecipitations, v.precipitation];
					});

				const hookPrecipitation = () => $btn.toggleClass("active", this._state.allowedPrecipitations.includes(v.precipitation));
				this._addHookBase("allowedPrecipitations", hookPrecipitation);
				hookPrecipitation();

				return $btn;
			});

		const $btnWindDirection = $(`<button class="btn btn-default btn-sm dm-time__btn-weather"/>`)
			.click(async () => {
				const bearing = await TimeTrackerUtil.pGetUserWindBearing(this._state.prevailingWindDirection);
				if (bearing != null) this._state.prevailingWindDirection = bearing;
			});
		const hookWindDirection = () => {
			$btnWindDirection.html(`<div class="far fa-arrow-up" style="transform: rotate(${this._state.prevailingWindDirection}deg);"/>`);
		};
		this._addHookBase("prevailingWindDirection", hookWindDirection);
		hookWindDirection();

		const $btnsWindSpeed = TimeTrackerRoot_Clock_Weather._WIND_SPEEDS
			.map((it, i) => {
				const meta = TimeTrackerRoot_Clock_Weather._WIND_SPEEDS_META[i];
				return {
					speed: it,
					name: TimeTrackerUtil.revSlugToText(it),
					iconContent: `<div class="mb-1 whitespace-normal dm-time__wind-speed">${this._unitsWindSpeed === "mph" ? `${meta.mph} mph` : `${meta.kmph} km/h`}</div>`,
				};
			})
			.map(v => {
				const $btn = $$`<div class="m-2 btn btn-default ui__btn-xxl-square ve-flex-col ve-flex-h-center">
						${v.iconContent}
						<div class="whitespace-normal w-100">${v.name}</div>
					</div>`
					.click(() => {
						if (this._state.allowedWindSpeeds.includes(v.speed)) this._state.allowedWindSpeeds = this._state.allowedWindSpeeds.filter(it => it !== v.speed);
						else this._state.allowedWindSpeeds = [...this._state.allowedWindSpeeds, v.speed];
					});

				const hookSpeed = () => $btn.toggleClass("active", this._state.allowedWindSpeeds.includes(v.speed));
				this._addHookBase("allowedWindSpeeds", hookSpeed);
				hookSpeed();

				return $btn;
			});

		const $btnOk = $(`<button class="btn btn-default">Confirm and Roll Weather</button>`)
			.click(() => {
				if (!this._state.allowedTemperatures.length || !this._state.allowedPrecipitations.length || !this._state.allowedWindSpeeds.length) {
					JqueryUtil.doToast({content: `Please select allowed values for all sections!`, type: "warning"});
				} else doClose(true);
			});

		$$`<div class="ve-flex-col w-100 h-100">
			<div class="ve-flex-col">
				<h5>Allowed Temperatures</h5>
				<div class="ve-flex">${$btnsTemperature}</div>
			</div>
			<div class="ve-flex-col">
				<h5>Allowed Precipitation Types</h5>
				<div class="ve-flex">${$btnsPrecipitation}</div>
			</div>
			<div class="ve-flex-v-center mt-2">
				<h5 class="mr-2">Prevailing Wind Direction</h5>${$btnWindDirection}
			</div>
			<div class="ve-flex-col">
				<h5>Allowed Wind Speeds</h5>
				<div class="ve-flex">${$btnsWindSpeed}</div>
			</div>
			<div class="ve-flex-vh-center">${$btnOk}</div>
		</div>`.appendTo($modalInner);
	}

	_getDefaultState () { return MiscUtil.copy(TimeTrackerRoot_Clock_RandomWeather._DEFAULT_STATE); }

	/**
	 * @param curWeather The current weather state.
	 * @param opts Options object.
	 * @param opts.unitsWindSpeed Wind speed units.
	 * @param [opts.isReroll] If the weather is being quick-rerolled.
	 */
	static async pGetUserInput (curWeather, opts) {
		opts = opts || {};

		const comp = new TimeTrackerRoot_Clock_RandomWeather(opts);

		const prevState = await StorageUtil.pGetForPage(TimeTrackerRoot_Clock_RandomWeather._STORAGE_KEY);
		if (prevState) comp.setStateFrom(prevState);

		const getWeather = () => {
			StorageUtil.pSetForPage(TimeTrackerRoot_Clock_RandomWeather._STORAGE_KEY, comp.getSaveableState());

			const inputs = comp.toObject();

			// 66% chance of temperature change
			const isNewTemp = RollerUtil.randomise(3) > 1;
			// 80% chance of precipitation change
			const isNewPrecipitation = RollerUtil.randomise(5) > 1;

			// 40% chance of prevailing wind; 20% chance of current wind; 40% chance of random wind
			const rollWindDirection = RollerUtil.randomise(5);
			let windDirection;
			if (rollWindDirection === 1) windDirection = curWeather.windDirection;
			else if (rollWindDirection <= 3) windDirection = inputs.prevailingWindDirection;
			else windDirection = RollerUtil.randomise(360) - 1;
			windDirection += TimeTrackerRoot_Clock_RandomWeather._getBearingFudge();

			// 2/7 chance wind speed stays the same; 1/7 chance each of it increasing/decreasing by 1/2/3 steps
			const rollWindSpeed = RollerUtil.randomise(7);
			let windSpeed;
			const ixCurWindSpeed = TimeTrackerRoot_Clock_Weather._WIND_SPEEDS.indexOf(curWeather.windSpeed);
			let windSpeedOffset = 0;
			if (rollWindSpeed <= 3) windSpeedOffset = -rollWindSpeed;
			else if (rollWindSpeed >= 5) windSpeedOffset = rollWindSpeed - 4;
			if (windSpeedOffset < 0) {
				windSpeed = TimeTrackerRoot_Clock_Weather._WIND_SPEEDS[ixCurWindSpeed + windSpeedOffset];

				let i = -1;
				while (!inputs.allowedWindSpeeds.includes(windSpeed)) {
					windSpeed = TimeTrackerRoot_Clock_Weather._WIND_SPEEDS[ixCurWindSpeed + windSpeedOffset + i];

					// If we run out of possibilities, scan the opposite direction
					if (--i < 0) {
						windSpeed = TimeTrackerRoot_Clock_Weather._WIND_SPEEDS.find(it => inputs.allowedWindSpeeds.includes(it));
					}
				}
			} else if (windSpeedOffset > 0) {
				windSpeed = TimeTrackerRoot_Clock_Weather._WIND_SPEEDS[ixCurWindSpeed + windSpeedOffset];

				let i = 1;
				while (!inputs.allowedWindSpeeds.includes(windSpeed)) {
					windSpeed = TimeTrackerRoot_Clock_Weather._WIND_SPEEDS[ixCurWindSpeed + windSpeedOffset + i];

					// If we run out of possibilities, scan the opposite direction
					if (++i >= TimeTrackerRoot_Clock_Weather._WIND_SPEEDS.length) {
						windSpeed = [...TimeTrackerRoot_Clock_Weather._WIND_SPEEDS]
							.reverse()
							.find(it => inputs.allowedWindSpeeds.includes(it));
					}
				}
			} else windSpeed = curWeather.windSpeed;

			return {
				temperature: isNewTemp ? RollerUtil.rollOnArray(inputs.allowedTemperatures) : curWeather.temperature,
				precipitation: isNewPrecipitation ? RollerUtil.rollOnArray(inputs.allowedPrecipitations) : curWeather.precipitation,
				windDirection,
				windSpeed,
			};
		};

		if (opts.isReroll) return getWeather();

		return new Promise(resolve => {
			const {$modalInner, doClose} = UiUtil.getShowModal({
				title: "Random Weather Configuration",
				isUncappedHeight: true,
				cbClose: (isDataEntered) => {
					if (!isDataEntered) resolve(null);
					else resolve(getWeather());
				},
			});

			comp.render($modalInner, doClose);
		});
	}

	static _getBearingFudge () {
		return Math.round(RollerUtil.randomise(20, 0)) * (RollerUtil.randomise(2) === 2 ? 1 : -1);
	}
}
TimeTrackerRoot_Clock_RandomWeather._DEFAULT_STATE = {
	allowedTemperatures: [...TimeTrackerRoot_Clock_Weather._TEMPERATURES],
	allowedPrecipitations: [...TimeTrackerRoot_Clock_Weather._PRECIPICATION],
	prevailingWindDirection: 0,
	allowedWindSpeeds: [...TimeTrackerRoot_Clock_Weather._WIND_SPEEDS],
};
TimeTrackerRoot_Clock_RandomWeather._STORAGE_KEY = "TimeTracker_RandomWeatherModal";

class TimeTrackerRoot_Calendar extends TimeTrackerComponent {
	constructor (tracker, $wrpPanel) {
		super(tracker, $wrpPanel);

		// temp components
		this._tmpComps = [];
	}

	render ($parent, parent) {
		$parent.empty();
		this._parent = parent;
		const {getTimeInfo, doModTime} = parent;

		// cache info to avoid re-rendering the calendar every second
		let lastRenderMeta = null;

		const $dispDayReadableDate = $(`<div class="small-caps"/>`);
		const $dispYear = $(`<div class="small-caps text-muted small"/>`);
		const {$wrpDateControls, $iptYear, $iptMonth, $iptDay} = TimeTrackerRoot_Calendar.getDateControls(this._parent);

		const $btnBrowseMode = ComponentUiUtil.$getBtnBool(
			this._parent.component,
			"isBrowseMode",
			{
				$ele: $(`<button class="btn btn-xs btn-default" title="When enabled, the current calendar view will be saved. You can then freely browse. When you're done, disable Browse mode to return to your original view.">Browse</button>`),
				fnHookPost: val => {
					if (val) this._parent.set("browseTime", this._parent.get("time"));
					else this._parent.set("browseTime", null);
				},
			},
		);

		const $wrpCalendar = $(`<div class="overflow-y-auto smooth-scroll"/>`);

		const hookCalendar = (prop) => {
			const timeInfo = getTimeInfo();

			const {
				date,
				month,
				year,
				monthInfo,
				monthStartDay,
				daysPerWeek,
				dayInfo,
				monthStartDayOfYear,
				seasonInfos,
				numDays,
				yearInfos,
				eraInfos,
				secsPerDay,
			} = timeInfo;

			const renderMeta = {
				date,
				month,
				year,
				monthInfo,
				monthStartDay,
				daysPerWeek,
				dayInfo,
				monthStartDayOfYear,
				seasonInfos,
				numDays,
				yearInfos,
				eraInfos,
				secsPerDay,
			};
			if (prop === "time" && CollectionUtil.deepEquals(lastRenderMeta, renderMeta)) return;
			lastRenderMeta = renderMeta;

			$dispDayReadableDate.text(TimeTrackerBase.formatDateInfo(dayInfo, date, monthInfo, seasonInfos));
			$dispYear.html(TimeTrackerBase.formatYearInfo(year, yearInfos, eraInfos));

			$iptYear.val(year + 1);
			$iptMonth.val(month + 1);
			$iptDay.val(date + 1);

			TimeTrackerRoot_Calendar.renderCalendar(
				this._parent,
				$wrpCalendar,
				timeInfo,
				(evt, eventYear, eventDay, moonDay) => {
					if (evt.shiftKey) this._render_doJumpToDay(eventYear, eventDay);
					else this._render_openDayModal(eventYear, eventDay, moonDay);
				},
				{
					hasColumnLabels: this._parent.get("hasCalendarLabelsColumns"),
					hasRowLabels: this._parent.get("hasCalendarLabelsRows"),
				},
			);
		};
		this._parent.addHook("time", hookCalendar);
		this._parent.addHook("browseTime", hookCalendar);
		this._parent.addHook("hasCalendarLabelsColumns", hookCalendar);
		this._parent.addHook("hasCalendarLabelsRows", hookCalendar);
		this._parent.addHook("months", hookCalendar);
		this._parent.addHook("events", hookCalendar);
		this._parent.addHook("encounters", hookCalendar);
		this._parent.addHook("moons", hookCalendar);
		hookCalendar();

		$$`<div class="ve-flex-col h-100 ve-flex-h-center">
			${$dispDayReadableDate}
			<div class="split mb-2 ve-flex-v-top">
				${$dispYear}
				${$btnBrowseMode}
			</div>
			${$wrpDateControls}
			<hr class="hr-2 no-shrink">
			${$wrpCalendar}
		</div>`.appendTo($parent);
	}

	/**
	 *
	 * @param parent Parent pod.
	 * @param [opts] Options object.
	 * @param [opts.isHideDays] True if the day controls should be hidden.
	 * @param [opts.isHideWeeks] True if the week controls should be hidden.
	 * @returns {object}
	 */
	static getDateControls (parent, opts) {
		opts = opts || {};
		const {doModTime, getTimeInfo} = parent;

		const $btnSubDay = opts.isHideDays ? null : $(`<button class="btn btn-xs btn-default dm-time__btn-date-adjust"  title="Subtract Day (SHIFT for 5)">\u2012D</button>`)
			.click(evt => doModTime(-1 * getTimeInfo().secsPerDay * (evt.shiftKey ? 5 : 1)));
		const $btnAddDay = opts.isHideDays ? null : $(`<button class="btn btn-xs btn-default dm-time__btn-date-adjust" title="Add Day (SHIFT for 5)">D+</button>`)
			.click(evt => doModTime(getTimeInfo().secsPerDay * (evt.shiftKey ? 5 : 1)));

		const $btnSubWeek = opts.isHideWeeks ? null : $(`<button class="btn btn-xs btn-default dm-time__btn-date-adjust"  title="Subtract Week (SHIFT for 5)">\u2012W</button>`)
			.click(evt => doModTime(-1 * getTimeInfo().secsPerWeek * (evt.shiftKey ? 5 : 1)));
		const $btnAddWeek = opts.isHideWeeks ? null : $(`<button class="btn btn-xs btn-default dm-time__btn-date-adjust" title="Add Week (SHIFT for 5)">W+</button>`)
			.click(evt => doModTime(getTimeInfo().secsPerWeek * (evt.shiftKey ? 5 : 1)));

		const doModMonths = (numMonths) => {
			const doAddMonth = () => {
				const {
					secsPerDay,
					monthInfo,
					nextMonthInfo,
					date,
				} = getTimeInfo();

				const dateNextMonth = date > nextMonthInfo.days ? nextMonthInfo.days - 1 : date;
				const daysDiff = (monthInfo.days - date) + dateNextMonth;

				doModTime(daysDiff * secsPerDay);
			};

			const doSubMonth = () => {
				const {
					secsPerDay,
					prevMonthInfo,
					date,
				} = getTimeInfo();

				const datePrevMonth = date > prevMonthInfo.days ? prevMonthInfo.days - 1 : date;
				const daysDiff = -date - (prevMonthInfo.days - datePrevMonth);

				doModTime(daysDiff * secsPerDay);
			};

			if (numMonths === 1) doAddMonth();
			else if (numMonths === -1) doSubMonth();
			else {
				if (numMonths === 0) return;

				const timeInfoBefore = getTimeInfo();
				if (numMonths > 1) {
					[...new Array(numMonths)].forEach(() => doAddMonth());
				} else {
					[...new Array(Math.abs(numMonths))].forEach(() => doSubMonth());
				}
				const timeInfoAfter = getTimeInfo();
				if (timeInfoBefore.date !== timeInfoAfter.date && timeInfoBefore.date < timeInfoAfter.monthInfo.days) {
					const daysDiff = timeInfoBefore.date - timeInfoAfter.date;
					doModTime(daysDiff * timeInfoAfter.secsPerDay);
				}
			}
		};

		const $btnSubMonth = $(`<button class="btn btn-xs btn-default dm-time__btn-date-adjust"  title="Subtract Month (SHIFT for 5)">\u2012M</button>`)
			.click(evt => doModMonths(evt.shiftKey ? -5 : -1));
		const $btnAddMonth = $(`<button class="btn btn-xs btn-default dm-time__btn-date-adjust" title="Add Month (SHIFT for 5)">M+</button>`)
			.click(evt => doModMonths(evt.shiftKey ? 5 : 1));

		const $btnSubYear = $(`<button class="btn btn-xs btn-default dm-time__btn-date-adjust"  title="Subtract Year (SHIFT for 5)">\u2012Y</button>`)
			.click(evt => doModTime(-1 * getTimeInfo().secsPerYear * (evt.shiftKey ? 5 : 1)));
		const $btnAddYear = $(`<button class="btn btn-xs btn-default dm-time__btn-date-adjust" title="Add Year (SHIFT for 5)">Y+</button>`)
			.click(evt => doModTime(getTimeInfo().secsPerYear * (evt.shiftKey ? 5 : 1)));

		const $iptYear = $(`<input class="form-control form-control--minimal ve-text-center input-xs dm-time__calendar-ipt-date dm-time__calendar-ipt-date--slashed-right" title="Year">`)
			.change(() => {
				const {
					secsPerYear,
					year,
				} = getTimeInfo();
				const nxt = UiUtil.strToInt($iptYear.val(), 1) - 1;
				$iptYear.val(nxt + 1);
				const diffYears = nxt - year;
				doModTime(diffYears * secsPerYear);
			});
		const $iptMonth = $(`<input class="form-control form-control--minimal ve-text-center input-xs dm-time__calendar-ipt-date dm-time__calendar-ipt-date--slashed-left ${opts.isHideDays ? "" : "dm-time__calendar-ipt-date--slashed-right"}" title="Month">`)
			.change(() => {
				const {
					month,
					monthsPerYear,
				} = getTimeInfo();
				const nxtRaw = UiUtil.strToInt($iptMonth.val(), 1) - 1;
				const nxt = Math.max(0, Math.min(monthsPerYear - 1, nxtRaw));
				$iptMonth.val(nxt + 1);
				const diffMonths = nxt - month;
				doModMonths(diffMonths);
			});
		const $iptDay = opts.isHideDays ? null : $(`<input class="form-control form-control--minimal ve-text-center input-xs dm-time__calendar-ipt-date dm-time__calendar-ipt-date--slashed-left" title="Day">`)
			.change(() => {
				const {
					secsPerDay,
					date,
					monthInfo,
				} = getTimeInfo();
				const nxtRaw = UiUtil.strToInt($iptDay.val(), 1) - 1;
				const nxt = Math.max(0, Math.min(monthInfo.days - 1, nxtRaw));
				$iptDay.val(nxt + 1);
				const diffDays = nxt - date;
				doModTime(diffDays * secsPerDay);
			});

		const $wrpDateControls = $$`<div class="ve-flex ve-flex-vh-center">
			<div class="ve-flex btn-group mr-2">
				${$btnSubYear}
				${$btnSubMonth}
				${$btnSubWeek}
				${$btnSubDay}
			</div>
			<div class="mr-2 ve-flex-v-center">
				${$iptYear}
				<div class="no-shrink dm-time__calendar-date-sep">/</div>
				${$iptMonth}
				${$iptDay ? `<div class="no-shrink dm-time__calendar-date-sep">/</div>` : ""}
				${$iptDay}
			</div>
			<div class="ve-flex-h-right btn-group">
				${$btnAddDay}
				${$btnAddWeek}
				${$btnAddMonth}
				${$btnAddYear}
			</div>
		</div>`;

		return {$wrpDateControls, $iptYear, $iptMonth, $iptDay};
	}

	/**
	 * @param parent Parent pod.
	 * @param $wrpCalendar Wrapper element.
	 * @param timeInfo Time info to render.
	 * @param fnClickDay Function run with args `year, eventDay, moonDay` when a day is clicked.
	 * @param [opts] Options object.
	 * @param [opts.isHideDay] True if the day should not be highlighted.
	 * @param [opts.hasColumnLabels] True if the columns should be labelled with the day of the week.
	 * @param [opts.hasRowLabels] True if the rows should be labelled with the week of the year.
	 */
	static renderCalendar (parent, $wrpCalendar, timeInfo, fnClickDay, opts) {
		opts = opts || {};
		const {getEvents, getEncounters, getMoonInfos} = parent;

		const {
			date,
			year,
			monthInfo,
			monthStartDay,
			daysPerWeek,
			monthStartDayOfYear,
			numDays,
		} = timeInfo;

		$wrpCalendar.empty().css({display: "grid"});

		const gridOffsetX = opts.hasRowLabels ? 1 : 0;
		const gridOffsetY = opts.hasColumnLabels ? 1 : 0;

		if (opts.hasColumnLabels) {
			const days = parent.getAllDayInfos();
			days.forEach((it, i) => {
				$(`<div class="small text-muted small-caps ve-text-center" title="${it.name.escapeQuotes()}">${it.name.slice(0, 2)}</div>`)
					.css({
						"grid-column-start": `${i + gridOffsetX + 1}`,
						"grid-column-end": `${i + gridOffsetX + 2}`,
						"grid-row-start": `1`,
						"grid-row-end": `2`,
					})
					.appendTo($wrpCalendar);
			});
		}

		const daysInMonth = monthInfo.days;
		const loopBound = daysInMonth + (daysPerWeek - 1 - monthStartDay);
		for (let i = (-monthStartDay); i < loopBound; ++i) {
			const xPos = Math.floor((i + monthStartDay) % daysPerWeek);
			const yPos = Math.floor((i + monthStartDay) / daysPerWeek);

			if (xPos === 0 && opts.hasRowLabels && i < daysInMonth) {
				const weekNum = Math.floor(monthStartDayOfYear / daysPerWeek) + yPos;
				$(`<div class="small text-muted small-caps ve-flex-vh-center" title="Week ${weekNum}">${weekNum}</div>`)
					.css({
						"grid-column-start": `${xPos + 1}`,
						"grid-column-end": `${xPos + 2}`,
						"grid-row-start": `${yPos + gridOffsetY + 1}`,
						"grid-row-end": `${yPos + gridOffsetY + 2}`,
					})
					.appendTo($wrpCalendar);
			}

			let $ele;
			if (i < 0 || i >= daysInMonth) {
				$ele = $(`<div class="m-1"/>`);
			} else {
				const eventDay = monthStartDayOfYear + i;
				const moonDay = numDays - (date - i);

				const moonInfos = getMoonInfos(moonDay);
				const events = getEvents(year, eventDay);
				const encounters = getEncounters(year, eventDay);

				const activeMoons = moonInfos.filter(it => it.phaseFirstDay);
				let moonPart;
				if (activeMoons.length) {
					const $renderedMoons = activeMoons.map((m, i) => {
						if (i === 0 || activeMoons.length < 3) {
							return TimeTrackerBase.$getCvsMoon(m).addClass("dm-time__calendar-moon-phase");
						} else if (i === 1) {
							const otherMoons = activeMoons.length - 1;
							return `<div class="dm-time__calendar-moon-phase text-muted" title="${otherMoons} additional moon${otherMoons === 1 ? "" : "s"} not shown"><span class="glyphicon glyphicon-plus"/></div>`;
						}
					});

					moonPart = $$`<div class="dm-time__disp-day-moon ve-flex-col">${$renderedMoons}</div>`;
				} else moonPart = "";

				$ele = $$`<div class="dm-time__disp-calendar-day btn-xxs m-1 relative ${i === date && !opts.isHideDay ? "dm-time__disp-calendar-day--active" : ""}">
					${i + 1}
					${events.length ? `<div class="dm-time__disp-day-entry dm-time__disp-day-entry--event" title="Has Events">*</div>` : ""}
					${encounters.length ? `<div class="dm-time__disp-day-entry dm-time__disp-day-entry--encounter" title="Has Encounters">*</div>` : ""}
					${moonPart}
				</div>`.click((evt) => fnClickDay(evt, year, eventDay, moonDay));
			}
			$ele.css({
				"grid-column-start": `${xPos + gridOffsetX + 1}`,
				"grid-column-end": `${xPos + gridOffsetX + 2}`,
				"grid-row-start": `${yPos + gridOffsetY + 1}`,
				"grid-row-end": `${yPos + gridOffsetY + 2}`,
			});
			$wrpCalendar.append($ele);
		}
	}

	_render_doJumpToDay (eventYear, eventDay) {
		const {getTimeInfo, doModTime} = this._parent;

		// Calculate difference vs base time, and exit browse mode if we're in it
		const {
			year,
			dayOfYear,
			secsPerYear,
			secsPerDay,
		} = getTimeInfo({isBase: true});

		const daySecs = (eventYear * secsPerYear) + (eventDay * secsPerDay);
		const currentSecs = (year * secsPerYear) + (dayOfYear * secsPerDay);
		const offset = daySecs - currentSecs;
		doModTime(offset, {isBase: true});
		this._parent.set("isBrowseMode", false);
	}

	_render_openDayModal (eventYear, eventDay, moonDay) {
		const {getTimeInfo, getEvents, getEncounters, getMoonInfos} = this._parent;

		const $btnJumpToDay = $(`<button class="btn btn-xs btn-default" title="Set the current date to this day. This will end Browse Mode, if it is currently active.">Go to Day</button>`)
			.click(() => {
				this._render_doJumpToDay(eventYear, eventDay);
				doClose();
			});

		const $btnAddEvent = $(`<button class="btn btn-xs btn-primary"><span class="glyphicon glyphicon-plus"/> Add Event</button>`)
			.click(() => {
				const nxtPos = Object.keys(this._parent.get("events")).length;
				const nuEvent = TimeTrackerBase.getGenericEvent(nxtPos, year, eventDay);
				this._eventToEdit = nuEvent.id;
				this._parent.set("events", {...this._parent.get("events"), [nuEvent.id]: nuEvent});
			});

		const $btnAddEventAtTime = $(`<button class="btn btn-xs btn-primary" title="SHIFT to Add at Current Time">At Time...</button>`)
			.click(async evt => {
				const chosenTimeInfo = await this._render_pGetEventTimeOfDay(eventYear, eventDay, evt.shiftKey);
				if (chosenTimeInfo == null) return;

				const nxtPos = Object.keys(this._parent.get("events")).length;
				const nuEvent = TimeTrackerBase.getGenericEvent(nxtPos, chosenTimeInfo.year, chosenTimeInfo.eventDay, chosenTimeInfo.timeOfDay);
				this._eventToEdit = nuEvent.id;
				this._parent.set("events", {...this._parent.get("events"), [nuEvent.id]: nuEvent});
			});

		const {year, dayInfo, date, monthInfo, seasonInfos, yearInfos, eraInfos} = getTimeInfo({year: eventYear, dayOfYear: eventDay});

		const pMutAddEncounter = async ({exportedSublist, nuEncounter}) => {
			exportedSublist = MiscUtil.copy(exportedSublist);
			exportedSublist.name = exportedSublist.name
				|| await InputUiUtil.pGetUserString({
					title: "Enter Encounter Name",
					default: await EncounterBuilderSublistPlugin.pGetEncounterName(exportedSublist),
				})
				|| "(Unnamed encounter)";

			nuEncounter.name = exportedSublist.name;
			nuEncounter.data = exportedSublist;

			this._parent.set(
				"encounters",
				[...Object.values(this._parent.get("encounters")), nuEncounter]
					.mergeMap(it => ({[it.id]: it})),
			);
		};

		const menuEncounter = ContextUtil.getMenu([
			...ListUtilBestiary.getContextOptionsLoadSublist({
				pFnOnSelect: async ({exportedSublist}) => {
					const nxtPos = Object.keys(this._parent.get("encounters")).length;
					const nuEncounter = TimeTrackerBase.getGenericEncounter(nxtPos, year, eventDay);

					return pMutAddEncounter({exportedSublist, nuEncounter});
				},

				optsSaveManager: {
					isReferencable: true,
				},
			}),
		]);

		const menuEncounterAtTime = ContextUtil.getMenu([
			...ListUtilBestiary.getContextOptionsLoadSublist({
				pFnOnSelect: async ({exportedSublist, isShiftKey}) => {
					const chosenTimeInfo = await this._render_pGetEventTimeOfDay(eventYear, eventDay, isShiftKey);
					if (chosenTimeInfo == null) return;

					const nxtPos = Object.keys(this._parent.get("encounters")).length;
					const nuEncounter = TimeTrackerBase.getGenericEncounter(nxtPos, chosenTimeInfo.year, chosenTimeInfo.eventDay, chosenTimeInfo.timeOfDay);

					return pMutAddEncounter({exportedSublist, nuEncounter});
				},

				optsSaveManager: {
					isReferencable: true,
				},

				optsFromCurrent: {title: "SHIFT to Add at Current Time"},
				optsFromSaved: {title: "SHIFT to Add at Current Time"},
				optsFromFile: {title: "SHIFT to Add at Current Time"},
			}),
		]);

		const $btnAddEncounter = $(`<button class="btn btn-xs btn-success"><span class="glyphicon glyphicon-plus"/> Add Encounter</button>`)
			.click(evt => ContextUtil.pOpenMenu(evt, menuEncounter));

		const $btnAddEncounterAtTime = $(`<button class="btn btn-xs btn-success">At Time...</button>`)
			.click(evt => ContextUtil.pOpenMenu(evt, menuEncounterAtTime));

		const {$modalInner, doClose} = UiUtil.getShowModal({
			title: `${TimeTrackerBase.formatDateInfo(dayInfo, date, monthInfo, seasonInfos)}\u2014${TimeTrackerBase.formatYearInfo(year, yearInfos, eraInfos)}`,
			cbClose: () => {
				this._parent.removeHook("events", hookEvents);
				ContextUtil.deleteMenu(menuEncounter);
			},
			zIndex: VeCt.Z_INDEX_BENEATH_HOVER,
			isUncappedHeight: true,
			isHeight100: true,
			$titleSplit: $btnJumpToDay,
		});

		const $hrMoons = $(`<hr class="hr-2 no-shrink">`);
		const $wrpMoons = $(`<div class="ve-flex ve-flex-wrap w-100 no-shrink ve-flex-v-center"/>`);
		const hookMoons = () => {
			const todayMoonInfos = getMoonInfos(moonDay);
			$wrpMoons.empty();
			todayMoonInfos.forEach(moon => {
				$$`<div class="ve-flex-v-center mr-2">
					${TimeTrackerBase.$getCvsMoon(moon).addClass("mr-2")}
					<div class="ve-flex-col">
						<div class="ve-flex">${moon.name}</div>
						<div class="ve-flex small"><i class="mr-1">${moon.phaseName}</i><span class="text-muted">(Day ${moon.dayOfPeriod + 1}/${moon.period})</span></div>
					</div>
				</div>`.appendTo($wrpMoons);
			});
			$hrMoons.toggle(!!todayMoonInfos.length);
		};
		this._parent.addHook("moons", hookMoons);
		hookMoons();

		const $wrpEvents = $(`<div class="ve-flex-col w-100 overflow-y-auto dm-time__day-entry-wrapper"/>`);
		const hookEvents = () => {
			const todayEvents = getEvents(year, eventDay);
			$wrpEvents.empty();
			this._tmpComps = [];
			const fnOpenCalendarPicker = this._render_openDayModal_openCalendarPicker.bind(this);
			todayEvents.forEach(event => {
				const comp = TimeTrackerRoot_Settings_Event.getInstance(this._board, this._$wrpPanel, this._parent, event);
				this._tmpComps.push(comp);
				comp.render($wrpEvents, this._parent, fnOpenCalendarPicker);
			});
			if (!todayEvents.length) $wrpEvents.append(`<div class="ve-flex-vh-center italic">(No events)</div>`);
			if (this._eventToEdit) {
				const toEdit = this._tmpComps.find(it => it._state.id === this._eventToEdit);
				this._eventToEdit = null;
				if (toEdit) toEdit.doOpenEditModal();
			}
		};
		this._parent.addHook("events", hookEvents);
		hookEvents();

		const $wrpEncounters = $(`<div class="ve-flex-col w-100 overflow-y-auto dm-time__day-entry-wrapper"/>`);
		const hookEncounters = async () => {
			await this._pLock("encounters");

			const todayEncounters = getEncounters(year, eventDay);
			$wrpEncounters.empty();

			// update reference names
			await Promise.all(todayEncounters.map(async encounter => {
				const fromStorage = await TimeTrackerRoot_Calendar._pGetDereferencedEncounter(encounter);
				if (fromStorage != null) encounter.name = fromStorage.name;
			}));

			todayEncounters.forEach(encounter => {
				const $iptName = $(`<input class="form-control input-xs form-control--minimal mr-2 w-100 ${encounter.countUses > 0 ? "text-muted" : ""}">`)
					.change(() => {
						encounter.displayName = $iptName.val().trim();
						this._parent.triggerMapUpdate("encounters");
					})
					.val(encounter.displayName == null ? encounter.name : encounter.displayName);

				const $btnRunEncounter = $(`<button class="btn btn-xs btn-default mr-2 ${encounter.countUses > 0 ? "disabled" : ""}" title="${encounter.countUses > 0 ? "(Encounter has been used)" : "Run Encounter (Add to Initiative Tracker)"}"><span class="glyphicon glyphicon-play"/></button>`)
					.click(() => TimeTrackerRoot_Calendar.pDoRunEncounter(this._parent, encounter));

				const $btnResetUse = $(`<button class="btn btn-xs btn-default mr-2 ${encounter.countUses === 0 ? "disabled" : ""}" title="Reset Usage"><span class="glyphicon glyphicon-refresh"/></button>`)
					.click(() => {
						if (encounter.countUses === 0) return;

						encounter.countUses = 0;
						this._parent.triggerMapUpdate("encounters");
					});

				const $btnSaveToFile = $(`<button class="btn btn-xs btn-default mr-3" title="Download Encounter File"><span class="glyphicon glyphicon-download"/></button>`)
					.click(async () => {
						const toSave = await TimeTrackerRoot_Calendar._pGetDereferencedEncounter(encounter);

						if (!toSave) return JqueryUtil.doToast({content: "Could not find encounter data! Has the encounter been deleted?", type: "warning"});

						DataUtil.userDownload("encounter", toSave.data, {fileType: "encounter"});
					});

				const $cbHasTime = $(`<input type="checkbox">`)
					.prop("checked", encounter.hasTime)
					.change(() => {
						const nxtHasTime = $cbHasTime.prop("checked");
						if (nxtHasTime) {
							const {secsPerDay} = getTimeInfo({isBase: true});
							if (encounter.timeOfDaySecs == null) encounter.timeOfDaySecs = Math.floor(secsPerDay / 2); // Default to noon
							encounter.hasTime = true;
						} else encounter.hasTime = false;
						this._parent.triggerMapUpdate("encounters");
					});

				let timeInputs;
				if (encounter.hasTime) {
					const timeInfo = getTimeInfo({isBase: true});
					const encounterCurTime = {hours: 0, minutes: 0, seconds: 0, timeOfDaySecs: encounter.timeOfDaySecs};

					if (encounter.timeOfDaySecs != null) {
						Object.assign(encounterCurTime, TimeTrackerBase.getHoursMinutesSecondsFromSeconds(timeInfo.secsPerHour, timeInfo.secsPerMinute, encounter.timeOfDaySecs));
					}

					timeInputs = TimeTrackerBase.getClockInputs(
						timeInfo,
						encounterCurTime,
						(nxtTimeSecs) => {
							encounter.timeOfDaySecs = nxtTimeSecs;
							this._parent.triggerMapUpdate("encounters");
						},
					);
				}

				const $btnMove = $(`<button class="btn btn-xs btn-default mr-2 no-shrink"><span class="glyphicon glyphicon-move" title="Move Encounter"/></button>`)
					.click(() => {
						this._render_openDayModal_openCalendarPicker({
							title: "Choose Encounter Day",
							fnClick: (evt, eventYear, eventDay) => {
								encounter.when = {
									day: eventDay,
									year: eventYear,
								};
								this._parent.triggerMapUpdate("encounters");
							},
							prop: "encounters",
						});
					});

				const $btnDelete = $(`<button class="btn btn-xs btn-danger" title="Delete Encounter"><span class="glyphicon glyphicon-trash"/></button>`)
					.click(() => {
						encounter.isDeleted = true;
						this._parent.triggerMapUpdate("encounters");
					});

				$$`<div class="ve-flex-v-center w-100 py-1 px-2 stripe-even">
					${$iptName}
					${$btnRunEncounter}
					${$btnResetUse}
					${$btnSaveToFile}
					<label class="ve-flex-v-center ${timeInputs ? "mr-2" : "mr-3"}">
						<div class="mr-1 no-wrap">Has Time?</div>
						${$cbHasTime}
					</label>
					${timeInputs ? $$`<div class="ve-flex-v-center mr-3">
						${timeInputs.$iptHours}
						<div>:</div>
						${timeInputs.$iptMinutes}
						<div>:</div>
						${timeInputs.$iptSeconds}
					</div>` : ""}
					${$btnMove}
					${$btnDelete}
				</div>`.appendTo($wrpEncounters);
			});
			if (!todayEncounters.length) $wrpEncounters.append(`<div class="ve-flex-vh-center italic">(No encounters)</div>`);

			this._unlock("encounters");
		};
		this._parent.addHook("encounters", hookEncounters);
		hookEncounters();

		$$`<div class="ve-flex-col w-100 h-100 px-2">
			${$wrpMoons}
			${$hrMoons}
			<div class="split ve-flex-v-center mb-1 no-shrink">
				<div class="underline dm-time__day-entry-header">Events</div>
				<div class="btn-group ve-flex">${$btnAddEvent}${$btnAddEventAtTime}</div>
			</div>
			${$wrpEvents}
			<hr class="hr-2 no-shrink">
			<div class="split ve-flex-v-center mb-1 no-shrink">
				<div class="underline dm-time__day-entry-header">Encounters</div>
				<div class="btn-group ve-flex">${$btnAddEncounter}${$btnAddEncounterAtTime}</div>
			</div>
			${$wrpEncounters}
		</div>`.appendTo($modalInner);
	}

	_render_getUserEventTime () {
		const {getTimeInfo} = this._parent;
		const {
			hoursPerDay,
			minutesPerHour,
			secsPerMinute,
			secsPerHour,
		} = getTimeInfo();
		const padLengthHours = `${hoursPerDay}`.length;
		const padLengthMinutes = `${minutesPerHour}`.length;
		const padLengthSecs = `${secsPerMinute}`.length;

		return new Promise(resolve => {
			class EventTimeModal extends BaseComponent {
				render ($parent) {
					const $selMode = ComponentUiUtil.$getSelEnum(this, "mode", {values: ["Exact Time", "Time from Now"]}).addClass("mb-2");

					const $iptExHour = ComponentUiUtil.$getIptInt(
						this,
						"exactHour",
						0,
						{
							$ele: $(`<input class="form-control input-xs form-control--minimal ve-text-center mr-1">`),
							padLength: padLengthHours,
							min: 0,
							max: hoursPerDay - 1,
						},
					);
					const $iptExMinutes = ComponentUiUtil.$getIptInt(
						this,
						"exactMinute",
						0,
						{
							$ele: $(`<input class="form-control input-xs form-control--minimal ve-text-center mr-1">`),
							padLength: padLengthMinutes,
							min: 0,
							max: minutesPerHour - 1,
						},
					);
					const $iptExSecs = ComponentUiUtil.$getIptInt(
						this,
						"exactSec",
						0,
						{
							$ele: $(`<input class="form-control input-xs form-control--minimal ve-text-center">`),
							padLength: padLengthSecs,
							min: 0,
							max: secsPerMinute - 1,
						},
					);

					const $wrpExact = $$`<div class="ve-flex-vh-center">
						${$iptExHour}
						<div class="mr-1">:</div>
						${$iptExMinutes}
						<div class="mr-1">:</div>
						${$iptExSecs}
					</div>`;

					const $iptOffsetHour = ComponentUiUtil.$getIptInt(
						this,
						"offsetHour",
						0,
						{
							$ele: $(`<input class="form-control input-xs form-control--minimal ve-text-center mr-1">`),
							min: -TimeTrackerBase._MAX_TIME,
							max: TimeTrackerBase._MAX_TIME,
						},
					);
					const $iptOffsetMinutes = ComponentUiUtil.$getIptInt(
						this,
						"offsetMinute",
						0,
						{
							$ele: $(`<input class="form-control input-xs form-control--minimal ve-text-center mr-1">`),
							min: -TimeTrackerBase._MAX_TIME,
							max: TimeTrackerBase._MAX_TIME,
						},
					);
					const $iptOffsetSecs = ComponentUiUtil.$getIptInt(
						this,
						"offsetSec",
						0,
						{
							$ele: $(`<input class="form-control input-xs form-control--minimal ve-text-center mr-1">`),
							min: -TimeTrackerBase._MAX_TIME,
							max: TimeTrackerBase._MAX_TIME,
						},
					);

					const $wrpOffset = $$`<div class="ve-flex-vh-center">
						${$iptOffsetHour}
						<div class="mr-2 no-wrap">hours,</div>
						${$iptOffsetMinutes}
						<div class="mr-2 no-wrap">minutes, and</div>
						${$iptOffsetSecs}
						<div class="mr-2 no-wrap">seconds from now</div>
					</div>`;

					const hookMode = () => {
						$wrpExact.toggleClass("hidden", this._state.mode !== "Exact Time");
						$wrpOffset.toggleClass("hidden", this._state.mode === "Exact Time");
					};
					this._addHookBase("mode", hookMode);
					hookMode();

					const $btnOk = $(`<button class="btn btn-default">Enter</button>`)
						.click(() => doClose(true));

					$$`<div class="ve-flex-col h-100">
						<div class="ve-flex-vh-center ve-flex-col w-100 h-100">
							${$selMode}
							${$wrpExact}
							${$wrpOffset}
						</div>
						${$btnOk}
					</div>`.appendTo($parent);
				}

				_getDefaultState () {
					return {
						mode: "Exact Time",
						exactHour: 0,
						exactMinute: 0,
						exactSec: 0,
						offsetHour: 0,
						offsetMinute: 0,
						offsetSec: 0,
					};
				}
			}

			const md = new EventTimeModal();

			const {$modalInner, doClose} = UiUtil.getShowModal({
				title: "Enter a Time",
				cbClose: (isDataEntered) => {
					if (!isDataEntered) return resolve(null);

					const obj = md.toObject();
					if (obj.mode === "Exact Time") {
						resolve({mode: "timeExact", timeOfDaySecs: (obj.exactHour * secsPerHour) + (obj.exactMinute * secsPerMinute) + obj.exactSec});
					} else {
						resolve({mode: "timeOffset", secsOffset: (obj.offsetHour * secsPerHour) + (obj.offsetMinute * secsPerMinute) + obj.offsetSec});
					}
				},
			});

			md.render($modalInner);
		});
	}

	async _render_pGetEventTimeOfDay (eventYear, eventDay, isShiftDown) {
		const {getTimeInfo} = this._parent;

		let timeOfDay = null;
		if (isShiftDown) {
			const {timeOfDaySecs} = getTimeInfo();
			timeOfDay = timeOfDaySecs;
		} else {
			const userInput = await this._render_getUserEventTime();

			if (userInput == null) return null;

			if (userInput.mode === "timeExact") timeOfDay = userInput.timeOfDaySecs;
			else {
				const {timeOfDaySecs, secsPerYear, secsPerDay} = getTimeInfo();
				while (Math.abs(userInput.secsOffset) >= secsPerYear) {
					if (userInput.secsOffset < 0) {
						userInput.secsOffset += secsPerYear;
						eventYear -= 1;
					} else {
						userInput.secsOffset -= secsPerYear;
						eventYear += 1;
					}
				}
				eventYear = Math.max(0, eventYear);
				while (Math.abs(userInput.secsOffset) >= secsPerDay || userInput.secsOffset < 0) {
					if (userInput.secsOffset < 0) {
						userInput.secsOffset += secsPerDay;
						eventDay -= 1;
					} else {
						userInput.secsOffset -= secsPerDay;
						eventDay += 1;
					}
				}
				eventDay = Math.max(0, eventDay);
				timeOfDay = timeOfDaySecs + userInput.secsOffset;
			}
		}

		return {eventYear, eventDay, timeOfDay};
	}

	/**
	 * @param opts Options object.
	 * @param opts.title Modal title.
	 * @param opts.fnClick Click handler.
	 * @param opts.prop Component state property.
	 */
	_render_openDayModal_openCalendarPicker (opts) {
		opts = opts || {};

		const {$modalInner, doClose} = UiUtil.getShowModal({
			title: opts.title,
			zIndex: VeCt.Z_INDEX_BENEATH_HOVER,
		});

		// Create a copy of the current state, as a temp component
		const temp = new TimeTrackerBase(null, null, {isTemporary: true});
		// Copy state
		Object.assign(temp.__state, this._parent.component.__state);
		const tempPod = temp.getPod();

		const {$wrpDateControls, $iptYear, $iptMonth} = TimeTrackerRoot_Calendar.getDateControls(tempPod, {isHideWeeks: true, isHideDays: true});
		$wrpDateControls.addClass("mb-2").appendTo($modalInner);
		const $wrpCalendar = $(`<div/>`).appendTo($modalInner);

		const hookCalendar = () => {
			const timeInfo = tempPod.getTimeInfo();

			TimeTrackerRoot_Calendar.renderCalendar(
				tempPod,
				$wrpCalendar,
				timeInfo,
				(evt, eventYear, eventDay) => {
					opts.fnClick(evt, eventYear, eventDay);
					doClose();
				},
				{
					isHideDay: true,
					hasColumnLabels: this._parent.get("hasCalendarLabelsColumns"),
					hasRowLabels: this._parent.get("hasCalendarLabelsRows"),
				},
			);

			$iptYear.val(timeInfo.year + 1);
			$iptMonth.val(timeInfo.month + 1);
		};
		tempPod.addHook("time", hookCalendar);
		tempPod.addHook(opts.prop, hookCalendar);
		hookCalendar();

		const hookComp = () => this._parent.set(opts.prop, tempPod.get(opts.prop));
		tempPod.addHook(opts.prop, hookComp);
		// (Don't run hook immediately, as we won't make any changes)
	}

	static async _pGetDereferencedEncounter (encounter) {
		const saveManager = new SaveManager({
			isReadOnlyUi: true,
			page: UrlUtil.PG_BESTIARY,
			isReferencable: true,
		});
		await saveManager.pMutStateFromStorage();

		encounter = MiscUtil.copy(encounter);
		await EncounterBuilderSublistPlugin.pMutLegacyData({exportedSublist: encounter.data});

		if (
			encounter.data.managerClient_isReferencable
			&& !encounter.data.managerClient_isLoadAsCopy
			&& encounter.data.saveId
		) {
			encounter = MiscUtil.copy(encounter);

			const nxtData = await saveManager.pGetSaveBySaveId({saveId: encounter.data.saveId});
			if (!nxtData) return null;

			encounter.data = nxtData;
		}
		return encounter;
	}

	static async pDoRunEncounter (parent, encounter) {
		if (encounter.countUses > 0) return;

		const $elesData = DmScreenUtil.$getPanelDataElements({board: parent.component._board, type: PANEL_TYP_INITIATIVE_TRACKER});

		if ($elesData.length) {
			let $tracker;
			if ($elesData.length === 1) {
				$tracker = $elesData[0];
			} else {
				const ix = await InputUiUtil.pGetUserEnum({
					default: 0,
					title: "Choose a Tracker",
					placeholder: "Select tracker",
				});
				if (ix != null && ~ix) {
					$tracker = $elesData[ix];
				}
			}

			if ($tracker) {
				const toLoad = await TimeTrackerRoot_Calendar._pGetDereferencedEncounter(encounter);

				if (!toLoad) return JqueryUtil.doToast({content: "Could not find encounter data! Has the encounter been deleted?", type: "warning"});

				const {entityInfos, encounterInfo} = await ListUtilBestiary.pGetLoadableSublist({exportedSublist: toLoad.data});

				try {
					await $tracker.data("pDoLoadEncounter")({entityInfos, encounterInfo});
				} catch (e) {
					JqueryUtil.doToast({type: "error", content: `Failed to add encounter! ${VeCt.STR_SEE_CONSOLE}`});
					throw e;
				}
				JqueryUtil.doToast({type: "success", content: "Encounter added to Initiative Tracker."});
				encounter.countUses += 1;
				parent.triggerMapUpdate("encounters");
			}
		} else {
			encounter.countUses += 1;
			parent.triggerMapUpdate("encounters");
		}
	}
}

class TimeTrackerRoot_Settings extends TimeTrackerComponent {
	static getTimeNum (str, isAllowNegative) {
		return UiUtil.strToInt(
			str,
			isAllowNegative ? 0 : TimeTrackerBase._MIN_TIME,
			{
				min: isAllowNegative ? -TimeTrackerBase._MAX_TIME : TimeTrackerBase._MIN_TIME,
				max: TimeTrackerBase._MAX_TIME,
				fallbackOnNaN: isAllowNegative ? 0 : TimeTrackerBase._MIN_TIME,
			},
		);
	}

	constructor (tracker, $wrpPanel) {
		super(tracker, $wrpPanel);

		// temp components
		this._tmpComps = {};
	}

	render ($parent, parent) {
		$parent.empty();
		this._parent = parent;

		const $getIptTime = (prop, opts) => {
			opts = opts || {};
			const $ipt = $(`<input class="form-control input-xs form-control--minimal w-30 no-shrink text-right">`)
				.change(() => this._parent.set(prop, TimeTrackerRoot_Settings.getTimeNum($ipt.val(), opts.isAllowNegative)));
			const hook = () => $ipt.val(this._parent.get(prop));
			this._parent.addHook(prop, hook);
			hook();
			return $ipt;
		};

		const btnHideHooks = [];
		const $getBtnHide = (prop, $ele, ...$eles) => {
			const $btn = $(`<button class="btn btn-xs btn-default" title="Hide Section"><span class="glyphicon glyphicon-eye-close"/></button>`)
				.click(() => this._parent.set(prop, !this._parent.get(prop)));
			const hook = () => {
				const isHidden = this._parent.get(prop);
				$ele.toggleClass("hidden", isHidden);
				$btn.toggleClass("active", isHidden);
				if ($eles) $eles.forEach($e => $e.toggleClass("hidden", isHidden));
			};
			this._parent.addHook(prop, hook);
			btnHideHooks.push(hook);
			return $btn;
		};

		const $getBtnReset = (...props) => {
			return $(`<button class="btn btn-xs btn-default mr-2">Reset Section</button>`)
				.click(() => {
					if (!confirm("Are you sure?")) return;
					props.forEach(prop => this._parent.set(prop, TimeTrackerBase._DEFAULT_STATE[prop]));
				});
		};

		const $selWindUnits = $(`<select class="form-control input-xs">
				<option value="mph">Miles per Hour</option>
				<option value="kmph">Kilometres per Hour</option>
			</select>`)
			.change(() => this._parent.set("unitsWindSpeed", $selWindUnits.val()));
		const hookWindUnits = () => $selWindUnits.val(this._parent.get("unitsWindSpeed"));
		this._parent.addHook("unitsWindSpeed", hookWindUnits);
		hookWindUnits();

		const metaDays = this._render_getChildMeta_2({
			prop: "days",
			Cls: TimeTrackerRoot_Settings_Day,
			name: "Day",
			fnGetGeneric: TimeTrackerRoot.getGenericDay,
		});

		const metaMonths = this._render_getChildMeta_2({
			prop: "months",
			Cls: TimeTrackerRoot_Settings_Month,
			name: "Month",
			fnGetGeneric: TimeTrackerRoot.getGenericMonth,
		});

		const metaSeasons = this._render_getChildMeta_2({
			prop: "seasons",
			Cls: TimeTrackerRoot_Settings_Season,
			name: "Season",
			$dispEmpty: $(`<div class="ve-flex-vh-center my-1 italic w-100">(No seasons)</div>`),
			fnGetGeneric: TimeTrackerRoot.getGenericSeason,
		});

		const metaYears = this._render_getChildMeta_2({
			prop: "years",
			Cls: TimeTrackerRoot_Settings_Year,
			name: "Year",
			$dispEmpty: $(`<div class="ve-flex-vh-center my-1 italic w-100">(No named years)</div>`),
			fnGetGeneric: TimeTrackerRoot.getGenericYear,
		});

		const metaEras = this._render_getChildMeta_2({
			prop: "eras",
			Cls: TimeTrackerRoot_Settings_Era,
			name: "Era",
			$dispEmpty: $(`<div class="ve-flex-vh-center my-1 italic w-100">(No eras)</div>`),
			fnGetGeneric: TimeTrackerRoot.getGenericEra,
		});

		const metaMoons = this._render_getChildMeta_2({
			prop: "moons",
			Cls: TimeTrackerRoot_Settings_Moon,
			name: "Moon",
			$dispEmpty: $(`<div class="ve-flex-vh-center my-1 italic w-100">(No moons)</div>`),
			fnGetGeneric: TimeTrackerRoot.getGenericMoon,
		});

		const $sectClock = $$`<div class="no-shrink w-100 mb-2">
			<div class="split-v-center mb-2"><div class="w-100">Hours per Day</div>${$getIptTime("hoursPerDay")}</div>
			<div class="split-v-center mb-2"><div class="w-100">Minutes per Hour</div>${$getIptTime("minutesPerHour")}</div>
			<div class="split-v-center"><div class="w-100">Seconds per Minute</div>${$getIptTime("secondsPerMinute")}</div>
		</div>`;
		const $btnResetClock = $getBtnReset("hoursPerDay", "minutesPerHour", "secondsPerMinute");
		const $btnHideSectClock = $getBtnHide("isClockSectionHidden", $sectClock, $btnResetClock);
		const $headClock = $$`<div class="split-v-center mb-2"><div class="bold">Clock</div><div>${$btnResetClock}${$btnHideSectClock}</div></div>`;

		const $sectCalendar = $$`<div class="no-shrink w-100 mb-2">
			<label class="split-v-center mb-2"><div class="w-100">Show Calendar Column Labels</div>${ComponentUiUtil.$getCbBool(this._parent.component, "hasCalendarLabelsColumns")}</label>
			<label class="split-v-center mb-2"><div class="w-100">Show Calendar Row Labels</div>${ComponentUiUtil.$getCbBool(this._parent.component, "hasCalendarLabelsRows")}</label>
		</div>`;
		const $btnResetCalendar = $getBtnReset("hoursPerDay", "minutesPerHour", "secondsPerMinute");
		const $btnHideSectCalendar = $getBtnHide("isCalendarSectionHidden", $sectCalendar, $btnResetCalendar);
		const $headCalendar = $$`<div class="split-v-center mb-2"><div class="bold">Calendar</div><div>${$btnResetCalendar}${$btnHideSectCalendar}</div></div>`;

		const $sectMechanics = $$`<div class="no-shrink w-100 mb-2">
			<div class="split-v-center mb-2"><div class="w-100">Hours per Long rest</div>${$getIptTime("hoursPerLongRest")}</div>
			<div class="split-v-center mb-2"><div class="w-100">Minutes per Short Rest</div>${$getIptTime("minutesPerShortRest")}</div>
			<div class="split-v-center"><div class="w-100">Seconds per Round</div>${$getIptTime("secondsPerRound")}</div>
		</div>`;
		const $btnResetMechanics = $getBtnReset("hoursPerLongRest", "minutesPerShortRest", "secondsPerRound");
		const $btnHideSectMechanics = $getBtnHide("isMechanicsSectionHidden", $sectMechanics, $btnResetMechanics);
		const $headMechanics = $$`<div class="split-v-center mb-2"><div class="bold">Game Mechanics</div><div>${$btnResetMechanics}${$btnHideSectMechanics}</div></div>`;

		const $sectOffsets = $$`<div class="no-shrink w-100 mb-2">
			<div class="split-v-center mb-2"><div class="w-100 help" title="For example, to have the starting year be &quot;Year 900,&quot; enter &quot;899&quot;.">Year Offset</div>${$getIptTime("offsetYears", {isAllowNegative: true})}</div>
			<div class="split-v-center"><div class="w-100 help" title="For example, to have the first year start on the third day of the week, enter &quot;2&quot;.">Year Start Weekday Offset</div>${$getIptTime("offsetMonthStartDay")}</div>
		</div>`;
		const $btnResetOffsets = $getBtnReset("offsetYears", "offsetMonthStartDay");
		const $btnHideSectOffsetsHide = $getBtnHide("isOffsetsSectionHidden", $sectOffsets, $btnResetOffsets);
		const $headOffsets = $$`<div class="split-v-center mb-2"><div class="bold">Offsets</div><div>${$btnResetOffsets}${$btnHideSectOffsetsHide}</div></div>`;

		const $sectDays = $$`<div class="no-shrink w-100">
			<div class="split-v-center w-100 mb-1 mt-1">
				<div>Name</div>
				${metaDays.$btnAdd}
			</div>
			${metaDays.$wrpRows}
		</div>`;
		const $btnHideSectDays = $getBtnHide("isDaysSectionHidden", $sectDays);
		const $headDays = $$`<div class="split-v-center mb-1"><div class="bold">Days</div>${$btnHideSectDays}</div>`;

		const $sectMonths = $$`<div class="no-shrink w-100">
			<div class="ve-flex w-100 mb-1 mt-1">
				<div class="w-100 ve-flex-v-center">Name</div>
				<div class="w-25 no-shrink ve-text-center mr-2">Days</div>
				<div class="dm-time__spc-drag-header no-shrink mr-2"/>
				${metaMonths.$btnAdd.addClass("no-shrink")}
			</div>
			${metaMonths.$wrpRows}
		</div>`;
		const $btnHideSectMonths = $getBtnHide("isMonthsSectionHidden", $sectMonths);
		const $headMonths = $$`<div class="split-v-center mb-1"><div class="bold">Months</div>${$btnHideSectMonths}</div>`;

		const $sectSeasons = $$`<div class="no-shrink w-100">
			<div class="ve-flex w-100 mb-1 mt-1">
				<div class="w-100 ve-flex-v-center">Name</div>
				<div class="w-15 no-shrink ve-text-center mr-2 help-subtle" title="In hours. For example, to have the sun rise at 05:00, enter &quot;5&quot;.">Sunrise</div>
				<div class="w-15 no-shrink ve-text-center mr-2 help-subtle" title="In hours. For example, to have the sun set at 22:00, enter &quot;22&quot;.">Sunset</div>
				<div class="w-15 no-shrink ve-text-center mr-2 help-subtle" title="For example, to have a season start on the 1st day of the year, enter &quot;1&quot;.">Start</div>
				<div class="w-15 no-shrink ve-text-center mr-2 help-subtle" title="For example, to have a season end on the 90th day of the year, enter &quot;90&quot;.">End</div>
				${metaSeasons.$btnAdd.addClass("no-shrink")}
			</div>
			${metaSeasons.$wrpRows}
		</div>`;
		const $btnHideSectSeasons = $getBtnHide("isSeasonsSectionHidden", $sectSeasons);
		const $headSeasons = $$`<div class="split-v-center mb-1"><div class="bold">Seasons</div>${$btnHideSectSeasons}</div>`;

		const $sectYears = $$`<div class="no-shrink w-100">
			<div class="ve-flex w-100 mb-1 mt-1">
				<div class="w-100 ve-flex-v-center">Name</div>
				<div class="w-25 no-shrink ve-text-center mr-2">Year</div>
				${metaYears.$btnAdd.addClass("no-shrink")}
			</div>
			${metaYears.$wrpRows}
		</div>`;
		const $btnHideSectYears = $getBtnHide("isYearsSectionHidden", $sectYears);
		const $headYears = $$`<div class="split-v-center mb-1"><div class="bold">Named Years</div>${$btnHideSectYears}</div>`;

		const $sectEras = $$`<div class="no-shrink w-100">
			<div class="ve-flex w-100 mb-1 mt-1">
				<div class="w-100 ve-flex-v-center">Name</div>
				<div class="w-15 no-shrink ve-text-center mr-2">Abbv.</div>
				<div class="w-15 no-shrink ve-text-center mr-2">Start</div>
				<div class="w-15 no-shrink ve-text-center mr-2">End</div>
				${metaEras.$btnAdd.addClass("no-shrink")}
			</div>
			${metaEras.$wrpRows}
		</div>`;
		const $btnHideSectEras = $getBtnHide("isErasSectionHidden", $sectEras);
		const $headEras = $$`<div class="split-v-center mb-1"><div class="bold">Eras</div>${$btnHideSectEras}</div>`;

		const $sectMoons = $$`<div class="no-shrink w-100">
			<div class="ve-flex w-100 mb-1 mt-1">
				<div class="w-100 ve-flex-v-center">Moon</div>
				<div class="w-25 no-shrink ve-text-center mr-2 help-subtle" title="For example, to have a new moon appear on the third day of the first year, enter &quot;3&quot;.">Offset</div>
				<div class="w-25 no-shrink ve-text-center mr-2 help-subtle" title="Measured in days. Multiples of eight are recommended, as there are eight distinct moon phases.">Period</div>
				${metaMoons.$btnAdd.addClass("no-shrink")}
			</div>
			${metaMoons.$wrpRows}
		</div>`;
		const $btnHideSectMoons = $getBtnHide("isMoonsSectionHidden", $sectMoons);
		const $headMoons = $$`<div class="split-v-center mb-1"><div class="bold">Moons</div>${$btnHideSectMoons}</div>`;

		btnHideHooks.forEach(fn => fn());

		$$`<div class="ve-flex-col pl-2 pr-3">
			${$headClock}
			${$sectClock}
			<hr class="hr-0 mb-2">
			${$headCalendar}
			${$sectCalendar}
			<hr class="hr-0 mb-2">
			${$headMechanics}
			${$sectMechanics}
			<hr class="hr-0 mb-2">
			${$headOffsets}
			${$sectOffsets}
			<hr class="hr-0 mb-2">
			<div class="split-v-center"><div class="w-100">Wind Speed Units</div>${$selWindUnits}</div>
			<hr class="hr-2">
			${$headDays}
			${$sectDays}
			<hr class="hr-0 mt-1 mb-2">
			${$headMonths}
			${$sectMonths}
			<hr class="hr-0 mt-1 mb-2">
			${$headSeasons}
			${$sectSeasons}
			<hr class="hr-0 mt-1 mb-2">
			${$headYears}
			${$sectYears}
			<hr class="hr-0 mt-1 mb-2">
			${$headEras}
			${$sectEras}
			<hr class="hr-0 mt-1 mb-2">
			${$headMoons}
			${$sectMoons}
		</div>`.appendTo($parent);
	}

	_render_getChildMeta_2 ({prop, Cls, name, $dispEmpty = null, fnGetGeneric}) {
		const $wrpRows = this._render_$getWrpChildren();
		if ($dispEmpty) $wrpRows.append($dispEmpty);

		const $btnAdd = this._render_$getBtnAddChild({
			prop: prop,
			name,
			fnGetGeneric,
		});

		const dragMeta = {
			swapRowPositions: (ixA, ixB) => {
				const a = this._parent.component._state[prop][ixA];
				this._parent.component._state[prop][ixA] = this._parent.component._state[prop][ixB];
				this._parent.component._state[prop][ixB] = a;
				this._parent.component._triggerCollectionUpdate(prop);

				this._parent.component._state[prop]
					.map(it => this._parent.component._rendered[prop][it.id].$wrpRow)
					.forEach($it => $wrpRows.append($it));
			},
			$getChildren: () => {
				return this._parent.component._state[prop]
					.map(it => this._parent.component._rendered[prop][it.id].$wrpRow);
			},
			$parent: $wrpRows,
		};

		const renderableCollection = new Cls(
			this._parent.component,
			prop,
			$wrpRows,
			dragMeta,
		);
		const hk = () => {
			renderableCollection.render();
			if ($dispEmpty) $dispEmpty.toggleVe(!this._parent.get(prop)?.length);
		};
		this._parent.component._addHookBase(prop, hk);
		hk();

		return {$btnAdd, $wrpRows};
	}

	_render_$getWrpChildren () {
		return $(`<div class="ve-flex-col w-100 relative"></div>`);
	}

	_render_$getBtnAddChild ({prop, name, fnGetGeneric}) {
		return $(`<button class="btn btn-xs btn-primary" title="Add ${name}"><span class="glyphicon glyphicon-plus"/></button>`)
			.click(() => {
				const nxt = fnGetGeneric(this._parent.get(prop).length);
				this._parent.set(prop, [...this._parent.get(prop), nxt]);
			});
	}
}

class RenderableCollectionTimeTracker extends RenderableCollectionBase {
	constructor (comp, prop, $wrpRows, dragMeta) {
		super(comp, prop);
		this._$wrpRows = $wrpRows;
		this._dragMeta = dragMeta;
	}
}

class TimeTrackerRoot_Settings_Day extends RenderableCollectionTimeTracker {
	getNewRender (entity, i) {
		const comp = BaseComponent.fromObject(entity.data, "*");
		comp._addHookAll("state", () => {
			entity.data = comp.toObject("*");
			this._comp._triggerCollectionUpdate("days");
		});

		const $iptName = ComponentUiUtil.$getIptStr(comp, "name", {$ele: $(`<input class="form-control input-xs form-control--minimal mr-2">`)});

		const $padDrag = DragReorderUiUtil.$getDragPadOpts(() => $wrpRow, this._dragMeta);

		const $btnRemove = $(`<button class="btn btn-xs btn-danger no-shrink" title="Delete Day"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => this._comp._state.days = this._comp._state.days.filter(it => it !== entity));

		const $wrpRow = $$`<div class="ve-flex my-1 dm-time__row-delete">
			${$iptName}
			${$padDrag}
			${$btnRemove}
			<div class="dm-time__spc-button"/>
		</div>`.appendTo(this._$wrpRows);

		return {
			comp,
			$wrpRow,
		};
	}

	doUpdateExistingRender (renderedMeta, entity, i) {
		renderedMeta.comp._proxyAssignSimple("state", entity.data, true);
		if (!renderedMeta.$wrpRow.parent().is(this._$wrpRows)) renderedMeta.$wrpRow.appendTo(this._$wrpRows);
	}
}

class TimeTrackerRoot_Settings_Month extends RenderableCollectionTimeTracker {
	getNewRender (entity, i) {
		const comp = BaseComponent.fromObject(entity.data, "*");
		comp._addHookAll("state", () => {
			entity.data = comp.toObject("*");
			this._comp._triggerCollectionUpdate("months");
		});

		const $iptName = ComponentUiUtil.$getIptStr(comp, "name", {$ele: $(`<input class="form-control input-xs form-control--minimal mr-2">`)});
		const $iptDays = ComponentUiUtil.$getIptInt(comp, "days", 1, {$ele: $(`<input class="form-control input-xs form-control--minimal text-right mr-2 w-25 no-shrink">`), min: TimeTrackerBase._MIN_TIME, max: TimeTrackerBase._MAX_TIME});

		const $padDrag = DragReorderUiUtil.$getDragPadOpts(() => $wrpRow, this._dragMeta);

		const $btnRemove = $(`<button class="btn btn-xs btn-danger no-shrink" title="Delete Month"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => this._comp._state.months = this._comp._state.months.filter(it => it !== entity));

		const $wrpRow = $$`<div class="ve-flex my-1 dm-time__row-delete">
			${$iptName}
			${$iptDays}
			${$padDrag}
			${$btnRemove}
			<div class="dm-time__spc-button"/>
		</div>`.appendTo(this._$wrpRows);

		return {
			comp,
			$wrpRow,
		};
	}

	doUpdateExistingRender (renderedMeta, entity, i) {
		renderedMeta.comp._proxyAssignSimple("state", entity.data, true);
		if (!renderedMeta.$wrpRow.parent().is(this._$wrpRows)) renderedMeta.$wrpRow.appendTo(this._$wrpRows);
	}
}

class TimeTrackerRoot_Settings_Event extends TimeTrackerComponent {
	render ($parent, parent, fnOpenCalendarPicker) {
		const {getTimeInfo} = parent;

		const doShowHideEntries = () => {
			const isShown = this._state.entries.length && !this._state.isHidden;
			$wrpEntries.toggleClass("hidden", !isShown);
		};

		const $dispEntries = $(`<div class="stats stats--book dm-time__wrp-event-entries"/>`);
		const hookEntries = () => {
			$dispEntries.html(Renderer.get().render({entries: MiscUtil.copy(this._state.entries)}));
			doShowHideEntries();
		};
		this._addHookBase("entries", hookEntries);

		const $wrpEntries = $$`<div class="ve-flex">
			<div class="no-shrink dm-time__bar-entry"></div>
			${$dispEntries}
		</div>`;

		const $iptName = $(`<input class="form-control input-xs form-control--minimal mr-2 w-100">`)
			.change(() => this._state.name = $iptName.val().trim() || "(Unnamed event)");
		const hookName = () => $iptName.val(this._state.name || "(Unnamed event)");
		this._addHookBase("name", hookName);

		const $btnShowHide = $(`<button class="btn btn-xs btn-default mr-2 no-shrink"><span class="glyphicon glyphicon-eye-close"/></button>`)
			.click(() => this._state.isHidden = !this._state.isHidden);
		const hookShowHide = () => {
			$btnShowHide.toggleClass("active", !!this._state.isHidden);
			doShowHideEntries();
		};
		this._addHookBase("isHidden", hookShowHide);

		const $btnEdit = $(`<button class="btn btn-xs btn-default mr-2 no-shrink"><span class="glyphicon glyphicon-pencil" title="Edit Event"/></button>`)
			.click(() => this.doOpenEditModal());

		const $cbHasTime = $(`<input type="checkbox">`)
			.prop("checked", this._state.hasTime)
			.change(() => {
				const nxtHasTime = $cbHasTime.prop("checked");
				if (nxtHasTime) {
					const {secsPerDay} = getTimeInfo({isBase: true});
					// Modify the base state to avoid double-updating the collection
					if (this.__state.timeOfDaySecs == null) this.__state.timeOfDaySecs = Math.floor(secsPerDay / 2); // Default to noon
					this._state.hasTime = true;
				} else this._state.hasTime = false;
			});

		let timeInputs;
		if (this._state.hasTime) {
			const timeInfo = getTimeInfo({isBase: true});
			const eventCurTime = {hours: 0, minutes: 0, seconds: 0, timeOfDaySecs: this._state.timeOfDaySecs};

			if (this._state.timeOfDaySecs != null) {
				Object.assign(eventCurTime, TimeTrackerBase.getHoursMinutesSecondsFromSeconds(timeInfo.secsPerHour, timeInfo.secsPerMinute, this._state.timeOfDaySecs));
			}

			timeInputs = TimeTrackerBase.getClockInputs(
				timeInfo,
				eventCurTime,
				(nxtTimeSecs) => {
					this._state.timeOfDaySecs = nxtTimeSecs;
				},
			);
		}

		const $btnMove = $(`<button class="btn btn-xs btn-default mr-2 no-shrink"><span class="glyphicon glyphicon-move" title="Move Event"/></button>`)
			.click(() => {
				fnOpenCalendarPicker({
					title: "Choose Event Day",
					fnClick: (evt, eventYear, eventDay) => {
						this._state.when = {
							day: eventDay,
							year: eventYear,
						};
					},
					prop: "events",
				});
			});

		const $btnRemove = $(`<button class="btn btn-xs btn-danger no-shrink" title="Delete Event"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => this._state.isDeleted = true);

		hookEntries();
		hookName();
		hookShowHide();

		$$`<div class="ve-flex-col py-1 px-2 stripe-even">
			<div class="ve-flex w-100">
				${$iptName}
				${$btnShowHide}
				${$btnEdit}
				<label class="ve-flex-v-center ${timeInputs ? "mr-2" : "mr-3"}">
					<div class="mr-1 no-wrap">Has Time?</div>
					${$cbHasTime}
				</label>
				${timeInputs ? $$`<div class="ve-flex-v-center mr-3">
					${timeInputs.$iptHours}
					<div>:</div>
					${timeInputs.$iptMinutes}
					<div>:</div>
					${timeInputs.$iptSeconds}
				</div>` : ""}
				${$btnMove}
				${$btnRemove}
			</div>
			${$wrpEntries}
		</div>`.appendTo($parent);
	}

	doOpenEditModal (overlayColor = "transparent") {
		// Edit against a fake component, so we don't modify the original until we save
		const fauxComponent = new BaseComponent();
		fauxComponent._state.name = this._state.name;
		fauxComponent._state.entries = MiscUtil.copy(this._state.entries);

		const {$modalInner, doClose} = UiUtil.getShowModal({
			title: "Edit Event",
			overlayColor: overlayColor,
			cbClose: (isDataEntered) => {
				if (!isDataEntered) return;
				this._state.name = fauxComponent._state.name;
				this._state.entries = MiscUtil.copy(fauxComponent._state.entries);
			},
		});

		const $iptName = ComponentUiUtil.$getIptStr(fauxComponent, "name", {$ele: $(`<input class="form-control input-xs form-control--minimal mb-2 no-shrink">`)});
		const $iptEntries = ComponentUiUtil.$getIptEntries(fauxComponent, "entries", {$ele: $(`<textarea class="form-control input-xs form-control--minimal resize-none mb-2 h-100"/>`)});

		const $btnOk = $(`<button class="btn btn-default">Save</button>`)
			.click(() => doClose(true));

		$$`<div class="ve-flex-col h-100">
			${$iptName}
			${$iptEntries}
			<div class="ve-flex-h-right no-shrink">${$btnOk}</div>
		</div>`.appendTo($modalInner);
	}

	getState () { return MiscUtil.copy(this._state); }

	_getDefaultState () { return MiscUtil.copy(TimeTrackerBase._DEFAULT_STATE__EVENT); }

	static getInstance (board, $wrpPanel, parent, event) {
		const comp = new TimeTrackerRoot_Settings_Event(board, $wrpPanel);
		comp.setStateFrom({state: event});
		comp._addHookAll("state", () => {
			const otherEvents = Object.values(parent.get("events"))
				.filter(it => !(it.isDeleted || it.id === comp.getState().id));

			parent.set("events", [...otherEvents, comp.getState()].mergeMap(it => ({[it.id]: it})));
		});
		return comp;
	}
}

class TimeTrackerRoot_Settings_Season extends RenderableCollectionTimeTracker {
	getNewRender (entity, i) {
		const comp = BaseComponent.fromObject(entity.data, "*");
		comp._addHookAll("state", () => {
			entity.data = comp.toObject("*");
			this._comp._triggerCollectionUpdate("seasons");
		});

		const $iptName = ComponentUiUtil.$getIptStr(comp, "name", {$ele: $(`<input class="form-control input-xs form-control--minimal mr-2">`)});

		const $getIptHours = (prop) => ComponentUiUtil.$getIptInt(comp, prop, 0, {$ele: $(`<input class="form-control input-xs form-control--minimal text-right mr-2 w-15 no-shrink">`), min: 0});

		const $getIptDays = (prop) => ComponentUiUtil.$getIptInt(comp, prop, 1, {$ele: $(`<input class="form-control input-xs form-control--minimal text-right mr-2 w-15 no-shrink">`), offset: 1, min: 1});

		const $iptSunrise = $getIptHours("sunriseHour");
		const $iptSunset = $getIptHours("sunsetHour");

		const $iptDaysStart = $getIptDays("startDay");
		const $iptDaysEnd = $getIptDays("endDay");

		const $btnRemove = $(`<button class="btn btn-xs btn-danger no-shrink" title="Delete Season"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => this._comp._state.seasons = this._comp._state.seasons.filter(it => it !== entity));

		const $wrpRow = $$`<div class="ve-flex my-1">
			${$iptName}
			${$iptSunrise}
			${$iptSunset}
			${$iptDaysStart}
			${$iptDaysEnd}
			${$btnRemove}
		</div>`.appendTo(this._$wrpRows);

		return {
			comp,
			$wrpRow,
		};
	}

	doUpdateExistingRender (renderedMeta, entity, i) {
		renderedMeta.comp._proxyAssignSimple("state", entity.data, true);
		if (!renderedMeta.$wrpRow.parent().is(this._$wrpRows)) renderedMeta.$wrpRow.appendTo(this._$wrpRows);
	}
}

class TimeTrackerRoot_Settings_Year extends RenderableCollectionTimeTracker {
	getNewRender (entity, i) {
		const comp = BaseComponent.fromObject(entity.data, "*");
		comp._addHookAll("state", () => {
			entity.data = comp.toObject("*");
			this._comp._triggerCollectionUpdate("years");
		});

		const $iptName = ComponentUiUtil.$getIptStr(comp, "name", {$ele: $(`<input class="form-control input-xs form-control--minimal mr-2">`)});

		const $iptYear = ComponentUiUtil.$getIptInt(comp, "year", 1, {$ele: $(`<input class="form-control input-xs form-control--minimal text-right mr-2 w-25 no-shrink">`), offset: 1, min: 1});

		const $btnRemove = $(`<button class="btn btn-xs btn-danger no-shrink" title="Delete Year"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => this._comp._state.years = this._comp._state.years.filter(it => it !== entity));

		const $wrpRow = $$`<div class="ve-flex my-1">
			${$iptName}
			${$iptYear}
			${$btnRemove}
		</div>`.appendTo(this._$wrpRows);

		return {
			comp,
			$wrpRow,
		};
	}

	doUpdateExistingRender (renderedMeta, entity, i) {
		renderedMeta.comp._proxyAssignSimple("state", entity.data, true);
		if (!renderedMeta.$wrpRow.parent().is(this._$wrpRows)) renderedMeta.$wrpRow.appendTo(this._$wrpRows);
	}
}

class TimeTrackerRoot_Settings_Era extends RenderableCollectionTimeTracker {
	getNewRender (entity, i) {
		const comp = BaseComponent.fromObject(entity.data, "*");
		comp._addHookAll("state", () => {
			entity.data = comp.toObject("*");
			this._comp._triggerCollectionUpdate("eras");
		});

		const $getIptYears = (prop) => ComponentUiUtil.$getIptInt(comp, prop, 1, {$ele: $(`<input class="form-control input-xs form-control--minimal text-right mr-2 w-15 no-shrink">`), offset: 1, min: 1});

		const $iptName = ComponentUiUtil.$getIptStr(comp, "name", {$ele: $(`<input class="form-control input-xs form-control--minimal mr-2">`)});
		const $iptAbbreviation = ComponentUiUtil.$getIptStr(comp, "abbreviation", {$ele: $(`<input class="form-control input-xs form-control--minimal mr-2 w-15 no-shrink">`)});
		const $iptYearsStart = $getIptYears("startYear");
		const $iptYearsEnd = $getIptYears("endYear");

		const $btnRemove = $(`<button class="btn btn-xs btn-danger no-shrink" title="Delete Year"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => this._comp._state.eras = this._comp._state.eras.filter(it => it !== entity));

		const $wrpRow = $$`<div class="ve-flex my-1">
			${$iptName}
			${$iptAbbreviation}
			${$iptYearsStart}
			${$iptYearsEnd}
			${$btnRemove}
		</div>`.appendTo(this._$wrpRows);

		return {
			comp,
			$wrpRow,
		};
	}

	doUpdateExistingRender (renderedMeta, entity, i) {
		renderedMeta.comp._proxyAssignSimple("state", entity.data, true);
		if (!renderedMeta.$wrpRow.parent().is(this._$wrpRows)) renderedMeta.$wrpRow.appendTo(this._$wrpRows);
	}
}

class TimeTrackerRoot_Settings_Moon extends RenderableCollectionTimeTracker {
	getNewRender (entity, i) {
		const comp = BaseComponent.fromObject(entity.data, "*");
		comp._addHookAll("state", () => {
			entity.data = comp.toObject("*");
			this._comp._triggerCollectionUpdate("moons");
		});

		const $iptName = ComponentUiUtil.$getIptStr(comp, "name", {$ele: $(`<input class="form-control input-xs form-control--minimal mr-2">`)});
		const $iptColor = ComponentUiUtil.$getIptColor(comp, "color", {$ele: $(`<input class="form-control input-xs form-control--minimal mr-2 no-shrink dm-time__ipt-color-moon" type="color" title="Moon Color">`)});
		const $iptPhaseOffset = ComponentUiUtil.$getIptInt(comp, "phaseOffset", 0, {$ele: $(`<input class="form-control input-xs form-control--minimal text-right mr-2 w-25 no-shrink">`)});
		const $iptPeriod = ComponentUiUtil.$getIptInt(comp, "period", 1, {$ele: $(`<input class="form-control input-xs form-control--minimal text-right mr-2 w-25 no-shrink">`), min: TimeTrackerBase._MIN_TIME, max: TimeTrackerBase._MAX_TIME});

		const $btnRemove = $(`<button class="btn btn-xs btn-danger no-shrink" title="Delete Moon"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => this._comp._state.moons = this._comp._state.moons.filter(it => it !== entity));

		const $wrpRow = $$`<div class="ve-flex my-1">
			${$iptName}
			${$iptColor}
			${$iptPhaseOffset}
			${$iptPeriod}
			${$btnRemove}
		</div>`.appendTo(this._$wrpRows);

		return {
			comp,
			$wrpRow,
		};
	}

	doUpdateExistingRender (renderedMeta, entity, i) {
		renderedMeta.comp._proxyAssignSimple("state", entity.data, true);
		if (!renderedMeta.$wrpRow.parent().is(this._$wrpRows)) renderedMeta.$wrpRow.appendTo(this._$wrpRows);
	}
}
