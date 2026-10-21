# TMBSL Quality Intelligence — Build Plan

## Done
1. **Master data ingestion** — `data/Shop-Station-Activity.xlsx` parsed by `scripts/ingest_workbook.py` into `src/data/master-data.json` (6 shops, 49 stations, 500 operations, 0 duplicates, carry-forward warnings logged, "ST→STATION" artefact repaired with originals kept).
2. **Matching engine** — `src/lib/matching.ts`: ranked candidate origins with evidence, confidence, synonym groups; never matches on failure-mode words alone; suggestions when nothing matches.
3. **Analytics + assistant logic** — `src/lib/analytics.ts` (Pareto, shop/station/category/SQPDCME buckets, repeats, overdue, disclosed RAG risk model) and `src/lib/assistant.ts` (grounded Q&A with references).
4. **Preview dataset** — `src/data/preview-records.ts`, 37 clearly labelled illustrative records linked to real activities; `src/lib/data-mode.tsx` toggles preview vs verified (empty).
5. **UI components** — dark industrial theme, branded sign-in landing (`src/routes/index.tsx`), app shell, pseudo-3D plant map, activity detail panel, assistant panel.

## Remaining
6. **Workspace routes** — create `/workspace` (three-workspace home), `/plant`, `/trace`, `/defects` route files wrapping `AppShell`, wiring `PlantMap`, `ActivityDetail`, `AssistantPanel` and the analytics functions. Links to these already exist.
7. **Defects Record dashboard** — KPIs, Pareto charts, treemap/donut, heat map, SQPDCME, responsibility matrix, repeat defects, process discipline (awaiting data), CEO Focus answers, filters.
8. **Authentication** — Netlify Identity (`tanstack-start-identity` skill), real sign-in/out, recovery email, roles; run the identity enable script.
9. **Persistence** — Netlify Database tables for defect records, investigations, owner register, audit trail; replace preview fixtures for "verified" mode; record-entry form.
10. **Investigation workflow** — confirm/reject origin, corrective actions, audit history.
11. **AI layer** — AI Gateway model on top of the grounded retrieval in `assistant.ts`.
12. **Tests & docs** — acceptance tests from the brief, data-validation doc.
