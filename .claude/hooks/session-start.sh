#!/bin/bash
# SessionStart hook — runs at the beginning of every Claude Code on the web
# session. Installs project deps + GSD (Get Shit Done) + gstack so the global
# slash commands and skills are available from the first turn.
#
# Local Claude Code runs (Wadi's Windows machine) skip this entirely — those
# environments manage their own deps and global tooling.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "[session-start] installing project dependencies (pnpm)..."
pnpm install --prefer-offline --reporter=silent

echo "[session-start] installing GSD slash commands (~/.claude/commands/gsd/)..."
# --global puts /gsd:* into the user-level commands dir, available everywhere.
# -y auto-accepts the npx package install prompt.
npx -y get-shit-done-cc@latest --global

echo "[session-start] installing gstack skills (~/.claude/skills/gstack/)..."
GSTACK_DIR="$HOME/.claude/skills/gstack"
if [ -d "$GSTACK_DIR/.git" ]; then
  git -C "$GSTACK_DIR" pull --quiet --ff-only || {
    # If a fast-forward pull is impossible (e.g. local state diverged), wipe
    # and re-clone — the sandbox is ephemeral so this is safe.
    rm -rf "$GSTACK_DIR"
  }
fi

if [ ! -d "$GSTACK_DIR/.git" ]; then
  mkdir -p "$(dirname "$GSTACK_DIR")"
  git clone --single-branch --depth 1 \
    https://github.com/garrytan/gstack.git \
    "$GSTACK_DIR"
fi

# --host claude  → install into ~/.claude/skills/ (Claude Code target)
# --prefix       → keep skill names as gstack-* (avoids collisions)
# --no-team      → do NOT register gstack's own SessionStart hook (we own the hook)
# -q             → quiet output
#
# The setup links all 23 skills first, then tries to download Playwright
# Chromium for the `browse` tool. The cloud sandbox blocks playwright.dev
# (403 Host not in allowlist), so that final step fails — but by then every
# non-browser gstack skill is already linked and usable. Treat the failure
# as non-fatal so the rest of the session can start cleanly.
(cd "$GSTACK_DIR" && ./setup --host claude --prefix --no-team -q) || \
  echo "[session-start] gstack setup exited non-zero (Playwright CDN likely blocked); non-browser skills still linked."

echo "[session-start] ready."
