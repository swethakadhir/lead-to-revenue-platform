const dateTimeFormatter = (timeZone: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partsFor(date: Date, timeZone: string) {
  const parts = Object.fromEntries(dateTimeFormatter(timeZone).formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second),
  };
}

export function isTimeZone(value: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; }
}

export function zonedLocalToIso(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match || !isTimeZone(timeZone)) throw new Error("Invalid local date, time, or timezone.");
  const expected = match.slice(1).map(Number);
  const expectedEpoch = Date.UTC(expected[0], expected[1] - 1, expected[2], expected[3], expected[4]);
  let guess = expectedEpoch;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const current = partsFor(new Date(guess), timeZone);
    const represented = Date.UTC(current.year, current.month - 1, current.day, current.hour, current.minute);
    guess -= represented - expectedEpoch;
  }
  const roundTrip = partsFor(new Date(guess), timeZone);
  if ([roundTrip.year, roundTrip.month, roundTrip.day, roundTrip.hour, roundTrip.minute].some((part, index) => part !== expected[index])) {
    throw new Error("That local time does not exist in the selected timezone.");
  }
  return new Date(guess).toISOString();
}

export function toLocalInput(value: string, timeZone: string) {
  const parts = partsFor(new Date(value), timeZone);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function zonedDayBounds(timeZone: string, now = new Date()) {
  const local = partsFor(now, timeZone);
  const pad = (part: number) => String(part).padStart(2, "0");
  const startLocal = `${local.year}-${pad(local.month)}-${pad(local.day)}T00:00`;
  const next = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  const nextLocal = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}T00:00`;
  return { start: zonedLocalToIso(startLocal, timeZone), end: zonedLocalToIso(nextLocal, timeZone) };
}

export function formatInTimeZone(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
