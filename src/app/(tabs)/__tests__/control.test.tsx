import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import ControlScreen from '@/app/(tabs)/control';
import {
  type AttendanceRecord,
  getAttendanceRecordsForRange,
  getOpenShift,
  getRecentAttendanceEvents,
  getTodayAttendanceRecord,
  registerClockIn,
  registerClockOut,
  validateProximity,
} from '@/lib/attendance';
import { FeedbackProvider } from '@/theme/feedback';

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

let mockOrgState: {
  activeOrganization: {
    id: string;
    membershipId: string;
    membershipRole: string;
    name: string;
    defaultTimezone: string;
    plan: string;
    ownerUserId: string;
  } | null;
  isLoadingOrganizations: boolean;
  isOrganizationSetupOpen: boolean;
} = {
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
  useOrganization: () => mockOrgState,
}));

jest.mock('@/hooks/use-attendance-refresh', () => {
  const { useEffect } = jest.requireActual('react');

  return {
    useAttendanceFocusRefresh: (options: { refresh: () => Promise<void> }) => {
      useEffect(() => {
        void options.refresh();
      }, []);

      return {
        isRefreshing: false,
        refresh: jest.fn(async () => {
          await options.refresh();
        }),
      };
    },
  };
});

jest.mock('@/lib/supabase', () => ({
  supabase: {},
}));

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@/lib/attendance', () => {
  const actual = jest.requireActual('@/lib/attendance');
  return {
    ...actual,
    getAttendanceRecordsForRange: jest.fn(),
    getTodayAttendanceRecord: jest.fn(),
    getOpenShift: jest.fn(),
    getRecentAttendanceEvents: jest.fn(),
    validateProximity: jest.fn(),
    registerClockIn: jest.fn(),
    registerClockOut: jest.fn(),
  };
});

const mockWeekly = getAttendanceRecordsForRange as jest.Mock;
const mockToday = getTodayAttendanceRecord as jest.Mock;
const mockOpenShift = getOpenShift as jest.Mock;
const mockRecent = getRecentAttendanceEvents as jest.Mock;
const mockValidateProximity = validateProximity as jest.Mock;
const mockRegisterClockIn = registerClockIn as jest.Mock;
const mockRegisterClockOut = registerClockOut as jest.Mock;

function makeRecord(
  workDate: string,
  clockInAt: string,
  clockOutAt: string | null,
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

function renderScreen() {
  return render(
    <FeedbackProvider>
      <ControlScreen />
    </FeedbackProvider>,
  );
}

function mockLoadedAttendance(
  overrides: {
    openShift?: Awaited<ReturnType<typeof getOpenShift>>;
    today?: AttendanceRecord | null;
  } = {},
) {
  mockWeekly.mockResolvedValue([]);
  mockToday.mockResolvedValue(
    overrides.today !== undefined
      ? overrides.today
      : makeRecord('2026-08-03', '', null),
  );
  mockOpenShift.mockResolvedValue(overrides.openShift ?? null);
  mockRecent.mockResolvedValue([
    {
      id: 'event-1',
      type: 'clock_in',
      occurredAt: '2026-08-03T09:00:00.000Z',
      workDate: '2026-08-03',
      officeName: 'Oficina Central',
      officeIsRemote: false,
    },
  ]);
}

beforeEach(() => {
  mockRouterPush.mockClear();
  mockWeekly.mockReset();
  mockToday.mockReset();
  mockOpenShift.mockReset();
  mockRecent.mockReset();
  mockValidateProximity.mockReset();
  mockRegisterClockIn.mockReset();
  mockRegisterClockOut.mockReset();
  mockOrgState = {
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
  mockLoadedAttendance();
});

describe('ControlScreen', () => {
  it('renders the attendance panel, metrics and history preview', async () => {
    renderScreen();

    expect(await screen.findByText('Historial reciente')).toBeOnTheScreen();
    expect(screen.getByText('Horas semanales')).toBeOnTheScreen();
    expect(screen.getByText('0h 0m')).toBeOnTheScreen();
    expect(screen.getByText('Entrada')).toBeOnTheScreen();
    expect(screen.getByText('Sin validar')).toBeOnTheScreen();
  });

  it('refreshes attendance after clock-in completes', async () => {
    mockValidateProximity.mockResolvedValue({
      valid: true,
      officeId: 'office-1',
      officeName: 'Torre Norte',
    });
    mockRegisterClockIn.mockResolvedValue({});

    renderScreen();

    await screen.findByText('Validar ubicación');
    fireEvent.press(screen.getByText('Validar ubicación'));

    fireEvent.press(await screen.findByText('Registrar entrada del dia'));

    await waitFor(() => {
      expect(mockRegisterClockIn).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockToday).toHaveBeenCalledTimes(2);
    });
  });

  it('refreshes attendance when the organization resolves after focus', async () => {
    mockOrgState = {
      activeOrganization: null,
      isLoadingOrganizations: false,
      isOrganizationSetupOpen: false,
    };

    const { rerender } = renderScreen();

    expect(mockToday).not.toHaveBeenCalled();

    mockOrgState = {
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

    rerender(
      <FeedbackProvider>
        <ControlScreen />
      </FeedbackProvider>,
    );

    await waitFor(() => {
      expect(mockToday).toHaveBeenCalled();
    });
  });

  it('surfaces overtime close failures through the feedback toast', async () => {
    const clockInAt = new Date(Date.now() - 10 * 3_600_000);
    const workDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(clockInAt)
      .replaceAll('/', '-');

    mockOpenShift.mockResolvedValue({
      recordId: 'record-open',
      workDate,
      clockInAt: clockInAt.toISOString(),
      officeId: 'office-1',
      officeName: 'Oficina Central',
      officeIsRemote: false,
      shiftDurationHours: 8,
      breakDurationHours: 0.75,
    });
    mockRegisterClockOut.mockRejectedValue(new Error('timeout de red'));

    renderScreen();

    fireEvent.press(await screen.findByText('Cerrar con hora actual'));

    expect(
      await screen.findByText('No se pudo cerrar la jornada'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(/No pudimos cerrar la jornada con la hora actual/),
    ).toBeOnTheScreen();
    expect(mockRegisterClockOut).toHaveBeenCalledWith(
      expect.objectContaining({ attendanceId: 'record-open' }),
    );
  });
});
