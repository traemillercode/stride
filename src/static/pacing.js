// Stride Pacing Calculator — browser-compatible
const DISTANCE_MILES = {
  "5K": 3.10686,
  "10K": 6.21371,
  "Half Marathon": 13.1094,
  Marathon: 26.2188,
  Ultra: 31.069,
};

function distanceToMiles(distance) {
  return DISTANCE_MILES[distance] || 6.21371;
}

function riegelPredict(knownTimeSecs, knownDistanceMiles, targetDistanceMiles) {
  return knownTimeSecs * Math.pow(targetDistanceMiles / knownDistanceMiles, 1.06);
}

function estimateBaselinePace(weeklyMileage, segment) {
  switch (segment) {
    case "COMPETITIVE":
      return 420 + Math.max(0, (30 - weeklyMileage) * 2);
    case "TRAIL":
      return 540 + Math.max(0, (20 - weeklyMileage) * 3);
    case "RETURNER":
      return 510 + Math.max(0, (25 - weeklyMileage) * 2.5);
    case "FIRST_TIMER":
    default:
      return 600 + Math.max(0, (15 - weeklyMileage) * 4);
  }
}

function calculatePaces(input) {
  const goalMiles = distanceToMiles(input.goalDistance);
  let raceGoalSecsPerMi;

  if (input.recentRaceTimeSecs && input.recentRaceDistance) {
    const knownMiles = distanceToMiles(input.recentRaceDistance);
    const predictedTotalSecs = riegelPredict(input.recentRaceTimeSecs, knownMiles, goalMiles);
    raceGoalSecsPerMi = Math.round(predictedTotalSecs / goalMiles);
  } else {
    const est10KSecsPerMi = estimateBaselinePace(input.weeklyMileage, input.segment);
    const est10KTotal = est10KSecsPerMi * distanceToMiles("10K");
    const predictedTotalSecs = riegelPredict(est10KTotal, distanceToMiles("10K"), goalMiles);
    raceGoalSecsPerMi = Math.round(predictedTotalSecs / goalMiles);
  }

  const easySecsPerMi = Math.round(raceGoalSecsPerMi * 1.3);
  const tempoSecsPerMi = Math.round(raceGoalSecsPerMi * 1.07);
  const thresholdSecsPerMi = Math.round(raceGoalSecsPerMi * 1.015);
  const longRunSecsPerMi = Math.round(raceGoalSecsPerMi * 1.2);
  const predictedFinishTimeSecs = Math.round(raceGoalSecsPerMi * goalMiles);

  return {
    easySecsPerMi, tempoSecsPerMi, thresholdSecsPerMi,
    longRunSecsPerMi, raceGoalSecsPerMi, predictedFinishTimeSecs,
  };
}

function formatPace(secsPerMi) {
  const mins = Math.floor(secsPerMi / 60);
  const secs = Math.round(secsPerMi % 60);
  return mins + ":" + String(secs).padStart(2, "0") + " /mi";
}

function formatDuration(totalSecs) {
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  if (hours > 0) return hours + "h " + mins + "m";
  return mins + "m";
}
