import assert from "node:assert/strict";
import { partitionAppointments } from "./partition.ts";

const now = new Date("2026-09-18T10:00:00Z");
const records = [
  { id: "past", status: "scheduled", starts_at: "2026-09-18T09:00:00Z" },
  { id: "upcoming", status: "scheduled", starts_at: "2026-09-18T11:00:00Z" },
  { id: "confirmed", status: "confirmed", starts_at: "2026-09-18T12:00:00Z" },
  { id: "cancelled", status: "cancelled", starts_at: "2026-09-18T13:00:00Z" },
  { id: "completed", status: "completed", starts_at: "2026-09-18T14:00:00Z" },
  { id: "no-show", status: "no_show", starts_at: "2026-09-18T15:00:00Z" },
];

const result = partitionAppointments(records, now);
assert.deepEqual(result.upcoming.map((item) => item.id), ["upcoming", "confirmed"]);
assert.deepEqual(result.past.map((item) => item.id), ["no-show", "completed", "cancelled", "past"]);
console.log("PASS: only future scheduled and confirmed appointments are upcoming");
