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
    coverageHeading: string;
    coverageSub: string;
    sequenceHeading: string;
    sequenceBody: string;
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
    topicsInterest: string;
    save: string;
    saved: string;
  };
  apply2: { topicsInterest: string; topicsInterestHelp: string };
  archive: { title: string; sub: string; search: string; filterTopic: string; filterLang: string; noResults: string; byline: string };
  ask: { title: string; sub: string; placeholder: string; send: string; thinking: string; sources: string; emptyState: string };
  convenings: { title: string; sub: string; rsvp: string; rsvped: string; capacityFull: string };
  admin: { applications: string; pending: string; approve: string; reject: string; waitlist: string; approved: string; rejected: string; waitlisted: string };
};

const en: Dict = {
  brand: {
    name: "The Transformation Letter",
    tagline:
      "Diagnostics for $5–100M owner-operators across business transformation, conscious capital, family business, family office, AI, and tech — in the US-LATAM corridor.",
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
    hero: "Diagnostics for the operator who runs the business, owns the capital, and carries the legacy.",
    filterSentence: "Your business is already running an OS — it was just built by accident, not by design.",
    subFilter: "Weekly diagnostics for owner-operators who have tried everything they know how to try.",
    primaryCta: "Apply to join",
    secondaryCta: "Read the archive",
    coverageHeading: "What we cover",
    coverageSub:
      "Six adjacent topics, one audience. Every issue ends in a concrete recommendation and the People-side shift it creates.",
    sequenceHeading: "The Business Transformation OS — three layers. One sequence.",
    sequenceBody:
      "Strategy before Operating Model. Operating Model before Technology. The sequence is the insight, and it anchors every transformation issue.",
    pillarStrategy: "Strategy OS",
    pillarStrategyBody: "Vision, value cases, prioritization, portfolio choices.",
    pillarOperating: "Operating Model OS",
    pillarOperatingBody: "Process redesign, governance, decision rights, structure.",
    pillarTech: "Technology OS",
    pillarTechBody: "Architecture, data, platforms, integration, security.",
    peopleHeading: "People is the always-on dimension — across every topic.",
    peopleBody:
      "Every recommendation names the human shift it creates — anchored in ADKAR, Kotter, or McKinsey 7S — because change-management is where most transformations actually fail.",
    audienceHeading: "Built for the owner-operator already in the room when the hard decisions get made.",
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
    topicsInterest: "Topics I care about most",
    save: "Save preferences",
    saved: "Saved.",
  },
  apply2: {
    topicsInterest: "Topics most relevant to you",
    topicsInterestHelp: "Pick any that fit. Drives what shows up first in your weekly issue.",
  },
  archive: {
    title: "Archive",
    sub: "Every issue. Bilingual. Filterable by topic and language.",
    search: "Search the archive",
    filterTopic: "Topic",
    filterLang: "Language",
    noResults: "No issues match.",
    byline: "by",
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
      "Diagnósticos para owner-operators de $5–100M sobre transformación de negocio, capital consciente, empresa familiar, family office, IA y tecnología — en el corredor US-LATAM.",
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
    hero: "Diagnósticos para el operador que dirige el negocio, es dueño del capital y carga el legado.",
    filterSentence:
      "Tu negocio ya está corriendo un OS — solo que se construyó por accidente, no por diseño.",
    subFilter:
      "Diagnósticos semanales para owner-operators que ya probaron todo lo que sabían cómo probar.",
    primaryCta: "Postular para entrar",
    secondaryCta: "Leer el archivo",
    coverageHeading: "Qué cubrimos",
    coverageSub:
      "Seis temas adyacentes, una sola audiencia. Cada edición termina en una recomendación concreta y el cambio humano que produce.",
    sequenceHeading: "El Business Transformation OS — tres capas. Una secuencia.",
    sequenceBody:
      "Estrategia antes que Modelo Operativo. Modelo Operativo antes que Tecnología. La secuencia es la idea, y ancla cada edición sobre transformación.",
    pillarStrategy: "Strategy OS",
    pillarStrategyBody: "Visión, casos de valor, priorización, portafolio.",
    pillarOperating: "Operating Model OS",
    pillarOperatingBody: "Procesos, gobierno, derechos de decisión, estructura.",
    pillarTech: "Technology OS",
    pillarTechBody: "Arquitectura, datos, plataformas, integración, seguridad.",
    peopleHeading: "La dimensión humana es permanente — en cada tema.",
    peopleBody:
      "Cada recomendación nombra el cambio humano que crea — anclado en ADKAR, Kotter o McKinsey 7S — porque la gestión del cambio es donde la mayoría de las transformaciones realmente fallan.",
    audienceHeading: "Para el owner-operator que ya está en la sala cuando se toman las decisiones difíciles.",
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
    topicsInterest: "Temas que me interesan",
    save: "Guardar preferencias",
    saved: "Guardado.",
  },
  apply2: {
    topicsInterest: "Temas más relevantes para ti",
    topicsInterestHelp: "Marca los que apliquen. Define qué aparece primero en tu edición semanal.",
  },
  archive: {
    title: "Archivo",
    sub: "Todas las ediciones. Bilingüe. Filtrable por tema e idioma.",
    search: "Buscar en el archivo",
    filterTopic: "Tema",
    filterLang: "Idioma",
    noResults: "Ninguna edición coincide.",
    byline: "por",
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
