import { Course, DayOrderSlot, ScheduledClass } from '@/types/campus';

// Standard SRM University Academic Hour Periods (Generic slots - zero hardcoded course codes)
export const SRM_AUTHENTIC_DAY_ORDER_MATRIX: Record<number, DayOrderSlot[]> = {
  1: [
    { periodIndex: 1, slotCode: 'Slot A', startTime: '08:00', endTime: '09:40', isLab: false },
    { periodIndex: 2, slotCode: 'Slot B', startTime: '09:45', endTime: '11:30', isLab: false },
    { periodIndex: 3, slotCode: 'Slot C', startTime: '13:25', endTime: '15:10', isLab: false },
  ],
  2: [
    { periodIndex: 1, slotCode: 'Slot D', startTime: '12:30', endTime: '14:15', isLab: false },
    { periodIndex: 2, slotCode: 'Slot E', startTime: '14:20', endTime: '16:00', isLab: false },
  ],
  3: [
    { periodIndex: 1, slotCode: 'Slot F', startTime: '08:00', endTime: '09:40', isLab: false },
    { periodIndex: 2, slotCode: 'Slot A', startTime: '09:45', endTime: '10:35', isLab: false },
    { periodIndex: 3, slotCode: 'Slot B', startTime: '10:40', endTime: '11:30', isLab: false },
    { periodIndex: 4, slotCode: 'Slot C', startTime: '11:35', endTime: '12:25', isLab: false },
    { periodIndex: 5, slotCode: 'Slot P1', startTime: '13:25', endTime: '15:10', isLab: true },
    { periodIndex: 6, slotCode: 'Slot P2', startTime: '15:10', endTime: '16:50', isLab: true },
  ],
  4: [
    { periodIndex: 1, slotCode: 'Slot G', startTime: '12:30', endTime: '14:15', isLab: false },
    { periodIndex: 2, slotCode: 'Slot D', startTime: '14:20', endTime: '15:10', isLab: false },
    { periodIndex: 3, slotCode: 'Slot E', startTime: '16:00', endTime: '16:50', isLab: false },
  ],
  5: [
    { periodIndex: 1, slotCode: 'Slot F', startTime: '09:45', endTime: '10:35', isLab: false },
    { periodIndex: 2, slotCode: 'Slot G', startTime: '10:40', endTime: '11:30', isLab: false },
    { periodIndex: 3, slotCode: 'Slot A', startTime: '11:35', endTime: '12:25', isLab: false },
    { periodIndex: 4, slotCode: 'Slot B', startTime: '13:25', endTime: '14:15', isLab: false },
  ],
};

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function buildDayTimeline(
  dayOrder: number,
  courses: Course[],
  matrix: Record<number, DayOrderSlot[]> = SRM_AUTHENTIC_DAY_ORDER_MATRIX,
  currentTimeMinutes?: number | null,
  isLiveDay: boolean = false
): ScheduledClass[] {
  if (!courses || courses.length === 0) return [];

  const slots = matrix[dayOrder] || [];
  if (slots.length === 0) return [];

  const mappedSlots: ScheduledClass[] = [];

  for (let idx = 0; idx < slots.length; idx++) {
    const slot = slots[idx];
    // Match enrolled courses to slot codes or distribute enrolled courses
    const matchedCourse =
      courses.find((c) => {
        const cCode = c.code.trim().toUpperCase();
        const sSlot = slot.slotCode.trim().toUpperCase();
        return cCode === sSlot || c.slot.toUpperCase() === sSlot;
      }) || courses[idx % courses.length];

    const startM = parseTimeToMinutes(slot.startTime);
    const endM = parseTimeToMinutes(slot.endTime);

    let status: 'completed' | 'live' | 'upcoming' = 'upcoming';

    if (isLiveDay && currentTimeMinutes !== null && currentTimeMinutes !== undefined) {
      if (currentTimeMinutes >= endM) {
        status = 'completed';
      } else if (currentTimeMinutes >= startM && currentTimeMinutes < endM) {
        status = 'live';
      } else {
        status = 'upcoming';
      }
    } else {
      status = 'upcoming';
    }

    mappedSlots.push({
      periodIndex: slot.periodIndex,
      startTime: slot.startTime,
      endTime: slot.endTime,
      course: matchedCourse,
      status,
    });
  }

  // Insert natural breaks
  const timelineWithBreaks: ScheduledClass[] = [];
  let prevRegisteredEnd: number | null = null;

  for (let i = 0; i < mappedSlots.length; i++) {
    const item = mappedSlots[i];

    if (item.course) {
      const currentStart = parseTimeToMinutes(item.startTime);
      if (prevRegisteredEnd !== null && currentStart - prevRegisteredEnd > 15) {
        const diff = currentStart - prevRegisteredEnd;
        timelineWithBreaks.push({
          periodIndex: -1,
          startTime: minutesToTimeStr(prevRegisteredEnd),
          endTime: item.startTime,
          isBreak: true,
          breakDurationMinutes: diff,
          status:
            isLiveDay && currentTimeMinutes !== null && currentTimeMinutes !== undefined
              ? currentTimeMinutes >= currentStart
                ? 'completed'
                : currentTimeMinutes >= prevRegisteredEnd
                ? 'live'
                : 'upcoming'
              : 'upcoming',
        });
      }
      timelineWithBreaks.push(item);
      prevRegisteredEnd = parseTimeToMinutes(item.endTime);
    }
  }

  return timelineWithBreaks;
}

function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function formatBreakDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours} hr ${mins} min break`;
  } else if (hours > 0) {
    return `${hours} hr break`;
  }
  return `${mins} min break`;
}
