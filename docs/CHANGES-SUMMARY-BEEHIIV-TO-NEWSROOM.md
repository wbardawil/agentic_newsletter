# Resumen de Cambios: De Beehiiv-centric a Newsroom-centric

**Fecha:** 2026-06-04  
**Documentos actualizados:** PLAN-IMAGENES-Y-RECHAZO-DRAFTS.md, SBL-IMAGENES-Y-RECHAZO-DRAFTS.md  
**Archivo nuevo:** NEWSROOM-PUBLISH-ARCHITECTURE.md

---

## Cambios en PLAN-IMAGENES-Y-RECHAZO-DRAFTS.md

### 1. Sección 2.5 — Estado actual de aprobación y publicación

**Antes:**
```
2. Worker legado: `workers/approval-receiver/src/index.ts`
   - Verifica token HMAC.
   - Dispara `repository_dispatch` con `event_type: edition_approved`.
   - Activa `.github/workflows/publish-to-beehiiv.yml`.
```

**Ahora:**
```
2. Ruta moderna del portal: `portal/app/review/route.ts` (extensión de `approve/route.ts`)
   - Verifica `APPROVAL_SIGNING_SECRET`.
   - Decodifica token con `portal/lib/approval-token.ts`.
   - Ejecuta decisiones separadas: `image_approve`, `image_reject`, `content_approve`, `content_reject`, `section_reject`.
   - Publica directo a Supabase mediante `portal/lib/publish-edition.ts` cuando imagen + contenido están aprobados.
   - Genera `hero_image_url` en la edición publicada → aparece en newsroom.

3. Ruta legacy (opcional/deprecated): `workers/approval-receiver/src/index.ts`
   - Mantiene compatibilidad temporal.
   - **Ya NO es ruta principal de publicación**.
   - Si se ejecuta, solo dispara `repository_dispatch: edition_approved` → `.github/workflows/publish-to-beehiiv.yml` (distribución opcional adicional a Beehiiv).
```

**Impacto:** Portal es ahora el receptor principal, Worker es deprecado.

---

### 2. Sección 3.2 — Flujo objetivo (Diagrama Mermaid actualizado)

**Antes:**
```mermaid
O -->|Si| P[Publish portal/Beehiiv]
```

**Ahora:**
```mermaid
O -->|Si| P[Publish a Supabase portal/newsroom<br/>con hero_image_url]
P --> Q{Publicar también a Beehiiv?}
Q -->|Si - workflow_dispatch| R[Publish to Beehiiv API<br/>opcional/legacy]
Q -->|No| S[Fin]
```

**Impacto:** Diagrama clarifica que newsroom es principal, Beehiiv es adicional y opcional.

---

### 3. Sección 3.5 — Endpoint de decisión en portal

**Antes:** Solo menciona `/approve` binario (approve sí/no)

**Ahora:** Documenta `/review` con decisiones granulares:
- `image_approve`: marcar imagen aprobada
- `image_reject`: disparar regeneración de imagen
- `content_approve`: **publicar a Supabase** (newsroom) si imagen ya aprobada
- `content_reject`: reiniciar draft completo
- `section_reject`: rechazar sección específica

**Agregado:** Bloque "Publicación a Supabase (newsroom)" con detalles:
```
Cuando se ejecuta `content_approve` después de `image_approve`:
- Leer drafts/<editionId>-draft.json y -sources.json
- Ejecutar publishEdition(editionId) desde portal/lib/publish-edition.ts
- Usar review.image.publicUrl como hero_image_url
- Insertar edición en Supabase editions table
- Edición aparece en /newsroom con imagen
```

**Impacto:** Clarifica flujo de publicación, especifica que newsroom es el destino.

---

### 4. Sección 3.8 — Imagen en email (actualizado a "imagen en email de revisión")

**Antes:** Menciona "para que haya URL publica antes de publicar... Supabase Storage, Cloudflare R2, o Cloudinary"

**Ahora:** Especifica:
```
**Almacenamiento de imagen:** Subir candidato a Supabase Storage (`edition-assets` bucket) para que haya URL publica:
- Ruta: edition-assets/<editionId>/hero-v<attempt>.png
- URL devuelto se guarda en review.json → adjuntado en email → finalmente usado en hero_image_url de publicacion si se aprueba.
```

