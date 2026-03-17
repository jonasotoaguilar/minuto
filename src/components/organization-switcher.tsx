import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Fonts, Spacing } from '@/constants/theme';
import type { OrganizationSummary } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';

type OrganizationSwitcherProps = {
  activeOrganization: OrganizationSummary;
  organizations: OrganizationSummary[];
  onSelectOrganization: (organizationId: string) => Promise<void>;
  onOpenOrganizationSetup: () => void;
};

export function OrganizationSwitcher({
  activeOrganization,
  organizations,
  onSelectOrganization,
  onOpenOrganizationSetup,
}: OrganizationSwitcherProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = async (organizationId: string) => {
    setIsOpen(false);
    await onSelectOrganization(organizationId);
  };

  const handleOpenSetup = () => {
    setIsOpen(false);
    onOpenOrganizationSetup();
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => setIsOpen((currentValue) => !currentValue)}
        style={[
          styles.trigger,
          {
            borderColor: theme.border,
            backgroundColor: theme.backgroundElement,
          },
        ]}
      >
        <Text style={[styles.triggerText, { color: theme.text }]}>
          {activeOrganization.name}
        </Text>
        <Text style={[styles.triggerCaret, { color: theme.textSecondary }]}>
          {isOpen ? '^' : 'v'}
        </Text>
      </Pressable>

      {isOpen ? (
        <View
          style={[
            styles.menu,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          {organizations.map((organization) => (
            <Pressable
              key={organization.id}
              onPress={() => handleSelect(organization.id)}
              style={[
                styles.menuItem,
                organization.id === activeOrganization.id
                  ? { backgroundColor: theme.backgroundSelected }
                  : null,
              ]}
            >
              <Text style={[styles.menuItemText, { color: theme.text }]}>
                {organization.name}
              </Text>
              <Text
                style={[styles.menuItemRole, { color: theme.textSecondary }]}
              >
                {organization.membershipRole}
              </Text>
            </Pressable>
          ))}

          <Pressable
            onPress={handleOpenSetup}
            style={[styles.menuAction, { borderTopColor: theme.border }]}
          >
            <Text style={[styles.menuActionText, { color: theme.primary }]}>
              Crear o unirme a otra organización
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minWidth: 220,
    maxWidth: 280,
    position: 'relative',
    zIndex: 120,
    elevation: 120,
  },
  trigger: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Fonts.sans,
    flex: 1,
  },
  triggerCaret: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: Spacing.one,
  },
  menu: {
    position: 'absolute',
    top: 44,
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: Spacing.one,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 140,
    zIndex: 140,
  },
  menuItem: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 10,
    marginHorizontal: Spacing.one,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuItemRole: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  menuAction: {
    borderTopWidth: 1,
    marginTop: Spacing.one,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.one,
  },
  menuActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
