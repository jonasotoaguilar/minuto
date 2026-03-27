import {
  calculateAttendanceSummary,
  calculateWeeklyTotals,
  getOpenShift,
  ProximityError,
  registerClockIn,
  registerClockOut,
  updateEmployeeProfile,
  validateProximity,
} from '@/lib/attendance';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const mockRpc = supabase.rpc as jest.Mock;

describe('attendance proximity functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerClockIn', () => {
    const baseParams = {
      organizationId: 'org-123',
      membershipId: 'member-123',
      workDate: '2026-03-26',
      clockInAt: '2026-03-26T09:00:00.000Z',
      clockInLocation: {
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 10,
      },
    };

    it('returns recordId, officeId, and officeName on successful clock-in', async () => {
      mockRpc
        .mockResolvedValueOnce({
          data: [],
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            record_id: 'record-123',
            office_id: 'office-123',
            office_name: 'HQ',
          },
          error: null,
        });

      await expect(registerClockIn(baseParams)).resolves.toEqual({
        recordId: 'record-123',
        officeId: 'office-123',
        officeName: 'HQ',
      });

      expect(mockRpc).toHaveBeenNthCalledWith(1, 'get_attendance_records', {
        p_organization_id: 'org-123',
        p_membership_id: 'member-123',
        p_start_date: '2026-03-26',
        p_end_date: '2026-03-26',
      });
      expect(mockRpc).toHaveBeenNthCalledWith(2, 'attendance_clock_in', {
        p_organization_id: 'org-123',
        p_membership_id: 'member-123',
        p_work_date: '2026-03-26',
        p_latitude: -34.6037,
        p_longitude: -58.3816,
        p_accuracy: 10,
        p_office_id: undefined,
        p_is_remote: false,
      });
    });

    it('throws ProximityError with OUT_OF_RANGE code when clock-in is outside office range', async () => {
      mockRpc
        .mockResolvedValueOnce({
          data: [],
          error: null,
        })
        .mockResolvedValueOnce({
          data: { success: false, error_code: 'OUT_OF_RANGE' },
          error: null,
        });

      await expect(registerClockIn(baseParams)).rejects.toMatchObject({
        name: 'ProximityError',
        code: 'OUT_OF_RANGE',
      });
    });

    it('throws ProximityError when GPS accuracy is too low', async () => {
      mockRpc
        .mockResolvedValueOnce({
          data: [],
          error: null,
        })
        .mockResolvedValueOnce({
          data: { success: false, error_code: 'GPS_ACCURACY_TOO_LOW' },
          error: null,
        });

      const promise = registerClockIn(baseParams);

      await expect(promise).rejects.toBeInstanceOf(ProximityError);
      await expect(promise).rejects.toMatchObject({
        code: 'GPS_ACCURACY_TOO_LOW',
      });
    });

    it('throws ProximityError when there is already an open clock-in for today', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'record-123',
            work_date: '2026-03-26',
            clock_in_at: '2026-03-26T09:00:00.000Z',
            clock_out_at: null,
            break_duration_hours: 0.75,
            office_id: 'office-123',
            office_name: 'HQ',
            office_is_remote: false,
            created_at: '2026-03-26T09:00:00.000Z',
          },
        ],
        error: null,
      });

      await expect(registerClockIn(baseParams)).rejects.toMatchObject({
        name: 'ProximityError',
        code: 'ALREADY_CLOCKED_IN',
      });

      expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    it('throws ProximityError when no remote office is configured', async () => {
      mockRpc
        .mockResolvedValueOnce({
          data: [],
          error: null,
        })
        .mockResolvedValueOnce({
          data: { success: false, error_code: 'NO_REMOTE_OFFICE' },
          error: null,
        });

      await expect(registerClockIn(baseParams)).rejects.toMatchObject({
        name: 'ProximityError',
        code: 'NO_REMOTE_OFFICE',
      });
    });

    it('sends p_is_remote=true when clocking in as remote', async () => {
      mockRpc
        .mockResolvedValueOnce({
          data: [],
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            record_id: 'record-123',
            office_id: 'office-remote',
            office_name: 'Remote',
          },
          error: null,
        });

      await registerClockIn({
        ...baseParams,
        clockInLocation: {
          ...baseParams.clockInLocation,
          isRemote: true,
        },
      });

      expect(mockRpc).toHaveBeenNthCalledWith(2, 'attendance_clock_in', {
        p_organization_id: 'org-123',
        p_membership_id: 'member-123',
        p_work_date: '2026-03-26',
        p_latitude: -34.6037,
        p_longitude: -58.3816,
        p_accuracy: 10,
        p_office_id: undefined,
        p_is_remote: true,
      });
    });

    it('sends officeId when clocking in with a validated office', async () => {
      mockRpc
        .mockResolvedValueOnce({
          data: [],
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            record_id: 'record-123',
            office_id: 'office-123',
            office_name: 'HQ',
          },
          error: null,
        });

      await registerClockIn({
        ...baseParams,
        officeId: 'office-123',
      });

      expect(mockRpc).toHaveBeenNthCalledWith(2, 'attendance_clock_in', {
        p_organization_id: 'org-123',
        p_membership_id: 'member-123',
        p_work_date: '2026-03-26',
        p_latitude: -34.6037,
        p_longitude: -58.3816,
        p_accuracy: 10,
        p_office_id: 'office-123',
        p_is_remote: false,
      });
    });
  });

  describe('validateProximity', () => {
    it('returns office info when proximity validation succeeds', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          valid: true,
          office_id: 'office-123',
          office_name: 'HQ',
        },
        error: null,
      });

      await expect(
        validateProximity({
          organizationId: 'org-123',
          latitude: -34.6037,
          longitude: -58.3816,
          accuracy: 10,
        }),
      ).resolves.toEqual({
        valid: true,
        officeId: 'office-123',
        officeName: 'HQ',
        errorCode: undefined,
      });

      expect(mockRpc).toHaveBeenCalledWith('validate_proximity', {
        p_organization_id: 'org-123',
        p_latitude: -34.6037,
        p_longitude: -58.3816,
        p_accuracy: 10,
      });
    });

    it('returns OUT_OF_RANGE when no office is close enough', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          valid: false,
          error_code: 'OUT_OF_RANGE',
        },
        error: null,
      });

      await expect(
        validateProximity({
          organizationId: 'org-123',
          latitude: -34.6037,
          longitude: -58.3816,
          accuracy: 10,
        }),
      ).resolves.toEqual({
        valid: false,
        officeId: undefined,
        officeName: undefined,
        errorCode: 'OUT_OF_RANGE',
      });
    });
  });

  describe('registerClockOut', () => {
    const baseParams = {
      attendanceId: 'record-123',
      clockOutAt: '2026-03-26T18:00:00.000Z',
      clockOutLocation: {
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 8,
      },
    };

    it('returns officeName on successful clock-out', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          office_id: 'office-123',
          office_name: 'HQ',
        },
        error: null,
      });

      await expect(registerClockOut(baseParams)).resolves.toEqual({
        officeId: 'office-123',
        officeName: 'HQ',
      });

      expect(mockRpc).toHaveBeenCalledWith('attendance_clock_out', {
        p_record_id: 'record-123',
        p_latitude: -34.6037,
        p_longitude: -58.3816,
        p_accuracy: 8,
        p_custom_close_at: null,
        p_auto_closed: false,
      });
    });

    it('sends custom close time and auto-close flag when provided', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          office_id: 'office-123',
          office_name: 'HQ',
        },
        error: null,
      });

      await registerClockOut({
        ...baseParams,
        customCloseAt: '2026-03-26T17:00:00.000Z',
        autoClosed: true,
      });

      expect(mockRpc).toHaveBeenCalledWith('attendance_clock_out', {
        p_record_id: 'record-123',
        p_latitude: -34.6037,
        p_longitude: -58.3816,
        p_accuracy: 8,
        p_custom_close_at: '2026-03-26T17:00:00.000Z',
        p_auto_closed: true,
      });
    });

    it('throws ProximityError when no open attendance record exists', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: false, error_code: 'NO_OPEN_RECORD' },
        error: null,
      });

      await expect(registerClockOut(baseParams)).rejects.toMatchObject({
        name: 'ProximityError',
        code: 'NO_OPEN_RECORD',
      });
    });
  });

  describe('getOpenShift', () => {
    it('maps the open shift payload', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          record_id: 'record-123',
          work_date: '2026-03-25',
          clock_in_at: '2026-03-25T09:00:00.000Z',
          office_id: 'office-123',
          office_name: 'HQ',
          office_is_remote: false,
          shift_duration_hours: 8,
          break_duration_hours: 0.75,
        },
        error: null,
      });

      await expect(getOpenShift('member-123')).resolves.toEqual({
        recordId: 'record-123',
        workDate: '2026-03-25',
        clockInAt: '2026-03-25T09:00:00.000Z',
        officeId: 'office-123',
        officeName: 'HQ',
        officeIsRemote: false,
        shiftDurationHours: 8,
        breakDurationHours: 0.75,
      });

      expect(mockRpc).toHaveBeenCalledWith('get_open_shift', {
        p_membership_id: 'member-123',
      });
    });
  });

  describe('updateEmployeeProfile', () => {
    it('returns success state from the RPC response', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      await expect(
        updateEmployeeProfile({
          membershipId: 'member-123',
          shiftDurationHours: 8,
          breakDurationHours: 0.75,
          position: 'Developer',
          department: 'Engineering',
          hireDate: '2026-03-01',
        }),
      ).resolves.toEqual({ success: true, errorCode: undefined });

      expect(mockRpc).toHaveBeenCalledWith('update_employee_profile', {
        p_membership_id: 'member-123',
        p_shift_duration_hours: 8,
        p_break_duration_hours: 0.75,
        p_position: 'Developer',
        p_department: 'Engineering',
        p_hire_date: '2026-03-01',
      });
    });
  });

  describe('attendance calculations', () => {
    const completedRecord = {
      id: 'record-123',
      workDate: '2026-03-26',
      clockInAt: '2026-03-26T09:00:00.000Z',
      clockOutAt: '2026-03-26T18:00:00.000Z',
      breakDurationHours: 1,
      officeId: 'office-123',
      officeName: 'HQ',
      officeIsRemote: false,
      createdAt: '2026-03-26T09:00:00.000Z',
    };

    it('subtracts break duration from weekly totals', () => {
      expect(calculateWeeklyTotals([completedRecord])).toEqual({
        totalMinutes: 480,
        attendedDays: 1,
      });
    });

    it('subtracts break duration from attendance summaries', () => {
      expect(calculateAttendanceSummary([completedRecord])).toEqual({
        totalMinutes: 480,
        overtimeMinutes: 0,
        workedDays: 1,
      });
    });
  });
});
