import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { OfficeLocationSearch } from '@/components/office-location-search';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import type { SelectedOfficeLocation } from '@/lib/mapbox-search';
import {
  type CreateOrganizationInput,
  createOrganizationInputSchema,
} from '@/lib/organization-validation';
import { getRuntimeTimezone } from '@/lib/timezone';
import {
  GlassCard,
  PrimaryButton,
  SecondaryButton,
  TextField,
  ThemedText,
} from '@/theme/primitives';

const CREATE_FIELD = {
  NAME: 'name',
  OFFICE_LOCATION: 'officeLocation',
  OFFICE_NAME: 'officeName',
} as const;

const ORGANIZATION_SETUP_MODE = {
  CREATE: 'create',
  JOIN: 'join',
} as const;

type CreateField = (typeof CREATE_FIELD)[keyof typeof CREATE_FIELD];
type OrganizationSetupMode =
  (typeof ORGANIZATION_SETUP_MODE)[keyof typeof ORGANIZATION_SETUP_MODE];

function getCreateFieldErrors(error: z.ZodError<CreateOrganizationInput>) {
  const nextFieldErrors: Partial<Record<CreateField, string>> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');

    if (path === 'name' && !nextFieldErrors[CREATE_FIELD.NAME]) {
      nextFieldErrors[CREATE_FIELD.NAME] = issue.message;
    }
    if (path === 'office.name' && !nextFieldErrors[CREATE_FIELD.OFFICE_NAME]) {
      nextFieldErrors[CREATE_FIELD.OFFICE_NAME] = issue.message;
    }
  }

  return nextFieldErrors;
}