**Agregado:** Botones en email:
```
- **botones**: "Aprobar imagen" y "Rechazar imagen" con tokens firmados.
```

**Impacto:** Clarifica flujo de imagen desde generación hasta publicación.

---

### 5. Sección 3.9 — Imagen aprobada en publicación → Imagen aprobada en publicación al Newsroom

**Antes:**
```
### 3.9 Imagen aprobada en publicacion
```

**Ahora:**
```
### 3.9 Imagen aprobada en publicación al Newsroom

**Arquitectura actualizada:** La publicación ocurre en `portal/app/review/route.ts`, no en legacy Beehiiv workflow.

(agregado bloque final)
**Publicación final**: portal/app/review/route.ts ejecuta publishEdition() → inserta en Supabase editions table → hero_image_url poblada → edición aparece en newsroom.
```

**Impacto:** Explícito que newsroom es destino de publicación, no Beehiiv.

---

### 6. Sección 3.10 — Rechazo del articulo completo

**Agregado:** Nota sobre Beehiiv:
```
**Nota sobre Beehiiv:** El rechazo de contenido **no afecta Beehiiv** porque la publicación principal ocurre en el newsroom (portal), no en Beehiiv. El workflow publish-to-beehiiv.yml solo se ejecuta manualmente después si el editor lo decide.
```

**Impacto:** Clarifica que rechazos de contenido no impactan Beehiiv (que es opcional).

---

### 7. Sección 5.2 — Riesgos

**Antes:**
```
| Publish por rutas legacy ignora aprobacion doble | Alto | Actualizar portal publish, src/publish.ts y workflow Beehiiv con la misma regla. |
| Worker y portal compiten como receptores | Medio | Elegir portal como receptor principal; mantener Worker solo para compatibilidad temporal. |
```

**Ahora:**
```
| Publish por rutas legacy ignora aprobacion doble | Alto | ✅ Portal publish es principal, legacy scripts tienen misma validación. |
| Worker y portal compiten como receptores | Bajo | ✅ **Resuelto**: Portal es receptor principal y publica a Supabase/newsroom. Worker es optional/legacy solo para Beehiiv. |
```

**Impacto:** Marca riesgos como resueltos/mitigados.

---

### 8. Sección 5.3 — Decisiones pendientes

**Agregado:**
```
6. ✅ **DECIDIDO**: Publicación final ocurre al portal/newsroom (Supabase) vía `portal/app/review/route.ts`, NO vía Worker. Worker es optional/legacy para Beehiiv solo.
```

**Impacto:** Documenta decisión de arquitectura.

---

### 9. Fase 7 — Bloqueo de publish y publicación final

**Antes:** Genérico (no especifica destino)

**Ahora:** 
- Título: "Bloqueo de publish en portal y publicacion final a Supabase/Newsroom"
- Aclara: "Ruta principal de publicación (llamada desde portal/app/review/route.ts)"
- Especifica: "persistir hero_image_url en Supabase → aparece en newsroom"
- Modifica publish-to-beehiiv.yml a "Cambiar a opcional (workflow_dispatch solo, no automático)"

**Impacto:** Define flujo de publicación principal claramente.

---

## Cambios en SBL-IMAGENES-Y-RECHAZO-DRAFTS.md

### 1. SBL-003: "Definir estrategia Beehiiv + imagen" → "Confirmar estrategia de publicación: Portal/Newsroom primario, Beehiiv opcional"

**Cambios:**
- Título reflejando que newsroom es primario
- Descripción:
  - **Publicación principal**: portal/app/review/route.ts → Supabase → newsroom
  - **Publicación adicional (opcional)**: publish-to-beehiiv.yml → Beehiiv API, solo via workflow_dispatch manual
  - Worker legacy (workers/approval-receiver) es deprecado a favor de portal

- Criterios de aceptación:
  - Decisión documentada en OPERATIONS.md
  - Flujo de publicación aclarado en arquitectura
  - Plan de migración del Worker definido

**Impacto:** SBL reorientada hacia decisión de arquitectura correcta.

---

### 2. SBL-036: "Actualizar publish-to-beehiiv.yml con aprobación doble" → "Actualizar publish-to-beehiiv.yml como publicación opcional (legacy)"

