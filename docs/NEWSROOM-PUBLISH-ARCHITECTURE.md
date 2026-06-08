# Arquitectura de Publicación: Newsroom Portal vs. Beehiiv

**Documento actualizado:** 2026-06-04  
**Estado:** Implementación de estrategia de publicación dual resuelta

---

## Cambio Principal: De Beehiiv-centric a Newsroom-centric

### Antes (Legacy)

```
Draft → Imagen (Gemini) → Email Revisión → Worker Cloudflare
  ↓
Worker verifica token → dispara GitHub Actions
  ↓
publish-to-beehiiv.yml → Beehiiv API
  ↓
Edición visible solo en Beehiiv
```

**Problemas:**
- Publicación depende de Cloudflare Worker (externo, legacy)
- Edición NO visible en portal propio
- Control editorial fragmentado

---

### Ahora (Nueva Estrategia)

```
Draft → Imagen (Vertex AI) → Storage (Supabase) → Email Revisión
  ↓
portal/app/review/route.ts (verificación de token)
  ↓
Aprobación Doble: image_approve + content_approve
  ↓
publishEdition() → Supabase (portal/newsroom)
  ↓
hero_image_url poblada → Edición visible en newsroom
  ↓
[OPCIONAL] workflow_dispatch: publish-to-beehiiv.yml → Beehiiv API
```

**Ventajas:**
- Publicación principal en **portal propio** (control completo)
- Beehiiv es distribución **opcional/adicional** (no bloqueante)
- Worker legacy **deprecado** en favor del portal
- Imagen visible desde la revisión hasta la publicación

---

## Flujo Detallado

### 1. Generación (GitHub Actions: weekly-draft.yml)

| Paso | Acción | Archivo |
|---:|---|---|
| 1 | Radar, Strategist, Writer, Validator, Localizer | draft.json |
| 2 | **Designer via Vertex AI** | hero-v1.png, designer.json |
| 3 | Upload a Supabase Storage | `edition-assets/<id>/hero-v1.png` |
| 4 | Quality Gate, Persistencia | review.json (status: pending) |
| 5 | Crear/actualizar PR drafts/<edition> | GitHub |

**Output:** Imagen pública + `review.json` con `image.publicUrl` y `image.status="pending"`

---

### 2. Revisión (Email via Resend)

| Sección | Contenido | Acciones |
|---|---|---|
| **Bloque Imagen** | Preview (URL pública), caption, alt text | [Aprobar] [Rechazar] |
| **Bloque Artículo** | Titular, extracto, QA score | [Aprobar] [Rechazar] |
| **Por Sección** | Insight, Field Report, Spotlight, etc. | [Rechazar sección] |

**Tokens Firmados:**
- `image_approve`, `image_reject`
- `content_approve`, `content_reject`
- `section_reject` (con sectionType)

---

### 3. Decisión (portal/app/review/route.ts)

```
GET /review?t=<signed-token>

Token verifica → Lee review.json → Valida transición → Ejecuta acción

Acción: image_approve
  ├─ Marca: image.status = "approved"
  ├─ Evento: timestamp, approver
  └─ Respuesta: "Imagen aprobada. Esperando artículo..."

Acción: image_reject
  ├─ Marca: image.status = "rejected/regenerating"
  ├─ Dispara: regenerate-image.yml (Designer v2)
  ├─ Evento: timestamp, reason
  └─ Respuesta: "Nueva imagen en generación..."

Acción: content_approve
  ├─ Verifica: image.status === "approved" (DEBE ser true)
  ├─ Si no: Respuesta error: "Espera aprobación de imagen primero"
  ├─ Si sí:
  │   ├─ Marca: content.status = "approved"
  │   ├─ Ejecuta: publishEdition(editionId)
  │   ├─ publishEdition():
  │   │   ├─ Lee: drafts/<id>-draft.json, -sources.json, -review.json
  │   │   ├─ Construye: EditionRow con hero_image_url = review.image.publicUrl
  │   │   ├─ Upsert: Supabase editions table
  │   │   └─ Resultado: Edición visible en /newsroom
  │   └─ Respuesta: "Publicado en newsroom ✅"

Acción: content_reject
  ├─ Marca: content.status = "rejected"
  ├─ Dispara: weekly-draft.yml (mismo edition)
  ├─ Evento: timestamp, reason, feedback
  └─ Respuesta: "Nuevo draft en generación. Imagen reseteada a pending."

Acción: section_reject
  ├─ Marca: section rechazado en rejection.json
  ├─ Dispara: weekly-draft.yml con feedback por sección
  ├─ Evento: sectionType, reason
  └─ Respuesta: "Sección rechazada. Regenerando..."
```

