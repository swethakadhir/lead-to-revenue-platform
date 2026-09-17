import assert from "node:assert/strict";
import { createLeadSchema } from "./schemas.ts";

const baseLead = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.test",
  phone: "",
  status: "new",
  assignedUserId: "",
};

const emptyObject = createLeadSchema.safeParse({ ...baseLead, leadData: "{}" });
assert.equal(emptyObject.success, true);
if (emptyObject.success) assert.deepEqual(emptyObject.data.leadData, {});
console.log("PASS: accepts an empty JSON object for lead data");

const populatedObject = createLeadSchema.safeParse({ ...baseLead, leadData: '{"treatment":"implant"}' });
assert.equal(populatedObject.success, true);
if (populatedObject.success) assert.deepEqual(populatedObject.data.leadData, { treatment: "implant" });
console.log("PASS: accepts a populated JSON object for lead data");

assert.equal(createLeadSchema.safeParse({ ...baseLead, leadData: "{malformed" }).success, false);
console.log("PASS: rejects malformed JSON for lead data");

for (const leadData of ["[]", '"text"', "42", "true", "null"]) {
  assert.equal(createLeadSchema.safeParse({ ...baseLead, leadData }).success, false, `expected ${leadData} to be rejected`);
}
console.log("PASS: rejects non-object JSON for lead data");
