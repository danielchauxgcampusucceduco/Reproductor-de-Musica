import './styles/tokens.css';
import './styles/base.css';
import './styles/animations.css';
import { MusicPlayer } from './domain/MusicPlayer';
import { BrowserAudioEngine } from './domain/AudioEngine';
import { HybridAudioEngine } from './domain/HybridAudioEngine';
import { YouTubeClient } from './domain/YouTubeClient';
import { YouTubePlaybackEngine } from './domain/YouTubePlaybackEngine';
import { loadPlayerState, savePlayerState } from './services/storage';
import { mountPlayer } from './ui/render';
import { showToast } from './ui/components/Toast';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('No se encontró el contenedor principal de la aplicación.');

const savedState = loadPlayerState();
const localAudioEngine = new BrowserAudioEngine();
const youtubeClient = new YouTubeClient();
const youtubePlayback = new YouTubePlaybackEngine();
const audioEngine = new HybridAudioEngine(localAudioEngine, youtubePlayback);
const player = new MusicPlayer(savedState?.songs ?? [], savedState?.currentId, audioEngine);
audioEngine.setErrorHandler((error) => {
  player.pause();
  showToast(error?.message ?? 'El navegador no pudo reproducir este archivo de audio.');
});
try {
  const savedTheme = localStorage.getItem('taller-player-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.dataset.theme = savedTheme;
} catch {
  // El reproductor conserva su tema claro predeterminado si el almacenamiento no está disponible.
}

let lastSavedVersion = -1;
let lastSavedCurrentId: string | null | undefined;
mountPlayer(root, player, localAudioEngine, youtubeClient, youtubePlayback, (state) => {
  const currentId = state.current?.id ?? null;
  if (state.playlistVersion === lastSavedVersion && currentId === lastSavedCurrentId) return;
  lastSavedVersion = state.playlistVersion;
  lastSavedCurrentId = currentId;
  const persistentSongs = state.songs.filter((song) => !localAudioEngine.hasFile(song.id));
  const persistentCurrentId = persistentSongs.some((song) => song.id === currentId) ? currentId : null;
  savePlayerState(persistentSongs, persistentCurrentId);
});

window.addEventListener('pagehide', () => player.destroy(), { once: true });
