export interface BGMTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  url: string;
}

export const DRIVING_BGM_PLAYLIST: BGMTrack[] = [
  {
    id: 'jingle_bells_snow',
    title: 'Jingle Bells Snow Drive',
    artist: 'Holiday Festive',
    genre: '🎄 윈터 캐롤',
    url: '/audio/bgm/jingle_bells.wav',
  },
  {
    id: 'merry_christmas_carol',
    title: 'We Wish You a Merry Christmas',
    artist: 'Christmas Magic',
    genre: '🎄 윈터 캐롤',
    url: '/audio/bgm/merry_christmas.wav',
  },
  {
    id: 'silent_night_lofi',
    title: 'Silent Night Lo-Fi Carol',
    artist: 'Winter Chill Hop',
    genre: '❄️ 캐롤 로파이',
    url: '/audio/bgm/silent_night.wav',
  },
  {
    id: 'deck_the_halls',
    title: 'Deck the Halls Carol',
    artist: 'Festive Glockenspiel',
    genre: '🎄 윈터 캐롤',
    url: '/audio/bgm/deck_the_halls.wav',
  },
  {
    id: 'synthwave_midnight',
    title: 'Midnight Cyberpunk Drive',
    artist: 'Synthwave Freedom',
    genre: '🌃 Synthwave',
    url: '/audio/bgm/synthwave_midnight.wav',
  },
  {
    id: 'lofi_sunset',
    title: 'Sunset Highway Chill',
    artist: 'Lo-Fi Coast',
    genre: '☕ Lo-Fi Chill',
    url: '/audio/bgm/lofi_sunset.wav',
  },
  {
    id: 'high_octane_racing',
    title: 'High Octane Highway',
    artist: 'Neon Race',
    genre: '⚡ High Octane EDM',
    url: '/audio/bgm/high_octane.wav',
  },
  {
    id: 'alpine_breeze',
    title: 'Alpine Breeze Acoustic',
    artist: 'Scenic Mountain',
    genre: '🏔️ Acoustic Chill',
    url: '/audio/bgm/alpine_breeze.wav',
  },
  {
    id: 'tokyo_night_drive',
    title: 'Tokyo Night Cruise',
    artist: 'Mid-City Jazz',
    genre: '🎹 Night City Jazz',
    url: '/audio/bgm/tokyo_night_jazz.wav',
  },
  {
    id: 'tropical_beach_pop',
    title: 'Tropical Beach Highway',
    artist: 'Summer Breeze',
    genre: '🌊 Tropical EDM',
    url: '/audio/bgm/tropical_beach.wav',
  },
  {
    id: 'neon_tokyo_drift',
    title: 'Neon Cyberpunk Drift',
    artist: 'Future Bass 15',
    genre: '🏎️ Cyberpunk Beat',
    url: '/audio/bgm/neon_tokyo_drift.wav',
  },
  {
    id: 'space_synth',
    title: 'Deep Space Synthwave',
    artist: 'Arcadia Retro',
    genre: '🌌 Space Synth',
    url: '/audio/bgm/space_synth.wav',
  },
  {
    id: 'night_city_sax',
    title: 'Smooth Night Lounge Sax',
    artist: 'Urban Jazz Ensemble',
    genre: '🎷 Urban Jazz',
    url: '/audio/bgm/night_city_sax.wav',
  },
  {
    id: 'sunset_coast_rock',
    title: 'Sunset Coast Acoustic Rock',
    artist: 'Pacific Guitars',
    genre: '🎸 Coast Rock',
    url: '/audio/bgm/sunset_coast_rock.wav',
  },
  {
    id: 'rainy_day_lofi',
    title: 'Rainy Day Lo-Fi Beats',
    artist: 'Midnight Rain',
    genre: '🌧️ Rainy Lo-Fi',
    url: '/audio/bgm/rainy_day_lofi.wav',
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
        console.warn('BGM track error, switching to next track');
        this.nextTrack();
      });
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
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
    if (this.audio.src !== track.url && !this.audio.src.endsWith(track.url)) {
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
