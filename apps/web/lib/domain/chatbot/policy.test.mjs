import { acceptsCaptureInput, isPublicWidgetAvailable, canManageAdvancedChatbotSetup } from "./policy.ts";

function assert(value, message) { if (!value) throw new Error(message); }

assert(!isPublicWidgetAvailable("draft", true), "draft widgets must remain private");
console.log("PASS: draft widget is rejected publicly");
assert(isPublicWidgetAvailable("published", true), "published enabled widget must be public");
console.log("PASS: published enabled widget is available publicly");
assert(!isPublicWidgetAvailable("published", false), "disabled widget must remain private");
console.log("PASS: disabled widget is rejected publicly");
assert(canManageAdvancedChatbotSetup("owner") && canManageAdvancedChatbotSetup("admin"), "owner/admin can access advanced setup");
assert(!canManageAdvancedChatbotSetup("front_desk") && !canManageAdvancedChatbotSetup("viewer"), "operational roles cannot access advanced setup");
console.log("PASS: advanced setup role boundary is enforced");
assert(!acceptsCaptureInput("choice", null, true), "free text at a menu must not become capture input");
assert(!acceptsCaptureInput("capture", null, true), "capture input requires an explicit capture field");
assert(acceptsCaptureInput("capture", "phone", true), "valid text is captured only at the expected capture node");
console.log("PASS: deterministic menus preserve state for free-text fallback");
