import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import {
  countryCodeToFlag,
  getPhoneCountry,
  PHONE_COUNTRIES,
  type PhoneCountryCode,
} from '@/lib/phone';
import { GlassCard, ThemedText } from '@/theme/primitives';

type PhoneCountryDropdownProps = {
  countryCode: PhoneCountryCode;
  onChangeCountry: (countryCode: PhoneCountryCode) => void;
  disabled?: boolean;
  minWidth?: number;
};

type CountryItem = (typeof PHONE_COUNTRIES)[number];

export function PhoneCountryDropdown({
  countryCode,
  onChangeCountry,
  disabled,
  minWidth = 120,
}: PhoneCountryDropdownProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCountry = getPhoneCountry(countryCode);
  const selectedFlag = countryCodeToFlag(countryCode);

  const filteredCountries =
    search.trim().length === 0
      ? PHONE_COUNTRIES
      : PHONE_COUNTRIES.filter((country) => {
          const query = search.trim().toLowerCase();
          return (
            country.name.toLowerCase().includes(query) ||
            country.dialCode.includes(query) ||
            country.code.toLowerCase().includes(query)
          );
        });

  const handleOpen = () => {
    setSearch('');
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearch('');
  };

  const handleSelect = (code: PhoneCountryCode) => {
    onChangeCountry(code);
    handleClose();
  };

  const renderItem = ({ item }: { item: CountryItem }) => {
    const isSelected = item.code === countryCode;

    return (
      <Pressable
        onPress={() => handleSelect(item.code)}
        style={[
          styles.menuItem,
          {
            marginHorizontal: theme.spacing.xs,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
          },
          isSelected
            ? { backgroundColor: theme.colors.background.selected }
            : null,
        ]}
      >
        <ThemedText style={styles.menuItemText} variant="label">
          {countryCodeToFlag(item.code)} {item.name} (+{item.dialCode})
        </ThemedText>
        <ThemedText
          colorToken={isSelected ? 'accent' : 'primary'}
          style={[styles.menuCheck, !isSelected ? styles.hiddenCheck : null]}
          variant="label"
        >
          ✓
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrapper, { minWidth }]}>
      <Pressable
        disabled={disabled}
        onPress={handleOpen}
        style={[
          styles.trigger,
          {
            borderColor: theme.colors.border.default,
            backgroundColor: theme.colors.background.card,
            opacity: disabled ? 0.7 : 1,
            borderRadius: theme.radius.pill,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.xs,
          },
        ]}
      >
        <ThemedText style={styles.triggerText} variant="label">
          {selectedFlag} +{selectedCountry.dialCode}
        </ThemedText>
        <ThemedText
          colorToken="secondary"
          style={styles.triggerCaret}
          variant="caption"
        >
          {isOpen ? '^' : 'v'}
        </ThemedText>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.overlay.scrim }]}
          onPress={handleClose}
        >
          <Pressable style={styles.cardWrapper} onPress={() => undefined}>
            <GlassCard
              padding={0}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.background.card,
                  shadowColor: theme.colors.shadow.color,
                  ...theme.elevation.modal,
                  paddingTop: theme.spacing.lg,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.title,
                  {
                    marginBottom: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.lg,
                  },
                ]}
                variant="title"
              >
                Seleccionar país
              </ThemedText>

              <View
                style={[
                  styles.searchRow,
                  {
                    backgroundColor: theme.colors.background.card,
                    borderColor: theme.colors.border.default,
                    borderRadius: theme.radius.md,
                    marginHorizontal: theme.spacing.lg,
                    marginBottom: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: theme.spacing.xs,
                    gap: theme.spacing.xs,
                  },
                ]}
              >
                <ThemedText
                  colorToken="secondary"
                  style={styles.searchIcon}
                  variant="bodySmall"
                >
                  🔍
                </ThemedText>
                <TextInput
                  style={[
                    styles.searchInput,
                    theme.typography.body,
                    {
                      color: theme.colors.text.primary,
                      paddingVertical: theme.spacing.xs,
                    },
                  ]}
                  placeholder="Buscar país o código…"
                  placeholderTextColor={theme.colors.text.muted}
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                  clearButtonMode="while-editing"
                />
              </View>

              <FlatList<CountryItem>
                data={filteredCountries}
                keyExtractor={(item) => item.code}
                renderItem={renderItem}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: theme.spacing['3xl'] },
                ]}
                style={styles.list}
                initialNumToRender={20}
                maxToRenderPerBatch={30}
                windowSize={10}
              />
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  trigger: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: {},
  triggerCaret: {},
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardWrapper: {
    width: '88%',
    maxWidth: 400,
  },
  card: {
    borderCurve: 'continuous',
    minHeight: 320,
    maxHeight: '70%',
  },
  title: {
    textAlign: 'center',
  },
  searchRow: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
  },
  list: {},
  listContent: {},
  menuItem: {
    marginVertical: 2,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuItemText: {},
  menuCheck: {},
  hiddenCheck: {
    opacity: 0,
  },
});
