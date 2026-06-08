# Implementación del Módulo Newsroom — Prompt de Delegación para Agente de IA

## Executive Summary

Implementar un módulo **completamente independiente** (`/newsroom`) con diseño visual Garry's List (terracota + serif typography + white space), que comparta datos con el portal existente pero **sin modificar nada del portal actual** (`/`).

**Especificaciones:** 
- Documentación de diseño: `docs/NEWSROOM-MODULE-DESIGN.md` (13 secciones, 3,000+ líneas)
- Documentación del proyecto: `KNOWLEDGE_BASE.md` (sección 14.5) + `CLAUDE.md`
- Timeline: 20 pasos, 5 fases, ~1–2 horas de implementación
- Verificación: 40+ checklist items (visual, interactiva, bilingual, responsive, performance)

---

## Contexto del Proyecto

### The Transformation Letter — Newsletter Automatizado

- **Propósito:** Sistema multi-agente IA que genera ediciones semanales (diagnósticos).
- **Audiencia:** Owner-operators $5–100M en corredor US-LATAM.
- **6 temas:** Business Transformation, Conscious Capital, Family Business, Family Office, AI, Technology.
- **Portal existente:** Next.js 15 + Supabase, acceso gated para miembros, dark theme + naranja CTA.
- **Fase 1-2 (completas):** Approve + publish directo, acceso público parcial, homepage newsroom-style.

### Por Qué Este Módulo

El portal actual (`/`) tiene arquitectura newsroom pero visual diferente a Garry's List. La propuesta: crear `/newsroom` separado con diseño Garry's List (terracota + serif + white space) **sin romper nada existente**. Ambos modules leen desde la misma vista Supabase (`editions_public`).

---

## Especificación de Diseño (Resumen Ejecutivo)

### Paleta de Color

```css
--color-newsroom-terracotta: #B35C42;   /* Primary accent */
--color-newsroom-light-rust: #C97957;   /* Hover state */
--color-newsroom-cream: #FBF7F0;        /* Background */
--color-newsroom-dark: #2A2420;         /* Text (dark brown, not pure black) */
--color-newsroom-muted: #7A6F68;        /* Secondary text */
--color-newsroom-border: #E8DFD5;       /* Borders */
--color-newsroom-orange: #FD7014;       /* CTA only (consistency) */
```

### Tipografía

- **Headlines:** Georgia (serif), bold, tight line-height
- **Body:** Georgia (serif), 400 weight, 1.6 line-height
- **Fallback:** "Times New Roman", serif; system monospace for code

### Componentes Principales

1. **NewsroomHeader** — Curator intro (top of homepage)
2. **NewsroomChannelBar** — Topic nav (sticky, terracota active state)
3. **NewsroomHeroArticle** — Featured edition (serif heading, image or typography fallback)
4. **NewsroomArticleCard** — Grid card (thumbnail, channel pill, byline, date)
5. **NewsroomFeedLatest** — Feed grid (3-column desktop, responsive)
6. **NewsroomApplyCta** — Conversion CTA (reutiliza `landing` i18n keys)

### Rutas

```
/newsroom                          Homepage (hero + feed)
/newsroom?topic=<id>              Filtro por tema
/newsroom/[editionId]             Artículo detail (excerpt + apply CTA)
/newsroom/topic/[topicId]         Ruta de tema explícita
```

---

## Arquitectura de Archivos

### Archivos Nuevos a Crear (12 archivos)

```
portal/
├── styles/
│   └── newsroom.css                            # Paleta + typography + utilities
│
├── app/newsroom/
│   ├── layout.tsx                              # Root newsroom layout (CSS import)
│   ├── page.tsx                                # Homepage
│   ├── [editionId]/
│   │   └── page.tsx                            # Artículo detail
│   └── topic/
│       └── [topicId]/
│           └── page.tsx                        # Topic filter page
│
└── components/newsroom/
    ├── types.ts                                # Interfaces + NEWSROOM_SELECT + helpers
    ├── NewsroomHeader.tsx
    ├── NewsroomChannelBar.tsx
    ├── NewsroomHeroArticle.tsx
    ├── NewsroomArticleCard.tsx
    ├── NewsroomFeedLatest.tsx
    └── NewsroomApplyCta.tsx
```

### Archivos a Modificar (1 archivo)

```
portal/lib/i18n/dictionary.ts                  # Add newsroom keys (EN/ES)
```

### Prerequisitos (Que ya existen)

