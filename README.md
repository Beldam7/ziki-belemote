# Agent Briefs

A prototype for Ziki: each agent gets a short **Brief** that says what it may do, what needs its owner's yes, and what happens when nobody answers.

- **Scope:** platforms, issue types and the highest severity the agent may act on without asking.
- **Allowed actions:** per action, `Allow`, `Ask first` or `Never`, plus an optional daily limit with a warning at 80%.
- **Ask first:** a request with a time limit that the owner approves or denies.
- **Hand-off:** if nobody answers, skip, keep waiting, or hand off to a named teammate.

Every action in the activity log shows which Brief version it ran under. The full write-up is in [`docs/PROPOSAL.md`](docs/PROPOSAL.md).

There are two parts:

1. **The app** (`src/`): a Vite + React + TypeScript single page. Agents, Briefs, approvals and activity are stored in the browser only (`localStorage`). It does **not** talk to Ziki.
2. **The webhook receiver** (`api/ziki-webhook.ts`): an optional Vercel function that receives Ziki's signed webhooks, checks an offer against your Brief, and tells you about it. It does nothing risky unless you switch it on.

## Run it locally

```bash
npm install
npm test          # engine, signature check and offer decision tests
npm run build     # type-check + production build
npm run dev       # http://localhost:5173
```

> The code was written and checked in a sandbox where `npm install` was blocked. The tests passed with a small stand-in for Vitest and the code type-checked against stubs for React and Node, but **`npm run build` has not been run**. Run the three commands above once before you push, and fix anything they report.

## Push to GitHub

```bash
git remote add origin https://github.com/<you>/agent-briefs.git
git push -u origin main
```

## Deploy on Vercel

1. Vercel → **Add New… → Project** → import the GitHub repo. The Vite preset is detected (`vercel.json` also sets it).
2. Deploy. The app works with no environment variables.
3. Open the deployed URL and click through the Brief editor, **Try an action** and **Approvals**.

## Turn on the webhook receiver (optional)

1. In Ziki: **Settings → Agents → Webhooks → Add webhook**. Pick the agent that gets your offers (it must be a contributor), set the URL to `https://<your-app>.vercel.app/api/ziki-webhook`, and copy the signing secret. It is shown once.
2. In Vercel → **Settings → Environment Variables**, add the names from `.env.example`: `ZIKI_WEBHOOK_SECRET`, `ZIKI_AGENT_KEY`, and optionally `NTFY_TOPIC` (phone alerts through [ntfy.sh](https://ntfy.sh)) and `BRIEF_JSON`. Redeploy.
3. Leave `DRY_RUN=true`. The receiver then only notifies you. To let it accept in-scope offers, set **both** `DRY_RUN=false` and `AUTO_ACCEPT=true`.

What it does with each delivery:

- Rejects anything whose signature, or timestamp (older than five minutes), does not check out.
- Ignores every event except `claim.offered`.
- Reads the offered issue, and checks it against the Brief. If it cannot read the platform, issue type or severity, it asks you instead of guessing.
- Accepting an offer starts a delivery deadline (15 minutes by default), so only enable auto-accept if you can deliver that fast.

## Known limits

- The webhook receiver is stateless, so **daily limits are not enforced there**. Use `Ask first` for anything you want capped.
- The exact webhook body for `claim.offered` was not available when this was written. `api/_lib/offer.ts` reads ids defensively. Check a real delivery in Vercel's function logs and adjust `parseOfferEvent` if needed.
- Ziki's own docs disagree on how long an offer lasts (30 minutes in one place, 60 seconds in another). Test with a real offer before relying on timing.

## Security

- Never commit `.env*` files or paste agent keys into chat, issues or code. The `.gitignore` excludes them.
- If a key has ever been pasted somewhere public or shared, regenerate it in Ziki (**Settings → Agents → Regenerate key**).
