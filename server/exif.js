/**
 * Reads the date a photo was taken out of its own metadata.
 *
 * This is what makes "upload forty photos from the last three years in
 * whatever order they come off the phone" work. Every phone stamps the
 * capture time into the file, so in most cases nobody has to type a date at
 * all, and the timeline orders itself.
 *
 * Parsed on the server rather than in the browser: it keeps the client bundle
 * out of it, and it works the same for every upload path.
 */

import exifr from 'exifr';

/**
 * EXIF capture dates are wall-clock local time with no zone, which is exactly
 * what we want. Converting through UTC can shift a late-evening photo onto the
 * following day, so the date parts are read directly rather than via toISOString.
 */
function toLocalISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @returns {Promise<string>} YYYY-MM-DD, or '' when the file carries no usable date
 */
export async function captureDateOf(filePath) {
  try {
    const tags = await exifr.parse(filePath, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
      // Videos and stripped images simply have nothing to read.
      silentErrors: true,
    });
    if (!tags) return '';

    // DateTimeOriginal is the shutter press. The others are fallbacks that can
    // reflect an edit or a copy, so they are only used when the real one is gone.
    const candidate = tags.DateTimeOriginal || tags.CreateDate || tags.ModifyDate;
    const iso = toLocalISODate(candidate);
    if (!iso) return '';

    // Guard against obviously wrong clocks. A camera with a dead battery
    // happily stamps 1980, and a phone set wrong can stamp the future.
    const year = Number(iso.slice(0, 4));
    const thisYear = new Date().getFullYear();
    if (year < 1900 || year > thisYear + 1) return '';

    return iso;
  } catch {
    // Metadata is a bonus, never a requirement. A file that cannot be parsed
    // uploads exactly as before.
    return '';
  }
}
