/* Stride — Plan Builder
   Builds periodized training plans for all segments and fitness levels.
   Handles first-timer through elite, with injury-aware adjustments. */

var SEGMENT_WEEK_CONFIG = {
  FIRST_TIMER: { base: 6, build: 4, peak: 2, taper: 2 },
  RETURNER:   { base: 5, build: 4, peak: 2, taper: 2 },
  COMPETITIVE:{ base: 4, build: 5, peak: 3, taper: 2 },
  TRAIL:      { base: 5, build: 5, peak: 3, taper: 2 },
};

var DISTANCE_TOTAL_WEEKS = {
  "5K": 10,
  "10K": 12,
  "Half Marathon": 14,
  "Marathon": 16,
  "Ultra": 18,
};

var ELITE_DISTANCES = ["Half Marathon", "Marathon", "Ultra"];

function getPhaseBg(phase) {
  var map = {
    base: "", build: "", peak: "", taper: "",
  };
  return map[phase] || "";
}

function getPhaseColor(phase) {
  var map = {
    base: "text-cobalt", build: "text-violet", peak: "text-magenta", taper: "text-lime",
  };
  return map[phase] || "text-cobalt";
}

function getWorkoutClass(type) {
  var map = {
    easy: "badge-easy", tempo: "badge-tempo", long: "badge-long",
    rest: "badge-rest", strength: "badge-strength", cross: "badge-cross",
    mobility: "badge-mobility", interval: "badge-tempo", threshold: "badge-tempo",
    vo2max: "badge-tempo",
  };
  return map[type] || "";
}

/* Calculate target mileage for a given week within a phase.
   Handles weeklyMileage up to 200 without producing absurd numbers. */
function mileageForWeek(weeklyMileage, weekIndex, totalWeeks, phase, phaseWeeks, phaseIndex) {
  if (phase === "taper") {
    // Taper: progressively reduce to 50-60% of peak
    var taperProgress = weekIndex / (phaseWeeks - 1 || 1);
    var taperFactor = 1 - (0.4 * taperProgress);
    return Math.round(weeklyMileage * Math.min(1.15, 1 + 0.05 * (totalWeeks / 4)) * taperFactor);
  }

  if (phase === "base") {
    // Base: ramp from ~50% to ~85% of peak
    var baseProgress = (weekIndex + 1) / phaseWeeks;
    var baseFactor = 0.5 + (0.4 * baseProgress);
    return Math.round(weeklyMileage * baseFactor);
  }

  if (phase === "build") {
    // Build: 85% to 115% of base weekly mileage
    var buildProgress = weekIndex / (phaseWeeks - 1 || 1);
    var buildFactor = 0.85 + (0.3 * buildProgress);
    return Math.round(weeklyMileage * buildFactor);
  }

  if (phase === "peak") {
    // Peak: 110-115% of base — hard weeks
    var peakFactor = 1.1 + (weekIndex % 2 === 0 ? 0.05 : 0);
    return Math.round(weeklyMileage * peakFactor);
  }

  return Math.round(weeklyMileage);
}

/* Determine if this is an elite-tier athlete */
function isElite(segment, weeklyMileage, goalDistance) {
  return segment === "COMPETITIVE" &&
         weeklyMileage >= 70 &&
         ELITE_DISTANCES.indexOf(goalDistance) !== -1;
}

