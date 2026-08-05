import {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useState } from 'react';
import {
  formatDateForDisplay,
  formatDateForStorageFromPicker,
  getDatePickerValue,
  getTodayPickerMaximumDate,
} from '@/components/team/team-date-time-format';
import {
  createEditFormValues,
  type EditEmployeeFormErrors,
  type EditEmployeeFormValues,
  getEmptyEditFormValues,
  validateEditForm,
} from '@/components/team/team-edit-form';
import type { TeamMember } from '@/components/team/team-member';
import { roleUpdateResponseSchema } from '@/components/team/team-screen-data';
import { updateEmployeeProfile } from '@/lib/attendance';
import { getErrorMessage } from '@/lib/error';
import { supabase } from '@/lib/supabase';
import { useFeedback } from '@/theme/feedback';

function mapProfileUpdateError(errorCode?: string) {
  switch (errorCode) {
    case 'MEMBERSHIP_NOT_FOUND':
      return 'No encontramos al colaborador que querés actualizar.';
    case 'INVALID_SHIFT':
      return 'La jornada informada no es válida.';
    case 'INVALID_BREAK':
      return 'La colación informada no es válida.';
    default:
      return 'No se pudo guardar el perfil del colaborador.';
  }
}

function mapRoleUpdateError(errorCode?: string) {
  switch (errorCode) {
    case 'MEMBERSHIP_NOT_FOUND':
      return 'No encontramos al colaborador.';
    case 'CANNOT_CHANGE_OWN_ROLE':
      return 'No podés cambiar tu propio rol.';
    case 'CANNOT_CHANGE_OWNER_ROLE':
      return 'El rol de owner no puede modificarse.';
    case 'UNAUTHORIZED':
      return 'No tenés permisos para asignar ese rol.';
    case 'INVALID_ROLE':
      return 'El rol seleccionado no es válido.';
    default:
      return 'No se pudo actualizar el rol del colaborador.';
  }
}

export function useEditMemberForm(reloadMembers: () => Promise<void>) {
  const feedback = useFeedback();

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editFormValues, setEditFormValues] = useState<EditEmployeeFormValues>(
    getEmptyEditFormValues(),
  );
  const [editFormErrors, setEditFormErrors] = useState<EditEmployeeFormErrors>(
    {},
  );
  const [editFormMessage, setEditFormMessage] = useState('');
  const [isHireDatePickerVisible, setIsHireDatePickerVisible] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const isEditModalVisible = selectedMember !== null;

  const onEditMember = useCallback((member: TeamMember) => {
    setSelectedMember(member);
    setEditFormValues(createEditFormValues(member));
    setEditFormErrors({});
    setEditFormMessage('');
    setIsHireDatePickerVisible(false);
  }, []);

  const onCloseEditModal = useCallback(() => {
    if (isSavingProfile) {
      return;
    }

    setSelectedMember(null);
    setEditFormValues(getEmptyEditFormValues());
    setEditFormErrors({});
    setEditFormMessage('');
    setIsHireDatePickerVisible(false);
  }, [isSavingProfile]);

  const applyHireDateSelection = useCallback((date: Date) => {
    const storageValue = formatDateForStorageFromPicker(date);

    setEditFormValues((current) => ({
      ...current,
      hireDate: formatDateForDisplay(storageValue),
    }));
    setEditFormErrors((current) => ({
      ...current,
      hireDate: undefined,
    }));
  }, []);

  const onHireDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (process.env.EXPO_OS === 'android') {
        setIsHireDatePickerVisible(false);
      }

      if (event.type === 'dismissed' || !selectedDate) {
        return;
      }

      applyHireDateSelection(selectedDate);
    },
    [applyHireDateSelection],
  );

  const onOpenHireDatePicker = useCallback(() => {
    const pickerValue = getDatePickerValue(editFormValues.hireDate);

    if (process.env.EXPO_OS === 'android') {
      DateTimePickerAndroid.open({
        maximumDate: getTodayPickerMaximumDate(),
        mode: 'date',
        onChange: onHireDateChange,
        value: pickerValue,
      });
      return;
    }

    if (process.env.EXPO_OS !== 'ios') {
      return;
    }

    setIsHireDatePickerVisible(true);
  }, [editFormValues.hireDate, onHireDateChange]);

  const onSaveMemberProfile = useCallback(async () => {
    if (!selectedMember) {
      return;
    }

    const validation = validateEditForm(editFormValues);
    setEditFormErrors(validation.errors);

    if (!validation.isValid) {
      setEditFormMessage('Revisá los campos marcados antes de guardar.');
      return;
    }

    setIsSavingProfile(true);
    setEditFormMessage('');

    try {
      const result = await updateEmployeeProfile({
        membershipId: selectedMember.id,
        shiftDurationHours: validation.parsed.shiftDurationHours,
        breakDurationHours: validation.parsed.breakDurationHours,
        weeklyHours: validation.parsed.weeklyHours,
        position: validation.parsed.position,
        department: validation.parsed.department,
        hireDate: validation.parsed.hireDate,
      });

      if (!result.success) {
        throw new Error(mapProfileUpdateError(result.errorCode));
      }

      if (editFormValues.role !== selectedMember.role) {
        const { data: roleData, error: roleError } = await supabase.rpc(
          'update_membership_role',
          {
            p_membership_id: selectedMember.id,
            p_new_role: editFormValues.role,
          },
        );

        if (roleError) {
          throw new Error(
            `No se pudo actualizar el rol del colaborador (${roleError.message}).`,
          );
        }

        const parsedRoleResult = roleUpdateResponseSchema.safeParse(roleData);

        if (!parsedRoleResult.success) {
          throw new Error(
            'La actualización del rol devolvió un formato inválido.',
          );
        }

        const roleResult = parsedRoleResult.data;
        if (!roleResult?.success) {
          throw new Error(mapRoleUpdateError(roleResult?.error_code));
        }
      }

      await reloadMembers();
      setSelectedMember(null);
      setEditFormValues(getEmptyEditFormValues());
      setEditFormErrors({});
      setEditFormMessage('');
      setIsHireDatePickerVisible(false);
      feedback.show({
        tone: 'success',
        title: 'Perfil actualizado',
        message: 'Los datos del colaborador fueron guardados.',
      });
    } catch (error) {
      setEditFormMessage(
        getErrorMessage(error) ??
          'No se pudo guardar el perfil del colaborador.',
      );
    } finally {
      setIsSavingProfile(false);
    }
  }, [editFormValues, feedback, reloadMembers, selectedMember]);

  return {
    editFormErrors,
    editFormMessage,
    editFormValues,
    isEditModalVisible,
    isHireDatePickerVisible,
    isSavingProfile,
    onCloseEditModal,
    onEditMember,
    onHireDateChange,
    onOpenHireDatePicker,
    onSaveMemberProfile,
    selectedMember,
    setEditFormValues,
    setIsHireDatePickerVisible,
  };
}
