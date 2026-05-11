export type Lang = "en" | "es";

export const LANGS: Lang[] = ["en", "es"];

export function normalizeLang(input: string | undefined | null): Lang {
  return input === "es" ? "es" : "en";
}

type Dict = {
  brand: { name: string; tagline: string };
  nav: { archive: string; convenings: string; ask: string; apply: string; signIn: string; signOut: string; account: string; preferences: string };
  landing: {
    hero: string;
    filterSentence: string;
    subFilter: string;
    primaryCta: string;
    secondaryCta: string;
    pillarsHeading: string;
    pillarStrategy: string;
    pillarStrategyBody: string;
    pillarOperating: string;
    pillarOperatingBody: string;
    pillarTech: string;
    pillarTechBody: string;
    peopleHeading: string;
    peopleBody: string;
    audienceHeading: string;
    audienceBody: string;
  };
  apply: {
    title: string;
    subtitle: string;
    name: string;
    email: string;
    company: string;
    role: string;
    sizeBand: string;
    region: string;
    industry: string;
    language: string;
    motivation: string;
    motivationHelp: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successBody: string;
    sizeOptions: { value: string; label: string }[];
    regionOptions: { value: string; label: string }[];
  };
  signIn: { title: string; sub: string; email: string; submit: string; check: string };
  member: {
    welcome: string;
    latestIssue: string;
    yourPreferences: string;
    askAssistant: string;
    upcomingConvenings: string;
    noUpcoming: string;
  };
  preferences: {
    title: string;
    sub: string;
    language: string;
    region: string;
    industry: string;
    role: string;
    pillarsInterest: string;
    save: string;
    saved: string;
  };
  archive: { title: string; sub: string; search: string; filterPillar: string; filterLang: string; noResults: string };
  ask: { title: string; sub: string; placeholder: string; send: string; thinking: string; sources: string; emptyState: string };
  convenings: { title: string; sub: string; rsvp: string; rsvped: string; capacityFull: string };
  admin: { applications: string; pending: string; approve: string; reject: string; waitlist: string; approved: string; rejected: string; waitlisted: string };
};