---

### 4. Publicación Principal (Supabase/Newsroom)

Ocurre cuando: `content_approve` DESPUÉS de `image_approve`

**No bloqueante para Beehiiv.** El portal publica de forma independiente.

```typescript
// portal/lib/publish-edition.ts
async function publishEdition(editionId: string) {
  const review = await loadReview(editionId);
  
  // Validación de aprobación doble
  if (review.image.status !== "approved") {
    throw PublishError("QUALITY_GATE", "Image not approved");
  }
  if (review.content.status !== "approved") {
    throw PublishError("QUALITY_GATE", "Content not approved");
  }
  
  // Mapeo + publicación
  const heroImageUrl = review.image.publicUrl;
  const editionRow = buildEditionRow({...draft, heroImageUrl});
  
  // Upsert a Supabase
  const { data, error } = await supabase
    .from("editions")
    .upsert(editionRow, { onConflict: "edition_id" });
  
  if (error) throw error;
  
  return { success: true, editionId, newsroomUrl: `/newsroom/${editionId}` };
}
```

**Resultado:**
- ✅ Edición en `editions` table
- ✅ `hero_image_url` poblada
- ✅ Visible en `/newsroom` (ruta pública)
- ✅ Visible en `/archive` (miembros)

---

### 5. Publicación Opcional: Beehiiv (Legacy/Manual)

Solo se ejecuta si el usuario lo solicita **manualmente** vía `workflow_dispatch`:

```bash
# Ejecutar SOLO si se desea Beehiiv (opcional)
gh workflow run publish-to-beehiiv.yml -f edition=2026-21
```

**Workflow verificará primero:**
- ¿Edición YA fue publicada a Supabase? (check: review.json tiene aprobación doble)
- ¿Imagen y contenido aprobados?
- Si NO → Error: "Primero publica a portal"
- Si SÍ → Publica a Beehiiv API como distribución adicional

**Nota:** Este paso es COMPLETAMENTE OPCIONAL. La edición está viva en el newsroom sin él.

---

## Flujos de Rechazo

### Rechazo de Imagen

```
image_reject (desde email/portal)
  ↓
Marca: image.status = "rejected/regenerating"
  ↓
Dispara: regenerate-image.yml
  ↓
Designer corre solo (reads draft.json)
  ↓
hero-v2.png generado (versión 2)
  ↓
Reenvia: email de revisión (nueva imagen)
  ↓
Usuario puede: image_approve (v2) o image_reject de nuevo (v3, etc.)
  ↓
Límite: MAX_IMAGE_REGEN_ATTEMPTS = 5
  └─ Si excede: Issue en GitHub pidiendo intervención humana
```

**Nota:** Contenido NO se resetea (user puede rechazar solo imagen)

---

### Rechazo de Contenido

```
content_reject (desde email/portal)
  ↓
Marca: content.status = "rejected"
  ↓
Dispara: weekly-draft.yml (COMPLETO: Strategist + Writer + Localizer + Designer)
  ↓
Imagen Y contenido se resetean a pending
  ↓
Nuevo intento: review.attempt += 1
  ↓
Reenvia: nuevo email de revisión
  ↓
Límite: MAX_CONTENT_REGEN_ATTEMPTS = 3
  └─ Si excede: Issue en GitHub
```

**Nota:** Todo reinicia (imagen incluida) porque el contenido nuevo puede requerir visualidad distinta

---

### Rechazo por Sección

