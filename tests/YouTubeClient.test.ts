import { afterEach, describe, expect, it, vi } from 'vitest';
import { YouTubeClient } from '../src/domain/YouTubeClient';

describe('cliente de búsqueda de YouTube', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('convierte resultados validados de la función privada en canciones reproducibles', async () => {
    vi.stubGlobal('window', { location: { hostname: 'reproductor-de-musica-sable.vercel.app' } });
    const fetch = vi.fn(async () => Response.json({ items: [{
      videoId: 'abcdefghijk',
      title: 'Luz de la noche',
      artist: 'Artista oficial',
      durationSec: 219,
      thumbnailUrl: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'
    }] }));
    vi.stubGlobal('fetch', fetch);

    const songs = await new YouTubeClient().searchVideos('  Luz de la noche  ');

    expect(fetch).toHaveBeenCalledWith('/api/youtube/search?q=Luz+de+la+noche', { headers: { Accept: 'application/json' } });
    expect(songs).toEqual([{
      id: 'youtube-abcdefghijk',
      title: 'Luz de la noche',
      artist: 'Artista oficial',
      durationSec: 219,
      favorite: false,
      youtubeVideoId: 'abcdefghijk',
      thumbnailUrl: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'
    }]);
  });

  it('ignora resultados incompletos y rechaza búsquedas demasiado largas', async () => {
    vi.stubGlobal('window', { location: { hostname: 'reproductor-de-musica-sable.vercel.app' } });
    const fetch = vi.fn(async () => Response.json({ items: [
      { videoId: 'abcdefghijk', title: 'Válida', artist: 'Canal', durationSec: 4, thumbnailUrl: 'https://i.ytimg.com/a.jpg' },
      { videoId: 'too-short', title: 'Inválida', artist: 'Canal', durationSec: 4, thumbnailUrl: 'https://i.ytimg.com/a.jpg' }
    ] }));
    vi.stubGlobal('fetch', fetch);
    const client = new YouTubeClient();

    await expect(client.searchVideos('v'.repeat(121))).rejects.toThrow('120 caracteres');
    await expect(client.searchVideos('consulta')).resolves.toHaveLength(1);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('muestra un mensaje claro si la función todavía no tiene clave de servidor', async () => {
    vi.stubGlobal('window', { location: { hostname: 'reproductor-de-musica-sable.vercel.app' } });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(
      { error: { message: 'La búsqueda de YouTube aún no está configurada en el servidor.' } },
      { status: 503 }
    )));
    await expect(new YouTubeClient().searchVideos('artista')).rejects.toThrow('aún no está configurada');
  });
});
