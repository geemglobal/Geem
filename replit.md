# Geem CRM & Shop

A full-stack business management platform for mobile phone retail. Covers inventory (IMEI-tracked), invoicing, customer ledger, POS, procurement, web shop, SIM management, and dashboards.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/geem run dev` — run the frontend (port 18112, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, shadcn/ui, TanStack Query, Wouter, Recharts
- API: Express 5
- Auth: Clerk (frontend + admin), custom token auth (shop customers)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- AI: OpenAI (`gpt-4o-mini`) for product content generation
- Push: FCM via `@workspace/push`
- Build: esbuild (CJS bundle for API)

## Where things live

- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/geem/src/pages/` — React pages (admin/, shop/, auth/)
- `artifacts/geem/src/components/` — shared UI components
- `lib/db/src/schema/` — Drizzle ORM schema (source of truth for DB)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit)

## Architecture decisions

- Ledger balances always calculated by `recalculateCustomerLedger()` after insert; the `balance: "0"` placeholder is intentional.
- Inventory sold status protected by `inArray()` pre-check in invoice creation — no `sql.raw` on request body values.
- Web order shipping only passes successfully-sold inventory IDs into invoice creation.
- OpenAI model: `gpt-4o-mini` (not `gpt-5-mini` which does not exist).
- Clerk React v6 `useSignIn()` uses `as any` cast in ShopSignIn.tsx due to signals-based API type mismatch.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Do NOT use `sql.raw()` with request body values — always use `inArray()` or parameterised queries.
- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change before using the generated types.
- Typecheck with `pnpm --filter @workspace/<slug> run typecheck`, not `build` (build needs `PORT`/`BASE_PATH` from workflow env).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
