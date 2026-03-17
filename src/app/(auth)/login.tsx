import { type Href, Link, useRouter } from 'expo-router';
import { useState } from 'react';
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

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (isSubmitting) return;
    setErrorMessage('');
    setInfoMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Completa email y contraseña para continuar.');
      return;
    }

    try {
      setIsSubmitting(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        const redirectTo = '/(tabs)/home' as Href;
        router.replace(redirectTo);
        return;
      }

      setInfoMessage('Sesión creada. Continuá para ingresar.');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error inesperado al ingresar.';
      setErrorMessage(message);
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
          <View style={styles.topLinks}>
            <Text style={[styles.topLink, { color: theme.textSecondary }]}>
              About
            </Text>
            <Text style={[styles.topLink, { color: theme.textSecondary }]}>
              Support
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
              Bienvenido a Minuto
            </Text>
            <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
              Ingresa a tu cuenta
            </Text>

            <View style={styles.form}>
              <Field
                label="Email"
                placeholder="nombre@empresa.com"
                theme={theme}
                icon="@"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <View style={styles.passwordRow}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>
                  Contraseña
                </Text>
                <Text style={[styles.linkText, { color: theme.primary }]}>
                  ¿Olvidaste la contraseña?
                </Text>
              </View>
              <Field
                placeholder="********"
                theme={theme}
                icon="*"
                secure
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <Pressable
              onPress={handleSignIn}
              disabled={isSubmitting}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: theme.primary,
                  opacity: isSubmitting ? 0.7 : 1,
                },
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Ingresando...' : 'Iniciar Sesión →'}
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
              ¿Problemas para entrar?{' '}
              <Text style={[styles.helpLink, { color: theme.primary }]}>
                Estamos aquí para ayudarte
              </Text>
            </Text>
          </View>
        </View>

        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          ¿Aún no tienes cuenta?{' '}
          <Link
            href="/register"
            style={{ color: theme.primary, fontWeight: '600' }}
          >
            Contrata Minuto para tu negocio
          </Link>
        </Text>

        <View style={styles.bottomLinks}>
          <Text style={[styles.bottomLink, { color: theme.textSecondary }]}>
            PRIVACIDAD
          </Text>
          <Text style={[styles.bottomLink, { color: theme.textSecondary }]}>
            TÉRMINOS
          </Text>
          <Text style={[styles.bottomLink, { color: theme.textSecondary }]}>
            COOKIES
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = {
  label?: string;
  placeholder: string;
  icon: string;
  theme: ReturnType<typeof useTheme>;
  secure?: boolean;
  value?: string;
  onChangeText?: (value: string) => void;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

function Field({
  label,
  placeholder,
  icon,
  theme,
  secure,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
}: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      {label ? (
        <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
      ) : null}
      <View style={[styles.field, { borderColor: theme.border }]}>
        <Text style={[styles.fieldIcon, { color: theme.primary }]}>{icon}</Text>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          style={[styles.fieldInput, { color: theme.text }]}
          secureTextEntry={secure}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
      </View>
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
    justifyContent: 'space-between',
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
  topLinks: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  topLink: {
    fontSize: 12,
    fontWeight: '600',
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
  fieldIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Spacing.one,
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
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
  helpLink: {
    fontWeight: '600',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
  bottomLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  bottomLink: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
