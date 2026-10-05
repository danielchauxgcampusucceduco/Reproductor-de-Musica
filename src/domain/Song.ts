/** Canción de la lista y sus metadatos visibles. */
export interface Song {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly durationSec: number;
  readonly favorite: boolean;
  readonly spotifyUri?: string;
  readonly spotifyTrackUrl?: string;
  readonly albumImageUrl?: string;
}
/** Modos disponibles para repetir la reproducción. */
export type RepeatMode = 'none' | 'all' | 'one';
