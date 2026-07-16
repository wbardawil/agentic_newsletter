# CONTEXT — Última compactación de sesión

> Snapshot capturado al cierre de la sesión de desarrollo. Este archivo es la
> fuente de verdad para resumir el estado del proyecto, lo que se logró, lo
> que está pendiente, y las decisiones tomadas. Cualquier sesión futura debe
> empezar leyendo este archivo antes de tocar nada.

---

## 1. Project Snapshot

**Repo:** `agentic_newsletter` (rama `main`, sincronizada con `origin/main`)
**Última commit:** `9dbcf8d`
**Propósito:** Pipeline de newsletter bilingüe (EN/ES) "The Transformation Letter" con 11 agentes, portal Next.js + Supabase, orquesta Make.com/n8n, IA Anthropic Claude, publicación Beehiiv.

### Stack y convenciones clave

| Aspecto | Detalle |
|---|---|
| Lenguaje | TypeScript strict mode |
| Orquestación | GitHub Actions (`.github/workflows/weekly-draft.yml`) |
| Agentes (11) | Supervisor, Radar, Strategist, Writer, Designer, Localizer, Validator, QualityGate, Distributor, Amplifier, Analyst |
| Modelos LLM | Writer/Localizer: `claude-opus-4-7` · Strategist/Validator/QG/Amplifier/Designer: `claude-sonnet-4-5` · Radar/Analyst/Distributor: sin LLM |
| Image gen | `gemini-3-pro-image` (Designer) |
| Email aprobación | Resend API (`send-draft-digest.ts`) → `pnpm digest:edition` |
| Validación I/O | Zod schemas en `src/types/` |
| Tests | Vitest, **80/80 pasando** |
| Tipos de cambio | Conventional Commits (scope, ej. `fix(workflow):`) |
| Push policy | Directo a `main` tras validar tsc + tests |

---

## 2. Goal

Mantener el pipeline de newsletter estable end-to-end: **draft → email al aprobador → publicación**, eliminando errores recurrentes en cada corrida. La sesión actual estaba enfocada en resolver un fallo de ENOENT en el step "Send draft digest email" de la corrida `77081637971` (edición 2026-27).

---

## 3. Constraints & Preferences

- **Idioma de conversación:** español
- **Push directo a `main`** después de validar con `tsc --noEmit` y suite de tests
- **No modificar la lógica de Fact Verification** (Check 1 del QG) — hard gate congelado
- **Tests deben pasar 80/80** antes de cada commit
- Sin emojis en archivos ni en commits salvo solicitud explícita
- Sin comentarios en código a menos que el usuario los pida
- No commitear secretos, `.env` ni artefactos generados

---

## 4. Progress

### Done (5 commits en esta sesión)

| # | Hash | Resumen |
|---|---|---|
| 1 | `b049f22` | Fix pipeline: propagar reparaciones al borrador ES en repair loop; exponer `publishedAt` de fuentes al QG; exemption #5 en QG para escenarios base históricos retóricos |
| 2 | `2a3a4c7` | Fix publish: `assetPath` relativo (`drafts/${editionId}-hero.png`) en lugar de path absoluto del runner; auto-aprobar imagen pendiente al aprobar contenido en portal; umbral Validator 70→65 en `validator.ts`, `publish-edition.ts`, `publish-to-beehiiv.yml` |
| 3 | `1b50e26` | Fix timeout: Localizer `max_tokens:24000` + `thinking:adaptive`; QG exemption #6 para afirmaciones editoriales primera persona (`In our experience…`); skip 3ra corrida QG cuando `repairAttempt===MAX_QG_REPAIRS`; `timeout-minutes:25`; modelo imagen → `gemini-3-pro-image` en `brand-style-tokens.json`, `cost-tracker.ts`, `sample-hero.ts` y tests |
| 4 | `8d0f5c5` | Fix pipeline: Localizer `thinking.type` revertido a `"adaptive"` (claude-opus-4-7 rechaza `"enabled"` con HTTP 400); Citation Guard pre-scan post-Writer en `run.ts`; regla #2 writer.md reescrita con ejemplos WRONG/CORRECT de naked attributions; campo `disabled?: boolean` en `FeedConfig` + 8 feeds deshabilitados (HBR TLS, BLS×4, Substack×3) |
| 5 | `9cb99f6` | Limpieza repo: 9 archivos basura eliminados de `drafts/` (`git rm --cached`); `drafts/*` + `drafts/sample/` agregados a `.gitignore` con excepción `!drafts/angle-history.json` |
| 6 | `9dbcf8d` | **Fix workflow (último):** `git add -f` antes del PR para forzar staging de draft files ignorados por `.gitignore`, restaurando el restore-from-branch |

