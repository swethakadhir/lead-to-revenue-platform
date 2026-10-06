import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AvailableSlot } from "@/lib/domain/availability/calculate";

export type SelfBookingResult =
  | { resultCode: "booked" | "already_booked"; appointmentId: string; startsAt: string; endsAt: string }
  | { resultCode: "slot_unavailable" | "invalid_request"; appointmentId: null; startsAt: null; endsAt: null };

/**
 * Server-only adapter for the atomic booking boundary. Callers should pass a
 * slot produced by calculateAvailability; the RPC repeats the tenant/config,
 * journey, time-window, and overlap checks transactionally.
 */
export async function createChatbotSelfBooking(tenantId: string, conversationId: string, slot: AvailableSlot): Promise<SelfBookingResult> {
  const { data, error } = await createAdminClient().rpc("create_chatbot_self_booking", {
    p_tenant_id: tenantId,
    p_conversation_id: conversationId,
    p_slot_start: slot.startsAt,
    p_slot_end: slot.endsAt,
  });
  if (error) throw error;
  const result = data?.[0];
  if (!result) throw new Error("The booking operation returned no result.");
  if (result.result_code === "booked" || result.result_code === "already_booked") {
    if (!result.appointment_id || !result.starts_at || !result.ends_at) throw new Error("The booking operation returned an incomplete appointment.");
    return { resultCode: result.result_code, appointmentId: result.appointment_id, startsAt: result.starts_at, endsAt: result.ends_at };
  }
  if (result.result_code !== "slot_unavailable" && result.result_code !== "invalid_request") throw new Error("The booking operation returned an unknown result.");
  return { resultCode: result.result_code, appointmentId: null, startsAt: null, endsAt: null };
}
