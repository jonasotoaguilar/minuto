import { Link } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { loginScreenLimits, useLoginScreen } from '@/hooks/use-login-screen';
import { useTheme } from '@/hooks/use-theme';
import { buildAuthRouteWithRedirect } from '@/lib/auth-redirect';
import { PrimaryButton, Screen, ThemedText } from '@/theme/primitives';

export default function LoginScreen() {
  const theme = useTheme();
  const screen = useLoginScreen();

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
      <LoginBrandHeader />
      <LoginFormCard screen={screen} />
    </Screen>
  );
}

type LoginScreenState = ReturnType<typeof useLoginScreen>;

function LoginBrandHeader() {
  const theme = useTheme();

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

function LoginFormCard({ screen }: { screen: LoginScreenState }) {
  const theme = useTheme();

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
          Bienvenido a Minuto
        </ThemedText>
        <ThemedText
          colorToken="secondary"
          style={[
            styles.cardSubtitle,
            { fontSize: theme.typography.bodySmall.fontSize },
          ]}
        >
          Ingresa a tu cuenta
        </ThemedText>

        <View style={styles.form}>
          <Field
            label="Email"
            placeholder="nombre@empresa.com"
            icon="@"
            value={screen.email}
            onChangeText={screen.setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={loginScreenLimits.MAX_EMAIL_LENGTH}
            onFocus={() => screen.setFocusedField('email')}
            onBlur={() => {
              screen.setFocusedField(null);
              screen.markFieldTouched('email');
            }}
            error={
              screen.touchedFields.email && screen.focusedField !== 'email'
                ? screen.fieldErrors.email
                : undefined
            }
          />
          <View style={styles.passwordRow}>
            <ThemedText variant="label">Contraseña</ThemedText>
            <ThemedText
              colorToken="brand"
              variant="caption"
              style={[
                styles.linkText,
                { fontWeight: theme.typography.label.fontWeight },
              ]}
            >
              ¿Olvidaste la contraseña?
            </ThemedText>
          </View>
          <Field
            placeholder="********"
            icon="*"
            secure={!screen.isPasswordVisible}
            value={screen.password}
            onChangeText={screen.setPassword}
            autoCorrect={false}
            maxLength={loginScreenLimits.MAX_PASSWORD_LENGTH}
            onFocus={() => screen.setFocusedField('password')}
            onBlur={() => {
              screen.setFocusedField(null);
              screen.markFieldTouched('password');
            }}
            error={
              screen.touchedFields.password &&
              screen.focusedField !== 'password'
                ? screen.fieldErrors.password
                : undefined
            }
            rightElement={
              <Pressable
                onPress={() =>
                  screen.setIsPasswordVisible((current) => !current)
                }
                hitSlop={8}
              >
                <ThemedText
                  colorToken="brand"
                  variant="caption"
                  style={[
                    styles.toggleText,
                    { fontWeight: theme.typography.label.fontWeight },
                  ]}
                >
                  {screen.isPasswordVisible ? 'Ocultar' : 'Ver'}
                </ThemedText>
              </Pressable>
            }
          />
        </View>

        <PrimaryButton
          disabled={screen.isSubmitDisabled}
          label={screen.isSubmitting ? 'Ingresando...' : 'Iniciar Sesión →'}
          loading={screen.isSubmitting}
          onPress={screen.handleSignIn}
        />

        {screen.errorMessage ? (
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
            {screen.errorMessage}
          </ThemedText>
        ) : null}

        {screen.infoMessage ? (
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
            {screen.infoMessage}
          </ThemedText>
        ) : null}

        <ThemedText
          colorToken="secondary"
          style={[
            styles.footerText,
            { fontSize: theme.typography.caption.fontSize },
          ]}
        >
          ¿Aún no tienes cuenta?{' '}
          <Link
            href={buildAuthRouteWithRedirect('/register', screen.redirectTo)}
            style={{
              color: theme.colors.brand.primary,
              fontWeight: theme.typography.label.fontWeight,
            }}
          >
            Registrate en Minuto
          </Link>
        </ThemedText>

        {screen.isLockoutActive ? (
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
            Demasiados intentos fallidos. Probá en {screen.lockoutSecondsLeft}s.
          </ThemedText>
        ) : screen.failedAttempts > 0 ? (
          <ThemedText
            colorToken="secondary"
            style={[
              styles.helpText,
              { fontSize: theme.typography.caption.fontSize },
            ]}
          >
            Intentos fallidos: {screen.failedAttempts}/
            {loginScreenLimits.MAX_FAILED_ATTEMPTS}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

type FieldProps = {
  label?: string;
  placeholder: string;
  icon: string;
  secure?: boolean;
  value?: string;
  onChangeText?: (value: string) => void;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  maxLength?: number;
  error?: string;
  rightElement?: ReactNode;
  onBlur?: () => void;
  onFocus?: () => void;
};

function Field({
  label,
  placeholder,
  icon,
  secure,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  maxLength,
  error,
  rightElement,
  onBlur,
  onFocus,
}: FieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.fieldGroup}>
      {label ? <ThemedText variant="label">{label}</ThemedText> : null}
      <View
        style={[
          styles.field,
          {
            borderColor: error
              ? theme.colors.status.error
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
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          maxLength={maxLength}
          onBlur={onBlur}
          onFocus={onFocus}
        />
        {rightElement}
      </View>
      {error ? (
        <ThemedText
          colorToken="error"
          variant="caption"
          style={[
            styles.fieldError,
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
    justifyContent: 'space-between',
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
    // Using label typography for compact brand icon text
  },
  brandText: {
    // fontSize applied inline via theme.typography.title
  },
  topLinks: {
    flexDirection: 'row',
    gap: 8,
  },
  topLink: {
    // fontWeight applied inline via theme.typography.label
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
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
  fieldIcon: {
    // Typography applied inline via theme.typography.label
  },
  fieldInput: {
    flex: 1,
    // fontSize applied inline via theme.typography.bodySmall
    paddingVertical: 4,
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    // fontWeight applied inline via theme.typography.label
  },
  toggleText: {
    // fontWeight applied inline via theme.typography.label (bold)
  },
  fieldError: {
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
  helpLink: {
    // fontWeight applied inline via theme.typography.label
  },
  footerText: {
    // fontSize applied inline via theme.typography.caption
    textAlign: 'center',
  },
  bottomLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
});
