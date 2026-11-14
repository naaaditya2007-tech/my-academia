export interface AttendanceMargin {
  canSkip: number;
  needed: number;
  status: 'safe' | 'edge' | 'danger';
  badgeText: string;
  badgeVariant: 'emerald' | 'amber' | 'crimson';
}

/**
 * Calculates student attendance margins based on 75% threshold
 * - If >= 75%: floor((Attended - 0.75 * Conducted) / 0.75) classes can be skipped
 * - If < 75%: ceil((0.75 * Conducted - Attended) / 0.25) consecutive classes needed
 */
export function calculateAttendanceMargin(conducted: number, attended: number): AttendanceMargin {
  if (conducted === 0) {
    return {
      canSkip: 0,
      needed: 0,
      status: 'safe',
      badgeText: 'No classes conducted yet',
      badgeVariant: 'emerald',
    };
  }

  const currentPercent = (attended / conducted) * 100;

  // Exact Integer Formula:
  // If A / C >= 0.75: SafeBunks = floor((4*A - 3*C) / 3)
  // If A / C < 0.75: ClassesNeeded = ceil(3*C - 4*A)
  if (4 * attended >= 3 * conducted) {
    const canSkip = Math.floor((4 * attended - 3 * conducted) / 3);
    if (canSkip === 0 || Math.abs(currentPercent - 75) < 0.1) {
      return {
        canSkip: 0,
        needed: 0,
        status: 'edge',
        badgeText: "Right on the line — don't miss the next one",
        badgeVariant: 'amber',
      };
    }
    return {
      canSkip,
      needed: 0,
      status: 'safe',
      badgeText: `Can skip ${canSkip} ${canSkip === 1 ? 'class' : 'classes'} safely`,
      badgeVariant: 'emerald',
    };
  } else {
    const needed = Math.max(1, Math.ceil(3 * conducted - 4 * attended));
    return {
      canSkip: 0,
      needed,
      status: 'danger',
      badgeText: `Need to attend the next ${needed} ${needed === 1 ? 'class' : 'classes'} to hit 75%`,
      badgeVariant: 'crimson',
    };
  }
}

/**
 * Formats time from 24h (e.g. "08:00") to 12h human readable format ("8:00 AM")
 */
export function formatTime12h(time24: string): string {
  if (!time24) return '';
  const parts = time24.split(':');
  let hour = parseInt(parts[0], 10);
  const min = parts[1] || '00';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${min} ${ampm}`;
}

/**
 * Returns human-readable relative time (e.g. "Updated 4 mins ago")
 */
export function formatRelativeTime(dateString: string): string {
  if (!dateString) return 'Not synced';
  const now = new Date();
  const past = new Date(dateString);
  const diffSec = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffSec < 60) return 'Updated just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return 'Updated 1 min ago';
  if (diffMin < 60) return `Updated ${diffMin} mins ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours === 1) return 'Updated 1 hour ago';
  if (diffHours < 24) return `Updated ${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `Updated ${diffDays} days ago`;
}
