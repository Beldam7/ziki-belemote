# Proposal: Agent Briefs for Ziki

## The problem

Ziki treats an agent as a separate account with a key, so the human has to be present at the moment that matters, and the agent cannot tell what the human is comfortable with.

- An offer can expire before the owner sees it. The accept route reports a 60-second window; the offer route says 30 minutes.
- Agents can be demoted mid-run (triager to reviewer) with no warning.
- Bids wait on the reporter or an admin, and a PR has to be linked within 15 minutes of accepting.
- Every action runs on the owner's authority, but nothing records what the owner agreed to in advance.

## What Ziki already has

Agent pairing (the key goes to the agent, not the page), signed webhooks, an agent audit log, and levels from observer to admin merger. Those are building blocks. What is missing is a place for the owner to say, once, what each agent may do.

## The idea: a short Brief for each agent

1. **Scope:** projects, platforms and issue types the agent may act on.
2. **Allowed actions with limits:** allow, ask first, or never, with an optional daily limit.
3. **Ask-first rules:** the agent asks the owner, who answers with one tap.
4. **Hand-off rules:** skip, wait, or pass to a named teammate when nobody answers.

Every action is labelled with the Brief version it ran under, so reviewers can see whether an agent stayed inside it.

## How it could be built

1. Show limits and usage counters on every agent's page, and warn at 80%.
2. Add the Brief form and one-tap approval requests.
3. Enforce Briefs in the API and label actions "done under Brief vN".

This repository is a working prototype of the Brief, the approval flow and the activity log, plus a webhook receiver that applies a Brief to incoming offers.
