import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { z } from 'zod';

import { PhoneCountryDropdown } from '@/components/phone-country-dropdown';
import { SecondaryScreenHeader } from '@/components/secondary-screen-header';
import { useTheme } from '@/hooks/use-theme';
import {
  formatNationalPhone,
  getPhoneCountry,
  PHONE_COUNTRIES,
  type PhoneCountryCode,
  parseE164Phone,
  toE164Phone,
  validateNationalPhone,
} from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import {
  GlassCard,
  PrimaryButton,
  Screen,
  SectionHeader,
  TextField,
  ThemedText,
} from '@/theme/primitives';

const MAX_NAME_LENGTH = 80;
const MAX_ADDRESS_LENGTH = 160;
const PHONE_COUNTRY_CODES = PHONE_COUNTRIES.map((country) => country.code) as [
  PhoneCountryCode,
  ...PhoneCountryCode[],
];

type ProfileFormValues = {
  fullName: string;
  roleLabel: string;
  address: string;
  phoneCountry: PhoneCountryCode;
  phone: string;
  email: string;
};

const initialFormValues: ProfileFormValues = {
  fullName: '',
  roleLabel: 'Sin rol',
  address: '',
  phoneCountry: 'CL',
  phone: '',
  email: '',
};

function getMetadataPhone(user: {
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadataPhone = user.user_metadata?.phone;
  return typeof metadataPhone === 'string' ? metadataPhone : '';
}

const profileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, 'El nombre debe tener al menos 3 caracteres.')
      .max(
        MAX_NAME_LENGTH,
        `El nombre no puede superar ${MAX_NAME_LENGTH} caracteres.`,
      ),
    address: z
      .string()
      .trim()
      .min(6, 'La dirección debe tener al menos 6 caracteres.')
      .max(
        MAX_ADDRESS_LENGTH,
        `La dirección no puede superar ${MAX_ADDRESS_LENGTH} caracteres.`,
      ),
    phoneCountry: z.enum(PHONE_COUNTRY_CODES),
    phone: z.string().trim().min(1, 'Ingresa tu número de teléfono.'),
  })
  .superRefine((data, context) => {
    if (!validateNationalPhone(data.phoneCountry, data.phone)) {
      const country = getPhoneCountry(data.phoneCountry);
      context.addIssue({
        code: 'custom',
        path: ['phone'],
        message: `Ingresa un número válido para ${country.name}.`,
      });
    }
  });

