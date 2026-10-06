import assert from "node:assert/strict";
import {
  bookingHoursFromForm,
  mergeBookingHours,
  parseBookingHours,
} from "./booking-hours.ts";

const days = { mon: { enabled: true, start: "09:00", end: "17:00" } };
const valid = parseBookingHours({ weekly: days, slot_duration_minutes: 30, slot_interval_minutes: 15 });
assert.equal(valid.error, null);
assert.equal(valid.value.weekly.mon.end, "17:00");

assert.equal(parseBookingHours({ weekly: {} }).error, null, "missing days are valid");
assert.equal(parseBookingHours({ weekly: { monday: days.mon } }).value, null, "weekday keys are validated");
assert.match(parseBookingHours({ weekly: { mon: { enabled: true, start: "9am", end: "17:00" } } }).error, /HH:MM/);
assert.match(parseBookingHours({ weekly: { mon: { enabled: true, start: "17:00", end: "09:00" } } }).error, /after/);
assert.match(parseBookingHours({ slot_duration_minutes: 0 }).error, /slot_duration_minutes/);
assert.match(parseBookingHours({ slot_interval_minutes: 999 }).error, /slot_interval_minutes/);

const fromForm = bookingHoursFromForm({ duration: 45, interval: 15, days: { ...days, tue: { enabled: false, start: "09:00", end: "17:00" } } });
assert.equal(fromForm.weekly.tue.enabled, false);
const merged = mergeBookingHours({ custom_policy: { keep: true }, slot_duration_minutes: 60 }, fromForm);
assert.deepEqual(merged.custom_policy, { keep: true }, "unrelated business-hours properties survive");
assert.equal(merged.slot_duration_minutes, 45);

console.log("PASS booking-hours validation tests");
