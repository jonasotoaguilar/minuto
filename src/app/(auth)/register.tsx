import { Link } from 'expo-router';
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

export default function RegisterScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
              />
              <Field
                label="Email"
                placeholder="nombre@empresa.com"
                theme={theme}
                icon="@"
              />
              <Field
                label="Contraseña"
                placeholder="********"
                theme={theme}
                icon="*"
                secure
              />
              <Field
                label="Confirmar contraseña"
                placeholder="********"
                theme={theme}
                icon="*"
                secure
              />
            </View>

            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.primaryButtonText}>Crear cuenta →</Text>
            </Pressable>

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
};

function Field({ label, placeholder, icon, theme, secure }: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
      <View style={[styles.field, { borderColor: theme.border }]}>
        <Text style={[styles.fieldIcon, { color: theme.primary }]}>{icon}</Text>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          style={[styles.fieldInput, { color: theme.text }]}
          secureTextEntry={secure}
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
});
