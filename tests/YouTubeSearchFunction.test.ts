import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/youtube/search';

describe('función privada de búsqueda de YouTube', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('usa la clave en el encabezado del servidor y devuelve duración sin exponer la clave', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'key-used-only-by-server');
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ items: [{
        id: { videoId: 'abcdefghijk' },
        snippet: { title: 'Canción de prueba', channelTitle: 'Canal oficial', thumbnails: { high: { url: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg' } } }
      }] }))
      .mockResolvedValueOnce(Response.json({ items: [{ id: 'abcdefghijk', contentDetails: { duration: 'PT3M39S' } }] }));
    vi.stubGlobal('fetch', fetch);
    const response = await invoke(`https://reproductor-de-musica-sable.vercel.app/api/youtube/search?q=prueba-${Date.now()}`, 'https://reproductor-de-musica-sable.vercel.app');
    const body = await response.json() as { items: Array<Record<string, unknown>> };
    const firstCall = fetch.mock.calls[0] as unknown as [URL, RequestInit];

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://reproductor-de-musica-sable.vercel.app');
    expect(body.items[0]).toMatchObject({ videoId: 'abcdefghijk', durationSec: 219, artist: 'Canal oficial' });
    expect(JSON.stringify(body)).not.toContain('key-used-only-by-server');
    expect(new Headers(firstCall[1].headers).get('x-goog-api-key')).toBe('key-used-only-by-server');
    expect(firstCall[0].search).not.toContain('key-used-only-by-server');
  });

  it('rechaza llamadas de dominios no aprobados antes de consultar Google', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = await invoke('https://host.example/api/youtube/search?q=test', 'https://host.example');

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('devuelve 503 sin consultar a Google si no existe el secreto', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', '');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = await invoke(`https://reproductor-de-musica-sable.vercel.app/api/youtube/search?q=sin-clave-${Date.now()}`, 'https://reproductor-de-musica-sable.vercel.app');

    expect(response.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('acepta la petición same-origin de Vercel cuando el navegador omite Origin', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', '');
    const response = await invoke(`https://reproductor-de-musica-sable.vercel.app/api/youtube/search?q=same-origin-${Date.now()}`, '');

    expect(response.status).toBe(503);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://reproductor-de-musica-sable.vercel.app');
  });
});

async function invoke(url: string, origin: string, method = 'GET'): Promise<Response> {
  const parsed = new URL(url);
  const headers = new Map<string, string>();
  let body = '';
  const response = {
    statusCode: 200,
    setHeader: (name: string, value: string) => headers.set(name.toLocaleLowerCase(), value),
    end: (value = '') => { body = value; }
  };
  await handler({
    method,
    url: `${parsed.pathname}${parsed.search}`,
    headers: { origin, host: parsed.host }
  }, response);
  return new Response(body || null, { status: response.statusCode, headers: Object.fromEntries(headers) });
}
