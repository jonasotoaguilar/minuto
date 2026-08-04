import {
  createEditFormValues,
  getEmptyEditFormValues,
  validateEditForm,
} from '@/components/team/team-edit-form';
import type { TeamMember } from '@/components/team/team-member';

const member: TeamMember = {
  breakDurationHours: 0.75,
  department: 'General',
  hireDate: '2026-01-15',
  id: 'membership-1',
  initials: 'JU',
  email: 'juan@empresa.com',
  phone: '+56911111111',
  name: 'Juan Pérez',
  position: 'Operario',
  role: 'employee',
  roleLabel: 'Operario',
  shiftDurationHours: 8,
  weeklyHours: 40,
};

describe('getEmptyEditFormValues', () => {
  it('returns sensible defaults', () => {
    expect(getEmptyEditFormValues()).toEqual({
      breakDurationHours: '00:45',
      department: '',
      hireDate: '',
      position: '',
      role: 'employee',
      shiftDurationHours: '08:00',
      weeklyHours: '40',
    });
  });
});

describe('createEditFormValues', () => {
  it('maps member profile data into form values', () => {
    expect(createEditFormValues(member)).toEqual({
      breakDurationHours: '00:45',
      department: '',
      hireDate: '15/01/2026',
      position: 'Operario',
      role: 'employee',
      shiftDurationHours: '08:00',
      weeklyHours: '40',
    });
  });
});

describe('validateEditForm', () => {
  const validValues = {
    breakDurationHours: '00:45',
    department: 'Operaciones',
    hireDate: '15/01/2026',
    position: 'Supervisor',
    role: 'manager' as const,
    shiftDurationHours: '08:00',
    weeklyHours: '40',
  };

  it('accepts a valid form', () => {
    const result = validateEditForm(validValues);

    expect(result.isValid).toBe(true);
    expect(result.parsed).toEqual({
      breakDurationHours: 0.75,
      department: 'Operaciones',
      hireDate: '2026-01-15',
      position: 'Supervisor',
      shiftDurationHours: 8,
      weeklyHours: 40,
    });
  });

  it('rejects invalid shift durations and weekly hours', () => {
    const shiftResult = validateEditForm({
      ...validValues,
      shiftDurationHours: '16:00',
    });
    const weeklyResult = validateEditForm({ ...validValues, weeklyHours: '0' });

    expect(shiftResult.isValid).toBe(false);
    expect(shiftResult.errors.shiftDurationHours).toMatch(/15:00/);
    expect(weeklyResult.isValid).toBe(false);
    expect(weeklyResult.errors.weeklyHours).toMatch(/mayor a 0/);
  });

  it('rejects break durations that exceed the shift', () => {
    const result = validateEditForm({
      ...validValues,
      breakDurationHours: '03:00',
      shiftDurationHours: '02:00',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.breakDurationHours).toMatch(/menor que la jornada/);
  });

  it('rejects malformed or future hire dates', () => {
    const malformed = validateEditForm({
      ...validValues,
      hireDate: '31/13/2026',
    });
    const future = validateEditForm({ ...validValues, hireDate: '31/12/2099' });

    expect(malformed.isValid).toBe(false);
    expect(malformed.errors.hireDate).toMatch(/DD\/MM\/YYYY/);
    expect(future.isValid).toBe(false);
    expect(future.errors.hireDate).toMatch(/posterior a hoy/);
  });
});