```
section_reject (Insight, Field Report, Spotlight, etc.)
  ↓
Marca: rejectedSections = [{ type, reason }] en rejection.json
  ↓
Dispara: weekly-draft.yml con feedback estructurado
  ↓
Writer/Localizer reciben: "Insight rechazado: motivo = X"
  ↓
Genera nuevo draft con esa sección reescrita
  ↓
Imagen Y contenido se resetean a pending
```

**Nota:** Aunque se rechace una sola sección, TODO se regenera (imagen incluida)

---

## Caso de Uso: Trayectoria Completa

### Escenario 1: Happy Path

```
1. weekly-draft.yml genera draft v1 + imagen v1 ✓
2. Email enviado: "Revisar imagen y artículo"
3. Editor clica: [Aprobar imagen] ✓
   └─ Portal: image.status = "approved"
4. Editor clica: [Aprobar artículo] ✓
   └─ Portal: content.status = "approved" + publishEdition()
   └─ Supabase: editions.insert({..., hero_image_url: "url"})
   └─ Newsroom: ✓ Visible en /newsroom/2026-21
5. [OPCIONAL] Editor clica: "Publicar a Beehiiv también" (workflow_dispatch)
   └─ Beehiiv: ✓ Distribuido

Timeline: ~30 minutos (redondea a incluir regeneraciones mínimas)
```

---

### Escenario 2: Rechazo de Imagen

```
1. weekly-draft.yml genera draft v1 + imagen v1 ✓
2. Email enviado
3. Editor clica: [Rechazar imagen]
   └─ Portal: image.status = "regenerating"
   └─ Dispara: regenerate-image.yml
4. Designer corre (v2), imagen sube a Storage
5. Email reenviado: "Nueva imagen (intento 2)"
6. Editor clica: [Aprobar imagen v2] ✓
   └─ Contenido sigue siendo v1 (no se regeneró)
7. Editor clica: [Aprobar artículo]
   └─ Portal: publishEdition()
   └─ Supabase: hero_image_url = v2 URL

Timeline: ~45 minutos
```

---

### Escenario 3: Rechazo de Contenido

```
1. weekly-draft.yml genera draft v1 + imagen v1
2. Editor clica: [Aprobar imagen] ✓
3. Editor clica: [Rechazar artículo]
   └─ Portal: content.status = "rejected"
   └─ Dispara: weekly-draft.yml (COMPLETO)
4. Strategist + Writer + Localizer + Designer ejecutan
   └─ draft v2, imagen v2
   └─ review.json: reset image/content to pending, attempt=2
5. Email reenviado: "Nuevo draft (intento 2)"
6. Editor aprueba imagen v2 + artículo v2
   └─ Portal: publishEdition()

Timeline: ~2 horas
```

---

## Decisiones Arquitectónicas

| Decisión | Anteriormente | Ahora | Por qué |
|---|---|---|---|
| **Publicación principal** | Beehiiv (via Worker) | Supabase/Portal | Control propio, sin dependencias externas |
| **Ubicación de imagen** | Generada en CI, no hospedada | Supabase Storage (URL pública) | Durabilidad, versionado, HATEOAS |
| **Aprobación** | Binaria (approve) | Separada: imagen + contenido | Workflow editorial más granular |
| **Regeneración** | No existía | Imagen y contenido por separado | Eficiencia operativa |
| **Worker Cloudflare** | Receptor principal | Optional/deprecado | Portal es más confiable y controlable |
| **Beehiiv** | Destino principal | Distribución opcional | El newsroom es el canal principal |

---

## Variables de Entorno Clave

### Pipeline (root .env)

```bash
# Vertex AI
GOOGLE_CLOUD_PROJECT=<gcp-project>
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_IMAGE_MODEL=<model-name>

# Storage
SUPABASE_URL=<url>
SUPABASE_SERVICE_ROLE_KEY=<key>

# Email
RESEND_API_KEY=<key>
RESEND_FROM=<sender>

# Approval
APPROVAL_SIGNING_SECRET=<secret>  # Compartido con portal
APPROVAL_BASE_URL=https://<portal-domain>/letter/review
```

### Portal (.env)

