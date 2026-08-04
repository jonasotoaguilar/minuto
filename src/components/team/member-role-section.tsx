import type { Dispatch, SetStateAction } from 'react';
import { StyleSheet, View } from 'react-native';

import { ROLE_PERMISSION_SUMMARIES } from '@/lib/role-permission-summaries';
import { Chip, ThemedText } from '@/theme/primitives';
import type {
  EditEmployeeFormErrors,
  EditEmployeeFormValues,
} from './team-edit-form';
import { getRoleLabel, type MembershipRole } from './team-member';

type MemberRoleSectionProps = {
  allowedRoles: MembershipRole[];
  editFormErrors: EditEmployeeFormErrors;
  editFormValues: EditEmployeeFormValues;
  setEditFormValues: Dispatch<SetStateAction<EditEmployeeFormValues>>;
};

export function MemberRoleSection({
  allowedRoles,
  editFormErrors,
  editFormValues,
  setEditFormValues,
}: MemberRoleSectionProps) {
  return (
    <View style={styles.fieldGroup}>
      <ThemedText variant="label">Rol (permisos)</ThemedText>
      <View style={styles.roleChipsRow}>
        {allowedRoles.map((roleOption) => (
          <Chip
            key={roleOption}
            label={getRoleLabel(roleOption)}
            onPress={() =>
              setEditFormValues((current) => ({
                ...current,
                role: roleOption,
              }))
            }
            selected={editFormValues.role === roleOption}
            tone="brand"
          />
        ))}
      </View>
      {editFormErrors.role ? (
        <ThemedText colorToken="error" variant="caption">
          {editFormErrors.role}
        </ThemedText>
      ) : null}
      <ThemedText colorToken="secondary" variant="caption">
        Seleccioná el nivel de permisos del colaborador.
      </ThemedText>
      <ThemedText colorToken="secondary" variant="caption">
        {ROLE_PERMISSION_SUMMARIES[editFormValues.role].description}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 8,
  },
  roleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