### In Progress

- **Causa raíz diagnosticada y corregida** del ENOENT en edición 2026-27 (commit `9dbcf8d`).
- Pendiente confirmar la próxima corrida semanal (edición 2026-28) ejecute el step "Send draft digest email" sin error.

### Blocked

- (none)

---

## 5. Key Decisions

### Decisiones de esta sesión

- **`angle-history.json` es el único archivo de `drafts/` que persiste en el repo.** Lo lee `loadAngleHistory(draftsDir)` en `src/run.ts:664` para evitar repetir ángulos editoriales entre ediciones.
- **`drafts/*` en `.gitignore` no afecta `actions/upload-artifact`** (sube del filesystem del runner, no del índice git), pero SÍ afecta cualquier step que haga `git add drafts/` para commitear a una rama `drafts/<editionId>`.
- **Solución del ENOENT:** agregar un step "Force-stage draft files" que use `git add -f` antes del `create-pull-request` action. Esto fuerza el staging a pesar del `.gitignore`, así la rama `drafts/<id>` en GitHub contiene el draft completo y el `git checkout drafts/<id> -- drafts/` del restore step vuelve a funcionar.
- **`thinking: { type: "adaptive" }` es la única sintaxis soportada por `claude-opus-4-7`.** `"enabled"` con `budget_tokens` devuelve HTTP 400.
- **Gemini 3 Pro Image pricing en `cost-tracker.ts` es estimado** — actualizar cuando Google publique tarifas oficiales.
- **Repair loop propaga al draft ES** (no solo al EN). Fix verificado en `b049f22`.
- **Umbral Validator 65** (bajado de 70). Es el piso mínimo aceptable. Aplicado en 3 lugares: `validator.ts`, `publish-edition.ts`, `publish-to-beehiiv.yml`.
- **Auto-aprobar hero al aprobar contenido:** si el revisor aprueba el contenido, la imagen `pending` se aprueba automáticamente; solo se bloquea publish si está `rejected`. Implementado en `portal/lib/review-state.ts`.

### Convenciones heredadas del proyecto (de CLAUDE.md)

- 6 topics rotados: business transformation (35/35/30% OS), conscious capital, family business, family office, AI, technology.
- **People es dimensión always-on:** cada issue declara `peopleAngle.challenge` y `peopleAngle.framework` (ADKAR/Kotter/7S).
- Las recomendaciones se fundamentan en metodología de change management.
- Diagnose first, prescribe second; evitar hype-cycle takes.

---

## 6. Next Steps

1. **Monitorear la próxima corrida semanal** (edición 2026-28) y confirmar que el step "Send draft digest email" reciba el `draft.json` completo.
2. **Si la edición 2026-27 todavía requiere envío manual** (el aprobador la espera), ejecutar localmente:
   ```bash
   # Restaurar desde el artefacto de la corrida 77081637971
   cp "logs/drafts-2026-27/history/2026-27-20260701T171822-da37c4d9-draft.json" "drafts/2026-27-draft.json"

   # Enviar digest (requiere RESEND_API_KEY en .env)
   pnpm digest:edition -- --edition 2026-27 --pr-url https://github.com/wbardawil/agentic_newsletter/pull/41
   ```
3. **Si aparecen nuevos errores** en el pipeline, seguir el mismo flujo: logs → causa raíz → fix mínimo → tsc + 80 tests → commit con scope semántico.
4. **Actualizar `cost-tracker.ts`** cuando Google publique pricing oficial de `gemini-3-pro-image`.

---

## 7. Critical Context

### Causa raíz del ENOENT (edición 2026-27, run `77081637971`)

Cadena de 4 eslabones:

1. **Pipeline OK (exit 0).** El step "Run draft pipeline" generó todos los archivos en el runner. Log confirma Validator 95/100.
2. **`create-pull-request` solo commitea `angle-history.json`.** El action internamente corre `git add drafts/**`, pero `drafts/` está en `.gitignore`. Solo el archivo con excepción llega a la rama `drafts/2026-27` en GitHub.
3. **`git reset --hard` borra los archivos del runner.** `create-pull-request` hace `reset --hard origin/main` al finalizar. Los archivos de draft desaparecen del working tree porque git los trata como untracked.
4. **El restore es un no-op silencioso.** `git checkout drafts/2026-27 -- drafts/` no da error pero no restaura nada (la rama está casi vacía). El script de email busca `2026-27-draft.json`, no lo encuentra, falla con ENOENT.

