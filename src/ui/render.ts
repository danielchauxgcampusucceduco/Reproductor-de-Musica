import type { MusicPlayer, PlayerState } from '../domain/MusicPlayer';
import type { Song } from '../domain/Song';
import type { BrowserAudioEngine } from '../domain/AudioEngine';
import type { YouTubeClient } from '../domain/YouTubeClient';
import type { YouTubePlaybackEngine } from '../domain/YouTubePlaybackEngine';
import { createButton, createElement, createIcon, createIconButton, formatTime, type IconName } from './components/dom';
import { createArtwork } from './components/Artwork';
import { createSongRow } from './components/SongRow';
import { renderLinkedListVisualizer } from './components/LinkedListVisualizer';
import { showToast } from './components/Toast';
import { addOption, clearErrors, createSongId, makeField, parseDuration, showError } from './components/form';

const icons = { play: 'play', pause: 'pause', next: 'next', previous: 'previous', shuffle: 'shuffle', repeat: 'repeat' } satisfies Record<string, IconName>;

/** Renderiza la aplicación mediante nodos DOM; el texto de cada canción se asigna de forma segura. */
export function mountPlayer(
  root: HTMLElement,
  player: MusicPlayer,
  audioEngine: BrowserAudioEngine,
  youtubeClient: YouTubeClient,
  youtubePlayback: YouTubePlaybackEngine,
  onChange: (state: PlayerState) => void
): void {
  const app = createElement('main', 'app');
  const header = createElement('header', 'topbar');
  const brand = createElement('div', 'brand');
  const brandMark = createElement('div', 'brand-mark');
  brandMark.append(createIcon('music'));
  const brandCopy = createElement('div');
  const heading = createElement('h1');
  heading.textContent = 'Reproductor de Música';
  const subtitle = createElement('p');
  subtitle.textContent = 'Tu música, a tu manera · Listas dobles';
  brandCopy.append(heading, subtitle);
  brand.append(brandMark, brandCopy);
  const themeButton = createIconButton('Cambiar tema', document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 'theme');
  header.append(brand, themeButton);
  app.append(header);

  const layout = createElement('div', 'grid');
  const playerCard = createElement('section', 'card player');
  playerCard.setAttribute('aria-label', 'Controles del reproductor');
  const cover = createElement('div', 'cover');
  const coverArtwork = createElement('div', 'cover-artwork');
  coverArtwork.setAttribute('aria-hidden', 'true');
  coverArtwork.append(createArtwork('Música', 'Colección local'));
  const youtubeStage = createElement('div', 'youtube-stage');
  youtubeStage.hidden = true;
  const youtubePlayerHost = createElement('div', 'youtube-player-host');
  youtubePlayerHost.setAttribute('aria-label', 'Reproductor oficial de YouTube');
  youtubeStage.append(youtubePlayerHost);
  cover.append(coverArtwork, youtubeStage);
  const eyebrow = createElement('span', 'eyebrow');
  eyebrow.textContent = 'REPRODUCIENDO AHORA';
  const currentTitle = createElement('h2', 'now-title');
  const currentArtist = createElement('p', 'artist');

  const progressGroup = createElement('div', 'progress-wrap');
  const progress = createElement('input', 'progress');
  progress.type = 'range';
  progress.min = '0';
  progress.value = '0';
  progress.setAttribute('aria-label', 'Posición de reproducción');
  const timeLabels = createElement('div', 'times');
  const elapsedLabel = createElement('span');
  const durationLabel = createElement('span');
  timeLabels.append(elapsedLabel, durationLabel);
  progressGroup.append(progress, timeLabels);

  const controls = createElement('div', 'controls');
  const shuffleButton = createIconButton('Activar reproducción aleatoria', icons.shuffle);
  const previousButton = createIconButton('Reproducir canción anterior', icons.previous);
  const playButton = createIconButton('Reproducir', icons.play, 'play');
  const nextButton = createIconButton('Reproducir canción siguiente', icons.next);
  const repeatButton = createIconButton('Cambiar modo de repetición', icons.repeat);
  controls.append(shuffleButton, previousButton, playButton, nextButton, repeatButton);

  const volumeGroup = createElement('label', 'volume-control');
  const volumeLabel = createElement('span');
  volumeLabel.textContent = 'Volumen';
  const volume = createElement('input');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '1';
  volume.step = '0.01';
  volume.setAttribute('aria-label', 'Volumen del reproductor');
  const volumeValue = createElement('span', 'volume-value');
  volumeGroup.append(volumeLabel, volume, volumeValue);
  playerCard.append(cover, eyebrow, currentTitle, currentArtist, progressGroup, controls, volumeGroup);

  const playlistCard = createElement('aside', 'card side');
  const listHeading = createElement('h2', 'section-title');
  const listTitle = createElement('span');
  listTitle.textContent = 'Lista de reproducción';
  const songCount = createElement('span', 'badge');
  listHeading.append(listTitle, songCount);

  const librarySection = createElement('section', 'content-section library-section');
  const libraryHeading = createElement('h3', 'subsection-title');
  libraryHeading.textContent = 'Tu música local';
  const folderTools = createElement('div', 'library-tools');
  const folderButton = createButton('Seleccionar una carpeta con archivos de música', 'Cargar carpeta de música', 'folder-button');
  folderButton.prepend(createIcon('folder'));
  const folderHint = createElement('p', 'folder-hint');
  folderHint.textContent = 'Estos archivos sí se reproducen; las canciones del formulario son solo metadatos.';
  const folderPrivacyHint = createElement('p', 'folder-hint');
  folderPrivacyHint.textContent = 'La música no se sube a internet y deberás volver a elegir la carpeta al recargar.';
  const folderPicker = createElement('input', 'folder-picker');
  folderPicker.type = 'file';
  folderPicker.multiple = true;
  folderPicker.accept = 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.webm,.aiff';
  folderPicker.setAttribute('webkitdirectory', '');
  folderPicker.setAttribute('directory', '');
  folderPicker.hidden = true;
  folderPicker.setAttribute('aria-label', 'Carpeta de archivos de música');
  const folderStatus = createElement('p', 'folder-status');
  folderStatus.setAttribute('aria-live', 'polite');
  folderTools.append(folderButton, folderHint, folderPrivacyHint, folderPicker, folderStatus);
  librarySection.append(libraryHeading, folderTools);

  const youtubeTools = createElement('section', 'youtube-tools');
  youtubeTools.setAttribute('aria-label', 'Buscar música en YouTube');
  const youtubeHeading = createElement('h3', 'youtube-heading');
  youtubeHeading.textContent = 'Descubre en YouTube';
  const youtubeDescription = createElement('p', 'youtube-description');
  youtubeDescription.textContent = 'Busca videos musicales y reprodúcelos aquí con el reproductor oficial de YouTube.';
  const youtubeSearchForm = createElement('form', 'youtube-search-form');
  const youtubeSearch = createElement('input', 'search-input');
  youtubeSearch.type = 'search';
  youtubeSearch.placeholder = 'Busca una canción o un artista';
  youtubeSearch.maxLength = 120;
  youtubeSearch.setAttribute('aria-label', 'Buscar canciones y videos en YouTube');
  const youtubeSearchButton = createButton('Buscar música en YouTube', 'Buscar', 'filter-button');
  youtubeSearchButton.type = 'submit';
  youtubeSearchForm.append(youtubeSearch, youtubeSearchButton);
  const youtubeStatus = createElement('p', 'youtube-status');
  youtubeStatus.setAttribute('aria-live', 'polite');
  const youtubeResults = createElement('div', 'youtube-results');
  youtubeResults.setAttribute('aria-live', 'polite');
  youtubeTools.append(youtubeHeading, youtubeDescription, youtubeSearchForm, youtubeStatus, youtubeResults);

  const manualSection = createElement('section', 'content-section manual-section');
  const manualHeading = createElement('h3', 'subsection-title');
  manualHeading.textContent = 'Añadir canción manualmente';
  const form = createElement('form', 'add-form');
  form.noValidate = true;
  const titleField = makeField('Título', 'Título de la canción', 'Ej. Luces de ciudad', 'song-title');
  const artistField = makeField('Artista', 'Nombre del artista', 'Ej. Banda del Norte', 'song-artist');
  const durationField = makeField('Duración', 'Duración (mm:ss)', 'Ej. 03:42', 'song-duration');
  durationField.input.inputMode = 'numeric';
  const positionField = createElement('label', 'field');
  const positionLabel = createElement('span');
  positionLabel.textContent = 'Agregar en';
  const position = createElement('select');
  position.setAttribute('aria-label', 'Posición de inserción');
  addOption(position, 'end', 'Al final');
  addOption(position, 'start', 'Al inicio');
  addOption(position, 'custom', 'Posición específica');
  positionField.append(positionLabel, position);
  const customPositionField = makeField('Posición', 'Número de posición', 'Ej. 3', 'song-position');
  customPositionField.input.type = 'number';
  customPositionField.input.min = '1';
  customPositionField.input.step = '1';
  customPositionField.wrapper.hidden = true;
  const preview = createElement('p', 'insert-preview full');
  preview.setAttribute('aria-live', 'polite');
  const addButton = createButton('Agregar canción a la lista', 'Agregar canción', 'primary full');
  addButton.prepend(createIcon('plus'));
  form.append(titleField.wrapper, artistField.wrapper, durationField.wrapper, positionField, customPositionField.wrapper, preview, addButton);
  manualSection.append(manualHeading, form);

  const search = createElement('input', 'search-input');
  search.type = 'search';
  search.placeholder = 'Buscar título o artista';
  search.setAttribute('aria-label', 'Buscar canciones por título o artista');
  const filterRow = createElement('div', 'list-tools');
  const favoritesOnly = createButton('Mostrar solo favoritas', 'Favoritas', 'filter-button');
  favoritesOnly.prepend(createIcon('heart'));
  const totalDuration = createElement('span', 'total-duration');
  filterRow.append(favoritesOnly, totalDuration);
  const playlist = createElement('div', 'playlist');
  playlist.setAttribute('aria-label', 'Lista de reproducción');
  playlist.setAttribute('aria-live', 'polite');
  const shortcuts = createElement('p', 'shortcuts');
  shortcuts.textContent = 'Atajos: Espacio reproducir/pausar · ← anterior · → siguiente · Supr eliminar canción activa';
  const playlistSection = createElement('section', 'content-section playlist-section');
  playlistSection.append(listHeading, search, filterRow, playlist, shortcuts);
  playlistCard.append(librarySection, youtubeTools, manualSection, playlistSection);

  const visualizerCard = createElement('section', 'card visualizer');
  const visualizerHeading = createElement('h2', 'section-title');
  visualizerHeading.textContent = 'Estructura de la lista doble';
  const visualizerNote = createElement('p', 'visualizer-note');
  visualizerNote.textContent = 'Cada bloque representa un nodo y muestra sus enlaces anterior y siguiente.';
  const nodes = createElement('div', 'nodes');
  nodes.setAttribute('aria-label', 'Representación de los nodos enlazados');
  visualizerCard.append(visualizerHeading, visualizerNote, nodes);
  layout.append(playerCard, playlistCard, visualizerCard);
  app.append(layout);
  root.replaceChildren(app);
  youtubePlayback.attach(youtubePlayerHost);

  let latestState: PlayerState | null = null;
  let favoritesFilter = false;
  let draggedId: string | null = null;
  let renderedPlaylistKey = '';
  let renderedVisualizerKey = '';
  let renderedCoverKey = 'empty';

  themeButton.addEventListener('click', () => {
    const currentTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    themeButton.replaceChildren(createIcon(nextTheme === 'light' ? 'moon' : 'sun'));
    try { localStorage.setItem('taller-player-theme', nextTheme); } catch { /* El tema queda activo durante esta sesión. */ }
  });
  shuffleButton.addEventListener('click', () => player.toggleShuffle());
  previousButton.addEventListener('click', () => player.previous());
  playButton.addEventListener('click', () => player.togglePlay());
  nextButton.addEventListener('click', () => player.next());
  repeatButton.addEventListener('click', () => player.setRepeat(nextRepeat(latestState?.repeat ?? 'none')));
  progress.addEventListener('input', () => player.seek(Number(progress.value)));
  volume.addEventListener('input', () => player.setVolume(Number(volume.value)));
  search.addEventListener('input', () => { if (latestState) renderPlaylist(latestState); });
  favoritesOnly.addEventListener('click', () => {
    favoritesFilter = !favoritesFilter;
    favoritesOnly.classList.toggle('active-control', favoritesFilter);
    favoritesOnly.setAttribute('aria-pressed', String(favoritesFilter));
    if (latestState) renderPlaylist(latestState);
  });
  folderButton.addEventListener('click', () => folderPicker.click());
  folderPicker.addEventListener('change', () => { void loadSelectedFolder(); });
  youtubeSearchForm.addEventListener('submit', (event) => { void searchYouTube(event); });
  position.addEventListener('change', () => {
    customPositionField.wrapper.hidden = position.value !== 'custom';
    updatePreview();
  });
  customPositionField.input.addEventListener('input', updatePreview);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors([titleField, artistField, durationField, customPositionField]);
    let valid = true;
    if (!titleField.input.value.trim()) { showError(titleField, 'Escribe el título de la canción.'); valid = false; }
    if (!artistField.input.value.trim()) { showError(artistField, 'Escribe el nombre del artista.'); valid = false; }
    const durationSeconds = parseDuration(durationField.input.value);
    if (durationSeconds === null) { showError(durationField, 'Usa el formato mm:ss; los segundos van de 00 a 59.'); valid = false; }
    if (!valid || durationSeconds === null || !latestState) return;

    let index = latestState.songs.length;
    if (position.value === 'start') index = 0;
    if (position.value === 'custom') {
      const requestedPosition = Number(customPositionField.input.value);
      if (!Number.isInteger(requestedPosition) || requestedPosition < 1 || requestedPosition > latestState.songs.length + 1) {
        showError(customPositionField, `Elige una posición entre 1 y ${latestState.songs.length + 1}.`);
        return;
      }
      index = requestedPosition - 1;
    }
    try {
      player.add({
        id: createSongId(),
        title: titleField.input.value.trim(),
        artist: artistField.input.value.trim(),
        durationSec: durationSeconds,
        favorite: false
      }, index);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo agregar la canción.');
      return;
    }
    form.reset();
    customPositionField.wrapper.hidden = true;
    updatePreview();
    showToast('Canción agregada correctamente.');
    titleField.input.focus();
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, select, textarea, button'))) return;
    if (event.code === 'Space') { event.preventDefault(); player.togglePlay(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); player.next(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); player.previous(); }
    if (event.key === 'Delete' && player.getCurrentId()) removeSong(player.getCurrentId()!);
  });

  player.subscribe((state) => {
    latestState = state;
    onChange(state);
    renderState(state);
    updatePreview();
  });

  function renderState(state: PlayerState): void {
    const current = state.current;
    currentTitle.textContent = current?.title ?? 'Sin canción seleccionada';
    currentArtist.textContent = current?.artist ?? 'Agrega una canción para comenzar';
    const coverKey = current ? `${current.id}:${current.title}:${current.artist}:${current.thumbnailUrl ?? ''}:${current.youtubeVideoId ?? ''}` : 'empty';
    if (coverKey !== renderedCoverKey) {
      coverArtwork.replaceChildren(createArtwork(current?.title ?? 'Música', current?.artist ?? 'Colección local', current?.thumbnailUrl));
      renderedCoverKey = coverKey;
    }
    youtubeStage.hidden = !current?.youtubeVideoId;
    cover.classList.toggle('youtube-mode', Boolean(current?.youtubeVideoId));
    cover.classList.toggle('playing', state.isPlaying);
    eyebrow.textContent = current ? (state.isPlaying ? 'REPRODUCIENDO AHORA' : 'EN PAUSA') : 'TU REPRODUCTOR';
    progress.max = String(current?.durationSec ?? 0);
    progress.value = String(state.elapsedSec);
    elapsedLabel.textContent = formatTime(state.elapsedSec);
    durationLabel.textContent = formatTime(current?.durationSec ?? 0);
    progress.setAttribute('aria-valuetext', `${formatTime(state.elapsedSec)} de ${formatTime(current?.durationSec ?? 0)}`);
    playButton.replaceChildren(createIcon(state.isPlaying ? icons.pause : icons.play));
    playButton.disabled = current === null;
    previousButton.disabled = current === null;
    nextButton.disabled = current === null;
    progress.disabled = current === null;
    playButton.setAttribute('aria-label', state.isPlaying ? 'Pausar reproducción' : 'Reproducir');
    shuffleButton.classList.toggle('active-control', state.shuffle);
    shuffleButton.setAttribute('aria-pressed', String(state.shuffle));
    shuffleButton.setAttribute('aria-label', state.shuffle ? 'Desactivar reproducción aleatoria' : 'Activar reproducción aleatoria');
    repeatButton.classList.toggle('active-control', state.repeat !== 'none');
    repeatButton.replaceChildren(createIcon(state.repeat === 'one' ? 'repeatOne' : icons.repeat));
    repeatButton.setAttribute('aria-label', `Repetición: ${repeatName(state.repeat)}`);
    volume.value = String(state.volume);
    volumeValue.textContent = `${Math.round(state.volume * 100)}%`;
    songCount.textContent = `${state.songs.length} ${state.songs.length === 1 ? 'canción' : 'canciones'}`;
    totalDuration.textContent = `Duración total: ${formatTime(state.songs.reduce((sum, song) => sum + song.durationSec, 0))}`;
    renderPlaylist(state);
    renderVisualizer(state);
  }

  function renderPlaylist(state: PlayerState): void {
    const query = search.value.trim().toLocaleLowerCase('es');
    const renderKey = JSON.stringify([
      query,
      favoritesFilter,
      state.current?.id,
      state.isPlaying,
      state.songs.map(({ id, title, artist, favorite }) => [id, title, artist, favorite])
    ]);
    if (renderKey === renderedPlaylistKey) return;
    renderedPlaylistKey = renderKey;
    const previousPositions = new Map<string, DOMRect>();
    for (const oldRow of playlist.querySelectorAll<HTMLElement>('.song[data-song-id]')) {
      if (oldRow.dataset.songId) previousPositions.set(oldRow.dataset.songId, oldRow.getBoundingClientRect());
    }
    playlist.replaceChildren();
    const filtered = state.songs.filter((song) => {
      const matchesSearch = `${song.title} ${song.artist}`.toLocaleLowerCase('es').includes(query);
      return matchesSearch && (!favoritesFilter || song.favorite);
    });
    if (filtered.length === 0) {
      const empty = createElement('div', 'empty');
      const illustration = createElement('div', 'empty-illustration');
      illustration.append(createIcon('music'));
      const emptyTitle = createElement('strong');
      emptyTitle.textContent = state.songs.length === 0 ? 'Tu lista está vacía' : 'No hay coincidencias';
      const emptyMessage = createElement('p');
      emptyMessage.textContent = state.songs.length === 0
        ? 'Agrega tu primera canción con el formulario.'
        : 'Prueba otra búsqueda o cambia el filtro de favoritas.';
      empty.append(illustration, emptyTitle, emptyMessage);
      if (state.songs.length === 0) {
        const firstSong = createButton('Agregar tu primera canción', 'Agregar tu primera canción', 'empty-action');
        firstSong.prepend(createIcon('plus'));
        firstSong.addEventListener('click', () => {
          form.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
          titleField.input.focus();
        });
        empty.append(firstSong);
      }
      playlist.append(empty);
      return;
    }

    filtered.forEach((song) => {
      const index = state.songs.findIndex((entry) => entry.id === song.id);
      const row = createSongRow(song, index, state.songs.length, state.current?.id ?? null, state.isPlaying, {
        select: (id) => {
          player.selectSong(id);
          if (!latestState?.isPlaying) player.play();
        },
        toggleFavorite: (id) => player.toggleFavorite(id),
        move: (fromIndex, toIndex) => player.move(fromIndex, toIndex),
        remove: removeSong,
        dragStart: (id) => { draggedId = id; },
        dragEnd: () => { draggedId = null; },
        drop: (sourceId, targetIndex) => {
          const resolvedSourceId = draggedId ?? sourceId;
          const sourceIndex = state.songs.findIndex((entry) => entry.id === resolvedSourceId);
          if (sourceIndex >= 0 && sourceIndex !== targetIndex) player.move(sourceIndex, targetIndex);
        }
      });
      playlist.append(row);
      const oldPosition = previousPositions.get(song.id);
      if (oldPosition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const newPosition = row.getBoundingClientRect();
        const offsetY = oldPosition.top - newPosition.top;
        if (offsetY !== 0) row.animate([{ transform: `translateY(${offsetY}px)` }, { transform: 'translateY(0)' }], { duration: 230, easing: 'ease-out' });
      }
    });
  }

  function renderVisualizer(state: PlayerState): void {
    const renderKey = JSON.stringify([state.current?.id, state.songs.map((song) => [song.id, song.title])]);
    if (renderKey === renderedVisualizerKey) return;
    renderedVisualizerKey = renderKey;
    renderLinkedListVisualizer(nodes, state.songs, state.current?.id ?? null);
  }

  function removeSong(id: string): void {
    if (!latestState) return;
    const index = latestState.songs.findIndex((song) => song.id === id);
    const wasCurrent = latestState.current?.id === id;
    const wasPlaying = latestState.isPlaying;
    const row = playlist.querySelector<HTMLElement>(`[data-song-id="${CSS.escape(id)}"]`);
    if (index < 0) return;
    if (!row) {
      const removed = player.remove(id);
      if (removed) {
        showToast(`“${removed.title}” se eliminó de la lista.`, () => restoreSong(removed, index, wasCurrent, wasPlaying));
      }
      return;
    }
    if (row.dataset.removing === 'true') return;
    row.dataset.removing = 'true';
    let finalized = false;
    const finalizeRemoval = (): void => {
      if (finalized) return;
      finalized = true;
      const removed = player.remove(id);
      if (removed) {
        showToast(`“${removed.title}” se eliminó de la lista.`, () => restoreSong(removed, index, wasCurrent, wasPlaying));
      }
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finalizeRemoval();
      return;
    }
    const animation = row.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(14px)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
    animation.onfinish = finalizeRemoval;
    animation.oncancel = finalizeRemoval;
  }

  function updatePreview(): void {
    if (!latestState) return;
    const insertionIndex = position.value === 'start'
      ? 0
      : position.value === 'custom'
        ? Number(customPositionField.input.value) - 1
        : latestState.songs.length;
    if (position.value === 'custom' && (!Number.isInteger(insertionIndex) || insertionIndex < 0 || insertionIndex > latestState.songs.length)) {
      preview.textContent = `La posición válida va de 1 a ${latestState.songs.length + 1}.`;
      preview.classList.add('invalid-preview');
      return;
    }
    preview.classList.remove('invalid-preview');
    const before = latestState.songs[insertionIndex - 1]?.title;
    const after = latestState.songs[insertionIndex]?.title;
    if (before && after) preview.textContent = `Se insertará entre “${before}” y “${after}”.`;
    else if (after) preview.textContent = `Se insertará al inicio, antes de “${after}”.`;
    else if (before) preview.textContent = `Se insertará al final, después de “${before}”.`;
    else preview.textContent = 'La canción será la primera de la lista.';
  }

  async function loadSelectedFolder(): Promise<void> {
    const files = Array.from(folderPicker.files ?? []);
    if (files.length === 0) return;
    folderButton.disabled = true;
    folderButton.textContent = 'Leyendo archivos de música…';
    folderStatus.textContent = `Analizando metadatos de ${files.length} archivos…`;
    try {
      const result = await audioEngine.loadFiles(files);
      if (result.songs.length === 0) {
        folderStatus.textContent = 'No se encontraron archivos de audio compatibles en esa carpeta.';
        showToast('No se encontraron archivos de audio compatibles en la carpeta seleccionada.');
        return;
      }
      player.replacePlaylist(result.songs);
      audioEngine.keepFilesFor(new Set(result.songs.map((song) => song.id)));
      folderStatus.textContent = `${result.songs.length} canciones listas para reproducir.`;
      const skippedMessage = result.skippedFiles > 0 ? ` Se omitieron ${result.skippedFiles} archivos no compatibles.` : '';
      showToast(`Se cargaron ${result.songs.length} canciones desde tu carpeta.${skippedMessage}`);
    } catch {
      folderStatus.textContent = 'No se pudo leer esa carpeta.';
      showToast('No se pudo leer la carpeta de música. Intenta seleccionar otra.');
    } finally {
      folderButton.disabled = false;
      folderButton.replaceChildren(createIcon('folder'), document.createTextNode('Cargar carpeta de música'));
      folderPicker.value = '';
    }
  }

  async function searchYouTube(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const query = youtubeSearch.value.trim();
    if (!query) return;
    youtubeSearchButton.disabled = true;
    youtubeResults.replaceChildren();
    youtubeStatus.textContent = 'Buscando en YouTube…';
    try {
      const tracks = await youtubeClient.searchVideos(query);
      if (tracks.length === 0) {
        youtubeStatus.textContent = 'No se encontraron videos musicales para esa búsqueda.';
        return;
      }
      youtubeStatus.textContent = `${tracks.length} videos encontrados. Selecciona uno para agregarlo y reproducirlo.`;
      for (const track of tracks) {
        const result = createElement('div', 'youtube-result');
        if (track.thumbnailUrl) {
          const artwork = createElement('img', 'youtube-result-artwork');
          artwork.src = track.thumbnailUrl;
          artwork.alt = '';
          artwork.loading = 'lazy';
          result.append(artwork);
        }
        const info = createElement('div', 'youtube-result-info');
        const title = createElement('strong');
        title.textContent = track.title;
        const artist = createElement('span');
        artist.textContent = track.artist;
        info.append(title, artist);
        const addTrack = createButton(`Agregar y reproducir ${track.title}`, 'Escuchar', 'youtube-add-button');
        addTrack.addEventListener('click', () => {
          try {
            const wasPlaying = latestState?.isPlaying ?? false;
            if (!latestState?.songs.some((song) => song.id === track.id)) player.add(track, player.getSongCount());
            player.selectSong(track.id);
            if (!wasPlaying) player.play();
            showToast(`Reproduciendo “${track.title}” desde YouTube.`);
          } catch (error) {
            showToast(error instanceof Error ? error.message : 'No se pudo reproducir ese video.');
          }
        });
        result.append(info, addTrack);
        youtubeResults.append(result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'YouTube no pudo completar la búsqueda.';
      youtubeStatus.textContent = message;
      showToast(message);
    } finally {
      youtubeSearchButton.disabled = false;
    }
  }

  function restoreSong(song: Song, index: number, wasCurrent: boolean, wasPlaying: boolean): void {
    player.add(song, Math.min(index, player.getSongCount()));
    if (!wasCurrent) return;
    player.selectSong(song.id);
    if (wasPlaying && !latestState?.isPlaying) player.play();
  }
}

function nextRepeat(mode: PlayerState['repeat']): PlayerState['repeat'] {
  return mode === 'none' ? 'all' : mode === 'all' ? 'one' : 'none';
}

function repeatName(mode: PlayerState['repeat']): string {
  return mode === 'none' ? 'desactivada' : mode === 'all' ? 'toda la lista' : 'una canción';
}

