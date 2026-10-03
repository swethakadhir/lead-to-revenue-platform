import type { Json } from "@/lib/supabase/database.types";

export function isPublicWidgetAvailable(status: string, enabled: boolean) {
  return status === "published" && enabled;
}

export function canManageAdvancedChatbotSetup(role: string) {
  return role === "owner" || role === "admin";
}

export function acceptsCaptureInput(nodeType: string, captureKey: string | null, isValid: boolean) {
  return nodeType === "capture" && Boolean(captureKey) && isValid;
}

type MenuNode = { id: string; node_type: string };
type MenuEdge = { source_node_id: string; destination_node_id: string; label: string; is_default: boolean; set_context?: Json };

export function looksLikeBookingRequest(text: string) {
  return /\b(book|booking|appointment|schedule|availability|available|come tomorrow)\b/i.test(text);
}

function hasConfiguredContext(edge: MenuEdge) {
  return Boolean(edge.set_context && Object.keys(edge.set_context).length);
}

export function isConfiguredBookingSelection(edge: MenuEdge, nodes: MenuNode[]) {
  return !edge.is_default && hasConfiguredContext(edge) && nodes.some((node) => node.id === edge.destination_node_id && node.node_type === "capture");
}

export function initialMenuBookingEntry(input: { rootNodeId: string; currentNodeId: string; currentNodeType: string; text: string; nodes: MenuNode[]; edges: MenuEdge[] }) {
  if (input.currentNodeId !== input.rootNodeId || input.currentNodeType !== "choice" || !looksLikeBookingRequest(input.text)) return null;
  const captureEntries = input.edges.filter((edge) => !edge.is_default && edge.source_node_id === input.currentNodeId && input.nodes.some((node) => node.id === edge.destination_node_id && node.node_type === "capture"));
  return captureEntries.find((edge) => isConfiguredBookingSelection(edge, input.nodes)) ?? captureEntries[0] ?? null;
}

export function isStaleMenuTransition(expectedNodeId: string, actualNodeId: string | null) {
  return actualNodeId !== expectedNodeId;
}
