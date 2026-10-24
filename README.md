# Due Diligence Copilot

A RAG platform that reads company filings, financial statements, investor
presentations and market reports, and produces risk assessments, growth
opportunities and executive summaries with page-level citations.

## Layout

| Path | What it is |
|---|---|
| `supabase/migrations/` | Postgres schema: workspaces, documents, pages, chunks (pgvector), ingestion queue, row level security, storage policies |
| `supabase/tests/local_bootstrap.sql` | Stand-ins for Supabase's `auth` and `storage` schemas so migrations can be tested on plain Postgres. Never run against Supabase. |
| `worker/` | Python ingestion worker: parses PDF, HTML/EDGAR, Excel, PowerPoint, Word, CSV and text; chunks by structure; embeds with Voyage; writes pages and chunks |
| `web/` | Next.js app: public SEO site and guides, sign-in, workspaces, uploads, cited Q&A chat, reports, document viewer |
| `worker/api/drain.py` | Serverless entry point so the worker can run as a Vercel Python function |

## How ingestion works

1. The browser computes a SHA-256 of the file, inserts a `documents` row,
   uploads the file to the private `documents` bucket at
   `<workspace_id>/<document_id>/<file>`, then calls `queue_document()`.
2. `queue_document()` checks the caller's role and creates an
   `ingestion_jobs` row, then sends `NOTIFY ingestion_jobs`.
3. The worker claims jobs with `FOR UPDATE SKIP LOCKED` (safe to run many
   workers), verifies the checksum, parses, chunks, embeds and replaces the
   document's pages and chunks in one transaction.
4. Transient failures retry with backoff (1, 4, 16 minutes). Bad files fail
   straight away with a readable error shown in the UI.

## How answers are produced

1. The question is embedded with Voyage (`voyage-finance-2`, `input_type: query`).
2. `match_chunks()` runs a hybrid search inside Postgres: vector similarity and
   full-text ranking merged with reciprocal rank fusion. It runs as the
   signed-in user, so row level security limits results to their workspaces.
3. The top passages go to Claude (`claude-opus-5-5`) as numbered sources with
   strict grounding rules. Every sentence must cite `[S#]`; the UI turns each
   citation into a link to the exact page in the document viewer.
4. Reports (risk, growth, executive summary) run several targeted searches,
   merge the passages and generate a structured, cited write-up that is saved
   to the `reports` table. Questions and reports are written to `audit_events`.

Refusals fall back server-side (`fallbacks: "default"`), and answers that
would need information outside the sources say so instead of guessing.

## Local development

Requirements: Postgres 16 with pgvector, Python 3.11+, Node 20+.

```bash
# worker
cd worker
python -m venv .venv && .venv/bin/pip install -e '.[dev]'
DDC_TEST_ADMIN_URL=postgresql://postgres@localhost:54322/postgres .venv/bin/pytest
.venv/bin/ddc-worker inspect path/to/10-K.pdf --chunks   # parse a file without a database

# web
cd web
cp .env.example .env.local   # fill in Supabase URL and anon key
npm install && npm run dev
```

## Deploying

1. **Supabase**: create a project, then apply the files in
   `supabase/migrations/` in order (`supabase db push` or the SQL editor).
   In Auth settings, set the Site URL to your domain and add
   `https://<domain>/auth/callback` to the redirect URLs.
2. **Worker**: either deploy `worker/` as its own Vercel project (Python
   runtime; `api/drain.py` is woken by the web app after each upload and by a
   daily cron), or build `worker/Dockerfile` and run `ddc-worker run` on any
   container host. Set the variables in `worker/.env.example`, plus
   `DDC_DRAIN_SECRET` (and `CRON_SECRET` with the same value) for the
   serverless option.
3. **Web**: import the repo into Vercel with root directory `web` and set the
   variables in `web/.env.example` (`ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`,
   Supabase URL and anon key, worker URL and secret). `NEXT_PUBLIC_SITE_URL` must be the final
   https URL of your domain.

## Search Console

1. In Google Search Console, add a **Domain** property for your domain.
2. Add the TXT record Google shows you to your DNS (on Vercel: Domains >
   your domain > DNS records), then click **Verify**.
3. Open **Sitemaps** and submit `https://<domain>/sitemap.xml`.
