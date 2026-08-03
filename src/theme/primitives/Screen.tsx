import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/theme/hooks';

const SCREEN_SURFACES = {
  canvas: 'canvas',
  card: 'card',
  elevated: 'elevated',
  glass: 'glass',
} as const;

export type ScreenSurface =
  (typeof SCREEN_SURFACES)[keyof typeof SCREEN_SURFACES];

export interface ScreenProps extends PropsWithChildren<ViewProps> {
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
  scroll?: boolean;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'style'>;
  style?: StyleProp<ViewStyle>;
  surface?: ScreenSurface;
}

function resolveScreenBackground(
  theme: ReturnType<typeof useTheme>,
  surface: ScreenSurface,
) {
  switch (surface) {
    case SCREEN_SURFACES.card:
      return theme.colors.background.card;
    case SCREEN_SURFACES.elevated:
      return theme.colors.background.elevated;
    case SCREEN_SURFACES.glass:
      return theme.surface.glass.tint;
    case SCREEN_SURFACES.canvas:
    default:
      return theme.colors.background.screen;
  }
}

export function Screen({
  children,
  contentContainerStyle,
  keyboardAvoiding = false,
  keyboardVerticalOffset = 0,
  scroll = false,
  scrollProps,
  style,
  surface = SCREEN_SURFACES.canvas,
  ...props
}: ScreenProps) {
  const theme = useTheme();
  const backgroundColor = resolveScreenBackground(theme, surface);
  const webContent = Platform.OS === 'web' ? styles.webContent : null;
  const content = scroll ? (
    <ScrollView
      {...scrollProps}
      contentContainerStyle={[
        styles.scrollContent,
        webContent,
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps={
        scrollProps?.keyboardShouldPersistTaps ?? 'handled'
      }
      showsVerticalScrollIndicator={
        scrollProps?.showsVerticalScrollIndicator ?? false
      }
      style={styles.content}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, webContent, contentContainerStyle]}>
      {children}
    </View>
  );

  const body = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={styles.keyboardAvoider}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );

  return (
    <SafeAreaView
      {...props}
      style={[styles.screen, { backgroundColor }, style]}
    >
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardAvoider: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  webContent: {
    alignSelf: 'center',
    marginHorizontal: 'auto',
    maxWidth: MaxContentWidth,
    width: '100%',
  },
});
