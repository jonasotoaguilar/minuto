import { Link } from 'expo-router';
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
import { PrimaryButton, Screen, ThemedText } from '@/theme/primitives';

type AppTheme = ReturnType<typeof useTheme>;

export default function RegisterScreen() {
  const theme = useTheme();
  const screen = useRegisterScreen();

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
        maxLength={registerScreenLimits.MAX_NAME_LENGTH}
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
        maxLength={registerScreenLimits.MAX_ADDRESS_LENGTH}
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
        maxLength={registerScreenLimits.MAX_EMAIL_LENGTH}
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
        maxLength={registerScreenLimits.MAX_PASSWORD_LENGTH}
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
        maxLength={registerScreenLimits.MAX_PASSWORD_LENGTH}
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
