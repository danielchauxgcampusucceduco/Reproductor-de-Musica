import type { Song } from './Song';

/** Contrato para conectar audio real o una reproducción simulada al controlador. */
export interface AudioEngine {
  /** Inicia una canción desde la posición indicada. */
  play(song: Song, positionSec: number): void;
  /** Pausa el audio actual. */
  pause(): void;
  /** Busca una posición nueva en la canción. */
  seek(positionSec: number, song?: Song): void;
  /** Actualiza el volumen entre 0 y 1. */
  setVolume(volume: number): void;
  /** Devuelve el progreso real si la canción tiene un archivo cargado. */
  getCurrentTime?(): number | null;
  /** Registra la transición automática al finalizar el audio. */
  setEndedHandler?(handler: () => void): void;
  /** Registra un error reproducible para comunicarlo desde la interfaz. */
  setErrorHandler?(handler: () => void): void;
  /** Indica si la canción tiene un archivo local asociado. */
  hasFile?(songId: string): boolean;
  /** Libera archivos que ya no pertenecen a la playlist. */
  keepFiles?(songIds: ReadonlySet<string>): void;
  /** Libera recursos temporales al cerrar la aplicación. */
  dispose?(): void;
}

export interface FolderImportResult {
  songs: Song[];
  skippedFiles: number;
}

/** Reproduce los archivos elegidos por el usuario mediante un elemento de audio del navegador. */
export class BrowserAudioEngine implements AudioEngine {
  private static readonly removalGraceMs = 5500;
  private readonly audio: HTMLAudioElement;
  private readonly sources = new Map<string, string>();
  private readonly releaseTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private currentFileId: string | null = null;
  private playRequest = 0;
  private pendingSeek: { songId: string; seconds: number } | null = null;
  private endedHandler: (() => void) | null = null;
  private errorHandler: (() => void) | null = null;

  /** Crea un motor de audio HTML5 con precarga de metadatos. */
  public constructor(audio: HTMLAudioElement = new Audio()) {
    this.audio = audio;
    this.audio.preload = 'metadata';
    this.audio.addEventListener('ended', () => this.endedHandler?.());
    this.audio.addEventListener('error', () => this.errorHandler?.());
    this.audio.addEventListener('loadedmetadata', () => this.applyPendingSeek());
  }

