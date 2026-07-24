export interface BGMTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  url: string;
}

export const DRIVING_BGM_PLAYLIST: BGMTrack[] = [
  {
    id: 'jingle_bells_real',
    title: 'Jingle Bells (오케스트라 실제 연주)',
    artist: 'Kevin MacLeod (Incompetech)',
    genre: '🎄 윈터 캐롤',
    url: '/audio/bgm/jingle_bells_real.mp3',
  },
  {
    id: 'wish_background',
    title: 'We Wish You a Merry Christmas (스튜디오 캐롤)',
    artist: 'Kevin MacLeod (Incompetech)',
    genre: '🎄 윈터 캐롤',
    url: '/audio/bgm/wish_background.mp3',
  },
  {
    id: 'silent_night_real',
    title: 'Silent Night (실제 피아노 연주)',
    artist: 'Kevin MacLeod (Incompetech)',
    genre: '❄️ 캐롤 피아노',
    url: '/audio/bgm/silent_night.mp3',
  },
  {
    id: 'deck_the_halls_real',
    title: 'Deck the Halls (윈터 브라스 연주)',
    artist: 'Kevin MacLeod (Incompetech)',
    genre: '🎄 윈터 브라스',
    url: '/audio/bgm/deck_the_halls.mp3',
  },
  {
    id: 'joy_to_the_world_real',
    title: 'Joy To The World (윈터 오케스트라)',
    artist: 'Holiday Symphony',
    genre: '🎄 윈터 캐롤',
    url: '/audio/bgm/joy_to_the_world.mp3',
  },
  {
    id: 'carefree_drive_real',
    title: 'Carefree Highway Drive (어쿠스틱 기타 라이브)',
    artist: 'Kevin MacLeod (Incompetech)',
    genre: '🎸 어쿠스틱 드라이브',
    url: '/audio/bgm/carefree_drive.mp3',
  },
  {
    id: 'jazz_lounge_real',
    title: 'Midnight City Jazz (실제 재즈 콰르텟 연주)',
    artist: 'Kevin MacLeod (Incompetech)',
    genre: '🎷 릴랙싱 재즈',
    url: '/audio/bgm/jazz_lounge.mp3',
  },
  {
    id: 'chillwave_drive_real',
    title: 'Sunset Drive Synthwave (스튜디오 어반)',
    artist: 'Kevin MacLeod (Incompetech)',
    genre: '🌃 Synthwave',
    url: '/audio/bgm/chillwave_drive.mp3',
  },
  {
    id: 'funk_game_loop_real',
    title: 'Funky Urban Highway (실제 베이스 & 펑크)',
    artist: 'Kevin MacLeod (Incompetech)',
    genre: '🕺 시티 펑크',
    url: '/audio/bgm/funk_game_loop.mp3',
  },
  {
    id: 'synthwave_viper_real',
    title: 'Viper Cyberpunk Highway (실제 신스웨이브)',
    artist: 'MDN Sound',
    genre: '🏎️ Cyberpunk Beat',
    url: '/audio/bgm/synthwave_viper.mp3',
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

      this.audio.addEventListener('error', (e) => {
        console.warn('BGM track error, switching to next track', e);
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
