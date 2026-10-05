import { createElement } from './dom';

const SVG_NS = 'http://www.w3.org/2000/svg';
let artworkSequence = 0;

/** Genera una carátula SVG única a partir del nombre y el artista, sin descargar imágenes. */
export function createArtwork(title: string, artist: string): HTMLDivElement {
  artworkSequence += 1;
  const seed = hash(`${title}\u0000${artist}`);
  const hue = 37 + (seed % 17);
  const gradientId = `art-gradient-${artworkSequence}`;
  const glowId = `art-glow-${artworkSequence}`;
  const art = createElement('div', 'artwork');
  const svg = createSvg('svg', { viewBox: '0 0 400 400', preserveAspectRatio: 'xMidYMid slice' });
  const definitions = createSvg('defs');
  const backgroundGradient = createSvg('linearGradient', { id: gradientId, x1: '0', y1: '1', x2: '1', y2: '0' });
  addStop(backgroundGradient, '0%', '#08090a');
  addStop(backgroundGradient, '52%', `hsl(${hue} 28% 16%)`);
  addStop(backgroundGradient, '100%', `hsl(${hue + 3} 43% 29%)`);
  const radialGlow = createSvg('radialGradient', { id: glowId });
  addStop(radialGlow, '0%', `hsla(${hue + 8}, 88%, 78%, .72)`);
  addStop(radialGlow, '100%', `hsla(${hue + 8}, 75%, 67%, 0)`);
  definitions.append(backgroundGradient, radialGlow);
  svg.append(definitions);
  svg.append(createSvg('rect', { width: '400', height: '400', fill: `url(#${gradientId})` }));
  svg.append(createSvg('path', {
    d: 'M0 0H400V118C302 96 214 146 116 111 71 95 36 81 0 93Z',
    fill: 'rgba(255,255,255,.035)'
  }));

  const glow = createSvg('circle', { cx: String(82 + (seed % 70)), cy: String(75 + (seed % 48)), r: '150', fill: `url(#${glowId})`, class: 'art-glow' });
  svg.append(glow);

  for (let ring = 0; ring < 4; ring += 1) {
    svg.append(createSvg('ellipse', {
      cx: '220', cy: '206', rx: String(114 + ring * 31), ry: String(56 + ring * 28),
      transform: `rotate(${seed % 28 - 14} 220 206)`,
      class: `art-orbit art-orbit-${ring + 1}`
    }));
  }

  const disc = createSvg('g', { class: 'art-disc' });
  disc.append(createSvg('circle', { cx: '224', cy: '203', r: '104', fill: 'rgba(3, 3, 3, .78)', stroke: 'rgba(239,218,165,.5)', 'stroke-width': '1.5' }));
  disc.append(createSvg('circle', { cx: '224', cy: '203', r: '87', fill: 'none', stroke: 'rgba(239,218,165,.19)', 'stroke-width': '1' }));
  disc.append(createSvg('circle', { cx: '224', cy: '203', r: '66', fill: 'none', stroke: 'rgba(239,218,165,.24)', 'stroke-width': '1' }));
  disc.append(createSvg('circle', { cx: '224', cy: '203', r: '44', fill: `hsl(${hue + 2} 47% 66%)`, opacity: '.96' }));
  disc.append(createSvg('circle', { cx: '224', cy: '203', r: '9', fill: 'rgba(10,9,7,.88)' }));
  svg.append(disc);

  const initial = createSvg('text', { x: '224', y: '218', 'text-anchor': 'middle', class: 'art-initial' });
  initial.textContent = title.trim().slice(0, 1).toLocaleUpperCase('es') || '♪';
  svg.append(initial);

  const waveform = createSvg('g', { class: 'art-waveform' });
  const barCount = 9;
  for (let index = 0; index < barCount; index += 1) {
    const barHeight = 14 + ((seed >>> (index % 24)) + index * 11) % 43;
    waveform.append(createSvg('rect', {
      x: String(34 + index * 12),
      y: String(342 - barHeight),
      width: '5',
      height: String(barHeight),
      rx: '2.5',
      class: 'art-wave-bar',
      style: `--bar-delay:${index * -0.11}s`
    }));
  }
  svg.append(createSvg('rect', {
    x: '29', y: '292', width: '342', height: '76', rx: '16',
    fill: 'rgba(8, 8, 7, .74)', stroke: 'rgba(239,218,165,.28)', 'stroke-width': '1'
  }));
  svg.append(waveform);
  const coverTitle = createSvg('text', {
    x: '151', y: '328', class: 'art-title',
    textLength: String(Math.min(205, Math.max(55, title.length * 8))), lengthAdjust: 'spacingAndGlyphs'
  });
  coverTitle.textContent = title || 'Música';
  const coverArtist = createSvg('text', {
    x: '151', y: '349', class: 'art-artist',
    textLength: String(Math.min(205, Math.max(55, artist.length * 6.4))), lengthAdjust: 'spacingAndGlyphs'
  });
  coverArtist.textContent = artist || 'Colección local';
  svg.append(coverTitle, coverArtist);
  svg.append(createSvg('rect', { x: '24', y: '28', width: '352', height: '344', rx: '22', class: 'art-frame' }));
  art.append(svg);
  return art;
}

function createSvg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function addStop(gradient: SVGLinearGradientElement | SVGRadialGradientElement, offset: string, color: string): void {
  const stop = createSvg('stop', { offset, 'stop-color': color });
  gradient.append(stop);
}

function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
