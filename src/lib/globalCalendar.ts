import { AcademicCalendarDay } from '@/types/campus';
import { MOCK_CAMPUS_DATA } from './mockData';

// Shared global academic calendar state in memory
let cachedGlobalCalendar: AcademicCalendarDay[] = MOCK_CAMPUS_DATA.calendar;
let lastCalendarScrapeTime: string = new Date().toISOString();
let lastCalendarUpdatedBy: string = 'System Initialization';

export function getGlobalAcademicCalendar(): AcademicCalendarDay[] {
  return cachedGlobalCalendar;
}

export function getGlobalAcademicCalendarMeta() {
  return {
    totalDays: cachedGlobalCalendar.length,
    lastUpdated: lastCalendarScrapeTime,
    updatedBy: lastCalendarUpdatedBy,
  };
}

export function setGlobalAcademicCalendar(
  calendar: AcademicCalendarDay[],
  updatedBy: string = 'Admin Console'
) {
  cachedGlobalCalendar = calendar;
  lastCalendarScrapeTime = new Date().toISOString();
  lastCalendarUpdatedBy = updatedBy;
}
