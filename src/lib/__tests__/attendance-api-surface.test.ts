import {
  calculateAttendanceSummary,
  calculateWeeklyTotals,
  calculateWorkdayStreak,
  getAttendanceHistoryPage,
  getAttendanceRecordsForRange,
  getOpenShift,
  getOrganizationMonthRange,
  getOrganizationToday,
  getOrganizationWeekRange,
  getRecentAttendanceEvents,
  getTodayAttendanceRecord,
  PROXIMITY_ERROR_CODE,
  ProximityError,
  registerClockIn,
  registerClockOut,
  updateEmployeeProfile,
  validateProximity,
} from '@/lib/attendance';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const SCREEN_CONSUMED_EXPORTS = [
  calculateAttendanceSummary,
  calculateWeeklyTotals,
  calculateWorkdayStreak,
  getAttendanceHistoryPage,
  getAttendanceRecordsForRange,
  getOpenShift,
  getOrganizationMonthRange,
  getOrganizationToday,
  getOrganizationWeekRange,
  getRecentAttendanceEvents,
  getTodayAttendanceRecord,
  registerClockIn,
  registerClockOut,
  updateEmployeeProfile,
  validateProximity,
  ProximityError,
  PROXIMITY_ERROR_CODE,
];

describe('attendance module API surface (screen-lane contract)', () => {
  it('keeps every screen-consumed export available', () => {
    for (const exportValue of SCREEN_CONSUMED_EXPORTS) {
      expect(exportValue).toBeDefined();
    }
  });

  it('keeps the screen-consumed function signatures', () => {
    const recentEventsParams: Parameters<typeof getRecentAttendanceEvents>[0] =
      {
        organizationId: 'org-123',
        membershipId: 'member-123',
      };
    const historyPageParams: Parameters<typeof getAttendanceHistoryPage>[0] = {
      organizationId: 'org-123',
      membershipId: 'member-123',
      page: 0,
      pageSize: 10,
    };
    const rangeParams: Parameters<typeof getAttendanceRecordsForRange>[0] = {
      organizationId: 'org-123',
      membershipId: 'member-123',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    };

    expect(recentEventsParams).toEqual(expect.any(Object));
    expect(historyPageParams).toEqual(expect.any(Object));
    expect(rangeParams).toEqual(expect.any(Object));
  });

  it('removed dead full-history fetch exports no longer exist', () => {
    const attendanceModule = jest.requireActual('@/lib/attendance');

    expect(attendanceModule.getAllAttendanceRecords).toBeUndefined();
    expect(attendanceModule.getPaginatedAttendanceRecords).toBeUndefined();
  });
});
