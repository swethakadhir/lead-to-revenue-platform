import { parseBookingHours, type BookingHours, type BookingWeekday } from "../configuration/booking-hours";
import { zonedLocalToIso } from "../operations/time";

export type AvailabilityAppointment = {
  starts_at: string;
  ends_at: string;
  status: string;
};

export type AvailabilityWindow = {
  startDate: string;
  /** Exclusive local date boundary in the tenant timezone. */
  endDate: string;
  maxResults?: number;
  now?: string | Date;
};

export type AvailableSlot = {
  slotKey: string;
  timezone: string;
  localStart: string;
  localEnd: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
};

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const blockingStatuses = new Set(["scheduled", "confirmed"]);
const weekdayKeys: BookingWeekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DEFAULT_MAX_RESULTS = 50;
const MAX_SEARCH_DAYS = 366;

function parseDate(value: string, label: string) {
  const match = datePattern.exec(value);
  if (!match) throw new Error(`${label} must use YYYY-MM-DD format.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`${label} is not a valid calendar date.`);
  return date;
}

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function localDateTime(date: string, minutes: number) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCMinutes(minutes);
  return { date: dateString(day), time: day.toISOString().slice(11, 16) };
}

function minutesSinceMidnight(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function appointmentBounds(appointments: AvailabilityAppointment[]) {
  return appointments.filter((appointment) => blockingStatuses.has(appointment.status)).map((appointment) => {
    const start = Date.parse(appointment.starts_at);
    const end = Date.parse(appointment.ends_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Appointment boundaries are invalid.");
    return { start, end };
  });
}

function resolveNow(value: string | Date | undefined) {
  const now = value === undefined ? new Date() : value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(now.getTime())) throw new Error("now must be a valid instant.");
  return now.getTime();
}

export function calculateAvailability(bookingHours: BookingHours, timezone: string, appointments: AvailabilityAppointment[], window: AvailabilityWindow): AvailableSlot[] {
  const parsed = parseBookingHours(bookingHours);
  if (parsed.error || !parsed.value) throw new Error(parsed.error ?? "Booking hours are invalid.");
  const startDate = parseDate(window.startDate, "startDate");
  const endDate = parseDate(window.endDate, "endDate");
  const dayCount = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
  if (dayCount <= 0 || dayCount > MAX_SEARCH_DAYS) throw new Error(`Search window must be 1–${MAX_SEARCH_DAYS} days.`);
  const maxResults = window.maxResults ?? DEFAULT_MAX_RESULTS;
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 100) throw new Error("maxResults must be a whole number from 1 to 100.");
  const blocking = appointmentBounds(appointments);
  const now = resolveNow(window.now);
  const slots: AvailableSlot[] = [];

  for (let offset = 0; offset < dayCount && slots.length < maxResults; offset += 1) {
    const date = addDays(startDate, offset);
    const dateValue = dateString(date);
    const day = parsed.value.weekly[weekdayKeys[date.getUTCDay()]];
    if (!day?.enabled) continue;
    const opening = minutesSinceMidnight(day.start);
    const closing = minutesSinceMidnight(day.end);
    for (let startMinutes = opening; startMinutes + parsed.value.slot_duration_minutes <= closing && slots.length < maxResults; startMinutes += parsed.value.slot_interval_minutes) {
      const localStartParts = localDateTime(dateValue, startMinutes);
      const localEndParts = localDateTime(dateValue, startMinutes + parsed.value.slot_duration_minutes);
      const localStart = `${localStartParts.date}T${localStartParts.time}`;
      const localEnd = `${localEndParts.date}T${localEndParts.time}`;
      let startsAt: string;
      let endsAt: string;
      try {
        startsAt = zonedLocalToIso(localStart, timezone);
        endsAt = zonedLocalToIso(localEnd, timezone);
      } catch {
        // A local wall-clock time skipped by a DST transition is not bookable.
        continue;
      }
      const start = Date.parse(startsAt);
      const end = Date.parse(endsAt);
      if (start < now || blocking.some((appointment) => start < appointment.end && end > appointment.start)) continue;
      slots.push({ slotKey: `${timezone}:${startsAt}`, timezone, localStart, localEnd, startsAt, endsAt, durationMinutes: parsed.value.slot_duration_minutes });
    }
  }
  return slots;
}
