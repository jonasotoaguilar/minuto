import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
            borderColor: theme.colors.border.default,
            backgroundColor: theme.colors.background.card,
            borderRadius: theme.radius.pill,
            paddingVertical: theme.spacing.xs,
            paddingHorizontal: theme.spacing.sm,
            gap: theme.spacing.xs,
          },
        ]}
      >
        <Text
          style={[
            styles.triggerText,
            {
              color: theme.colors.text.primary,
              fontFamily: theme.typography.label.fontFamily,
              fontSize: theme.typography.label.fontSize,
              fontWeight: theme.typography.label.fontWeight,
            },
          ]}
        >
          {activeOrganization.name}
        </Text>
        <Text
          style={[
            styles.triggerCaret,
            {
              color: theme.colors.text.secondary,
              marginLeft: theme.spacing.xs,
            },
          ]}
        >
          {isOpen ? '^' : 'v'}
        </Text>
      </Pressable>

      {isOpen ? (
        <View
          style={[
            styles.menu,
            {
              backgroundColor: theme.colors.background.card,
              borderColor: theme.colors.border.default,
              shadowColor: theme.colors.shadow.color,
              borderRadius: theme.radius.lg,
              paddingVertical: theme.spacing.xs,
            },
          ]}
        >
          {organizations.map((organization) => (
            <Pressable
              key={organization.id}
              onPress={() => handleSelect(organization.id)}
              style={[
                styles.menuItem,
                {
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                  borderRadius: theme.radius.md,
                  marginHorizontal: theme.spacing.xs,
                },
                organization.id === activeOrganization.id
                  ? { backgroundColor: theme.colors.background.selected }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.menuItemText,
                  {
                    color: theme.colors.text.primary,
                    fontFamily: theme.typography.label.fontFamily,
                    fontSize: theme.typography.label.fontSize,
                    fontWeight: theme.typography.label.fontWeight,
                  },
                ]}
              >
                {organization.name}
              </Text>
              <Text
                style={[
                  styles.menuItemRole,
                  {
                    color: theme.colors.text.secondary,
                    fontSize: theme.typography.caption.fontSize,
                  },
                ]}
              >
                {organization.membershipRole}
              </Text>
            </Pressable>
          ))}

          <Pressable
            onPress={handleOpenSetup}
            style={[
              styles.menuAction,
              {
                borderTopColor: theme.colors.border.default,
                marginTop: theme.spacing.xs,
                paddingTop: theme.spacing.sm,
                paddingHorizontal: theme.spacing.sm,
                paddingBottom: theme.spacing.xs,
              },
            ]}
          >
            <Text
              style={[
                styles.menuActionText,
                {
                  color: theme.colors.brand.primary,
                  fontFamily: theme.typography.label.fontFamily,
                  fontSize: theme.typography.bodySmall.fontSize,
                  fontWeight: theme.typography.label.fontWeight,
                },
              ]}
            >
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: {
    flex: 1,
  },
  triggerCaret: {
    fontSize: 12,
    fontWeight: '700',
  },
  menu: {
    position: 'absolute',
    top: 44,
    width: '100%',
    borderWidth: 1,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 140,
    zIndex: 140,
  },
  menuItem: {},
  menuItemText: {},
  menuItemRole: {
    textTransform: 'capitalize',
  },
  menuAction: {
    borderTopWidth: 1,
  },
  menuActionText: {},
});
