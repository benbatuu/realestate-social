import { createHmac } from 'node:crypto';

/**
 * Talks to a LeadPilot workspace over its signed endpoints. The signature is HMAC-SHA256 over
 * "<timestamp>.<body>" with the connection secret, sent as `x-leadpilot-signature: sha256=<hex>`.
 * GET requests sign an empty body.
 */
export const LEADPILOT_TIMEOUT_MS = 15_000;
export const PHOTO_DOWNLOAD_MAX_BYTES = 15 * 1024 * 1024;

export interface LeadPilotConnectionInfo {
  baseUrl: string;
  connectionId: string;
  signingSecret: string;
}

export function signRequest(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex')}`;
}

export interface FeedProperty {
  id: string;
  internalCode: string;
  title: string;
  propertyType: string;
  transactionType: string;
  price: string | null;
  currency: string;
  description: string | null;
  grossAreaM2: string | null;
  netAreaM2: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floorNumber: number | null;
  totalFloors: number | null;
  buildingAge: number | null;
  furnished: boolean | null;
  city: string | null;
  district: string;
  neighborhood: string | null;
  active: boolean;
  draft: boolean;
  updatedAt: string;
  photos: { id: string; url: string; sortOrder: number }[];
}

export interface FeedPage {
  items: FeedProperty[];
  hasMore: boolean;
}

export class LeadPilotError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'LeadPilotError';
  }
}

/** Only https, or plain http for local development hosts. */
export function assertBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new LeadPilotError('LeadPilot adresi geçerli bir adres değil.', null);
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new LeadPilotError('LeadPilot adresi https ile başlamalı.', null);
  }
  return url.origin;
}

export async function fetchFeedPage(
  info: LeadPilotConnectionInfo,
  opts: { updatedSince?: string | null; limit?: number },
): Promise<FeedPage> {
  const params = new URLSearchParams();
  if (opts.updatedSince) params.set('updatedSince', opts.updatedSince);
  params.set('limit', String(opts.limit ?? 200));
  const path = `/api/v1/portfolio-feed/properties?${params.toString()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const res = await send(`${info.baseUrl}${path}`, {
    method: 'GET',
    headers: {
      'x-leadpilot-connection-id': info.connectionId,
      'x-leadpilot-timestamp': timestamp,
      'x-leadpilot-signature': signRequest(info.signingSecret, timestamp, ''),
    },
  });
  return (await res.json()) as FeedPage;
}

/** Sends one lead to the connection's generic signed webhook. */
export async function pushLead(
  info: LeadPilotConnectionInfo,
  payload: { event_id: string; lead: Record<string, unknown> },
): Promise<void> {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  await send(`${info.baseUrl}/api/v1/lead-intake/webhooks/${info.connectionId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-leadpilot-timestamp': timestamp,
      'x-leadpilot-signature': signRequest(info.signingSecret, timestamp, body),
    },
    body,
  });
}

async function send(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(LEADPILOT_TIMEOUT_MS) });
  } catch {
    throw new LeadPilotError('LeadPilot’a ulaşılamadı.', null);
  }
  if (res.status === 401 || res.status === 403) {
    throw new LeadPilotError('LeadPilot bağlantı bilgilerini kabul etmedi.', res.status);
  }
  if (!res.ok) throw new LeadPilotError(`LeadPilot yanıt hatası (${res.status}).`, res.status);
  return res;
}

/** Downloads one photo the feed linked to. The link is short-lived, so this runs during the sync. */
export async function downloadPhoto(url: string): Promise<Buffer | null> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(LEADPILOT_TIMEOUT_MS) });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > PHOTO_DOWNLOAD_MAX_BYTES) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > 0 && buf.length <= PHOTO_DOWNLOAD_MAX_BYTES ? buf : null;
}
