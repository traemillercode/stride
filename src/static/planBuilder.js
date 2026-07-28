/* Stride — Plan Builder
   Builds periodized training plans for all segments and fitness levels.
   Handles first-timer through elite, with injury-aware adjustments. */

var DAY_NAMES_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
var DAY_INDEX = { "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6 };
var DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
function generateWorkouts(weekMileage, phase, isEliteTier, weeklyMileage, weekNumber, totalWeeks, dayPrefs) {
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

  // Default day assignments (pre-remap)
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

  // Apply day preferences if provided
  if (dayPrefs && dayPrefs.availableDays && dayPrefs.availableDays.length >= 3) {
    workouts = remapDays(workouts, dayPrefs);
  }

  return workouts;
}

/* Remap workout days based on user preferences */
function remapDays(workouts, dayPrefs) {
  var availableDays = dayPrefs.availableDays || [];
  var restDay = dayPrefs.restDay || "Sunday";
  var longRunDay = dayPrefs.longRunDay || "Weekend";

  // Convert available day names to indices
  var availableIndices = [];
  for (var i = 0; i < availableDays.length; i++) {
    var idx = DAY_INDEX[availableDays[i]];
    if (idx !== undefined) availableIndices.push(idx);
  }
  availableIndices.sort(function(a, b) { return a - b; });

  // Determine rest day index
  var restIdx = DAY_INDEX[restDay];
  if (restIdx === undefined) restIdx = 6; // default Sunday

  // Determine long run day: Sat (5) for Weekend, Wed (2) for Weekday
  var longIdx = longRunDay === "Weekday" ? 2 : 5;

  // If the preferred long run day isn't available, pick the closest available
  if (availableIndices.indexOf(longIdx) === -1) {
    // Find nearest available day to preferred long run day
    var best = availableIndices[0];
    var bestDist = Math.abs(longIdx - best);
    for (var j = 1; j < availableIndices.length; j++) {
      var dist = Math.abs(longIdx - availableIndices[j]);
      if (dist < bestDist) { bestDist = dist; best = availableIndices[j]; }
    }
    longIdx = best;
  }

  // Strategy:
  // 1. Place "long" workout on longIdx
  // 2. Place "rest" workouts on restIdx (and any non-available days)
  // 3. Distribute remaining workouts across available days in order
  // 4. Mark non-available days as rest

  // First, extract workout types in order (excluding rest days)
  var nonRestWorkouts = [];
  for (var k = 0; k < workouts.length; k++) {
    if (workouts[k].type !== "rest") {
      nonRestWorkouts.push(workouts[k]);
    }
  }

  // Separate long run from others
  var longWorkout = null;
  var otherWorkouts = [];
  for (var m = 0; m < nonRestWorkouts.length; m++) {
    if (nonRestWorkouts[m].type === "long") {
      longWorkout = nonRestWorkouts[m];
    } else {
      otherWorkouts.push(nonRestWorkouts[m]);
    }
  }

  // Build new 7-day array, all rest by default
  var remapped = [];
  for (var d = 0; d < 7; d++) {
    remapped.push({ dayOfWeek: d, type: "rest" });
  }

  // Place long run on longIdx
  if (longWorkout && availableIndices.indexOf(longIdx) !== -1) {
    remapped[longIdx] = { dayOfWeek: longIdx, type: longWorkout.type, targetDistance: longWorkout.targetDistance, targetDuration: longWorkout.targetDuration, notes: longWorkout.notes };
  }

  // Place remaining workouts on other available days (skip longIdx and restIdx if it's a rest)
  var workoutIdx = 0;
  for (var w = 0; w < availableIndices.length; w++) {
    var dayIdx = availableIndices[w];
    // Skip long run day and rest day
    if (dayIdx === longIdx) continue;
    if (dayIdx === restIdx) continue;
    if (workoutIdx < otherWorkouts.length) {
      var ow = otherWorkouts[workoutIdx];
      remapped[dayIdx] = { dayOfWeek: dayIdx, type: ow.type, targetDistance: ow.targetDistance, targetDuration: ow.targetDuration, notes: ow.notes };
      workoutIdx++;
    } else {
      // Extra available day with no workout assigned — fill with easy
      remapped[dayIdx] = { dayOfWeek: dayIdx, type: "easy", targetDistance: null, targetDuration: null, notes: "Recovery — optional easy jog" };
    }
  }

  // If we couldn't place all workouts (too few available days), try placing on already-used days
  while (workoutIdx < otherWorkouts.length) {
    // Place on the first available non-rest-day that isn't the long run day
    var placed = false;
    for (var p = 0; p < availableIndices.length; p++) {
      var pIdx = availableIndices[p];
      if (pIdx === restIdx) continue;
      if (pIdx === longIdx) continue;
      if (remapped[pIdx].type === "rest") {
        var ow2 = otherWorkouts[workoutIdx];
        remapped[pIdx] = { dayOfWeek: pIdx, type: ow2.type, targetDistance: ow2.targetDistance, targetDuration: ow2.targetDuration, notes: ow2.notes };
        workoutIdx++;
        placed = true;
        break;
      }
    }
    if (!placed) break; // can't place more
  }

  return remapped;
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

    // New onboarding depth options
    var availableDays = options.availableDays || [];
    var restDay = options.restDay || "Sunday";
    var longRunDay = options.longRunDay || "Weekend";
    var easyRunPaceSecs = options.easyRunPaceSecs || undefined;
    var priorRaceTimeSecs = options.priorRaceTimeSecs || undefined;
    var priorRaceDistance = options.priorRaceDistance || undefined;
    var goalTimeSecs = options.goalTimeSecs || undefined;
    var recentBestTimeSecs = options.recentBestTimeSecs || undefined;
    var recentBestDistance = options.recentBestDistance || undefined;

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

    // Build day preferences object for workout placement
    var dayPrefs = null;
    if (availableDays.length >= 3) {
      dayPrefs = {
        availableDays: availableDays,
        restDay: restDay,
        longRunDay: longRunDay,
      };
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

        var wkWorkouts = generateWorkouts(m, phase, elite, weeklyMileage, weekNum, totalWeeks, dayPrefs);

        weeks.push({
          weekNumber: weekNum,
          phase: phase,
          totalMileage: m,
          workouts: wkWorkouts,
        });
        weekNum++;
      }
    }

    // Determine which race time to use for pace calculation
    // Priority: priorRaceTimeSecs (returner) > recentRaceTimeSecs (competitive) > recentBestTimeSecs
    var paceTime = priorRaceTimeSecs || recentRaceTimeSecs || recentBestTimeSecs;
    var paceDist = priorRaceTimeSecs ? priorRaceDistance : recentRaceTimeSecs ? recentRaceDistance : recentBestTimeSecs ? recentBestDistance : undefined;

    // Compute paces
    var paces = computePaces(paceTime, paceDist, goalDistance);

    // Override easy pace if user provided their own
    if (easyRunPaceSecs && easyRunPaceSecs > 0) {
      paces.easySecsPerMi = easyRunPaceSecs;
      // Also adjust long run pace proportionally from easy pace (long run: ~15% faster than easy)
      paces.longRunSecsPerMi = Math.round(easyRunPaceSecs * 0.85);
    }

    // If goalTimeSecs is provided, override raceGoalSecsPerMi
    if (goalTimeSecs && goalTimeSecs > 0) {
      var goalDistKm = DISTANCE_KM[goalDistance] || 5;
      var goalDistMi = goalDistKm / 1.60934;
      var goalPace = Math.round(goalTimeSecs / goalDistMi);
      paces.raceGoalSecsPerMi = Math.max(210, Math.min(900, goalPace));
      paces.predictedFinishTimeSecs = goalTimeSecs;
    }

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
