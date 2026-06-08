# Plan — "Approve and publish" → módulo del portal + newsroom estilo Garry's List

> Plan aprobado para mover el receptor de aprobación del Cloudflare Worker al portal,
> publicar las ediciones aprobadas directo a Supabase, y construir un newsroom público
> parcial estilo Garry's List. Restricción dura: **no romper nada de lo que ya funciona**.

## Context

Hoy el botón **"Approve and publish"** del correo de digest apunta a un **Cloudflare Worker**
(`workers/approval-receiver`) que verifica un token HMAC firmado y dispara
`repository_dispatch: edition_approved` → el workflow `publish-to-beehiiv.yml` corre
`pnpm publish:edition`, que hace **dual-publish**: Beehiiv + Supabase
(`mirrorEditionToPortal()` en `src/utils/portal-sync.ts`). El portal ya lee esas ediciones
en `/archive` y `/archive/[editionId]`, **pero restringido a miembros activos** vía RLS.

**Objetivo (decisiones del usuario):**
1. **Mover el receptor de aprobación al portal** (reemplazar el Worker). El portal verifica el token y **publica directo a Supabase** (sin Beehiiv en el camino de un clic).
2. **Newsroom público parcial estilo Garry's List:** anon ve titulares/extractos; el cuerpo completo queda para miembros.
3. **Alcance:** módulo de aprobación/publicación **+** rediseño newsroom completo (homepage hero / Latest / Most Read / Top Stories / canales).

**Restricción dura:** *no romper nada de lo que ya funciona* — no se borra el Worker ni `publish-to-beehiiv.yml`, no se tocan las políticas RLS de miembros existentes, no se re-arquitectura el i18n actual.

> **Nota de paridad importante:** el `body_en/body_es` que se guarda en Supabase se renderiza desde las **secciones del `-draft.json`** (`renderLocalizedToMarkdown`), NO desde los `.md` que edita el editor en el portal. Para mantener el comportamiento actual, el publish del portal también parte del `-draft.json`. (Mejora futura: publicar desde los `.md` editados.)

> **Bonus:** apuntar `APPROVAL_BASE_URL` al dominio real del portal en Vercel (host resoluble y confiable) **también corrige** el bug de render del botón que veíamos antes (el `[.../approve?…]` roto venía de un host no resoluble/placeholder).

---

## Fase 1 — Aprobación + publish directo a Supabase desde el portal

### 1.1 Verificación de token en el portal
- Nuevo `portal/lib/approval-token.ts`: portar `verifyApprovalToken` desde `src/utils/approval-token.ts` (mismo base64url + HMAC-SHA256 con `node:crypto`, para que los tokens ya firmados validen). Mantener idéntico el formato `body.sig` y los checks de `exp`, `decision==="approve"`, `editionId`.
- Env requerido en el portal/Vercel: `APPROVAL_SIGNING_SECRET` (mismo valor que firma el digest).

### 1.2 Mapeo de edición (reutilizar lógica probada)
- Nuevo `portal/lib/edition-mapping.ts`: portar las funciones **puras** `editionNumberFromId`, `normalizeTopic`, `buildEditionRow`, `buildSourceRows` desde `src/utils/portal-sync.ts` y `renderLocalizedToMarkdown` desde `src/utils/edition-markdown.ts`. Son ~120 líneas puras; se replican porque el portal se despliega standalone (no puede importar `../src`). **Deben mantenerse en sync** con `/src`.

### 1.3 Leer el draft aprobado desde GitHub
- Extender `portal/lib/github.ts` (ya tiene `fetchDraftFile`) para leer de la rama `drafts/<edition>` los archivos `<edition>-draft.json` y `<edition>-sources.json`. Reusar el manejo de errores `GitHubError`.
- Env ya presentes para el editor de drafts: `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_DRAFT_BRANCH_PREFIX`.

