// Young Sails — small pieces of sailing knowledge shared by explorers,
// wiki pages and (later) the game.

// Rough apparent-wind angle (degrees off the bow) for a given boom angle.
// Close-hauled ≈ 10–15° of boom, beam reach ≈ 35°, running ≈ 85°.
export function windAngleFromBoom(boomDeg) {
  return Math.min(180, 25 + 1.85 * Math.abs(boomDeg));
}

// Key into i18n "pointsOfSail" for a wind angle.
export function pointOfSail(windDeg, boomDeg) {
  if (Math.abs(boomDeg) < 4) return 'headToWind';
  if (windDeg < 55) return 'closeHauled';
  if (windDeg < 80) return 'closeReach';
  if (windDeg < 110) return 'beamReach';
  if (windDeg < 155) return 'broadReach';
  return 'running';
}

// Boom out to port means the wind comes over the starboard side: starboard tack.
export function tackFromBoom(boomDeg) {
  if (Math.abs(boomDeg) < 4) return null;
  return boomDeg < 0 ? 'starboardTack' : 'portTack';
}
