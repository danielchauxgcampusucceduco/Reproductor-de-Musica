import type { AudioEngine } from './AudioEngine';
import type { Song } from './Song';

interface YouTubePlayerEvent { target: YouTubePlayer; data: number; }
interface YouTubePlayer {
  loadVideoById(video: string | { videoId: string; startSeconds?: number }): void;
  cueVideoById(video: string | { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

interface YouTubeSdk {
  Player: new (element: HTMLElement, options: {
    width: string;
    height: string;
    playerVars: { controls: 1; playsinline: 1; rel: 0; origin?: string };
    events: {
      onReady: (event: YouTubePlayerEvent) => void;
      onStateChange: (event: YouTubePlayerEvent) => void;
      onError: (event: YouTubePlayerEvent) => void;
    };
  }) => YouTubePlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
}

declare global {
  interface Window {
    YT?: YouTubeSdk;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let sdkPromise: Promise<YouTubeSdk> | null = null;

/** Reproduce videos con el reproductor oficial visible de YouTube, no extrae ni convierte su audio. */
export class YouTubePlaybackEngine implements AudioEngine {
  private player: YouTubePlayer | null = null;
  private readyPromise: Promise<void> | null = null;
  private readyResolver: (() => void) | null = null;
  private currentVideoId: string | null = null;
  private currentTime: number | null = null;
  private volume = 72;
  private endedHandler: (() => void) | null = null;
  private errorHandler: (() => void) | null = null;
  private playbackStateHandler: ((isPlaying: boolean) => void) | null = null;
  private playRequest = 0;

  /** Monta y prepara una instancia persistente dentro de la zona visible del reproductor. */
  public attach(host: HTMLElement): void {
    if (this.readyPromise) return;
    this.readyPromise = new Promise<void>((resolve) => { this.readyResolver = resolve; });
    void loadYouTubeSdk().then((sdk) => {
      if (!host.isConnected) return;
      const target = document.createElement('div');
      target.className = 'youtube-player-target';
      host.replaceChildren(target);
      this.player = new sdk.Player(target, {
        width: '100%',
        height: '100%',
        playerVars: { controls: 1, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: (event) => {
            event.target.setVolume(this.volume);
            this.readyResolver?.();
            this.readyResolver = null;
          },
          onStateChange: (event) => {
            if (event.data === sdk.PlayerState.ENDED) this.endedHandler?.();
            if (event.data === sdk.PlayerState.PLAYING) this.playbackStateHandler?.(true);
            if (event.data === sdk.PlayerState.PAUSED) this.playbackStateHandler?.(false);
          },
          onError: () => this.errorHandler?.()
        }
      });
    }).catch(() => this.errorHandler?.());
  }

  /** Carga una canción de YouTube en el reproductor oficial visible. */
  public play(song: Song, positionSec: number): void {
    const videoId = song.youtubeVideoId;
    if (!videoId || !this.readyPromise) {
      this.errorHandler?.();
      return;
    }
    const request = ++this.playRequest;
    void this.readyPromise.then(() => {
      if (request !== this.playRequest || !this.player) return;
      this.currentVideoId = videoId;
      this.currentTime = Math.max(0, positionSec);
      this.player.loadVideoById({ videoId, startSeconds: this.currentTime });
    });
  }

  public pause(): void {
    this.playRequest += 1;
    this.player?.pauseVideo();
    const position = this.player?.getCurrentTime();
    if (position !== undefined && Number.isFinite(position)) this.currentTime = position;
  }

  public seek(positionSec: number, song?: Song): void {
    if (song?.youtubeVideoId && song.youtubeVideoId !== this.currentVideoId) {
      const videoId = song.youtubeVideoId;
      const request = ++this.playRequest;
      const position = Math.max(0, positionSec);
      void this.readyPromise?.then(() => {
        if (request !== this.playRequest || !this.player) return;
        this.currentVideoId = videoId;
        this.currentTime = position;
        this.player.cueVideoById({ videoId, startSeconds: position });
      });
      return;
    }
    const position = Math.max(0, positionSec);
    this.currentTime = position;
    if (this.player && this.currentVideoId) this.player.seekTo(position, true);
  }

  public setVolume(volume: number): void {
    this.volume = Math.round(Math.max(0, Math.min(1, volume)) * 100);
    this.player?.setVolume(this.volume);
  }

  public getCurrentTime(): number | null {
    const actual = this.player?.getCurrentTime();
    return actual !== undefined && Number.isFinite(actual) && actual >= 0 ? actual : this.currentTime;
  }

  public setEndedHandler(handler: () => void): void { this.endedHandler = handler; }
  public setErrorHandler(handler: () => void): void { this.errorHandler = handler; }
  public setPlaybackStateHandler(handler: (isPlaying: boolean) => void): void { this.playbackStateHandler = handler; }

  public dispose(): void {
    this.playRequest += 1;
    this.player?.destroy();
    this.player = null;
    this.currentVideoId = null;
    this.currentTime = null;
    this.endedHandler = null;
    this.errorHandler = null;
    this.playbackStateHandler = null;
  }
}

function loadYouTubeSdk(): Promise<YouTubeSdk> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<YouTubeSdk>((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube cargó el reproductor sin inicializarlo.'));
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-youtube-iframe-api]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.youtubeIframeApi = 'true';
      document.head.append(script);
    }
    script.addEventListener('error', () => reject(new Error('No se pudo cargar el reproductor oficial de YouTube.')), { once: true });
  });
  return sdkPromise;
}
