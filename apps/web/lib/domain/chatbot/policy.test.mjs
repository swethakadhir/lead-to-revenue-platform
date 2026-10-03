import { acceptsCaptureInput, initialMenuBookingEntry, isConfiguredBookingSelection, isPublicWidgetAvailable, isStaleMenuTransition, canManageAdvancedChatbotSetup } from "./policy.ts";

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

const nodes = [{ id: "menu", node_type: "choice" }, { id: "contact", node_type: "capture" }, { id: "booking", node_type: "capture" }, { id: "services", node_type: "choice" }];
const edges = [
  { source_node_id: "menu", destination_node_id: "contact", label: "Contact our team", is_default: false, set_context: {} },
  { source_node_id: "menu", destination_node_id: "booking", label: "Request help", is_default: false, set_context: { configured_interest: "consultation" } },
  { source_node_id: "menu", destination_node_id: "services", label: "Services", is_default: false },
];
const bookingEntry = initialMenuBookingEntry({ rootNodeId: "menu", currentNodeId: "menu", currentNodeType: "choice", text: "Hi, I want to book an appointment", nodes, edges });
assert(bookingEntry?.destination_node_id === "booking", "free-text booking intent at the initial menu enters the configured booking capture flow without depending on option text");
assert(isConfiguredBookingSelection(edges[1], nodes), "configured capture context marks a booking selection generically");
assert(!isConfiguredBookingSelection(edges[0], nodes), "ordinary contact capture options retain their existing behavior");
assert(initialMenuBookingEntry({ rootNodeId: "menu", currentNodeId: "services", currentNodeType: "choice", text: "I want to book an appointment", nodes, edges }) === null, "booking intent outside the initial menu keeps its existing routing");
assert(initialMenuBookingEntry({ rootNodeId: "menu", currentNodeId: "menu", currentNodeType: "choice", text: "What are your hours?", nodes, edges }) === null, "non-booking free text keeps the configured fallback path");
assert(isStaleMenuTransition("menu", "booking") && !isStaleMenuTransition("menu", "menu"), "retried menu transitions are identified without reapplying side effects");
console.log("PASS: initial-menu free-text booking intent enters the configured capture flow");
