import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/hooks';
import { ThemedText } from '@/theme/primitives/ThemedText';

export type FeedbackTone = 'error' | 'info' | 'success';

export interface FeedbackRequest {
  /** 0 = sticky; negative, non-finite, or overflow values fall back to the default. */
  durationMs?: number;
  message: string;
  title?: string;
  tone?: FeedbackTone;
}

export interface FeedbackContextValue {
  /** Removes the message with the given id; other messages are unaffected. */
  dismiss: (id: string) => void;
  /** Shows a message, replacing the current one; returns its id. */
  show: (request: FeedbackRequest) => string;
}

export const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;
const MAX_TIMEOUT_MS = 2_147_483_647;
let nextMessageId = 0;

interface ActiveMessage extends FeedbackRequest {
  id: string;
}

export interface FeedbackToneColors {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

type Theme = ReturnType<typeof useTheme>;

/** Text meets WCAG AA (>= 4.5:1) on its background in light and dark themes. */
const TONE_COLORS = {
  error: (theme: Theme) => ({
    backgroundColor: theme.colors.background.card,
    borderColor: theme.colors.status.error,
    textColor: theme.colors.status.error,
  }),
  success: (theme: Theme) => ({
    backgroundColor: theme.colors.brand.muted,
    borderColor: theme.colors.border.default,
    textColor: theme.colors.brand.primary,
  }),
  info: (theme: Theme) => ({
    backgroundColor: theme.colors.background.card,
    borderColor: theme.colors.border.default,
    textColor: theme.colors.text.secondary,
  }),
};

export function resolveToneColors(theme: Theme, tone: FeedbackTone) {
  return TONE_COLORS[tone](theme);
}

/** Maps a request duration to a safe setTimeout delay; null means sticky. */
function resolveAutoDismissMs(durationMs: number | undefined): number | null {
  if (durationMs === 0) return null;
  if (
    typeof durationMs !== 'number' ||
    !Number.isFinite(durationMs) ||
    durationMs < 0
  ) {
    return DEFAULT_DURATION_MS;
  }
  return Math.min(durationMs, MAX_TIMEOUT_MS);
}

export function useFeedback(): FeedbackContextValue {
  const value = useContext(FeedbackContext);
  if (!value) {
    throw new Error('useFeedback must be used within a <FeedbackProvider>');
  }
  return value;
}

export function FeedbackProvider({
  children,
  dismissLabel = 'Descartar',
}: PropsWithChildren<{ dismissLabel?: string }>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<ActiveMessage | null>(null);
  const colors = resolveToneColors(theme, active?.tone ?? 'info');

  const dismiss = useCallback((id: string) => {
    setActive((current) => (current?.id === id ? null : current));
  }, []);

  const show = useCallback((request: FeedbackRequest) => {
    const id = `feedback-${nextMessageId}`;
    nextMessageId += 1;
    setActive({ ...request, id });
    return id;
  }, []);

  useEffect(() => {
    if (!active) return;
    const delay = resolveAutoDismissMs(active.durationMs);
    if (delay === null) return;
    const timer = setTimeout(() => dismiss(active.id), delay);
    return () => clearTimeout(timer);
  }, [active, dismiss]);

  const value = useMemo(() => ({ dismiss, show }), [dismiss, show]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {active ? (
        <View
          pointerEvents="box-none"
          style={[styles.host, { top: insets.top + theme.spacing.md }]}
        >
          <View
            style={[
              styles.toast,
              {
                backgroundColor: colors.backgroundColor,
                borderColor: colors.borderColor,
                borderRadius: theme.radius.lg,
              },
            ]}
          >
            <View style={styles.body}>
              {active.title ? (
                <ThemedText style={{ color: colors.textColor }} variant="label">
                  {active.title}
                </ThemedText>
              ) : null}
              <ThemedText
                accessibilityLiveRegion="polite"
                role={active.tone === 'error' ? 'alert' : 'status'}
                style={{ color: colors.textColor }}
                variant="bodySmall"
              >
                {active.message}
              </ThemedText>
            </View>
            <Pressable
              accessibilityLabel={dismissLabel}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => dismiss(active.id)}
            >
              <ThemedText style={{ color: colors.textColor }} variant="label">
                ×
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </FeedbackContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    left: 0,
    paddingHorizontal: 16,
    position: Platform.select({ web: 'fixed', default: 'absolute' }),
    right: 0,
    zIndex: 1000,
  },
  toast: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    maxWidth: 480,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  body: {
    flex: 1,
    gap: 4,
  },
});
