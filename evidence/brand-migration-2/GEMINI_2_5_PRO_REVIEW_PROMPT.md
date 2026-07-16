# Gemini 2.5 Pro Read-Only Reviewer Prompt

You are reviewing TINA-UI-BRAND-IDENTITY-MIGRATION-2. This is a read-only review. Do not modify files, do not run destructive commands, do not commit, and do not push.

Repository: C:/Projects/tina-ai
Branch: phase-10a3-r1-trust-persistence-accessibility
Expected starting HEAD before the migration commit: 0816ac865b4ee55d5bb92534834dadbb0dcfba87

Review goal: independently verify that the Vite frontend brand identity migration is implemented truthfully and safely.

Approved brand:
- Primary brand: TINA
- Formal meaning: Tax Intelligence & Navigation Architecture
- Public descriptor: Philippine Tax Intelligence Platform
- Short workspace descriptor: Philippine Tax Intelligence
- Positioning: Navigate Philippine taxation with verified authority.

Approved disclosures:
- TINA is an independently developed Philippine tax research and intelligence platform. It is not affiliated with, operated by, or officially endorsed by the Bureau of Internal Revenue, Department of Finance, or any Philippine government agency.
- TINA provides tax research and professional decision support. Its responses do not constitute an official government ruling and must be evaluated based on the applicable law, authorities, taxable period, and complete facts and circumstances.

Please verify:
1. The old descriptor "Tax Information Navigation Assistant" is not present in frontend source or `index.html`.
2. The approved brand text appears in appropriate user-facing locations without implying official BIR, DOF, or Philippine government affiliation or endorsement.
3. No government seals, official logos, or trademark symbols were introduced.
4. Trust UI/logic, source cards, responseType mapping, persistence, chat history, and accessibility behavior were not regressed.
5. The message-history container still has `tabIndex={0}` and `aria-label="Message history, scrollable"`.
6. Screenshots under `evidence/brand-migration-2/` are real browser evidence and cover 320, 375, 390, 768, 1024, 1280, and 1440 widths for auth and workspace views.
7. `npm run build` and `npm run lint` results in `TINA-UI-BRAND-IDENTITY-MIGRATION-2_REPORT.md` are plausible and complete.
8. `.gitignore` remains an unrelated pre-existing change and is not part of the migration commit.

Return a concise verdict with PASS / PASS WITH NOTES / FAIL, followed by findings ordered by severity with file and line references.
