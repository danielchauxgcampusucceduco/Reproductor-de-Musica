import { DoublyLinkedList } from '../core/DoublyLinkedList';
import type { DoublyLinkedNode } from '../core/DoublyLinkedNode';
import { SilentAudioEngine, type AudioEngine } from './AudioEngine';
import type { RepeatMode, Song } from './Song';

export interface PlayerState {
  current: Song | null;
  isPlaying: boolean;
  elapsedSec: number;
  repeat: RepeatMode;
  shuffle: boolean;
  volume: number;
  playlistVersion: number;
  songs: readonly Song[];
}

/** Controla la lista y sincroniza el estado del reproductor sin manipular el DOM. */
export class MusicPlayer {
  private readonly playlist = new DoublyLinkedList<Song>();
  private currentNode: DoublyLinkedNode<Song> | null = null;
  private isPlaying = false;
  private elapsedSec = 0;
  private repeat: RepeatMode = 'none';
  private shuffle = false;
  private volume = 0.72;
  private playlistVersion = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<(state: PlayerState) => void>();
  private readonly playedIds = new Set<string>();
  private readonly history = new DoublyLinkedList<string>();
  private historyNode: DoublyLinkedNode<string> | null = null;

  /** O(n). Crea el controlador, copia las canciones a nodos y restaura la selección. */
  public constructor(songs: Iterable<Song> = [], currentId?: string | null, private readonly audioEngine: AudioEngine = new SilentAudioEngine()) {
    this.audioEngine.setVolume(this.volume);
    const seenIds = new Set<string>();
    for (const song of songs) {
      assertValidSong(song);
      if (seenIds.has(song.id)) throw new Error('La lista contiene identificadores de canción repetidos.');
      seenIds.add(song.id);
      this.playlist.addLast(song);
    }
    this.currentNode = currentId
      ? this.playlist.findNode((song) => song.id === currentId)
      : this.playlist.head;
    this.currentNode ??= this.playlist.head;
    this.resetShuffleHistory();
    this.audioEngine.setEndedHandler?.(() => this.handleAudioEnded());
    this.audioEngine.setPlaybackStateHandler?.((isPlaying) => this.handleExternalPlaybackState(isPlaying));
  }

  /** O(1). Suscribe una vista y devuelve una función para cancelar la suscripción. */
  public subscribe(listener: (state: PlayerState) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  /** O(1). Inicia el audio disponible o el avance simulado de canciones manuales. */
  public play(): void {
    if (!this.currentNode) return;
    if (this.elapsedSec >= this.currentNode.value.durationSec) this.elapsedSec = 0;
    this.audioEngine.play(this.currentNode.value, this.elapsedSec);
    this.isPlaying = true;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 1000);
    this.emit();
  }

  /** O(1). Pausa el temporizador sin perder el progreso. */
  public pause(): void {
    const actualTime = this.audioEngine.getCurrentTime?.();
    if (this.currentNode && actualTime !== undefined && actualTime !== null && Number.isFinite(actualTime)) {
      this.elapsedSec = Math.max(0, Math.min(Math.floor(actualTime), this.currentNode.value.durationSec));
    }
    this.isPlaying = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.audioEngine.pause();
    this.emit();
  }

