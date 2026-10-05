import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPlayerState, savePlayerState } from '../src/services/storage';
import type { Song } from '../src/domain/Song';

const song: Song = { id: 'track-test', title: 'Pista de prueba', artist: 'Artista de prueba', durationSec: 185, favorite: true };

function stubStorage(initialValues: Map<string, string> = new Map<string, string>()): Map<string, string> {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => initialValues.get(key) ?? null,
    setItem: (key: string, value: string) => initialValues.set(key, value)
  });
  return initialValues;
}

describe('persistencia de la playlist', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('guarda y recupera las canciones favoritas y la selección actual', () => {
    const values = stubStorage();
    savePlayerState([song], song.id);
    expect(loadPlayerState()).toEqual({ songs: [song], currentId: song.id });
    expect(values.has('taller-player-state-v2')).toBe(true);
  });

  it('no restaura la playlist de demostración de la versión anterior', () => {
    stubStorage(new Map([
      ['taller-player-songs', JSON.stringify([song])],
      ['taller-player-state', JSON.stringify({ songs: [song], currentId: song.id })]
    ]));
    expect(loadPlayerState()).toBeNull();
  });

  it('descarta canciones inválidas y evita ids duplicados al reconstruir', () => {
    stubStorage(new Map([['taller-player-state-v2', JSON.stringify({
      songs: [song, song, { ...song, id: '', title: 'Inválida' }, { ...song, id: 'decimal', durationSec: 2.5 }],
      currentId: song.id
    })]]));
    expect(loadPlayerState()).toEqual({ songs: [song], currentId: song.id });
  });

  it('tolera JSON corrupto y almacenamiento no disponible', () => {
    stubStorage(new Map([['taller-player-state-v2', '{no es json']]));
    expect(loadPlayerState()).toBeNull();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('sin espacio'); } });
    expect(() => savePlayerState([song], song.id)).not.toThrow();
  });
});
