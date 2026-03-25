import { type Href, Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { PhoneCountryDropdown } from '@/components/phone-country-dropdown';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  formatNationalPhone,
  getPhoneCountry,
  PHONE_COUNTRIES,
  type PhoneCountryCode,
  toE164Phone,
  validateNationalPhone,
} from '@/lib/phone';
import { supabase } from '@/lib/supabase';

const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 160;
const MAX_PASSWORD_LENGTH = 72;
const PHONE_COUNTRY_CODES = PHONE_COUNTRIES.map((country) => country.code) as [
  PhoneCountryCode,
  ...PhoneCountryCode[],
];

const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, 'El nombre debe tener al menos 3 caracteres.')
      .max(
        MAX_NAME_LENGTH,
        `El nombre no puede superar ${MAX_NAME_LENGTH} caracteres.`,
      ),
    email: z
      .string()
      .trim()
      .email('Ingresa un email válido.')
      .max(
        MAX_EMAIL_LENGTH,
        `El email no puede superar ${MAX_EMAIL_LENGTH} caracteres.`,
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
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres.')
      .max(
        MAX_PASSWORD_LENGTH,
        `La contraseña no puede superar ${MAX_PASSWORD_LENGTH} caracteres.`,
      ),
    confirmPassword: z
      .string()
      .max(
        MAX_PASSWORD_LENGTH,
        `La contraseña no puede superar ${MAX_PASSWORD_LENGTH} caracteres.`,
      ),
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
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  });

type RegisterFormValues = z.infer<typeof registerSchema>;
type RegisterFieldErrors = Partial<Record<keyof RegisterFormValues, string>>;
type TouchedFields = Partial<Record<keyof RegisterFormValues, boolean>>;
type AvailabilityState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'error';
type FieldAvailability = {
  state: AvailabilityState;
  checkedValue: string;
  message: string;
};

const initialFormValues: RegisterFormValues = {
  fullName: '',
  email: '',
  address: '',
  phoneCountry: 'CL',
  phone: '',
  password: '',
  confirmPassword: '',
};