### 1.4 Publish directo (lib + endpoint)
- Nuevo `portal/lib/publish-edition.ts`: arma el `MirrorInput` desde `-draft.json` (+ `-sources.json`), aplica **quality gate** (replicar el check de `publish-to-beehiiv.yml`: `validation.isValid === true` y score ≥ `QA_MIN_SCORE`, default 70) y hace `upsert` en `editions` (onConflict `edition_id`) + reemplazo de `edition_sources`, usando el **admin client** (`portal/lib/supabase/admin.ts`, service role, bypassa RLS). `is_published=true`, `published_at=now`.
- Nuevo route handler **`portal/app/approve/route.ts`** (`GET /approve?t=<token>`), `export const runtime = "nodejs"`:
  - Verifica el token (1.1). El **token ES la autorización** — sin sesión (se toca desde el correo en el celular).
  - Si válido → llama `publishEdition(editionId)`; devuelve página HTML de confirmación (success / expirado / inválido / quality-gate-falló / error), replicando las respuestas del Worker (`workers/approval-receiver/src/index.ts`).
  - Idempotente (el `upsert` lo es), igual que el Worker; replay dentro de 7 días = sin regresión vs. hoy.

### 1.5 Abrir `/approve` en el middleware
- En `portal/middleware.ts`: añadir `/approve` a las rutas **públicas exentas** (como ya se exenta `/api/ask`). Cuidar de NO abrir `/admin` ni rutas de miembro.

### 1.6 Reapuntar el botón (reemplazar el Worker)
- Cambiar el secret de GitHub Actions `APPROVAL_BASE_URL` al origen del portal **incluyendo basePath** (p. ej. `https://<portal-vercel>/letter`), de modo que `buildApprovalLink` genere `<portal>/approve?t=…`. **No requiere cambio de código** en `src/scripts/send-draft-digest.ts`.
- El Worker y `publish-to-beehiiv.yml` quedan **intactos** (publicación a Beehiiv sigue disponible vía `workflow_dispatch` manual). Nada se borra.

---

## Fase 2 — Newsroom público estilo Garry's List (acceso parcial)

### 2.1 Acceso público parcial (migración aditiva — no toca RLS de miembros)
- Nueva migración `portal/supabase/migrations/0004_public_editions.sql`:
  - Crear **vista** `editions_public` que exponga SOLO columnas seguras (sin `body_en/body_es`): `edition_id, edition_number, published_at, subject_en/es, topic, pillar, quarterly_theme, shareable_sentence_en/es, byline, byline_role`, filtrada por `is_published = true`.
  - `grant select on editions_public to anon, authenticated;` Validar el modo de seguridad de la vista en Supabase (`security_invoker`) para que anon lea publicadas sin exponer la base. **Las políticas existentes de `editions` (miembros) NO se modifican** → la lectura completa sigue gated.

### 2.2 Rutas públicas (sin gate) — sin tocar las de miembro
- **Homepage `/`** (ya es pública): rediseñar a feed newsroom desde `editions_public`.
- Nueva **página de artículo pública** `portal/app/edition/[editionId]/page.tsx`: header + extracto para anon; si hay sesión de miembro activo → cuerpo completo (leído de `editions` con la política de miembro); si no → CTA "Aplica / Inicia sesión para leer completo".
- **Se conservan** `/archive` y `/archive/[editionId]` tal cual (miembros) → cero riesgo de romper lo actual; convergencia posible después.
- Middleware: NO añadir las rutas públicas a `MEMBER_PREFIXES`.

### 2.3 Sistema de diseño / componentes (estética Garry's List, marca propia)
- Componentes nuevos en `portal/components/newsroom/`: `HeroArticle`, `ArticleCard`, `ChannelTag`, `FeedLatest`, `FeedMostRead`, `FeedTopStories`, `NewsletterCTA`, navbar con filtro de canales (= topics) + selector de idioma.
- **Marca:** reutilizar los tokens visuales actuales del portal (wadibardawil.com), **no** el terracota de Garry's List (el KNOWLEDGE_BASE pide identidad propia).
- **i18n:** reutilizar el patrón actual basado en cookie + `/lang` (`portal/lib/i18n`). **Mantener** este patrón; NO migrar a rutas `/es//en/` (cambio estructural que toca todas las rutas y arriesga romper lo existente — migración futura opcional con hreflang).
- Canales/topics: usar `portal/lib/topics.ts` (fuente única). Filtro por `?topic=` como ya hace `/archive`.

