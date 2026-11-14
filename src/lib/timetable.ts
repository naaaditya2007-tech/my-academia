import { Course, DayOrderSlot, ScheduledClass } from '@/types/campus';

// Real SRM timetable mapping for Aaditya (Semester 3 AIML)
export const SRM_AUTHENTIC_DAY_ORDER_MATRIX: Record<number, DayOrderSlot[]> = {
  1: [
    { periodIndex: 1, slotCode: '21MAB201T', startTime: '08:00', endTime: '09:40', isLab: false },
    { periodIndex: 2, slotCode: '21CSC202J', startTime: '09:45', endTime: '11:30', isLab: false },
    { periodIndex: 3, slotCode: '21LEM202T', startTime: '13:25', endTime: '16:00', isLab: false },
  ],
  2: [
    { periodIndex: 1, slotCode: '21CSC201J', startTime: '12:30', endTime: '14:15', isLab: false },
    { periodIndex: 2, slotCode: '21MAB201T', startTime: '16:00', endTime: '16:50', isLab: false },
  ],
  3: [
    { periodIndex: 1, slotCode: '21CSS201T', startTime: '08:00', endTime: '09:40', isLab: false },
    { periodIndex: 2, slotCode: '21MAB201T', startTime: '09:45', endTime: '10:35', isLab: false },
    { periodIndex: 3, slotCode: '21CSC203P', startTime: '10:40', endTime: '11:30', isLab: false },
    { periodIndex: 4, slotCode: '21CSC201J', startTime: '11:35', endTime: '12:25', isLab: false },
    { periodIndex: 5, slotCode: '21CSC201J', startTime: '13:25', endTime: '15:10', isLab: true },
    { periodIndex: 6, slotCode: '21CSC202J', startTime: '15:10', endTime: '16:50', isLab: true },
  ],
  4: [
    { periodIndex: 1, slotCode: '21CSC203P', startTime: '12:30', endTime: '14:15', isLab: false },
    { periodIndex: 2, slotCode: '21CSC201J', startTime: '14:20', endTime: '15:10', isLab: false },
    { periodIndex: 3, slotCode: '21CSS201T', startTime: '16:00', endTime: '16:50', isLab: false },
  ],
  5: [
    { periodIndex: 1, slotCode: '21CSS201T', startTime: '09:45', endTime: '10:35', isLab: false },
    { periodIndex: 2, slotCode: '21CSC202J', startTime: '10:40', endTime: '11:30', isLab: false },
    { periodIndex: 3, slotCode: '21CSC203P', startTime: '11:35', endTime: '12:25', isLab: false },
    { periodIndex: 4, slotCode: '21LEM201T', startTime: '13:25', endTime: '14:15', isLab: false },
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
  const slots = matrix[dayOrder] || [];
  if (slots.length === 0) return [];

  // Match courses to slots
  const mappedSlots: ScheduledClass[] = [];

  for (const slot of slots) {
    const matchedCourse = courses.find((c) => {
      const cCode = c.code.trim().toUpperCase();
      const sSlot = slot.slotCode.trim().toUpperCase();
      return cCode === sSlot || c.slot.toUpperCase() === sSlot;
    });

    const startM = parseTimeToMinutes(slot.startTime);
    const endM = parseTimeToMinutes(slot.endTime);

    let status: 'completed' | 'live' | 'upcoming' = 'upcoming';

    // A class is ONLY live or completed if this day is actively happening today!
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
      course: matchedCourse || {
        id: `c_${slot.slotCode}`,
        code: slot.slotCode,
        title: slot.slotCode,
        slot: slot.slotCode,
        room: 'Venue TBA',
        faculty: 'Faculty TBA',
        credits: 0,
        type: slot.isLab ? 'Practical' : 'Theory',
        hoursConducted: 0,
        hoursAbsent: 0,
        hoursAttended: 0,
        attendancePercentage: 0,
        marks: [],
        totalInternalScored: 0,
        totalInternalMax: 0,
      },
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
