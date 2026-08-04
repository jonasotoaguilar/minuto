import {
  getAttendanceHistoryPage,
  getAttendanceRecordsForRange,
  getRecentAttendanceEvents,
  getTodayAttendanceRecord,
} from '@/lib/attendance';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const mockRpc = supabase.rpc as jest.Mock;

const HISTORY_RPC = 'get_attendance_history_page';
const RECORDS_RPC = 'get_attendance_records';

const BASE_PARAMS = { organizationId: 'org-123', membershipId: 'member-123' };

function historyItem(overrides: Record<string, unknown> = {}) {
  return {
    id: '2026-03-26',
    work_date: '2026-03-26',
    has_record: true,
    clock_in_at: '2026-03-26T09:00:00.000Z',
    clock_out_at: '2026-03-26T18:00:00.000Z',
    auto_closed: false,
    status: 'complete',
    worked_minutes: 480,
    required_minutes: 435,
    office_id: 'office-123',
    office_name: 'HQ',
    office_is_remote: false,
    ...overrides,
  };
}

function historyPayload(overrides: Record<string, unknown> = {}) {
  return {
    page: 0,
    page_size: 10,
    total_items: 1,
    total_pages: 1,
    has_previous_page: false,
    has_next_page: false,
    filter: {
      year: 2026,
      month: 3,
      period_key: '2026-03',
      start_date: '2026-03-01',
      end_date: '2026-03-31',
    },
    available_periods: [],
    summary: {
      weekly_hours: 40,
      worked_days: 1,
      total_minutes: 480,
      overtime_minutes: 0,
    },
    items: [historyItem()],
    ...overrides,
  };
}

function mockHistory(overrides: Record<string, unknown> = {}) {
  mockRpc.mockResolvedValue({ data: historyPayload(overrides), error: null });
}

describe('attendance query bounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecentAttendanceEvents', () => {
    it('fetches the first bounded page and never the full history', async () => {
      mockHistory();

      await getRecentAttendanceEvents(BASE_PARAMS);

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith(HISTORY_RPC, {
        p_organization_id: 'org-123',
        p_membership_id: 'member-123',
        p_page: 0,
        p_page_size: 10,
        p_year: null,
        p_month: null,
      });
      expect(
        mockRpc.mock.calls.every(([rpcName]) => rpcName === HISTORY_RPC),
      ).toBe(true);
    });

    it.each([
      [500, 100],
      [0, 1],
    ])('clamps recordLimit %s to page size %s', async (recordLimit, pageSize) => {
      mockHistory();

      await getRecentAttendanceEvents({ ...BASE_PARAMS, recordLimit });

      expect(mockRpc).toHaveBeenLastCalledWith(
        HISTORY_RPC,
        expect.objectContaining({ p_page_size: pageSize }),
      );
    });

    it('maps only recorded days, ordered by occurredAt and capped at eventLimit', async () => {
      mockHistory({
        items: [
          historyItem(),
          historyItem({
            id: '2026-03-25',
            work_date: '2026-03-25',
            clock_in_at: '2026-03-25T09:00:00.000Z',
            clock_out_at: null,
          }),
          historyItem({
            id: '2026-03-24',
            work_date: '2026-03-24',
            has_record: false,
            clock_in_at: null,
            clock_out_at: null,
            status: 'absence',
            worked_minutes: 0,
          }),
        ],
      });

      await expect(
        getRecentAttendanceEvents({ ...BASE_PARAMS, eventLimit: 2 }),
      ).resolves.toEqual([
        {
          id: '2026-03-26-out',
          type: 'clock_out',
          occurredAt: '2026-03-26T18:00:00.000Z',
          workDate: '2026-03-26',
          officeName: 'HQ',
          officeIsRemote: false,
        },
        {
          id: '2026-03-26-in',
          type: 'clock_in',
          occurredAt: '2026-03-26T09:00:00.000Z',
          workDate: '2026-03-26',
          officeName: 'HQ',
          officeIsRemote: false,
        },
      ]);
    });

    it('returns an empty list for an empty history', async () => {
      mockHistory({ total_items: 0, items: [] });

      await expect(getRecentAttendanceEvents(BASE_PARAMS)).resolves.toEqual([]);
    });

    it.each([
      [
        'Failed to run get_attendance_history_page: schema cache miss: relation does not exist',
        'El historial mensual no está disponible todavía. Falta aplicar la migración de attendance history en Supabase.',
      ],
      ['boom', 'boom'],
    ])('throws on RPC error %s', async (message, expected) => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message } });

      await expect(getRecentAttendanceEvents(BASE_PARAMS)).rejects.toThrow(
        expected,
      );
    });

    it('throws on an invalid history payload', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { page: 0, items: 'not-an-array' },
        error: null,
      });

      await expect(getRecentAttendanceEvents(BASE_PARAMS)).rejects.toThrow(
        'No se pudo cargar el historial de asistencia.',
      );
    });
  });

  describe('getAttendanceHistoryPage', () => {
    it('forwards page, pageSize, year and month to the RPC', async () => {
      mockHistory();

      await getAttendanceHistoryPage({
        ...BASE_PARAMS,
        page: 3,
        pageSize: 25,
        year: 2025,
        month: 11,
      });

      expect(mockRpc).toHaveBeenCalledWith(HISTORY_RPC, {
        p_organization_id: 'org-123',
        p_membership_id: 'member-123',
        p_page: 3,
        p_page_size: 25,
        p_year: 2025,
        p_month: 11,
      });
    });

    it.each([
      [0, false, true],
      [4, true, false],
    ])('page %s exposes boundary flags previous=%s next=%s', async (page, hasPreviousPage, hasNextPage) => {
      mockHistory({
        page,
        total_pages: 5,
        has_previous_page: hasPreviousPage,
        has_next_page: hasNextPage,
      });

      const result = await getAttendanceHistoryPage({
        ...BASE_PARAMS,
        page,
        pageSize: 10,
      });

      expect(result.hasPreviousPage).toBe(hasPreviousPage);
      expect(result.hasNextPage).toBe(hasNextPage);
    });
  });

  describe('bounded record fetching', () => {
    it('getAttendanceRecordsForRange always passes explicit date bounds', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await getAttendanceRecordsForRange({
        ...BASE_PARAMS,
        startDate: '2026-03-23',
        endDate: '2026-03-29',
      });

      expect(mockRpc).toHaveBeenCalledWith(RECORDS_RPC, {
        p_organization_id: 'org-123',
        p_membership_id: 'member-123',
        p_start_date: '2026-03-23',
        p_end_date: '2026-03-29',
      });
    });

    it('getTodayAttendanceRecord bounds the fetch to a single day', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await getTodayAttendanceRecord({
        ...BASE_PARAMS,
        workDate: '2026-03-26',
      });

      expect(mockRpc).toHaveBeenCalledWith(RECORDS_RPC, {
        p_organization_id: 'org-123',
        p_membership_id: 'member-123',
        p_start_date: '2026-03-26',
        p_end_date: '2026-03-26',
      });
    });
  });
});
