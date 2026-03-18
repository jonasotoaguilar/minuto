import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { z } from 'zod';

import { PhoneCountryDropdown } from '@/components/phone-country-dropdown';
import { Fonts, Spacing } from '@/constants/theme';
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

function mapAuthUpdatePhoneError(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('phone provider is disabled') ||
    normalized.includes('sms provider is disabled') ||
    normalized.includes('unsupported phone provider')
  ) {
    return 'Supabase no permite actualizar auth.users.phone porque el proveedor SMS/Phone está deshabilitado.';
  }

  return `No se pudo actualizar auth.users.phone (${message}).`;
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
  const insets = useSafeAreaInsets();
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
      const currentPhone = toE164Phone(
        savedValues.phoneCountry,
        savedValues.phone,
      );
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

      let phoneWarningMessage = '';
      if (currentPhone !== nextPhone) {
        const { error: phoneError } = await supabase.auth.updateUser({
          phone: nextPhone,
        });

        if (phoneError) {
          phoneWarningMessage = mapAuthUpdatePhoneError(phoneError.message);
        }
      }

      const nextSavedValues = {
        ...formValues,
        phoneCountry: nextData.phoneCountry,
        phone: formatNationalPhone(nextData.phoneCountry, nextData.phone)
          .formatted,
      };

      setFormValues(nextSavedValues);
      setSavedValues(nextSavedValues);
      setSuccessMessage(
        phoneWarningMessage
          ? `Perfil actualizado. ${phoneWarningMessage}`
          : 'Perfil actualizado correctamente.',
      );
    } catch {
      setErrorMessage('Error inesperado al actualizar el perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const initials = deriveInitials(formValues.fullName);

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: insets.top + Spacing.two,
              paddingBottom: insets.bottom + Spacing.five,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={[styles.backButtonText, { color: theme.text }]}>
                ←
              </Text>
            </Pressable>
            <Text style={[styles.brandText, { color: theme.primary }]}>
              Minuto
            </Text>
            <View
              style={[
                styles.avatarShell,
                {
                  borderColor: theme.primary,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
            >
              <Text style={[styles.avatarText, { color: theme.textSecondary }]}>
                {initials}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>
            Modificar Perfil
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Actualiza tu información personal
          </Text>

          <View style={styles.heroWrap}>
            <View style={[styles.heroAvatar, { backgroundColor: '#D7B689' }]}>
              <Text style={styles.heroAvatarText}>{initials}</Text>
            </View>
            <View
              style={[styles.heroBadge, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.heroBadgeText}>✎</Text>
            </View>
          </View>

          <View
            style={[
              styles.formCard,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <Label text="Nombre completo" />
            <InputRow
              icon="👤"
              value={formValues.fullName}
              onChangeText={(value) => handleChange('fullName', value)}
              placeholder="Nombre y apellido"
              theme={theme}
              maxLength={MAX_NAME_LENGTH}
            />

            <Label text="Correo electrónico" />
            <ReadonlyRow icon="✉" value={formValues.email} theme={theme} />

            <Label text="Número de teléfono" />
            <PhoneRow
              countryCode={formValues.phoneCountry}
              nationalNumber={formValues.phone}
              onChangeCountry={(countryCode) =>
                handleChange('phoneCountry', countryCode)
              }
              onChangeNationalNumber={(value) => handleChange('phone', value)}
              theme={theme}
            />

            {validationErrors.fullName ||
            validationErrors.phone ||
            errorMessage ? (
              <Text style={[styles.errorText, { color: theme.error }]}>
                {validationErrors.fullName ||
                  validationErrors.phone ||
                  errorMessage}
              </Text>
            ) : null}

            {successMessage ? (
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                {successMessage}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={handleSaveProfile}
            disabled={isSaving || isLoading || !isFormDirty}
            style={[
              styles.primaryButton,
              {
                backgroundColor: theme.primary,
                opacity: isSaving || isLoading || !isFormDirty ? 0.7 : 1,
              },
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.cancelButton}>
            <Text
              style={[styles.cancelButtonText, { color: theme.textSecondary }]}
            >
              Cancelar
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text.toUpperCase()}</Text>;
}

function InputRow({
  icon,
  value,
  onChangeText,
  placeholder,
  theme,
  maxLength,
}: {
  icon: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  theme: ReturnType<typeof useTheme>;
  maxLength?: number;
}) {
  return (
    <View style={[styles.rowShell, { backgroundColor: theme.surfaceMuted }]}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={[styles.rowInput, { color: theme.text }]}
        maxLength={maxLength}
      />
    </View>
  );
}

function ReadonlyRow({
  icon,
  value,
  theme,
}: {
  icon: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.rowShell, { backgroundColor: theme.surfaceMuted }]}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.readonlyText, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function PhoneRow({
  countryCode,
  nationalNumber,
  onChangeCountry,
  onChangeNationalNumber,
  theme,
}: {
  countryCode: PhoneCountryCode;
  nationalNumber: string;
  onChangeCountry: (countryCode: PhoneCountryCode) => void;
  onChangeNationalNumber: (value: string) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const selectedCountry = getPhoneCountry(countryCode);

  return (
    <View style={[styles.rowShell, { backgroundColor: theme.surfaceMuted }]}>
      <Text style={styles.rowIcon}>📞</Text>
      <PhoneCountryDropdown
        countryCode={countryCode}
        onChangeCountry={onChangeCountry}
        theme={theme}
        minWidth={116}
      />
      <View style={[styles.phoneDivider, { backgroundColor: theme.border }]} />
      <TextInput
        value={nationalNumber}
        onChangeText={onChangeNationalNumber}
        placeholder={selectedCountry.pattern.replaceAll('X', '0')}
        placeholderTextColor={theme.textSecondary}
        style={[styles.rowInput, { color: theme.text }]}
        keyboardType="phone-pad"
      />
    </View>
  );
}

function deriveInitials(fullName: string) {
  const normalizedName = fullName.trim();
  if (!normalizedName) return 'MP';

  const tokens = normalizedName.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase();
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  keyboardWrapper: {
    flex: 1,
  },
  container: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingBottom: Spacing.two,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 26,
    fontWeight: '500',
  },
  brandText: {
    fontSize: 42,
    lineHeight: 46,
    fontFamily: Fonts.serif,
    fontWeight: '700',
  },
  avatarShell: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 64,
    lineHeight: 68,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: Spacing.one,
    marginBottom: Spacing.one,
  },
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.two,
  },
  heroAvatar: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  heroAvatarText: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  heroBadge: {
    position: 'absolute',
    right: '31%',
    bottom: 8,
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  formCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  label: {
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: '700',
    color: '#1E6D4D',
  },
  rowShell: {
    borderRadius: 16,
    minHeight: 56,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  rowIcon: {
    fontSize: 20,
  },
  rowInput: {
    flex: 1,
    fontSize: 18,
    paddingVertical: Spacing.one,
  },
  readonlyText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
  },
  phoneDivider: {
    width: 1,
    height: 22,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 13,
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    shadowColor: '#11B981',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontFamily: Fonts.serif,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.one,
  },
  cancelButtonText: {
    fontSize: 20,
    fontWeight: '700',
  },
});