export function OrganizationSetupView() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    organizations,
    setupErrorMessage,
    setSetupErrorMessage,
    createOrganization,
    joinOrganizationByCodeOrLink,
    closeOrganizationSetup,
  } = useOrganization();

  const [mode, setMode] = useState<OrganizationSetupMode>(
    ORGANIZATION_SETUP_MODE.CREATE,
  );
  const [organizationName, setOrganizationName] = useState('');
  const [isPhysicalOfficeEnabled, setIsPhysicalOfficeEnabled] = useState(false);
  const [officeName, setOfficeName] = useState('');
  const [selectedOfficeLocation, setSelectedOfficeLocation] =
    useState<SelectedOfficeLocation | null>(null);
  const [inviteCodeOrLink, setInviteCodeOrLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touchedFields, setTouchedFields] = useState<
    Partial<Record<CreateField, boolean>>
  >({});
  const [focusedField, setFocusedField] = useState<CreateField | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<CreateField, string>>
  >({});

  const hasOrganizations = organizations.length > 0;
  const runtimeTimezone = useMemo(() => getRuntimeTimezone(), []);
  const trimmedOfficeName = officeName.trim();
  const hasOfficeName = trimmedOfficeName.length > 0;
  const hasSelectedOfficeLocation = selectedOfficeLocation !== null;
  const shouldIncludePhysicalOffice =
    isPhysicalOfficeEnabled && hasOfficeName && hasSelectedOfficeLocation;

  const createInput = useMemo(() => {
    const baseInput: CreateOrganizationInput = {
      defaultTimezone: runtimeTimezone,
      name: organizationName,
    };

    if (!shouldIncludePhysicalOffice || !selectedOfficeLocation) {
      return baseInput;
    }

    return {
      ...baseInput,
      office: {
        addressLabel: selectedOfficeLocation.addressLabel,
        latitude: selectedOfficeLocation.latitude,
        longitude: selectedOfficeLocation.longitude,
        name: officeName,
      },
    } satisfies CreateOrganizationInput;
  }, [
    officeName,
    organizationName,
    runtimeTimezone,
    selectedOfficeLocation,
    shouldIncludePhysicalOffice,
  ]);

  const createValidationResult =
    createOrganizationInputSchema.safeParse(createInput);

  const validationFieldErrors = useMemo(() => {
    if (createValidationResult.success) {
      return {};
    }

    return getCreateFieldErrors(createValidationResult.error);
  }, [createValidationResult]);

  const officeFieldErrors = useMemo(() => {
    const nextFieldErrors: Partial<Record<CreateField, string>> = {};

    if (!isPhysicalOfficeEnabled) {
      return nextFieldErrors;
    }

    if (hasOfficeName && !hasSelectedOfficeLocation) {
      nextFieldErrors[CREATE_FIELD.OFFICE_LOCATION] =
        'Seleccioná una ubicación válida desde la búsqueda.';
    }

    if (!hasOfficeName && hasSelectedOfficeLocation) {
      nextFieldErrors[CREATE_FIELD.OFFICE_NAME] =
        'Poné un nombre para la oficina física.';
    }

    return nextFieldErrors;
  }, [hasOfficeName, hasSelectedOfficeLocation, isPhysicalOfficeEnabled]);

  const isCreateFormValid =
    createValidationResult.success &&
    Object.keys(officeFieldErrors).length === 0;

  const resetPhysicalOfficeFields = () => {
    setIsPhysicalOfficeEnabled(false);
    setOfficeName('');
    setSelectedOfficeLocation(null);
    setTouchedFields((current) => {
      const nextTouchedFields = { ...current };
      delete nextTouchedFields[CREATE_FIELD.OFFICE_NAME];
      delete nextTouchedFields[CREATE_FIELD.OFFICE_LOCATION];
      return nextTouchedFields;
    });
    setFieldErrors((current) => {
      const nextFieldErrors = { ...current };
      delete nextFieldErrors[CREATE_FIELD.OFFICE_NAME];
      delete nextFieldErrors[CREATE_FIELD.OFFICE_LOCATION];
      return nextFieldErrors;
    });
    setFocusedField((current) =>
      current === CREATE_FIELD.OFFICE_NAME ? null : current,
    );
  };

  const handleCreateOrganization = async () => {
    if (isSubmitting) {
      return;
    }

    setSetupErrorMessage('');

    const validationResult =
      createOrganizationInputSchema.safeParse(createInput);
    const nextFieldErrors = {
      ...(validationResult.success
        ? {}
        : getCreateFieldErrors(validationResult.error)),
      ...officeFieldErrors,
    } satisfies Partial<Record<CreateField, string>>;

    if (
      !validationResult.success ||
      Object.keys(officeFieldErrors).length > 0
    ) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});

    try {
      setIsSubmitting(true);
      await createOrganization(validationResult.data);
      setOrganizationName('');
      resetPhysicalOfficeFields();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo crear la organización.';
      setSetupErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinOrganization = async () => {
    if (isSubmitting) {
      return;
    }

    setSetupErrorMessage('');

    try {
      setIsSubmitting(true);
      await joinOrganizationByCodeOrLink(inviteCodeOrLink);
      setInviteCodeOrLink('');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo aceptar la invitación.';
      setSetupErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView
        style={[
          styles.page,
          { backgroundColor: theme.colors.background.screen },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <GlassCard
          style={[
            styles.card,
            {
              backgroundColor: theme.surface.glass.strong,
            },
          ]}
        >
          <ThemedText selectable style={styles.title} variant="title">
            Organización requerida
          </ThemedText>
          <ThemedText
            colorToken="secondary"
            selectable
            style={styles.subtitle}
            variant="bodySmall"
          >
            Para continuar, crea una organización o únete con un código/link de
            invitación.
          </ThemedText>

          <View
            style={[
              styles.tabContainer,
              {
                borderColor: theme.colors.border.default,
                backgroundColor: theme.colors.background.muted,
              },
            ]}
          >
            <Pressable
              onPress={() => setMode(ORGANIZATION_SETUP_MODE.CREATE)}
              style={[
                styles.tabButton,
                mode === ORGANIZATION_SETUP_MODE.CREATE
                  ? { backgroundColor: theme.colors.background.card }
                  : null,
              ]}
            >
              <ThemedText style={styles.tabText} variant="label">
                Crear
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setMode(ORGANIZATION_SETUP_MODE.JOIN)}
              style={[
                styles.tabButton,
                mode === ORGANIZATION_SETUP_MODE.JOIN
                  ? { backgroundColor: theme.colors.background.card }
                  : null,
              ]}
            >
              <ThemedText style={styles.tabText} variant="label">
                Unirme
              </ThemedText>
            </Pressable>
          </View>

          {mode === ORGANIZATION_SETUP_MODE.CREATE ? (
            <View style={styles.form}>
              <TextField
                label="Nombre de la organización"
                maxLength={120}
                value={organizationName}
                onChangeText={(value) => {
                  setOrganizationName(value);
                  setFieldErrors((currentErrors) => ({
                    ...currentErrors,
                    [CREATE_FIELD.NAME]: undefined,
                  }));
                }}
                placeholder="Ejemplo: Minuto Labs"
                onBlur={() => {
                  setTouchedFields((current) => ({
                    ...current,
                    [CREATE_FIELD.NAME]: true,
                  }));
                  setFocusedField((current) =>
                    current === CREATE_FIELD.NAME ? null : current,
                  );
                }}
                onFocus={() => setFocusedField(CREATE_FIELD.NAME)}
                containerStyle={styles.input}
                errorMessage={
                  focusedField !== CREATE_FIELD.NAME &&
                  (touchedFields[CREATE_FIELD.NAME] ||
                    fieldErrors[CREATE_FIELD.NAME])
                    ? validationFieldErrors[CREATE_FIELD.NAME] ||
                      fieldErrors[CREATE_FIELD.NAME]
                    : undefined
                }
              />

              <GlassCard
                style={[
                  styles.optionalSection,
                  {
                    backgroundColor: theme.surface.glass.soft,
                    borderColor: theme.surface.glass.border,
                  },
                ]}
                variant="soft"
              >
                <ThemedText
                  selectable
                  style={styles.sectionTitle}
                  variant="label"
                >
                  Oficina física (opcional)
                </ThemedText>
                <ThemedText
                  colorToken="secondary"
                  selectable
                  style={styles.sectionText}
                  variant="bodySmall"
                >
                  Si completás esta sección, guardamos una dirección elegida.
                </ThemedText>

                {isPhysicalOfficeEnabled ? (
                  <>
                    <TextField
                      label="Nombre de la oficina"
                      maxLength={120}
                      value={officeName}
                      onChangeText={(value) => {
                        setOfficeName(value);
                        setFieldErrors((currentErrors) => ({
                          ...currentErrors,
                          [CREATE_FIELD.OFFICE_NAME]: undefined,
                        }));
                      }}
                      placeholder="Ejemplo: Casa matriz"
                      onBlur={() => {
                        setTouchedFields((current) => ({
                          ...current,
                          [CREATE_FIELD.OFFICE_NAME]: true,
                        }));
                        setFocusedField((current) =>
                          current === CREATE_FIELD.OFFICE_NAME ? null : current,
                        );
                      }}
                      onFocus={() => setFocusedField(CREATE_FIELD.OFFICE_NAME)}
                      containerStyle={styles.input}
                      errorMessage={
                        focusedField !== CREATE_FIELD.OFFICE_NAME &&
                        (touchedFields[CREATE_FIELD.OFFICE_NAME] ||
                          fieldErrors[CREATE_FIELD.OFFICE_NAME])
                          ? officeFieldErrors[CREATE_FIELD.OFFICE_NAME] ||
                            validationFieldErrors[CREATE_FIELD.OFFICE_NAME] ||
                            fieldErrors[CREATE_FIELD.OFFICE_NAME]
                          : undefined
                      }
                    />

                    <OfficeLocationSearch
                      selectedLocation={selectedOfficeLocation}
                      onSelectionChange={(value) => {
                        setSelectedOfficeLocation(value);
                        setFieldErrors((currentErrors) => ({
                          ...currentErrors,
                          [CREATE_FIELD.OFFICE_LOCATION]: undefined,
                        }));
                      }}
                      onTouched={() => {
                        setTouchedFields((current) => ({
                          ...current,
                          [CREATE_FIELD.OFFICE_LOCATION]: true,
                        }));
                      }}
                      validationMessage={
                        touchedFields[CREATE_FIELD.OFFICE_LOCATION] ||
                        fieldErrors[CREATE_FIELD.OFFICE_LOCATION]
                          ? officeFieldErrors[CREATE_FIELD.OFFICE_LOCATION] ||
                            fieldErrors[CREATE_FIELD.OFFICE_LOCATION]
                          : undefined
                      }
                    />

                    <SecondaryButton
                      fullWidth={false}
                      label="No agregar oficina física"
                      onPress={resetPhysicalOfficeFields}
                      style={styles.secondaryInlineButton}
                    />
                  </>
                ) : (
                  <SecondaryButton
                    fullWidth={false}
                    label="Agregar oficina física ahora"
                    onPress={() => setIsPhysicalOfficeEnabled(true)}
                    style={styles.secondaryInlineButton}
                  />
                )}
              </GlassCard>

              <PrimaryButton
                label="Crear organización"
                loading={isSubmitting}
                onPress={handleCreateOrganization}
                disabled={isSubmitting || !isCreateFormValid}
                style={styles.primaryButton}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <TextField
                autoCapitalize="none"
                label="Código o link de invitación"
                maxLength={500}
                value={inviteCodeOrLink}
                onChangeText={setInviteCodeOrLink}
                placeholder="Pega el código o link"
                containerStyle={styles.input}
              />
              <PrimaryButton
                label="Unirme"
                loading={isSubmitting}
                onPress={handleJoinOrganization}
                disabled={isSubmitting}
                style={styles.primaryButton}
              />
            </View>
          )}

          {setupErrorMessage ? (
            <ThemedText
              colorToken="error"
              selectable
              style={styles.errorText}
              variant="caption"
            >
              {setupErrorMessage}
            </ThemedText>
          ) : null}

          {hasOrganizations ? (
            <SecondaryButton
              label="Volver a mis organizaciones"
              onPress={closeOrganizationSetup}
              style={styles.secondaryButton}
            />
          ) : null}
        </GlassCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 24,
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    // TODO: Move to inline style with theme.typography.heading.fontFamily
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  tabContainer: {
    borderWidth: 1,
    borderRadius: 999,
    padding: 2,
    flexDirection: 'row',
    gap: 2,
  },
  tabButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 4,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  form: {
    gap: 4,
  },
  helperCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 8,
    gap: 2,
  },
  helperTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    gap: 0,
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  optionalSection: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 8,
    gap: 4,
  },
  secondaryInlineButton: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 42,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
});
