import type { Song } from './Song';

interface SearchResponse {
  items?: unknown;
  error?: unknown;
}

/** Busca videos públicos usando la función privada del proyecto; nunca recibe la clave API. */
export class YouTubeClient {
  public async searchVideos(query: string): Promise<Song[]> {
    const normalized = query.trim();
    if (!normalized) return [];
    if (normalized.length > 120) throw new Error('La búsqueda debe tener como máximo 120 caracteres.');

    const base = apiBaseUrl();
    const params = new URLSearchParams({ q: normalized });
    let response: Response;
    try {
      response = await fetch(`${base}/api/youtube/search?${params.toString()}`, {
        headers: { Accept: 'application/json' }
      });
    } catch {
      throw new Error('No se pudo conectar con el buscador de YouTube. Comprueba tu conexión e inténtalo de nuevo.');
    }

    const payload = await readJson(response);
    if (!response.ok) {
      const error = asRecord(asRecord(payload)?.error);
      const message = typeof error?.message === 'string' ? error.message : '';
      if (response.status === 429) throw new Error('YouTube limitó las búsquedas por hoy. Inténtalo más tarde.');
      if (response.status === 503) throw new Error('La búsqueda de YouTube aún no está configurada en el servidor.');
      if (response.status === 403) throw new Error(message || 'El servidor no tiene permiso para buscar en YouTube.');
      throw new Error(message || `YouTube no pudo completar la búsqueda (HTTP ${response.status}).`);
    }

    const items = asRecord(payload)?.items;
    if (!Array.isArray(items)) return [];
    return items.flatMap((raw): Song[] => {
      const item = asRecord(raw);
      if (!item) return [];
      const videoId = item.videoId;
      const title = item.title;
      const artist = item.artist;
      const durationSec = item.durationSec;
      const thumbnailUrl = item.thumbnailUrl;
      if (typeof videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(videoId)
        || typeof title !== 'string' || !title.trim()
        || typeof artist !== 'string' || !artist.trim()
        || typeof durationSec !== 'number' || !Number.isSafeInteger(durationSec) || durationSec <= 0
        || typeof thumbnailUrl !== 'string' || !isThumbnailUrl(thumbnailUrl)) return [];
      return [{
        id: `youtube-${videoId}`,
        title,
        artist,
        durationSec,
        favorite: false,
        youtubeVideoId: videoId,
        thumbnailUrl
      }];
    });
  }
}

function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_YOUTUBE_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  const hostname = window.location.hostname;
  return hostname === 'reproductor-de-musica-sable.vercel.app' ? '' : 'https://reproductor-de-musica-sable.vercel.app';
}

function isThumbnailUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['i.ytimg.com', 'img.youtube.com'].includes(url.hostname) && url.pathname.length > 1;
  } catch {
    return false;
  }
}

async function readJson(response: Response): Promise<SearchResponse> {
  try { return await response.json() as SearchResponse; } catch { return {}; }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}
