import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import {
  buildAuthRouteWithRedirect,
  sanitizeAuthRedirect,
} from '@/lib/auth-redirect';
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

export type RegisterFormValues = z.infer<typeof registerSchema>;
export type RegisterFieldErrors = Partial<
  Record<keyof RegisterFormValues, string>
>;
export type RegisterTouchedFields = Partial<
  Record<keyof RegisterFormValues, boolean>
>;

const initialFormValues: RegisterFormValues = {
  fullName: '',
  email: '',
  address: '',
  phoneCountry: 'CL',
  phone: '',
  password: '',
  confirmPassword: '',
};

function getSignupErrorMessage(message: string) {
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
}

export function useRegisterScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [formValues, setFormValues] =
    useState<RegisterFormValues>(initialFormValues);
  const [touchedFields, setTouchedFields] = useState<RegisterTouchedFields>({});
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

  const redirectTo = useMemo(() => sanitizeAuthRedirect(redirect), [redirect]);

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
      router.replace(buildAuthRouteWithRedirect('/login', redirectTo) as Href);
    }, 1600);

    return () => clearTimeout(timeoutId);
  }, [infoMessage, redirectTo, router]);

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

  const handleSignUp = async () => {
    if (isSubmittingRef.current || isSubmitDisabled) {
      return;
    }

    const now = Date.now();
    if (now - lastSubmitAtRef.current < 1500) {
      setErrorMessage('Esperá un momento antes de volver a intentar.');
      return;
    }

    if (!validationResult.success) {
      setErrorMessage('Revisá los campos marcados y corregilos.');
      setTouchedFields({
        fullName: true,
        email: true,
        address: true,
        phone: true,
        password: true,
        confirmPassword: true,
      });
      return;
    }

    lastSubmitAtRef.current = now;
    isSubmittingRef.current = true;
    setErrorMessage('');
    setInfoMessage('');

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

      setFormValues(initialFormValues);
      setTouchedFields({});
      setInfoMessage(
        'Registro exitoso. Te redirigimos al login para iniciar sesión.',
      );
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

  return {
    errorMessage,
    focusedField,
    formValues,
    handleSignUp,
    infoMessage,
    isConfirmPasswordVisible,
    isPasswordVisible,
    isSubmitDisabled,
    isSubmitting,
    redirectTo,
    setFieldValue,
    setFocusedField,
    setIsConfirmPasswordVisible,
    setIsPasswordVisible,
    setTouched,
    touchedFields,
    validationFieldErrors,
  };
}

export const registerScreenLimits = {
  MAX_ADDRESS_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
} as const;
