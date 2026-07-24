export interface TimeOfDayAtmosphere {
  timeInMinutes: number; // 0 to 1439
  formattedTime: string; // "14:30"
  periodLabel: string; // "🌅 새벽", "☀️ 낮", "🌇 석양", "🌙 밤"
  fogColor: string;
  fogRange: [number, number];
  canvasFilter: string;
  overlayColor: string;
}

export function getTimeOfDayAtmosphere(timeInMinutes: number): TimeOfDayAtmosphere {
  const mins = ((timeInMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(mins / 60);
  const remainderMins = Math.floor(mins % 60);
  const formattedTime = `${String(hours).padStart(2, '0')}:${String(remainderMins).padStart(2, '0')}`;

  // Period calculation
  if (mins >= 300 && mins < 420) {
    // 05:00 - 07:00 (Dawn)
    const ratio = (mins - 300) / 120;
    return {
      timeInMinutes: mins,
      formattedTime,
      periodLabel: '🌅 새벽 / 일출',
      fogColor: '#fdba74',
      fogRange: [1.0, 15.0],
      canvasFilter: `sepia(0.25) brightness(${0.75 + ratio * 0.2}) hue-rotate(-15deg) saturate(1.2)`,
      overlayColor: `rgba(251, 146, 60, ${0.25 - ratio * 0.15})`,
    };
  } else if (mins >= 420 && mins < 1020) {
    // 07:00 - 17:00 (Daytime)
    return {
      timeInMinutes: mins,
      formattedTime,
      periodLabel: '☀️ 맑은 낮',
      fogColor: '#87ceeb',
      fogRange: [1.0, 15.0],
      canvasFilter: 'none',
      overlayColor: 'transparent',
    };
  } else if (mins >= 1020 && mins < 1170) {
    // 17:00 - 19:30 (Sunset / Dusk)
    const ratio = (mins - 1020) / 150;
    return {
      timeInMinutes: mins,
      formattedTime,
      periodLabel: '🌇 석양 / 노을',
      fogColor: '#fb7185',
      fogRange: [1.0, 12.0],
      canvasFilter: `sepia(${0.2 + ratio * 0.25}) brightness(${0.95 - ratio * 0.3}) hue-rotate(-${15 + ratio * 20}deg) saturate(1.4)`,
      overlayColor: `rgba(244, 63, 94, ${0.05 + ratio * 0.2})`,
    };
  } else {
    // 19:30 - 05:00 (Night / Midnight)
    return {
      timeInMinutes: mins,
      formattedTime,
      periodLabel: '🌙 야간 / 미드나잇',
      fogColor: '#090d16',
      fogRange: [0.5, 10.0],
      canvasFilter: 'brightness(0.45) contrast(1.2) hue-rotate(200deg) saturate(0.7)',
      overlayColor: 'rgba(10, 15, 40, 0.35)',
    };
  }
}
