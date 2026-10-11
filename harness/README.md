# Hosted procurement audit harness

This application adds a Vercel-hosted web workspace around the existing WBC project. Everything lives under `harness/`; the original Python scripts, Claude instructions, source data and completed outputs are unchanged.

The public page displays the frozen completed example. Private controls use GitHub sign-in and an account-ID allowlist. Fresh runs use separate durable eve sessions for rule extraction and the six specialist roles. Planner, challenger and QA communicate through recorded messages. Human decisions are bound to the register or pack version.

## Local development

Use Node.js 24 or newer on macOS, Linux or Windows:

```sh
cd harness
npm ci
npm run dev
```

The evidence packaging step copies the original project into `evidence/` and the example into `public/example/`. Both are generated and ignored by Git. They are included in the deployment so production never reads your local project folder. The packaging manifest records checksums of the original files.

`npm test` checks ownership, human gates, stale decisions, service authentication and free-only configuration. `npm run typecheck` checks TypeScript.

## Deployment setup

For the standalone CLI deployment, use `harness/` as the deployment directory and leave the Vercel project's root directory at `.`. The generated evidence package is explicitly included by `.vercelignore`; a remote build verifies it without reading a parent folder. Build command: `npm run build`. Do not activate paid services, credit top-ups or a Pro trial.

1. Create a GitHub OAuth app with callback `https://<deployment>/api/auth/callback/github`. Configure `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` and a strong random `AUTH_SECRET` privately in Vercel.
2. Set `AUDITOR_GITHUB_IDS` to comma-separated numeric GitHub account IDs. Usernames are not accepted as authorization IDs.
3. Connect a Neon database on its free plan and a private Vercel Blob store. Set `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN`. Initialize only this application's tables with `npm run db:init`, using environment variables provided privately.
4. Run `npm run prepare:evidence`, then `FREE_HOBBY_CONFIRMED=true node scripts/prepare-sandbox.mjs` from an authenticated Vercel environment. The script prepares a snapshot with the unchanged project, Python dependencies and Poppler. Set the returned `VERCEL_SANDBOX_SNAPSHOT_ID`. Local SDK authentication requires `VERCEL_TOKEN`, `VERCEL_TEAM_ID` and `VERCEL_PROJECT_ID`; configure them privately, never in browser variables.
5. Set `APP_ORIGIN` to the application's stable production origin. Set `HARNESS_MODEL` to the selected Claude Gateway model.
6. Confirm the account has usable AI Gateway credit and set the project's non-resetting $4 budget before setting `FREE_CREDITS_CONFIRMED=true`. Leave auto top-up disabled. Do not set direct provider keys or `AI_GATEWAY_API_KEY`. Deployed model calls use Vercel OIDC. Credit or budget exhaustion pauses runs.

Until these requirements are present, the public example works and live execution remains disabled. The $4 cap may interrupt a fresh run before the planning pack is complete.

## Run behavior

Start explicitly extracts rules, then verifies analysis and committee findings before generating the risk register. The auditor decides every risk. The risk assessor applies requested revisions and the unchanged Python gate validates them before planning starts.

Agents have bounded tools and enforced output ownership. Every Python operation boots an isolated sandbox from the snapshot, restores that run's artifacts, executes an approved command, saves successful outputs and stops the VM. The source inputs and validated scripts are read-only. Agents cannot author code or approve their own work.

The planning team keeps pack versions, a two-round challenge limit, latest-version QA and a final auditor gate. Downloads and run activity require authorized sign-in. New runs never inherit the completed example's approvals.

The application must be checked on the deployed URL: public documents, authorized GitHub login, fresh run, both human gates, team messages, sample downloads and recovery. Fixture tests and a successful build do not establish live Claude execution.

## Verified deployment setup

Production URL: https://procurement-audit-harness.vercel.app . The confirmed team is `pvk` on Hobby, and auditor GitHub account `pkatole24` resolves to ID `87074704`.

The free Neon database is initialized and the private Blob store is connected. A prepared sandbox passed the original approval gate and all four QA checks in the cloud. A synthetic database/artifact round trip also passed. Local isolation checks confirmed that the original files and outputs were unchanged.

The project has a $4 AI Gateway budget with no reset. Each of the seven specialist sessions has a $0.50 model-cost limit. The private workspace records each completed model call's reported cost, tokens and generation ID, plus activity timestamps and elapsed wall time. A call without a reported cost appears as pending, so the displayed total is incomplete until priced. Vercel budgets and eve session limits can allow a crossing call to finish; inspect the Gateway budget for final billed spend. Sign-in and a complete agent run must be confirmed separately on the deployed application.
