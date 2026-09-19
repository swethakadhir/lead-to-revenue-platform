import assert from "node:assert/strict";
import { parseDynamicLeadData, displayDynamicValue } from "./dynamic-fields.ts";

const field = (key, field_type, extra = {}) => ({ id: key, tenant_id: "tenant-a", key, label: key, field_type, required: false, options: [], is_active: true, ...extra });
const fields = [
  field("treatment_type", "select", { required: true, options: ["Dental Implant", "Root Canal"] }),
  field("budget", "currency"), field("preferred_date", "date"), field("first_visit", "boolean"),
  field("notes", "textarea"),
];
const input = (values) => { const form = new FormData(); for (const [key, value] of Object.entries(values)) form.set(`dynamic.${key}`, value); return form; };

const populated = parseDynamicLeadData(fields, input({ treatment_type: "Dental Implant", budget: "12000.50", preferred_date: "2026-10-10", first_visit: "false", notes: "Interested" }));
assert.equal(populated.success, true);
assert.deepEqual(populated.data, { treatment_type: "Dental Implant", budget: 12000.5, preferred_date: "2026-10-10", first_visit: false, notes: "Interested" });
console.log("PASS: dynamic answers serialize to lead_data types");

for (const [values, key] of [
  [{}, "treatment_type"], [{ treatment_type: "Invalid" }, "treatment_type"],
  [{ treatment_type: "Root Canal", budget: "abc" }, "budget"],
  [{ treatment_type: "Root Canal", preferred_date: "2026-02-31" }, "preferred_date"],
  [{ treatment_type: "Root Canal", first_visit: "yes" }, "first_visit"],
]) {
  const result = parseDynamicLeadData(fields, input(values));
  assert.equal(result.success, false);
  assert.ok(result.fieldErrors[`dynamic.${key}`]);
}
console.log("PASS: required, option, number, date and boolean errors rejected");

const legacy = parseDynamicLeadData(fields, input({ treatment_type: "Root Canal" }), { legacy_answer: "keep me" });
assert.equal(legacy.success, true);
assert.equal(legacy.data.legacy_answer, "keep me");
assert.equal(displayDynamicValue(legacy.data.legacy_answer), "keep me");
assert.equal(parseDynamicLeadData(fields, input({}), {}).success, true);
console.log("PASS: legacy keys and empty lead_data remain compatible on edits");

const attack = input({ treatment_type: "Root Canal", other_tenant_secret: "injected" });
assert.equal(Object.hasOwn(parseDynamicLeadData(fields, attack).data, "other_tenant_secret"), false);
console.log("PASS: unconfigured client fields are not serialized");