const en: Dict = {
  brand: {
    name: "The Transformation Letter",
    tagline: "AI business transformation playbooks for $5–100M owner-operators in the US-LATAM corridor.",
  },
  nav: {
    archive: "Archive",
    convenings: "Convenings",
    ask: "Ask",
    apply: "Apply",
    signIn: "Sign in",
    signOut: "Sign out",
    account: "Account",
    preferences: "Preferences",
  },
  landing: {
    hero: "Strategy before operating model. Operating model before technology. The sequence is the insight.",
    filterSentence: "Your business is already running an OS — it was just built by accident, not by design.",
    subFilter: "Weekly diagnostics for owner-operators who have tried everything they know how to try.",
    primaryCta: "Apply to join",
    secondaryCta: "Read the archive",
    pillarsHeading: "Three layers. One sequence. Non-negotiable order.",
    pillarStrategy: "Strategy OS",
    pillarStrategyBody: "Vision, value cases, prioritization, portfolio choices.",
    pillarOperating: "Operating Model OS",
    pillarOperatingBody: "Process redesign, governance, decision rights, structure.",
    pillarTech: "Technology OS",
    pillarTechBody: "Architecture, data, platforms, integration, security.",
    peopleHeading: "People is the always-on dimension.",
    peopleBody:
      "Every recommendation names the human shift it creates — anchored in ADKAR, Kotter, or McKinsey 7S — because change-management is where most transformations actually fail.",
    audienceHeading: "Built for the operator already deploying AI — and not yet capturing its full value.",
    audienceBody:
      "Owner-operators of $5–100M businesses across Miami, Monterrey, Bogotá, Panama City, and Mexico City. Bilingual EN/ES. One issue per week. Members-only.",
  },
  apply: {
    title: "Apply to The Transformation Letter",
    subtitle:
      "Membership is gated. We read every application — the goal is to keep the room full of the right operators.",
    name: "Full name",
    email: "Work email",
    company: "Company",
    role: "Role",
    sizeBand: "Company revenue band",
    region: "Primary region",
    industry: "Industry",
    language: "Preferred language",
    motivation: "What are you trying to transform, and what have you already tried?",
    motivationHelp: "Two or three sentences is enough. Be specific about the gap you are stuck on.",
    submit: "Submit application",
    submitting: "Submitting…",
    successTitle: "Application received.",
    successBody:
      "We will write back within five business days. If accepted, you will get a sign-in link to the portal.",
    sizeOptions: [
      { value: "under_5m", label: "Under $5M" },
      { value: "5m_25m", label: "$5M – $25M" },
      { value: "25m_50m", label: "$25M – $50M" },
      { value: "50m_100m", label: "$50M – $100M" },
      { value: "over_100m", label: "Over $100M" },
    ],
    regionOptions: [
      { value: "miami", label: "Miami" },
      { value: "monterrey", label: "Monterrey" },
      { value: "bogota", label: "Bogotá" },
      { value: "panama_city", label: "Panama City" },
      { value: "mexico_city", label: "Mexico City" },
      { value: "other_us", label: "Other (US)" },
      { value: "other_latam", label: "Other (LATAM)" },
      { value: "other", label: "Other" },
    ],
  },
  signIn: {
    title: "Sign in",
    sub: "Magic links only. We do not store passwords.",
    email: "Member email",
    submit: "Send magic link",
    check: "Check your inbox. The link expires in 10 minutes.",
  },
  member: {
    welcome: "Welcome back.",
    latestIssue: "Latest issue",
    yourPreferences: "Your preferences",
    askAssistant: "Ask the Transformation AI",
    upcomingConvenings: "Upcoming convenings",
    noUpcoming: "No convenings on the calendar yet.",
  },
  preferences: {
    title: "Preferences",
    sub: "Tailor what shows up in your weekly issue.",
    language: "Preferred language",
    region: "Primary region",
    industry: "Industry",
    role: "Role",
    pillarsInterest: "Pillars I care about most",
    save: "Save preferences",
    saved: "Saved.",
  },
  archive: {
    title: "Archive",
    sub: "Every issue. Bilingual. Filterable by pillar and language.",
    search: "Search the archive",
    filterPillar: "Pillar",
    filterLang: "Language",
    noResults: "No issues match.",
  },
  ask: {
    title: "Ask the Transformation AI",
    sub: "Grounded in the archive and the Voice Bible. Answers cite the issues they came from.",
    placeholder: "Ask about strategy, operating model, technology, or change management…",
    send: "Send",
    thinking: "Thinking…",
    sources: "Sources",
    emptyState: "Start a new conversation. Anything you ask is private to your account.",
  },
  convenings: {
    title: "Convenings",
    sub: "Member dinners and working groups across the US-LATAM corridor.",
    rsvp: "RSVP",
    rsvped: "RSVP confirmed",
    capacityFull: "At capacity — join waitlist",
  },
  admin: {
    applications: "Applications",
    pending: "Pending",
    approve: "Approve",
    reject: "Reject",
    waitlist: "Waitlist",
    approved: "Approved",
    rejected: "Rejected",
    waitlisted: "Waitlisted",
  },
};

