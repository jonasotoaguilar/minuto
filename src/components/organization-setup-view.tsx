import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Fonts, Spacing } from '@/constants/theme';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';
import {
  createOrganizationInputSchema,
  getDefaultTimezone,
} from '@/lib/organization-validation';

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

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationLocation, setOrganizationLocation] = useState('');
  const [organizationTimezone, setOrganizationTimezone] = useState(
    getDefaultTimezone(),
  );
  const [inviteCodeOrLink, setInviteCodeOrLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<'name' | 'location' | 'timezone', string>>
  >({});

  const hasOrganizations = organizations.length > 0;
  const createValidationResult = createOrganizationInputSchema.safeParse({
    name: organizationName,
    location: organizationLocation,
    timezone: organizationTimezone,
  });
  const isCreateFormValid = createValidationResult.success;

  const handleCreateOrganization = async () => {
    if (isSubmitting) return;
    setSetupErrorMessage('');

    const validationResult = createOrganizationInputSchema.safeParse({
      name: organizationName,
      location: organizationLocation,
      timezone: organizationTimezone,
    });

    if (!validationResult.success) {
      const nextFieldErrors = z.flattenError(
        validationResult.error,
      ).fieldErrors;
      setFieldErrors({
        name: nextFieldErrors.name?.[0],
        location: nextFieldErrors.location?.[0],
        timezone: nextFieldErrors.timezone?.[0],
      });
      return;
    }

    setFieldErrors({});

    try {
      setIsSubmitting(true);
      await createOrganization(validationResult.data);
      setOrganizationName('');
      setOrganizationLocation('');
      setOrganizationTimezone(getDefaultTimezone());
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
    if (isSubmitting) return;
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
        style={[styles.page, { backgroundColor: theme.background }]}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.text }]}>
            Organización requerida
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Para continuar, crea una organización o únete con un código/link de
            invitación.
          </Text>

          <View
            style={[
              styles.tabContainer,
              {
                borderColor: theme.border,
                backgroundColor: theme.surfaceMuted,
              },
            ]}
          >
            <Pressable
              onPress={() => setMode('create')}
              style={[
                styles.tabButton,
                mode === 'create'
                  ? { backgroundColor: theme.backgroundElement }
                  : null,
              ]}
            >
              <Text style={[styles.tabText, { color: theme.text }]}>Crear</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('join')}
              style={[
                styles.tabButton,
                mode === 'join'
                  ? { backgroundColor: theme.backgroundElement }
                  : null,
              ]}
            >
              <Text style={[styles.tabText, { color: theme.text }]}>
                Unirme
              </Text>
            </Pressable>
          </View>

          {mode === 'create' ? (
            <View style={styles.form}>
              <Text style={[styles.label, { color: theme.text }]}>
                Nombre de la organización
              </Text>
              <TextInput
                value={organizationName}
                onChangeText={(value) => {
                  setOrganizationName(value);
                  setFieldErrors((currentErrors) => ({
                    ...currentErrors,
                    name: undefined,
                  }));
                }}
                placeholder="Ejemplo: Minuto Labs"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    borderColor: theme.border,
                    color: theme.text,
                    backgroundColor: theme.background,
                  },
                ]}
              />
              {fieldErrors.name ? (
                <Text style={[styles.fieldErrorText, { color: theme.error }]}>
                  {fieldErrors.name}
                </Text>
              ) : null}

              <Text style={[styles.label, { color: theme.text }]}>
                Ubicación de la organización
              </Text>
              <TextInput
                value={organizationLocation}
                onChangeText={(value) => {
                  setOrganizationLocation(value);
                  setFieldErrors((currentErrors) => ({
                    ...currentErrors,
                    location: undefined,
                  }));
                }}
                placeholder="Ejemplo: Santiago, Chile"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    borderColor: theme.border,
                    color: theme.text,
                    backgroundColor: theme.background,
                  },
                ]}
              />
              {fieldErrors.location ? (
                <Text style={[styles.fieldErrorText, { color: theme.error }]}>
                  {fieldErrors.location}
                </Text>
              ) : null}

              <Text style={[styles.label, { color: theme.text }]}>
                Zona horaria (IANA)
              </Text>
              <TextInput
                value={organizationTimezone}
                onChangeText={(value) => {
                  setOrganizationTimezone(value);
                  setFieldErrors((currentErrors) => ({
                    ...currentErrors,
                    timezone: undefined,
                  }));
                }}
                placeholder="Ejemplo: America/Santiago"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    borderColor: theme.border,
                    color: theme.text,
                    backgroundColor: theme.background,
                  },
                ]}
                autoCapitalize="none"
              />
              {fieldErrors.timezone ? (
                <Text style={[styles.fieldErrorText, { color: theme.error }]}>
                  {fieldErrors.timezone}
                </Text>
              ) : null}

              <Pressable
                onPress={handleCreateOrganization}
                disabled={isSubmitting || !isCreateFormValid}
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: theme.primary,
                    opacity: isSubmitting || !isCreateFormValid ? 0.7 : 1,
                  },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Crear organización
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={[styles.label, { color: theme.text }]}>
                Código o link de invitación
              </Text>
              <TextInput
                value={inviteCodeOrLink}
                onChangeText={setInviteCodeOrLink}
                placeholder="Pega el código o link"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    borderColor: theme.border,
                    color: theme.text,
                    backgroundColor: theme.background,
                  },
                ]}
                autoCapitalize="none"
              />
              <Pressable
                onPress={handleJoinOrganization}
                disabled={isSubmitting}
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: theme.primary,
                    opacity: isSubmitting ? 0.7 : 1,
                  },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Unirme</Text>
                )}
              </Pressable>
            </View>
          )}

          {setupErrorMessage ? (
            <Text style={[styles.errorText, { color: theme.error }]}>
              {setupErrorMessage}
            </Text>
          ) : null}

          {hasOrganizations ? (
            <Pressable
              onPress={closeOrganizationSetup}
              style={[styles.secondaryButton, { borderColor: theme.border }]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                Volver a mis organizaciones
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  container: {
    paddingHorizontal: Spacing.three,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  tabContainer: {
    borderWidth: 1,
    borderRadius: 999,
    padding: Spacing.half,
    flexDirection: 'row',
    gap: Spacing.half,
  },
  tabButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: Spacing.one,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  form: {
    gap: Spacing.one,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  primaryButton: {
    marginTop: Spacing.one,
    borderRadius: 999,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldErrorText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -2,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
