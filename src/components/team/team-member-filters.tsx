import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip, GlassCard, SectionHeader, TextField } from '@/theme/primitives';

import { DEPARTMENT_FILTERS, type TeamMember } from './team-member';

type TeamMemberFiltersProps = {
  members: TeamMember[];
  onDepartmentChange: (department: string) => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  selectedDepartment: string;
};

export function TeamMemberFilters({
  members,
  onDepartmentChange,
  onSearchChange,
  searchQuery,
  selectedDepartment,
}: TeamMemberFiltersProps) {
  const departments = useMemo(() => {
    const uniqueDepartments = [
      ...new Set(members.map((member) => member.department)),
    ];
    return [DEPARTMENT_FILTERS.all, ...uniqueDepartments];
  }, [members]);

  return (
    <GlassCard style={styles.card} variant="soft">
      <SectionHeader
        eyebrow="Explorar equipo"
        subtitle="Filtrá por nombre o departamento."
        title="Miembros"
      />

      <TextField
        autoCapitalize="none"
        autoCorrect={false}
        inputStyle={styles.searchInput}
        onChangeText={onSearchChange}
        placeholder="Buscar miembros del equipo..."
        returnKeyType="search"
        value={searchQuery}
      />

      <ScrollView
        contentContainerStyle={styles.departmentsRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {departments.map((department) => {
          const isSelected = department === selectedDepartment;

          return (
            <Chip
              key={department}
              label={
                department === DEPARTMENT_FILTERS.all
                  ? 'TODOS'
                  : department.toUpperCase()
              }
              onPress={() => onDepartmentChange(department)}
              selected={isSelected}
              tone="brand"
            />
          );
        })}
      </ScrollView>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
  },
  searchInput: {
    minHeight: 24,
  },
  departmentsRow: {
    gap: 8,
  },
});
