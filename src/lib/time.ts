/**
 * Formats a transcript timestamp as an mm:ss offset from call start.
 * Returns "—" when the offset can't be computed.
 */
export function formatOffset(startIso: string | null | undefined, lineIso: string): string {
  if (!startIso) return "—";
  const start = new Date(startIso).getTime();
  const line = new Date(lineIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(line)) return "—";
  const totalSeconds = Math.max(0, Math.floor((line - start) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
