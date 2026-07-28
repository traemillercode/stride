/* Stride — Pacing Calculator
   Handles paces from elite (2:05 marathon) to walk/run (15:00/mi).
   Uses Riegel formula for race time predictions. */

var DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatPace(secsPerMi) {
  if (!secsPerMi || secsPerMi <= 0 || isNaN(secsPerMi)) return "--:--";
  var mins = Math.floor(secsPerMi / 60);
  var secs = Math.floor(secsPerMi % 60);
  return mins + ":" + (secs < 10 ? "0" : "") + secs;
}

function formatDuration(totalSecs) {
  if (!totalSecs || totalSecs <= 0 || isNaN(totalSecs)) return "--";
  var h = Math.floor(totalSecs / 3600);
  var m = Math.floor((totalSecs % 3600) / 60);
  var s = Math.floor(totalSecs % 60);
  if (h > 0) {
    return h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  return m + ":" + (s < 10 ? "0" : "") + s;
}

/* Riegel formula: T2 = T1 * (D2/D1)^1.06 */
function predictRaceTime(knownTimeSecs, knownDistKm, targetDistKm) {
  if (!knownTimeSecs || knownTimeSecs <= 0) return null;
  if (!knownDistKm || knownDistKm <= 0) return null;
  if (!targetDistKm || targetDistKm <= 0) return null;
  return knownTimeSecs * Math.pow(targetDistKm / knownDistKm, 1.06);
}

var DISTANCE_KM = {
  "5K": 5,
  "10K": 10,
  "Half Marathon": 21.0975,
  "Marathon": 42.195,
  "Ultra": 50,
};

/* Given a recent race time at a known distance, compute training paces.
   Handles elite (~4:45/mi) through walk/run (~15:00/mi).
   Returns null for each pace if no race time is provided. */
function computePaces(recentRaceTimeSecs, recentRaceDistLabel, goalDistLabel) {
  var recentDistKm = DISTANCE_KM[recentRaceDistLabel];
  var goalDistKm = DISTANCE_KM[goalDistLabel];

  if (!recentRaceTimeSecs || !recentDistKm || !goalDistKm) {
    // No race time — use default easy pace based on goal distance
    var defaultPaces = {
      easySecsPerMi: 660,       // 11:00/mi
      tempoSecsPerMi: 540,      // 9:00/mi
      thresholdSecsPerMi: 510,  // 8:30/mi
      longRunSecsPerMi: 630,    // 10:30/mi
      raceGoalSecsPerMi: 570,   // 9:30/mi
      predictedFinishTimeSecs: goalDistKm ? goalDistKm * 60 * 9.5 : 1800,
    };
    return defaultPaces;
  }

  // Predict goal race time using Riegel
  var predictedGoalSecs = predictRaceTime(recentRaceTimeSecs, recentDistKm, goalDistKm);
  // Guard: ensure prediction is reasonable (not negative, not zero)
  if (!predictedGoalSecs || predictedGoalSecs <= 0) {
    predictedGoalSecs = goalDistKm * 60 * 9.5;
  }

  // Race goal pace in secs/mi
  var goalDistMi = goalDistKm / 1.60934;
  var raceGoalSecsPerMi = predictedGoalSecs / goalDistMi;

  // Clamp to reasonable range: 3:30/mi (210s) to 15:00/mi (900s)
  raceGoalSecsPerMi = Math.max(210, Math.min(900, raceGoalSecsPerMi));

  // Training paces derived from race goal pace (Daniels-style multipliers)
  var easySecsPerMi = raceGoalSecsPerMi * 1.35;      // Easy: ~35% slower
  var tempoSecsPerMi = raceGoalSecsPerMi * 1.0;        // Tempo: at race pace for goal
  var thresholdSecsPerMi = raceGoalSecsPerMi * 0.92;   // Threshold: ~8% faster than race goal
  var longRunSecsPerMi = raceGoalSecsPerMi * 1.15;     // Long run: ~15% slower

  // Clamp all paces
  function clampPace(v) { return Math.max(210, Math.min(900, Math.round(v))); }

  return {
    easySecsPerMi: clampPace(easySecsPerMi),
    tempoSecsPerMi: clampPace(tempoSecsPerMi),
    thresholdSecsPerMi: clampPace(thresholdSecsPerMi),
    longRunSecsPerMi: clampPace(longRunSecsPerMi),
    raceGoalSecsPerMi: Math.round(raceGoalSecsPerMi),
    predictedFinishTimeSecs: Math.round(predictedGoalSecs),
  };
}
