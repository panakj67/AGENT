/**
 * Timezone utilities for IST (Indian Standard Time - UTC+5:30)
 */

const IST_OFFSET = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds

/**
 * Convert an ISO string or Date to IST equivalent
 * When user says "tomorrow at 10am", they mean IST 10am
 * This converts that to UTC for storage
 */
export function parseIST(dateString) {
  if (!dateString) return null;

  try {
    // Parse the string as if it's already in IST
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;

    // If it's already an ISO string (ends with Z), it's UTC - adjust for IST
    if (typeof dateString === 'string' && dateString.endsWith('Z')) {
      return date; // Already in UTC, return as-is
    }

    // If it's a local time string like "2026-03-03T10:00:00"
    // User means IST, so we need to convert IST → UTC
    // IST is UTC+5:30, so to convert IST to UTC, we subtract 5:30
    const istDate = new Date(date.getTime() - IST_OFFSET);
    return istDate;
  } catch {
    return null;
  }
}

/**
 * Format a Date or ISO string to IST display format
 * Example: "March 3, 2026 at 10:30 AM IST"
 */
export function formatIST(dateInput) {
  if (!dateInput) return '';

  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    // Convert UTC to IST by adding 5:30
    const istDate = new Date(date.getTime() + IST_OFFSET);

    // Format: "Mar 3, 2026 at 10:30 AM IST"
    return istDate.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }) + ' IST';
  } catch {
    return '';
  }
}

/**
 * Get current date/time in IST
 */
export function getNowIST() {
  const now = new Date();
  return new Date(now.getTime() + IST_OFFSET);
}

/**
 * Parse relative date strings in IST context
 * Examples: "tomorrow at 10am", "after 5 minutes", "in 2 hours"
 */
export function parseRelativeIST(relativeString) {
  if (!relativeString) return null;

  const now = new Date();
  const nowIST = new Date(now.getTime() + IST_OFFSET);
  const text = String(relativeString).toLowerCase().trim();

  // Tomorrow at specific time
  const tomorrowMatch = text.match(/tomorrow\s+at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
  if (tomorrowMatch) {
    const tomorrow = new Date(nowIST);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const hour = parseInt(tomorrowMatch[1]);
    const min = parseInt(tomorrowMatch[2]) || 0;
    const period = tomorrowMatch[3];

    let finalHour = hour;
    if (period === 'pm' && hour !== 12) finalHour = hour + 12;
    if (period === 'am' && hour === 12) finalHour = 0;

    tomorrow.setHours(finalHour, min, 0, 0);
    // Convert IST back to UTC for storage
    return new Date(tomorrow.getTime() - IST_OFFSET);
  }

  // In X hours/days/minutes OR after X hours/days/minutes
  const relativeMatch = text.match(/(in|after)\s+(\d+)\s+(hour|day|minute)s?/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[2]);
    const unit = relativeMatch[3];
    const result = new Date(now);

    if (unit === 'hour') result.setHours(result.getHours() + amount);
    if (unit === 'day') result.setDate(result.getDate() + amount);
    if (unit === 'minute') result.setMinutes(result.getMinutes() + amount);

    return result;
  }

  return null;
}

export default {
  parseIST,
  formatIST,
  getNowIST,
  parseRelativeIST,
  IST_OFFSET,
};
