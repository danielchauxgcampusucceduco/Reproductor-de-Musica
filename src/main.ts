import './styles/tokens.css';
import './styles/base.css';
import './styles/animations.css';
import { MusicPlayer } from './domain/MusicPlayer';
import { BrowserAudioEngine } from './domain/AudioEngine';
import { loadPlayerState, savePlayerState } from './services/storage';
import { mountPlayer } from './ui/render';
import { showToast } from './ui/components/Toast';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('No se encontró el contenedor principal de la aplicación.');

const savedState = loadPlayerState();
const audioEngine = new BrowserAudioEngine();
const player = new MusicPlayer(savedState?.songs ?? [], savedState?.currentId, audioEngine);
audioEngine.setErrorHandler(() => {
  player.pause();
  showToast('El navegador no pudo reproducir este archivo de audio.');
});
try {
  const savedTheme = localStorage.getItem('taller-player-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.dataset.theme = savedTheme;
} catch {
  // El reproductor conserva el tema oscuro predeterminado si el almacenamiento no está disponible.
}

let lastSavedVersion = -1;
let lastSavedCurrentId: string | null | undefined;
mountPlayer(root, player, audioEngine, (state) => {
  const currentId = state.current?.id ?? null;
  if (state.playlistVersion === lastSavedVersion && currentId === lastSavedCurrentId) return;
  lastSavedVersion = state.playlistVersion;
  lastSavedCurrentId = currentId;
  const persistentSongs = state.songs.filter((song) => !audioEngine.hasFile(song.id));
  const persistentCurrentId = persistentSongs.some((song) => song.id === currentId) ? currentId : null;
  savePlayerState(persistentSongs, persistentCurrentId);
});

window.addEventListener('pagehide', () => player.destroy(), { once: true });
