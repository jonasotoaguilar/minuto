import { type Href, Link, useRouter } from 'expo-router';
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { z } from 'zod';

import { PhoneCountryDropdown } from '@/components/phone-country-dropdown';
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
import { PrimaryButton, Screen, ThemedText } from '@/theme/primitives';

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
type AppTheme = ReturnType<typeof useTheme>;

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
  const router = useRouter();
  const [formValues, setFormValues] =
    useState<RegisterFormValues>(initialFormValues);
  const [touchedFields, setTouchedFields] = useState<TouchedFields>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<
    keyof RegisterFormValues | null
  >(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);
  const isSubmittingRef = useRef(false);
  const lastSubmitAtRef = useRef(0);

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

  const isSubmitDisabled =
    !isFormComplete || !validationResult.success || isSubmitting;

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
  };

  const setTouched = (field: keyof RegisterFormValues) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  };

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

  return (
    <Screen
      keyboardAvoiding
      scroll
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: theme.spacing['2xl'],
          paddingBottom: theme.spacing['3xl'],
        },
      ]}
    >
      <RegisterBrandHeader theme={theme} />
      <RegisterFormCard
        errorMessage={errorMessage}
        focusedField={focusedField}
        formValues={formValues}
        handleSignUp={handleSignUp}
        infoMessage={infoMessage}
        isConfirmPasswordVisible={isConfirmPasswordVisible}
        isPasswordVisible={isPasswordVisible}
        isSubmitDisabled={isSubmitDisabled}
        isSubmitting={isSubmitting}
        setFieldValue={setFieldValue}
        setFocusedField={setFocusedField}
        setIsConfirmPasswordVisible={setIsConfirmPasswordVisible}
        setIsPasswordVisible={setIsPasswordVisible}
        setTouched={setTouched}
        theme={theme}
        touchedFields={touchedFields}
        validationFieldErrors={validationFieldErrors}
      />
    </Screen>
  );
}

function RegisterBrandHeader({ theme }: { theme: AppTheme }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.brand}>
        <View
          style={[
            styles.brandIcon,
            { backgroundColor: theme.colors.brand.primary },
          ]}
        >
          <ThemedText
            colorToken="inverse"
            style={[
              styles.brandLetter,
              {
                fontSize: theme.typography.subtitle.fontSize,
                fontWeight: theme.typography.subtitle.fontWeight,
              },
            ]}
          >
            M
          </ThemedText>
        </View>
        <ThemedText
          variant="title"
          style={[styles.brandText, { fontSize: 20 }]}
        >
          Minuto
        </ThemedText>
      </View>
    </View>
  );
}

type RegisterFormCardProps = {
  errorMessage: string;
  focusedField: keyof RegisterFormValues | null;
  formValues: RegisterFormValues;
  handleSignUp: () => void;
  infoMessage: string;
  isConfirmPasswordVisible: boolean;
  isPasswordVisible: boolean;
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  setFieldValue: (field: keyof RegisterFormValues, value: string) => void;
  setFocusedField: (field: keyof RegisterFormValues | null) => void;
  setIsConfirmPasswordVisible: Dispatch<SetStateAction<boolean>>;
  setIsPasswordVisible: Dispatch<SetStateAction<boolean>>;
  setTouched: (field: keyof RegisterFormValues) => void;
  theme: AppTheme;
  touchedFields: TouchedFields;
  validationFieldErrors: RegisterFieldErrors;
};

