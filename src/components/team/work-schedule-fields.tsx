import type { Dispatch, SetStateAction } from 'react';

import { TextField } from '@/theme/primitives';

import { formatTimeInputOnBlur } from './team-date-time-format';
import type {
  EditEmployeeFormErrors,
  EditEmployeeFormValues,
} from './team-edit-form';

type WorkScheduleFieldsProps = {
  editFormErrors: EditEmployeeFormErrors;
  editFormValues: EditEmployeeFormValues;
  setEditFormValues: Dispatch<SetStateAction<EditEmployeeFormValues>>;
};

export function WorkScheduleFields({
  editFormErrors,
  editFormValues,
  setEditFormValues,
}: WorkScheduleFieldsProps) {
  return (
    <>
      <TextField
        keyboardType="numbers-and-punctuation"
        label="Jornada laboral"
        onChangeText={(value) =>
          setEditFormValues((current) => ({
            ...current,
            shiftDurationHours: value,
          }))
        }
        onBlur={() =>
          setEditFormValues((current) => ({
            ...current,
            shiftDurationHours: formatTimeInputOnBlur(
              current.shiftDurationHours,
            ),
          }))
        }
        errorMessage={editFormErrors.shiftDurationHours}
        helperText="Horas diarias del contrato, por ejemplo 08:00."
        placeholder="08:00"
        value={editFormValues.shiftDurationHours}
      />

      <TextField
        keyboardType="numbers-and-punctuation"
        label="Colación"
        onChangeText={(value) =>
          setEditFormValues((current) => ({
            ...current,
            breakDurationHours: value,
          }))
        }
        onBlur={() =>
          setEditFormValues((current) => ({
            ...current,
            breakDurationHours: formatTimeInputOnBlur(
              current.breakDurationHours,
            ),
          }))
        }
        errorMessage={editFormErrors.breakDurationHours}
        helperText="Horas de colación del contrato, por ejemplo 00:45."
        placeholder="00:45"
        value={editFormValues.breakDurationHours}
      />

      <TextField
        keyboardType="numeric"
        label="Jornada semanal"
        onChangeText={(value) =>
          setEditFormValues((current) => ({
            ...current,
            weeklyHours: value,
          }))
        }
        errorMessage={editFormErrors.weeklyHours}
        helperText="Horas semanales del contrato, por ejemplo 40."
        placeholder="40"
        value={editFormValues.weeklyHours}
      />
    </>
  );
}