/* Generate workouts for a week */
function generateWorkouts(weekMileage, phase, isEliteTier, weeklyMileage, weekNumber, totalWeeks) {
  var workouts = [];
  var longRunPct = phase === "peak" ? 0.35 : phase === "taper" ? 0.20 : 0.28;
  var longRunDist = Math.round(weekMileage * longRunPct * 10) / 10;

  // Cap long run at 22 miles (reasonable max)
  if (longRunDist > 22) longRunDist = 22;
  if (longRunDist < 1) longRunDist = 1;

  // Distribute remaining mileage across easy/tempo days
  var remaining = weekMileage - longRunDist;
  var easyDays = phase === "peak" ? 3 : phase === "taper" ? 3 : 4;

  if (phase === "taper") easyDays = 2;
  if (phase === "base") easyDays = 4;

  var easyDist = remaining > 0 ? Math.round((remaining / easyDays) * 10) / 10 : 0;

  // Mon: Rest
  workouts.push({ dayOfWeek: 0, type: "rest" });

  // Tue: Easy or quality (elite gets intervals)
  if (isEliteTier && (phase === "build" || phase === "peak") && weekNumber % 2 === 0) {
    workouts.push({ dayOfWeek: 1, type: "interval", targetDistance: easyDist, targetDuration: null, notes: "VO2 max intervals: 5x1000m at 5K pace with 90s jog recovery" });
  } else if (isEliteTier && phase === "build" && weekNumber % 2 === 1) {
    workouts.push({ dayOfWeek: 1, type: "threshold", targetDistance: easyDist, targetDuration: null, notes: "Threshold: 4x1.5mi at threshold pace with 60s rest" });
  } else {
    workouts.push({ dayOfWeek: 1, type: "easy", targetDistance: easyDist, targetDuration: null, notes: "Recovery pace, conversational" });
  }

  // Wed: Easy or quality
  workouts.push({ dayOfWeek: 2, type: "easy", targetDistance: easyDist, targetDuration: null, notes: "Steady, conversational pace" });

  // Thu: Quality day — tempo or threshold
  if (phase === "build" || phase === "peak") {
    if (isEliteTier && weekNumber % 2 === 0) {
      workouts.push({ dayOfWeek: 3, type: "threshold", targetDistance: easyDist, targetDuration: null, notes: "Threshold: 3x2mi at threshold pace" });
    } else {
      workouts.push({ dayOfWeek: 3, type: "tempo", targetDistance: easyDist, targetDuration: null, notes: "Tempo effort — comfortably hard, could hold for an hour" });
    }
  } else {
    workouts.push({ dayOfWeek: 3, type: "easy", targetDistance: easyDist, targetDuration: null, notes: "Recovery pace" });
  }

  // Fri: Rest or cross
  if (isEliteTier && phase !== "taper") {
    workouts.push({ dayOfWeek: 4, type: "easy", targetDistance: easyDist * 0.8, targetDuration: null, notes: "Shakeout — very easy" });
  } else {
    workouts.push({ dayOfWeek: 4, type: "rest" });
  }

  // Sat: Long run
  workouts.push({ dayOfWeek: 5, type: "long", targetDistance: longRunDist, targetDuration: null, notes: "Long run — steady, negative split if feeling good" });

  // Sun: Recovery or rest
  workouts.push({ dayOfWeek: 6, type: "easy", targetDistance: easyDist * 0.6, targetDuration: null, notes: "Recovery jog or walk" });

  return workouts;
}

/* Generate warnings based on plan inputs */
function generateWarnings(segment, weeklyMileage, goalDistance, goalRaceDate, injuryHistory, isReturner) {
  var warnings = [];

  // Mileage/goal mismatch: aggressive timeline
  if (weeklyMileage < 10 && (goalDistance === "Marathon" || goalDistance === "Ultra")) {
    var weeksUntilRace = Infinity;
    if (goalRaceDate) {
      var raceDate = new Date(goalRaceDate + "T00:00:00");
      var now = new Date();
      weeksUntilRace = Math.floor((raceDate - now) / (7 * 86400000));
    }
    if (weeksUntilRace < 12) {
      warnings.push("This timeline is aggressive for your current mileage. Consider a shorter race or a longer training window.");
    }
  }

  // Very low mileage
  if (weeklyMileage < 5) {
    warnings.push("Building from very low mileage — expect a conservative ramp. Consistency matters more than distance right now.");
  }

  // Past date
  if (goalRaceDate) {
    var rd = new Date(goalRaceDate + "T00:00:00");
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    if (rd < today) {
      warnings.push("This plan is based on the date you entered, which has already passed. Adjust your race date for an accurate timeline.");
    }
  }

  // Injury history for returners
  if (isReturner && injuryHistory) {
    warnings.push("Injury history noted — week 1 mileage reduced by 30% and base phase extended to ease you back safely.");
  }

  return warnings;
}

