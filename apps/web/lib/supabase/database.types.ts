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
        Row: { id: string; name: string; slug: string; timezone: string; currency: string; status: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; slug: string; timezone: string; currency: string; status?: string; created_at?: string; updated_at?: string };
        Update: { name?: string; slug?: string; timezone?: string; currency?: string; status?: string; updated_at?: string };
        Relationships: [];
      };
      tenant_members: {
        Row: { id: string; tenant_id: string; user_id: string; role: string; status: string; created_at: string };
        Insert: { id?: string; tenant_id: string; user_id: string; role: string; status?: string; created_at?: string };
        Update: { role?: string; status?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_tenant_with_owner: {
        Args: { p_creator_user_id: string; p_name: string; p_slug: string; p_timezone: string; p_currency: string };
        Returns: Database["public"]["Tables"]["tenants"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