```bash
NEXT_PUBLIC_SUPABASE_URL=<url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
SUPABASE_SERVICE_ROLE_KEY=<key>  # Para publish-edition.ts

APPROVAL_SIGNING_SECRET=<secret>  # Mismo que pipeline
GITHUB_TOKEN=<token-pat>
GITHUB_REPO=<owner/repo>
```

---

## Testing: Flujo Completo Mockado

```bash
# Fase 1: Generar draft (local)
DRY_RUN=true pnpm draft -- --edition 2026-99

# Fase 2: Simular digest
pnpm digest:edition -- --edition 2026-99 --dry-run

# Fase 3: Generar tokens (local)
node -e "
const {signReviewToken} = require('./src/utils/approval-token.js');
const t1 = signReviewToken({...}, process.env.APPROVAL_SIGNING_SECRET);
console.log('Image approve:', t1.approveUrl);
console.log('Content approve:', t2.contentApproveUrl);
"

# Fase 4: Simular clicks (local portal)
cd portal
# Simular token en /review?t=... (unit test)
pnpm test -- __tests__/app/review/route.test.ts

# Fase 5: Verificar publicación
# Supabase: SELECT * FROM editions WHERE edition_id='2026-99'
# Portal newsroom: http://localhost:3000/newsroom/2026-99
```

---

## Guía de Operación

### Para el Editor

**Flujo normal (sin rechazos):**
1. Recibe email con imagen + artículo
2. Clica: **[Aprobar imagen]** → 1 minuto
3. Clica: **[Aprobar artículo]** → edición viva en newsroom
4. (Opcional) Clica: **[Beehiiv también]** (workflow_dispatch) → 5 minutos

**Si rechaza imagen:**
1. Clica: **[Rechazar imagen]**
2. Espera email con nueva versión (~10 minutos)
3. Aprueba o rechaza de nuevo (máx 5 intentos)

**Si rechaza artículo:**
1. Clica: **[Rechazar artículo]** + motivo
2. Espera nuevo draft completo (~1.5 horas)
3. Aprueba de nuevo (máx 3 intentos)

---

### Para Operaciones/DevOps

**Monitoreo:**
- `review.json` archivos en rama `drafts/<edition>`
- Logs de `portal/app/review/route.ts` en Vercel
- GitHub workflow runs: `weekly-draft.yml`, `regenerate-image.yml`

**Troubleshooting:**

| Problema | Acción |
|---|---|
| "Imagen no genera" | Check Vertex AI quota, auth en GCP, `DRY_RUN=true` |
| "Token expirado" | Generar nuevo token, resend email |
| "Publish falla" | Check `review.json`, ambas aprobaciones presentes |
| "Beehiiv no recibe" | OK: solo opcional, newsroom vive sin él |
| "Workflow atrapado" | Check GitHub logs, re-dispara workflow |

---

## Migración desde Legacy

### Paso 1: Deprecar Worker

```bash
# Mante Cloudflare Worker pero no lo uses
# Redirige a /review si se toca (opcional)
```

### Paso 2: Actualizar APPROVAL_BASE_URL

```bash
# Cambiar de: https://approval-worker.xyz/approve?t=...
# A: https://<portal-domain>/letter/review?t=...
```

### Paso 3: Publicar primera edición vía portal

```bash
# Correr weekly-draft.yml normal
# Email dice: nuevo endpoint /review
# Editor clica: aprueba imagen + artículo vía portal
# Resultado: edición en newsroom ✓
```

### Paso 4: Desmantelar Worker (opcional, después de confianza)

```bash
# Una vez que portal esté probado en producción
# Apagar Cloudflare Worker si lo deseas
```

---

## Resumen

- ✅ **Newsroom es ahora el canal principal** (no Beehiiv)
- ✅ **Imagen visible en toda la cadena** (generación → revisión → publicación)
- ✅ **Aprobación granular** (imagen ≠ contenido)
- ✅ **Regeneración eficiente** (rechazar imagen no regenera contenido)
- ✅ **Portal como receptor de autoridad** (no depende de Worker)
- ✅ **Beehiiv es optional** (distribución adicional, no bloqueante)

**Próximas fases:** Testing E2E, capacitación editorial, deprecación formal del Worker.