export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [formValues, setFormValues] =
    useState<ProfileFormValues>(initialFormValues);
  const [savedValues, setSavedValues] =
    useState<ProfileFormValues>(initialFormValues);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const normalizedValues = useMemo(
    () => ({
      fullName: formValues.fullName,
      address: formValues.address,
      phoneCountry: formValues.phoneCountry,
      phone: formatNationalPhone(formValues.phoneCountry, formValues.phone)
        .digits,
    }),
    [formValues],
  );

  const validationResult = useMemo(
    () => profileSchema.safeParse(normalizedValues),
    [normalizedValues],
  );

  const validationErrors = useMemo(() => {
    if (validationResult.success) {
      return {} as Record<string, string | undefined>;
    }

    const flattened = z.flattenError(validationResult.error);
    return {
      fullName: flattened.fieldErrors.fullName?.[0],
      address: flattened.fieldErrors.address?.[0],
      phone: flattened.fieldErrors.phone?.[0],
    };
  }, [validationResult]);

  const isFormDirty = useMemo(
    () =>
      formValues.fullName.trim() !== savedValues.fullName.trim() ||
      formValues.address.trim() !== savedValues.address.trim() ||
      formValues.phoneCountry !== savedValues.phoneCountry ||
      formatNationalPhone(formValues.phoneCountry, formValues.phone).digits !==
        formatNationalPhone(savedValues.phoneCountry, savedValues.phone).digits,
    [formValues, savedValues],
  );

  const loadProfile = useCallback(async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      setErrorMessage('No pudimos cargar tu perfil. Iniciá sesión nuevamente.');
      setIsLoading(false);
      return;
    }

    const user = data.user;
    const authPhone =
      typeof user.phone === 'string' && user.phone.trim().length > 0
        ? user.phone
        : getMetadataPhone(user);
    const parsedPhone = parseE164Phone(authPhone);

    const nextValues: ProfileFormValues = {
      fullName:
        typeof user.user_metadata.display_name === 'string'
          ? user.user_metadata.display_name
          : '',
      roleLabel:
        typeof user.user_metadata.position === 'string' &&
        user.user_metadata.position.trim().length > 0
          ? user.user_metadata.position
          : 'Sin rol',
      address:
        typeof user.user_metadata.address === 'string'
          ? user.user_metadata.address
          : '',
      phoneCountry: parsedPhone.countryCode,
      phone: formatNationalPhone(
        parsedPhone.countryCode,
        parsedPhone.nationalDigits,
      ).formatted,
      email: user.email ?? '',
    };

    setFormValues(nextValues);
    setSavedValues(nextValues);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleChange = (field: keyof ProfileFormValues, value: string) => {
    if (field === 'phone') {
      setFormValues((current) => ({
        ...current,
        phone: formatNationalPhone(current.phoneCountry, value).formatted,
      }));
    } else if (field === 'phoneCountry') {
      const nextCountry = value as PhoneCountryCode;
      setFormValues((current) => ({
        ...current,
        phoneCountry: nextCountry,
        phone: formatNationalPhone(nextCountry, current.phone).formatted,
      }));
    } else {
      setFormValues((current) => ({ ...current, [field]: value }));
    }

    if (errorMessage) setErrorMessage('');
    if (successMessage) setSuccessMessage('');
  };

  const handleSaveProfile = async () => {
    if (isSaving || isLoading) return;

    if (!isFormDirty) {
      setSuccessMessage('No hay cambios para guardar.');
      return;
    }

    if (!validationResult.success) {
      setErrorMessage('Revisá los campos marcados y corregilos.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const nextData = validationResult.data;
      const nextPhone = toE164Phone(nextData.phoneCountry, nextData.phone);

      const metadataPayload = {
        display_name: nextData.fullName,
        address: nextData.address,
        position: formValues.roleLabel,
        phone: nextPhone,
      };

      const { error: metadataError } = await supabase.auth.updateUser({
        data: metadataPayload,
      });

      if (metadataError) {
        setErrorMessage(
          `No se pudieron guardar los cambios del perfil (${metadataError.message}).`,
        );
        return;
      }

      const nextSavedValues = {
        ...formValues,
        phoneCountry: nextData.phoneCountry,
        phone: formatNationalPhone(nextData.phoneCountry, nextData.phone)
          .formatted,
      };

      setFormValues(nextSavedValues);
      setSavedValues(nextSavedValues);
      setSuccessMessage('Perfil actualizado correctamente.');
    } catch {
      setErrorMessage('Error inesperado al actualizar el perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen
      keyboardAvoiding
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
        title="Modificar perfil"
        subtitle="Actualizá tu información personal."
        onBack={() => router.back()}
      />

      <GlassCard style={styles.formCard}>
        <SectionHeader
          eyebrow="Modificar perfil"
          subtitle="Tus datos quedan sincronizados con la cuenta actual."
          title="Información principal"
        />

        <TextField
          autoCapitalize="words"
          editable={!isLoading}
          errorMessage={validationErrors.fullName}
          label="Nombre completo"
          maxLength={MAX_NAME_LENGTH}
          onChangeText={(value) => handleChange('fullName', value)}
          placeholder="Nombre y apellido"
          value={formValues.fullName}
        />

        <TextField
          autoCapitalize="sentences"
          editable={!isLoading}
          errorMessage={validationErrors.address}
          label="Dirección"
          maxLength={MAX_ADDRESS_LENGTH}
          onChangeText={(value) => handleChange('address', value)}
          placeholder="Calle, comuna y referencia"
          value={formValues.address}
        />

        <ReadonlyField
          helperText="Se sincroniza con tu cuenta y no se edita acá."
          label="Correo electrónico"
          value={formValues.email || 'Sin correo registrado'}
        />

        <PhoneField
          countryCode={formValues.phoneCountry}
          disabled={isLoading}
          errorMessage={validationErrors.phone}
          nationalNumber={formValues.phone}
          onChangeCountry={(countryCode) =>
            handleChange('phoneCountry', countryCode)
          }
          onChangeNationalNumber={(value) => handleChange('phone', value)}
        />

        {errorMessage ? (
          <StatusMessage tone="error">{errorMessage}</StatusMessage>
        ) : null}

        {successMessage ? (
          <StatusMessage tone="success">{successMessage}</StatusMessage>
        ) : null}
      </GlassCard>

      <PrimaryButton
        disabled={isLoading || !isFormDirty}
        label={isSaving ? 'Guardando…' : 'Guardar cambios'}
        loading={isSaving}
        onPress={handleSaveProfile}
      />
    </Screen>
  );
}

function ReadonlyField({
  helperText,
  label,
  value,
}: {
  helperText?: string;
  label: string;
  value: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.fieldGroup}>
      <ThemedText variant="label">{label}</ThemedText>
      <View
        style={[
          styles.readonlyShell,
          {
            backgroundColor: theme.surface.glass.soft,
            borderColor: theme.surface.glass.border,
            borderRadius: theme.radius.xl,
          },
        ]}
      >
        <ThemedText variant="body">{value}</ThemedText>
        {helperText ? (
          <ThemedText colorToken="secondary" variant="caption">
            {helperText}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

function PhoneField({
  countryCode,
  disabled,
  errorMessage,
  nationalNumber,
  onChangeCountry,
  onChangeNationalNumber,
}: {
  countryCode: PhoneCountryCode;
  disabled: boolean;
  errorMessage?: string;
  nationalNumber: string;
  onChangeCountry: (countryCode: PhoneCountryCode) => void;
  onChangeNationalNumber: (value: string) => void;
}) {
  const theme = useTheme();
  const selectedCountry = getPhoneCountry(countryCode);

  return (
    <View style={styles.fieldGroup}>
      <ThemedText variant="label">Número de teléfono</ThemedText>

      <View
        style={[
          styles.phoneShell,
          {
            backgroundColor: theme.surface.glass.soft,
            borderColor: errorMessage
              ? theme.colors.status.error
              : theme.surface.glass.border,
            borderRadius: theme.radius.xl,
          },
        ]}
      >
        <PhoneCountryDropdown
          countryCode={countryCode}
          disabled={disabled}
          minWidth={116}
          onChangeCountry={onChangeCountry}
        />

        <View
          style={[
            styles.phoneDivider,
            { backgroundColor: theme.surface.glass.border },
          ]}
        />

        <TextInput
          editable={!disabled}
          keyboardType="phone-pad"
          onChangeText={onChangeNationalNumber}
          placeholder={selectedCountry.pattern.replaceAll('X', '0')}
          placeholderTextColor={theme.colors.text.muted}
          selectionColor={theme.colors.brand.primary}
          style={[
            styles.phoneInput,
            theme.typography.body,
            { color: theme.colors.text.primary },
          ]}
          value={nationalNumber}
        />
      </View>

      {errorMessage ? (
        <ThemedText colorToken="error" variant="caption">
          {errorMessage}
        </ThemedText>
      ) : null}
    </View>
  );
}

function StatusMessage({
  children,
  tone,
}: {
  children: string;
  tone: 'error' | 'success';
}) {
  const theme = useTheme();
  const isError = tone === 'error';

  return (
    <View
      style={[
        styles.messageCard,
        {
          backgroundColor: isError
            ? theme.surface.danger
            : theme.colors.brand.muted,
          borderColor: isError
            ? theme.surface.glass.border
            : theme.colors.border.default,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <ThemedText
        colorToken={isError ? 'error' : 'primary'}
        variant="bodySmall"
      >
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 16,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  formCard: {
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  readonlyShell: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  phoneShell: {
    borderWidth: 1,
    minHeight: 56,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 12,
  },
  phoneInput: {
    flex: 1,
  },
  messageCard: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
