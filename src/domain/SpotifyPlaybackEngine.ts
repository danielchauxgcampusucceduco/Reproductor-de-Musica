import type { SpotifyClient } from './SpotifyClient';

interface SpotifyDevice {
  device_id: string;
}

interface SpotifySdkTrack {
  uri: string;
}

interface SpotifySdkState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: { current_track: SpotifySdkTrack };
}

interface SpotifySdkPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: 'ready' | 'not_ready', listener: (device: SpotifyDevice) => void): boolean;
  addListener(event: 'player_state_changed', listener: (state: SpotifySdkState | null) => void): boolean;
  addListener(event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error', listener: (error: { message: string }) => void): boolean;
  pause(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
}

interface SpotifySdk {
  Player: new (options: {
    name: string;
    volume: number;
    getOAuthToken(callback: (token: string) => void): void;
    enableMediaSession: boolean;
  }) => SpotifySdkPlayer;
}

declare global {
  interface Window {
    Spotify?: SpotifySdk;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

export interface SpotifyPlaybackState {
  ready: boolean;
  message: string;
}

let sdkLoading: Promise<void> | null = null;

/** Controla el dispositivo de navegador de Spotify y comunica su progreso al reproductor. */
export class SpotifyPlaybackEngine {
  private player: SpotifySdkPlayer | null = null;
  private deviceId: string | null = null;
  private connectPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private currentTimeSec: number | null = null;
  private endSignaled = false;
  private playRequest = 0;
  private volume = 0.72;
  private endedHandler: (() => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private state: SpotifyPlaybackState = { ready: false, message: 'Conecta Spotify para habilitar la reproducción.' };
  private readonly listeners = new Set<(state: SpotifyPlaybackState) => void>();

  public constructor(private readonly spotify: SpotifyClient) {}

  public subscribe(listener: (state: SpotifyPlaybackState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public get isReady(): boolean { return this.deviceId !== null; }

  public setEndedHandler(handler: () => void): void { this.endedHandler = handler; }
  public setErrorHandler(handler: (error: Error) => void): void { this.errorHandler = handler; }

  /** Carga el SDK oficial y registra un dispositivo Spotify Connect en el navegador. */
  public async connect(): Promise<void> {
    if (!this.spotify.isAuthenticated) throw new Error('Autoriza Spotify antes de conectar el reproductor.');
    if (this.deviceId) return;
    if (this.connectPromise) return this.connectPromise;

    this.setState({ ready: false, message: 'Conectando el dispositivo de Spotify…' });
    this.connectPromise = this.createPlayerAndConnect()
      .catch((error: unknown) => {
        this.clearReadyWait();
        this.player?.disconnect();
        this.player = null;
        this.deviceId = null;
        const message = error instanceof Error ? error.message : 'No se pudo conectar el reproductor de Spotify.';
        this.setState({ ready: false, message });
        throw error instanceof Error ? error : new Error(message);
      })
      .finally(() => { this.connectPromise = null; });
    return this.connectPromise;
  }

  /** Inicia una pista a través de Spotify Premium en el dispositivo conectado. */
  public async play(uri: string, positionSec: number): Promise<void> {
    const request = ++this.playRequest;
    const deviceId = await this.ensureConnected();
    if (request !== this.playRequest) return;
    this.currentTimeSec = Math.max(0, positionSec);
    this.endSignaled = false;
    await this.spotify.startPlayback(uri, positionSec, deviceId);
  }

  public pause(): void {
    this.playRequest += 1;
    if (this.player) void this.player.pause().catch((error: unknown) => this.reportError(error));
  }

  public seek(positionSec: number): void {
    this.currentTimeSec = Math.max(0, positionSec);
    if (this.player) void this.player.seek(Math.floor(positionSec * 1000)).catch((error: unknown) => this.reportError(error));
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.player) void this.player.setVolume(this.volume).catch((error: unknown) => this.reportError(error));
  }

  public getCurrentTime(): number | null { return this.currentTimeSec; }

  public dispose(): void {
    this.playRequest += 1;
    this.clearReadyWait();
    this.player?.disconnect();
    this.player = null;
    this.deviceId = null;
    this.currentTimeSec = null;
    this.endedHandler = null;
    this.errorHandler = null;
    this.listeners.clear();
  }

  private async ensureConnected(): Promise<string> {
    await this.connect();
    if (!this.deviceId) throw new Error('Spotify todavía no tiene un dispositivo listo para reproducir.');
    return this.deviceId;
  }

  private async createPlayerAndConnect(): Promise<void> {
    await loadSpotifySdk();
    if (this.deviceId) return;
    const sdk = window.Spotify;
    if (!sdk) throw new Error('No se pudo cargar el reproductor web de Spotify.');

    const ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.readyTimer = window.setTimeout(() => {
        this.clearReadyWait();
        reject(new Error('Spotify tardó demasiado en preparar el dispositivo. Intenta de nuevo.'));
      }, 20_000);
    });

    const player = new sdk.Player({
      name: 'Reproductor Oro',
      volume: this.volume,
      enableMediaSession: true,
      getOAuthToken: (callback) => {
        void this.spotify.getAccessToken().then(callback).catch((error: unknown) => this.reportError(error));
      }
    });
    this.player = player;
    player.addListener('ready', ({ device_id }) => {
      this.deviceId = device_id;
      this.setState({ ready: true, message: 'Spotify conectado y listo para reproducir.' });
      this.resolveReady?.();
      this.clearReadyWait();
      void player.setVolume(this.volume).catch((error: unknown) => this.reportError(error));
    });
    player.addListener('not_ready', () => {
      this.deviceId = null;
      this.setState({ ready: false, message: 'El dispositivo de Spotify se desconectó. Intenta reproducir de nuevo.' });
    });
    player.addListener('player_state_changed', (state) => this.handlePlaybackState(state));
    for (const event of ['initialization_error', 'authentication_error', 'account_error', 'playback_error'] as const) {
      player.addListener(event, ({ message }) => {
        const friendly = event === 'account_error'
          ? 'La reproducción web requiere una cuenta Spotify Premium.'
          : `Spotify: ${message}`;
        this.reportError(new Error(friendly));
        this.setState({ ready: false, message: friendly });
      });
    }

    const connected = await player.connect();
    if (!connected) throw new Error('Spotify no pudo conectar el dispositivo del navegador.');
    await ready;
  }

  private handlePlaybackState(state: SpotifySdkState | null): void {
    if (!state) return;
    this.currentTimeSec = Math.max(0, Math.floor(state.position / 1000));
    if (state.duration > 0 && state.position >= state.duration - 300 && !this.endSignaled) {
      this.endSignaled = true;
      this.endedHandler?.();
    } else if (state.position < state.duration - 1000) {
      this.endSignaled = false;
    }
  }

  private clearReadyWait(): void {
    if (this.readyTimer) window.clearTimeout(this.readyTimer);
    this.readyTimer = null;
    this.resolveReady = null;
  }

  private reportError(error: unknown): void {
    this.errorHandler?.(error instanceof Error ? error : new Error('Spotify no pudo completar la acción.'));
  }

  private setState(state: SpotifyPlaybackState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}

function loadSpotifySdk(): Promise<void> {
  if (window.Spotify?.Player) return Promise.resolve();
  if (sdkLoading) return sdkLoading;

  sdkLoading = new Promise<void>((resolve, reject) => {
    const previousReady = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      previousReady?.();
      if (window.Spotify?.Player) resolve();
      else reject(new Error('El SDK de Spotify se cargó sin inicializar.'));
    };

    let script = document.querySelector<HTMLScriptElement>('script[data-spotify-playback-sdk]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.dataset.spotifyPlaybackSdk = 'true';
      document.head.append(script);
    }
    script.addEventListener('error', () => reject(new Error('No se pudo descargar el SDK de Spotify.')), { once: true });
  }).catch((error: unknown) => {
    sdkLoading = null;
    throw error;
  });
  return sdkLoading;
}