- ✅ `portal/supabase/migrations/0005_public_editions_hero.sql` — vista pública con `hero_image_url`
- ✅ `portal/lib/supabase/types.ts` — type `EditionPublicRow` (incluye `hero_image_url`)
- ✅ `portal/lib/topics.ts` — TOPICS array con los 6 temas
- ✅ Supabase RLS — public `editions_public` readable por anon

---

## Roadmap de Implementación (20 Pasos)

### Fase 1 — CSS & Layout Foundation (2 pasos)

**Paso 1: Crear `portal/styles/newsroom.css`**
- Define color theme (terracotta, cream, dark brown, etc.)
- Define typography utilities (`.newsroom-heading-display`, `.newsroom-pill`, etc.)
- Define component utilities (`.newsroom-card`, `.newsroom-section`)
- ~100 líneas usando `@layer theme` + `@layer utilities`
- **Reference:** `docs/NEWSROOM-MODULE-DESIGN.md` sección 2 + Appendix B (full code example)

**Paso 2: Crear `portal/app/newsroom/layout.tsx`**
- Import `newsroom.css`
- Wrap with `<body className="newsroom-layout">`
- Import + render `SiteHeader`, `SiteFooter` (shared components)
- ~30 líneas, simple structure
- **Reference:** `docs/NEWSROOM-MODULE-DESIGN.md` sección 4.7