  /** O(n) en cantidad de archivos. Lee sus duraciones y prepara URLs temporales locales. */
  public async loadFiles(files: readonly File[]): Promise<FolderImportResult> {
    const supportedFiles = files.filter(isPotentialAudioFile);
    const results: Array<{ song: Song; url: string } | null> = new Array(supportedFiles.length).fill(null);
    let nextIndex = 0;
    const workerCount = Math.min(6, supportedFiles.length);
    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (nextIndex < supportedFiles.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await this.loadFile(supportedFiles[index]);
      }
    }));
    const successful = results.filter((result): result is { song: Song; url: string } => result !== null);
    for (const { song, url } of successful) this.sources.set(song.id, url);
    return { songs: successful.map(({ song }) => song), skippedFiles: files.length - successful.length };
  }

  /** O(n). Conserva brevemente URLs quitadas para que Deshacer pueda restaurarlas. */
  public keepFilesFor(songIds: ReadonlySet<string>): void {
    for (const [songId, url] of this.sources) {
      const pendingRelease = this.releaseTimers.get(songId);
      if (songIds.has(songId)) {
        if (pendingRelease) window.clearTimeout(pendingRelease);
        this.releaseTimers.delete(songId);
        continue;
      }
      if (pendingRelease) continue;
      const timer = window.setTimeout(() => this.releaseFile(songId, url), BrowserAudioEngine.removalGraceMs);
      this.releaseTimers.set(songId, timer);
    }
  }

  /** O(1). Reproduce un archivo local o deja que el controlador simule canciones manuales. */
  public play(song: Song, positionSec: number): void {
    const source = this.sources.get(song.id);
    if (!source) {
      this.clearCurrentSource();
      return;
    }
    if (this.currentFileId !== song.id) {
      this.audio.src = source;
      this.currentFileId = song.id;
      this.pendingSeek = null;
      this.audio.load();
    }
    this.setPosition(song.id, positionSec);
    const request = ++this.playRequest;
    void this.audio.play().catch(() => {
      if (request === this.playRequest) this.errorHandler?.();
    });
  }

  /** O(1). Pausa sin perder la posición. */
  public pause(): void {
    this.playRequest += 1;
    this.audio.pause();
  }

  /** O(1). Actualiza la posición del archivo activo. */
  public seek(positionSec: number, song?: Song): void {
    if (song) {
      const source = this.sources.get(song.id);
      if (!source) {
        if (this.currentFileId) this.clearCurrentSource();
        return;
      }
      if (this.currentFileId !== song.id) {
        this.audio.src = source;
        this.currentFileId = song.id;
        this.pendingSeek = null;
        this.audio.load();
      }
    }
    if (this.currentFileId) this.setPosition(this.currentFileId, positionSec);
  }

  /** O(1). Ajusta el volumen nativo del elemento de audio. */
  public setVolume(volume: number): void { this.audio.volume = Math.max(0, Math.min(1, volume)); }

  /** O(1). Lee la posición real del archivo o indica que el tema no tiene audio adjunto. */
  public getCurrentTime(): number | null {
    return this.currentFileId ? this.audio.currentTime : null;
  }

  /** O(1). Registra el evento de fin de pista del navegador. */
  public setEndedHandler(handler: () => void): void { this.endedHandler = handler; }

  /** O(1). Registra errores de decodificación o permisos de reproducción. */
  public setErrorHandler(handler: () => void): void { this.errorHandler = handler; }

  /** O(1). Indica si el identificador pertenece a un archivo cargado. */
  public hasFile(songId: string): boolean { return this.sources.has(songId); }

  /** O(n). Revoca los recursos que no aparecen en la lista vigente. */
  public keepFiles(songIds: ReadonlySet<string>): void { this.keepFilesFor(songIds); }

  /** O(n). Pausa el audio y libera todas las URLs locales. */
  public dispose(): void {
    this.clearCurrentSource();
    for (const timer of this.releaseTimers.values()) window.clearTimeout(timer);
    this.releaseTimers.clear();
    for (const url of this.sources.values()) URL.revokeObjectURL(url);
    this.sources.clear();
    this.endedHandler = null;
    this.errorHandler = null;
  }

  private async loadFile(file: File): Promise<{ song: Song; url: string } | null> {
    let url: string | null = null;
    try {
      url = URL.createObjectURL(file);
      const durationSec = await readDuration(url);
      const pathParts = file.webkitRelativePath?.split('/').filter(Boolean) ?? [];
      const artist = pathParts.length > 1 ? pathParts[pathParts.length - 2] : 'Artista desconocido';
      return {
        url,
        song: {
          id: createTrackId(),
          title: file.name.replace(/\.[^.]+$/, '').trim() || file.name,
          artist,
          durationSec,
          favorite: false
        }
      };
    } catch {
      if (url) URL.revokeObjectURL(url);
      return null;
    }
  }

  private clearCurrentSource(): void {
    this.pause();
    this.pendingSeek = null;
    this.audio.removeAttribute('src');
    this.audio.load();
    this.currentFileId = null;
  }

  private setPosition(songId: string, seconds: number): void {
    const position = Math.max(0, seconds);
    if (this.audio.readyState > 0) {
      this.audio.currentTime = Number.isFinite(this.audio.duration)
        ? Math.min(position, this.audio.duration)
        : position;
      this.pendingSeek = null;
    } else {
      this.pendingSeek = { songId, seconds: position };
    }
  }

  private applyPendingSeek(): void {
    const pending = this.pendingSeek;
    if (!pending || pending.songId !== this.currentFileId) return;
    this.setPosition(pending.songId, pending.seconds);
  }

  private releaseFile(songId: string, url: string): void {
    if (this.sources.get(songId) !== url) return;
    if (this.currentFileId === songId) this.clearCurrentSource();
    this.sources.delete(songId);
    this.releaseTimers.delete(songId);
    URL.revokeObjectURL(url);
  }
}

/** Implementación vacía usada en pruebas y para canciones agregadas solo como metadatos. */
export class SilentAudioEngine implements AudioEngine {
  public play(_song: Song, _positionSec: number): void {}
  public pause(): void {}
  public seek(_positionSec: number, _song?: Song): void {}
  public setVolume(_volume: number): void {}
}

function isPotentialAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|wave|ogg|oga|opus|flac|webm|aiff?)$/i.test(file.name);
}

function readDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    const timeout = window.setTimeout(() => finish(new Error('No se pudieron leer los metadatos.')), 15000);
    const finish = (error?: Error): void => {
      window.clearTimeout(timeout);
      audio.removeEventListener('loadedmetadata', onMetadata);
      audio.removeEventListener('error', onError);
      audio.removeAttribute('src');
      audio.load();
      if (error) reject(error);
    };
    const onMetadata = (): void => {
      const duration = audio.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        finish(new Error('El archivo no contiene una duración válida.'));
        return;
      }
      finish();
      resolve(Math.max(1, Math.round(duration)));
    };
    const onError = (): void => finish(new Error('Formato de audio no compatible.'));
    audio.addEventListener('loadedmetadata', onMetadata, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.src = url;
    audio.load();
  });
}

function createTrackId(): string {
  return `local-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`}`;
}
