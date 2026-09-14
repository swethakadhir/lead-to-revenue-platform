import type { Contact, Lead, Opportunity, TeamMemberOption } from "@/lib/domain/sales/types";
import type { TableRow } from "@/lib/supabase/database.types";

export type Appointment = TableRow<"appointments">;
export type Followup = TableRow<"followups">;
export type OperationalReferences = {
  contacts: Contact[];
  leads: Lead[];
  opportunities: Opportunity[];
  members: TeamMemberOption[];
};
export type AppointmentListItem = Appointment & { contact: Contact; assigneeLabel: string | null; lead: Lead | null; opportunity: Opportunity | null };
export type FollowupListItem = Followup & { contact: Contact; assigneeLabel: string | null; lead: Lead | null; opportunity: Opportunity | null };