function RegisterFormCard({
  errorMessage,
  focusedField,
  formValues,
  handleSignUp,
  infoMessage,
  isConfirmPasswordVisible,
  isPasswordVisible,
  isSubmitDisabled,
  isSubmitting,
  setFieldValue,
  setFocusedField,
  setIsConfirmPasswordVisible,
  setIsPasswordVisible,
  setTouched,
  theme,
  touchedFields,
  validationFieldErrors,
}: RegisterFormCardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.background.card,
          shadowColor: theme.colors.shadow.color,
        },
      ]}
    >
      <View
        style={[
          styles.cardBanner,
          { backgroundColor: theme.colors.brand.primary },
        ]}
      >
        <View
          style={[
            styles.cardShield,
            { backgroundColor: theme.colors.brand.muted },
          ]}
        >
          <ThemedText
            colorToken="brand"
            style={[
              styles.cardShieldText,
              {
                fontSize: theme.typography.body.fontSize,
                fontWeight: theme.typography.label.fontWeight,
              },
            ]}
          >
            OK
          </ThemedText>
        </View>
      </View>

      <View style={styles.cardBody}>
        <ThemedText variant="heading" style={styles.cardTitle}>
          Crea tu cuenta
        </ThemedText>
        <ThemedText
          colorToken="secondary"
          style={[
            styles.cardSubtitle,
            { fontSize: theme.typography.bodySmall.fontSize },
          ]}
        >
          Registra tu acceso a Minuto
        </ThemedText>

        <RegisterFormFields
          focusedField={focusedField}
          formValues={formValues}
          isConfirmPasswordVisible={isConfirmPasswordVisible}
          isPasswordVisible={isPasswordVisible}
          isSubmitting={isSubmitting}
          setFieldValue={setFieldValue}
          setFocusedField={setFocusedField}
          setIsConfirmPasswordVisible={setIsConfirmPasswordVisible}
          setIsPasswordVisible={setIsPasswordVisible}
          setTouched={setTouched}
          touchedFields={touchedFields}
          validationFieldErrors={validationFieldErrors}
        />

        <PrimaryButton
          disabled={isSubmitDisabled}
          label={isSubmitting ? 'Registrando...' : 'Crear cuenta →'}
          loading={isSubmitting}
          onPress={handleSignUp}
        />

        {errorMessage ? (
          <ThemedText
            colorToken="error"
            style={[
              styles.messageText,
              {
                fontSize: theme.typography.caption.fontSize,
                fontWeight: theme.typography.label.fontWeight,
              },
            ]}
          >
            {errorMessage}
          </ThemedText>
        ) : null}

        {infoMessage ? (
          <ThemedText
            colorToken="secondary"
            style={[
              styles.messageText,
              {
                fontSize: theme.typography.caption.fontSize,
                fontWeight: theme.typography.label.fontWeight,
              },
            ]}
          >
            {infoMessage}
          </ThemedText>
        ) : null}

        <ThemedText
          colorToken="secondary"
          style={[
            styles.helpText,
            { fontSize: theme.typography.caption.fontSize },
          ]}
        >
          Ya tienes cuenta?{' '}
          <Link
            href="/login"
            style={{
              color: theme.colors.brand.primary,
              fontWeight: theme.typography.label.fontWeight,
            }}
          >
            Inicia sesión
          </Link>
        </ThemedText>
      </View>
    </View>
  );
}

type RegisterFormFieldsProps = Pick<
  RegisterFormCardProps,
  | 'focusedField'
  | 'formValues'
  | 'isConfirmPasswordVisible'
  | 'isPasswordVisible'
  | 'isSubmitting'
  | 'setFieldValue'
  | 'setFocusedField'
  | 'setIsConfirmPasswordVisible'
  | 'setIsPasswordVisible'
  | 'setTouched'
  | 'touchedFields'
  | 'validationFieldErrors'
>;

function RegisterFormFields({
  focusedField,
  formValues,
  isConfirmPasswordVisible,
  isPasswordVisible,
  isSubmitting,
  setFieldValue,
  setFocusedField,
  setIsConfirmPasswordVisible,
  setIsPasswordVisible,
  setTouched,
  touchedFields,
  validationFieldErrors,
}: RegisterFormFieldsProps) {
  return (
    <View style={styles.form}>
      <Field
        label="Nombre completo"
        placeholder="Nombre y apellido"
        icon="A"
        value={formValues.fullName}
        onChangeText={(value) => setFieldValue('fullName', value)}
        onFocus={() => setFocusedField('fullName')}
        onBlur={() => {
          setFocusedField(null);
          setTouched('fullName');
        }}
        error={touchedFields.fullName ? validationFieldErrors.fullName : ''}
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
        icon="D"
        value={formValues.address}
        onChangeText={(value) => setFieldValue('address', value)}
        onFocus={() => setFocusedField('address')}
        onBlur={() => {
          setFocusedField(null);
          setTouched('address');
        }}
        error={touchedFields.address ? validationFieldErrors.address : ''}
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
        error={touchedFields.email ? validationFieldErrors.email : ''}
        isValid={
          Boolean(touchedFields.email) &&
          Boolean(formValues.email.trim()) &&
          !validationFieldErrors.email
        }
        isDisabled={isSubmitting}
        maxLength={MAX_EMAIL_LENGTH}
        isFocused={focusedField === 'email'}
      />
      <PhoneField
        label="Teléfono"
        countryCode={formValues.phoneCountry}
        nationalNumber={formValues.phone}
        onChangeCountry={(countryCode) => {
          setFieldValue('phoneCountry', countryCode);
          setTouched('phone');
        }}
        onChangeNationalNumber={(value) => setFieldValue('phone', value)}
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
        icon="*"
        secure={!isPasswordVisible}
        value={formValues.password}
        onChangeText={(value) => setFieldValue('password', value)}
        onFocus={() => setFocusedField('password')}
        onBlur={() => {
          setFocusedField(null);
          setTouched('password');
        }}
        error={touchedFields.password ? validationFieldErrors.password : ''}
        isValid={
          Boolean(touchedFields.password) &&
          Boolean(formValues.password) &&
          !validationFieldErrors.password
        }
        actionLabel={isPasswordVisible ? 'Ocultar' : 'Mostrar'}
        onPressAction={() => setIsPasswordVisible((current) => !current)}
        isDisabled={isSubmitting}
        maxLength={MAX_PASSWORD_LENGTH}
        isFocused={focusedField === 'password'}
      />
      <Field
        label="Confirmar contraseña"
        placeholder="********"
        icon="*"
        secure={!isConfirmPasswordVisible}
        value={formValues.confirmPassword}
        onChangeText={(value) => setFieldValue('confirmPassword', value)}
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
        onPressAction={() => setIsConfirmPasswordVisible((current) => !current)}
        isDisabled={isSubmitting}
        maxLength={MAX_PASSWORD_LENGTH}
        isFocused={focusedField === 'confirmPassword'}
      />
    </View>
  );
}

