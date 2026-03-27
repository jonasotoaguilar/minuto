import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { OfficeLocationSearch } from '@/components/office-location-search';
import { OrganizationSetupView } from '@/components/organization-setup-view';
import { SecondaryScreenHeader } from '@/components/secondary-screen-header';
import { TimezonePicker } from '@/components/timezone-picker';
import { BottomTabInset } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import {
  type OrganizationOffice,
  useOrganizationOffices,
} from '@/hooks/use-organization-offices';
import { useTheme } from '@/hooks/use-theme';
import { type SelectedOfficeLocation } from '@/lib/mapbox-search';
import { supabase } from '@/lib/supabase';
import { isValidTimezone, resolveOrganizationTimezone } from '@/lib/timezone';
import {
  GlassCard,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionHeader,
  TextField,
  ThemedText,
} from '@/theme/primitives';

const MANAGEMENT_ROLES: readonly string[] = ['owner', 'admin', 'manager'];
const SETTINGS_SUCCESS_MESSAGE = 'Organización actualizada.';
const OFFICE_SUCCESS_MESSAGE = 'Oficina agregada.';

export default function OrganizationSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    activeOrganization,
    isLoadingOrganizations,
    isOrganizationSetupOpen,
    refreshOrganizations,
  } = useOrganization();
  const canManageOrganization = MANAGEMENT_ROLES.includes(
    activeOrganization?.membershipRole ?? 'employee',
  );
  const {
    errorMessage: officesErrorMessage,
    isLoadingOffices,
    offices,
    reloadOffices,
  } = useOrganizationOffices(activeOrganization?.id ?? null);

  const [organizationName, setOrganizationName] = useState('');
  const [defaultTimezone, setDefaultTimezone] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [isOfficeFormOpen, setIsOfficeFormOpen] = useState(false);
  const [officeName, setOfficeName] = useState('');
  const [officeLocation, setOfficeLocation] =
    useState<SelectedOfficeLocation | null>(null);
  const [officeErrorMessage, setOfficeErrorMessage] = useState('');
  const [officeSuccessMessage, setOfficeSuccessMessage] = useState('');
  const [isCreatingOffice, setIsCreatingOffice] = useState(false);

  useEffect(() => {
    if (!activeOrganization) return;

    setOrganizationName(activeOrganization.name);
    setDefaultTimezone(
      resolveOrganizationTimezone(activeOrganization.defaultTimezone),
    );
  }, [activeOrganization]);

  const pageSubtitle = useMemo(() => {
    if (!activeOrganization) return '';
    return `Ajustá el nombre, la zona horaria y las oficinas de ${activeOrganization.name}.`;
  }, [activeOrganization]);

  const isSettingsDirty = useMemo(() => {
    if (!activeOrganization) return false;

    const normalizedCurrentName = organizationName.trim().replace(/\s+/g, ' ');
    const normalizedCurrentTimezone = defaultTimezone.trim();
    const normalizedInitialName = activeOrganization.name
      .trim()
      .replace(/\s+/g, ' ');
    const normalizedInitialTimezone = resolveOrganizationTimezone(
      activeOrganization.defaultTimezone,
    ).trim();

    return (
      normalizedCurrentName !== normalizedInitialName ||
      normalizedCurrentTimezone !== normalizedInitialTimezone
    );
  }, [activeOrganization, defaultTimezone, organizationName]);

  const handleSaveSettings = async () => {
    if (!activeOrganization || isSavingSettings) {
      return;
    }

    const normalizedName = organizationName.trim().replace(/\s+/g, ' ');
    const normalizedTimezone = defaultTimezone.trim();

    if (normalizedName.length < 2 || normalizedName.length > 120) {
      setSettingsMessage('El nombre debe tener entre 2 y 120 caracteres.');
      return;
    }

    if (/[<>]/.test(normalizedName)) {
      setSettingsMessage('El nombre contiene caracteres inválidos.');
      return;
    }

    if (!isValidTimezone(normalizedTimezone)) {
      setSettingsMessage('Ingresá una zona horaria IANA válida.');
      return;
    }

    setIsSavingSettings(true);
    setSettingsMessage('');

    const { error } = await supabase.rpc('update_organization_settings', {
      p_default_timezone: normalizedTimezone,
      p_name: normalizedName,
      p_organization_id: activeOrganization.id,
    });

    if (error) {
      setSettingsMessage(error.message);
      setIsSavingSettings(false);
      return;
    }

    await refreshOrganizations();
    setSettingsMessage(SETTINGS_SUCCESS_MESSAGE);
    setIsSavingSettings(false);
  };

  const handleCreateOffice = async () => {
    if (!activeOrganization || isCreatingOffice) {
      return;
    }

    const normalizedOfficeName = officeName.trim().replace(/\s+/g, ' ');

    if (normalizedOfficeName.length < 2 || normalizedOfficeName.length > 120) {
      setOfficeErrorMessage(
        'El nombre de la oficina debe tener entre 2 y 120 caracteres.',
      );
      return;
    }

    if (/[<>]/.test(normalizedOfficeName)) {
      setOfficeErrorMessage(
        'El nombre de la oficina contiene caracteres inválidos.',
      );
      return;
    }

    if (!officeLocation) {
      setOfficeErrorMessage(
        'Seleccioná una ubicación en el buscador de Mapbox.',
      );
      return;
    }

    setIsCreatingOffice(true);
    setOfficeErrorMessage('');
    setOfficeSuccessMessage('');

    const { error } = await supabase.rpc('create_organization_office', {
      p_address_label: officeLocation.addressLabel,
      p_latitude: officeLocation.latitude,
      p_longitude: officeLocation.longitude,
      p_name: normalizedOfficeName,
      p_organization_id: activeOrganization.id,
    });

    if (error) {
      setOfficeErrorMessage(error.message);
      setIsCreatingOffice(false);
      return;
    }

    setOfficeName('');
    setOfficeLocation(null);
    setIsOfficeFormOpen(false);
    setOfficeSuccessMessage(OFFICE_SUCCESS_MESSAGE);
    setIsCreatingOffice(false);
    await reloadOffices();
  };

  if (isLoadingOrganizations) {
    return (
      <Screen contentContainerStyle={styles.loaderContainer}>
        <ActivityIndicator color={theme.colors.brand.primary} size="small" />
        <ThemedText
          colorToken="secondary"
          style={styles.loaderText}
          variant="label"
        >
          Cargando organización...
        </ThemedText>
      </Screen>
    );
  }

  if (!activeOrganization || isOrganizationSetupOpen) {
    return <OrganizationSetupView />;
  }

  if (!canManageOrganization) {
    return (
      <Screen
        scroll
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing['3xl'],
          },
        ]}
        scrollProps={{ contentInsetAdjustmentBehavior: 'automatic' }}
      >
        <SecondaryScreenHeader
          title="Organización"
          subtitle="Solo owners y admins pueden editar la organización."
          onBack={() => router.back()}
        />

        <GlassCard style={styles.card}>
          <SectionHeader
            eyebrow="Sin permisos"
            subtitle="Esta configuración queda reservada para quienes administran la organización."
            title="Solo owners y admins pueden editar la organización."
          />

          <PrimaryButton
            fullWidth={false}
            label="Volver al equipo"
            onPress={() => router.replace('/(tabs)/team')}
            style={styles.inlineAction}
          />
        </GlassCard>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: theme.spacing.lg,
          paddingBottom: BottomTabInset + theme.spacing['2xl'],
        },
      ]}
      scrollProps={{ contentInsetAdjustmentBehavior: 'automatic' }}
    >
      <SecondaryScreenHeader
        title="Modificar organización"
        subtitle={pageSubtitle}
        onBack={() => router.back()}
      />

      <GlassCard style={styles.card}>
        <SectionHeader
          eyebrow="Configuración editorial"
          subtitle={pageSubtitle}
          title="Ajustes de organización"
        />

        <TextField
          autoCapitalize="words"
          label="Nombre de la organización"
          onChangeText={setOrganizationName}
          placeholder="Nombre de la organización"
          value={organizationName}
        />

        <View style={styles.fieldGroup}>
          <ThemedText variant="label">Zona horaria por defecto</ThemedText>
          <TimezonePicker
            onValueChange={setDefaultTimezone}
            value={defaultTimezone}
          />
        </View>

        {settingsMessage ? (
          <FeedbackCard
            message={settingsMessage}
            tone={
              settingsMessage === SETTINGS_SUCCESS_MESSAGE
                ? 'success'
                : 'neutral'
            }
          />
        ) : null}

        <PrimaryButton
          label={isSavingSettings ? 'Guardando...' : 'Guardar cambios'}
          disabled={!isSettingsDirty}
          loading={isSavingSettings}
          onPress={() => void handleSaveSettings()}
        />
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader
          eyebrow="Sucursales y oficinas"
          title="Oficinas físicas"
          subtitle="La opción de trabajo remoto está disponible automáticamente para todos los empleados."
        />

        {officesErrorMessage ? (
          <FeedbackCard message={officesErrorMessage} tone="neutral" />
        ) : null}

        {officeErrorMessage ? (
          <FeedbackCard message={officeErrorMessage} tone="neutral" />
        ) : null}

        {officeSuccessMessage ? (
          <FeedbackCard message={officeSuccessMessage} tone="success" />
        ) : null}

        {isLoadingOffices ? (
          <GlassCard style={styles.loadingCard} variant="soft">
            <ActivityIndicator
              color={theme.colors.brand.primary}
              size="small"
            />
            <ThemedText colorToken="secondary" variant="body">
              Cargando oficinas...
            </ThemedText>
          </GlassCard>
        ) : (
          <View style={styles.officeList}>
            {offices.map((office) => (
              <OfficeCard key={office.id} office={office} />
            ))}
          </View>
        )}

        <SecondaryButton
          fullWidth={false}
          label={isOfficeFormOpen ? 'Cerrar formulario' : 'Agregar oficina'}
          onPress={() => {
            setIsOfficeFormOpen((currentValue) => !currentValue);
            setOfficeErrorMessage('');
            setOfficeSuccessMessage('');
          }}
          style={styles.inlineAction}
        />

        {isOfficeFormOpen ? (
          <GlassCard style={styles.officeFormCard} variant="soft">
            <SectionHeader
              eyebrow="Nueva oficina"
              subtitle="Usá Mapbox para definir la ubicación exacta antes de guardar."
              title="Alta de oficina"
            />

            <TextField
              autoCapitalize="words"
              label="Nombre de la oficina"
              onChangeText={setOfficeName}
              placeholder="Casa matriz, Palermo, Providencia..."
              value={officeName}
            />

            <OfficeLocationSearch
              onSelectionChange={setOfficeLocation}
              selectedLocation={officeLocation}
            />

            <PrimaryButton
              label={isCreatingOffice ? 'Guardando...' : 'Guardar oficina'}
              loading={isCreatingOffice}
              onPress={() => void handleCreateOffice()}
            />
          </GlassCard>
        ) : null}
      </GlassCard>
    </Screen>
  );
}