**Cambios:**
- Prioridad: High → Medium
- Story Points: 2, Tiempo: 3h → 2 Story Points, 2h
- Descripción:
  - No es ruta principal (publicación ocurre en portal)
  - Solo ejecutable via workflow_dispatch manual (no automático)
  - Valida que edición YA FUE PUBLICADA A SUPABASE
  - Bloquea si Supabase publish no ocurrió

- Criterios de aceptación:
  - Workflow no se ejecuta automáticamente
  - Solo disponible via workflow_dispatch
  - Valida que edición existe en Supabase antes de Beehiiv
  - Documentado como "optional distribution step"

**Impacto:** Define Beehiiv como secundario/opcional, no bloqueante.

---

### 3. SBL-035: "Actualizar src/publish.ts con aprobación doble"

**Cambios:**
- Título agrega: "(para compatibilidad/Beehiiv manual)"
- Prioridad: High → Medium
- Story Points: 3 → 2, Tiempo: 4h → 2h
- Descripción:
  - Script es para uso manual/Beehiiv solo
  - Publicación principal ocurre en portal
  
**Impacto:** Marca src/publish.ts como legacy/compatibilidad, no ruta principal.

---

## Archivo Nuevo: NEWSROOM-PUBLISH-ARCHITECTURE.md

**Propósito:** Documento arquitectónico consolidado que explica:

1. **Cambio Principal** — De Beehiiv-centric a Newsroom-centric
2. **Flujo Detallado** — 5 fases: Generación, Revisión, Decisión, Publicación Principal, Publicación Opcional
3. **Flujos de Rechazo** — Cómo funciona rechazo de imagen, contenido, y por sección
4. **Casos de Uso Completos** — Happy path, rechazo de imagen, rechazo de contenido
5. **Decisiones Arquitectónicas** — Tabla comparativa: antes vs. ahora y por qué
6. **Variables de Entorno**
7. **Testing** — Flujo completo mockado
8. **Operación** — Guía para editor y DevOps
9. **Migración** — Pasos para deprecar Worker

**Agregado:** Diagrama de flujo completo + tabla de decisiones arquitectónicas + troubleshooting

---

## Impacto Consolidado

### Antes (Legacy)
- ❌ Publicación depende de Worker Cloudflare (externo)
- ❌ Edición vive SOLO en Beehiiv
- ❌ Portal NO tiene ediciones publicadas
- ❌ Newsroom no recibe imagen
- ❌ Aprobación binaria (sí/no)

### Ahora (Nueva Arquitectura)
- ✅ Publicación principal en portal (control completo)
- ✅ Edición vive en Supabase/newsroom (canal propio)
- ✅ Portal tiene ediciones con imagen
- ✅ Newsroom renderiza `hero_image_url`
- ✅ Aprobación granular (imagen ≠ contenido)
- ✅ Beehiiv es distribución opcional (no bloqueante)
- ✅ Regeneración eficiente (imagen o contenido por separado)
- ✅ Worker es deprecado a favor de portal

---

## Próximos Pasos

1. **Validar** con stakeholders que "Beehiiv es opcional" es aceptable
2. **Implementar** Fases 0-7 del plan según SBL (Fase 8 es documentación)
3. **Testing E2E** con flujo completo: draft → revisión → aprobación → newsroom
4. **Capacitación** del equipo editorial sobre nuevo workflow
5. **Monitoreo** post-lanzamiento en producción
6. **Deprecación formal** del Worker cuando portal esté estable

---

## Documentos Relacionados

| Documento | Propósito |
|---|---|
| PLAN-IMAGENES-Y-RECHAZO-DRAFTS.md | Plan técnico detallado (fases 0-8) |
| SBL-IMAGENES-Y-RECHAZO-DRAFTS.md | Story backlog con estimaciones |
| NEWSROOM-PUBLISH-ARCHITECTURE.md | Arquitectura consolidada (NUEVO) |
| NEWSROOM-TESTING-GUIDE.md | Guía E2E de testing del newsroom |

---

**Resumen final:** Los documentos ahora reflejan una arquitectura **portal/newsroom-first** con **Beehiiv como distribución opcional**, eliminando dependencias del Worker legacy y clarificando el flujo de aprobación e imagen en la cadena editorial.