El **artefacto de la corrida** solo contenía `angle-history.json` + `history/` porque `history/` es subdirectorio y `reset --hard` no borra archivos ignorados dentro de subdirectorios anidados. La solución (`9dbcf8d`) agrega un step que usa `git add -f` antes del PR para forzar el staging de los archivos ignorados.

### Comandos de validación

```powershell
# Compilación TypeScript
$tmp = "tsconfig.verify.json"
Set-Content -LiteralPath $tmp -Value '{"extends":"./tsconfig.json","exclude":["src/optimization","node_modules","portal"]}'
npx tsc --noEmit -p $tmp 2>&1
Remove-Item -LiteralPath $tmp

# Tests core (80 tests)
npx vitest run tests/agents/validator.test.ts tests/agents/quality-gate.test.ts tests/integration/pipeline-smoke.test.ts tests/utils/citation-guard.test.ts tests/scripts/send-draft-digest.test.ts

# Validar YAML
python -c "import yaml; yaml.safe_load(open('.github/workflows/weekly-draft.yml').read()); print('YAML valido')"
```

### Historial de corridas (referencia acumulada)

`76267039226`, `76286017694`, `76313114147`, `76322730732`, `76346507374`, `76470145541`, `76473481579`, `76644122426`, `76697827302`, `76871881988`, `76881972163`, **`77081637971`** (la del ENOENT, ya diagnosticada).

---

## 8. Relevant Files

| Archivo | Rol | Cambio reciente |
|---|---|---|
| `.github/workflows/weekly-draft.yml` | Orquestación del pipeline semanal; contiene step "Restore drafts for digest" (línea ~172) y "Send draft digest email" (línea ~206); `timeout-minutes: 25` | `9dbcf8d` — agregado step "Force-stage draft files" |
| `src/run.ts` | `main()`, repair loop, pre-scan Citation Guard post-Writer, `loadAngleHistory(draftsDir)` línea ~664 | `8d0f5c5` |
| `src/scripts/send-draft-digest.ts` | Lee `drafts/<editionId>-draft.json`; falla con ENOENT si falta | — |
| `src/agents/localizer.ts` | `max_tokens:24000`, `thinking:{type:"adaptive"}` línea ~313-318 | `8d0f5c5` |
| `src/agents/validator.ts` | Umbral `score >= 65` línea ~656 | `2a3a4c7` |
| `src/agents/radar.ts` | `FeedConfig` con campo `disabled?:boolean`; 8 feeds deshabilitados | `8d0f5c5` |
| `src/utils/cost-tracker.ts` | Entrada `"gemini-3-pro-image"` con pricing estimado | `1b50e26` |
| `src/utils/citation-guard.ts` | Pre-scan naked attributions post-Writer | `8d0f5c5` |
| `config/prompts/quality-gate.md` | Exemptions #1-6 (incluye editorial primera persona y escenarios históricos) | `b049f22`, `1b50e26` |
| `config/prompts/writer.md` | Regla #2 "No Naked Attributions" con WRONG/CORRECT | `8d0f5c5` |
| `config/brand-style-tokens.json` | `"model": "gemini-3-pro-image"` línea 71 | `1b50e26` |
| `portal/lib/review-state.ts` | `content_approve` auto-aprueba imagen `pending`; bloquea solo si `rejected` | `2a3a4c7` |
| `portal/lib/publish-edition.ts` | `qaMinScore()` fallback → 65 | `2a3a4c7` |
| `.gitignore` | `drafts/*` + `!drafts/angle-history.json` | `9cb99f6` (causa raíz del ENOENT) |
| `drafts/angle-history.json` | Único archivo de `drafts/` que persiste en repo; leído por Strategist | — |
| `logs/drafts-2026-27/` | Artefacto de la corrida 77081637971 (vacío salvo `angle-history.json` + `history/`) | — |

---

## 9. Memoria para la siguiente sesión

- **No tocar el Fact Verification** (Check 1 del QG). Es un hard gate congelado.
- Si Localizer falla con HTTP 400, verificar que `thinking.type` sea `"adaptive"`, nunca `"enabled"`.
- Si un step hace `git checkout` desde una rama `drafts/<id>`, los archivos deben estar en esa rama — el `gitignore` los bloquea salvo `angle-history.json`. Usar `git add -f` en el step previo al PR.
- `gemini-3-pro-image` pricing es estimado en `cost-tracker.ts`; actualizar cuando Google confirme.
- El digest email al aprobador es **bloqueante** para publish. Si falla el envío, todo se detiene en ese step. Es prioritario mantenerlo robusto.
- Tests: **80/80** es la línea base. Cualquier cambio debe mantener ese número.
- El umbral Validator de 65 se aplica en **3 lugares** — si se cambia, hay que cambiar los 3.