function FeedbackCard({
  message,
  tone,
}: {
  message: string;
  tone: 'neutral' | 'success';
}) {
  const theme = useTheme();
  const isSuccess = tone === 'success';

  return (
    <View
      style={[
        styles.feedbackCard,
        {
          backgroundColor: isSuccess
            ? theme.colors.brand.muted
            : theme.surface.glass.soft,
          borderColor: isSuccess
            ? theme.colors.border.default
            : theme.surface.glass.border,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <ThemedText colorToken="primary" variant="bodySmall">
        {message}
      </ThemedText>
    </View>
  );
}

function OfficeCard({ office }: { office: OrganizationOffice }) {
  return (
    <GlassCard style={styles.officeCard} variant="soft">
      <View style={styles.officeCopy}>
        <ThemedText variant="subtitle">{office.name}</ThemedText>
        {office.addressLabel ? (
          <ThemedText colorToken="secondary" variant="bodySmall">
            {office.addressLabel}
          </ThemedText>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 720,
    paddingHorizontal: 16,
    width: '100%',
  },
  loaderContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 8,
  },
  card: {
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  feedbackCard: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  loadingCard: {
    alignItems: 'center',
    gap: 8,
  },
  officeList: {
    gap: 8,
  },
  officeCard: {
    gap: 12,
  },
  officeCopy: {
    gap: 4,
  },

  officeFormCard: {
    gap: 16,
  },
  inlineAction: {
    minWidth: 188,
  },
});