### 2.4 "Most Read" — requiere conteo de vistas (hoy no existe)
- El portal no trackea page views (los `-metrics.json` son aperturas/clics de Beehiiv, no del portal). Opciones para v1:
  - **(simple)** Sustituir "Most Read" por "Featured"/"Latest" hasta tener datos, **o**
  - Añadir `editions.view_count int default 0` + un RPC `increment_edition_view(edition_id)` llamado al abrir el artículo.
- Decisión recomendada: arrancar con "Featured/Latest" y dejar el contador como mejora incremental.

---

## Archivos críticos

**Nuevos (Fase 1):** `portal/lib/approval-token.ts`, `portal/lib/edition-mapping.ts`, `portal/lib/publish-edition.ts`, `portal/app/approve/route.ts`.
**Modificados (Fase 1):** `portal/lib/github.ts` (leer `-draft.json`/`-sources.json`), `portal/middleware.ts` (exentar `/approve`), secret `APPROVAL_BASE_URL` (config, no código).
**Nuevos (Fase 2):** `portal/supabase/migrations/0004_public_editions.sql`, `portal/app/edition/[editionId]/page.tsx`, `portal/components/newsroom/*`, rediseño de `portal/app/page.tsx`.

**Reutilizar (no reescribir):** mapeo de `src/utils/portal-sync.ts` + `src/utils/edition-markdown.ts`; verificación de `src/utils/approval-token.ts`; cliente admin/server de Supabase; `topics.ts`; `markdown.ts`; i18n; `lib/site.ts` (basePath/URL).

---

## Qué NO se toca (garantía de no-ruptura)
- `workers/approval-receiver` y `.github/workflows/publish-to-beehiiv.yml` → intactos (Beehiiv vía dispatch manual sigue funcionando).
- `src/publish.ts`, `src/utils/portal-sync.ts` → sin cambios.
- Políticas RLS existentes de `editions`/miembros → sin cambios (solo se añade vista pública).
- Rutas de miembro (`/archive`, `/me`, `/convenings`) e i18n por cookie → sin cambios.
- `send-draft-digest.ts` → sin cambios (solo se reapunta un secret).

---

## Verificación (end-to-end)

**Fase 1**
1. Local: con `APPROVAL_SIGNING_SECRET`, firmar un token con `buildApprovalLink` y abrir `/approve?t=…` en el portal dev → confirmar `upsert` en `editions` (`is_published=true`) + `edition_sources`, y página de éxito.
2. Quality gate: token de una edición con `validation.isValid=false` o score < umbral → página de rechazo, sin publicar.
3. Token expirado/firma inválida → página de error, sin publicar.
4. E2E: correr `weekly-draft` con `APPROVAL_BASE_URL` = dominio Vercel del portal, tocar el botón del correo → confirmar publicación y que el botón ahora renderiza bien.
5. Regresión: `publish-to-beehiiv.yml` por `workflow_dispatch` sigue publicando a Beehiiv; `/archive` de miembros intacto.

**Fase 2**
6. Anon en `/` y `/edition/[id]` → ve titulares/extracto, NO el cuerpo; miembro activo → cuerpo completo.
7. Filtro por canal/topic e idioma (ES/EN) funcionan; hreflang/meta presentes.
8. Lighthouse > 90 (perf/accesibilidad) en homepage y artículo.

**Tests (vitest):** unit para `edition-mapping.ts` (espejo de los tests existentes de `portal-sync`), verificación de token, y el quality gate del endpoint `/approve`.

---

## Notas / riesgos a confirmar en ejecución
- **Edits del editor vs. publish desde JSON:** hoy se publica desde secciones del `-draft.json`, no desde los `.md` editados. Se mantiene esa paridad; mejora futura: publicar desde `.md`.
- **Seguridad de la vista pública:** validar el modo `security_invoker`/grants para exponer solo columnas seguras a anon.
- **Sin sesión en `/approve`:** el token firmado es la única autorización (igual que el Worker hoy). Sin protección de replay dentro de la TTL de 7 días (sin regresión).
