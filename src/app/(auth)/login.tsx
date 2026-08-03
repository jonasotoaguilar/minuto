import { Link } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { loginScreenLimits, useLoginScreen } from '@/hooks/use-login-screen';
import { useTheme } from '@/hooks/use-theme';
import { buildAuthRouteWithRedirect } from '@/lib/auth-redirect';
import {
  PrimaryButton,
  Screen,
  TextField,
  ThemedText,
} from '@/theme/primitives';

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
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.lg,
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

function LoginFormCard({ screen }: { screen: LoginScreenState }) {
  const theme = useTheme();

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

        <View style={[styles.form, { gap: theme.spacing.sm }]}>
          <TextField
            label="Email"
            placeholder="nombre@empresa.com"
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
            errorMessage={
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
          <PasswordField
            placeholder="********"
            value={screen.password}
            onChangeText={screen.setPassword}
            autoCorrect={false}
            maxLength={loginScreenLimits.MAX_PASSWORD_LENGTH}
            onFocus={() => screen.setFocusedField('password')}
            onBlur={() => {
              screen.setFocusedField(null);
              screen.markFieldTouched('password');
            }}
            errorMessage={
              screen.touchedFields.password &&
              screen.focusedField !== 'password'
                ? screen.fieldErrors.password
                : undefined
            }
            secure={!screen.isPasswordVisible}
            onToggleSecure={() =>
              screen.setIsPasswordVisible((current) => !current)
            }
            toggleLabel={screen.isPasswordVisible ? 'Ocultar' : 'Ver'}
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

type PasswordFieldProps = {
  placeholder: string;
  value?: string;
  onChangeText?: (value: string) => void;
  autoCorrect?: boolean;
  maxLength?: number;
  errorMessage?: string;
  secure?: boolean;
  onToggleSecure?: () => void;
  toggleLabel?: string;
  onFocus?: () => void;
  onBlur?: () => void;
};

function PasswordField({
  placeholder,
  value,
  onChangeText,
  autoCorrect,
  maxLength,
  errorMessage,
  secure,
  onToggleSecure,
  toggleLabel,
  onFocus,
  onBlur,
}: PasswordFieldProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
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
          autoCorrect={autoCorrect}
          maxLength={maxLength}
          onFocus={onFocus}
          onBlur={onBlur}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
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