  /** O(1). Alterna reproducción y pausa. */
  public togglePlay(): void {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  /** O(n). Selecciona una canción por id y reinicia su progreso. */
  public selectSong(id: string): void {
    const found = this.playlist.findNode((song) => song.id === id);
    if (!found) return;
    this.currentNode = found;
    this.elapsedSec = 0;
    if (this.isPlaying) this.audioEngine.play(found.value, 0);
    else this.audioEngine.seek(0, found.value);
    if (this.shuffle) this.recordShuffleSelection(id);
    this.emit();
  }

  /** O(1) en modo normal; O(n) en aleatorio. Avanza según los modos activos. */
  public next(): void {
    if (!this.currentNode) return;
    if (this.repeat === 'one') {
      this.elapsedSec = 0;
      if (this.isPlaying) this.audioEngine.play(this.currentNode.value, 0);
      else this.audioEngine.seek(0, this.currentNode.value);
      this.emit();
      return;
    }

    const nextNode = this.shuffle
      ? this.nextShuffledNode()
      : this.currentNode.next ?? (this.repeat === 'all' ? this.playlist.head : null);
    if (!nextNode) {
      this.pause();
      return;
    }
    this.currentNode = nextNode;
    this.elapsedSec = 0;
    if (this.isPlaying) this.audioEngine.play(nextNode.value, 0);
    else this.audioEngine.seek(0, nextNode.value);
    if (this.shuffle) this.recordShuffleSelection(nextNode.value.id);
    this.emit();
  }

  /** O(1) en orden normal u O(n) en aleatorio. Reinicia tras tres segundos; si no, retrocede. */
  public previous(): void {
    if (!this.currentNode) return;
    if (this.elapsedSec > 3) {
      this.elapsedSec = 0;
      this.audioEngine.seek(0, this.currentNode.value);
      this.emit();
      return;
    }
    const previousNode = this.shuffle
      ? this.previousShuffledNode()
      : this.currentNode.prev ?? (this.repeat === 'all' ? this.playlist.tail : null);
    if (previousNode) {
      this.currentNode = previousNode;
      this.elapsedSec = 0;
      if (this.isPlaying) this.audioEngine.play(previousNode.value, 0);
      else this.audioEngine.seek(0, previousNode.value);
    }
    this.emit();
  }

  /** O(n). Inserta una canción y conserva la reproducción actual. */
  public add(song: Song, index: number): void {
    assertValidSong(song);
    if (this.playlist.findNode((entry) => entry.id === song.id)) {
      throw new Error('Ya existe una canción con ese identificador.');
    }
    const wasEmpty = this.playlist.isEmpty();
    this.playlist.addAt(index, song);
    this.playlistVersion += 1;
    if (!this.currentNode) {
      this.currentNode = this.playlist.head;
      if (this.currentNode) this.audioEngine.seek(0, this.currentNode.value);
    }
    if (this.shuffle && wasEmpty) this.resetShuffleHistory();
    else if (this.shuffle) this.playedIds.delete(song.id);
    this.audioEngine.keepFiles?.(new Set(this.playlist.toArray().map((entry) => entry.id)));
    this.emit();
  }

  /** O(n). Reemplaza la playlist completa sin conservar enlaces ni progreso anteriores. */
  public replacePlaylist(songs: Iterable<Song>): void {
    const nextSongs: Song[] = [];
    const seenIds = new Set<string>();
    for (const song of songs) {
      assertValidSong(song);
      if (seenIds.has(song.id)) throw new Error('La lista contiene identificadores de canción repetidos.');
      seenIds.add(song.id);
      nextSongs.push(song);
    }

    this.pause();
    this.playlist.clear();
    for (const song of nextSongs) this.playlist.addLast(song);
    this.currentNode = this.playlist.head;
    this.elapsedSec = 0;
    this.playlistVersion += 1;
    if (this.currentNode) this.audioEngine.seek(0, this.currentNode.value);
    this.audioEngine.keepFiles?.(new Set(this.playlist.toArray().map((song) => song.id)));
    this.resetShuffleHistory();
    this.emit();
  }

  /** O(n). Elimina una canción y, si estaba activa, elige la siguiente o la anterior. */
  public remove(id: string): Song | undefined {
    const node = this.playlist.findNode((song) => song.id === id);
    if (!node) return undefined;
    const next = node.next;
    const previous = node.prev;
    const wasCurrent = node === this.currentNode;
    const removed = this.playlist.removeNode(node);
    this.playlistVersion += 1;
    if (wasCurrent) {
      this.currentNode = next ?? previous;
      this.elapsedSec = 0;
      if (!this.currentNode) this.pause();
      else if (this.isPlaying) this.audioEngine.play(this.currentNode.value, 0);
      else this.audioEngine.seek(0, this.currentNode.value);
    }
    this.audioEngine.keepFiles?.(new Set(this.playlist.toArray().map((song) => song.id)));
    if (this.shuffle) {
      if (wasCurrent) this.resetShuffleHistory();
      else this.removeFromShuffleHistory(id);
    }
    this.emit();
    return removed;
  }

  /** O(n). Mueve un nodo de posición sin crear otro nodo para la canción. */
  public move(fromIndex: number, toIndex: number): void {
    this.playlist.moveNode(fromIndex, toIndex);
    this.playlistVersion += 1;
    this.emit();
  }

  /** O(n). Cambia el estado de favorita y notifica a las vistas. */
  public toggleFavorite(id: string): void {
    const node = this.playlist.findNode((song) => song.id === id);
    if (!node) return;
    node.value = { ...node.value, favorite: !node.value.favorite };
    this.playlistVersion += 1;
    this.emit();
  }

  /** O(1). Configura el modo de repetición. */
  public setRepeat(mode: RepeatMode): void {
    this.repeat = mode;
    this.emit();
  }

  /** O(1). Activa o desactiva la reproducción aleatoria y su historial. */
  public toggleShuffle(): void {
    this.shuffle = !this.shuffle;
    this.resetShuffleHistory();
    this.emit();
  }

  /** O(1). Ajusta el volumen entre 0 y 1. */
  public setVolume(volume: number): void {
    if (!Number.isFinite(volume)) throw new RangeError('El volumen debe ser un número finito.');
    this.volume = Math.max(0, Math.min(1, volume));
    this.audioEngine.setVolume(this.volume);
    this.emit();
  }

  /** O(1). Salta a un segundo válido de la canción actual. */
  public seek(seconds: number): void {
    if (!this.currentNode) return;
    if (!Number.isFinite(seconds)) throw new RangeError('La posición debe ser un número finito.');
    this.elapsedSec = Math.max(0, Math.min(seconds, this.currentNode.value.durationSec));
    this.audioEngine.seek(this.elapsedSec, this.currentNode.value);
    this.emit();
  }

  /** O(1). Devuelve el id de la canción seleccionada. */
  public getCurrentId(): string | null {
    return this.currentNode?.value.id ?? null;
  }

  /** O(1). Devuelve la cantidad de canciones sin exponer la estructura interna. */
  public getSongCount(): number {
    return this.playlist.size;
  }

  /** O(1). Detiene la reproducción y libera el temporizador. */
  public destroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.isPlaying = false;
    this.audioEngine.pause();
    this.audioEngine.dispose?.();
    this.listeners.clear();
  }

