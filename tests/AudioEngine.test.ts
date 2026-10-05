import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserAudioEngine } from '../src/domain/AudioEngine';

class FakeAudio extends EventTarget {
  public duration = 123;
  public currentTime = 0;
  public volume = 1;
  public readyState = 0;
  public preload = 'metadata';
  public readonly play = vi.fn(async () => {});
  public readonly pause = vi.fn();
  private source = '';

  public get src(): string { return this.source; }
  public set src(value: string) { this.source = value; }

  public load(): void {
    if (this.source) queueMicrotask(() => {
      this.readyState = 1;
      this.dispatchEvent(new Event('loadedmetadata'));
    });
  }

  public removeAttribute(name: string): void {
    if (name === 'src') this.source = '';
  }
}

describe('BrowserAudioEngine', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lee archivos compatibles, extrae su duración y reproduce desde la URL local', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-track');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const audio = new FakeAudio();
    const engine = new BrowserAudioEngine(audio as unknown as HTMLAudioElement);
    const file = new File(['audio'], 'pista-de-prueba.mp3', { type: 'audio/mpeg' });

    const result = await engine.loadFiles([file]);

    expect(result.skippedFiles).toBe(0);
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0]).toMatchObject({ title: 'pista-de-prueba', artist: 'Artista desconocido', durationSec: 123 });
    expect(engine.hasFile(result.songs[0].id)).toBe(true);
    engine.setVolume(0.4);
    engine.play(result.songs[0], 0);
    engine.seek(45);
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.src).toBe('blob:local-track');
    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.currentTime).toBe(45);
    expect(engine.getCurrentTime()).toBe(45);
    expect(audio.volume).toBe(0.4);

    engine.keepFilesFor(new Set());
    engine.keepFilesFor(new Set([result.songs[0].id]));
    await vi.advanceTimersByTimeAsync(6000);
    expect(engine.hasFile(result.songs[0].id)).toBe(true);
    expect(revoke).not.toHaveBeenCalled();
    engine.keepFilesFor(new Set());
    await vi.advanceTimersByTimeAsync(5500);
    expect(engine.hasFile(result.songs[0].id)).toBe(false);
    expect(revoke).toHaveBeenCalledWith('blob:local-track');
    engine.dispose();
  });

  it('omite los archivos cuyo tipo y extensión no son de audio', async () => {
    vi.spyOn(URL, 'createObjectURL');
    const engine = new BrowserAudioEngine(new FakeAudio() as unknown as HTMLAudioElement);
    const file = new File(['texto'], 'notas.txt', { type: 'text/plain' });

    await expect(engine.loadFiles([file])).resolves.toEqual({ songs: [], skippedFiles: 1 });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    engine.dispose();
  });
});
