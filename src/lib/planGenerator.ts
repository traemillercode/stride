export type Segment = "first-timer" | "returner" | "competitive" | "trail";
export type RaceDistance = "5K" | "10K" | "Half Marathon" | "Marathon" | "Ultra";
export type WorkoutType = "easy" | "tempo" | "long" | "rest" | "cross-training";

export interface RunnerProfile {
  segment: Segment;
  weeklyMileage: number;
  goalRace: RaceDistance;
  goalRaceDate: string;
}

export interface Workout {
  day: string;
  type: WorkoutType;
  distance: number | null;
  notes: string;
}

export interface Week {
  phase: string;
  label: string;
  days: Workout[];
}

export interface TrainingPlan {
  segment: string;
  weeklyMileage: number;
  goalRace: string;
  goalRaceDate: string;
  weeks: Week[];
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SEGMENT_LABELS: Record<Segment, string> = {
  "first-timer": "First Timer",
  returner: "Returner",
  competitive: "Competitive",
  trail: "Trail Runner",
};

const RACE_DISTANCE_MILES: Record<RaceDistance, number> = {
  "5K": 3.1,
  "10K": 6.2,
  "Half Marathon": 13.1,
  Marathon: 26.2,
  Ultra: 31.0,
};

// Multiplier for each phase relative to base weekly mileage
const PHASE_MULTIPLIERS: Record<string, number> = {
  Base: 0.85,
  Build: 1.0,
  Peak: 1.15,
  Taper: 0.55,
};

// Segment-specific rest day counts per week
const SEGMENT_REST_DAYS: Record<Segment, number[]> = {
  "first-timer": [3, 3, 2, 3],
  returner: [2, 2, 2, 2],
  competitive: [1, 1, 1, 2],
  trail: [1, 2, 1, 2],
};

const PHASES = [
  { phase: "Base", label: "Week 1 — Base" },
  { phase: "Build", label: "Week 2 — Build" },
  { phase: "Peak", label: "Week 3 — Peak" },
  { phase: "Taper", label: "Week 4 — Taper" },
];

function formatMiles(d: number): string {
  if (d < 1) return `${(d * 10).toFixed(1)} mi`;
  return `${d.toFixed(1)} mi`;
}

function roundNice(n: number): number {
  return Math.round(n * 10) / 10;
}

export function generatePlan(profile: RunnerProfile): TrainingPlan {
  const { segment, weeklyMileage, goalRace, goalRaceDate } = profile;
  const goalRaceMiles = RACE_DISTANCE_MILES[goalRace];
  const restCounts = SEGMENT_REST_DAYS[segment];

  const weeks: Week[] = PHASES.map(({ phase, label }, phaseIdx) => {
    const weekMileage = roundNice(weeklyMileage * PHASE_MULTIPLIERS[phase]);
    const restDays = restCounts[phaseIdx];
    const runningDays = 7 - restDays;

    // Long run proportion: peaks at 35% for peak week, lower for others
    const longRunRatios = [0.28, 0.30, 0.32, 0.25];
    const longRunRatio = longRunRatios[phaseIdx];

    // Distribute mileage across running days
    const longRunDist = roundNice(weekMileage * longRunRatio);
    const remainingMileage = roundNice(weekMileage - longRunDist);
    const otherRunningDays = runningDays - 1; // minus long run day
    const avgOtherDist = otherRunningDays > 0 ? roundNice(remainingMileage / otherRunningDays) : 0;

    const days: Workout[] = DAYS.map((day, dayIdx) => {
      const isSaturday = dayIdx === 5;
      const isSunday = dayIdx === 6;
      const isTuesday = dayIdx === 1;
      const isThursday = dayIdx === 3;
      const isFriday = dayIdx === 4;

      // Sunday is always rest
      if (isSunday) {
        return {
          day,
          type: "rest" as WorkoutType,
          distance: null,
          notes: "Recovery day. Light stretching or foam rolling recommended.",
        };
      }

      // Saturday is always long run
      if (isSaturday) {
        return {
          day,
          type: "long" as WorkoutType,
          distance: longRunDist,
          notes: segment === "trail"
            ? `Long run on trails. Target ~${formatMiles(longRunDist)} at conversational pace. Focus on time on feet and varied terrain.`
            : segment === "competitive"
              ? `Long run. Target ~${formatMiles(longRunDist)}. Aim for negative splits — finish stronger than you started.`
              : segment === "first-timer"
                ? `Your longest run of the week. Target ~${formatMiles(longRunDist)}. Run/walk as needed — focus on completing the distance, not pace.`
                : `Long run. Target ~${formatMiles(longRunDist)} at a comfortable, conversational pace.`,
        };
      }

      // Determine rest days (beyond Sunday) based on segment
      const restSlots = assignRestSlots(dayIdx, restDays - 1, segment); // -1 because Sunday is always rest

      if (restSlots) {
        return {
          day,
          type: "rest" as WorkoutType,
          distance: null,
          notes: segment === "competitive"
            ? "Recovery day. Prioritize sleep, hydration, and nutrition."
            : "Rest day. Let your body absorb the training.",
        };
      }

      // Tuesday: tempo for non-first-timers
      if (isTuesday && segment !== "first-timer") {
        const tempoDist = segment === "competitive" ? avgOtherDist * 1.1 : avgOtherDist;
        return {
          day,
          type: "tempo" as WorkoutType,
          distance: roundNice(tempoDist),
          notes: segment === "competitive"
            ? `Tempo run. Target ~${formatMiles(roundNice(tempoDist))}. Run at threshold pace (~85% effort). Include 1 mi warm-up and cool-down.`
            : segment === "trail"
              ? `Tempo effort on rolling terrain. Target ~${formatMiles(roundNice(tempoDist))}. Sustain a "comfortably hard" effort.`
              : `Tempo run. Target ~${formatMiles(roundNice(tempoDist))}. Run at a "comfortably hard" pace — you could say a few words but not hold a conversation.`,
        };
      }

      // Thursday: cross-training for trail, tempo for competitive, easy for others
      if (isThursday) {
        if (segment === "trail") {
          return {
            day,
            type: "cross-training" as WorkoutType,
            distance: null,
            notes: "Strength training. Focus on single-leg exercises, core stability, and hip mobility. Bodyweight or weights — your choice.",
          };
        }
        if (segment === "competitive") {
          return {
            day,
            type: "tempo" as WorkoutType,
            distance: roundNice(avgOtherDist * 1.05),
            notes: `Speed work. Target ~${formatMiles(roundNice(avgOtherDist * 1.05))}. Include intervals: 4×800m at 5K pace with 400m recovery jogs, plus warm-up and cool-down.`,
          };
        }
        return {
          day,
          type: "easy" as WorkoutType,
          distance: avgOtherDist,
          notes: `Easy run. Target ~${formatMiles(avgOtherDist)}. Keep it relaxed and conversational.`,
        };
      }

      // Wednesday: cross-training for first-timer/trail, easy for others
      if (dayIdx === 2) {
        if (segment === "first-timer" || segment === "trail") {
          return {
            day,
            type: "cross-training" as WorkoutType,
            distance: null,
            notes: segment === "first-timer"
              ? "Cross-training. Try cycling, swimming, or brisk walking for 30–40 min. Builds fitness without impact."
              : "Cross-training. Cycling or swimming for 45–60 min at moderate effort. Builds aerobic base while giving joints a break.",
          };
        }
        return {
          day,
          type: "easy" as WorkoutType,
          distance: avgOtherDist,
          notes: `Easy run. Target ~${formatMiles(avgOtherDist)}. Recovery pace — no faster than a conversation.`,
        };
      }

      // Friday: rest for first-timer/returner, easy for competitive/trail
      if (isFriday) {
        if (segment === "competitive" || segment === "trail") {
          return {
            day,
            type: "easy" as WorkoutType,
            distance: roundNice(avgOtherDist * 0.8),
            notes: `Easy shakeout run. Target ~${formatMiles(roundNice(avgOtherDist * 0.8))}. Keep it very light — this is about recovery and preparation for tomorrow's long run.`,
          };
        }
        return {
          day,
          type: "rest" as WorkoutType,
          distance: null,
          notes: "Rest day. Good day for mobility work or a gentle walk.",
        };
      }

      // Monday: always easy
      return {
        day,
        type: "easy" as WorkoutType,
        distance: avgOtherDist,
        notes: `Easy run. Target ~${formatMiles(avgOtherDist)}. Start the week at a relaxed, conversational pace.`,
      };
    });

    return { phase, label, days };
  });

  return {
    segment: SEGMENT_LABELS[segment],
    weeklyMileage,
    goalRace,
    goalRaceDate,
    weeks,
  };
}

function assignRestSlots(
  dayIdx: number,
  numRest: number,
  segment: Segment,
): boolean {
  // Sunday (6) is already rest. We need to distribute `numRest` among Mon-Fri (0-5).
  // Different segments rest on different days.

  const patterns: Record<Segment, number[]> = {
    "first-timer": [4, 2], // Friday, Wednesday — but only if numRest >= those indices
    returner: [4, 0], // Friday, Monday
    competitive: [4], // Friday only (when numRest=1)
    trail: [4], // Friday
  };

  const restDaysForSegment = patterns[segment];
  const assigned = restDaysForSegment.slice(0, numRest);
  return assigned.includes(dayIdx);
}
