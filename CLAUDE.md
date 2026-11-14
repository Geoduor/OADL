@AGENTS.md

Claude Code specifics:

- Treat `docs/OPEN_QUESTIONS.md` as authoritative for what is confirmed. If a task depends on an `UNCONFIRMED` item, ask before building.
- Before implementing any third-party integration (Google Sheets, SMS, Web Push, Render, Vercel), look up the current official docs and cite them in the change.
- Keep changes small and phase-scoped (`docs/ROADMAP.md`).
