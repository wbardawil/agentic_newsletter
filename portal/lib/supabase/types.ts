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

export type MemberRow = {
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

export type ApplicationRow = {
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

export type EditionRow = {
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

export type EditionSourceRow = {
  id: string;
  edition_id: string;
  title: string;
  url: string;
  snippet: string | null;
  publisher: string | null;
}

export type AiConversationRow = {
  id: string;
  member_id: string;
  title: string;
  created_at: string;
}

export type AiMessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  citations: { edition_id: string; quote: string }[] | null;
  created_at: string;
}

export type ConveningRow = {
  id: string;
  city: string;
  region: Region;
  starts_at: string;
  capacity: number;
  description: string;
  language: Language;
  rsvp_count: number;
}

export type ConveningRsvpRow = {
  member_id: string;
  convening_id: string;
  status: "confirmed" | "waitlist" | "cancelled";
  created_at: string;
}

type Rel = [];

export type Database = {
  public: {
    Tables: {
      members: { Row: MemberRow; Insert: Partial<MemberRow> & { id: string; email: string }; Update: Partial<MemberRow>; Relationships: Rel };
      applications: { Row: ApplicationRow; Insert: Partial<ApplicationRow> & { email: string; full_name: string; company: string; role: string; company_size_band: CompanySizeBand; region: Region; motivation: string }; Update: Partial<ApplicationRow>; Relationships: Rel };
      editions: { Row: EditionRow; Insert: Partial<EditionRow> & { edition_id: string }; Update: Partial<EditionRow>; Relationships: Rel };
      edition_sources: { Row: EditionSourceRow; Insert: Partial<EditionSourceRow> & { edition_id: string; title: string; url: string }; Update: Partial<EditionSourceRow>; Relationships: Rel };
      ai_conversations: { Row: AiConversationRow; Insert: Partial<AiConversationRow> & { member_id: string }; Update: Partial<AiConversationRow>; Relationships: Rel };
      ai_messages: { Row: AiMessageRow; Insert: Partial<AiMessageRow> & { conversation_id: string; role: "user" | "assistant"; content: string }; Update: Partial<AiMessageRow>; Relationships: Rel };
      convenings: { Row: ConveningRow; Insert: Partial<ConveningRow> & { city: string; region: Region; starts_at: string; capacity: number; description: string }; Update: Partial<ConveningRow>; Relationships: Rel };
      convening_rsvps: { Row: ConveningRsvpRow; Insert: Partial<ConveningRsvpRow> & { member_id: string; convening_id: string }; Update: Partial<ConveningRsvpRow>; Relationships: Rel };
    };
    Views: {
      convenings_with_counts: { Row: ConveningRow; Relationships: Rel };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
