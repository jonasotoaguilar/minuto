import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { type Dispatch, type SetStateAction } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PhoneCountryDropdown } from '@/components/phone-country-dropdown';
import {
  type RegisterFieldErrors,
  type RegisterFormValues,
  type RegisterTouchedFields,
  registerScreenLimits,
  useRegisterScreen,
} from '@/hooks/use-register-screen';
import { useTheme } from '@/hooks/use-theme';
import { buildAuthRouteWithRedirect } from '@/lib/auth-redirect';
import { getPhoneCountry, type PhoneCountryCode } from '@/lib/phone';
import {
  PrimaryButton,
  Screen,
  TextField,
  ThemedText,
} from '@/theme/primitives';

type AppTheme = ReturnType<typeof useTheme>;

export default function RegisterScreen() {
  const theme = useTheme();
  const screen = useRegisterScreen();

  return (
    <>
      <Head>
        <title>Crear cuenta | Minuto</title>
        <meta
          name="description"
          content="Crea tu cuenta en Minuto para registrar la asistencia de tu equipo y revisar tus horas trabajadas."
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Minuto" />
        <meta property="og:locale" content="es_CL" />
        <meta property="og:title" content="Crear cuenta | Minuto" />
        <meta
          property="og:description"
          content="Crea tu cuenta en Minuto para registrar la asistencia de tu equipo y revisar tus horas trabajadas."
        />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Crear cuenta | Minuto" />
        <meta
          name="twitter:description"
          content="Crea tu cuenta en Minuto para registrar la asistencia de tu equipo y revisar tus horas trabajadas."
        />
      </Head>
      <Screen
        keyboardAvoiding
        scroll
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: theme.spacing['2xl'],
            paddingBottom: theme.spacing['3xl'],
            paddingHorizontal: theme.spacing.lg,
            gap: theme.spacing.lg,
          },
        ]}
      >
        <RegisterBrandHeader theme={theme} />
        <RegisterFormCard
          errorMessage={screen.errorMessage}
          focusedField={screen.focusedField}
          formValues={screen.formValues}
          handleSignUp={screen.handleSignUp}
          infoMessage={screen.infoMessage}
          isConfirmPasswordVisible={screen.isConfirmPasswordVisible}
          isPasswordVisible={screen.isPasswordVisible}
          isSubmitDisabled={screen.isSubmitDisabled}
          isSubmitting={screen.isSubmitting}
          setFieldValue={screen.setFieldValue}
          setFocusedField={screen.setFocusedField}
          setIsConfirmPasswordVisible={screen.setIsConfirmPasswordVisible}
          setIsPasswordVisible={screen.setIsPasswordVisible}
          setTouched={screen.setTouched}
          theme={theme}
          touchedFields={screen.touchedFields}
          validationFieldErrors={screen.validationFieldErrors}
          redirectTo={screen.redirectTo}
        />
      </Screen>
    </>
  );
}

