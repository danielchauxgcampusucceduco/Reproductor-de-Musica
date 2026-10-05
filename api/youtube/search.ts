interface YouTubeSearchItem {
  id?: { videoId?: unknown };
  snippet?: {
    title?: unknown;
    channelTitle?: unknown;
    thumbnails?: Record<string, { url?: unknown } | undefined>;
  };
}

interface YouTubeVideoItem {
  id?: unknown;
  contentDetails?: { duration?: unknown };
}

interface YouTubeListResponse<T> { items?: T[]; }

interface VercelRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

declare const process: { env: Record<string, string | undefined> };

const allowedOrigins = new Set([
  'https://reproductor-de-musica-sable.vercel.app',
  'https://reproductor-de-musica-e1mk.onrender.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);
const cache = new Map<string, { expiresAt: number; body: string }>();
const cacheDurationMs = 10 * 60 * 1000;

/** Endpoint Node.js de Vercel: mantiene la clave fuera del navegador y limita la respuesta a metadatos públicos. */
export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  const originHeader = headerValue(request.headers.origin);
  const requestHost = headerValue(request.headers.host);
  const origin = originHeader || `https://${requestHost || 'reproductor-de-musica-sable.vercel.app'}`;
  if (!isAllowedOrigin(origin)) {
    sendJson(response, 403, { error: { message: 'Origen no autorizado.' } });
    return;
  }
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (request.method === 'OPTIONS') {
    send(response, 204, '', corsHeaders);
    return;
  }
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: { message: 'Método no permitido.' } }, corsHeaders);
    return;
  }

  const host = requestHost || 'reproductor-de-musica-sable.vercel.app';
  const query = new URL(request.url ?? '/', `https://${host}`).searchParams.get('q')?.trim() ?? '';
  if (!query || query.length > 120) {
    sendJson(response, 400, { error: { message: 'Escribe una búsqueda de hasta 120 caracteres.' } }, corsHeaders);
    return;
  }
  const cached = cache.get(query.toLocaleLowerCase());
  if (cached && cached.expiresAt > Date.now()) {
    send(response, 200, cached.body, responseHeaders(corsHeaders, true));
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    sendJson(response, 503, { error: { message: 'La búsqueda de YouTube aún no está configurada en el servidor.' } }, corsHeaders);
    return;
  }

  try {
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.search = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
      safeSearch: 'moderate',
      maxResults: '8',
      q: query
    }).toString();
    const searchResponse = await fetch(searchUrl, { headers: { 'x-goog-api-key': apiKey, Accept: 'application/json' } });
    if (!searchResponse.ok) {
      const error = getUpstreamError(searchResponse.status, await readPayload(searchResponse));
      sendJson(response, error.status, { error: { message: error.message } }, corsHeaders);
      return;
    }
    const searchResult = await searchResponse.json() as YouTubeListResponse<YouTubeSearchItem>;
    const searchItems = Array.isArray(searchResult.items) ? searchResult.items : [];
    const metadata = searchItems.flatMap((item) => {
      const videoId = item.id?.videoId;
      const title = item.snippet?.title;
      const artist = item.snippet?.channelTitle;
      const thumbnails = item.snippet?.thumbnails;
      const thumbnailUrl = [thumbnails?.high?.url, thumbnails?.medium?.url, thumbnails?.default?.url]
        .find((url): url is string => typeof url === 'string' && isYouTubeThumbnail(url));
      return typeof videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(videoId)
        && typeof title === 'string' && typeof artist === 'string' && thumbnailUrl
        ? [{ videoId, title, artist, thumbnailUrl }]
        : [];
    });
    if (metadata.length === 0) {
      sendJson(response, 200, { items: [] }, corsHeaders, true);
      return;
    }

    const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    detailsUrl.search = new URLSearchParams({ part: 'contentDetails', id: metadata.map(({ videoId }) => videoId).join(',') }).toString();
    const detailsResponse = await fetch(detailsUrl, { headers: { 'x-goog-api-key': apiKey, Accept: 'application/json' } });
    if (!detailsResponse.ok) {
      const error = getUpstreamError(detailsResponse.status, await readPayload(detailsResponse));
      sendJson(response, error.status, { error: { message: error.message } }, corsHeaders);
      return;
    }
    const detailsResult = await detailsResponse.json() as YouTubeListResponse<YouTubeVideoItem>;
    const durations = new Map<string, number>();
    for (const item of Array.isArray(detailsResult.items) ? detailsResult.items : []) {
      if (typeof item.id === 'string' && typeof item.contentDetails?.duration === 'string') {
        const durationSec = parseDuration(item.contentDetails.duration);
        if (durationSec > 0) durations.set(item.id, durationSec);
      }
    }
    const items = metadata.flatMap((item) => {
      const durationSec = durations.get(item.videoId);
      return durationSec ? [{ ...item, durationSec }] : [];
    });
    const body = JSON.stringify({ items });
    cache.set(query.toLocaleLowerCase(), { expiresAt: Date.now() + cacheDurationMs, body });
    while (cache.size > 100) cache.delete(cache.keys().next().value as string);
    send(response, 200, body, responseHeaders(corsHeaders, true));
  } catch {
    sendJson(response, 502, { error: { message: 'No se pudo consultar YouTube. Inténtalo de nuevo más tarde.' } }, corsHeaders);
  }
}

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:'
      && (url.hostname === 'reproductor-de-musica-sable.vercel.app'
        || url.hostname.endsWith('--reproductor-de-musica-sable.vercel.app'));
  } catch {
    return false;
  }
}

