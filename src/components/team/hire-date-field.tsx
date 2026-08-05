import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import type { Dispatch, SetStateAction } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { SecondaryButton, TextField, ThemedText } from '@/theme/primitives';

import {
  formatDateInputOnBlur,
  getDatePickerValue,
  getTodayPickerMaximumDate,
} from './team-date-time-format';
import type {
  EditEmployeeFormErrors,
  EditEmployeeFormValues,
} from './team-edit-form';

type HireDateFieldProps = {
  editFormErrors: EditEmployeeFormErrors;
  editFormValues: EditEmployeeFormValues;
  isHireDatePickerVisible: boolean;
  onHireDateChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
  onOpenHireDatePicker: () => void;
  setEditFormValues: Dispatch<SetStateAction<EditEmployeeFormValues>>;
  setIsHireDatePickerVisible: Dispatch<SetStateAction<boolean>>;
};

export function HireDateField({
  editFormErrors,
  editFormValues,
  isHireDatePickerVisible,
  onHireDateChange,
  onOpenHireDatePicker,
  setEditFormValues,
  setIsHireDatePickerVisible,
}: HireDateFieldProps) {
  const theme = useTheme();

  if (process.env.EXPO_OS === 'web') {
    return (
      <TextField
        label="Fecha de contratación"
        onChangeText={(value) =>
          setEditFormValues((current) => ({
            ...current,
            hireDate: value,
          }))
        }
        onBlur={() =>
          setEditFormValues((current) => ({
            ...current,
            hireDate: formatDateInputOnBlur(current.hireDate),
          }))
        }
        errorMessage={editFormErrors.hireDate}
        helperText="Formato DD/MM/YYYY, por ejemplo 15/01/2024."
        keyboardType="numbers-and-punctuation"
        placeholder="15/01/2024"
        value={editFormValues.hireDate}
      />
    );
  }

  return (
    <View style={styles.dateFieldWrapper}>
      <ThemedText variant="label">Fecha de contratación</ThemedText>

      <Pressable
        accessibilityHint="Abre el selector nativo de fecha"
        accessibilityLabel="Fecha de contratación"
        accessibilityRole="button"
        accessibilityState={{ expanded: isHireDatePickerVisible }}
        onPress={onOpenHireDatePicker}
        style={({ pressed }) => [
          styles.dateFieldButton,
          theme.elevation.card,
          {
            backgroundColor: theme.colors.background.card,
            borderColor: editFormErrors.hireDate
              ? theme.colors.status.error
              : theme.colors.border.default,
            borderRadius: theme.radius.lg,
            minHeight: theme.spacing['4xl'] + theme.spacing.sm,
            opacity: pressed ? 0.92 : 1,
            paddingHorizontal: theme.spacing.lg,
            shadowColor: theme.colors.shadow.color,
          },
        ]}
      >
        <ThemedText
          colorToken={editFormValues.hireDate ? 'primary' : 'secondary'}
          variant="body"
        >
          {editFormValues.hireDate || 'Seleccionar fecha'}
        </ThemedText>
        <ThemedText colorToken="secondary" variant="caption">
          DD/MM/YYYY
        </ThemedText>
      </Pressable>

      <ThemedText
        colorToken={editFormErrors.hireDate ? 'error' : 'secondary'}
        variant="caption"
      >
        {editFormErrors.hireDate || 'Selecciona la fecha de contratación.'}
      </ThemedText>

      {process.env.EXPO_OS === 'ios' && isHireDatePickerVisible ? (
        <View
          style={[
            styles.datePickerCard,
            {
              backgroundColor: theme.colors.background.card,
              borderColor: theme.colors.border.default,
              borderRadius: theme.radius.lg,
            },
          ]}
        >
          <DateTimePicker
            display="spinner"
            maximumDate={getTodayPickerMaximumDate()}
            mode="date"
            onChange={onHireDateChange}
            value={getDatePickerValue(editFormValues.hireDate)}
          />
          <View style={styles.dateFieldActions}>
            <SecondaryButton
              fullWidth={false}
              label="Listo"
              onPress={() => setIsHireDatePickerVisible(false)}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dateFieldActions: {
    alignItems: 'flex-start',
  },
  dateFieldButton: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateFieldWrapper: {
    gap: 8,
  },
  datePickerCard: {
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
});
