import type { Song } from '../../domain/Song';
import { createButton, createElement, createIconButton, formatTime } from './dom';
import { createArtwork } from './Artwork';

export interface SongRowActions {
  select(id: string): void;
  toggleFavorite(id: string): void;
  move(fromIndex: number, toIndex: number): void;
  remove(id: string): void;
  dragStart(id: string): void;
  dragEnd(): void;
  drop(sourceId: string, targetIndex: number): void;
}

/** Crea una fila accesible de canción con favoritos, reordenamiento y arrastre. */
export function createSongRow(
  song: Song,
  index: number,
  totalSongs: number,
  currentId: string | null,
  isPlaying: boolean,
  actions: SongRowActions
): HTMLElement {
  const isCurrent = song.id === currentId;
  const row = createElement('article', 'song');
  row.draggable = true;
  row.dataset.songId = song.id;
  row.setAttribute('aria-label', `${song.title}, ${song.artist}, ${formatTime(song.durationSec)}`);
  if (isCurrent) row.classList.add('current');
  if (isCurrent && isPlaying) row.classList.add('playing-row');

  const number = createElement('span', 'number');
  if (isCurrent) {
    const equalizer = createElement('span', 'equalizer');
    equalizer.setAttribute('aria-hidden', 'true');
    for (let bar = 0; bar < 3; bar += 1) equalizer.append(createElement('span'));
    number.append(equalizer);
  } else {
    number.textContent = String(index + 1).padStart(2, '0');
  }

  const thumbnail = createElement('div', 'thumb');
  thumbnail.setAttribute('aria-hidden', 'true');
  thumbnail.append(createArtwork(song.title, song.artist, song.albumImageUrl));
  const info = createElement('div', 'song-info');
  const select = createButton(`Reproducir ${song.title} de ${song.artist}`, song.title, 'track-title');
  select.addEventListener('click', () => actions.select(song.id));
  const artist = createElement('p', 'song-artist');
  artist.textContent = song.artist;
  info.append(select, artist);

  const duration = createElement('span', 'duration');
  duration.textContent = formatTime(song.durationSec);
  const rowActions = createElement('div', 'row-actions');
  const favorite = createIconButton(song.favorite ? 'Quitar de favoritas' : 'Marcar como favorita', song.favorite ? 'heartFilled' : 'heart');
  favorite.classList.toggle('favorite-active', song.favorite);
  favorite.setAttribute('aria-pressed', String(song.favorite));
  favorite.addEventListener('click', () => actions.toggleFavorite(song.id));
  const moveUp = createIconButton('Subir canción', 'up');
  moveUp.disabled = index === 0;
  moveUp.addEventListener('click', () => actions.move(index, index - 1));
  const moveDown = createIconButton('Bajar canción', 'down');
  moveDown.disabled = index === totalSongs - 1;
  moveDown.addEventListener('click', () => actions.move(index, index + 1));
  const remove = createIconButton(`Eliminar ${song.title}`, 'trash');
  remove.addEventListener('click', () => actions.remove(song.id));
  rowActions.append(favorite, moveUp, moveDown, remove);
  row.append(number, thumbnail, info, duration, rowActions);

  row.addEventListener('dragstart', (event) => {
    actions.dragStart(song.id);
    row.classList.add('dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', song.id);
    }
  });
  row.addEventListener('dragend', () => {
    actions.dragEnd();
    row.classList.remove('dragging');
  });
  row.addEventListener('dragover', (event) => { event.preventDefault(); row.classList.add('drag-over'); });
  row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
  row.addEventListener('drop', (event) => {
    event.preventDefault();
    row.classList.remove('drag-over');
    const sourceId = event.dataTransfer?.getData('text/plain');
    if (sourceId) actions.drop(sourceId, index);
  });
  return row;
}
