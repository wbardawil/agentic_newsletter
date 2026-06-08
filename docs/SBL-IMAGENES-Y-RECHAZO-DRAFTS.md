# Story Backlog — Imagen Conceptual y Rechazo de Drafts desde Email

**Proyecto:** `agentic_newsletter_testing`  
**Versión:** 1.0  
**Fecha:** 2026-06-04  
**Sprints estimados:** 5–6 sprints (2 semanas c/u)  

---

## Leyenda de asignación

| Rol | Responsable | Tareas |
|---|---|---|
| **Developer** | Agente/IA | Arquitectura, código, refactoring, integración, pruebas unitarias |
| **Tester** | Usuario | Validación E2E, pruebas de aceptación, QA, feedback editorial |

---

## FASE 0: Alineación Técnica

**Duración fase:** 1–2 días  
**Sprint:** Pre-Sprint (planificación)

---

### SBL-001: Confirmar proveedor de imagen Vertex AI

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-001 |
| **Asignado a** | Developer + Tester |
| **Tipo** | Task |
| **Prioridad** | Blocker |
| **Story Points** | 3 |
| **Tiempo estimado** | 4 horas |
| **Componente** | Infrastructure, Config |

**Descripción:**
Confirmar y documentar los detalles técnicos de Vertex AI para generación de imagen:
- Proyecto GCP específico
- Región (ej. us-central1)
- Modelo Imagen/Gemini autorizado
- Modo de autenticación (service account vs. Workload Identity)
- Límites de cuota y tasa

**Criterios de aceptación:**
- [ ] Documento con credenciales GCP confirmadas
- [ ] Service account creado/disponible
- [ ] Modelo y región validados en GCP console
- [ ] Autenticación local y GitHub Actions probada (dry-run)

**Dependencias:** Ninguna (bloqueante para Fase 2)

---

### SBL-002: Confirmar almacenamiento público de imágenes

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-002 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Blocker |
| **Story Points** | 2 |
| **Tiempo estimado** | 3 horas |
| **Componente** | Infrastructure, Storage |

**Descripción:**
Validar y elegir proveedor de almacenamiento para assets aprobables:
- Opciones: Supabase Storage, Cloudflare R2, Cloudinary
- URL públicas, versionado, limpieza automática
- Integración con pipeline

**Criterios de aceptación:**
- [ ] Storage elegido y documentado
- [ ] Bucket/contenedor creado
- [ ] Permisos públicos/privados configurados
- [ ] Upload de prueba exitoso desde Node.js

**Dependencias:** Ninguna (bloqueante para Fase 3)

---

### SBL-003: Confirmar estrategia de publicación: Portal/Newsroom primario, Beehiiv opcional

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-003 |
| **Asignado a** | Developer + Tester |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 2 |
| **Tiempo estimado** | 2 horas |
| **Componente** | Architecture, Distribution |

**Descripción:**
Confirmar y documentar que:
- **Publicación principal**: `portal/app/review/route.ts` → Supabase → newsroom
- **Publicación adicional (opcional)**: `publish-to-beehiiv.yml` → Beehiiv API, solo via `workflow_dispatch` manual
- Worker legacy (`workers/approval-receiver`) es deprecado a favor de portal

**Criterios de aceptación:**
- [ ] Decisión documentada en OPERATIONS.md
- [ ] Flujo de publicación aclarado en arquitectura
- [ ] Plan de migración del Worker definido (mantener o deprecar)

**Dependencias:** SBL-002

---

### SBL-004: Documentar decisión sobre Worker legado

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-004 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Medium |
| **Story Points** | 1 |
| **Tiempo estimado** | 1 hora |
| **Componente** | Documentation, Architecture |

**Descripción:**
Decidir si deprecar o mantener `workers/approval-receiver`:
- Opción A: Deprecar a favor de portal `/review` endpoint
- Opción B: Mantener como fallback con redirección

**Criterios de aceptación:**
- [ ] Decisión tomada y documentada en OPERATIONS.md
- [ ] Plan de migración o mantenimiento definido

**Dependencias:** Ninguna

---

## FASE 1: Estado de Revisión y Tokens

**Duración fase:** 3–4 días  
**Sprint:** Sprint 1

---

### SBL-005: Crear tipos compartidos de review state

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-005 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Blocker |
| **Story Points** | 5 |
| **Tiempo estimado** | 6 horas |
| **Componente** | Core, Types |

**Descripción:**
Crear archivo `src/types/review.ts` con tipos de estado de revisión:
- `ReviewState`, `ImageReview`, `ContentReview`, `PublishState`
- Estados: pending, approved, rejected, regenerating, failed
- Eventos, timestamps, razones de rechazo

**Criterios de aceptación:**
- [ ] Archivo `src/types/review.ts` creado con Zod schemas
- [ ] Copia exportable para portal (o import si estructura lo permite)
- [ ] Pruebas unitarias básicas (Zod parsing)
- [ ] Validación de transiciones

**Dependencias:** Ninguna

---

### SBL-006: Implementar helpers de lectura/escritura de review.json

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-006 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Blocker |
| **Story Points** | 5 |
| **Tiempo estimado** | 8 horas |
| **Componente** | Core, Utils |

