// Dynamic, time-aware Home greeting. Runs entirely client-side, so
// `new Date()` already reflects the visitor's own device/browser timezone —
// there is no server time involved here to accidentally use instead.

export type GreetingPeriod = "morning" | "afternoon" | "evening" | "night";

function periodForHour(hour: number): GreetingPeriod {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

type DayTone = "monday" | "friday" | "weekend" | "normal";

function toneForDay(day: number): DayTone {
  if (day === 1) return "monday"; // Monday
  if (day === 5) return "friday"; // Friday
  if (day === 0 || day === 6) return "weekend"; // Sunday / Saturday
  return "normal";
}

const BASE_VARIATIONS: Record<GreetingPeriod, string[]> = {
  morning: ["Good morning, {name}", "Morning, {name}"],
  afternoon: ["Good afternoon, {name}", "Hope your afternoon's going well, {name}"],
  evening: ["Good evening, {name}", "Nice to see you this evening, {name}"],
  night: ["Good night, {name}", "Good to see you tonight, {name}"],
};

// Extra, day-flavored lines mixed into the pool on top of the base ones —
// kept short and professional, no gimmicks; falls back to the base pool on
// any day/period combination not called out here.
const DAY_TONE_EXTRAS: Partial<Record<DayTone, Partial<Record<GreetingPeriod, string>>>> = {
  monday: {
    morning: "Fresh start to the week, {name}",
    afternoon: "Hope your week's off to a good start, {name}",
  },
  friday: {
    morning: "Happy Friday, {name}",
    afternoon: "Happy Friday, {name}",
    evening: "Enjoy your Friday evening, {name}",
  },
  weekend: {
    morning: "Enjoy your weekend, {name}",
    afternoon: "Hope you're enjoying the weekend, {name}",
  },
};

/** Small, dependency-free string hash — only used to pick a stable index
 * into the greeting pool, not for anything security-sensitive. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Builds a natural, time-aware greeting for `name`, e.g. "Good morning, Asha"
 * or "Happy Friday, Asha". The specific variation is chosen deterministically
 * from the current local date + time period, so it stays the same across
 * re-renders within the same day instead of flickering between options.
 * Falls back to a plain "Hi, {name}" (or "Hi there" with no name) if
 * anything about the name or the current time can't be resolved. */
export function getHomeGreeting(name: string | null | undefined, now: Date = new Date()): string {
  const trimmedName = name?.trim();
  if (!trimmedName) return "Hi there";

  try {
    const hour = now.getHours();
    const day = now.getDay();
    if (Number.isNaN(hour) || Number.isNaN(day)) return `Hi, ${trimmedName}`;

    const period = periodForHour(hour);
    const tone = toneForDay(day);
    const extra = DAY_TONE_EXTRAS[tone]?.[period];
    const pool = extra ? [...BASE_VARIATIONS[period], extra] : BASE_VARIATIONS[period];

    // Seeded by the local calendar day + period (not the exact time), so the
    // choice is stable all day/session instead of changing on every render.
    const seed = `${now.toDateString()}:${period}`;
    const template = pool[hashString(seed) % pool.length];
    return template.replace("{name}", trimmedName);
  } catch {
    return `Hi, ${trimmedName}`;
  }
}
