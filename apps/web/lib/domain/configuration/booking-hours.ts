export const bookingWeekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type BookingWeekday = (typeof bookingWeekdays)[number];

export type BookingDay = { enabled: boolean; start: string; end: string };
export type BookingHours = {
  weekly: Partial<Record<BookingWeekday, BookingDay>>;
  slot_duration_minutes: number;
  slot_interval_minutes: number;
};

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type JsonObject = { [key: string]: Json | undefined };
export const defaultBookingHours: BookingHours = {
  weekly: {},
  slot_duration_minutes: 30,
  slot_interval_minutes: 30,
};

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MIN_SLOT_MINUTES = 5;
const MAX_SLOT_MINUTES = 480;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertMinutes(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < MIN_SLOT_MINUTES || value > MAX_SLOT_MINUTES) {
    throw new Error(`${label} must be a whole number from ${MIN_SLOT_MINUTES} to ${MAX_SLOT_MINUTES}.`);
  }
  return value as number;
}

function assertTime(value: unknown, label: string): string {
  if (typeof value !== "string" || !timePattern.test(value)) throw new Error(`${label} must use HH:MM format.`);
  return value;
}

function parseDay(value: unknown, weekday: BookingWeekday): BookingDay {
  if (!isObject(value)) throw new Error(`${weekday} must be an object.`);
  const enabled = value.enabled === undefined ? true : value.enabled;
  if (typeof enabled !== "boolean") throw new Error(`${weekday}.enabled must be a boolean.`);
  const start = assertTime(value.start ?? "09:00", `${weekday}.start`);
  const end = assertTime(value.end ?? "17:00", `${weekday}.end`);
  if (enabled && toMinutes(end) <= toMinutes(start)) throw new Error(`${weekday}.end must be after ${weekday}.start.`);
  return { enabled, start, end };
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function parseBookingHours(value: unknown): { value: BookingHours; error: null } | { value: null; error: string } {
  if (value === undefined || value === null || (isObject(value) && Object.keys(value).length === 0)) return { value: { ...defaultBookingHours, weekly: {} }, error: null };
  if (!isObject(value)) return { value: null, error: "Business hours must be an object." };
  try {
    const weeklyValue = value.weekly;
    const weekly: Partial<Record<BookingWeekday, BookingDay>> = {};
    if (weeklyValue !== undefined) {
      if (!isObject(weeklyValue)) throw new Error("weekly must be an object.");
      for (const key of Object.keys(weeklyValue)) {
        if (!(bookingWeekdays as readonly string[]).includes(key)) throw new Error(`${key} is not a valid weekday.`);
        weekly[key as BookingWeekday] = parseDay(weeklyValue[key], key as BookingWeekday);
      }
    }
    const duration = assertMinutes(value.slot_duration_minutes ?? defaultBookingHours.slot_duration_minutes, "slot_duration_minutes");
    const interval = assertMinutes(value.slot_interval_minutes ?? defaultBookingHours.slot_interval_minutes, "slot_interval_minutes");
    return { value: { weekly, slot_duration_minutes: duration, slot_interval_minutes: interval }, error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : "Business hours are invalid." };
  }
}

export function mergeBookingHours(existing: unknown, next: BookingHours): JsonObject {
  const base = isObject(existing) ? { ...existing } as JsonObject : {};
  return { ...base, weekly: next.weekly, slot_duration_minutes: next.slot_duration_minutes, slot_interval_minutes: next.slot_interval_minutes };
}

export function bookingHoursFromForm(input: { duration: unknown; interval: unknown; days: Record<BookingWeekday, { enabled: boolean; start: unknown; end: unknown }> }): BookingHours {
  const weekly: Partial<Record<BookingWeekday, BookingDay>> = {};
  for (const weekday of bookingWeekdays) {
    const day = input.days[weekday];
    if (!day) continue;
    weekly[weekday] = parseDay({ enabled: day.enabled, start: day.start, end: day.end }, weekday);
  }
  return { weekly, slot_duration_minutes: assertMinutes(input.duration, "slot_duration_minutes"), slot_interval_minutes: assertMinutes(input.interval, "slot_interval_minutes") };
}
