/** Crea un elemento DOM y asigna una clase opcional. */
export function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

/** Crea un botón con nombre accesible y etiqueta visible segura. */
export function createButton(label: string, content: string, className = 'icon-btn'): HTMLButtonElement {
  const button = createElement('button', className);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.textContent = content;
  return button;
}

export type IconName = 'play' | 'pause' | 'next' | 'previous' | 'shuffle' | 'repeat' | 'repeatOne' | 'heart' | 'heartFilled' | 'trash' | 'up' | 'down' | 'sun' | 'moon' | 'music' | 'plus' | 'folder';

const iconPaths: Record<IconName, string> = {
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h4v14H7z M15 5h4v14h-4z',
  next: 'M5 5v14l10-7z M18 5v14',
  previous: 'M19 5v14L9 12z M6 5v14',
  shuffle: 'M16 3h5v5 M4 20 20 4 M21 16v5h-5 M4 4c3 0 5 1 7 4 M13 16c2 3 4 4 8 4',
  repeat: 'M17 2l4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3',
  repeatOne: 'M17 2l4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z',
  heartFilled: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z',
  trash: 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v5 M14 11v5',
  up: 'm18 15-6-6-6 6',
  down: 'm6 9 6 6 6-6',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M4.93 4.93l1.42 1.42 M17.65 17.65l1.42 1.42 M2 12h2 M20 12h2 M4.93 19.07l1.42-1.42 M17.65 6.35l1.42-1.42',
  moon: 'M20.8 13A8.5 8.5 0 0 1 11 3.2 8.5 8.5 0 1 0 20.8 13z',
  music: 'M9 18V5l12-2v13 M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3z M21 16a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3z',
  plus: 'M12 5v14 M5 12h14',
  folder: 'M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 10h18'
};

/** Crea un icono SVG sin insertar marcado como texto. */
export function createIcon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', iconPaths[name]);
  if (name === 'play' || name === 'heartFilled') {
    path.setAttribute('fill', 'currentColor');
  } else {
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
  }
  svg.append(path);
  if (name === 'repeatOne') {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', '10');
    label.setAttribute('y', '14');
    label.setAttribute('fill', 'currentColor');
    label.setAttribute('stroke', 'none');
    label.setAttribute('font-size', '8');
    label.setAttribute('font-weight', '700');
    label.textContent = '1';
    svg.append(label);
  }
  return svg;
}

/** Crea un botón de icono con un nombre accesible en español. */
export function createIconButton(label: string, icon: IconName, className = 'icon-btn'): HTMLButtonElement {
  const button = createButton(label, '', className);
  button.append(createIcon(icon));
  return button;
}

/** Convierte segundos en minutos y segundos. */
export function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