function isYouTubeThumbnail(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'i.ytimg.com' && url.pathname.length > 1;
  } catch {
    return false;
  }
}

function parseDuration(value: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return 0;
  return (Number(match[1] ?? 0) * 3600) + (Number(match[2] ?? 0) * 60) + Number(match[3] ?? 0);
}

function getUpstreamError(status: number, payload: unknown): { status: number; message: string } {
  const details = asRecord(asRecord(payload)?.error);
  const reasons = Array.isArray(details?.errors)
    ? details.errors.flatMap((entry) => typeof asRecord(entry)?.reason === 'string' ? [asRecord(entry)?.reason as string] : [])
    : [];
  const quotaExceeded = reasons.some((reason) => ['quotaExceeded', 'dailyLimitExceeded'].includes(reason));
  const message = quotaExceeded
    ? 'Se alcanzó el límite diario de búsquedas de YouTube. Inténtalo mañana.'
    : reasons.some((reason) => ['keyInvalid', 'accessNotConfigured', 'forbidden'].includes(reason))
      ? 'La clave de YouTube del servidor no está habilitada para YouTube Data API v3.'
      : status === 429
        ? 'YouTube limitó las búsquedas temporalmente. Inténtalo en unos minutos.'
        : 'YouTube rechazó la búsqueda. Comprueba que YouTube Data API v3 esté habilitada para la clave.';
  return { status: quotaExceeded || status === 429 ? 429 : status === 403 ? 403 : 502, message };
}

function responseHeaders(corsHeaders: Record<string, string>, cached: boolean): Record<string, string> {
  return {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': `public, s-maxage=${cached ? 600 : 60}, stale-while-revalidate=120`
  };
}

function sendJson(response: VercelResponse, status: number, value: unknown, corsHeaders: Record<string, string> = {}, cached = false): void {
  send(response, status, JSON.stringify(value), responseHeaders(corsHeaders, cached));
}

function send(response: VercelResponse, status: number, body: string, headers: Record<string, string>): void {
  response.statusCode = status;
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  response.end(body);
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

async function readPayload(response: Response): Promise<unknown> {
  try { return await response.json() as unknown; } catch { return null; }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}
