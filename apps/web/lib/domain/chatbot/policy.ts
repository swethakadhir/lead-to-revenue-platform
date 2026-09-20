export function isPublicWidgetAvailable(status: string, enabled: boolean) {
  return status === "published" && enabled;
}

export function canManageAdvancedChatbotSetup(role: string) {
  return role === "owner" || role === "admin";
}

export function acceptsCaptureInput(nodeType: string, captureKey: string | null, isValid: boolean) {
  return nodeType === "capture" && Boolean(captureKey) && isValid;
}