**Verification:** Visit `/newsroom` in dev server → should load with terracota colors, serif fonts. (Will be blank content at this point — that's OK.)

---

### Fase 2 — Components (6 pasos)

**Paso 3: Crear `portal/components/newsroom/types.ts`**
- Export `type NewsroomItem = Pick<EditionPublicRow, ...>` (relevant columns)
- Export `const NEWSROOM_SELECT = "..."` (columns list for query)
- Export helper functions: `pickLang()` (EN/ES fallback), `itemTitle()`, `itemExcerpt()`, `itemDate()`
- ~40 líneas
- **Reference:** `docs/NEWSROOM-MODULE-DESIGN.md` sección 4.0

**Paso 4: Crear `portal/components/newsroom/NewsroomHeader.tsx`**
- Server component: `export function NewsroomHeader({ lang }: { lang: Lang })`
- Curator intro section (top of homepage)
- Use i18n keys: `newsroom.curatorGreeting`, `newsroom.curatorSubtitle`
- Use utilities: `.newsroom-section`, `.newsroom-heading-display`, `.newsroom-pill`
- ~50 líneas
- **Reference:** `docs/NEWSROOM-MODULE-DESIGN.md` sección 4.1

**Paso 5: Crear `portal/components/newsroom/NewsroomChannelBar.tsx`**
- Server component: `export function NewsroomChannelBar({ active, lang, allLabel })`
- Sticky nav: `sticky top-0 z-10 bg-[var(--color-newsroom-cream)]`
- Render All pill + 6 TOPICS pills
- Active = `bg-[var(--color-newsroom-terracotta)] text-white`, inactive = outlined
- Links: `href="/"` (All), `href="/newsroom/topic/${id}"` (topics), cast with `as Route`
- ~60 líneas
- **Reference:** `docs/NEWSROOM-MODULE-DESIGN.md` sección 4.2

**Paso 6: Crear `portal/components/newsroom/NewsroomHeroArticle.tsx`**
- Server component: `export function NewsroomHeroArticle({ item, lang, labels })`
- Featured (most recent) edition
- If `hero_image_url` → `next/image` with `fill`, `sizes`, `priority`, `aspect-[16/9]`
- If NO image → typographic hero (large heading, pull-quote, no broken image)
- Render: channel pill (terracota), large h1 (serif, terracota), excerpt, byline, date, CTA button
- ~100 líneas
- **Reference:** `docs/NEWSROOM-MODULE-DESIGN.md` sección 4.3

**Paso 7: Crear `portal/components/newsroom/NewsroomArticleCard.tsx`**
- Server component: `export function NewsroomArticleCard({ item, lang })`
- Grid card for feed (`.newsroom-card` utility)
- If `hero_image_url` → thumbnail `w-24 h-24` (only if exists, no broken images)
- Channel pill (terracota), title (h3, hover effect), excerpt, byline, date
- ~70 líneas
- **Reference:** `docs/NEWSROOM-MODULE-DESIGN.md` sección 4.4

**Paso 8: Crear `portal/components/newsroom/NewsroomFeedLatest.tsx`**
- Server component: `export function NewsroomFeedLatest({ items, lang, labels, channelFiltered })`
- Grid container: `grid gap-6 sm:grid-cols-2 lg:grid-cols-3`
- Map `items` → `NewsroomArticleCard`
- Empty state: if `items.length === 0` → muted text + "Browse all" link (if `channelFiltered`)
- ~60 líneas
- **Reference:** `docs/NEWSROOM-MODULE-DESIGN.md` sección 4.5

---

### Fase 3 — Routes (3 pasos)

**Paso 9: Crear `portal/app/newsroom/page.tsx`**
- Homepage
- Get `lang` from cookies (`getLangFromCookies()`)
- Get `topic` from searchParams (optional filter)
- Query `editions_public`: select NEWSROOM_SELECT cols, order published_at desc, limit 13
- If `topic` provided → validate against `TOPIC_IDS`, filter by `.eq("topic", topic)`
- Partition into `const [hero, ...latest] = items`
- Render composition:
  1. `<NewsroomChannelBar active={activeTopic} ... />`
  2. `{hero ? <NewsroomHeroArticle item={hero} ... /> : <EmptyState />}`
  3. `{hero ? <NewsroomFeedLatest items={latest} ... /> : null}`
  4. (Optional: condensed coverage section — see `page.tsx` lines 69-87 in portal for reference)
  5. `<NewsroomApplyCta lang={lang} />`
- ~80 líneas
- **Reference:** `docs/NEWSROOM-MODULE-DESIGN.md` sección 5.2

**Paso 10: Crear `portal/app/newsroom/[editionId]/page.tsx`**
- Edition detail (public read)
- Query `editions_public` for single edition
- If not found → 404
- Render: ChannelBar + hero image (if exists) + title + excerpt + byline + date
- CTA: "Aplicar para leer análisis completo" (instead of "Read more")
- If user is authenticated member → optionally fetch full body from `editions` (RLS-gated)
- ~60 líneas
- **Reference:** `docs/NEWSROOM-MODULE-DESIGN.md` sección 5.3

**Paso 11: Crear `portal/app/newsroom/topic/[topicId]/page.tsx`**
- Topic filter page
- Validate `topicId` against `TOPIC_IDS` → 404 if invalid
- Query `editions_public` filtered: `.eq("topic", topicId)`
- Render same structure as homepage but with `channelFiltered=true` flag
- Empty state: "No issues in this channel" + reset to All link
- ~50 líneas
- **Reference:** `docs/NEWSROOM-MODULE-DESIGN.md` sección 5.4

---

### Fase 4 — i18n & Polish (2 pasos)

**Paso 12: Actualizar `portal/lib/i18n/dictionary.ts`**
- Add `newsroom` key to `type Dict` (TypeScript interface)
- Add `newsroom` translations in `en` object
- Add `newsroom` translations in `es` object
- Keys needed:
  ```
  featured, latest, allChannels, readMore, byMembers, empty, 
  emptyChannel, resetChannel, curatorGreeting, curatorSubtitle
  ```
- ~30 líneas new code
- **Reference:** `docs/NEWSROOM-MODULE-DESIGN.md` sección 6

**Paso 13: Crear `portal/components/newsroom/NewsroomApplyCta.tsx`**
- Conversion CTA block
- Reutiliza `t(lang).landing.audienceHeading/audienceBody/primaryCta` (NO nuevas claves)
- Section with terracota heading, serif body, orange CTA button
- Link: `href="/apply"`
- ~40 líneas
- **Reference:** `docs/NEWSROOM-MODULE-DESIGN.md` sección 4.6

---

### Fase 5 — Verificación E2E (5 pasos)

**Paso 14: Build Verification**
```bash
cd portal
pnpm tsc --noEmit    # No TypeScript errors
pnpm build            # Build passes (all `as Route` casts valid)
```
✅ If both succeed → proceed

**Paso 15: Visual Verification (Manual)**
- `pnpm dev` → http://localhost:3000/newsroom
- [ ] Headings, pills, accents are terracota (NOT orange)
- [ ] Typography is serif (Georgia fallback)
- [ ] Hero article renders with large heading
- [ ] Channel bar sticks to top on scroll
- [ ] Article cards have generous padding, no stretched images
- [ ] Empty state appears correctly

**Paso 16: Interactivity Verification (Manual)**
- [ ] `/newsroom` loads hero + 3 latest cards (with seed data)
- [ ] `/newsroom?topic=business_transformation` filters correctly
- [ ] Channel bar pills navigate to `/newsroom/topic/[id]`
- [ ] `/newsroom/topic/family_office` shows empty state (no data) + "Browse all" link
- [ ] `/newsroom/2026-21` (or any seed edition ID) loads article detail
- [ ] Article detail shows excerpt, NOT full body (unless member)

**Paso 17: Bilingual Verification**
- [ ] Default: `/newsroom` shows English labels (Featured, Latest, Apply, etc.)
- [ ] Change cookie `tl_lang=es` (via DevTools or LangToggle)
- [ ] Refresh → labels switch to Spanish (Destacado, Ediciones recientes, Aplicar)
- [ ] Article titles/excerpts appear in Spanish (if seed data is bilingual)
- [ ] No console warnings about missing i18n keys

**Paso 18: Responsive & Performance Verification**
- [ ] Mobile (320px): ChannelBar wraps/scrolls, cards stack 1-column
- [ ] Tablet (768px): Cards 2-column, hero scales
- [ ] Desktop (1024px+): Cards 3-column, full layout
- [ ] Lighthouse `/newsroom` → Performance ≥ 90, Accessibility ≥ 95
- [ ] LCP < 2.5s (hero is priority-loaded via `next/image`)

**Paso 19: No-Regression Verification**
- [ ] Portal homepage (`/`) — still dark theme, naranja CTAs, works identically
- [ ] `/archive` — member auth still required, layout unchanged
- [ ] `/me` — works as before
- [ ] SiteHeader, SiteFooter, LangToggle — render correctly in both `/` and `/newsroom`
- [ ] Member sign-in on `/newsroom` redirects to `/me`

**Paso 20: Documentation & Sign-Off**
- [ ] Update `KNOWLEDGE_BASE.md` section 14.5 → mark status as ✅ Implementado
- [ ] Record any deviations from design spec in a comment at top of `NEWSROOM-MODULE-DESIGN.md`
- [ ] Tag commit with `feat(newsroom): launch garry-list-inspired module`

---

## Data Source & Queries

### Supabase Table/View

- **View:** `editions_public` (already exists, migration 0005 applied)
- **Columns:** 
  ```
  edition_id, edition_number, published_at, 
  subject_en, subject_es,
  topic, pillar, quarterly_theme,
  shareable_sentence_en, shareable_sentence_es,
  byline, byline_role,
  hero_image_url
  ```
- **Filters:** `is_published = true` (only published editions visible)
- **RLS:** Public readable (anon user can query without session)
- **Type:** `EditionPublicRow` (defined in `portal/lib/supabase/types.ts`)

### Query Example (for reference)

```typescript
const supabase = await getSupabaseServerClient();
const { data: items } = await supabase
  .from("editions_public")
  .select("edition_id, edition_number, published_at, subject_en, subject_es, topic, pillar, shareable_sentence_en, shareable_sentence_es, byline, byline_role, hero_image_url")
  .order("published_at", { ascending: false })
  .limit(13)
  .then((res) => topic ? res.eq("topic", topic) : res);
```

---

## Key Implementation Notes

### 1. Server Components Only (No `"use client"`)

All newsroom components are server components. They:
- Accept `lang: Lang` and resolve EN/ES inline
- Do NOT have client-side state
- Query Supabase on server (no network waterfalls)

Example pattern:
```tsx
export function NewsroomExample({
  item,
  lang,
}: {
  item: NewsroomItem;
  lang: Lang;
}) {
  const title = itemTitle(item, lang);  // EN or ES based on lang
  return <h2>{title}</h2>;
}
```

### 2. TypeScript `as Route` Casts

Dynamic hrefs must be cast as `Route` for typed routes:
```tsx
const href = `/newsroom/topic/${id}` as Route;
<Link href={href}>...</Link>
```

### 3. Tailwind Class Names

Use **existing** portal classes when possible:
- `.card` → use `.newsroom-card` (or create new in newsroom.css)
- `.btn` → use `.btn` (existing, works in newsroom context)
- `.pill` → use `.newsroom-pill` (new, terracota-specific)

Keep Tailwind hygiene: prefer utility classes + custom utilities in `newsroom.css`, NOT inline styles.

### 4. Image Optimization

Use `next/image` always:
```tsx
<Image
  src={item.hero_image_url}
  alt={title}
  fill
  priority  // for hero (LCP)
  sizes="(max-width: 1024px) 100vw, 58vw"
  className="object-cover"
/>
```

Host allowlist already configured in `next.config.ts` for `**.supabase.co` and `images.beehiiv.com`.

### 5. Empty State Handling

- If `hero_image_url` is `null` → render typographic hero (heading + pull-quote), NOT broken `<img>`
- If no editions in channel → show muted text + "Browse all" link
- Never show blank page or console errors for missing data

---

## i18n Keys to Add

In `portal/lib/i18n/dictionary.ts`, add to `type Dict`:

```typescript
newsroom: {
  featured: string;           // "Featured" / "Destacado"
  latest: string;             // "Latest Issues" / "Ediciones recientes"
  allChannels: string;        // "All" / "Todos"
  readMore: string;           // "Read More" / "Leer más"
  byMembers: string;          // "Members-only analysis" / "Análisis solo para miembros"
  empty: string;              // "No editions published yet." / "Sin ediciones publicadas aún."
  emptyChannel: string;       // "No issues in this channel." / "Sin ediciones en este canal."
  resetChannel: string;       // "Browse all" / "Ver todos"
  curatorGreeting: string;    // "Welcome to The Transformation Letter" / ...
  curatorSubtitle: string;    // Long intro text
};
```

Add corresponding values in `en` and `es` objects.

---

## Common Pitfalls & Solutions

| Pitfall | Solution |
|---|---|
| Colors too dark → headings hard to read | Use terracota `#B35C42`, not darker shades. Test contrast in browser. |
| Serif fonts not loading | Georgia is web-safe. Verify `@import` in newsroom.css or inline `font-family` stack. |
| Images stretched/distorted | Use `object-cover` + `aspect-[16/9]` on hero. Test responsive with DevTools. |
| Empty channel shows blank page | Render empty state with muted text + reset link (see FeedLatest component). |
| TypeScript error on dynamic href | Cast to `as Route`, e.g., `` `/newsroom/${id}` as Route ``. Rebuild `.next/types`. |
| i18n key missing from build | Verify key added to BOTH `type Dict` AND `en`/`es` objects in dictionary.ts. |
| `next/image` host not recognized | Check `next.config.ts` allows Supabase/Beehiiv domains. |
| Component renders but newsroom layout not applied | Ensure `newsroom.css` is imported in `layout.tsx` BEFORE `children`. |
| Animations or transitions lag | Keep animations minimal. Avoid parallax or expensive CSS transforms. |

---

## Testing Checklist (40+ Items)

**Full checklist in** `docs/NEWSROOM-MODULE-DESIGN.md` **section 8.**

**Quick smoke test (5 min):**
- [ ] `/newsroom` loads
- [ ] Typography is serif
- [ ] Colors are terracota (not orange)
- [ ] `/newsroom?topic=business_transformation` filters
- [ ] Empty channel shows proper state

**Full E2E test (20 min):**
- [ ] Visual verification (colors, spacing, fonts)
- [ ] Interactivity (clicks, filters, navigation)
- [ ] Bilingual (EN/ES switching)
- [ ] Responsive (mobile/tablet/desktop)
- [ ] Performance (Lighthouse > 90)
- [ ] Data integrity (no RLS leaks)
- [ ] No-regression (portal works)

---

## Reference Documents

| Document | Purpose |
|---|---|
| `docs/NEWSROOM-MODULE-DESIGN.md` | **Complete specification** (13 sections, 3,000+ lines). Reference for design system, components, verification, code examples. |
| `KNOWLEDGE_BASE.md` section 14.5 | Project context + what already exists + what won't change. |
| `CLAUDE.md` | Project overview (The Transformation Letter, editorial mandate, tech stack). |
| `.next/types/index.d.ts` | TypeScript path types (generated at build time) — regenerated after new routes. |

---

## Success Criteria

✅ **Implementation is complete when:**

1. All 12 new files created (CSS + routes + components)
2. 1 file modified (i18n dictionary)
3. `pnpm build` succeeds (no TypeScript errors)
4. `/newsroom` loads with terracota/serif design
5. Homepage shows hero + latest cards (with seed data)
6. Channel filter works (`?topic=<id>`)
7. Article detail page accessible (`/newsroom/[id]`)
8. EN/ES bilingual switching works
9. Responsive on mobile/tablet/desktop
10. Lighthouse Performance ≥ 90
11. Portal (`/`) unchanged and fully functional
12. No console errors or TypeScript warnings

---

## Handoff Notes

This prompt is **self-contained**. The implementing agent should:

1. **Read** this prompt (you're doing it)
2. **Skim** `docs/NEWSROOM-MODULE-DESIGN.md` (especially sections 2–4)
3. **Reference** `KNOWLEDGE_BASE.md` 14.5 for context
4. **Follow** Roadmap steps 1–20 sequentially
5. **Verify** against E2E checklist (section 8 of design doc)
6. **Report** completion with summary of what was built

If anything is unclear, **reference the design document section by section** — it has full code examples and rationale for every decision.

**You've got this. 🚀**

---

*Prompt generated: 2026-06-01*  
*Design document:** `docs/NEWSROOM-MODULE-DESIGN.md`  
*Project context:** `KNOWLEDGE_BASE.md` section 14.5 + `CLAUDE.md`
