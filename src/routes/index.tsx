import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { useState } from "react";
import {
  generatePlan,
  type RaceDistance,
  type RunnerProfile,
  type Segment,
  type TrainingPlan,
  type WorkoutType,
} from "~/lib/planGenerator";

const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "Stride";
  } catch {
    return "Stride";
  }
});

export const Route = createFileRoute("/")({
  loader: () => getBusinessName(),
  component: Home,
});

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "first-timer", label: "First Timer" },
  { value: "returner", label: "Returner" },
  { value: "competitive", label: "Competitive" },
  { value: "trail", label: "Trail Runner" },
];

const RACES: { value: RaceDistance; label: string }[] = [
  { value: "5K", label: "5K" },
  { value: "10K", label: "10K" },
  { value: "Half Marathon", label: "Half Marathon" },
  { value: "Marathon", label: "Marathon" },
  { value: "Ultra", label: "Ultra" },
];

const WORKOUT_COLORS: Record<WorkoutType, { bg: string; text: string; dot: string }> = {
  easy: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  tempo: { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", dot: "bg-orange-500" },
  long: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
  rest: { bg: "bg-gray-50 border-gray-200", text: "text-gray-500", dot: "bg-gray-400" },
  "cross-training": { bg: "bg-purple-50 border-purple-200", text: "text-purple-700", dot: "bg-purple-500" },
};

const WORKOUT_LABELS: Record<WorkoutType, string> = {
  easy: "Easy Run",
  tempo: "Tempo Run",
  long: "Long Run",
  rest: "Rest Day",
  "cross-training": "Cross-Training",
};

function Home() {
  const businessName = Route.useLoaderData();

  const [segment, setSegment] = useState<Segment>("first-timer");
  const [weeklyMileage, setWeeklyMileage] = useState<number>(15);
  const [goalRace, setGoalRace] = useState<RaceDistance>("5K");
  const [goalRaceDate, setGoalRaceDate] = useState<string>("");
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!weeklyMileage || weeklyMileage < 1) errs.mileage = "Enter your weekly mileage";
    if (weeklyMileage > 120) errs.mileage = "Mileage seems too high";
    if (!goalRaceDate) errs.date = "Select your goal race date";
    else {
      const d = new Date(goalRaceDate + "T00:00:00");
      if (d <= new Date()) errs.date = "Race date must be in the future";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const profile: RunnerProfile = {
      segment,
      weeklyMileage,
      goalRace,
      goalRaceDate,
    };
    setPlan(generatePlan(profile));
  }

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <h1 className="text-xl font-bold tracking-tight text-[#1B2838] sm:text-2xl">
            <span className="text-[#FF6B4A]">{businessName}</span>
          </h1>
          <span className="rounded-full bg-[#FF6B4A]/10 px-3 py-1 text-xs font-semibold text-[#FF6B4A]">
            Beta
          </span>
        </div>
      </header>

      {/* Hero / Form section */}
      <section className="px-4 py-10 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#1B2838] sm:text-4xl">
              Your Personal Training Plan
            </h2>
            <p className="mt-3 text-lg text-slate-500">
              Tell us about yourself and your goal race. We'll build a 4-week plan tailored to you.
            </p>
          </div>

          {/* Form Card */}
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Segment */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="segment"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Runner Segment
                </label>
                <select
                  id="segment"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value as Segment)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20"
                >
                  {SEGMENTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Weekly Mileage */}
              <div>
                <label
                  htmlFor="mileage"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Weekly Mileage
                </label>
                <div className="relative">
                  <input
                    id="mileage"
                    type="number"
                    min={1}
                    max={120}
                    value={weeklyMileage}
                    onChange={(e) => {
                      setWeeklyMileage(Number(e.target.value));
                      if (errors.mileage) setErrors({});
                    }}
                    className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-2 ${
                      errors.mileage
                        ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                        : "border-slate-300 focus:border-[#FF6B4A] focus:ring-[#FF6B4A]/20"
                    }`}
                    placeholder="e.g. 20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    mi/wk
                  </span>
                </div>
                {errors.mileage && (
                  <p className="mt-1 text-xs text-red-500">{errors.mileage}</p>
                )}
              </div>

              {/* Goal Race */}
              <div>
                <label
                  htmlFor="race"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Goal Race Distance
                </label>
                <select
                  id="race"
                  value={goalRace}
                  onChange={(e) => setGoalRace(e.target.value as RaceDistance)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20"
                >
                  {RACES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Goal Race Date */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="raceDate"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Goal Race Date
                </label>
                <input
                  id="raceDate"
                  type="date"
                  value={goalRaceDate}
                  onChange={(e) => {
                    setGoalRaceDate(e.target.value);
                    if (errors.date) setErrors({});
                  }}
                  className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-2 ${
                    errors.date
                      ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                      : "border-slate-300 focus:border-[#FF6B4A] focus:ring-[#FF6B4A]/20"
                  }`}
                />
                {errors.date && (
                  <p className="mt-1 text-xs text-red-500">{errors.date}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="mt-8 w-full rounded-xl bg-[#FF6B4A] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#E85D3E] hover:shadow-md active:scale-[0.98] sm:text-base"
            >
              Generate My Plan
            </button>
          </form>
        </div>
      </section>

      {/* Plan Display */}
      {plan && (
        <section className="px-4 pb-20">
          <div className="mx-auto max-w-6xl">
            {/* Summary Header */}
            <div className="mb-8 rounded-2xl bg-[#1B2838] p-6 text-white sm:p-8">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm sm:text-base">
                <div>
                  <span className="text-slate-400">Segment</span>
                  <p className="font-bold">{plan.segment}</p>
                </div>
                <div>
                  <span className="text-slate-400">Weekly Mileage</span>
                  <p className="font-bold">{plan.weeklyMileage} mi</p>
                </div>
                <div>
                  <span className="text-slate-400">Goal Race</span>
                  <p className="font-bold">{plan.goalRace}</p>
                </div>
                <div>
                  <span className="text-slate-400">Race Date</span>
                  <p className="font-bold">
                    {new Date(plan.goalRaceDate + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { month: "long", day: "numeric", year: "numeric" },
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Week Columns */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {plan.weeks.map((week) => (
                <div
                  key={week.phase}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="rounded-t-2xl bg-[#FF6B4A] px-5 py-3 text-white">
                    <h3 className="text-sm font-bold uppercase tracking-wide">
                      {week.phase}
                    </h3>
                    <p className="text-xs text-white/80">{week.label}</p>
                  </div>
                  <div className="divide-y divide-slate-100 p-3">
                    {week.days.map((day) => {
                      const colors = WORKOUT_COLORS[day.type];
                      return (
                        <div
                          key={day.day}
                          className={`rounded-xl border px-4 py-3 ${colors.bg}`}
                          style={{ marginBottom: week.days.indexOf(day) < 6 ? "0.5rem" : 0 }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${colors.dot}`}
                            />
                            <span className="text-xs font-semibold text-slate-500">
                              {day.day.slice(0, 3)}
                            </span>
                            <span
                              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colors.text} bg-white/60`}
                            >
                              {WORKOUT_LABELS[day.type]}
                            </span>
                          </div>
                          {day.distance !== null && (
                            <p className="mt-1.5 text-lg font-bold text-slate-800">
                              {day.distance.toFixed(1)} <span className="text-sm font-normal text-slate-500">mi</span>
                            </p>
                          )}
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            {day.notes}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
              {(Object.keys(WORKOUT_COLORS) as WorkoutType[]).map((type) => (
                <div key={type} className="flex items-center gap-1.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${WORKOUT_COLORS[type].dot}`}
                  />
                  {WORKOUT_LABELS[type]}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-400">
        {businessName} &mdash; Personalized training plans for every runner.
      </footer>
    </div>
  );
}
