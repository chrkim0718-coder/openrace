export interface BGMTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  url: string;
}

export const DRIVING_BGM_PLAYLIST: BGMTrack[] = [
  {
    id: 'synthwave_midnight',
    title: 'Midnight Cyberpunk Drive',
    artist: 'Synthwave Freedom',
    genre: '🌃 Synthwave',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=synthwave-80s-110045.mp3',
  },
  {
    id: 'lofi_sunset',
    title: 'Sunset Highway Chill',
    artist: 'Lo-Fi Coast',
    genre: '☕ Lo-Fi Chill',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73155.mp3?filename=chill-lofi-song-8444.mp3',
  },
  {
    id: 'high_octane_racing',
    title: 'High Octane Highway',
    artist: 'Neon Race',
    genre: '⚡ High Octane EDM',
    url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=action-sport-rock-10338.mp3',
  },
  {
    id: 'alpine_breeze',
    title: 'Alpine Breeze Acoustic',
    artist: 'Scenic Mountain',
    genre: '🏔️ Acoustic Chill',
    url: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792d6.mp3?filename=deep-ambient-124997.mp3',
  },
  {
    id: 'tokyo_night_drive',
    title: 'Tokyo Night Cruise',
    artist: 'Mid-City Jazz',
    genre: '🎹 Night City Jazz',
    url: 'https://cdn.pixabay.com/download/audio/2022/11/06/audio_c42f026a79.mp3?filename=night-drive-127116.mp3',
  },
];

class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentTrackIndex = 0;
  private isPlaying = false;
  private volume = 0.5;
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.crossOrigin = 'anonymous';
      this.audio.volume = this.volume;

      this.audio.addEventListener('ended', () => {
        this.nextTrack();
      });

      this.audio.addEventListener('error', () => {
        // Fallback to next track if CDN fails
        console.warn('BGM track error, switching to next track');
        this.nextTrack();
      });
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public getCurrentTrack(): BGMTrack {
    return DRIVING_BGM_PLAYLIST[this.currentTrackIndex];
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getVolume(): number {
    return this.volume;
  }

  public play() {
    if (!this.audio) return;
    const track = this.getCurrentTrack();
    if (this.audio.src !== track.url) {
      this.audio.src = track.url;
    }
    this.audio
      .play()
      .then(() => {
        this.isPlaying = true;
        this.notify();
      })
      .catch((err) => {
        console.warn('BGM play blocked or failed:', err);
        this.isPlaying = false;
        this.notify();
      });
  }

  public pause() {
    if (!this.audio) return;
    this.audio.pause();
    this.isPlaying = false;
    this.notify();
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public nextTrack() {
    this.currentTrackIndex =
      (this.currentTrackIndex + 1) % DRIVING_BGM_PLAYLIST.length;
    if (this.audio) {
      this.audio.src = this.getCurrentTrack().url;
      if (this.isPlaying) {
        this.play();
      } else {
        this.notify();
      }
    }
  }

  public prevTrack() {
    this.currentTrackIndex =
      (this.currentTrackIndex - 1 + DRIVING_BGM_PLAYLIST.length) %
      DRIVING_BGM_PLAYLIST.length;
    if (this.audio) {
      this.audio.src = this.getCurrentTrack().url;
      if (this.isPlaying) {
        this.play();
      } else {
        this.notify();
      }
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
    this.notify();
  }
}

export const musicPlayer = new MusicPlayer();
