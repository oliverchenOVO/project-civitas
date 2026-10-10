import type { ObservationHistory, Sample } from './history';
// A recorded sample timeline, never a reconstructed historical CityState.
export function chronicleFrames(history: ObservationHistory): Sample[] {
  const frames = new Map<number, Sample>();
  frames.set(history.initial.day, history.initial);
  for (const period of history.yearly)
    if (period.endDay >= history.historyAvailableFromDay)
      frames.set(period.endDay, { day: period.endDay, values: period.closing });
  const latest = history.daily.at(-1);
  if (latest) frames.set(latest.day, latest);
  return [...frames.values()]
    .filter((f) => f.day >= history.historyAvailableFromDay)
    .sort((a, b) => a.day - b.day);
}