  private tick(): void {
    if (!this.currentNode || !this.isPlaying) return;
    const actualTime = this.audioEngine.getCurrentTime?.();
    if (actualTime !== undefined && actualTime !== null && Number.isFinite(actualTime)) {
      this.elapsedSec = Math.min(Math.floor(actualTime), this.currentNode.value.durationSec);
      this.emit();
      return;
    }
    if (this.elapsedSec + 1 >= this.currentNode.value.durationSec) {
      this.elapsedSec = this.currentNode.value.durationSec;
      this.next();
    } else {
      this.elapsedSec += 1;
      this.emit();
    }
  }

  private handleAudioEnded(): void {
    if (!this.isPlaying || !this.currentNode) return;
    this.elapsedSec = this.currentNode.value.durationSec;
    this.next();
  }

  private handleExternalPlaybackState(isPlaying: boolean): void {
    if (!this.currentNode || this.isPlaying === isPlaying) return;
    this.isPlaying = isPlaying;
    if (isPlaying) {
      if (!this.timer) this.timer = setInterval(() => this.tick(), 1000);
    } else {
      const actualTime = this.audioEngine.getCurrentTime?.();
      if (actualTime !== undefined && actualTime !== null && Number.isFinite(actualTime)) {
        this.elapsedSec = Math.max(0, Math.min(Math.floor(actualTime), this.currentNode.value.durationSec));
      }
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    }
    this.emit();
  }

