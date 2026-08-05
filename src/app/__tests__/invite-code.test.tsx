import { act, fireEvent, render, screen } from '@testing-library/react-native';

import InvitationCodeScreen from '@/app/invite/[code]';
import type { InvitationScreenStatus } from '@/hooks/use-invitation-screen';

const mockGoToLogin = jest.fn();
const mockGoToRegister = jest.fn();
const mockGoToTeam = jest.fn();
const mockAcceptSelectedInvitation = jest.fn();
const mockSelectInvitation = jest.fn();

const mockInvitation = {
  activeInvitations: [],
  errorMessage: '',
  invitationCode: 'ACME-123',
  acceptSelectedInvitation: mockAcceptSelectedInvitation,
  goToLogin: mockGoToLogin,
  goToRegister: mockGoToRegister,
  goToTeam: mockGoToTeam,
  selectInvitation: mockSelectInvitation,
  selectedInvitation: null,
  status: 'ready-for-auth' as InvitationScreenStatus,
};

jest.mock('@/hooks/use-invitation-screen', () => ({
  useInvitationScreen: () => mockInvitation,
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ code: 'acme-123' }),
}));

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

describe('InvitationCodeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvitation.status = 'ready-for-auth';
  });

  it('renders the invitation card for a signed-out visitor', () => {
    render(<InvitationCodeScreen />);

    expect(screen.getByText('Unite a tu organización')).toBeOnTheScreen();
    expect(screen.getByText('ACME-123')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Iniciar sesión'));
    expect(mockGoToLogin).toHaveBeenCalled();

    fireEvent.press(screen.getByText('Crear cuenta'));
    expect(mockGoToRegister).toHaveBeenCalled();
  });

  it('navigates to the team after an accepted invitation', () => {
    jest.useFakeTimers();
    mockInvitation.status = 'accepted';

    render(<InvitationCodeScreen />);

    act(() => {
      jest.advanceTimersByTime(900);
    });

    expect(mockGoToTeam).toHaveBeenCalled();

    jest.useRealTimers();
  });
});