**Descripción:**
Crear `src/utils/review-state.ts` con helpers:
- `initializeReview(editionId, runId)` → crea `review.json`
- `loadReview(draftDir, editionId)` → parsea JSON
- `updateReviewStatus(review, field, newStatus)` → valida transición
- `appendEvent(review, event)` → registra decisión
- `saveReview(draftDir, editionId, review)` → persiste

**Criterios de aceptación:**
- [ ] Funciones implementadas y exportadas
- [ ] Pruebas unitarias: lectura, escritura, validación de transiciones
- [ ] Errores claros para transiciones inválidas
- [ ] Manejo de archivos faltantes

**Dependencias:** SBL-005

---

### SBL-007: Extender tokens de aprobación con decisiones

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-007 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Blocker |
| **Story Points** | 5 |
| **Tiempo estimado** | 8 horas |
| **Componente** | Core, Auth |

**Descripción:**
Modificar `src/utils/approval-token.ts`:
- Union type `ReviewDecision = "image_approve" | "image_reject" | "content_approve" | "content_reject" | "section_reject"`
- `ReviewTokenPayload` con `decision`, `sectionType?`, `sectionId?`
- `signReviewToken(input, secret)` → firma token HMAC
- `buildReviewLink(baseUrl, input, secret)` → construye URL completa
- Compatibilidad temporal: mapear `decision: "approve"` → `content_approve`

**Criterios de aceptación:**
- [ ] Tipos definidos y validados con Zod
- [ ] Funciones de firma y verificación implementadas
- [ ] Token incluye nonce y expiry (7 días default)
- [ ] Tests: firma correcta, tamper detection, expiry, decisiones inválidas

**Dependencias:** Ninguna

---

### SBL-008: Portar verificación de tokens al portal

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-008 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Blocker |
| **Story Points** | 3 |
| **Tiempo estimado** | 4 horas |
| **Componente** | Portal, Auth |

**Descripción:**
Replicar verificación HMAC en `portal/lib/approval-token.ts`:
- Copiar lógica de `src/utils/approval-token.ts` (no imports entre src/ y portal/)
- Soportar nuevas decisiones: `image_approve`, `image_reject`, etc.
- Rechazar `decision: "reject"` u otros no autorizados

**Criterios de aceptación:**
- [ ] Funciones equivalentes en `portal/lib/approval-token.ts`
- [ ] Pruebas en `portal/__tests__/lib/approval-token.test.ts`
- [ ] Interoperabilidad verificada: token firmado en pipeline se verifica en portal
- [ ] Nuevas decisiones aceptadas, antiguas rechazadas con claridad

**Dependencias:** SBL-007

---

### SBL-009: Actualizar pruebas de tokens

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-009 |
| **Asignado a** | Developer + Tester |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 3 |
| **Tiempo estimado** | 5 horas |
| **Componente** | Testing |

**Descripción:**
Extender pruebas en `tests/utils/approval-token.test.ts`:
- Firma correcta para cada tipo de decisión
- Rechazo de decisiones desconocidas
- Rechazo de tokens sin sección cuando `decision === "section_reject"`
- Nonce diferente en cada firma
- Expiry validado correctamente

**Criterios de aceptación:**
- [ ] 15+ casos de test cubriendo cada decisión
- [ ] Cobertura >90% de la lógica
- [ ] Pruebas de transiciones válidas/inválidas
- [ ] `pnpm test` pasa en root

**Dependencias:** SBL-007, SBL-008

---

## FASE 2: Designer sobre Vertex AI

**Duración fase:** 4–5 días  
**Sprint:** Sprint 2

---

### SBL-010: Extraer cliente de generación de imagen

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-010 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Blocker |
| **Story Points** | 8 |
| **Tiempo estimado** | 10 horas |
| **Componente** | Core, Image Generation |

**Descripción:**
Crear `src/utils/image-generation.ts` con cliente abstracto:
- Interfaz `ImageGenerationClient` con `generate(prompt, style): Promise<Buffer>`
- Implementación `VertexAIClient`:
  - Autenticación via ADC o `GOOGLE_APPLICATION_CREDENTIALS`
  - Llamada a modelo Vertex (via REST API)
  - Retorno de bytes PNG/JPEG normalizados
- Mantener soporte para dry-run (placeholder PNG)

**Criterios de aceptación:**
- [ ] Cliente Vertex AI funciona end-to-end
- [ ] Autenticación con service account validada
- [ ] Imagen generada descargada correctamente
- [ ] Dry-run mode escribe placeholder
- [ ] Errores de GCP mapeados a excepciones claras
- [ ] Pruebas unitarias con mock de Vertex API

**Dependencias:** SBL-001

---

### SBL-011: Actualizar AppConfig y ApiClients para Vertex AI

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-011 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 3 |
| **Tiempo estimado** | 4 horas |
| **Componente** | Config |

**Descripción:**
Modificar `src/types/config.ts` y `src/utils/api-clients.ts`:
- Reemplazar `geminiApiKey` por:
  - `imageProvider: "vertex" | "gemini" | "none"`
  - `vertexProjectId?: string`
  - `vertexLocation?: string`
  - `vertexImageModel?: string`
- Mantener `GEMINI_API_KEY` como fallback temporal si se desea

