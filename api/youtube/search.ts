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

declare const process: { env: Record<string, string | undefined> };

const allowedOrigins = new Set([
  'https://reproductor-de-musica-sable.vercel.app',
  'https://reproductor-de-musica-e1mk.onrender.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);
const cache = new Map<string, { expiresAt: number; body: string }>();
const cacheDurationMs = 10 * 60 * 1000;

/** Endpoint server-side: mantiene la clave fuera del navegador y limita la respuesta a metadatos públicos. */
export default async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get('origin') ?? '';
  if (!isAllowedOrigin(origin)) return json({ error: { message: 'Origen no autorizado.' } }, 403);
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'GET') return json({ error: { message: 'Método no permitido.' } }, 405, corsHeaders);

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (!query || query.length > 120) return json({ error: { message: 'Escribe una búsqueda de hasta 120 caracteres.' } }, 400, corsHeaders);
  const cached = cache.get(query.toLocaleLowerCase());
  if (cached && cached.expiresAt > Date.now()) {
    return new Response(cached.body, { status: 200, headers: responseHeaders(corsHeaders, true) });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return json({ error: { message: 'La búsqueda de YouTube aún no está configurada en el servidor.' } }, 503, corsHeaders);

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
    if (!searchResponse.ok) return upstreamError(searchResponse.status, await readPayload(searchResponse), corsHeaders);
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
    if (metadata.length === 0) return json({ items: [] }, 200, corsHeaders, true);

    const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    detailsUrl.search = new URLSearchParams({ part: 'contentDetails', id: metadata.map(({ videoId }) => videoId).join(',') }).toString();
    const detailsResponse = await fetch(detailsUrl, { headers: { 'x-goog-api-key': apiKey, Accept: 'application/json' } });
    if (!detailsResponse.ok) return upstreamError(detailsResponse.status, await readPayload(detailsResponse), corsHeaders);
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
    return new Response(body, { status: 200, headers: responseHeaders(corsHeaders, true) });
  } catch {
    return json({ error: { message: 'No se pudo consultar YouTube. Inténtalo de nuevo más tarde.' } }, 502, corsHeaders);
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

function upstreamError(status: number, payload: unknown, corsHeaders: Record<string, string>): Response {
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
  return json({ error: { message } }, quotaExceeded || status === 429 ? 429 : status === 403 ? 403 : 502, corsHeaders);
}

function responseHeaders(corsHeaders: Record<string, string>, cached: boolean): Headers {
  return new Headers({
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': `public, s-maxage=${cached ? 600 : 60}, stale-while-revalidate=120`
  });
}

function json(value: unknown, status: number, corsHeaders: Record<string, string> = {}, cached = false): Response {
  return new Response(JSON.stringify(value), { status, headers: responseHeaders(corsHeaders, cached) });
}

async function readPayload(response: Response): Promise<unknown> {
  try { return await response.json() as unknown; } catch { return null; }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}
