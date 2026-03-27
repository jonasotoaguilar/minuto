import { StyleSheet, Text, View } from 'react-native';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import { OrganizationSwitcher } from './organization-switcher';

export function AppHeader() {
  const theme = useTheme();
  const {
    activeOrganization,
    organizations,
    setActiveOrganizationById,
    openOrganizationSetup,
  } = useOrganization();

  return (
    <View style={styles.header}>
      <Text
        style={[
          styles.appName,
          {
            color: theme.colors.text.primary,
            fontFamily: theme.typography.subtitle.fontFamily,
            fontSize: theme.typography.subtitle.fontSize,
            fontWeight: theme.typography.subtitle.fontWeight,
          },
        ]}
      >
        Minuto
      </Text>

      {activeOrganization ? (
        <OrganizationSwitcher
          activeOrganization={activeOrganization}
          organizations={organizations}
          onSelectOrganization={setActiveOrganizationById}
          onOpenOrganizationSetup={openOrganizationSetup}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 120,
    elevation: 120,
  },
  appName: {},
});
