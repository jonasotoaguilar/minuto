import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { TeamMember } from '@/components/team/team-member';
import { useEditMemberForm } from '@/components/team/use-edit-member-form';
import { updateEmployeeProfile } from '@/lib/attendance';

const mockUpdateEmployeeProfile = updateEmployeeProfile as jest.Mock;

jest.mock('@/theme/feedback', () => ({
  useFeedback: () => ({
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
    enqueue: jest.fn(),
    show: jest.fn(),
  }),
}));

jest.mock('@/lib/attendance', () => ({
  updateEmployeeProfile: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(async () => ({ data: { success: true }, error: null })),
  },
}));

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));

const member: TeamMember = {
  breakDurationHours: 0.75,
  department: 'Operaciones',
  hireDate: '',
  id: 'member-1',
  initials: 'AL',
  email: 'ada@example.com',
  phone: '',
  name: 'Ada Lovelace',
  position: 'Supervisor',
  role: 'employee',
  roleLabel: 'Supervisor',
  shiftDurationHours: 8,
  weeklyHours: 40,
};

describe('useEditMemberForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateEmployeeProfile.mockResolvedValue({ success: true });
  });

  it('opens the edit flow with the member values', () => {
    const { result } = renderHook(() => useEditMemberForm(jest.fn()));

    act(() => {
      result.current.onEditMember(member);
    });

    expect(result.current.isEditModalVisible).toBe(true);
    expect(result.current.editFormValues).toEqual({
      breakDurationHours: '00:45',
      department: 'Operaciones',
      hireDate: '',
      position: 'Supervisor',
      role: 'employee',
      shiftDurationHours: '08:00',
      weeklyHours: '40',
    });
  });

  it('closes the edit flow and resets the form', () => {
    const { result } = renderHook(() => useEditMemberForm(jest.fn()));

    act(() => {
      result.current.onEditMember(member);
    });
    act(() => {
      result.current.onCloseEditModal();
    });

    expect(result.current.isEditModalVisible).toBe(false);
    expect(result.current.editFormValues.role).toBe('employee');
    expect(result.current.editFormValues.position).toBe('');
  });

  it('does not save when the form is invalid', async () => {
    const { result } = renderHook(() => useEditMemberForm(jest.fn()));

    act(() => {
      result.current.onEditMember(member);
    });
    act(() => {
      result.current.setEditFormValues((current) => ({
        ...current,
        shiftDurationHours: '99:99',
      }));
    });

    await act(async () => {
      await result.current.onSaveMemberProfile();
    });

    expect(mockUpdateEmployeeProfile).not.toHaveBeenCalled();
    expect(result.current.editFormMessage).toBe(
      'Revisá los campos marcados antes de guardar.',
    );
  });

  it('saves the profile, reloads members and shows a success toast', async () => {
    const reloadMembers = jest.fn();
    const { result } = renderHook(() => useEditMemberForm(reloadMembers));

    act(() => {
      result.current.onEditMember(member);
    });

    await act(async () => {
      await result.current.onSaveMemberProfile();
    });

    expect(mockUpdateEmployeeProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: 'member-1',
        position: 'Supervisor',
      }),
    );
    await waitFor(() => {
      expect(reloadMembers).toHaveBeenCalled();
    });
    expect(result.current.isEditModalVisible).toBe(false);
  });
});
