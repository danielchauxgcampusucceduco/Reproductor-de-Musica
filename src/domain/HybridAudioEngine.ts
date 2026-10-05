import type { AudioEngine, BrowserAudioEngine } from './AudioEngine';
import type { YouTubePlaybackEngine } from './YouTubePlaybackEngine';
import type { Song } from './Song';

type PlaybackSource = 'local' | 'youtube' | 'metadata';

/** Enruta archivos locales y videos de YouTube por sus motores oficiales. */
export class HybridAudioEngine implements AudioEngine {
  private source: PlaybackSource = 'metadata';

  public constructor(
    private readonly local: BrowserAudioEngine,
    private readonly youtube: YouTubePlaybackEngine
  ) {}

  public play(song: Song, positionSec: number): void {
    this.source = sourceFor(song, this.local);
    if (this.source === 'youtube') {
      this.local.pause();
      this.youtube.play(song, positionSec);
      return;
    }
    this.youtube.pause();
    if (this.source === 'local') this.local.play(song, positionSec);
    else this.local.pause();
  }

  public pause(): void {
    if (this.source === 'youtube') this.youtube.pause();
    else this.local.pause();
  }

  public seek(positionSec: number, song?: Song): void {
    if (song) this.source = sourceFor(song, this.local);
    if (this.source === 'youtube') this.youtube.seek(positionSec, song);
    else if (this.source === 'local' && song) this.local.seek(positionSec, song);
    else if (this.source === 'local') this.local.seek(positionSec);
    else {
      this.local.pause();
      this.youtube.pause();
    }
  }

  public setVolume(volume: number): void {
    this.local.setVolume(volume);
    this.youtube.setVolume(volume);
  }

  public getCurrentTime(): number | null {
    return this.source === 'youtube'
      ? this.youtube.getCurrentTime()
      : this.source === 'local'
        ? this.local.getCurrentTime()
        : null;
  }

  public setEndedHandler(handler: () => void): void {
    this.local.setEndedHandler(handler);
    this.youtube.setEndedHandler(handler);
  }

  public setErrorHandler(handler: (error?: Error) => void): void {
    this.local.setErrorHandler(() => handler());
    this.youtube.setErrorHandler(() => handler(new Error('YouTube no pudo reproducir este video. Puede estar bloqueado para inserción.')));
  }

  public setPlaybackStateHandler(handler: (isPlaying: boolean) => void): void {
    this.youtube.setPlaybackStateHandler(handler);
  }

  public hasFile(songId: string): boolean { return this.local.hasFile(songId); }
  public keepFiles(songIds: ReadonlySet<string>): void { this.local.keepFiles(songIds); }

  public dispose(): void {
    this.local.dispose();
    this.youtube.dispose();
  }
}

function sourceFor(song: Song, local: BrowserAudioEngine): PlaybackSource {
  if (song.youtubeVideoId) return 'youtube';
  return local.hasFile(song.id) ? 'local' : 'metadata';
}
