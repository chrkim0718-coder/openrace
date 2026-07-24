import type { WeatherMode } from '@/types/game';

export interface LiveWeatherResult {
  weather: WeatherMode;
  temp: number;
  description: string;
  isDay: boolean;
}

export async function fetchLiveWeather(
  lat: number,
  lng: number,
): Promise<LiveWeatherResult | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current_weather=true`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const cw = data?.current_weather;
    if (!cw) return null;

    const code = cw.weathercode ?? 0;
    const isDay = cw.is_day === 1;
    const temp = Math.round(cw.temperature ?? 20);

    let weather: WeatherMode = isDay ? 'day' : 'night';
    let description = isDay ? '맑음' : '밤';

    // Snow codes
    if (
      (code >= 71 && code <= 77) ||
      code === 85 ||
      code === 86
    ) {
      weather = 'snow';
      description = '눈';
    }
    // Rain / Drizzle / Shower codes
    else if (
      (code >= 51 && code <= 67) ||
      (code >= 80 && code <= 82) ||
      code === 95 ||
      code === 96 ||
      code === 99
    ) {
      weather = 'rain';
      description = '비';
    } else if (!isDay) {
      weather = 'night';
      description = '밤 (실시간)';
    }

    return {
      weather,
      temp,
      description: `${description} (${temp}°C)`,
      isDay,
    };
  } catch (err) {
    console.warn('Live weather fetch error:', err);
    return null;
  }
}
