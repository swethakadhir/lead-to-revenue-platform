export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string; email: string; phone: string | null; created_at: string; updated_at: string };
        Insert: { id: string; full_name?: string; email: string; phone?: string | null; created_at?: string; updated_at?: string };
        Update: { full_name?: string; phone?: string | null; updated_at?: string };
        Relationships: [];
      };
      tenants: {
        Row: { id: string; name: string; slug: string; timezone: string; currency: string; status: string; industry_template_id: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; slug: string; timezone: string; currency: string; status?: string; industry_template_id?: string | null; created_at?: string; updated_at?: string };
        Update: { name?: string; slug?: string; timezone?: string; currency?: string; status?: string; industry_template_id?: string | null; updated_at?: string };
        Relationships: [];
      };
      industry_templates: {
        Row: { id: string; key: string; name: string; description: string; version: number; is_active: boolean; configuration: Json; created_at: string; updated_at: string };
        Insert: { id?: string; key: string; name: string; description?: string; version?: number; is_active?: boolean; configuration: Json };
        Update: { name?: string; description?: string; version?: number; is_active?: boolean; configuration?: Json };
        Relationships: [];
      };
      tenant_settings: {
        Row: { id: string; tenant_id: string; business_name: string; business_description: string | null; business_hours: Json; default_language: string; appointment_types: Json; followup_defaults: Json; terminology: Json; created_at: string; updated_at: string };
        Insert: { id?: string; tenant_id: string; business_name: string; business_description?: string | null; business_hours?: Json; default_language?: string; appointment_types?: Json; followup_defaults?: Json; terminology?: Json };
        Update: { business_name?: string; business_description?: string | null; business_hours?: Json; default_language?: string; appointment_types?: Json; followup_defaults?: Json; terminology?: Json };
        Relationships: [];
      };
      lead_field_definitions: {
        Row: { id: string; tenant_id: string; key: string; label: string; field_type: string; required: boolean; options: Json; placeholder: string | null; help_text: string | null; sort_order: number; is_active: boolean; qualification_relevant: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; tenant_id: string; key: string; label: string; field_type: string; required?: boolean; options?: Json; placeholder?: string | null; help_text?: string | null; sort_order?: number; is_active?: boolean; qualification_relevant?: boolean };
        Update: { label?: string; required?: boolean; options?: Json; placeholder?: string | null; help_text?: string | null; sort_order?: number; is_active?: boolean; qualification_relevant?: boolean };
        Relationships: [];
      };
      qualification_rules: {
        Row: { id: string; tenant_id: string; key: string; name: string; field_key: string; rule_type: string; is_required: boolean; score_delta: number; is_active: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; tenant_id: string; key: string; name: string; field_key: string; rule_type?: string; is_required?: boolean; score_delta?: number; is_active?: boolean };
        Update: { name?: string; is_required?: boolean; score_delta?: number; is_active?: boolean };
        Relationships: [];
      };
      tenant_members: {
        Row: { id: string; tenant_id: string; user_id: string; role: string; status: string; created_at: string };
        Insert: { id?: string; tenant_id: string; user_id: string; role: string; status?: string; created_at?: string };
        Update: { role?: string; status?: string };
        Relationships: [];
      };
      pipeline_definitions: {
        Row: { id: string; tenant_id: string; key: string; name: string; stage_order: number; stage_type: string; is_terminal: boolean; is_active: boolean };
        Insert: { id?: string; tenant_id: string; key: string; name: string; stage_order: number; stage_type: string; is_terminal?: boolean; is_active?: boolean };
        Update: { key?: string; name?: string; stage_order?: number; stage_type?: string; is_terminal?: boolean; is_active?: boolean };
        Relationships: [];
      };
      contacts: {
        Row: { id: string; tenant_id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null; whatsapp_number: string | null; preferred_channel: string | null; metadata: Json; created_at: string; updated_at: string };
        Insert: { id?: string; tenant_id: string; first_name: string; last_name?: string | null; email?: string | null; phone?: string | null; whatsapp_number?: string | null; preferred_channel?: string | null; metadata?: Json; created_at?: string; updated_at?: string };
        Update: { first_name?: string; last_name?: string | null; email?: string | null; phone?: string | null; whatsapp_number?: string | null; preferred_channel?: string | null; metadata?: Json; updated_at?: string };
        Relationships: [];
      };
      leads: {
        Row: { id: string; tenant_id: string; contact_id: string | null; source_id: string | null; campaign_id: string | null; external_lead_id: string | null; status: string; qualification_status: string; qualification_score: number | null; assigned_user_id: string | null; lead_data: Json; first_contacted_at: string | null; last_contacted_at: string | null; next_followup_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; tenant_id: string; contact_id?: string | null; source_id?: string | null; campaign_id?: string | null; external_lead_id?: string | null; status?: string; qualification_status?: string; qualification_score?: number | null; assigned_user_id?: string | null; lead_data?: Json; first_contacted_at?: string | null; last_contacted_at?: string | null; next_followup_at?: string | null; created_at?: string; updated_at?: string };
        Update: { contact_id?: string | null; source_id?: string | null; campaign_id?: string | null; external_lead_id?: string | null; status?: string; qualification_status?: string; qualification_score?: number | null; assigned_user_id?: string | null; lead_data?: Json; first_contacted_at?: string | null; last_contacted_at?: string | null; next_followup_at?: string | null; updated_at?: string };
        Relationships: [];
      };
      opportunities: {
        Row: { id: string; tenant_id: string; lead_id: string; contact_id: string | null; name: string; stage_key: string; estimated_value: number | null; currency: string; probability: number | null; assigned_user_id: string | null; expected_close_date: string | null; won_at: string | null; lost_at: string | null; lost_reason: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; tenant_id: string; lead_id: string; contact_id?: string | null; name: string; stage_key: string; estimated_value?: number | null; currency: string; probability?: number | null; assigned_user_id?: string | null; expected_close_date?: string | null; lost_reason?: string | null; created_at?: string; updated_at?: string };
        Update: { name?: string; stage_key?: string; estimated_value?: number | null; currency?: string; probability?: number | null; assigned_user_id?: string | null; expected_close_date?: string | null; lost_reason?: string | null; updated_at?: string };
        Relationships: [];
      };
      appointments: {
        Row: { id: string; tenant_id: string; lead_id: string | null; opportunity_id: string | null; contact_id: string; assigned_user_id: string | null; title: string; appointment_type: string | null; status: string; starts_at: string; ends_at: string; timezone: string; location: string | null; meeting_url: string | null; notes: string | null; cancellation_reason: string | null; completed_at: string | null; cancelled_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; tenant_id: string; lead_id?: string | null; opportunity_id?: string | null; contact_id: string; assigned_user_id?: string | null; title: string; appointment_type?: string | null; status?: string; starts_at: string; ends_at: string; timezone: string; location?: string | null; meeting_url?: string | null; notes?: string | null; cancellation_reason?: string | null; created_at?: string; updated_at?: string };
        Update: { lead_id?: string | null; opportunity_id?: string | null; contact_id?: string; assigned_user_id?: string | null; title?: string; appointment_type?: string | null; status?: string; starts_at?: string; ends_at?: string; timezone?: string; location?: string | null; meeting_url?: string | null; notes?: string | null; cancellation_reason?: string | null; updated_at?: string };
        Relationships: [];
      };
      followups: {
        Row: { id: string; tenant_id: string; lead_id: string | null; opportunity_id: string | null; contact_id: string; assigned_user_id: string | null; type: string; status: string; due_at: string; completed_at: string | null; notes: string | null; outcome: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; tenant_id: string; lead_id?: string | null; opportunity_id?: string | null; contact_id: string; assigned_user_id?: string | null; type: string; status?: string; due_at: string; notes?: string | null; outcome?: string | null; created_at?: string; updated_at?: string };
        Update: { lead_id?: string | null; opportunity_id?: string | null; contact_id?: string; assigned_user_id?: string | null; type?: string; status?: string; due_at?: string; notes?: string | null; outcome?: string | null; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_tenant_with_owner: {
        Args: { p_creator_user_id: string; p_name: string; p_slug: string; p_timezone: string; p_currency: string; p_template_id?: string };
        Returns: Database["public"]["Tables"]["tenants"]["Row"];
      };
      apply_industry_template: { Args: { p_tenant_id: string; p_template_id: string }; Returns: undefined };
      create_manual_lead: {
        Args: { p_tenant_id: string; p_first_name: string; p_last_name: string; p_email: string; p_phone: string; p_status: string; p_assigned_user_id: string | null; p_lead_data: Json };
        Returns: string;
      };
      update_lead_with_contact: {
        Args: { p_tenant_id: string; p_lead_id: string; p_first_name: string; p_last_name: string; p_email: string; p_phone: string; p_status: string; p_qualification_status: string; p_qualification_score: number | null; p_assigned_user_id: string | null; p_lead_data: Json };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TableRow<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Row"];
