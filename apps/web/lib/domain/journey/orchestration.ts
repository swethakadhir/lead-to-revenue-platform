import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { TableRow } from "@/lib/supabase/database.types";
import { evaluateLeadJourney, type JourneyDecision } from "./orchestrator";
import { evaluateQualification } from "@/lib/domain/chatbot/qualification";

type SyncReason = "customer_activity" | "lead_updated" | "intervention_resolved" | "follow_up_executed";

export async function syncLeadJourney(tenantId: string, leadId: string, reason: SyncReason): Promise<JourneyDecision | null> {
  const admin = createAdminClient();
  const [leadResult, settingsResult, fieldsResult, rulesResult, journeyResult, interventionsResult, appointmentsResult, followupsResult, conversationResult] = await Promise.all([
    admin.from("leads").select("*").eq("tenant_id", tenantId).eq("id", leadId).maybeSingle(),
    admin.from("tenant_settings").select("followup_defaults").eq("tenant_id", tenantId).maybeSingle(),
    admin.from("lead_field_definitions").select("key,label,required,is_active").eq("tenant_id", tenantId),
    admin.from("qualification_rules").select("*").eq("tenant_id", tenantId),
    admin.from("lead_journeys").select("*").eq("tenant_id", tenantId).eq("lead_id", leadId).maybeSingle(),
    admin.from("human_interventions").select("id").eq("tenant_id", tenantId).eq("lead_id", leadId).in("status", ["open", "in_progress"]),
    admin.from("appointments").select("status").eq("tenant_id", tenantId).eq("lead_id", leadId).in("status", ["scheduled", "confirmed"]),
    admin.from("followups").select("id,status,automation_key").eq("tenant_id", tenantId).eq("lead_id", leadId),
    admin.from("conversations").select("id,last_activity_at").eq("tenant_id", tenantId).eq("lead_id", leadId).order("last_activity_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const results = [leadResult, settingsResult, fieldsResult, rulesResult, journeyResult, interventionsResult, appointmentsResult, followupsResult, conversationResult];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  const lead = leadResult.data as TableRow<"leads"> | null;
  if (!lead) return null;
  const contactResult = lead.contact_id ? await admin.from("contacts").select("email,phone").eq("tenant_id", tenantId).eq("id", lead.contact_id).maybeSingle() : { data: null, error: null };
  if (contactResult.error) throw contactResult.error;
  const followups = followupsResult.data ?? [];
  const decision = evaluateLeadJourney({
    lead,
    fields: fieldsResult.data ?? [],
    rules: (rulesResult.data ?? []) as TableRow<"qualification_rules">[],
    qualification: evaluateQualification((rulesResult.data ?? []) as TableRow<"qualification_rules">[], { ...(lead.lead_data && typeof lead.lead_data === "object" && !Array.isArray(lead.lead_data) ? lead.lead_data : {}), email: contactResult.data?.email ?? undefined, phone: contactResult.data?.phone ?? undefined }),
    contact: contactResult.data,
    hasActiveAppointment: (appointmentsResult.data ?? []).some((appointment) => appointment.status === "scheduled"),
    hasConfirmedAppointment: (appointmentsResult.data ?? []).some((appointment) => appointment.status === "confirmed"),
    interventionOpen: (interventionsResult.data ?? []).length > 0,
    pendingAutomatedFollowUp: followups.some((followup) => followup.status === "pending" && followup.automation_key),
    completedAutomatedFollowUps: followups.filter((followup) => followup.status === "completed" && followup.automation_key).length,
    lastMeaningfulActivityAt: conversationResult.data?.last_activity_at ?? null,
    policy: settingsResult.data?.followup_defaults ?? {},
  });

  const policyNowStops = decision.stage === "converted" || decision.stage === "disqualified" || decision.stage === "dormant" || decision.stage === "booking_ready" || decision.stage === "booking_in_progress" || decision.blockedByIntervention || (decision.qualificationState === "qualified" && decision.followUpPolicy.stopOnQualification);
  if (policyNowStops && followups.some((followup) => followup.status === "pending" && followup.automation_key)) {
    const { error } = await admin.from("followups").update({ status: "cancelled", outcome: "Cancelled because the current journey no longer permits ordinary automation." }).eq("tenant_id", tenantId).eq("lead_id", leadId).eq("status", "pending").not("automation_key", "is", null);
    if (error) throw error;
    // Re-read the authoritative records after the cancellation trigger has also
    // cancelled matching jobs; this keeps the projection and schedule coherent.
    return syncLeadJourney(tenantId, leadId, reason);
  }

  // The lifecycle column remains authoritative for terminal state. Reaching the
  // configured finite follow-up limit transitions an otherwise active lead to dormant.
  if (decision.stage === "dormant" && lead.status !== "dormant") {
    const { error } = await admin.from("leads").update({ status: "dormant" }).eq("tenant_id", tenantId).eq("id", leadId);
    if (error) throw error;
  }
  const previous = journeyResult.data;
  const journeyUpdate = { stage: decision.stage, next_expected_action: decision.nextAction === "none" ? null : decision.nextAction, next_action_due_at: decision.followUpDueAt, follow_up_required: decision.shouldScheduleFollowUp, blocked_by_human_intervention: decision.blockedByIntervention };
  const { error: journeyError } = await admin.from("lead_journeys").update(journeyUpdate).eq("tenant_id", tenantId).eq("lead_id", leadId);
  if (journeyError) throw journeyError;
  if (previous && previous.stage !== decision.stage) {
    const { error } = await admin.from("journey_events").insert({ tenant_id: tenantId, lead_id: leadId, conversation_id: previous.conversation_id, event_type: decision.stage === "booking_ready" ? "booking_ready" : "journey_stage_changed", metadata: { from: previous.stage, to: decision.stage, reason: decision.reason } });
    if (error) throw error;
  }
  if (decision.shouldScheduleFollowUp && decision.followUpDueAt && lead.contact_id) {
    const cycle = followups.filter((followup) => followup.automation_key).length + 1;
    const automationKey = `journey:${leadId}:inactivity:${cycle}`;
    const { data: inserted, error } = await admin.from("followups").insert({ tenant_id: tenantId, lead_id: leadId, contact_id: lead.contact_id, type: "call", due_at: decision.followUpDueAt, notes: "Automated inactivity follow-up.", automation_key: automationKey }).select("id").maybeSingle();
    if (error && error.code !== "23505") throw error;
    if (inserted) {
      const { error: updateError } = await admin.from("lead_journeys").update({ stage: "follow_up", next_expected_action: "follow_up", next_action_due_at: decision.followUpDueAt, follow_up_required: true }).eq("tenant_id", tenantId).eq("lead_id", leadId);
      if (updateError) throw updateError;
      const { error: eventError } = await admin.from("journey_events").insert({ tenant_id: tenantId, lead_id: leadId, conversation_id: previous?.conversation_id ?? null, event_type: "follow_up_scheduled", metadata: { followup_id: inserted.id, due_at: decision.followUpDueAt, reason } });
      if (eventError) throw eventError;
    }
  }
  return decision;
}

export async function recordLeadInboundActivity(tenantId: string, leadId: string) {
  const admin = createAdminClient();
  // Only orchestrator-created follow-ups are obsolete on a reply; manual work is
  // intentionally left for an operator to decide.
  const { data: cancelled, error } = await admin.from("followups").update({ status: "cancelled", outcome: "Cancelled after customer activity." }).eq("tenant_id", tenantId).eq("lead_id", leadId).eq("status", "pending").not("automation_key", "is", null).select("id");
  if (error) throw error;
  return { cancelled: cancelled?.length ?? 0, decision: await syncLeadJourney(tenantId, leadId, "customer_activity") };
}
