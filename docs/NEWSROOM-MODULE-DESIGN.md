> **Implementation Note - 2026-06-02:** `/newsroom` was implemented as an independent route group with scoped terracotta/serif CSS. The nested newsroom layout wraps children with `.newsroom-layout` but does not render `SiteHeader`/`SiteFooter` directly because the root app layout already renders them globally; duplicating them would create double header/footer output.
# Newsroom Module Design — Garry's List-Inspired Implementation

**Document Purpose:** Comprehensive implementation guide for the `/newsroom` module, a separate editorial-first experience styled after Garry's List. This document serves as the authoritative source for design decisions, file structure, component specifications, and verification procedures.

**Status:** Ready for implementation | Last Updated: 2026-06-01

---

## 1. Vision & Context

### 1.1 Project Overview

**The Transformation Letter** is a bilingual (EN/ES) weekly newsletter for owner-operators ($5M–$100M) across six adjacent topics. The existing portal (`/`) serves both feed browsing and member sign-in, using a dark theme with orange CTAs that match the editorial brand.

**New Module Goal:** Create a parallel `/newsroom` experience that emphasizes editorial **voice, typography, and visual hierarchy** — inspired by Garry's List (terracota + serif + white space) — while reusing the same data (`editions_public` view) and maintaining zero changes to existing member routes (`/archive`, `/me`, `/convenings`).

### 1.2 Why Separate Module (Not Redesign-in-Place)

| Approach | Trade-off |
|---|---|
| **Separate `/newsroom` module** | More files, but zero risk to existing portal; A/B testing possible; independent iteration |
| **Redesign existing `/`** | Fewer files, but breaking change risk; forced migration for existing member UX |

**Decision:** Separate module. Rationale: The portal is production-used by members; the newsroom is editorial-first and serves the public. Keeping them separate allows each to evolve independently per audience needs. A future navbar switcher lets users choose their experience.

### 1.3 Garry's List Design Inspiration

