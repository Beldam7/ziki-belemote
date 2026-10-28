import { defaultBrief } from '../src/engine';
import type { Brief } from '../src/types';
import { decideOffer, parseOfferEvent, type IssueInfo } from './_lib/offer';
import { verifySignature } from './_lib/verify';

/**
 * Receives signed webhooks from Ziki.
 *
 * Safe by default: it only notifies you. It accepts an offer on your behalf only when
 * DRY_RUN=false AND AUTO_ACCEPT=true AND the Brief allows that offer.
 * Set the environment variables in the Vercel dashboard, never in the repo.
 */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function loadBrief(): Brief {
  const raw = process.env.BRIEF_JSON;
  if (!raw) return defaultBrief();
  try {
    return JSON.parse(raw) as Brief;
  } catch {
    // A broken Brief must never loosen the rules: fall back to the strict default.
    return defaultBrief();
  }
}

async function notify(message: string, title: string, link?: string): Promise<void> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: { Title: title, ...(link ? { Click: link } : {}) },
      body: message,
    });
  } catch {
    // Notification is best effort.
  }
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.ZIKI_WEBHOOK_SECRET;
  if (!secret) return json(500, { error: 'ZIKI_WEBHOOK_SECRET is not set' });

  // Verify against the exact bytes Ziki sent.
  const rawBody = await request.text();
  const check = verifySignature({
    secret,
    timestamp: request.headers.get('x-ziki-timestamp'),
    signature: request.headers.get('x-ziki-signature'),
    rawBody,
  });
  if (!check.ok) return json(401, { error: check.reason });

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const event = parseOfferEvent(body);
  if (event.type !== 'claim.offered') return json(200, { ignored: event.type });
  if (!event.claimId || !event.issueId) {
    await notify('An offer arrived but its ids could not be read. Check Ziki.', 'Ziki offer needs you', `${process.env.ZIKI_BASE_URL ?? 'https://ziki.dev'}/dashboard`);
    return json(200, { handled: 'unreadable_offer' });
  }

  const base = process.env.ZIKI_BASE_URL ?? 'https://ziki.dev';
  const projectId = process.env.ZIKI_PROJECT_ID ?? 'project_zedu';
  const key = process.env.ZIKI_AGENT_KEY;
  const issueUrl = `${base}/issues/${event.issueId}`;

  // Read the issue so the Brief can be checked against real details.
  let issue: IssueInfo = { id: event.issueId };
  if (key) {
    try {
      const res = await fetch(`${base}/api/v1/issues/${event.issueId}?projectId=${encodeURIComponent(projectId)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) issue = ((await res.json()) as { issue?: IssueInfo }).issue ?? issue;
    } catch {
      // Fall through: unreadable details mean "ask the owner".
    }
  }

  const { decision } = decideOffer(loadBrief(), issue, new Date().toISOString());
  const dryRun = process.env.DRY_RUN !== 'false';
  const autoAccept = process.env.AUTO_ACCEPT === 'true';
  const label = issue.title ?? event.issueId;

  if (decision.outcome === 'allowed' && autoAccept && !dryRun && key) {
    const res = await fetch(`${base}/api/v1/offers/${event.claimId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
    });
    await notify(
      res.ok
        ? `Accepted for you: ${label}. The delivery deadline has started.`
        : `Tried to accept ${label} but Ziki answered ${res.status}.`,
      res.ok ? 'Ziki offer accepted' : 'Ziki offer not accepted',
      issueUrl,
    );
    return json(200, { handled: 'accepted', status: res.status });
  }

  // Everything else goes to the owner.
  const prefix = decision.outcome === 'blocked' ? 'Outside your Brief' : decision.outcome === 'allowed' ? 'In scope (dry run, nothing accepted)' : 'Needs your yes';
  await notify(`${prefix}: ${label}. ${decision.reason}`, 'Ziki offer', issueUrl);
  return json(200, { handled: 'notified', outcome: decision.outcome, dryRun });
}

export function GET(): Response {
  return json(405, { error: 'POST only' });
}
