/**
 * Converts a subscriber's preferred local digest hour into the UTC hour the
 * hourly tick actually matches
 */
export function localHourToUtcHour(localHour: number, timezone: string): number {
  const now = new Date();
  const offsetMinutes = getUtcOffsetMinutes(timezone, now);
  const utcHour = Math.round(localHour - offsetMinutes / 60);
  return ((utcHour % 24) + 24) % 24;
}

function getUtcOffsetMinutes(timezone: string, at: Date): number {
  const utcString = at.toLocaleString("en-US", { timeZone: "UTC" });
  const tzString = at.toLocaleString("en-US", { timeZone: timezone });
  return (new Date(tzString).getTime() - new Date(utcString).getTime()) / 60_000;
}
