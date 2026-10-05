import { afterEach, describe, expect, it, vi } from 'vitest';
import { MusicPlayer, type PlayerState } from '../src/domain/MusicPlayer';
import type { AudioEngine } from '../src/domain/AudioEngine';
import type { Song } from '../src/domain/Song';

const songs: Song[] = [
  { id: 'a', title: 'Pista A', artist: 'Artista A', durationSec: 10, favorite: false },
  { id: 'b', title: 'Pista B', artist: 'Artista B', durationSec: 10, favorite: false },
  { id: 'c', title: 'Pista C', artist: 'Artista C', durationSec: 10, favorite: false },
  { id: 'd', title: 'Pista D', artist: 'Artista D', durationSec: 10, favorite: false }
];

function currentState(player: MusicPlayer): PlayerState {
  let state: PlayerState | null = null;
  const unsubscribe = player.subscribe((nextState) => { state = nextState; });
  unsubscribe();
  if (!state) throw new Error('No se recibió el estado del reproductor.');
  return state;
}

describe('MusicPlayer', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('avanza y se detiene en la cola sin repetición', () => {
    const player = new MusicPlayer(songs.slice(0, 2));
    player.next();
    expect(player.getCurrentId()).toBe('b');
    player.play();
    player.next();
    expect(player.getCurrentId()).toBe('b');
    expect(currentState(player).isPlaying).toBe(false);
    player.destroy();
  });

  it('al adelantar manualmente en la última canción conserva su progreso actual', () => {
    const player = new MusicPlayer(songs.slice(0, 2));
    player.selectSong('b');
    player.seek(5);
    player.next();
    expect(player.getCurrentId()).toBe('b');
    expect(currentState(player).elapsedSec).toBe(5);
    expect(currentState(player).isPlaying).toBe(false);
  });

  it('retrocede desde el medio y repite desde ambos extremos', () => {
    const player = new MusicPlayer(songs.slice(0, 3));
    player.selectSong('b');
    player.previous();
    expect(player.getCurrentId()).toBe('a');
    player.setRepeat('all');
    player.previous();
    expect(player.getCurrentId()).toBe('c');
    player.next();
    expect(player.getCurrentId()).toBe('a');
  });

  it('reinicia la canción si se retrocede después de tres segundos', () => {
    const player = new MusicPlayer(songs);
    player.selectSong('c');
    player.seek(4);
    player.previous();
    expect(player.getCurrentId()).toBe('c');
    expect(currentState(player).elapsedSec).toBe(0);
  });

  it('repite una canción al llegar al final', () => {
    vi.useFakeTimers();
    const player = new MusicPlayer([{ ...songs[0], durationSec: 2 }, songs[1]]);
    player.setRepeat('one');
    player.play();
    vi.advanceTimersByTime(2000);
    expect(player.getCurrentId()).toBe('a');
    expect(currentState(player).elapsedSec).toBe(0);
    expect(currentState(player).isPlaying).toBe(true);
    player.destroy();
  });

  it('adelantar con repetir una no inicia el audio si estaba pausado', () => {
    const player = new MusicPlayer(songs.slice(0, 2));
    player.setRepeat('one');
    player.seek(5);
    player.next();
    expect(currentState(player)).toMatchObject({ elapsedSec: 0, isPlaying: false });
    player.destroy();
  });

  it('pasa automáticamente a la siguiente canción al terminar', () => {
    vi.useFakeTimers();
    const player = new MusicPlayer([{ ...songs[0], durationSec: 2 }, songs[1]]);
    player.play();
    vi.advanceTimersByTime(2000);
    expect(player.getCurrentId()).toBe('b');
    expect(currentState(player).isPlaying).toBe(true);
    player.destroy();
  });

  it('se detiene al final de la última canción durante la reproducción automática', () => {
    vi.useFakeTimers();
    const player = new MusicPlayer([{ ...songs[0], durationSec: 2 }]);
    player.play();
    vi.advanceTimersByTime(2000);
    expect(player.getCurrentId()).toBe('a');
    expect(currentState(player).elapsedSec).toBe(2);
    expect(currentState(player).isPlaying).toBe(false);
    player.play();
    expect(currentState(player).elapsedSec).toBe(0);
    expect(currentState(player).isPlaying).toBe(true);
    player.destroy();
  });

  it('recorre todas las canciones en aleatorio antes de repetir y conserva historial', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const player = new MusicPlayer(songs);
    player.toggleShuffle();
    player.next();
    expect(player.getCurrentId()).toBe('b');
    player.next();
    expect(player.getCurrentId()).toBe('c');
    player.next();
    expect(player.getCurrentId()).toBe('d');
    player.previous();
    expect(player.getCurrentId()).toBe('c');
    player.next();
    expect(player.getCurrentId()).toBe('d');
    player.next();
    expect(player.getCurrentId()).toBe('d');
    player.destroy();
  });

  it('repite el ciclo aleatorio solo después de agotar todas las canciones', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const player = new MusicPlayer(songs.slice(0, 3));
    player.setRepeat('all');
    player.toggleShuffle();
    player.next();
    expect(player.getCurrentId()).toBe('b');
    player.next();
    expect(player.getCurrentId()).toBe('c');
    player.next();
    expect(player.getCurrentId()).toBe('a');
    player.previous();
    expect(player.getCurrentId()).toBe('c');
    player.next();
    expect(player.getCurrentId()).toBe('a');
    player.destroy();
  });

  it('elimina la canción activa usando la siguiente o la anterior y tolera lista vacía', () => {
    const player = new MusicPlayer(songs.slice(0, 3));
    expect(player.remove('a')?.id).toBe('a');
    expect(player.getCurrentId()).toBe('b');
    player.remove('b');
    expect(player.getCurrentId()).toBe('c');
    player.remove('c');
    expect(player.getCurrentId()).toBeNull();
    expect(player.getSongCount()).toBe(0);
    player.play();
  });

  it('agrega sin cambiar la canción actual y selecciona la primera al salir de vacío', () => {
    const player = new MusicPlayer();
    player.add(songs[0], 0);
    expect(player.getCurrentId()).toBe('a');
    expect(currentState(player).isPlaying).toBe(false);
    player.add(songs[1], 0);
    expect(player.getCurrentId()).toBe('a');
    expect(currentState(player).songs.map((song) => song.id)).toEqual(['b', 'a']);
  });

  it('reemplaza la playlist y reinicia selección y progreso', () => {
    const player = new MusicPlayer(songs.slice(0, 2));
    player.selectSong('b');
    player.seek(6);
    player.replacePlaylist([songs[2]]);
    expect(currentState(player)).toMatchObject({
      current: songs[2],
      elapsedSec: 0,
      isPlaying: false,
      songs: [songs[2]]
    });
    expect(player.getSongCount()).toBe(1);
    player.destroy();
  });

  it('sincroniza el progreso con el audio real y avanza en el evento de fin', () => {
    vi.useFakeTimers();
    let audioTime = 1.8;
    const callbacks = { onEnded: (): void => {} };
    const audioEngine: AudioEngine = {
      play: vi.fn(),
      pause: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn(),
      getCurrentTime: () => audioTime,
      setEndedHandler: (handler) => { callbacks.onEnded = handler; }
    };
    const player = new MusicPlayer(songs.slice(0, 2), null, audioEngine);
    player.play();
    vi.advanceTimersByTime(1000);
    expect(currentState(player).elapsedSec).toBe(1);
    audioTime = 10;
    callbacks.onEnded();
    expect(player.getCurrentId()).toBe('b');
    expect(currentState(player).isPlaying).toBe(true);
    player.destroy();
  });

  it('vuelve a iniciar la pista de audio real al finalizar en modo repetir una', () => {
    let ended = (): void => {};
    const audioEngine: AudioEngine = {
      play: vi.fn(),
      pause: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn(),
      setEndedHandler: (handler) => { ended = handler; }
    };
    const player = new MusicPlayer(songs.slice(0, 2), null, audioEngine);
    player.setRepeat('one');
    player.play();
    ended();
    expect(audioEngine.play).toHaveBeenLastCalledWith(songs[0], 0);
    expect(currentState(player).isPlaying).toBe(true);
    player.destroy();
  });

  it('rechaza identificadores duplicados y canciones con duración inválida', () => {
    expect(() => new MusicPlayer([songs[0], songs[0]])).toThrow('identificadores de canción repetidos');
    const player = new MusicPlayer();
    expect(() => player.add({ ...songs[0], durationSec: 1.5 }, 0)).toThrow('entero positivo');
    player.add(songs[0], 0);
    expect(() => player.add({ ...songs[0], title: 'Otra' }, 1)).toThrow('identificador');
    expect(player.getSongCount()).toBe(1);
  });

  it('selecciona, cambia favoritos, limita progreso y volumen y emite estado', () => {
    const player = new MusicPlayer(songs);
    const listener = vi.fn();
    const unsubscribe = player.subscribe(listener);
    player.selectSong('b');
    player.toggleFavorite('b');
    player.seek(100);
    player.setVolume(1.5);
    expect(listener).toHaveBeenCalled();
    expect(listener.mock.lastCall?.[0].current?.favorite).toBe(true);
    expect(listener.mock.lastCall?.[0].elapsedSec).toBe(10);
    expect(listener.mock.lastCall?.[0].volume).toBe(1);
    unsubscribe();
    const callCount = listener.mock.calls.length;
    player.pause();
    expect(listener).toHaveBeenCalledTimes(callCount);
  });

  it('incrementa la versión de lista solo cuando cambia su contenido u orden', () => {
    const player = new MusicPlayer(songs.slice(0, 2));
    const initialVersion = currentState(player).playlistVersion;
    player.seek(2);
    player.setVolume(0.5);
    expect(currentState(player).playlistVersion).toBe(initialVersion);
    player.move(0, 1);
    player.toggleFavorite('b');
    expect(currentState(player).playlistVersion).toBe(initialVersion + 2);
  });

  it('rechaza valores no finitos para la posición y el volumen', () => {
    const player = new MusicPlayer(songs);
    expect(() => player.seek(Number.NaN)).toThrow('número finito');
    expect(() => player.setVolume(Number.NaN)).toThrow('número finito');
  });

  it('usa la interfaz AudioEngine para reproducir, pausar, buscar y cambiar volumen', () => {
    const audioEngine: AudioEngine = {
      play: vi.fn(),
      pause: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn()
    };
    const player = new MusicPlayer(songs, null, audioEngine);
    player.setVolume(0.4);
    player.play();
    player.seek(5);
    player.pause();
    expect(audioEngine.setVolume).toHaveBeenLastCalledWith(0.4);
    expect(audioEngine.play).toHaveBeenCalledWith(songs[0], 0);
    expect(audioEngine.seek).toHaveBeenCalledWith(5, songs[0]);
    expect(audioEngine.pause).toHaveBeenCalled();
  });

  it('sincroniza el estado y el progreso cuando los controles nativos cambian la reproducción', () => {
    let reportPlaybackState = (_isPlaying: boolean): void => {};
    let audioTime = 0;
    const audioEngine: AudioEngine = {
      play: vi.fn(),
      pause: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn(),
      getCurrentTime: () => audioTime,
      setPlaybackStateHandler: (handler) => { reportPlaybackState = handler; }
    };
    const player = new MusicPlayer(songs, null, audioEngine);

    reportPlaybackState(true);
    expect(currentState(player).isPlaying).toBe(true);
    audioTime = 6.7;
    reportPlaybackState(false);
    expect(currentState(player)).toMatchObject({ isPlaying: false, elapsedSec: 6 });
    player.destroy();
  });
});
