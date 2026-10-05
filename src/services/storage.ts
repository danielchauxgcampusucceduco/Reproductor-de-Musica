import type { Song } from '../domain/Song';

const KEY = 'taller-player-state-v2';

export interface SavedPlayerState {
  songs: readonly Song[];
  currentId: string | null;
}

/** O(n). Recupera la lista serializada y el id de la canción seleccionada. */
export function loadPlayerState(): SavedPlayerState | null {
  try {
    const value = localStorage.getItem(KEY);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return { songs: normalizeSongs(parsed), currentId: null };
    if (!isSavedState(parsed)) return null;
    return { songs: normalizeSongs(parsed.songs), currentId: parsed.currentId };
  } catch {
    return null;
  }
}

/** O(n). Guarda la lista y la selección actual en el navegador. */
export function savePlayerState(songs: readonly Song[], currentId: string | null): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ songs, currentId } satisfies SavedPlayerState));
  } catch {
    // El reproductor continúa funcionando si el almacenamiento del navegador no está disponible.
  }
}

function isSong(value: unknown): value is Song {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && candidate.id.trim().length > 0
    && typeof candidate.title === 'string'
    && candidate.title.trim().length > 0
    && typeof candidate.artist === 'string'
    && candidate.artist.trim().length > 0
    && typeof candidate.durationSec === 'number'
    && Number.isSafeInteger(candidate.durationSec)
    && candidate.durationSec > 0
    && typeof candidate.favorite === 'boolean'
    && (candidate.spotifyUri === undefined || isSpotifyTrackUri(candidate.spotifyUri))
    && (candidate.spotifyTrackUrl === undefined || isSpotifyTrackUrl(candidate.spotifyTrackUrl))
    && (candidate.albumImageUrl === undefined || isSpotifyAlbumImageUrl(candidate.albumImageUrl));
}

function isSpotifyTrackUri(value: unknown): value is string {
  return typeof value === 'string' && /^spotify:track:[A-Za-z0-9]+$/.test(value);
}

function isSpotifyTrackUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]+(?:\?.*)?$/.test(value);
}

function isSpotifyAlbumImageUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]+$/.test(value);
}

function normalizeSongs(values: readonly unknown[]): Song[] {
  const songs: Song[] = [];
  const ids = new Set<string>();
  for (const value of values) {
    if (!isSong(value) || ids.has(value.id)) continue;
    ids.add(value.id);
    songs.push(value);
  }
  return songs;
}

function isSavedState(value: unknown): value is SavedPlayerState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.songs)
    && (typeof candidate.currentId === 'string' || candidate.currentId === null);
}
