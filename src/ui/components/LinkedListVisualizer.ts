import type { Song } from '../../domain/Song';
import { createElement } from './dom';

/** Dibuja las etiquetas de cabeza, cola, canción actual y enlaces de cada posición. */
export function renderLinkedListVisualizer(container: HTMLElement, songs: readonly Song[], currentId: string | null): void {
  container.replaceChildren();
  const head = createElement('span', 'null-node');
  head.textContent = 'HEAD · null';
  container.append(head);
  songs.forEach((song, index) => {
    const arrow = createElement('span', 'link-arrow');
    arrow.textContent = '⇄';
    arrow.setAttribute('aria-hidden', 'true');
    const node = createElement('div', 'node');
    node.classList.toggle('current-node', song.id === currentId);
    const marker = createElement('small', 'node-marker');
    marker.textContent = song.id === currentId ? 'ACTUAL' : `NODO ${index + 1}`;
    const title = createElement('strong');
    title.textContent = song.title;
    const previousLink = createElement('small', 'node-link');
    previousLink.textContent = `prev: ${index === 0 ? 'null' : `nodo ${index}`}`;
    const nextLink = createElement('small', 'node-link');
    nextLink.textContent = `next: ${index === songs.length - 1 ? 'null' : `nodo ${index + 2}`}`;
    node.append(marker, title, previousLink, nextLink);
    container.append(arrow, node);
  });
  const tailArrow = createElement('span', 'link-arrow');
  tailArrow.textContent = '⇄';
  tailArrow.setAttribute('aria-hidden', 'true');
  const tail = createElement('span', 'null-node');
  tail.textContent = 'null · TAIL';
  container.append(tailArrow, tail);
}