**Criterios de aceptación:**
- [ ] Config schema válida en Zod
- [ ] Apiclients instancia cliente Vertex correctamente
- [ ] `.env.example` actualizado
- [ ] Variables de entorno documentadas

**Dependencias:** SBL-010

---

### SBL-012: Extender DesignerInputSchema con regeneración

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-012 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 3 |
| **Tiempo estimado** | 4 horas |
| **Componente** | Core, Schema |

**Descripción:**
Modificar `src/agents/designer.ts`:
- Input schema incluye:
  - `attempt: number` (v1, v2, v3...)
  - `rejectionFeedback?: string`
  - `rejectedPrompts?: string[]`
- Comportamiento: en intento > 1, Claude compone prompt distinto evitando repetir

**Criterios de aceptación:**
- [ ] Zod schema extendido y validado
- [ ] Prompt en v2+ evita composición/metáfora anterior
- [ ] Artifacts guardados con versión: `hero-v2.png`, `designer-v2.json`
- [ ] Pruebas: v1 vs v2 generan prompts distintos

**Dependencias:** SBL-005

---

### SBL-013: Actualizar Designer para usar Vertex AI

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-013 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Blocker |
| **Story Points** | 8 |
| **Tiempo estimado** | 12 horas |
| **Componente** | Agents, Image Generation |

**Descripción:**
Refactorizar `src/agents/designer.ts`:
- Usar cliente Vertex AI de SBL-010
- Mantener prompt composition con Claude (sans-ändringar)
- Alt text y caption bilingüe sin cambios
- Paso de `attempt`, `rejectionFeedback`, `rejectedPrompts` desde input
- Versionar assets: `hero-v{attempt}.png`

**Criterios de aceptación:**
- [ ] Designer funciona end-to-end con Vertex AI
- [ ] Imagen generada con calidad consistente
- [ ] V1 y regeneraciones (v2, v3) producen visuales distintos
- [ ] Alt text/caption bilingüe correcto
- [ ] Dry-run funciona
- [ ] Cost tracking actualizado (Vertex en lugar de Gemini)

**Dependencias:** SBL-010, SBL-011, SBL-012

---

### SBL-014: Actualizar pruebas de Designer

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-014 |
| **Asignado a** | Developer + Tester |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 5 |
| **Tiempo estimado** | 6 horas |
| **Componente** | Testing |

**Descripción:**
Extender `tests/agents/designer.test.ts`:
- Mock de Vertex AI client en lugar de fetch directo a Gemini
- Pruebas de v1 (new), v2 (regen sin feedback), v3 (regen con feedback)
- Dry-run sin llamadas a Vertex
- Versioning de assets

**Criterios de aceptación:**
- [ ] Tests de Designer pasan con mocks Vertex
- [ ] Cobertura >85% de ramas
- [ ] Dry-run probado
- [ ] Regeneración con versioning validada
- [ ] `pnpm test` pasa en root

**Dependencias:** SBL-013

---

### SBL-015: Actualizar .env.example y documentación

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-015 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Medium |
| **Story Points** | 2 |
| **Tiempo estimado** | 2 horas |
| **Componente** | Documentation |