const es: Dict = {
  brand: {
    name: "The Transformation Letter",
    tagline:
      "Playbooks de transformación con IA para owner-operators de empresas de $5–100M en el corredor US-LATAM.",
  },
  nav: {
    archive: "Archivo",
    convenings: "Encuentros",
    ask: "Preguntar",
    apply: "Postular",
    signIn: "Ingresar",
    signOut: "Salir",
    account: "Cuenta",
    preferences: "Preferencias",
  },
  landing: {
    hero: "Estrategia antes que modelo operativo. Modelo operativo antes que tecnología. La secuencia es la idea.",
    filterSentence:
      "Tu negocio ya está corriendo un OS — solo que se construyó por accidente, no por diseño.",
    subFilter:
      "Diagnósticos semanales para owner-operators que ya probaron todo lo que sabían cómo probar.",
    primaryCta: "Postular para entrar",
    secondaryCta: "Leer el archivo",
    pillarsHeading: "Tres capas. Una secuencia. Orden innegociable.",
    pillarStrategy: "Strategy OS",
    pillarStrategyBody: "Visión, casos de valor, priorización, portafolio.",
    pillarOperating: "Operating Model OS",
    pillarOperatingBody: "Procesos, gobierno, derechos de decisión, estructura.",
    pillarTech: "Technology OS",
    pillarTechBody: "Arquitectura, datos, plataformas, integración, seguridad.",
    peopleHeading: "La dimensión humana es permanente.",
    peopleBody:
      "Cada recomendación nombra el cambio humano que crea — anclado en ADKAR, Kotter o McKinsey 7S — porque la gestión del cambio es donde la mayoría de las transformaciones realmente fallan.",
    audienceHeading: "Para el operador que ya está usando IA — y todavía no captura todo su valor.",
    audienceBody:
      "Owner-operators de negocios de $5–100M en Miami, Monterrey, Bogotá, Ciudad de Panamá y Ciudad de México. Bilingüe EN/ES. Una edición por semana. Solo miembros.",
  },
  apply: {
    title: "Postular a The Transformation Letter",
    subtitle:
      "El acceso es por aplicación. Leemos cada postulación — la idea es mantener la sala con los operadores correctos.",
    name: "Nombre completo",
    email: "Correo de trabajo",
    company: "Empresa",
    role: "Cargo",
    sizeBand: "Banda de ingresos de la empresa",
    region: "Región principal",
    industry: "Industria",
    language: "Idioma preferido",
    motivation: "¿Qué estás intentando transformar y qué has probado ya?",
    motivationHelp: "Dos o tres frases bastan. Sé específico sobre el gap donde estás estancado.",
    submit: "Enviar postulación",
    submitting: "Enviando…",
    successTitle: "Postulación recibida.",
    successBody:
      "Te respondemos en cinco días hábiles. Si entras, te llega un magic link al portal.",
    sizeOptions: [
      { value: "under_5m", label: "Menos de $5M" },
      { value: "5m_25m", label: "$5M – $25M" },
      { value: "25m_50m", label: "$25M – $50M" },
      { value: "50m_100m", label: "$50M – $100M" },
      { value: "over_100m", label: "Más de $100M" },
    ],
    regionOptions: [
      { value: "miami", label: "Miami" },
      { value: "monterrey", label: "Monterrey" },
      { value: "bogota", label: "Bogotá" },
      { value: "panama_city", label: "Ciudad de Panamá" },
      { value: "mexico_city", label: "Ciudad de México" },
      { value: "other_us", label: "Otro (EE.UU.)" },
      { value: "other_latam", label: "Otro (LATAM)" },
      { value: "other", label: "Otro" },
    ],
  },
  signIn: {
    title: "Ingresar",
    sub: "Solo magic links. No guardamos contraseñas.",
    email: "Correo de miembro",
    submit: "Enviar magic link",
    check: "Revisa tu correo. El link expira en 10 minutos.",
  },
  member: {
    welcome: "Bienvenido de vuelta.",
    latestIssue: "Última edición",
    yourPreferences: "Tus preferencias",
    askAssistant: "Preguntarle a la IA",
    upcomingConvenings: "Próximos encuentros",
    noUpcoming: "Aún no hay encuentros en agenda.",
  },
  preferences: {
    title: "Preferencias",
    sub: "Ajusta lo que aparece en tu edición semanal.",
    language: "Idioma preferido",
    region: "Región principal",
    industry: "Industria",
    role: "Cargo",
    pillarsInterest: "Pilares que me interesan",
    save: "Guardar preferencias",
    saved: "Guardado.",
  },
  archive: {
    title: "Archivo",
    sub: "Todas las ediciones. Bilingüe. Filtrable por pilar e idioma.",
    search: "Buscar en el archivo",
    filterPillar: "Pilar",
    filterLang: "Idioma",
    noResults: "Ninguna edición coincide.",
  },
  ask: {
    title: "Pregúntale a la IA de Transformación",
    sub: "Anclada en el archivo y en el Voice Bible. Cada respuesta cita las ediciones de donde sale.",
    placeholder: "Pregunta sobre estrategia, modelo operativo, tecnología o gestión del cambio…",
    send: "Enviar",
    thinking: "Pensando…",
    sources: "Fuentes",
    emptyState: "Empieza una conversación nueva. Lo que preguntes queda privado en tu cuenta.",
  },
  convenings: {
    title: "Encuentros",
    sub: "Cenas y working groups de miembros en el corredor US-LATAM.",
    rsvp: "Confirmar",
    rsvped: "Confirmado",
    capacityFull: "Sala llena — únete a la waitlist",
  },
  admin: {
    applications: "Postulaciones",
    pending: "Pendientes",
    approve: "Aprobar",
    reject: "Rechazar",
    waitlist: "Waitlist",
    approved: "Aprobado",
    rejected: "Rechazado",
    waitlisted: "En waitlist",
  },
};

export const dict: Record<Lang, Dict> = { en, es };

export function t(lang: Lang): Dict {
  return dict[lang];
}