| Element | Source | Our Adaptation |
|---|---|---|
| **Color** | Terracota (#B35C42 or warm rust) | Primary accent (headings, pillars, hovers) |
| **Typography** | Serif (Georgia, high x-height serif) | Headlines + body text (serif stack) |
| **Layout** | Generous white space, narrow column widths | Max-w-2xl hero, grid cards with breathing room |
| **Editorial voice** | Curator's note + byline prominence | Bylines front-and-center, curator introduction |
| **Navigation** | Topic pills / subnav floating over content | Topic bar as sticky subnav; "latest in X" framing |
| **Call-to-action** | Understated, context-aware | "Apply now" CTA blends into the feed |

**What we DON'T copy:** We retain our brand identity (logo, primary domain voice). We adopt Garry's List's *aesthetic and editorial sensibility* but stay true to The Transformation Letter's own identity.

---

## 2. Design System & CSS Architecture

### 2.1 Color Palette

**Primary tokens for `/newsroom`:**

```css
/* Garry's List-inspired palette */
--color-newsroom-terracotta: #B35C42;   /* Primary: headings, accents */
--color-newsroom-light-rust: #C97957;   /* Hover: slightly lighter rust */
--color-newsroom-cream: #FBF7F0;        /* Background: warm off-white */
--color-newsroom-dark: #2A2420;         /* Text: dark brown (not pure black) */
--color-newsroom-muted: #7A6F68;        /* Secondary text: muted brown */
--color-newsroom-border: #E8DFD5;       /* Borders: light beige */

/* Keep for hierarchy / secondary accents */
--color-newsroom-orange: #FD7014;       /* Apply CTA only (consistency with portal) */
```

**Implementation:** Add to `portal/styles/newsroom.css` (new file, scoped to `.newsroom-layout`).

### 2.2 Typography Stack

**Primary typeface:** Serif (Garry's List uses Georgia as primary)

```css
/* Headlines (h1, h2, .heading-*) */
font-family: Georgia, "Times New Roman", serif;
font-weight: 700; /* bold */
letter-spacing: -0.01em;
line-height: 1.15;

/* Body text */
font-family: Georgia, "Times New Roman", serif;
font-size: 1rem; /* 16px base */
font-weight: 400;
line-height: 1.6;
color: var(--color-newsroom-dark);

/* Code / monospace (unchanged) */
font-family: "Monaco", "Menlo", monospace;
```

**Rationale:** Georgia is a web-safe serif with strong x-height and excellent readability on screens. Falls back to Times New Roman on older browsers.

### 2.3 Tailwind CSS Integration (Newsroom Layer)

Since `/newsroom` uses Tailwind 4 (same as portal, via `@theme` in `globals.css`), we extend the existing theme rather than override:

**New tokens in `portal/styles/newsroom.css`:**

```css
@layer theme {
  --color-newsroom-primary: #B35C42;
  --color-newsroom-accent: #C97957;
  --color-newsroom-bg: #FBF7F0;
  --color-newsroom-text: #2A2420;
  --color-newsroom-muted: #7A6F68;
  --color-newsroom-border: #E8DFD5;
}

/* Custom utility classes for newsroom context */
@layer utilities {
  .newsroom-header {
    @apply font-serif text-[var(--color-newsroom-dark)] leading-tight;
  }
  
  .newsroom-heading-display {
    @apply font-serif text-4xl font-bold tracking-tight mb-4 text-[var(--color-newsroom-primary)];
  }
  
  .newsroom-heading-section {
    @apply font-serif text-2xl font-bold text-[var(--color-newsroom-dark)] mb-2;
  }
  
  .newsroom-pill {
    @apply inline-block px-3 py-1 text-xs font-medium rounded-full 
           bg-[var(--color-newsroom-terracotta)] text-white;
  }
  
  .newsroom-card {
    @apply border border-[var(--color-newsroom-border)] p-6 rounded-lg 
           bg-white hover:shadow-md transition-shadow;
  }
}
```

**Why layer-based:** Keeps styles scoped to newsroom context without polluting global Tailwind. Easy to disable if needed.

### 2.4 Font Import

Add to `portal/app/newsroom/layout.tsx`:

```tsx
import { Geist, Geist_Mono } from "next/font/google";

const georgia = Georgia({
  subsets: ["latin"],
  display: "swap",
});

// or use system serif fallback:
const serif = {
  fontFamily: "Georgia, 'Times New Roman', serif",
};
```

Alternatively (minimal deps): Rely on OS serif stack without Google Fonts import.

---

## 3. File Structure

### 3.1 Directory Layout

```
portal/
├── app/
│   ├── layout.tsx                      # Root layout (unchanged)
│   ├── page.tsx                        # Portal homepage (unchanged)
│   ├── newsroom/
│   │   ├── layout.tsx                  # NEW: Newsroom layout (wraps with CSS + navbar)
│   │   ├── page.tsx                    # NEW: Newsroom homepage (hero + feed)
│   │   ├── [editionId]/
│   │   │   └── page.tsx                # NEW: Newsroom edition detail (public read)
│   │   └── topic/
│   │       └── [topicId]/
│   │           └── page.tsx            # NEW: Newsroom topic filter
│   │
│   ├── edition/                        # Portal member detail (unchanged)
│   │   └── [editionId]/
│   │       └── page.tsx
│   └── [other routes unchanged]
│
├── components/
│   ├── newsroom/                       # NEW: Newsroom-specific components
│   │   ├── NewsroomHeroArticle.tsx
│   │   ├── NewsroomArticleCard.tsx
│   │   ├── NewsroomChannelBar.tsx
│   │   ├── NewsroomFeedLatest.tsx
│   │   ├── NewsroomApplyCta.tsx
│   │   ├── NewsroomHeader.tsx          # NEW: Curator intro / byline highlight
│   │   └── types.ts
│   │
│   └── [existing components, unchanged]
│
├── styles/
│   ├── globals.css                     # Root Tailwind (unchanged)
│   └── newsroom.css                    # NEW: Newsroom color / typography overrides
│
└── lib/
    └── [existing helpers, unchanged]
```

### 3.2 New Files to Create (Summary)

| File | Purpose |
|---|---|
| `portal/styles/newsroom.css` | Terracota palette, serif typography, custom utilities |
| `portal/app/newsroom/layout.tsx` | Root newsroom layout (applies CSS, renders navbar) |
| `portal/app/newsroom/page.tsx` | Newsroom homepage (query `editions_public`, render hero + feed + curator intro) |
| `portal/app/newsroom/[editionId]/page.tsx` | Edition detail (public read, no paywall) |
| `portal/app/newsroom/topic/[topicId]/page.tsx` | Topic filter page |
| `portal/components/newsroom/NewsroomHeroArticle.tsx` | Styled hero (terracota headings, serif body) |
| `portal/components/newsroom/NewsroomArticleCard.tsx` | Card variant (terracota pillar, generous padding) |
| `portal/components/newsroom/NewsroomChannelBar.tsx` | Topic nav (sticky, terracota active state) |
| `portal/components/newsroom/NewsroomFeedLatest.tsx` | Feed grid (newsroom-styled) |
| `portal/components/newsroom/NewsroomApplyCta.tsx` | Apply CTA (integrated into feed narrative) |
| `portal/components/newsroom/NewsroomHeader.tsx` | Curator introduction section (top of homepage) |
| `portal/components/newsroom/types.ts` | Type definitions (reuse from `components/newsroom/types.ts` if possible) |

---

## 4. Component Specifications

All newsroom components are **server components** (no `"use client"`). They receive `lang: Lang` and resolve EN/ES inline.

### 4.1 NewsroomHeader.tsx

**Purpose:** Curator introduction; establishes editorial voice at top of homepage.

**Props:**
```tsx
export function NewsroomHeader({ lang }: { lang: Lang }) {
  // Display a curator's note: "Welcome to The Transformation Letter newsroom..."
  // Bilingual i18n keys: `newsroom.curatorGreeting` (EN/ES)
}
```

**Design:**
- Max-width container: `max-w-2xl`
- Serif body text, generous padding (`py-12` vertical)
- Optional hero image (curator photo?) — placeholder for now
- Byline: "By Wadi Bardawil" (serif italic)

**Sample JSX:**
```tsx
<section className="newsroom-section py-16 border-b border-[var(--color-newsroom-border)]">
  <div className="max-w-2xl mx-auto px-6">
    <p className="newsroom-pill mb-4">Editorial</p>
    <h1 className="newsroom-heading-display">{i18n.newsroom.curatorGreeting}</h1>
    <p className="text-lg leading-relaxed text-[var(--color-newsroom-muted)] mb-6">
      {i18n.newsroom.curatorSubtitle}
    </p>
    <p className="text-sm italic text-[var(--color-newsroom-muted)]">
      {lang === "es" ? "Por Wadi Bardawil" : "By Wadi Bardawil"}
    </p>
  </div>
</section>
```

### 4.2 NewsroomChannelBar.tsx

**Purpose:** Topic navigation; sticky at top when scrolling.

**Props:**
```tsx
export function NewsroomChannelBar({
  active,
  lang,
  allLabel,
}: {
  active?: string;
  lang: Lang;
  allLabel: string;
}) {
  // Render TOPICS as clickable pills
  // Active topic highlighted with terracota bg
}
```

**Design:**
- Sticky top with `sticky top-0 z-10`
- Background: `bg-[var(--color-newsroom-cream)]` (warm off-white)
- Pills styled with terracota accent when active: `[active ? 'bg-[var(--color-newsroom-terracotta)] text-white' : '']`
- Horizontal scroll on mobile, wrapped on desktop

**Sample JSX:**
```tsx
<nav className="sticky top-0 z-10 bg-[var(--color-newsroom-cream)] border-b border-[var(--color-newsroom-border)]">
  <div className="container-wide py-4 flex gap-3 overflow-x-auto">
    <Link
      href="/newsroom"
      className={`newsroom-pill px-4 py-2 transition-colors ${
        !active
          ? "bg-[var(--color-newsroom-terracotta)] text-white"
          : "bg-white text-[var(--color-newsroom-terracotta)] border border-[var(--color-newsroom-terracotta)]"
      }`}
    >
      {allLabel}
    </Link>
    {TOPICS.map((topic) => (
      <Link
        key={topic.id}
        href={`/newsroom/topic/${topic.id}`}
        className={`newsroom-pill px-4 py-2 transition-colors whitespace-nowrap ${
          active === topic.id
            ? "bg-[var(--color-newsroom-terracotta)] text-white"
            : "bg-white text-[var(--color-newsroom-terracotta)] border border-[var(--color-newsroom-terracotta)]"
        }`}
        aria-current={active === topic.id ? "page" : undefined}
      >
        {lang === "es" ? topic.es : topic.en}
      </Link>
    ))}
  </div>
</nav>
```

### 4.3 NewsroomHeroArticle.tsx

**Purpose:** Featured (most recent) article; large hero with image or typography fallback.

**Props:**
```tsx
export function NewsroomHeroArticle({
  item,
  lang,
  labels,
}: {
  item: NewsroomItem;
  lang: Lang;
  labels: Dict["newsroom"];
}) {
  // Hero article with serif typography, terracota accents
}
```

**Design:**
- Full-width section with background: `bg-[var(--color-newsroom-cream)]`
- Hero image (if exists): max-width `max-w-3xl` centered, aspect ratio `16/9`
- Without image: typographic hero (large serif heading + pull-quote)
- Terracota channel pill + edition number
- Pull-quote in serif, slightly larger than body
- Byline + date in muted brown
- CTA button: orange (`bg-[var(--color-newsroom-orange)]`) with serif label

**Sample JSX:**
```tsx
<section className="bg-[var(--color-newsroom-cream)] py-16 lg:py-20">
  <div className="max-w-4xl mx-auto px-6">
    {item.hero_image_url ? (
      <Link href={`/newsroom/${item.edition_id}`} className="block mb-8">
        <Image
          src={item.hero_image_url}
          alt={title}
          width={800}
          height={450}
          className="w-full rounded-lg object-cover aspect-[16/9]"
          priority
        />
      </Link>
    ) : null}

    <div className="mb-4 flex gap-2">
      <span className="newsroom-pill">{topicLabel(item.topic, lang)}</span>
      <span className="text-xs text-[var(--color-newsroom-muted)]">#{item.edition_number}</span>
    </div>

    <Link href={`/newsroom/${item.edition_id}`} className="no-underline">
      <h1 className="newsroom-heading-display">{title}</h1>
    </Link>

    {excerpt ? (
      <p className="text-xl italic text-[var(--color-newsroom-muted)] mb-6 leading-relaxed">
        {excerpt}
      </p>
    ) : null}

    <div className="flex gap-3 text-sm text-[var(--color-newsroom-muted)] mb-6">
      {item.byline ? <span>By {item.byline}</span> : null}
      {item.byline_role ? <span>·</span> : null}
      {item.byline_role ? <span>{item.byline_role}</span> : null}
      {date ? <span>·</span> : null}
      {date ? <span>{date}</span> : null}
    </div>

    <Link href={`/newsroom/${item.edition_id}`} className="btn bg-[var(--color-newsroom-orange)] text-white px-6 py-2 rounded">
      {labels.readMore} →
    </Link>
  </div>
</section>
```

### 4.4 NewsroomArticleCard.tsx

**Purpose:** Individual article card in grid; minimal thumbnail, strong typography.

**Props:**
```tsx
export function NewsroomArticleCard({
  item,
  lang,
}: {
  item: NewsroomItem;
  lang: Lang;
}) {
  // Card with optional image, serif heading, byline
}
```

**Design:**
- `.newsroom-card` utility: `border border-[var(--color-newsroom-border)] p-6 rounded-lg bg-white hover:shadow-md`
- Small thumbnail (if `hero_image_url`): `w-24 h-24 object-cover rounded`
- Terracota channel pill
- Serif heading (h3)
- Excerpt (2–3 lines, muted text)
- Byline + date (small, muted)

**Sample JSX:**
```tsx
<article className="newsroom-card">
  {item.hero_image_url ? (
    <Image
      src={item.hero_image_url}
      alt={title}
      width={96}
      height={96}
      className="w-24 h-24 object-cover rounded mb-4"
    />
  ) : null}

  <div className="mb-3">
    <span className="newsroom-pill text-xs">{topicLabel(item.topic, lang)}</span>
  </div>

  <Link href={`/newsroom/${item.edition_id}`} className="no-underline">
    <h3 className="newsroom-heading-section text-lg mb-2 hover:text-[var(--color-newsroom-accent)]">
      {title}
    </h3>
  </Link>

  {excerpt ? (
    <p className="text-sm text-[var(--color-newsroom-muted)] mb-3 line-clamp-2">
      {excerpt}
    </p>
  ) : null}

  <div className="text-xs text-[var(--color-newsroom-muted)]">
    {item.byline ? <span>{item.byline}</span> : null}
    {date ? <span className="block mt-1">{date}</span> : null}
  </div>
</article>
```

### 4.5 NewsroomFeedLatest.tsx

**Purpose:** Grid of recent articles; reusable for homepage and topic pages.

**Props:**
```tsx
export function NewsroomFeedLatest({
  items,
  lang,
  labels,
  channelFiltered,
}: {
  items: NewsroomItem[];
  lang: Lang;
  labels: Dict["newsroom"];
  channelFiltered: boolean;
}) {
  // Grid of cards, empty state if needed
}
```

**Design:**
- Section heading: `newsroom-heading-section` (serif, terracota if appropriate)
- Grid: `grid gap-6 sm:grid-cols-2 lg:grid-cols-3`
- Empty state: muted text + "browse all" link

**Sample JSX:**
```tsx
<section className="py-12 border-t border-[var(--color-newsroom-border)]">
  <div className="max-w-6xl mx-auto px-6">
    <h2 className="newsroom-heading-section mb-8">{labels.latest}</h2>

    {items.length > 0 ? (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <NewsroomArticleCard key={item.edition_id} item={item} lang={lang} />
        ))}
      </div>
    ) : (
      <div className="text-[var(--color-newsroom-muted)]">
        <p>{channelFiltered ? labels.emptyChannel : labels.empty}</p>
        {channelFiltered ? (
          <Link href="/newsroom" className="btn btn-ghost mt-4">
            {labels.allChannels}
          </Link>
        ) : null}
      </div>
    )}
  </div>
</section>
```

### 4.6 NewsroomApplyCta.tsx

**Purpose:** Call-to-action to join the newsletter; woven into feed narrative.

**Design:**
- Integrated section (not standalone block)
- Terracota heading, serif body
- Orange CTA button
- Reuseuse i18n keys from `landing.audienceHeading/audienceBody/primaryCta`

### 4.7 NewsroomLayout.tsx

**Purpose:** Root layout for `/newsroom/*` routes.

**Design:**
- Import `newsroom.css` (adds terracota palette + typography)
- Render `<body className="newsroom-layout">`
- SiteHeader (unchanged, but logo may highlight "Newsroom" state)
- SiteFooter (unchanged)

**Sample:**
```tsx
import "@/styles/newsroom.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function NewsroomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body className="newsroom-layout bg-white text-[var(--color-newsroom-dark)]">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
```

---

## 5. Route Structure & Implementation

### 5.1 Route Map

| Route | Component | Purpose |
|---|---|---|
| `/newsroom` | `page.tsx` | Newsroom homepage (hero + feed) |
| `/newsroom/[editionId]` | `[editionId]/page.tsx` | Edition detail (public read, no paywall) |
| `/newsroom/topic/[topicId]` | `topic/[topicId]/page.tsx` | Topic-filtered feed |

### 5.2 Homepage `/newsroom/page.tsx`

**Logic:**
1. Get `lang` from cookies (`getLangFromCookies()`)
2. Get `topic` from optional query param (`searchParams`)
3. Query `editions_public` (limit 13, order by published_at desc, filter by topic if set)
4. Partition into `[hero, ...latest]`
5. Render: ChannelBar → Header → HeroArticle → FeedLatest → ApplyCta

**Data source:**
```tsx
const supabase = await getSupabaseServerClient();
const { data: items } = await supabase
  .from("editions_public")
  .select(NEWSROOM_SELECT)
  .order("published_at", { ascending: false })
  .limit(13)
  .then((res) => (topic ? res.eq("topic", topic) : res));
```

### 5.3 Edition Detail `/newsroom/[editionId]/page.tsx`

**Logic:**
1. Query `editions_public` for the edition (exposes title, excerpt, byline, pillar, hero image)
2. If not found, 404
3. Render: ChannelBar → title + meta → hero image (if exists) → excerpt + CTA to "Apply to read full analysis"
4. If user is authenticated member → fetch full body from `editions` (member-gated RLS)

**Design difference from `/edition/[id]`:**
- Public version shows excerpt only
- No full body rendering (paywalled)
- Prominent "Apply" CTA instead of "Read more"

### 5.4 Topic Filter `/newsroom/topic/[topicId]/page.tsx`

**Logic:**
1. Validate `topicId` against `TOPIC_IDS`
2. Query `editions_public` filtered by topic
3. Render same structure as homepage but with `channelFiltered=true`

---

## 6. i18n Keys (Additions)

Add to `portal/lib/i18n/dictionary.ts` under existing `newsroom` key:

```ts
newsroom: {
  featured: "Featured",
  latest: "Latest Issues",
  allChannels: "All",
  readMore: "Read More",
  byMembers: "Members-only analysis",
  empty: "No editions published yet.",
  emptyChannel: "No issues in this channel.",
  resetChannel: "Browse all",
  curatorGreeting: "Welcome to The Transformation Letter",
  curatorSubtitle: "Diagnostics for owner-operators...",
  // ES
}
```

**Spanish (es):**
```ts
newsroom: {
  featured: "Destacado",
  latest: "Ediciones recientes",
  allChannels: "Todos",
  readMore: "Leer más",
  byMembers: "Análisis solo para miembros",
  empty: "Sin ediciones publicadas aún.",
  emptyChannel: "Sin ediciones en este canal.",
  resetChannel: "Ver todos",
  curatorGreeting: "Bienvenido a The Transformation Letter",
  curatorSubtitle: "Diagnósticos para dueños de empresas...",
}
```

---

## 7. Implementation Roadmap (Step-by-Step)

### Phase 1: CSS & Layout Foundation

1. **Create `portal/styles/newsroom.css`** with terracota palette, serif typography, utilities
2. **Create `portal/app/newsroom/layout.tsx`** with CSS import, SiteHeader/Footer wrapper
3. **Test:** Verify `/newsroom` loads and applies CSS (blank page with terracota bg is success)

### Phase 2: Components

4. **Create `portal/components/newsroom/types.ts`** (type definitions, NEWSROOM_SELECT constant, helpers)
5. **Create `portal/components/newsroom/NewsroomHeader.tsx`** (curator intro)
6. **Create `portal/components/newsroom/NewsroomChannelBar.tsx`** (topic nav with terracota pills)
7. **Create `portal/components/newsroom/NewsroomHeroArticle.tsx`** (hero with serif heading + image)
8. **Create `portal/components/newsroom/NewsroomArticleCard.tsx`** (grid card with thumbnail)
9. **Create `portal/components/newsroom/NewsroomFeedLatest.tsx`** (grid container)
10. **Create `portal/components/newsroom/NewsroomApplyCta.tsx`** (call-to-action)

### Phase 3: Routes

11. **Create `portal/app/newsroom/page.tsx`** (homepage: query editions_public, compose components)
12. **Create `portal/app/newsroom/[editionId]/page.tsx`** (edition detail: hero + excerpt + Apply CTA)
13. **Create `portal/app/newsroom/topic/[topicId]/page.tsx`** (topic filter: same as homepage but filtered)

### Phase 4: i18n & Polish

14. **Update `portal/lib/i18n/dictionary.ts`** (add newsroom keys + translations)
15. **Test EN/ES:** LangToggle cookie changes labels
16. **Test hover states, responsive layouts**
17. **Validate all `as Route` casts typecheck**

### Phase 5: Verification & Docs

18. **End-to-end testing (see section 8 below)**
19. **Update KNOWLEDGE_BASE.md with newsroom module documentation**
20. **Optional: Add navbar switcher between `/` and `/newsroom` experiences**

---

## 8. End-to-End Verification Checklist

### 8.1 Visual / UX Verification

- [ ] `/newsroom` loads with terracota palette (headings, pills, accents are rust-colored, not orange)
- [ ] Typography is serif (Georgia fallback) on headlines and body text (not system sans)
- [ ] Hero article renders with large serif heading, pull-quote, and byline
- [ ] Hero image displays (or typography fallback if no image)
- [ ] Channel bar sticks to top when scrolling, active topic highlighted in terracota
- [ ] Article cards have generous padding, clear hierarchy, optional thumbnails
- [ ] Empty state message + "Browse all" link appear when channel has no issues

### 8.2 Interactivity Verification

- [ ] `/newsroom` loads hero + 3 latest cards (seed data)
- [ ] `/newsroom/topic/business_transformation` shows only BT issues
- [ ] `/newsroom/topic/invalid_topic` behaves like All (no error)
- [ ] `/newsroom/topic/family_office` with no issues shows empty state + reset link
- [ ] Channel bar pills are clickable and navigate correctly
- [ ] All article links (`/newsroom/[id]`) navigate to edition detail

### 8.3 Edition Detail Verification

- [ ] `/newsroom/2026-21` (existing edition) displays:
  - Hero image (if exists) or typographic hero
  - Title, excerpt, byline, date
  - "Apply to read full analysis" CTA
- [ ] Member (authenticated) on same route fetches full body via RLS
- [ ] Non-member sees excerpt only (no body leak)

### 8.4 Bilingual Verification

- [ ] `/newsroom` in EN: headings, labels, curator greeting are English
- [ ] Cookie `tl_lang=es` → all labels switch to Spanish
- [ ] Edition details: title, excerpt, byline in correct language
- [ ] No missing i18n keys (check console/build for warnings)

### 8.5 Responsive Design Verification

- [ ] Mobile (320px): ChannelBar pills wrap/scroll, hero image stacks, cards single-column
- [ ] Tablet (768px): Cards 2-column, hero image scales
- [ ] Desktop (1024px+): Cards 3-column, layout full-width with max-width constraints

### 8.6 Performance Verification

- [ ] `next build` completes with no errors (all `as Route` casts valid)
- [ ] `/newsroom` loads fast (server-rendered, no JS hydration overhead)
- [ ] Lighthouse > 90 on `/newsroom` (LCP from server-rendered hero)
- [ ] Images optimized (Next.js image component with `sizes`, priority on hero)

### 8.7 Data Integrity Verification

- [ ] `/newsroom` queries `editions_public` (not `editions`), no RLS violation
- [ ] Member-gated `/archive` and `/me` routes remain unchanged
- [ ] No data leak: non-members cannot access full edition body from `/newsroom`

### 8.8 No-Regression Verification

- [ ] Existing portal (`/`) unchanged and functional
- [ ] SiteHeader, SiteFooter, LangToggle work in both `/` and `/newsroom`
- [ ] Member sign-in on `/newsroom` redirects to member dashboard
- [ ] `/archive` and `/archive/[id]` still require authentication

---

## 9. Maintenance & Future Enhancements

### 9.1 Content Scaling

**Current assumption:** Newsroom homepage shows 13 most-recent editions (hero + 12 latest). As content grows:
- Consider pagination (load more / infinite scroll)
- Consider "Most Read" section (requires view_count tracking)
- Consider topic-specific recommended reading

### 9.2 Design Iterations

- **A/B testing:** Future navbar switcher allows testing `/` vs `/newsroom` UX
- **Dark mode:** Newsroom currently light (terracota + cream). Could add dark variant if brand evolves
- **Newsletter signup:** Could embed signup form in ApplyCta (currently links to `/apply`)

### 9.3 Analytics Integration

- Track clicks from `/newsroom` to `/apply` (funnel)
- Track topic page traffic (editorial interest signals)
- Track newsletter signup from newsroom vs portal

### 9.4 Editor Guidance

Ensure Designer agent (or future Curator UI) is aware:
- Newsroom uses terracota for visual hierarchy (not orange)
- Hero images should crop to 16:9 for consistent rendering
- Pull-quotes (excerpts) should be under 100 chars for display balance

---

## 10. Code Examples (Complete Snippets)

### 10.1 newsroom.css (Full File)

```css
/* portal/styles/newsroom.css */

@layer theme {
  --color-newsroom-terracotta: #B35C42;
  --color-newsroom-light-rust: #C97957;
  --color-newsroom-cream: #FBF7F0;
  --color-newsroom-dark: #2A2420;
  --color-newsroom-muted: #7A6F68;
  --color-newsroom-border: #E8DFD5;
  --color-newsroom-orange: #FD7014;
}

@layer utilities {
  .newsroom-header {
    @apply font-serif text-[var(--color-newsroom-dark)] leading-tight;
  }

  .newsroom-heading-display {
    @apply font-serif text-4xl font-bold tracking-tight text-[var(--color-newsroom-terracotta)];
  }

  .newsroom-heading-section {
    @apply font-serif text-2xl font-bold text-[var(--color-newsroom-dark)];
  }

  .newsroom-pill {
    @apply inline-block px-3 py-1 text-xs font-medium rounded-full 
           bg-[var(--color-newsroom-terracotta)] text-white;
  }

  .newsroom-card {
    @apply border border-[var(--color-newsroom-border)] p-6 rounded-lg 
           bg-white hover:shadow-md transition-shadow;
  }

  .newsroom-section {
    @apply py-12 lg:py-16;
  }
}

/* Body text default for newsroom context */
.newsroom-layout {
  font-family: Georgia, "Times New Roman", serif;
}

.newsroom-layout h1,
.newsroom-layout h2,
.newsroom-layout h3 {
  font-family: Georgia, "Times New Roman", serif;
}
```

### 10.2 Example Component Structure

All components share this pattern:

```tsx
import { type Lang, type Dict } from "@/lib/i18n/dictionary";
import type { NewsroomItem } from "./types";
import { pickLang, itemTitle, itemExcerpt, itemDate } from "./types";

export function NewsroomExample({
  item,
  lang,
  labels,
}: {
  item: NewsroomItem;
  lang: Lang;
  labels: Dict["newsroom"];
}) {
  const title = itemTitle(item, lang);
  const excerpt = itemExcerpt(item, lang);
  const date = itemDate(item, lang);

  return (
    <section className="newsroom-section">
      <h2 className="newsroom-heading-section">{title}</h2>
      {/* component JSX */}
    </section>
  );
}
```

---

## 11. Known Limitations & Decisions

| Limitation | Reason | Workaround |
|---|---|---|
| No "Most Read" section | No view_count in schema | Track in analytics layer; add to schema v2 |
| No newsletter signup embed | CTA links to `/apply` | Future: iframe signup form in ApplyCta |
| No dark mode | Brand is light-first | Add `newsroom-dark.css` if brand evolves |
| Single layout (no multi-column) | Prioritize readability over density | Future: sidebar for topic/author filtering |
| No comments / reader engagement | Out of scope for v1 | Future: add Supabase real-time comments table |

---

## 12. Testing & Debugging

### 12.1 Local Development

```bash
cd portal

# Install dependencies (if not done)
pnpm install

# Start dev server
pnpm dev

# Visit http://localhost:3000/newsroom
# Test: Hero renders, pills are terracota, fonts are serif
```

### 12.2 Build Verification

```bash
# Type check
pnpm tsc --noEmit

# Build (catches missing i18n keys, type errors)
pnpm build

# Test routes exist (no [404] errors in output)
# Look for: "Route (app)/newsroom" in build summary
```

### 12.3 Common Issues & Fixes

| Issue | Cause | Fix |
|---|---|---|
| Heading text is orange, not terracotta | CSS layer precedence | Ensure `newsroom.css` imports in layout, not page |
| Pills don't have rounded corners | Tailwind purge | Verify `rounded-full` class isn't overridden |
| Serif font not loading | Georgia not available | Check CSS fallback stack in browser DevTools |
| i18n key missing | Typo in key name | Search codebase for key; check dictionary.ts spelling |
| `as Route` type error | Dynamic route not in typedRoutes | Verify page exists at path; rebuild `.next/types` |
| Empty newsroom | No data in editions_public | Check Supabase: migration 0005 applied, is_published=true |

---

## 13. Documentation & Handoff

This document is the **single source of truth** for the newsroom module. Future agents should:

1. Read section 1 (Vision) to understand the "why"
2. Reference section 3 (File Structure) for where things go
3. Use section 4 (Component Specs) as implementation guide
4. Follow section 7 (Roadmap) for step-by-step execution
5. Use section 8 (Verification) to confirm success

**Do NOT** guess at design decisions. If something is unclear, refer back to this document or the main CLAUDE.md project brief.

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| **editions_public** | Supabase view exposing body-free columns to anon users (created by migration 0004/0005) |
| **Terracotta** | Primary newsroom color (#B35C42); warm rust accent used in headings, pills, hovers |
| **Garry's List** | Editorial publication inspiration; known for terracota palette, serif typography, generous white space |
| **Server component** | React component with no `"use client"` directive; rendered on server; no JS shipped to browser |
| **RLS (Row Level Security)** | Supabase feature to restrict table access per user; bypassed by admin client (for publish) |
| **i18n key** | String token in dictionary (e.g., `newsroom.featured`) resolved to EN or ES text via language cookie |
| **typedRoutes** | Next.js feature requiring `as Route` casts for dynamic href strings to typecheck |

---

## Appendix B: Color Reference

**Hex codes for copy-paste:**

```
Terracotta primary:    #B35C42
Light rust (hover):    #C97957
Cream (background):    #FBF7F0
Dark brown (text):     #2A2420
Muted brown (meta):    #7A6F68
Light beige (border):  #E8DFD5
Orange (CTA only):     #FD7014
```

**RGB for design tools:**

```
Terracotta: rgb(179, 92, 66)
Cream:      rgb(251, 247, 240)
Dark:       rgb(42, 36, 32)
```

---

**End of Document**

*This document was created on 2026-06-01 and should be updated whenever significant design or architectural changes are made to the newsroom module.*
