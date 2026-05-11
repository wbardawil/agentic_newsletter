import type { Lang } from "@/lib/i18n/dictionary";

/**
 * Source of truth for topic taxonomy. Add a new topic here, run no
 * migration. The `editions.topic` column is plain text validated against
 * this list at write-time.
 */
export const TOPICS = [
  {
    id: "business_transformation",
    en: "Business transformation",
    es: "Transformación de negocio",
    /**
     * Sub-classifier: when topic = business_transformation, the issue
     * MUST also carry an `os_pillar` (Strategy / Operating Model /
     * Technology). Other topics do not require this.
     */
    requiresOsPillar: true,
    blurbEn: "The Business Transformation OS — Strategy, Operating Model, Technology, in that non-negotiable order.",
    blurbEs: "El Business Transformation OS — Estrategia, Modelo Operativo, Tecnología, en ese orden innegociable.",
  },
  {
    id: "conscious_capital",
    en: "Conscious capital",
    es: "Capital consciente",
    requiresOsPillar: false,
    blurbEn: "Stewardship of capital — long-term, values-aware returns over hype-cycle exits.",
    blurbEs: "Mayordomía del capital — retornos de largo plazo y conscientes de valores, no de ciclos de hype.",
  },
  {
    id: "family_business",
    en: "Family business",
    es: "Empresa familiar",
    requiresOsPillar: false,
    blurbEn: "Generational continuity, governance, succession — without breaking what made the business work.",
    blurbEs: "Continuidad generacional, gobierno y sucesión — sin romper lo que hizo funcionar al negocio.",
  },
  {
    id: "family_office",
    en: "Family office",
    es: "Family office",
    requiresOsPillar: false,
    blurbEn: "Single- and multi-family offices: investment posture, principal–staff dynamics, multi-generational stewardship.",
    blurbEs: "Single y multi-family offices: postura de inversión, dinámica principal–equipo, mayordomía multigeneracional.",
  },
  {
    id: "artificial_intelligence",
    en: "AI",
    es: "IA",
    requiresOsPillar: false,
    blurbEn: "Practical AI for mid-market operations — where it captures value and where it just makes noise.",
    blurbEs: "IA práctica para operaciones del mid-market — dónde captura valor y dónde solo hace ruido.",
  },
  {
    id: "technology",
    en: "Technology",
    es: "Tecnología",
    requiresOsPillar: false,
    blurbEn: "Architecture, integration, data, vendor selection — the third layer of the OS.",
    blurbEs: "Arquitectura, integración, datos y selección de proveedores — la tercera capa del OS.",
  },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];
export const TOPIC_IDS: TopicId[] = TOPICS.map((t) => t.id);

export function getTopic(id: string) {
  return TOPICS.find((t) => t.id === id);
}

export function topicLabel(id: string, lang: Lang): string {
  const t = getTopic(id);
  if (!t) return id;
  return lang === "es" ? t.es : t.en;
}

export function topicBlurb(id: string, lang: Lang): string {
  const t = getTopic(id);
  if (!t) return "";
  return lang === "es" ? t.blurbEs : t.blurbEn;
}
