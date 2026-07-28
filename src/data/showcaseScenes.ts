import type { WeatherMode } from '@/types/game';
import type { CameraMode } from '@/components/HUD';

export interface ShowcaseScene {
  id: string;
  title: string;
  locationLabel: string;
  lat: number;
  lng: number;
  heading?: number; // Road direction heading angle
  timeInMinutes: number; // 0..1439
  weather: WeatherMode;
  weatherIntensity: number; // 1..5
  cameraMode: CameraMode;
  terrainScale: number;
  bgmTrackId: string;
  description: string;
}

export const SHOWCASE_SCENES: ShowcaseScene[] = [
  {
    id: 'banpo_bridge',
    title: '🌧️ 비오는 서울 한강 & 반포대교 야경',
    locationLabel: '반포대교 (서울, 대한민국)',
    lat: 37.5115,
    lng: 126.995,
    heading: 170,
    timeInMinutes: 1380, // 23:00 Night
    weather: 'rain',
    weatherIntensity: 3,
    cameraMode: 'chase',
    terrainScale: 1.0,
    bgmTrackId: 'synthwave_80s',
    description: '빗방울과 보랏빛 야간 조명이 번지는 환상의 서울 한강 드라이브',
  },
  {
    id: 'haeundae_sunset',
    title: '🌊 부산 해운대 해안도로 노을 드라이브',
    locationLabel: '부산 해운대 해수욕장 (부산, 대한민국)',
    lat: 35.1587,
    lng: 129.1604,
    heading: 75,
    timeInMinutes: 1110, // 18:30 Sunset
    weather: 'day',
    weatherIntensity: 1,
    cameraMode: 'topdown',
    terrainScale: 1.0,
    bgmTrackId: 'funk_game_loop_real',
    description: '붉게 물드는 석양 노을과 바다 파도 소리가 흐르는 조감도 뷰',
  },
  {
    id: 'furka_pass_snow',
    title: '❄️ 스위스 알프스 푸르카 패스 설경',
    locationLabel: '푸르카 패스 (알프스, 스위스)',
    lat: 46.5724,
    lng: 8.4144,
    heading: 250,
    timeInMinutes: 720, // 12:00 Day
    weather: 'snow',
    weatherIntensity: 4,
    cameraMode: 'sky',
    terrainScale: 1.9,
    bgmTrackId: 'jingle_bells_real',
    description: '영화 007 골드핑거 무대! 만설이 덮인 영구설산의 시네마틱 뷰',
  },
  {
    id: 'namsan_night',
    title: '🎷 남산 서울타워 심야 야간 다운힐',
    locationLabel: '남산서울타워 (서울, 대한민국)',
    lat: 37.5512,
    lng: 126.9882,
    heading: 210,
    timeInMinutes: 1350, // 22:30 Night
    weather: 'day',
    weatherIntensity: 1,
    cameraMode: 'chase',
    terrainScale: 1.0,
    bgmTrackId: 'smooth_jazz_lounge',
    description: '서울의 밤 야경을 조망하며 내려오는 스무스 재즈 드라이빙',
  },
  {
    id: 'tokyo_c1_midnight',
    title: '🌃 일본 도쿄 수도고속도로 C1 미드나잇',
    locationLabel: '일본 도쿄 수도고속도로 (C1 환상선)',
    lat: 35.6586,
    lng: 139.7454,
    heading: 15,
    timeInMinutes: 1410, // 23:30 Midnight
    weather: 'night',
    weatherIntensity: 1,
    cameraMode: 'bonnet',
    terrainScale: 1.0,
    bgmTrackId: 'synthwave_viper_real',
    description: '1인칭 시점으로 즐기는 도쿄 타워 네온 고속도로 미드나잇 비행',
  },
  {
    id: 'nice_cote_dazur',
    title: '🌴 프랑스 니스 코트다쥐르 해안 도로',
    locationLabel: '니스 프롬나드 데 앙글레 (프랑스)',
    lat: 43.696,
    lng: 7.2656,
    heading: 235,
    timeInMinutes: 1050, // 17:30 Golden Hour
    weather: 'day',
    weatherIntensity: 1,
    cameraMode: 'sky',
    terrainScale: 1.0,
    bgmTrackId: 'carefree_drive_real',
    description: '지중해 상쾌한 해풍과 어쿠스틱 라이브 연주가 흐르는 시원한 파노라마',
  },
  {
    id: 'victoria_peak_lofi',
    title: '🌃 홍콩 빅토리아 피크 야경 & 로파이',
    locationLabel: '홍콩 빅토리아 피크 (홍콩)',
    lat: 22.2759,
    lng: 114.1455,
    heading: 95,
    timeInMinutes: 1380, // 23:00 Night
    weather: 'rain',
    weatherIntensity: 2,
    cameraMode: 'topdown',
    terrainScale: 1.0,
    bgmTrackId: 'mellow_lofi',
    description: '백만 달러짜리 홍콩 야경 위로 내리는 가슬비와 감성 로파이 비트',
  },
  {
    id: 'daegwallyeong_sunrise',
    title: '🏔️ 강원도 대관령 양떼목장 운해 일출',
    locationLabel: '대관령 (강원 평창, 대한민국)',
    lat: 37.6892,
    lng: 128.7562,
    heading: 120,
    timeInMinutes: 390, // 06:30 Sunrise
    weather: 'day',
    weatherIntensity: 1,
    cameraMode: 'sky',
    terrainScale: 1.9,
    bgmTrackId: 'acoustic_warmth',
    description: '백두대간 구름 바다를 뚫고 피어나는 일출 빛과 어쿠스틱 모닝',
  },
];
