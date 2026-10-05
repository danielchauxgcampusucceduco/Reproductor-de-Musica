import type { AudioEngine, BrowserAudioEngine } from './AudioEngine';
import type { SpotifyPlaybackEngine } from './SpotifyPlaybackEngine';
import type { Song } from './Song';

type PlaybackSource = 'local' | 'spotify' | 'metadata';

/** Enruta canciones locales y de Spotify por sus motores sin cambiar el controlador de lista. */
export class HybridAudioEngine implements AudioEngine {
  private source: PlaybackSource = 'metadata';

  public constructor(
    private readonly local: BrowserAudioEngine,
    private readonly spotify: SpotifyPlaybackEngine
  ) {}

  public play(song: Song, positionSec: number): void {
    this.source = sourceFor(song, this.local);
    if (this.source === 'spotify') {
      this.local.pause();
      void this.spotify.play(song.spotifyUri!, positionSec).catch((error: unknown) => this.reportError(error));
      return;
    }
    this.spotify.pause();
    if (this.source === 'local') this.local.play(song, positionSec);
    else this.local.pause();
  }

  public pause(): void {
    if (this.source === 'spotify') this.spotify.pause();
    else this.local.pause();
  }

  public seek(positionSec: number, song?: Song): void {
    if (song) this.source = sourceFor(song, this.local);
    if (this.source === 'spotify') this.spotify.seek(positionSec);
    else if (this.source === 'local' && song) this.local.seek(positionSec, song);
    else if (this.source === 'local') this.local.seek(positionSec);
    else {
      this.local.pause();
      this.spotify.pause();
    }
  }

  public setVolume(volume: number): void {
    this.local.setVolume(volume);
    this.spotify.setVolume(volume);
  }

  public getCurrentTime(): number | null {
    return this.source === 'spotify'
      ? this.spotify.getCurrentTime()
      : this.source === 'local'
        ? this.local.getCurrentTime()
        : null;
  }

  public setEndedHandler(handler: () => void): void {
    this.local.setEndedHandler(handler);
    this.spotify.setEndedHandler(handler);
  }

  public setErrorHandler(handler: (error?: Error) => void): void {
    this.errorHandler = handler;
    this.local.setErrorHandler(() => handler());
    this.spotify.setErrorHandler(handler);
  }

  public hasFile(songId: string): boolean { return this.local.hasFile(songId); }
  public keepFiles(songIds: ReadonlySet<string>): void { this.local.keepFiles(songIds); }

  public dispose(): void {
    this.local.dispose();
    this.spotify.dispose();
  }

  private reportError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'No se pudo iniciar la reproducción de Spotify.';
    // The Spotify engine reports SDK errors directly; this path handles rejected start requests.
    this.errorHandler?.(new Error(message));
  }

  private errorHandler: ((error?: Error) => void) | null = null;
}

function sourceFor(song: Song, local: BrowserAudioEngine): PlaybackSource {
  if (song.spotifyUri) return 'spotify';
  return local.hasFile(song.id) ? 'local' : 'metadata';
}
