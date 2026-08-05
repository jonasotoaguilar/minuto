import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import ControlHistoryScreen from '@/app/(tabs)/control-history';
import {
  type AttendanceHistoryPageItem,
  type AttendanceHistoryPageResult,
  getAttendanceHistoryPage,
} from '@/lib/attendance';

const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
}));

jest.mock('@/components/secondary-screen-header', () => ({
  SecondaryScreenHeader: () => null,
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
    getAttendanceHistoryPage: jest.fn(),
  };
});

const mockHistoryPage = getAttendanceHistoryPage as jest.Mock;

function makeItem(
  overrides: Partial<AttendanceHistoryPageItem> = {},
): AttendanceHistoryPageItem {
  return {
    id: 'item-1',
    workDate: '2026-08-03',
    hasRecord: true,
    clockInAt: '2026-08-03T09:00:00.000Z',
    clockOutAt: '2026-08-03T18:00:00.000Z',
    autoClosed: false,
    status: 'complete',
    workedMinutes: 480,
    requiredMinutes: 480,
    officeId: 'office-1',
    officeName: 'Oficina Central',
    officeIsRemote: false,
    ...overrides,
  };
}

function makePage(
  overrides: Partial<AttendanceHistoryPageResult> = {},
): AttendanceHistoryPageResult {
  return {
    page: 0,
    pageSize: 10,
    totalItems: 1,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
    filter: {
      year: 2026,
      month: 8,
      periodKey: '2026-08',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    },
    availablePeriods: [
      {
        year: 2026,
        month: 8,
        periodKey: '2026-08',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      },
    ],
    summary: {
      weeklyHours: 40,
      workedDays: 3,
      totalMinutes: 1200,
      overtimeMinutes: 45,
    },
    items: [makeItem()],
    ...overrides,
  };
}

function renderScreen() {
  return render(<ControlHistoryScreen />);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-08-03T12:00:00.000Z'));

  mockRouterReplace.mockClear();
  mockHistoryPage.mockReset();
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
  mockHistoryPage.mockResolvedValue(makePage());
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ControlHistoryScreen', () => {
  it('renders the period label, metrics and a record row', async () => {
    renderScreen();

    expect(await screen.findByText('agosto de 2026')).toBeOnTheScreen();
    expect(screen.getByText('Horas totales')).toBeOnTheScreen();
    expect(screen.getByText('20h 0m')).toBeOnTheScreen();
    expect(screen.getByText('Días asistidos')).toBeOnTheScreen();
    expect(screen.getByText('LUN')).toBeOnTheScreen();
    expect(screen.getByText('05:00')).toBeOnTheScreen();
    expect(screen.getByText('14:00')).toBeOnTheScreen();
    expect(screen.getByText('Jornada completa')).toBeOnTheScreen();
    expect(screen.getByText('8h 0m')).toBeOnTheScreen();
    expect(screen.getByText('Página 1 de 1')).toBeOnTheScreen();
  });

  it('loads the next page and updates the pagination label', async () => {
    mockHistoryPage
      .mockResolvedValueOnce(makePage({ hasNextPage: true, totalPages: 2 }))
      .mockResolvedValueOnce(
        makePage({
          page: 1,
          totalPages: 2,
          hasPreviousPage: true,
          hasNextPage: false,
          items: [makeItem({ id: 'item-2', workDate: '2026-08-02' })],
        }),
      );

    renderScreen();

    await screen.findByText('Jornada completa');
    expect(screen.getByText('Página 1 de 2')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Siguiente'));

    await waitFor(() => {
      expect(mockHistoryPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });
    expect(await screen.findByText('Página 2 de 2')).toBeOnTheScreen();
  });

  it('navigates to the previous available month', async () => {
    mockHistoryPage
      .mockResolvedValueOnce(
        makePage({
          availablePeriods: [
            {
              year: 2026,
              month: 7,
              periodKey: '2026-07',
              startDate: '2026-07-01',
              endDate: '2026-07-31',
            },
            {
              year: 2026,
              month: 8,
              periodKey: '2026-08',
              startDate: '2026-08-01',
              endDate: '2026-08-31',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        makePage({
          filter: {
            year: 2026,
            month: 7,
            periodKey: '2026-07',
            startDate: '2026-07-01',
            endDate: '2026-07-31',
          },
        }),
      );

    renderScreen();

    await screen.findByText('Jornada completa');

    fireEvent.press(screen.getByLabelText('Mes anterior'));

    await waitFor(() => {
      expect(mockHistoryPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ year: 2026, month: 7 }),
      );
    });
    expect(await screen.findByText('julio de 2026')).toBeOnTheScreen();
  });

  it('shows the empty state when the month has no records', async () => {
    mockHistoryPage.mockResolvedValueOnce(makePage({ items: [] }));

    renderScreen();

    expect(await screen.findByText('Sin registros')).toBeOnTheScreen();
    expect(
      screen.getByText('No hay registros para el mes seleccionado.'),
    ).toBeOnTheScreen();
  });

  it('surfaces load errors in the period card', async () => {
    mockHistoryPage.mockRejectedValueOnce(new Error('timeout de red'));

    renderScreen();

    expect(await screen.findByText('timeout de red')).toBeOnTheScreen();
    expect(screen.getByText('Sin registros')).toBeOnTheScreen();
  });
});
