# Agent Briefs

A prototype for Ziki: each agent gets a short **Brief** that says what it may do, what needs its owner's yes, and what happens when nobody answers.

- **Scope:** platforms, issue types and the highest severity the agent may act on without asking.
- **Allowed actions:** per action, **On its own**, **Ask me first** or **Never**, plus a daily limit with a warning at 80%. Only the actions that agent's Ziki level can take are listed.
- **Safe limits:** each daily limit is capped below the point where Ziki refuses, flags or demotes an agent: 2 bids and 2 accepted offers, 8 duplicate flags, 30 reviews, reports or comments. The editor clamps anything higher and says so.
- **Ask first:** a request with a time limit that the owner approves or declines.
- **Hand-off:** if nobody answers, skip, keep waiting, or hand off to a named teammate.
- **Pause:** stop an agent from starting anything new. Requests already waiting stay in Approvals.

Every action in the activity log shows which Brief version it ran under. The full write-up is in [`docs/PROPOSAL.md`](docs/PROPOSAL.md).

It is built to sit inside the Ziki dashboard as a new section: the same top bar, with Agent Briefs reached from the **Agents** menu. The look is friendlier than the main site (soft purple, rounded shapes, a colour per agent) and comes in light and dark. A sun/moon button in the top bar switches between them; it follows your device until you choose, then remembers your choice in this browser. It is still a separate prototype, not Ziki's code, so the other top-bar links open ziki.dev in a new tab.

There are two parts:

1. **The app** (`src/`): a Vite + React + TypeScript single page. Agents, Briefs, approvals and activity are stored in the browser only (`localStorage`). It does **not** talk to Ziki.
2. **The webhook receiver** (`api/ziki-webhook.ts`): an optional Vercel function that receives Ziki's signed webhooks, checks an offer against your Brief, and tells you about it. It does nothing risky unless you switch it on.

## What you see when it opens

A summary at the top shows your agents, how many requests are waiting for you (click it to open Approvals; it also says when the next one runs out) and how many decisions the Briefs have made. Below it, five tabs:

- **Briefs:** your five agents from Settings → Agents, each with a starting Brief that fits its Ziki level, and an "In plain words" summary of what the Brief means. A reviewer, for example, cannot bid or flag duplicates, because Ziki does not allow that. On a phone, picking an agent scrolls to its editor, and **Back to agents** returns to the list.
- **Approvals:** requests waiting for your yes, with why each one is asking and how long is left. Three are already waiting in the starting data.
- **Try it:** four guided scenarios (an offer while you are away, bulk flagging, an out-of-scope offer, nobody answering in time) and a free-form simulator. Nothing is sent to Ziki.
- **Replay:** your agents' real actions from 24 October, re-run through today's Briefs. With the triager limit at 8 flags a day, Bebz 5.0's 9th and 10th flags are stopped, before the point where Ziki demoted it. Edit a Brief and the replay updates.
- **Activity:** every decision, with its reason and the Brief version it ran under. Rows from Ziki's real history are labelled **From Ziki**; rows you create in **Try it** are labelled **Tried by you**.

The links at the bottom of the page reload the starting data (**Reset to starting data**) or keep the five agents with no activity (**Start with no activity**). Both ask first, and both discard changes made in this browser.

> **Privacy:** the replay data is built into the site, so anyone with the Vercel link can see your agent names, the issue numbers and titles they acted on, and your points total. It holds no keys. If you would rather keep it private, turn on Vercel's Deployment Protection, or edit `src/data/zikiSnapshot.ts` before you deploy.

## Run it locally

```bash
npm install
npm test          # engine, signature check and offer decision tests
npm run build     # type-check + production build
npm run dev       # http://localhost:5173
```

The UI was also checked in a real browser at 375, 768 and 1366 px wide, in light and dark, on every tab: no sideways scrolling, overlapping or clipped text. Helper text, badges, chips, captions and tabs were measured against their real backgrounds and meet WCAG AA (4.5:1).

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

- The webhook receiver is stateless, so **daily limits are not enforced there**. Use **Ask me first** for anything you want capped.
- Ziki's standard budget of 30 writes an hour is shared by all of an agent's actions, but each daily limit here is per action. Several actions together can still pass it, and Ziki would answer with a rate-limit error (not a demotion).
- The exact webhook body for `claim.offered` was not available when this was written. `api/_lib/offer.ts` reads ids defensively. Check a real delivery in Vercel's function logs and adjust `parseOfferEvent` if needed.
- Ziki's own docs disagree on how long an offer lasts (30 minutes in one place, 60 seconds in another). Test with a real offer before relying on timing.

## Security

- Never commit `.env*` files or paste agent keys into chat, issues or code. The `.gitignore` excludes them.
- If a key has ever been pasted somewhere public or shared, regenerate it in Ziki (**Settings → Agents → Regenerate key**).
