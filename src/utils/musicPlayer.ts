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
    url: 'https://cdn.pixabay.com/download/audio/2022/11/24/audio_34b39b0368.mp3?filename=jingle-bells-christmas-127733.mp3',
  },
  {
    id: 'merry_christmas_carol',
    title: 'We Wish You a Merry Christmas',
    artist: 'Christmas Magic',
    genre: '🎄 윈터 캐롤',
    url: 'https://cdn.pixabay.com/download/audio/2022/12/08/audio_6513364fbe.mp3?filename=christmas-magic-129068.mp3',
  },
  {
    id: 'silent_night_lofi',
    title: 'Silent Night Lo-Fi Carol',
    artist: 'Winter Chill Hop',
    genre: '❄️ 캐롤 로파이',
    url: 'https://cdn.pixabay.com/download/audio/2022/11/28/audio_24e0573981.mp3?filename=lofi-christmas-128224.mp3',
  },
  {
    id: 'winter_wonderland',
    title: 'Winter Wonderland Orchestra',
    artist: 'Snowy Orchestra',
    genre: '🎄 윈터 캐롤',
    url: 'https://cdn.pixabay.com/download/audio/2022/11/15/audio_b2f9c34a17.mp3?filename=christmas-carol-126861.mp3',
  },
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
  {
    id: 'tropical_beach_pop',
    title: 'Tropical Beach Highway',
    artist: 'Summer Breeze',
    genre: '🌊 Tropical EDM',
    url: 'https://cdn.pixabay.com/download/audio/2022/08/02/audio_884b9c6302.mp3?filename=summer-chill-pop-117215.mp3',
  },
  {
    id: 'neon_tokyo_drift',
    title: 'Neon Cyberpunk Drift',
    artist: 'Future Bass 15',
    genre: '🏎️ Cyberpunk Beat',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_510d9f481c.mp3?filename=future-bass-15-10023.mp3',
  },
  {
    id: 'space_synth',
    title: 'Deep Space Synthwave',
    artist: 'Arcadia Retro',
    genre: '🌌 Space Synth',
    url: 'https://cdn.pixabay.com/download/audio/2022/04/27/audio_6a30c5e317.mp3?filename=retro-synthwave-108754.mp3',
  },
  {
    id: 'night_city_sax',
    title: 'Smooth Night Lounge Sax',
    artist: 'Urban Jazz Ensemble',
    genre: '🎷 Urban Jazz',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_db6f7b1548.mp3?filename=jazz-lounge-112544.mp3',
  },
  {
    id: 'sunset_coast_rock',
    title: 'Sunset Coast Acoustic Rock',
    artist: 'Pacific Guitars',
    genre: '🎸 Coast Rock',
    url: 'https://cdn.pixabay.com/download/audio/2022/01/26/audio_d0c6af3823.mp3?filename=acoustic-guitars-10497.mp3',
  },
  {
    id: 'rainy_day_lofi',
    title: 'Rainy Day Lo-Fi Beats',
    artist: 'Midnight Rain',
    genre: '🌧️ Rainy Lo-Fi',
    url: 'https://cdn.pixabay.com/download/audio/2022/02/10/audio_fc86ec6211.mp3?filename=lofi-study-112191.mp3',
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
