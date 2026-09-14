import type { TableRow } from "@/lib/supabase/database.types";

export type TeamMemberOption = { userId: string; label: string; role: string };
export type PipelineStage = TableRow<"pipeline_definitions">;
export type Contact = TableRow<"contacts">;
export type Lead = TableRow<"leads">;
export type Opportunity = TableRow<"opportunities">;

export type LeadListItem = Lead & {
  contact: Contact | null;
  assigneeLabel: string | null;
};

export type OpportunityCard = Opportunity & {
  contact: Contact | null;
  assigneeLabel: string | null;
};