function RegisterBrandHeader({ theme }: { theme: AppTheme }) {
  return (
    <View style={styles.topBar}>
      <View style={[styles.brand, { gap: theme.spacing.sm }]}>
        <View
          style={[
            styles.brandIcon,
            {
              backgroundColor: theme.colors.brand.primary,
              borderRadius: theme.radius.lg,
            },
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
  touchedFields: RegisterTouchedFields;
  validationFieldErrors: RegisterFieldErrors;
  redirectTo: string | null;
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
  redirectTo,
}: RegisterFormCardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.background.card,
          borderRadius: theme.radius.xl,
          shadowColor: theme.colors.shadow.color,
          ...theme.elevation.elevated,
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
            {
              backgroundColor: theme.colors.brand.muted,
              borderRadius: theme.radius.lg,
            },
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

      <View
        style={[
          styles.cardBody,
          { padding: theme.spacing.lg, gap: theme.spacing.lg },
        ]}
      >
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
            href={buildAuthRouteWithRedirect('/login', redirectTo)}
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
  const theme = useTheme();
  return (
    <View style={[styles.form, { gap: theme.spacing.sm }]}>
      <TextField
        label="Nombre completo"
        placeholder="Nombre y apellido"
        value={formValues.fullName}
        onChangeText={(value) => setFieldValue('fullName', value)}
        onFocus={() => setFocusedField('fullName')}
        onBlur={() => {
          setFocusedField(null);
          setTouched('fullName');
        }}
        errorMessage={
          touchedFields.fullName ? validationFieldErrors.fullName : undefined
        }
        editable={!isSubmitting}
        maxLength={registerScreenLimits.MAX_NAME_LENGTH}
      />
      <TextField
        label="Dirección"
        placeholder="Av. Siempre Viva 123"
        value={formValues.address}
        onChangeText={(value) => setFieldValue('address', value)}
        onFocus={() => setFocusedField('address')}
        onBlur={() => {
          setFocusedField(null);
          setTouched('address');
        }}
        errorMessage={
          touchedFields.address ? validationFieldErrors.address : undefined
        }
        editable={!isSubmitting}
        maxLength={registerScreenLimits.MAX_ADDRESS_LENGTH}
      />
      <TextField
        label="Email"
        placeholder="nombre@empresa.com"
        value={formValues.email}
        onChangeText={(value) => setFieldValue('email', value)}
        onFocus={() => setFocusedField('email')}
        onBlur={() => {
          setFocusedField(null);
          setTouched('email');
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        errorMessage={
          touchedFields.email ? validationFieldErrors.email : undefined
        }
        editable={!isSubmitting}
        maxLength={registerScreenLimits.MAX_EMAIL_LENGTH}
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
        isDisabled={isSubmitting}
        isFocused={focusedField === 'phone'}
      />
      <PasswordField
        label="Contraseña"
        placeholder="********"
        value={formValues.password}
        onChangeText={(value) => setFieldValue('password', value)}
        onFocus={() => setFocusedField('password')}
        onBlur={() => {
          setFocusedField(null);
          setTouched('password');
        }}
        errorMessage={
          touchedFields.password ? validationFieldErrors.password : undefined
        }
        secure={!isPasswordVisible}
        onToggleSecure={() => setIsPasswordVisible((current) => !current)}
        toggleLabel={isPasswordVisible ? 'Ocultar' : 'Mostrar'}
        editable={!isSubmitting}
        maxLength={registerScreenLimits.MAX_PASSWORD_LENGTH}
      />
      <PasswordField
        label="Confirmar contraseña"
        placeholder="********"
        value={formValues.confirmPassword}
        onChangeText={(value) => setFieldValue('confirmPassword', value)}
        onFocus={() => setFocusedField('confirmPassword')}
        onBlur={() => {
          setFocusedField(null);
          setTouched('confirmPassword');
        }}
        errorMessage={
          touchedFields.confirmPassword
            ? validationFieldErrors.confirmPassword
            : undefined
        }
        secure={!isConfirmPasswordVisible}
        onToggleSecure={() =>
          setIsConfirmPasswordVisible((current) => !current)
        }
        toggleLabel={isConfirmPasswordVisible ? 'Ocultar' : 'Mostrar'}
        editable={!isSubmitting}
        maxLength={registerScreenLimits.MAX_PASSWORD_LENGTH}
      />
    </View>
  );
}

type PasswordFieldProps = {
  label: string;
  placeholder: string;
  value?: string;
  onChangeText?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  errorMessage?: string;
  secure?: boolean;
  onToggleSecure?: () => void;
  toggleLabel?: string;
  editable?: boolean;
  maxLength?: number;
};

function PasswordField({
  label,
  placeholder,
  value,
  onChangeText,
  onFocus,
  onBlur,
  errorMessage,
  secure,
  onToggleSecure,
  toggleLabel,
  editable,
  maxLength,
}: PasswordFieldProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <ThemedText variant="label">{label}</ThemedText>
      <View
        style={[
          styles.passwordField,
          {
            borderColor: errorMessage
              ? theme.colors.status.error
              : theme.colors.border.default,
            borderRadius: theme.radius.full,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
            gap: theme.spacing.xs,
          },
        ]}
      >
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={theme.colors.text.muted}
          style={[
            styles.passwordFieldInput,
            {
              color: theme.colors.text.primary,
              fontSize: theme.typography.bodySmall.fontSize,
              paddingVertical: theme.spacing.xs,
            },
          ]}
          secureTextEntry={secure}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          editable={editable}
          maxLength={maxLength}
        />
        {toggleLabel && onToggleSecure ? (
          <Pressable
            accessibilityLabel={toggleLabel}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onToggleSecure}
            style={({ pressed }) => [
              styles.passwordToggle,
              { opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <ThemedText
              colorToken="brand"
              variant="caption"
              style={{
                fontWeight: theme.typography.label.fontWeight,
              }}
            >
              {toggleLabel}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      {errorMessage ? (
        <ThemedText
          colorToken="error"
          variant="caption"
          style={{ fontWeight: theme.typography.label.fontWeight }}
        >
          {errorMessage}
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
  isDisabled,
  isFocused,
}: PhoneFieldProps) {
  const theme = useTheme();
  const selectedCountry = getPhoneCountry(countryCode);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <ThemedText variant="label">{label}</ThemedText>
      <View
        style={[
          styles.phoneField,
          {
            borderColor: isFocused
              ? theme.colors.brand.primary
              : error
                ? theme.colors.status.error
                : theme.colors.border.default,
            borderRadius: theme.radius.full,
            paddingHorizontal: theme.spacing.xs,
            paddingVertical: theme.spacing.xs,
            gap: theme.spacing.xs,
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
              paddingVertical: theme.spacing.xs,
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
          style={{ fontWeight: theme.typography.label.fontWeight }}
        >
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIcon: {
    width: 40,
    height: 40,
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
    overflow: 'hidden',
  },
  cardBanner: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardShield: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardShieldText: {
    // Using body typography with semibold weight
  },
  cardBody: {
    alignItems: 'stretch',
  },
  cardTitle: {
    textAlign: 'center',
  },
  cardSubtitle: {
    // fontSize applied inline via theme.typography.bodySmall
    textAlign: 'center',
  },
  form: {
    alignItems: 'stretch',
  },
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  passwordFieldInput: {
    flex: 1,
  },
  passwordToggle: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  phoneField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  phoneFieldDivider: {
    width: 1,
    height: 20,
  },
  phoneFieldInput: {
    flex: 1,
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
