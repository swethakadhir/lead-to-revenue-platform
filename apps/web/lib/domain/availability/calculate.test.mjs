import assert from "node:assert/strict";
import { calculateAvailability } from "./calculate.ts";

const hours = (weekly, duration = 30, interval = duration) => ({ weekly, slot_duration_minutes: duration, slot_interval_minutes: interval });
const monday = { enabled: true, start: "09:00", end: "11:00" };
const baseWindow = { startDate: "2026-10-05", endDate: "2026-10-06", now: "2026-10-04T00:00:00Z" };

let slots = calculateAvailability(hours({ mon: monday }), "UTC", [], baseWindow);
assert.deepEqual(slots.map((slot) => slot.localStart), ["2026-10-05T09:00", "2026-10-05T09:30", "2026-10-05T10:00", "2026-10-05T10:30"]);
assert.equal(slots.at(-1).localEnd, "2026-10-05T11:00");
assert.equal(slots[0].slotKey, `UTC:${slots[0].startsAt}`);

assert.equal(calculateAvailability(hours({ tue: monday }), "UTC", [], baseWindow).length, 0, "disabled/missing weekdays do not generate slots");
assert.equal(calculateAvailability(hours({ mon: { enabled: true, start: "09:00", end: "09:30" } }, 30), "UTC", [], baseWindow).length, 1, "duration equal to the opening window generates one slot");
assert.equal(calculateAvailability(hours({ mon: monday }, 121, 30), "UTC", [], baseWindow).length, 0, "duration longer than opening window generates none");
assert.deepEqual(calculateAvailability(hours({ mon: monday }, 30, 60), "UTC", [], baseWindow).map((slot) => slot.localStart), ["2026-10-05T09:00", "2026-10-05T10:00"]);

const appointment = (start, end, status = "scheduled") => ({ starts_at: `${start}Z`, ends_at: `${end}Z`, status });
assert.deepEqual(calculateAvailability(hours({ mon: monday }), "UTC", [appointment("2026-10-05T09:30:00", "2026-10-05T10:00:00")], baseWindow).map((slot) => slot.localStart), ["2026-10-05T09:00", "2026-10-05T10:00", "2026-10-05T10:30"]);
assert.equal(calculateAvailability(hours({ mon: monday }), "UTC", [appointment("2026-10-05T09:30:00", "2026-10-05T10:00:00", "confirmed")], baseWindow)[0].localStart, "2026-10-05T09:00");
for (const status of ["cancelled", "completed", "no_show"]) assert.equal(calculateAvailability(hours({ mon: monday }), "UTC", [appointment("2026-10-05T09:00:00", "2026-10-05T11:00:00", status)], baseWindow).length, 4, `${status} appointments do not block`);
assert.equal(calculateAvailability(hours({ mon: monday }), "UTC", [appointment("2026-10-05T09:15:00", "2026-10-05T09:45:00")], baseWindow).some((slot) => slot.localStart === "2026-10-05T09:00"), false, "partially overlapping appointments block");
assert.equal(calculateAvailability(hours({ mon: monday }), "UTC", [appointment("2026-10-05T08:45:00", "2026-10-05T11:00:00")], baseWindow).length, 0, "appointments spanning candidates block all overlaps");
assert.equal(calculateAvailability(hours({ mon: monday }), "UTC", [appointment("2026-10-05T09:30:00", "2026-10-05T10:00:00")], baseWindow).some((slot) => slot.localStart === "2026-10-05T10:00"), true, "back-to-back appointment boundary is allowed");

assert.deepEqual(calculateAvailability(hours({ mon: monday }), "UTC", [], { ...baseWindow, now: "2026-10-05T09:30:00Z" }).map((slot) => slot.localStart), ["2026-10-05T09:30", "2026-10-05T10:00", "2026-10-05T10:30"]);
assert.deepEqual(calculateAvailability(hours({ mon: monday }), "UTC", [], { ...baseWindow, maxResults: 2 }).map((slot) => slot.localStart), ["2026-10-05T09:00", "2026-10-05T09:30"]);
assert.equal(calculateAvailability(hours({ mon: monday }), "UTC", [], { startDate: "2026-10-06", endDate: "2026-10-07", now: "2026-10-01T00:00:00Z" }).length, 0, "end/start date window is bounded");
assert.equal(calculateAvailability(hours({ mon: monday }), "UTC", [], { startDate: "2026-10-04", endDate: "2026-10-05", now: "2026-10-01T00:00:00Z" }).length, 0, "exclusive end date is respected");

const KolkataSlots = calculateAvailability(hours({ mon: { enabled: true, start: "09:00", end: "10:00" } }), "Asia/Kolkata", [], baseWindow);
assert.equal(KolkataSlots[0].startsAt, "2026-10-05T03:30:00.000Z", "tenant-local time converts to an unambiguous instant");

const dstSlots = calculateAvailability(hours({ sun: { enabled: true, start: "01:00", end: "04:00" } }), "America/New_York", [], { startDate: "2026-03-08", endDate: "2026-03-09", now: "2026-03-01T00:00:00Z" });
assert.deepEqual(dstSlots.map((slot) => slot.localStart), ["2026-03-08T01:00", "2026-03-08T03:00", "2026-03-08T03:30"], "nonexistent spring-forward wall times are skipped");
assert.ok(dstSlots.every((slot) => slot.startsAt.endsWith("Z") && slot.endsAt.endsWith("Z")));

assert.throws(() => calculateAvailability(hours({ mon: monday }), "UTC", [], { startDate: "2026-10-05", endDate: "2027-11-01", now: "2026-10-01T00:00:00Z" }), /Search window/);
console.log("PASS availability calculation tests");
