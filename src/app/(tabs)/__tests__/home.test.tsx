import { useIsFocused } from '@react-navigation/native';
import { act, render, screen, waitFor } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/home';
import {
  type AttendanceRecord,
  getAttendanceRecordsForRange,
} from '@/lib/attendance';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/components/header-user-menu', () => ({
  AppHeader: () => null,
}));

jest.mock('@/components/organization-setup-view', () => ({
  OrganizationSetupView: () => null,
}));

const mockOrganizationState = {
  activeOrganization: {
    id: 'org-1',
    membershipId: 'membership-1',
    membershipRole: 'owner',
    name: 'Acme',
    defaultTimezone: 'America/Santiago',
    plan: 'free',
    ownerUserId: 'user-1',
  },
  isLoadingOrganizations: false,
  isOrganizationSetupOpen: false,
};

jest.mock('@/hooks/use-organization', () => ({
  useOrganization: () => mockOrganizationState,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(async () => ({
        data: {
          user: {
            id: 'user-1',
            email: 'ana@empresa.com',
            user_metadata: { display_name: 'Ana Pérez', phone: '+56911111111' },
          },
        },
        error: null,
      })),
    },
  },
}));

jest.mock('@/lib/attendance', () => {
  const actual = jest.requireActual('@/lib/attendance');
  return { ...actual, getAttendanceRecordsForRange: jest.fn() };
});

const mockUseIsFocused = useIsFocused as jest.Mock;
const mockWeekly = getAttendanceRecordsForRange as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(
    (resolvePromise) => (resolve = resolvePromise),
  );
  return { promise, resolve };
}

function makeRecord(
  workDate: string,
  clockInAt: string,
  clockOutAt: string,
): AttendanceRecord {
  return {
    id: `record-${workDate}`,
    workDate,
    clockInAt,
    clockOutAt,
    breakDurationHours: 0.75,
    officeId: 'office-1',
    officeName: 'Oficina Central',
    officeIsRemote: false,
    createdAt: clockInAt,
  };
}

const MONDAY = makeRecord(
  '2026-08-03',
  '2026-08-03T09:00:00.000Z',
  '2026-08-03T17:00:00.000Z',
);
const TUESDAY = makeRecord(
  '2026-08-04',
  '2026-08-04T09:00:00.000Z',
  '2026-08-04T18:00:00.000Z',
);

const metricCases = [
  {
    name: 'renders empty weekly metrics without records',
    records: [] as AttendanceRecord[],
    expectedHours: '0h 0m',
    expectedDays: '0',
  },
  {
    name: 'derives weekly totals from real records',
    records: [MONDAY, TUESDAY],
    expectedHours: '15h 30m',
    expectedDays: '2',
  },
];

const FABRICATED_METRIC_LITERALS = [
  '40h',
  '98%',
  'WEEKLY HOURS',
  'Target goal',
  'On-time rate',
];

describe('HomeScreen weekly metrics (L06 slice 1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsFocused.mockReturnValue(true);
  });

  it.each(metricCases)('$name', async ({
    records,
    expectedHours,
    expectedDays,
  }) => {
    mockWeekly.mockResolvedValue(records);

    render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText(expectedHours)).toBeTruthy());

    expect(screen.getByText(expectedDays)).toBeTruthy();
    for (const literal of FABRICATED_METRIC_LITERALS) {
      expect(screen.queryByText(literal)).toBeNull();
    }
  });

  it('shows skeletons while weekly metrics are pending', async () => {
    const weekly = deferred<AttendanceRecord[]>();
    mockWeekly.mockReturnValue(weekly.promise);

    render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText('Ana Pérez')).toBeTruthy());

    expect(screen.queryByText('Horas semanales')).toBeNull();
    expect(screen.queryByText('0h 0m')).toBeNull();
  });

  it('renders the error state without metric claims', async () => {
    mockWeekly.mockRejectedValue(
      new Error('No se pudieron cargar las horas semanales.'),
    );

    render(<HomeScreen />);

    await waitFor(() =>
      expect(
        screen.getByText('No se pudieron cargar las horas semanales.'),
      ).toBeTruthy(),
    );

    expect(screen.queryByText('Horas semanales')).toBeNull();
    expect(screen.queryByText('0h 0m')).toBeNull();
  });

  it('ignores a stale weekly response after a focus refetch', async () => {
    const slow = deferred<AttendanceRecord[]>();
    const fast = deferred<AttendanceRecord[]>();
    mockWeekly
      .mockReturnValueOnce(slow.promise)
      .mockReturnValueOnce(fast.promise);

    const view = render(<HomeScreen />);

    mockUseIsFocused.mockReturnValue(false);
    view.rerender(<HomeScreen />);

    mockUseIsFocused.mockReturnValue(true);
    view.rerender(<HomeScreen />);

    await act(async () => {
      fast.resolve([MONDAY]);
    });

    await waitFor(() => expect(screen.getByText('7h 15m')).toBeTruthy());

    await act(async () => {
      slow.resolve([]);
    });

    expect(screen.getByText('7h 15m')).toBeTruthy();
    expect(screen.queryByText('0h 0m')).toBeNull();
  });

  it('does not apply state when the weekly request settles after unmount', async () => {
    const weekly = deferred<AttendanceRecord[]>();
    mockWeekly.mockReturnValue(weekly.promise);

    const view = render(<HomeScreen />);

    view.unmount();

    await act(async () => {
      weekly.resolve([]);
    });

    expect(mockWeekly).toHaveBeenCalledTimes(1);
  });
});
