import { afterEach, describe, expect, it, vi } from 'vitest';
import { YouTubePlaybackEngine } from '../src/domain/YouTubePlaybackEngine';
import type { Song } from '../src/domain/Song';

const song: Song = {
  id: 'youtube-abcdefghijk',
  title: 'Pista de prueba',
  artist: 'Canal de prueba',
  durationSec: 185,
  favorite: false,
  youtubeVideoId: 'abcdefghijk'
};

interface FakeYouTubePlayerOptions {
  playerVars: { controls: 1; playsinline: 1; rel: 0; origin?: string };
  events: {
    onReady: (event: { target: object; data: number }) => void;
    onStateChange: (event: { target: object; data: number }) => void;
    onError: (event: { target: object; data: number }) => void;
  };
}

describe('YouTubePlaybackEngine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('carga y controla la canción con la API oficial de iframe visible', async () => {
    const captured: { player: FakeYouTubePlayer | null; options: FakeYouTubePlayerOptions | null } = { player: null, options: null };
    class FakeYouTubePlayer {
      public readonly loadVideoById = vi.fn();
      public readonly cueVideoById = vi.fn();
      public readonly playVideo = vi.fn();
      public readonly pauseVideo = vi.fn();
      public readonly seekTo = vi.fn();
      public readonly setVolume = vi.fn();
      public readonly getCurrentTime = vi.fn(() => 29);
      public readonly getDuration = vi.fn(() => 185);
      public readonly destroy = vi.fn();

      public constructor(_element: HTMLElement, playerOptions: FakeYouTubePlayerOptions) {
        captured.player = this;
        captured.options = playerOptions;
        queueMicrotask(() => playerOptions.events.onReady({ target: this, data: 1 }));
      }
    }
    vi.stubGlobal('window', {
      YT: { Player: FakeYouTubePlayer, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } },
      location: { origin: 'https://player.example' }
    });
    vi.stubGlobal('document', { createElement: () => ({ className: '' }) });
    const host = { isConnected: true, replaceChildren: vi.fn() } as unknown as HTMLElement;
    const engine = new YouTubePlaybackEngine();
    const ended = vi.fn();
    const playbackState = vi.fn();
    engine.setEndedHandler(ended);
    engine.setPlaybackStateHandler(playbackState);
    engine.setVolume(0.4);
    engine.attach(host);
    engine.play(song, 12);

    await vi.waitFor(() => expect(captured.player?.loadVideoById).toHaveBeenCalledWith({ videoId: 'abcdefghijk', startSeconds: 12 }));
    expect(captured.options?.playerVars).toMatchObject({ controls: 1, playsinline: 1, rel: 0 });
    expect(captured.player?.setVolume).toHaveBeenCalledWith(40);
    expect(engine.getCurrentTime()).toBe(29);
    engine.seek(61, song);
    expect(captured.player?.seekTo).toHaveBeenCalledWith(61, true);
    captured.options?.events.onStateChange({ target: captured.player!, data: 0 });
    expect(ended).toHaveBeenCalledOnce();
    captured.options?.events.onStateChange({ target: captured.player!, data: 1 });
    captured.options?.events.onStateChange({ target: captured.player!, data: 2 });
    expect(playbackState.mock.calls).toEqual([[true], [false]]);
    engine.dispose();
    expect(captured.player?.destroy).toHaveBeenCalledOnce();
  });
});