type FieldProps = {
  label: string;
  placeholder: string;
  icon: string;
  secure?: boolean;
  value?: string;
  onChangeText?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  isValid?: boolean;
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
  secure,
  value,
  onChangeText,
  onFocus,
  onBlur,
  keyboardType,
  autoCapitalize,
  error,
  isValid,
  actionLabel,
  onPressAction,
  isDisabled,
  maxLength,
  isFocused,
}: FieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.fieldGroup}>
      <ThemedText variant="label">{label}</ThemedText>
      <View
        style={[
          styles.field,
          {
            borderColor: isFocused
              ? theme.colors.brand.primary
              : error
                ? theme.colors.status.error
                : isValid
                  ? theme.colors.brand.primary
                  : theme.colors.border.default,
          },
        ]}
      >
        <ThemedText
          colorToken="brand"
          style={[
            styles.fieldIcon,
            {
              fontSize: theme.typography.bodySmall.fontSize,
              fontWeight: theme.typography.label.fontWeight,
            },
          ]}
        >
          {icon}
        </ThemedText>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={theme.colors.text.muted}
          style={[
            styles.fieldInput,
            {
              color: theme.colors.text.primary,
              fontSize: theme.typography.bodySmall.fontSize,
            },
          ]}
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
            <ThemedText
              colorToken="brand"
              style={[
                styles.fieldActionText,
                {
                  fontSize: theme.typography.caption.fontSize,
                  fontWeight: theme.typography.label.fontWeight,
                },
              ]}
            >
              {actionLabel}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      {!isFocused && error ? (
        <ThemedText
          colorToken="error"
          variant="caption"
          style={[
            styles.fieldErrorText,
            { fontWeight: theme.typography.label.fontWeight },
          ]}
        >
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

type PhoneFieldProps = {
  label: string;
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
  const theme = useTheme();
  const selectedCountry = getPhoneCountry(countryCode);

  return (
    <View style={styles.fieldGroup}>
      <ThemedText variant="label">{label}</ThemedText>
      <View
        style={[
          styles.phoneField,
          {
            borderColor: isFocused
              ? theme.colors.brand.primary
              : error
                ? theme.colors.status.error
                : isValid
                  ? theme.colors.brand.primary
                  : theme.colors.border.default,
          },
        ]}
      >
        <PhoneCountryDropdown
          disabled={isDisabled}
          countryCode={countryCode}
          onChangeCountry={onChangeCountry}
          minWidth={116}
        />

        <View
          style={[
            styles.phoneFieldDivider,
            { backgroundColor: theme.colors.border.default },
          ]}
        />

        <TextInput
          placeholder={selectedCountry.pattern.replaceAll('X', '0')}
          placeholderTextColor={theme.colors.text.muted}
          style={[
            styles.phoneFieldInput,
            {
              color: theme.colors.text.primary,
              fontSize: theme.typography.bodySmall.fontSize,
            },
          ]}
          value={nationalNumber}
          onChangeText={onChangeNationalNumber}
          onFocus={onFocus}
          onBlur={onBlur}
          keyboardType="phone-pad"
          editable={!isDisabled}
        />
      </View>
      {!isFocused && error ? (
        <ThemedText
          colorToken="error"
          variant="caption"
          style={[
            styles.fieldErrorText,
            { fontWeight: theme.typography.label.fontWeight },
          ]}
        >
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {
    // Using subtitle typography for compact brand icon text
  },
  brandText: {
    // fontSize applied inline via theme.typography.title
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
    // Using body typography with semibold weight
  },
  cardBody: {
    padding: 16,
    gap: 16,
  },
  cardTitle: {
    textAlign: 'center',
  },
  cardSubtitle: {
    // fontSize applied inline via theme.typography.bodySmall
    textAlign: 'center',
  },
  form: {
    gap: 8,
  },
  fieldGroup: {
    gap: 4,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  phoneField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 4,
  },
  phoneFieldDivider: {
    width: 1,
    height: 20,
  },
  phoneFieldInput: {
    flex: 1,
    // fontSize applied inline via theme.typography.bodySmall
    paddingVertical: 4,
  },
  fieldIcon: {
    // Typography applied inline via theme.typography.label
  },
  fieldInput: {
    flex: 1,
    // fontSize applied inline via theme.typography.bodySmall
    paddingVertical: 4,
  },
  fieldActionText: {
    // Typography applied inline via theme.typography.caption with semibold
  },
  fieldErrorText: {
    // fontWeight applied inline via theme.typography.label
  },
  messageText: {
    // Typography applied inline via theme.typography.caption with semibold
    textAlign: 'center',
  },
  helpText: {
    // fontSize applied inline via theme.typography.caption
    textAlign: 'center',
  },
});
