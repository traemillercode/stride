// Stride Plan Builder — browser-compatible
const SEGMENT_WEEK_CONFIG = {
  FIRST_TIMER: { base: 4, build: 4, peak: 2, taper: 2 },
  RETURNER: { base: 4, build: 4, peak: 3, taper: 2 },
  COMPETITIVE: { base: 4, build: 5, peak: 3, taper: 2 },
  TRAIL: { base: 4, build: 4, peak: 3, taper: 2 },
};

function mileageForWeek(phase, weekInPhase, totalPhaseWeeks, baseMileage, segment) {
  const progress = totalPhaseWeeks > 1 ? weekInPhase / (totalPhaseWeeks - 1) : 0;
  switch (phase) {
    case "base":
      return Math.round(baseMileage * (0.7 + 0.3 * progress));
    case "build": {
      const mult = segment === "COMPETITIVE" ? 1.4 : segment === "TRAIL" ? 1.25 : 1.3;
      return Math.round(baseMileage * (1.0 + (mult - 1.0) * progress));
    }
    case "peak": {
      const peakBase = segment === "COMPETITIVE" ? 1.4 : segment === "TRAIL" ? 1.25 : 1.3;
      return Math.round(baseMileage * (peakBase - 0.05 + 0.05 * progress));
    }
    case "taper": {
      const peakMileage = segment === "COMPETITIVE" ? 1.35 : segment === "TRAIL" ? 1.2 : 1.25;
      return Math.round(baseMileage * (peakMileage - (peakMileage - 0.4) * progress));
    }
    default:
      return baseMileage;
  }
}

function generateWorkoutsForWeek(weekMileage, phase, weekInPhase, paces, segment) {
  const workouts = [];
  const daysPerWeek = segment === "FIRST_TIMER" ? 4 : segment === "COMPETITIVE" ? 6 : 5;
  const longRunPct = 0.3, tempoPct = 0.2, thresholdPct = 0.18, easyRunPct = 0.08;

  const runningDays = [];
  if (phase === "taper") {
    runningDays.push("easy", "tempo", "easy", "long");
  } else if (phase === "peak" || phase === "build") {
    if (daysPerWeek >= 6) runningDays.push("easy", "tempo", "easy", "threshold", "rest", "long");
    else runningDays.push("easy", "tempo", "easy", "long", "rest");
  } else {
    runningDays.push("easy", "easy", "tempo", "easy", "long");
  }

  while (runningDays.length < 7) {
    if (runningDays.length >= daysPerWeek) runningDays.push("rest");
    else if (segment === "TRAIL" && !runningDays.includes("cross")) runningDays.push("cross");
    else if (!runningDays.includes("strength") && weekInPhase > 1) runningDays.push("strength");
    else runningDays.push("rest");
  }

  const finalDays = runningDays.slice(0, 7);

  finalDays.forEach(function(type, idx) {
    let targetDistance = null, targetDuration = null, notes = null;
    switch (type) {
      case "long":
        targetDistance = Math.round(weekMileage * longRunPct * 10) / 10;
        targetDuration = Math.round(targetDistance * (paces.longRunSecsPerMi / 60));
        notes = "steady effort, conversational pace";
        break;
      case "tempo":
        targetDistance = Math.round(weekMileage * tempoPct * 10) / 10;
        targetDuration = Math.round(targetDistance * (paces.tempoSecsPerMi / 60));
        notes = "comfortably hard — could hold for an hour";
        break;
      case "threshold":
        targetDistance = Math.round(weekMileage * thresholdPct * 10) / 10;
        targetDuration = Math.round(targetDistance * (paces.thresholdSecsPerMi / 60));
        notes = "lactate threshold effort — controlled but fast";
        break;
      case "easy":
        targetDistance = Math.round(weekMileage * easyRunPct * 10) / 10;
        targetDuration = Math.round(targetDistance * (paces.easySecsPerMi / 60));
        notes = "conversational — should feel almost too easy";
        break;
      case "rest":
        notes = "full rest or gentle walk";
        break;
      case "strength":
        targetDuration = 30;
        notes = "bodyweight or light weights, core focus";
        break;
      case "cross":
        targetDuration = 40;
        notes = "bike, swim, or hike — low impact";
        break;
      case "mobility":
        targetDuration = 20;
        notes = "foam rolling, dynamic stretches, yoga";
        break;
    }
    workouts.push({
      dayOfWeek: idx,
      type: type,
      targetDistance: targetDistance && targetDistance > 0 ? targetDistance : null,
      targetDuration: targetDuration,
      notes: notes,
    });
  });

  return workouts;
}

function buildPlan(input) {
  const paces = calculatePaces(input);
  const weekConfig = SEGMENT_WEEK_CONFIG[input.segment] || SEGMENT_WEEK_CONFIG.FIRST_TIMER;
  const totalWeeks = weekConfig.base + weekConfig.build + weekConfig.peak + weekConfig.taper;
  const weeks = [];
  const phases = ["base", "build", "peak", "taper"];
  let weekNum = 1;

  phases.forEach(function(phase) {
    const phaseWeeks = weekConfig[phase];
    for (let w = 0; w < phaseWeeks; w++) {
      const mileage = mileageForWeek(phase, w, phaseWeeks, input.weeklyMileage, input.segment);
      const workouts = generateWorkoutsForWeek(mileage, phase, w, paces, input.segment);
      weeks.push({ weekNumber: weekNum, phase: phase, totalMileage: mileage, workouts: workouts });
      weekNum++;
    }
  });

  return {
    segment: input.segment,
    goalDistance: input.goalDistance,
    goalRaceDate: input.goalRaceDate,
    weeklyMileage: input.weeklyMileage,
    paces: paces,
    weeks: weeks,
    totalWeeks: totalWeeks,
  };
}

function getPhaseColor(phase) {
  const map = { base: "text-cobalt", build: "text-violet", peak: "text-magenta", taper: "text-lime" };
  return map[phase] || "";
}

function getPhaseBg(phase) {
  const map = { base: "border-l-cobalt", build: "border-l-violet", peak: "border-l-magenta", taper: "border-l-lime" };
  return map[phase] || "";
}

function getWorkoutClass(type) {
  const map = {
    easy: "badge-easy", tempo: "badge-tempo", long: "badge-long",
    rest: "badge-rest", strength: "badge-strength", cross: "badge-cross", mobility: "badge-mobility",
  };
  return map[type] || "badge-rest";
}

var DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