export default function RegisterScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [formValues, setFormValues] =
    useState<RegisterFormValues>(initialFormValues);
  const [availabilityErrors, setAvailabilityErrors] =
    useState<RegisterFieldErrors>({});
  const [touchedFields, setTouchedFields] = useState<TouchedFields>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailAvailability, setEmailAvailability] = useState<FieldAvailability>(
    {
      state: 'idle',
      checkedValue: '',
      message: '',
    },
  );
  const [focusedField, setFocusedField] = useState<
    keyof RegisterFormValues | null
  >(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);
  const isSubmittingRef = useRef(false);
  const lastSubmitAtRef = useRef(0);
  const emailCheckRequestIdRef = useRef(0);

  const normalizedValues = useMemo(
    () => ({
      fullName: formValues.fullName,
      email: formValues.email.trim().toLowerCase(),
      address: formValues.address,
      phoneCountry: formValues.phoneCountry,
      phone: formatNationalPhone(formValues.phoneCountry, formValues.phone)
        .digits,
      password: formValues.password,
      confirmPassword: formValues.confirmPassword,
    }),
    [formValues],
  );

  const validationResult = useMemo(
    () => registerSchema.safeParse(normalizedValues),
    [normalizedValues],
  );

  const validationFieldErrors = useMemo<RegisterFieldErrors>(() => {
    if (validationResult.success) {
      return {};
    }

    const flattenedError = z.flattenError(validationResult.error);
    const nextFieldErrors: RegisterFieldErrors = {};

    Object.entries(flattenedError.fieldErrors).forEach(([field, errors]) => {
      if (!errors?.length) {
        return;
      }
      const fieldKey = field as keyof RegisterFormValues;
      nextFieldErrors[fieldKey] = errors[0];
    });

    return nextFieldErrors;
  }, [validationResult]);

  const isFormComplete = useMemo(
    () =>
      Boolean(
        normalizedValues.fullName.trim() &&
          normalizedValues.email &&
          normalizedValues.address.trim() &&
          normalizedValues.phone &&
          normalizedValues.password &&
          normalizedValues.confirmPassword,
      ),
    [normalizedValues],
  );

  const isEmailAvailable =
    Boolean(normalizedValues.email) &&
    !validationFieldErrors.email &&
    emailAvailability.state === 'available' &&
    emailAvailability.checkedValue === normalizedValues.email;

  const isSubmitDisabled =
    !isFormComplete ||
    !validationResult.success ||
    Boolean(availabilityErrors.email) ||
    !isEmailAvailable ||
    isSubmitting;

  useEffect(() => {
    if (!infoMessage) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      router.replace('/login' as Href);
    }, 1600);

    return () => clearTimeout(timeoutId);
  }, [infoMessage, router]);

  const setFieldValue = (field: keyof RegisterFormValues, value: string) => {
    if (field === 'phone') {
      setFormValues((current) => ({
        ...current,
        phone: formatNationalPhone(current.phoneCountry, value).formatted,
      }));
      return;
    }

    if (field === 'phoneCountry') {
      const nextCountry = value as PhoneCountryCode;
      setFormValues((current) => ({
        ...current,
        phoneCountry: nextCountry,
        phone: formatNationalPhone(nextCountry, current.phone).formatted,
      }));
      return;
    }

    setFormValues((current) => ({ ...current, [field]: value }));
    if (availabilityErrors[field]) {
      setAvailabilityErrors((current) => ({ ...current, [field]: undefined }));
    }
    if (field === 'email') {
      const normalizedEmail = value.trim().toLowerCase();
      setEmailAvailability((current) =>
        current.checkedValue === normalizedEmail
          ? current
          : {
              state: 'idle',
              checkedValue: '',
              message: '',
            },
      );
    }
  };

  const setTouched = (field: keyof RegisterFormValues) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  };

  const checkAvailability = useCallback(async () => {
    const targetValue = normalizedValues.email;
    const requestId = ++emailCheckRequestIdRef.current;

    if (
      validationFieldErrors.email ||
      !normalizedValues.email ||
      emailAvailability.checkedValue === normalizedValues.email
    ) {
      return;
    }
    setEmailAvailability({
      state: 'checking',
      checkedValue: normalizedValues.email,
      message: 'Validando email...',
    });

    setErrorMessage('');

    try {
      const { data, error } = await supabase.rpc(
        'check_registration_availability',
        {
          p_email: normalizedValues.email,
        },
      );

      if (requestId !== emailCheckRequestIdRef.current) {
        return;
      }

      if (error) {
        setAvailabilityErrors((current) => ({
          ...current,
          email: 'No se pudo validar este campo. Intentá de nuevo.',
        }));
        setEmailAvailability({
          state: 'error',
          checkedValue: targetValue,
          message: 'No se pudo validar email.',
        });
        return;
      }

      const firstResult = Array.isArray(data) ? data[0] : data;
      const isAlreadyRegistered = Boolean(firstResult?.email_exists);

      setAvailabilityErrors((current) => ({
        ...current,
        email: isAlreadyRegistered
          ? 'Este email ya está registrado.'
          : undefined,
      }));
      setEmailAvailability({
        state: isAlreadyRegistered ? 'unavailable' : 'available',
        checkedValue: targetValue,
        message: isAlreadyRegistered ? 'Email en uso' : 'Email válido',
      });
    } catch {
      setAvailabilityErrors((current) => ({
        ...current,
        email: 'No se pudo validar este campo. Intentá de nuevo.',
      }));
      setEmailAvailability({
        state: 'error',
        checkedValue: targetValue,
        message: 'No se pudo validar email.',
      });
    }
  }, [
    emailAvailability.checkedValue,
    normalizedValues.email,
    validationFieldErrors.email,
  ]);

  useEffect(() => {
    if (
      !normalizedValues.email ||
      validationFieldErrors.email ||
      emailAvailability.checkedValue === normalizedValues.email
    ) {
      return;
    }
    const timeoutId = setTimeout(() => {
      void checkAvailability();
    }, 650);
    return () => clearTimeout(timeoutId);
  }, [
    checkAvailability,
    emailAvailability.checkedValue,
    normalizedValues.email,
    validationFieldErrors.email,
  ]);

  const getSignupErrorMessage = (message: string) => {
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes('already registered')) {
      return 'Este email ya está registrado. Iniciá sesión o recuperá la contraseña.';
    }

    if (normalizedMessage.includes('password should be at least')) {
      return 'La contraseña no cumple los requisitos mínimos de seguridad.';
    }

    if (normalizedMessage.includes('invalid email')) {
      return 'El email ingresado no es válido.';
    }

    if (normalizedMessage.includes('network')) {
      return 'No se pudo conectar. Revisá tu conexión e intentá de nuevo.';
    }

    return 'No se pudo completar el registro. Probá nuevamente.';
  };

  const handleSignUp = async () => {
    if (isSubmittingRef.current || isSubmitDisabled) return;

    const now = Date.now();
    if (now - lastSubmitAtRef.current < 1500) {
      setErrorMessage('Esperá un momento antes de volver a intentar.');
      return;
    }

    lastSubmitAtRef.current = now;
    isSubmittingRef.current = true;
    setErrorMessage('');
    setInfoMessage('');
    if (!validationResult.success) {
      setTouchedFields({
        fullName: true,
        email: true,
        address: true,
        phone: true,
        password: true,
        confirmPassword: true,
      });
      setErrorMessage('Revisá los campos marcados y corregilos.');
      isSubmittingRef.current = false;
      return;
    }

    const { fullName, email, address, phoneCountry, phone, password } =
      validationResult.data;
    const e164Phone = toE164Phone(phoneCountry, phone);

    try {
      setIsSubmitting(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: fullName,
            address,
            phone: e164Phone,
          },
        },
      });

      if (error) {
        setErrorMessage(getSignupErrorMessage(error.message));
        return;
      }

      const signUpSuccessMessage =
        'Registro exitoso. Te redirigimos al login para iniciar sesión.';

      setFormValues(initialFormValues);
      setTouchedFields({});
      setAvailabilityErrors({});
      setEmailAvailability({
        state: 'idle',
        checkedValue: '',
        message: '',
      });
      setInfoMessage(signUpSuccessMessage);
    } catch (error) {
      const message =
        error instanceof Error
          ? getSignupErrorMessage(error.message)
          : 'Error inesperado al registrarte.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const emailStatusMessage = useMemo(() => {
    if (!normalizedValues.email) {
      return '';
    }
    if (validationFieldErrors.email) {
      return 'Email no válido';
    }
    if (emailAvailability.state === 'idle') {
      return '';
    }
    if (emailAvailability.state === 'checking') {
      return 'Validando email...';
    }
    if (availabilityErrors.email) {
      if (availabilityErrors.email.includes('registrado')) {
        return 'Email en uso';
      }
      return availabilityErrors.email;
    }
    return 'Email válido';
  }, [
    availabilityErrors.email,
    emailAvailability.state,
    normalizedValues.email,
    validationFieldErrors.email,
  ]);

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
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + Spacing.five,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View
              style={[styles.brandIcon, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.brandLetter}>M</Text>
            </View>
            <Text style={[styles.brandText, { color: theme.text }]}>
              Minuto
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundElement,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View style={[styles.cardBanner, { backgroundColor: theme.primary }]}>
            <View
              style={[
                styles.cardShield,
                { backgroundColor: theme.primaryMuted },
              ]}
            >
              <Text style={[styles.cardShieldText, { color: theme.primary }]}>
                OK
              </Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Crea tu cuenta
            </Text>
            <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
              Registra tu acceso a Minuto
            </Text>

            <View style={styles.form}>
              <Field
                label="Nombre completo"
                placeholder="Nombre y apellido"
                theme={theme}
                icon="A"
                value={formValues.fullName}
                onChangeText={(value) => setFieldValue('fullName', value)}
                onFocus={() => setFocusedField('fullName')}
                onBlur={() => {
                  setFocusedField(null);
                  setTouched('fullName');
                }}
                error={
                  touchedFields.fullName ? validationFieldErrors.fullName : ''
                }
                isValid={
                  Boolean(touchedFields.fullName) &&
                  Boolean(formValues.fullName.trim()) &&
                  !validationFieldErrors.fullName
                }
                isDisabled={isSubmitting}
                maxLength={MAX_NAME_LENGTH}
                isFocused={focusedField === 'fullName'}
              />
              <Field
                label="Dirección"
                placeholder="Av. Siempre Viva 123"
                theme={theme}
                icon="D"
                value={formValues.address}
                onChangeText={(value) => setFieldValue('address', value)}
                onFocus={() => setFocusedField('address')}
                onBlur={() => {
                  setFocusedField(null);
                  setTouched('address');
                }}
                error={
                  touchedFields.address ? validationFieldErrors.address : ''
                }
                isValid={
                  Boolean(touchedFields.address) &&
                  Boolean(formValues.address.trim()) &&
                  !validationFieldErrors.address
                }
                isDisabled={isSubmitting}
                maxLength={MAX_ADDRESS_LENGTH}
                isFocused={focusedField === 'address'}
              />
              <Field
                label="Email"
                placeholder="nombre@empresa.com"
                theme={theme}
                icon="@"
                value={formValues.email}
                onChangeText={(value) => setFieldValue('email', value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => {
                  setFocusedField(null);
                  setTouched('email');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                error={
                  touchedFields.email
                    ? availabilityErrors.email || validationFieldErrors.email
                    : ''
                }
                statusMessage={emailStatusMessage}
                statusTone={
                  availabilityErrors.email || validationFieldErrors.email
                    ? 'error'
                    : emailAvailability.state === 'available'
                      ? 'success'
                      : 'neutral'
                }
                isValid={
                  Boolean(touchedFields.email) &&
                  Boolean(formValues.email.trim()) &&
                  !validationFieldErrors.email &&
                  !availabilityErrors.email
                }
                isDisabled={isSubmitting}
                maxLength={MAX_EMAIL_LENGTH}
                isFocused={focusedField === 'email'}
              />
              <PhoneField
                label="Teléfono"
                theme={theme}
                countryCode={formValues.phoneCountry}
                nationalNumber={formValues.phone}
                onChangeCountry={(countryCode) => {
                  setFieldValue('phoneCountry', countryCode);
                  setTouched('phone');
                }}
                onChangeNationalNumber={(value) =>
                  setFieldValue('phone', value)
                }
                onFocus={() => setFocusedField('phone')}
                onBlur={() => {
                  setFocusedField(null);
                  setTouched('phone');
                }}
                error={touchedFields.phone ? validationFieldErrors.phone : ''}
                isValid={
                  Boolean(touchedFields.phone) &&
                  Boolean(formValues.phone.trim()) &&
                  !validationFieldErrors.phone
                }
                isDisabled={isSubmitting}
                isFocused={focusedField === 'phone'}
              />
              <Field
                label="Contraseña"
                placeholder="********"
                theme={theme}
                icon="*"
                secure={!isPasswordVisible}
                value={formValues.password}
                onChangeText={(value) => setFieldValue('password', value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => {
                  setFocusedField(null);
                  setTouched('password');
                }}
                error={
                  touchedFields.password ? validationFieldErrors.password : ''
                }
                isValid={
                  Boolean(touchedFields.password) &&
                  Boolean(formValues.password) &&
                  !validationFieldErrors.password
                }
                actionLabel={isPasswordVisible ? 'Ocultar' : 'Mostrar'}
                onPressAction={() =>
                  setIsPasswordVisible((current) => !current)
                }
                isDisabled={isSubmitting}
                maxLength={MAX_PASSWORD_LENGTH}
                isFocused={focusedField === 'password'}
              />
              <Field
                label="Confirmar contraseña"
                placeholder="********"
                theme={theme}
                icon="*"
                secure={!isConfirmPasswordVisible}
                value={formValues.confirmPassword}
                onChangeText={(value) =>
                  setFieldValue('confirmPassword', value)
                }
                onFocus={() => setFocusedField('confirmPassword')}
                onBlur={() => {
                  setFocusedField(null);
                  setTouched('confirmPassword');
                }}
                error={
                  touchedFields.confirmPassword
                    ? validationFieldErrors.confirmPassword
                    : ''
                }
                isValid={
                  Boolean(touchedFields.confirmPassword) &&
                  Boolean(formValues.confirmPassword) &&
                  !validationFieldErrors.confirmPassword
                }
                actionLabel={isConfirmPasswordVisible ? 'Ocultar' : 'Mostrar'}
                onPressAction={() =>
                  setIsConfirmPasswordVisible((current) => !current)
                }
                isDisabled={isSubmitting}
                maxLength={MAX_PASSWORD_LENGTH}
                isFocused={focusedField === 'confirmPassword'}
              />
            </View>

            <Pressable
              onPress={handleSignUp}
              disabled={isSubmitDisabled}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: theme.primary,
                  opacity: isSubmitDisabled ? 0.7 : 1,
                },
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Registrando...' : 'Crear cuenta →'}
              </Text>
            </Pressable>

            {errorMessage ? (
              <Text style={[styles.errorText, { color: theme.error }]}>
                {errorMessage}
              </Text>
            ) : null}

            {infoMessage ? (
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                {infoMessage}
              </Text>
            ) : null}

            <Text style={[styles.helpText, { color: theme.textSecondary }]}>
              Ya tienes cuenta?{' '}
              <Link
                href="/login"
                style={{ color: theme.primary, fontWeight: '600' }}
              >
                Inicia sesión
              </Link>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = {
  label: string;
  placeholder: string;
  icon: string;
  theme: ReturnType<typeof useTheme>;
  secure?: boolean;
  value?: string;
  onChangeText?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  isValid?: boolean;
  statusMessage?: string;
  statusTone?: 'neutral' | 'success' | 'error';
  actionLabel?: string;
  onPressAction?: () => void;
  isDisabled?: boolean;
  maxLength?: number;
  isFocused?: boolean;
};

function Field({
  label,
  placeholder,
  icon,
  theme,
  secure,
  value,
  onChangeText,
  onFocus,
  onBlur,
  keyboardType,
  autoCapitalize,
  error,
  isValid,
  statusMessage,
  statusTone,
  actionLabel,
  onPressAction,
  isDisabled,
  maxLength,
  isFocused,
}: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
      <View
        style={[
          styles.field,
          {
            borderColor: isFocused
              ? theme.primary
              : error
                ? theme.error
                : isValid
                  ? theme.primary
                  : theme.border,
          },
        ]}
      >
        <Text style={[styles.fieldIcon, { color: theme.primary }]}>{icon}</Text>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          style={[styles.fieldInput, { color: theme.text }]}
          secureTextEntry={secure}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={!isDisabled}
          maxLength={maxLength}
        />
        {actionLabel && onPressAction ? (
          <Pressable onPress={onPressAction} hitSlop={8}>
            <Text style={[styles.fieldActionText, { color: theme.primary }]}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {!isFocused && error ? (
        <Text style={[styles.fieldErrorText, { color: theme.error }]}>
          {error}
        </Text>
      ) : !isFocused && statusMessage ? (
        <Text
          style={[
            styles.fieldStatusText,
            {
              color:
                statusTone === 'error'
                  ? theme.error
                  : statusTone === 'success'
                    ? theme.primary
                    : theme.textSecondary,
            },
          ]}
        >
          {statusMessage}
        </Text>
      ) : null}
    </View>
  );
}

type PhoneFieldProps = {
  label: string;
  theme: ReturnType<typeof useTheme>;
  countryCode: PhoneCountryCode;
  nationalNumber: string;
  onChangeCountry: (countryCode: PhoneCountryCode) => void;
  onChangeNationalNumber: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  error?: string;
  isValid?: boolean;
  isDisabled?: boolean;
  isFocused?: boolean;
};

function PhoneField({
  label,
  theme,
  countryCode,
  nationalNumber,
  onChangeCountry,
  onChangeNationalNumber,
  onFocus,
  onBlur,
  error,
  isValid,
  isDisabled,
  isFocused,
}: PhoneFieldProps) {
  const selectedCountry = getPhoneCountry(countryCode);

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
      <View
        style={[
          styles.phoneField,
          {
            borderColor: isFocused
              ? theme.primary
              : error
                ? theme.error
                : isValid
                  ? theme.primary
                  : theme.border,
          },
        ]}
      >
        <PhoneCountryDropdown
          disabled={isDisabled}
          countryCode={countryCode}
          onChangeCountry={onChangeCountry}
          theme={theme}
          minWidth={116}
        />

        <View
          style={[styles.phoneFieldDivider, { backgroundColor: theme.border }]}
        />

        <TextInput
          placeholder={selectedCountry.pattern.replaceAll('X', '0')}
          placeholderTextColor={theme.textSecondary}
          style={[styles.phoneFieldInput, { color: theme.text }]}
          value={nationalNumber}
          onChangeText={onChangeNationalNumber}
          onFocus={onFocus}
          onBlur={onBlur}
          keyboardType="phone-pad"
          editable={!isDisabled}
        />
      </View>
      {!isFocused && error ? (
        <Text style={[styles.fieldErrorText, { color: theme.error }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  container: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: Fonts.serif,
  },
  card: {
    borderRadius: 28,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardBanner: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardShield: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardShieldText: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    gap: Spacing.two,
  },
  fieldGroup: {
    gap: Spacing.one,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: Spacing.one,
  },
  phoneField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
    gap: Spacing.one,
  },
  phoneFieldDivider: {
    width: 1,
    height: 20,
  },
  phoneFieldInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Spacing.one,
  },
  fieldIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Spacing.one,
  },
  fieldActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldErrorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  primaryButton: {
    paddingVertical: Spacing.two,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  helpText: {
    fontSize: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
