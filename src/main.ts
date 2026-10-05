import './styles/tokens.css';
import './styles/base.css';
import './styles/animations.css';
import { MusicPlayer } from './domain/MusicPlayer';
import { BrowserAudioEngine } from './domain/AudioEngine';
import { HybridAudioEngine } from './domain/HybridAudioEngine';
import { SpotifyClient } from './domain/SpotifyClient';
import { SpotifyPlaybackEngine } from './domain/SpotifyPlaybackEngine';
import { loadPlayerState, savePlayerState } from './services/storage';
import { mountPlayer } from './ui/render';
import { showToast } from './ui/components/Toast';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('No se encontró el contenedor principal de la aplicación.');

const savedState = loadPlayerState();
const localAudioEngine = new BrowserAudioEngine();
const spotifyClient = new SpotifyClient(import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '');
const spotifyPlayback = new SpotifyPlaybackEngine(spotifyClient);
const audioEngine = new HybridAudioEngine(localAudioEngine, spotifyPlayback);
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
mountPlayer(root, player, localAudioEngine, spotifyClient, spotifyPlayback, (state) => {
  const currentId = state.current?.id ?? null;
  if (state.playlistVersion === lastSavedVersion && currentId === lastSavedCurrentId) return;
  lastSavedVersion = state.playlistVersion;
  lastSavedCurrentId = currentId;
  const persistentSongs = state.songs.filter((song) => !localAudioEngine.hasFile(song.id));
  const persistentCurrentId = persistentSongs.some((song) => song.id === currentId) ? currentId : null;
  savePlayerState(persistentSongs, persistentCurrentId);
});

void spotifyClient.initialize();

window.addEventListener('pagehide', () => player.destroy(), { once: true });
