import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type HeaderUserMenuProps = {
  initials?: string;
};

export function HeaderUserMenu({ initials = 'TU' }: HeaderUserMenuProps) {
  const theme = useTheme();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleProfile = () => {
    setIsOpen(false);
    const profileRoute = '/profile' as Href;
    router.push(profileRoute);
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => setIsOpen((currentValue) => !currentValue)}
        style={[styles.avatarShell, { borderColor: theme.primary }]}
      >
        <Text style={[styles.avatarText, { color: theme.textSecondary }]}>
          {initials}
        </Text>
      </Pressable>

      {isOpen ? (
        <View
          style={[
            styles.menu,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <Pressable
            onPress={handleProfile}
            style={({ pressed }) => [
              styles.menuItem,
              pressed ? { backgroundColor: theme.backgroundSelected } : null,
            ]}
          >
            <Text style={[styles.menuItemText, { color: theme.text }]}>
              Perfil
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.menuItem,
              pressed ? { backgroundColor: theme.backgroundSelected } : null,
            ]}
          >
            <Text style={[styles.menuItemText, { color: theme.error }]}>
              Cerrar sesión
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 140,
    elevation: 140,
  },
  avatarShell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  menu: {
    position: 'absolute',
    top: 48,
    right: 0,
    minWidth: 160,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: Spacing.one,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 140,
    zIndex: 140,
  },
  menuItem: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
});