/* Main plan builder */
function buildPlan(options) {
  try {
    var segment = options.segment || "FIRST_TIMER";
    var goalDistance = options.goalDistance || "5K";
    var goalRaceDate = options.goalRaceDate || "";
    var weeklyMileage = parseInt(options.weeklyMileage) || 10;
    var recentRaceTimeSecs = options.recentRaceTimeSecs || undefined;
    var recentRaceDistance = options.recentRaceDistance || undefined;
    var injuryHistory = options.injuryHistory || undefined;
    var elevationGain = options.elevationGain || undefined;

    // Clamp mileage to 0-200
    weeklyMileage = Math.max(0, Math.min(200, weeklyMileage));

    // Is this a returner with injury?
    var isReturner = segment === "RETURNER";
    var hasInjury = isReturner && injuryHistory;

    // Get week config
    var weekConfig = SEGMENT_WEEK_CONFIG[segment] || SEGMENT_WEEK_CONFIG["FIRST_TIMER"];

    // Adjust for injury: extend base by 1 week
    if (hasInjury) {
      weekConfig = {
        base: weekConfig.base + 1,
        build: weekConfig.build,
        peak: weekConfig.peak,
        taper: weekConfig.taper,
      };
    }

    // No goal race? Build a base-building plan (no taper)
    var hasRaceDate = !!goalRaceDate;
    if (!hasRaceDate) {
      weekConfig = { base: 6, build: 4, peak: 2, taper: 0 };
    }

    // Past date? Still generate, but note it
    var pastDate = false;
    if (goalRaceDate) {
      var rd = new Date(goalRaceDate + "T00:00:00");
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      pastDate = rd < today;
    }

    // Elite tier detection
    var elite = isElite(segment, weeklyMileage, goalDistance);

    // Calculate total weeks
    var totalWeeks = 0;
    for (var phase in weekConfig) {
      totalWeeks += weekConfig[phase];
    }

    // Build weeks
    var weeks = [];
    var weekNum = 1;
    var phases = ["base", "build", "peak", "taper"];

    for (var pi = 0; pi < phases.length; pi++) {
      var phase = phases[pi];
      var phaseWeekCount = weekConfig[phase];
      if (phaseWeekCount <= 0) continue;

      for (var wi = 0; wi < phaseWeekCount; wi++) {
        var m = mileageForWeek(weeklyMileage, wi, totalWeeks, phase, phaseWeekCount, pi);

        // Injury adjustment: reduce week 1 mileage by 30%
        if (hasInjury && weekNum === 1) {
          m = Math.round(m * 0.7);
        }

        // Ensure minimum mileage
        if (m < 2 && weeklyMileage >= 2) m = 2;

        var wkWorkouts = generateWorkouts(m, phase, elite, weeklyMileage, weekNum, totalWeeks);

        weeks.push({
          weekNumber: weekNum,
          phase: phase,
          totalMileage: m,
          workouts: wkWorkouts,
        });
        weekNum++;
      }
    }

    // Compute paces
    var paces = computePaces(recentRaceTimeSecs, recentRaceDistance, goalDistance);

    // Generate warnings
    var warnings = generateWarnings(segment, weeklyMileage, goalDistance, goalRaceDate, injuryHistory, isReturner);

    return {
      segment: segment,
      goalDistance: goalDistance,
      goalRaceDate: goalRaceDate,
      weeklyMileage: weeklyMileage,
      totalWeeks: weeks.length,
      weeks: weeks,
      paces: paces,
      warnings: warnings,
      isElite: elite,
      pastDate: pastDate,
    };
  } catch (e) {
    return { error: true, message: "Something went wrong building your plan. Try again." };
  }
}
