export type ApplicationStatus = "pending" | "approved" | "rejected" | "waitlisted";
export type MemberStatus = "active" | "paused" | "revoked";
export type CompanySizeBand = "under_5m" | "5m_25m" | "25m_50m" | "50m_100m" | "over_100m";
export type Region =
  | "miami"
  | "monterrey"
  | "bogota"
  | "panama_city"
  | "mexico_city"
  | "other_us"
  | "other_latam"
  | "other";
export type OsPillar = "Strategy OS" | "Operating Model OS" | "Technology OS";
export type Language = "en" | "es";
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface MemberRow {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  role: string | null;
  company_size_band: CompanySizeBand | null;
  region: Region | null;
  industry: string | null;
  preferred_language: Language;
  topics_of_interest: string[];
  status: MemberStatus;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApplicationRow {
  id: string;
  email: string;
  full_name: string;
  company: string;
  role: string;
  company_size_band: CompanySizeBand;
  region: Region;
  industry: string | null;
  preferred_language: Language;
  topics_of_interest: string[];
  motivation: string;
  status: ApplicationStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface EditionRow {
  id: string;
  edition_id: string;
  edition_number: number;
  published_at: string | null;
  subject_en: string | null;
  subject_es: string | null;
  body_en: string | null;
  body_es: string | null;
  hero_image_url: string | null;
  topic: string;
  pillar: OsPillar | null;
  quarterly_theme: string | null;
  shareable_sentence_en: string | null;
  shareable_sentence_es: string | null;
  byline: string | null;
  byline_role: string | null;
  is_published: boolean;
}

export interface EditionSourceRow {
  id: string;
  edition_id: string;
  title: string;
  url: string;
  snippet: string | null;
  publisher: string | null;
}

/** Body-free public projection of published editions (view: editions_public). */
export interface EditionPublicRow {
  id: string;
  edition_id: string;
  edition_number: number;
  published_at: string | null;
  subject_en: string | null;
  subject_es: string | null;
  topic: string;
  pillar: OsPillar | null;
  quarterly_theme: string | null;
  shareable_sentence_en: string | null;
  shareable_sentence_es: string | null;
  byline: string | null;
  byline_role: string | null;
  hero_image_url: string | null;
}

export interface AiConversationRow {
  id: string;
  member_id: string;
  title: string;
  created_at: string;
}

export interface AiMessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  citations: Json | null;
  created_at: string;
}

export interface ConveningRow {
  id: string;
  city: string;
  region: Region;
  starts_at: string;
  capacity: number;
  description: string;
  language: Language;
  rsvp_count: number;
}

export interface ConveningsWithCountsRow {
  id: string;
  city: string;
  region: Region;
  starts_at: string;
  capacity: number;
  description: string;
  language: Language;
  rsvp_count: number;
}

export interface ConveningRsvpRow {
  member_id: string;
  convening_id: string;
  status: "confirmed" | "waitlist" | "cancelled";
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      members: { Row: MemberRow; Insert: Partial<MemberRow> & { id: string; email: string }; Update: Partial<MemberRow>; Relationships: [] };
      applications: { Row: ApplicationRow; Insert: Omit<ApplicationRow, "id" | "created_at" | "status" | "decided_by" | "decided_at"> & { status?: ApplicationStatus }; Update: Partial<ApplicationRow>; Relationships: [] };
      editions: { Row: EditionRow; Insert: Partial<EditionRow> & { edition_id: string }; Update: Partial<EditionRow>; Relationships: [] };
      edition_sources: { Row: EditionSourceRow; Insert: Omit<EditionSourceRow, "id">; Update: Partial<EditionSourceRow>; Relationships: [] };
      ai_conversations: { Row: AiConversationRow; Insert: Omit<AiConversationRow, "id" | "created_at"> & { id?: string }; Update: Partial<AiConversationRow>; Relationships: [] };
      ai_messages: { Row: AiMessageRow; Insert: Omit<AiMessageRow, "id" | "created_at" | "citations"> & { id?: string; citations?: Json | null }; Update: Partial<AiMessageRow>; Relationships: [] };
      convenings: { Row: ConveningRow; Insert: Omit<ConveningRow, "id" | "rsvp_count"> & { id?: string }; Update: Partial<ConveningRow>; Relationships: [] };
      convening_rsvps: { Row: ConveningRsvpRow; Insert: ConveningRsvpRow; Update: Partial<ConveningRsvpRow>; Relationships: [] };
    };
    Views: {
      convenings_with_counts: {
        Row: ConveningsWithCountsRow;
        Relationships: [];
      };
      editions_public: {
        Row: EditionPublicRow;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
