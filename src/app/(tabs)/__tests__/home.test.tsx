import { useIsFocused } from '@react-navigation/native';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/home';
import {
  type AttendanceRecord,
  getAttendanceRecordsForRange,
  getOpenShift,
  getTodayAttendanceRecord,
  type OpenShift,
} from '@/lib/attendance';

const mockRouterPush = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
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
  return {
    ...actual,
    getAttendanceRecordsForRange: jest.fn(),
    getTodayAttendanceRecord: jest.fn(),
    getOpenShift: jest.fn(),
  };
});

const mockUseIsFocused = useIsFocused as jest.Mock;
const mockWeekly = getAttendanceRecordsForRange as jest.Mock;
const mockToday = getTodayAttendanceRecord as jest.Mock;
const mockOpenShift = getOpenShift as jest.Mock;

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

function makeToday(clockOutAt: string | null): AttendanceRecord {
  return {
    ...makeRecord(
      '2026-08-03',
      '2026-08-03T09:00:00.000Z',
      '2026-08-03T17:00:00.000Z',
    ),
    clockOutAt,
  };
}

function makeOpenShift(overrides: Partial<OpenShift> = {}): OpenShift {
  return {
    recordId: 'record-open',
    workDate: '2026-08-03',
    clockInAt: '2026-08-03T09:00:00.000Z',
    officeId: 'office-1',
    officeName: 'Oficina Central',
    officeIsRemote: false,
    shiftDurationHours: 8,
    breakDurationHours: 0.75,
    ...overrides,
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

const statusCases = [
  {
    name: 'shows Sin registros hoy without today data',
    today: null,
    openShift: null,
    expected: 'Sin registros hoy',
  },
  {
    name: 'shows Jornada completada for a closed today record',
    today: makeToday('2026-08-03T17:00:00.000Z'),
    openShift: null,
    expected: 'Jornada completada',
  },
  {
    name: 'shows Jornada en curso for an open today record',
    today: makeToday(null),
    openShift: null,
    expected: 'Jornada en curso',
  },
  {
    name: 'shows Jornada en curso for an open shift',
    today: null,
    openShift: makeOpenShift(),
    expected: 'Jornada en curso',
  },
];

const FABRICATED_METRIC_LITERALS = [
  '40h',
  '98%',
  'WEEKLY HOURS',
  'Target goal',
  'On-time rate',
];

const FABRICATED_STATUS_LITERALS = [
  'En línea',
  'ZONA DE TRABAJO VALIDADA',
  'Track your workday',
  'Go to Control →',
  'ATTENDANCE',
  'History',
  'Team',
];

describe('HomeScreen attendance data (L06 slice 2a)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsFocused.mockReturnValue(true);
    mockToday.mockResolvedValue(null);
    mockOpenShift.mockResolvedValue(null);
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

  it('shows skeletons while home data is pending', async () => {
    const weekly = deferred<AttendanceRecord[]>();
    mockWeekly.mockReturnValue(weekly.promise);

    render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText('Ana Pérez')).toBeTruthy());

    expect(screen.queryByText('Horas semanales')).toBeNull();
    expect(screen.queryByText('Sin registros hoy')).toBeNull();

    await act(async () => {
      weekly.resolve([]);
    });

    await waitFor(() => expect(screen.getByText('0h 0m')).toBeTruthy());
  });

  it('renders the error state without data claims', async () => {
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
    expect(screen.queryByText('Sin registros hoy')).toBeNull();
  });

  it.each(statusCases)('$name', async ({ today, openShift, expected }) => {
    mockToday.mockResolvedValue(today);
    mockOpenShift.mockResolvedValue(openShift);
    mockWeekly.mockResolvedValue([]);

    render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText(expected)).toBeTruthy());

    for (const literal of FABRICATED_STATUS_LITERALS) {
      expect(screen.queryByText(literal)).toBeNull();
    }
  });

  it('renders the cleaned Spanish home copy', async () => {
    mockWeekly.mockResolvedValue([]);

    render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText('0h 0m')).toBeTruthy());

    expect(screen.getByText('ASISTENCIA')).toBeTruthy();
    expect(screen.getByText('Registrá tu jornada')).toBeTruthy();
    expect(screen.getByText('Ir a Control →')).toBeTruthy();
    expect(screen.getByText('Historial')).toBeTruthy();
    expect(screen.getByText('Equipo')).toBeTruthy();
  });

  it('navigates from quick actions', async () => {
    mockWeekly.mockResolvedValue([]);

    render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText('0h 0m')).toBeTruthy());

    fireEvent.press(screen.getByText('Historial'));
    expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/control-history');

    fireEvent.press(screen.getByText('Equipo'));
    expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/team');
  });

  it('ignores a stale home response after a focus refetch', async () => {
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

  it('ignores a stale today response when the refetch wins', async () => {
    const slowToday = deferred<AttendanceRecord | null>();
    const fastToday = deferred<AttendanceRecord | null>();
    mockToday
      .mockReturnValueOnce(slowToday.promise)
      .mockReturnValueOnce(fastToday.promise);
    mockWeekly.mockResolvedValue([]);

    const view = render(<HomeScreen />);

    mockUseIsFocused.mockReturnValue(false);
    view.rerender(<HomeScreen />);

    mockUseIsFocused.mockReturnValue(true);
    view.rerender(<HomeScreen />);

    await act(async () => {
      fastToday.resolve(makeToday('2026-08-03T17:00:00.000Z'));
    });

    await waitFor(() =>
      expect(screen.getByText('Jornada completada')).toBeTruthy(),
    );

    await act(async () => {
      slowToday.resolve(null);
    });

    expect(screen.getByText('Jornada completada')).toBeTruthy();
    expect(screen.queryByText('Sin registros hoy')).toBeNull();
  });

  it('does not apply state when the home request settles after unmount', async () => {
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