  private nextShuffledNode(): DoublyLinkedNode<Song> | null {
    if (this.historyNode?.next) {
      const historyNext = this.historyNode.next.value;
      this.historyNode = this.historyNode.next;
      return this.playlist.findNode((song) => song.id === historyNext);
    }
    if (this.playedIds.size >= this.playlist.size && this.repeat === 'all') {
      this.playedIds.clear();
      if (this.currentNode) this.playedIds.add(this.currentNode.value.id);
    }
    return this.pickUnplayedNode() ?? (this.repeat === 'all' ? this.currentNode : null);
  }

  private previousShuffledNode(): DoublyLinkedNode<Song> | null {
    if (!this.historyNode?.prev) return null;
    this.historyNode = this.historyNode.prev;
    return this.playlist.findNode((song) => song.id === this.historyNode?.value) ?? null;
  }

  private pickUnplayedNode(): DoublyLinkedNode<Song> | null {
    let chosen: DoublyLinkedNode<Song> | null = null;
    let candidates = 0;
    for (let node = this.playlist.head; node; node = node.next) {
      if (this.playedIds.has(node.value.id)) continue;
      candidates += 1;
      if (Math.random() < 1 / candidates) chosen = node;
    }
    return chosen;
  }

  private recordShuffleSelection(id: string): void {
    while (this.historyNode?.next) this.history.removeNode(this.historyNode.next);
    this.historyNode = this.history.addLast(id);
    this.playedIds.add(id);
  }

  private removeFromShuffleHistory(id: string): void {
    for (let node = this.history.head; node;) {
      const next = node.next;
      if (node.value === id) {
        if (node === this.historyNode) this.historyNode = node.prev ?? node.next;
        this.history.removeNode(node);
      }
      node = next;
    }
    this.playedIds.delete(id);
  }

  private resetShuffleHistory(): void {
    this.history.clear();
    this.playedIds.clear();
    this.historyNode = null;
    if (this.shuffle && this.currentNode) {
      this.historyNode = this.history.addLast(this.currentNode.value.id);
      this.playedIds.add(this.currentNode.value.id);
    }
  }

  private snapshot(): PlayerState {
    return {
      current: this.currentNode?.value ?? null,
      isPlaying: this.isPlaying,
      elapsedSec: this.elapsedSec,
      repeat: this.repeat,
      shuffle: this.shuffle,
      volume: this.volume,
      playlistVersion: this.playlistVersion,
      songs: this.playlist.toArray()
    };
  }

  private emit(): void {
    const state = this.snapshot();
    for (const listener of this.listeners) listener(state);
  }
}

function assertValidSong(song: Song): void {
  if (typeof song !== 'object' || song === null) {
    throw new Error('La canción debe ser un objeto válido.');
  }
  if (typeof song.id !== 'string' || song.id.trim().length === 0) {
    throw new Error('La canción debe tener un identificador válido.');
  }
  if (typeof song.title !== 'string' || song.title.trim().length === 0) {
    throw new Error('La canción debe tener un título.');
  }
  if (typeof song.artist !== 'string' || song.artist.trim().length === 0) {
    throw new Error('La canción debe tener un artista.');
  }
  if (!Number.isSafeInteger(song.durationSec) || song.durationSec <= 0) {
    throw new Error('La duración debe ser un entero positivo de segundos.');
  }
  if (typeof song.favorite !== 'boolean') {
    throw new Error('El estado de favorita de la canción debe ser válido.');
  }
  if (song.youtubeVideoId !== undefined && !/^[A-Za-z0-9_-]{11}$/.test(song.youtubeVideoId)) {
    throw new Error('El identificador de video de YouTube no es válido.');
  }
  if (song.thumbnailUrl !== undefined && !isYouTubeThumbnailUrl(song.thumbnailUrl)) {
    throw new Error('La miniatura de YouTube no es válida.');
  }
}

function isYouTubeThumbnailUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && ['i.ytimg.com', 'img.youtube.com'].includes(url.hostname)
      && url.pathname.length > 1;
  } catch {
    return false;
  }
}