**Descripción:**
- `.env.example`: agregar `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `VERTEX_IMAGE_MODEL`
- `.github/workflows/weekly-draft.yml`: comentarios sobre auth GCP
- `TESTING.md`: instrucciones de dry-run Designer

**Criterios de aceptación:**
- [ ] `.env.example` actualizado y completo
- [ ] Workflow comentado
- [ ] TESTING.md incluye instrucciones de dry-run
- [ ] README.md menciona Vertex AI

**Dependencias:** SBL-011

---

## FASE 3: Artefactos y Almacenamiento de Imagen

**Duración fase:** 3–4 días  
**Sprint:** Sprint 2–3

---

### SBL-016: Implementar cliente de Supabase Storage

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-016 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 5 |
| **Tiempo estimado** | 6 horas |
| **Componente** | Storage, Utils |

**Descripción:**
Crear `src/utils/storage-client.ts`:
- `uploadAsset(bucket, path, buffer): Promise<{ publicUrl }>`
- Path: `edition-assets/<editionId>/hero-v<attempt>.png`
- Retorna URL pública versionada
- Manejo de errores y retry

**Criterios de aceptación:**
- [ ] Función sube a Supabase Storage correctamente
- [ ] URL pública es accesible inmediatamente
- [ ] Versionado funciona: v1, v2, v3...
- [ ] Errores de red manejados
- [ ] Pruebas unitarias con mock Supabase

**Dependencias:** SBL-002

---

### SBL-017: Integrar upload de imagen en Designer

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-017 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 3 |
| **Tiempo estimado** | 4 horas |
| **Componente** | Agents, Storage |

**Descripción:**
Modificar `src/agents/designer.ts`:
- Después de generar PNG localmente, subirlo a Supabase Storage
- Guardar `publicUrl` en output
- Actualizar `review.json` con `image.publicUrl`

**Criterios de aceptación:**
- [ ] Imagen sube correctamente después de generación
- [ ] `publicUrl` en output de Designer
- [ ] URL es accesible desde browser
- [ ] Dry-run no intenta subir

**Dependencias:** SBL-016, SBL-013

---

### SBL-018: Actualizar mapeos de portal-sync y edition-mapping

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-018 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 3 |
| **Tiempo estimado** | 4 horas |
| **Componente** | Portal, Utils |

**Descripción:**
- `src/utils/portal-sync.ts`: MirrorInput incluye `heroImageUrl?: string`
- `portal/lib/edition-mapping.ts`: buildEditionRow recibe `heroImageUrl` y lo mapea a `hero_image_url`
- Cambiar `hero_image_url: null` por `heroImageUrl ?? null`

**Criterios de aceptación:**
- [ ] `MirrorInput` acepta `heroImageUrl`
- [ ] `buildEditionRow` mapea correctamente
- [ ] Pruebas: `hero_image_url` se preserva en ambos mapeos
- [ ] Tipos TypeScript consistentes

**Dependencias:** SBL-005

---

### SBL-019: Agregar pruebas de mapping para hero_image_url

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-019 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 2 |
| **Tiempo estimado** | 3 horas |
| **Componente** | Testing |

**Descripción:**
- Test en `portal/__tests__/lib/edition-mapping.test.ts` o nuevo archivo
- Verificar `hero_image_url` se pasa desde entrada a `EditionInsert`
- Casos: null, URL válida, URL con query params

**Criterios de aceptación:**
- [ ] Tests de mapping pasan
- [ ] Cobertura >90%
- [ ] `pnpm test` en portal pasa

**Dependencias:** SBL-018

---

## FASE 4: Digest con Imagen y Acciones

**Duración fase:** 4–5 días  
**Sprint:** Sprint 3

---

### SBL-020: Extender DraftJson y DigestLinks para nuevas decisiones

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-020 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 3 |
| **Tiempo estimado** | 4 horas |
| **Componente** | Scripts, Types |

**Descripción:**
Modificar `src/scripts/send-draft-digest.ts`:
- `DraftJson` tipo incluye `designer` y `review` (opcionales)
- `DigestLinks` extendido:
  - `imageApproveUrl`, `imageRejectUrl`
  - `contentApproveUrl`, `contentRejectUrl`
  - `sectionRejectUrls: Record<string, string>`
- Funciones auxiliares para construir links con tokens

**Criterios de aceptación:**
- [ ] Tipos definidos en TypeScript
- [ ] Zod schemas validados
- [ ] Links construidos correctamente con `buildReviewLink()`
- [ ] Tests de construction

**Dependencias:** SBL-007, SBL-009

---

### SBL-021: Renderizar bloque de imagen en digest

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-021 |
| **Asignado a** | Developer + Tester |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 5 |
| **Tiempo estimado** | 8 horas |
| **Componente** | Scripts |

**Descripción:**
Extender `renderDigestHtml()` en `send-draft-digest.ts`:
- Bloque visual ANTES del headline:
  - Preview de imagen (URL pública o data: URI base64)
  - Caption bilingüe
  - Alt text
  - Botones: "Aprobar imagen" y "Rechazar imagen"
  - Attempt number para auditoría
- Orden visual: imagen → artículo
- Escaping HTML en captions/prompts

**Criterios de aceptación:**
- [ ] Bloque de imagen renderiza correctamente en HTML
- [ ] URLs públicas cargadas o base64 embebidas
- [ ] Botones clicables con links firmados
- [ ] Orden visual: imagen ANTES de artículo
- [ ] HTML escaped en captions/prompts
- [ ] Mobile-friendly

**Dependencias:** SBL-020, SBL-017

---

### SBL-022: Renderizar bloque de acciones de contenido

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-022 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 5 |
| **Tiempo estimado** | 8 horas |
| **Componente** | Scripts |

**Descripción:**
Extender `renderDigestHtml()` para bloque de artículo:
- Sección 1: Vista previa de contenido (subject, apertura, insight, etc.)
- Sección 2: Acciones:
  - "Aprobar artículo" (solo si imagen ya está aprobada)
  - "Rechazar artículo" (con razón opcional)
  - Links por sección: "Rechazar insight", "Rechazar field report", etc.
- Links firmados con tokens

**Criterios de aceptación:**
- [ ] Bloque de acciones renderiza después de imagen
- [ ] "Aprobar artículo" claramente depende de imagen aprobada
- [ ] Links por sección visibles
- [ ] Tokens incluyen sectionType
- [ ] HTML escaped

**Dependencias:** SBL-020, SBL-021

---

### SBL-023: Extender ResendPayload con attachments

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-023 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Medium |
| **Story Points** | 2 |
| **Tiempo estimado** | 3 horas |
| **Componente** | Scripts, Types |

**Descripción:**
- `ResendPayload` tipo incluye `attachments?: Array<{ filename, content, contentType }>`
- `sendViaResend()` serializa attachments a base64
- PNG adjuntado con filename: `<editionId>-hero.png`

**Criterios de aceptación:**
- [ ] Tipo ResendPayload extendido
- [ ] sendViaResend() maneja attachments
- [ ] PNG base64 codificado correctamente
- [ ] Content-Type: image/png

**Dependencias:** SBL-020

---

### SBL-024: Integrar imagen en digest (lectura local + upload público)

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-024 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 5 |
| **Tiempo estimado** | 8 horas |
| **Componente** | Scripts |

**Descripción:**
En `send-draft-digest.ts`:
- Leer `drafts/<editionId>-designer.json` y `review.json`
- Si `publicUrl` existe, usar como preview en HTML + adjuntar PNG localmente
- Rendering: imagen ANTES de artículo
- Alt text y caption del designer
- Botones de aprobación/rechazo con tokens

**Criterios de aceptación:**
- [ ] Imagen renderiza en digest HTML
- [ ] PNG adjuntado a Resend
- [ ] URL pública usada como preview si existe
- [ ] Fallback si archivo local falta
- [ ] Tokens incluyen `image_approve`, `image_reject`
- [ ] Email enviado exitosamente por Resend

**Dependencias:** SBL-021, SBL-022, SBL-023

---

### SBL-025: Actualizar pruebas de digest

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-025 |
| **Asignado a** | Developer + Tester |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 5 |
| **Tiempo estimado** | 7 horas |
| **Componente** | Testing |

**Descripción:**
Extender `tests/scripts/send-draft-digest.test.ts`:
- Imagen visible en HTML
- Attachments enviados
- Botones por decisión presentes (image_approve, image_reject, etc.)
- Orden visual: imagen ANTES de artículo
- Escaping HTML en captions
- Links firmados con tokens correctos

**Criterios de aceptacion:**
- [ ] 20+ tests cubriendo digest con imagen
- [ ] Cobertura >90%
- [ ] Pruebas de attachments
- [ ] `pnpm test` en root pasa

**Dependencias:** SBL-024

---

## FASE 5: Endpoint de Revisión

**Duración fase:** 4–5 días  
**Sprint:** Sprint 4

---

### SBL-026: Crear portal/app/review/route.ts

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-026 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Blocker |
| **Story Points** | 8 |
| **Tiempo estimado** | 12 horas |
| **Componente** | Portal, Routes |

**Descripción:**
Crear endpoint `GET /review?t=<signed-token>`:
- Verificar token HMAC
- Leer `drafts/<editionId>-review.json` desde GitHub
- Validar transiciones
- Ejecutar acción según decisión:
  - `image_approve`: actualizar estado
  - `image_reject`: disparar regeneración
  - `content_approve`: si imagen aprobada, marcar ready/publicar
  - `content_reject`: disparar rerun de draft
  - `section_reject`: registrar y disparar rerun con feedback
- Responder con página HTML clara

**Criterios de aceptación:**
- [ ] Endpoint creado y respondiendo
- [ ] Token verificado correctamente
- [ ] Acciones ejecutadas (sin regressions)
- [ ] Páginas de resultado renderizadas
- [ ] Errores mapeados a mensajes claros (token inválido, transición no permitida, etc.)
- [ ] Logs auditables

**Dependencias:** SBL-008, SBL-006

---

### SBL-027: Crear portal/lib/review-state.ts

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-027 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 5 |
| **Tiempo estimado** | 8 horas |
| **Componente** | Portal, Utils |

**Descripción:**
Crear módulo `portal/lib/review-state.ts`:
- `loadReviewFromGitHub(repo, branch, editionId)`
- `updateReviewState(review, decision)` → valida transición
- `saveReviewToGitHub(repo, branch, editionId, review)`
- `validateTransition(from, to)` → bloquea transiciones inválidas

**Criterios de aceptación:**
- [ ] Funciones implementadas
- [ ] GitHub API calls funcionan (lectura/escritura)
- [ ] Validación de transiciones correcta
- [ ] Errores claros si archivo falta o no es válido
- [ ] Pruebas unitarias

**Dependencias:** SBL-006, SBL-008

---

### SBL-028: Implementar handlers de decisión

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-028 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 8 |
| **Tiempo estimado** | 10 horas |
| **Componente** | Portal, Routes |

**Descripción:**
En `portal/app/review/route.ts`, implementar handlers:
1. `handleImageApprove()` → marcar `image.status = "approved"`
2. `handleImageReject()` → disparar GitHub workflow `regenerate-image.yml` (Fase 6)
3. `handleContentApprove()` → si imagen approved, marcar `content.status = "approved"` y publicar o solo marcar ready
4. `handleContentReject()` → disparar `weekly-draft.yml` con mismo editionId
5. `handleSectionReject()` → registrar section en rejection.json, disparar rerun

Cada handler:
- Actualiza `review.json`
- Registra evento con timestamp
- Dispara workflow si necesario
- Responde con página de éxito/error

**Criterios de aceptacion:**
- [ ] Todos los handlers implementados
- [ ] Estados persistidos en GitHub
- [ ] Workflows disparados correctamente
- [ ] Páginas de resultado renderizadas (mobile-friendly)
- [ ] Errores de GitHub manejados
- [ ] Transiciones inválidas rechazadas

**Dependencias:** SBL-026, SBL-027

---

### SBL-029: Agregar pruebas del endpoint /review

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-029 |
| **Asignado a** | Developer + Tester |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 5 |
| **Tiempo estimado** | 8 horas |
| **Componente** | Portal, Testing |

**Descripción:**
Crear `portal/__tests__/app/review/route.test.ts`:
- Mocks de GitHub API
- Tests de cada decisión: image_approve, image_reject, content_approve, content_reject, section_reject
- Transiciones inválidas
- Tokens expirados
- Archivos faltantes

**Criterios de aceptacion:**
- [ ] 25+ tests cubriendo todas las rutas
- [ ] Cobertura >85%
- [ ] Transiciones válidas/inválidas probadas
- [ ] `pnpm test` en portal pasa

**Dependencias:** SBL-028

---

## FASE 6: Regeneración Automática

**Duración fase:** 3–4 días  
**Sprint:** Sprint 4–5

---

### SBL-030: Crear workflow regenerate-image.yml

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-030 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 5 |
| **Tiempo estimado** | 8 horas |
| **Componente** | GitHub Actions, CI/CD |

**Descripción:**
Crear `.github/workflows/regenerate-image.yml`:
- Input: `edition`, `attempt` (opcional), `feedback_ref` (opcional)
- Ejecuta Designer solo usando `drafts/<edition>-draft.json`
- Lee `review.json`, incrementa `attempt`, registra rechazo anterior
- Genera nueva imagen con versión
- Actualiza `review.json`, commit a rama `drafts/<edition>`
- Reenvia digest

**Criterios de aceptacion:**
- [ ] Workflow creado y syntácticamente válido
- [ ] Designer ejecutado correctamente
- [ ] Imagen versionada (v2, v3...)
- [ ] review.json actualizado
- [ ] Digest reenviado
- [ ] Commit aceptado en GitHub

**Dependencias:** SBL-013, SBL-006

---

### SBL-031: Extender weekly-draft.yml para feedback

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-031 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 3 |
| **Tiempo estimado** | 5 horas |
| **Componente** | GitHub Actions, CI/CD |

**Descripción:**
Modificar `.github/workflows/weekly-draft.yml`:
- Input opcional: `rejection_feedback` (JSON string o ref a archivo)
- Pasar feedback a `pnpm draft` via env var o arg

**Criterios de aceptacion:**
- [ ] Workflow acepta input de feedback
- [ ] Feedback pasado a CLI

**Dependencias:** SBL-031

---

### SBL-032: Leer rejection.json en src/run.ts y pasar feedback

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-032 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 5 |
| **Tiempo estimado** | 6 horas |
| **Componente** | Core, Scripts |

**Descripción:**
En `src/run.ts`:
- Leer `drafts/<editionId>-rejection.json` si existe
- Pasar `reason` y `rejectedSections` a Strategist/Writer/Localizer
- Resetear `review.image.status` y `review.content.status` a `pending`
- Crear nuevo `review.json` con incremento de `attempt`

**Criterios de aceptacion:**
- [ ] rejection.json leído correctamente
- [ ] Feedback pasado a agentes
- [ ] Review state reseteado
- [ ] Nuevo intento registrado

**Dependencias:** SBL-006

---

### SBL-033: Implementar límites de regeneración

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-033 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 3 |
| **Tiempo estimado** | 4 horas |
| **Componente** | Core, Safety |

**Descripción:**
En `src/run.ts`:
- Envvars: `MAX_IMAGE_REGEN_ATTEMPTS=5`, `MAX_CONTENT_REGEN_ATTEMPTS=3`
- Si se excede: crear issue en GitHub o comentario en PR pidiendo intervención humana
- Log claro: "MAX_IMAGE_REGEN_ATTEMPTS exceeded"

**Criterios de aceptacion:**
- [ ] Límites implementados
- [ ] Workflows se detienen si exceden
- [ ] Issue/comentario creado en GitHub
- [ ] Mensaje claro para intervencion

**Dependencias:** SBL-032

---

## FASE 7: Bloqueo de Publish y Publicación Final

**Duración fase:** 3–4 días  
**Sprint:** Sprint 5

---

### SBL-034: Modificar portal/lib/publish-edition.ts para aprobación doble

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-034 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Blocker |
| **Story Points** | 5 |
| **Tiempo estimado** | 8 horas |
| **Componente** | Portal, Core |

**Descripción:**
Extender `portal/lib/publish-edition.ts`:
- Leer `drafts/<editionId>-review.json`
- Validar: `review.image.status === "approved"` Y `review.content.status === "approved"`
- Si no: throw `PublishError("QUALITY_GATE", "...")`
- Usar `review.image.publicUrl` como `heroImageUrl`
- Persistir `hero_image_url` en Supabase

**Criterios de aceptacion:**
- [ ] Bloqueo de publish funciona
- [ ] Error claro si imagen o contenido no aprobado
- [ ] `hero_image_url` guardada en BD
- [ ] Pruebas: imagen faltante → error, imagen presente → publica

**Dependencias:** SBL-006, SBL-017, SBL-018

---

### SBL-035: Actualizar src/publish.ts con aprobación doble (para compatibilidad/Beehiiv manual)

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-035 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Medium |
| **Story Points** | 2 |
| **Tiempo estimado** | 2 horas |
| **Componente** | Core, Publish |

**Descripción:**
Modificar `src/publish.ts` (script de publish manual/legacy):
- Leer `drafts/<editionId>-review.json`
- Aplicar misma regla: ambas aprobaciones requeridas
- Log claro si falta
- **Nota**: Este script es para uso manual/Beehiiv solo. Publicación principal ocurre en portal.

**Criterios de aceptacion:**
- [ ] Lógica de validación igual a portal
- [ ] Error claro si falta imagen o contenido aprobado
- [ ] Tests actualizados
- [ ] Documentado como compatibilidad/legacy

**Dependencias:** SBL-034

---

### SBL-036: Actualizar publish-to-beehiiv.yml como publicación opcional (legacy)

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-036 |
| **Asignado a** | Developer |
| **Type** | Task |
| **Prioridad** | Medium |
| **Story Points** | 2 |
| **Tiempo estimado** | 2 horas |
| **Componente** | GitHub Actions, CI/CD |

**Descripción:**
Actualizar `.github/workflows/publish-to-beehiiv.yml` para ser **opcional/legacy**:
- **No es ruta principal**: publicación ocurre ahora en `portal/app/review/route.ts`
- Solo ejecutable via `workflow_dispatch` manual (no es automático)
- Step: validar que edición **YA FUE PUBLICADA A SUPABASE** (via portal)
- Step: si usuario quiere, copiar edición a Beehiiv API como distribución adicional
- Bloquear si Supabase publish aún no ocurrió (validar review.json + image/content approved)

**Criterios de aceptacion:**
- [ ] Workflow no se ejecuta automáticamente
- [ ] Solo disponible via `workflow_dispatch` con input de edition_id
- [ ] Valida que edición existe en Supabase antes de publicar a Beehiiv
- [ ] Documentado como "optional distribution step"

**Dependencias:** SBL-034

---

### SBL-037: Agregar pruebas de publish bloqueado

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-037 |
| **Asignado a** | Developer + Tester |
| **Tipo** | Task |
| **Prioridad** | High |
| **Story Points** | 3 |
| **Tiempo estimado** | 5 horas |
| **Componente** | Testing |

**Descripción:**
Extender `portal/__tests__/lib/publish-edition.test.ts`:
- Publish falla si `review.image.status !== "approved"`
- Publish falla si `review.content.status !== "approved"`
- Publish éxito si ambas aprobadas
- `hero_image_url` guardada

**Criterios de aceptacion:**
- [ ] 10+ tests de bloqueo/éxito
- [ ] Cobertura >90%
- [ ] `pnpm test` en portal pasa

**Dependencias:** SBL-034

---

## FASE 8: Documentación y Operación

**Duración fase:** 2–3 días  
**Sprint:** Sprint 5–6

---

### SBL-038: Actualizar README.md con nuevo flujo

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-038 |
| **Asignado a** | Developer + Tester |
| **Tipo** | Task |
| **Prioridad** | Medium |
| **Story Points** | 2 |
| **Tiempo estimado** | 3 horas |
| **Componente** | Documentation |

**Descripción:**
- Describir nuevo flujo: draft → imagen → revision → aprobación doble → publish
- Decisiones de usuario desde email
- Límites de regeneración
- URLs de endpoints clave

**Criterios de aceptacion:**
- [ ] Sección "Editorial Workflow" actualizada
- [ ] Diagrama o flowchart incluido
- [ ] Links a endpoints funcionales
- [ ] Claridad para operadores

**Dependencias:** Todas las fases anteriores

---

### SBL-039: Actualizar OPERATIONS.md con procedimientos

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-039 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Medium |
| **Story Points** | 3 |
| **Tiempo estimado** | 4 horas |
| **Componente** | Documentation |

**Descripción:**
- Variables de entorno Vertex AI, Supabase Storage, Resend
- Troubleshooting: imagen no genera, token expirado, publish bloqueado
- Runbook: aprobar por portal, forzar publish (solo admin), reset de review state
- Limites de regeneración y significado

**Criterios de aceptacion:**
- [ ] Envvars documentadas
- [ ] Troubleshooting cubridor 5+ escenarios
- [ ] Runbook de recuperación incluido

**Dependencias:** Todas las fases anteriores

---

### SBL-040: Actualizar TESTING.md

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-040 |
| **Asignado a** | Developer + Tester |
| **Tipo** | Task |
| **Prioridad** | Medium |
| **Story Points** | 2 |
| **Tiempo estimado** | 3 horas |
| **Componente** | Documentation |

**Descripción:**
- Pruebas unitarias: `pnpm test`
- Dry-run Designer: `DRY_RUN=true`
- Dry-run digest: `--dry-run` flag
- Simulación de links firmados (reproducir token, click en /review?t=...)
- E2E manual: draft → digest → click aprobación → portal

**Criterios de aceptacion:**
- [ ] Sección "Image + Rejection Flow" creada
- [ ] Comandos de test documentados
- [ ] Pasos manuales claros

**Dependencias:** Todas las fases anteriores

---

### SBL-041: Actualizar .env.example en raíz y portal

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-041 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Medium |
| **Story Points** | 1 |
| **Tiempo estimado** | 1 hora |
| **Componente** | Configuration |

**Descripción:**
- Root: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `VERTEX_IMAGE_MODEL`
- Portal: mismas vars si se usan localmente
- Storage: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Criterios de aceptacion:**
- [ ] Ambos `.env.example` actualizados
- [ ] Comentarios explicativos

**Dependencias:** SBL-001, SBL-002, SBL-011

---

### SBL-042: Documentar decisión sobre Worker

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-042 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Low |
| **Story Points** | 1 |
| **Tiempo estimado** | 1 hora |
| **Componente** | Documentation, Architecture |

**Descripción:**
- Documenta si Worker queda deprecado, mantenido, o redirecciona a portal
- Migration path si aplica

**Criterios de aceptacion:**
- [ ] Decisión documentada en OPERATIONS.md o ARCHITECTURE.md

**Dependencias:** SBL-004

---

### SBL-043: Agregar runbook de recuperación manual

| Campo | Valor |
|---|---|
| **ID Jira** | AGENTIC-043 |
| **Asignado a** | Developer |
| **Tipo** | Task |
| **Prioridad** | Low |
| **Story Points** | 2 |
| **Tiempo estimado** | 2 horas |
| **Componente** | Documentation |

**Descripción:**
- Procedimiento: aprobar/rechazar desde portal manualmente
- Re-disparar workflow
- Editar `review.json` solo en emergencia (con warning)
- Escenarios: "usuario hizo click dos veces", "token expirado", "workflow stuck"

**Criterios de aceptacion:**
- [ ] Runbook incluido en OPERATIONS.md
- [ ] Pasos claros y seguros

**Dependencias:** Todas las fases anteriores

---

## Resumen de Esfuerzo

| Fase | Sprint | Días | Story Points | Developer | Tester |
|---|---|---:|---:|---:|---:|
| 0 - Alineación | Pre | 1–2 | 8 | 6h | 2h |
| 1 - Estado + Tokens | S1 | 3–4 | 19 | 32h | 5h |
| 2 - Designer/Vertex | S2 | 4–5 | 28 | 48h | 6h |
| 3 - Almacenamiento | S2–3 | 3–4 | 13 | 18h | 3h |
| 4 - Digest | S3 | 4–5 | 23 | 39h | 7h |
| 5 - Endpoint /review | S4 | 4–5 | 26 | 38h | 8h |
| 6 - Regeneración | S4–5 | 3–4 | 16 | 23h | 0h |
| 7 - Bloqueo Publish | S5 | 3–4 | 13 | 20h | 5h |
| 8 - Documentación | S5–6 | 2–3 | 11 | 12h | 8h |
| **TOTAL** | **5–6** | **~35** | **157** | **236h** | **44h** |

---

## Notas de Ejecución

### Dependencias Críticas (Ruta Crítica)

1. **SBL-001 → SBL-010** (Vertex AI config) → SBL-013 (Designer)
2. **SBL-002 → SBL-016** (Storage) → SBL-017 (Upload en Designer)
3. **SBL-005 → SBL-006** (Review types/helpers) → SBL-027 (Portal state mgmt)
4. **SBL-007 → SBL-008, SBL-009** (Tokens)
5. **SBL-013 + SBL-020 → SBL-021, SBL-022** (Digest)
6. **SBL-024 + SBL-026 → SBL-028** (Endpoint)
7. **SBL-034 → SBL-035, SBL-036** (Publish bloqueado)

### Recomendaciones de Sprint

- **Sprint 1**: Fases 0–1 (alineación + estado/tokens)
- **Sprint 2**: Fases 2–3 (Designer Vertex AI + storage)
- **Sprint 3**: Fase 4 (digest con imagen)
- **Sprint 4**: Fases 5–6 (endpoint + regeneración)
- **Sprint 5**: Fase 7 (publish bloqueado)
- **Sprint 6** (si es necesario): Fase 8 (documentación)

### Criterios de Éxito por Sprint

- **Sprint 1**: `pnpm draft` crea `review.json`, tokens firmados funcionan
- **Sprint 2**: Designer usa Vertex AI, imagen sube a Storage
- **Sprint 3**: Digest renderiza imagen y botones de decisión
- **Sprint 4**: `/review?t=...` ejecuta acciones, regenera imagen
- **Sprint 5**: Publish bloqueado sin aprobación doble, `hero_image_url` poblada
- **Sprint 6**: Documentación completa, runbook disponible

---

## Guía de Importación a Jira

Cada SBL-XXX corresponde a un Issue/Task en Jira:

```
Project: AGENTIC
Issue Type: Task (o Sub-task si se agrupa por Epic)
Summary: [SBL-XXX] Descripción breve
Description: [contenido de "Descripción"]
Assignee: Developer o Tester
Story Points: [valor]
Estimate: [horas]
Component: [lista de componentes]
Priority: Blocker/Critical/High/Medium/Low
Sprint: Sprint N
Acceptance Criteria: [criterios de aceptación]
Linked Issues: [dependencias]
```

Se recomienda usar campos personalizados:
- **Tiempo Estimado (horas)**
- **Esfuerzo Dev / Esfuerzo QA**
- **Componentes Afectados**

---

## Cambios de Alcance / Reestimación

Si durante la ejecución:
- **Nueva dependencia descubierta**: documentar en Jira + replantear sprint
- **Story Points cambian**: actualizar y comunicar al equipo
- **Fase se divide en más subtareas**: crear nuevos SBLs
- **Fase se comprime**: combinar tareas si es seguro

**Revisar estimaciones cada Sprint** con retrospectiva de velocity.
