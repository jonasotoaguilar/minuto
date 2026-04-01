import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COMMON_TIMEZONES, IANA_TIMEZONES } from '@/constants/timezones';
import { useTheme } from '@/hooks/use-theme';
import { PlainCard, ThemedText } from '@/theme/primitives';

interface TimezonePickerProps {
  value: string;
  onValueChange: (tz: string) => void;
}

const ITEM_HEIGHT = 56;

function getUtcOffset(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const offsetPart = parts.find((part) => part.type === 'timeZoneName');
    return offsetPart?.value ?? '';
  } catch {
    return '';
  }
}

function buildOrderedList(query: string): readonly string[] {
  if (query.length === 0) {
    const commonSet = new Set(COMMON_TIMEZONES);
    const rest = IANA_TIMEZONES.filter((tz) => !commonSet.has(tz));
    return [...COMMON_TIMEZONES, ...rest];
  }

  const lower = query.toLowerCase();
  return IANA_TIMEZONES.filter((tz) => tz.toLowerCase().includes(lower));
}

interface TimezoneItemProps {
  tz: string;
  isSelected: boolean;
  onSelect: (tz: string) => void;
}

const TimezoneItem = React.memo(function TimezoneItem({
  tz,
  isSelected,
  onSelect,
}: TimezoneItemProps) {
  const theme = useTheme();
  const utcOffset = useMemo(() => getUtcOffset(tz), [tz]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onSelect(tz)}
      style={[
        styles.item,
        {
          backgroundColor: isSelected
            ? theme.colors.background.selected
            : 'transparent',
        },
      ]}
    >
      <View style={styles.itemCopy}>
        <ThemedText
          style={isSelected ? styles.selectedLabel : null}
          variant="body"
        >
          {tz}
        </ThemedText>
        {utcOffset ? (
          <ThemedText colorToken="secondary" variant="caption">
            {utcOffset}
          </ThemedText>
        ) : null}
      </View>

      {isSelected ? (
        <ThemedText
          colorToken="accent"
          style={styles.checkmark}
          variant="label"
        >
          ✓
        </ThemedText>
      ) : null}
    </Pressable>
  );
});

export function TimezonePicker({ value, onValueChange }: TimezonePickerProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<string>>(null);

  const filteredTimezones = useMemo(
    () => buildOrderedList(searchQuery),
    [searchQuery],
  );

  const selectedIndex = useMemo(
    () => filteredTimezones.indexOf(value),
    [filteredTimezones, value],
  );

  const handleOpen = useCallback(() => {
    setSearchQuery('');
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  const handleSelect = useCallback(
    (tz: string) => {
      onValueChange(tz);
      handleClose();
    },
    [handleClose, onValueChange],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<string> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <TimezoneItem
        isSelected={item === value}
        onSelect={handleSelect}
        tz={item}
      />
    ),
    [handleSelect, value],
  );

  const keyExtractor = useCallback((item: string) => item, []);

  const handleModalShow = useCallback(() => {
    if (selectedIndex > 0) {
      listRef.current?.scrollToIndex({
        animated: false,
        index: selectedIndex,
        viewPosition: 0.3,
      });
    }
  }, [selectedIndex]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={handleOpen}
        style={[
          styles.trigger,
          {
            backgroundColor: theme.colors.background.card,
            borderColor: theme.colors.border.default,
          },
        ]}
      >
        <ThemedText
          colorToken={value ? 'primary' : 'secondary'}
          style={styles.triggerValue}
          variant="body"
        >
          {value || 'Seleccionar zona horaria'}
        </ThemedText>
        <ThemedText
          colorToken="secondary"
          style={styles.triggerCaret}
          variant="caption"
        >
          ›
        </ThemedText>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={handleClose}
        onShow={handleModalShow}
        transparent
        visible={isOpen}
      >
        <Pressable
          onPress={handleClose}
          style={[styles.modalRoot, { backgroundColor: theme.overlay.scrim }]}
        >
          <Pressable onPress={() => undefined} style={styles.sheetWrapper}>
            <PlainCard
              padding={0}
              style={[
                styles.sheet,
                {
                  backgroundColor: theme.colors.background.card,
                  paddingBottom: insets.bottom + 16,
                  shadowColor: theme.colors.shadow.color,
                  ...theme.elevation.modal,
                },
              ]}
            >
              <View
                style={[
                  styles.sheetHeader,
                  { borderBottomColor: theme.colors.border.default },
                ]}
              >
                <ThemedText variant="title">Zona horaria</ThemedText>

                <Pressable
                  accessibilityRole="button"
                  onPress={handleClose}
                  style={[
                    styles.closeButton,
                    {
                      backgroundColor: theme.colors.background.card,
                      borderColor: theme.colors.border.default,
                    },
                  ]}
                >
                  <ThemedText variant="label">✕</ThemedText>
                </Pressable>
              </View>

              <View style={styles.searchWrap}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setSearchQuery}
                  placeholder="Buscar zona horaria..."
                  placeholderTextColor={theme.colors.text.muted}
                  returnKeyType="search"
                  style={[
                    styles.searchInput,
                    theme.typography.body,
                    {
                      backgroundColor: theme.colors.background.card,
                      borderColor: theme.colors.border.default,
                      color: theme.colors.text.primary,
                    },
                  ]}
                  value={searchQuery}
                />
              </View>

              <FlatList
                ref={listRef}
                contentContainerStyle={styles.listContent}
                data={filteredTimezones as string[]}
                getItemLayout={getItemLayout}
                initialNumToRender={20}
                keyboardShouldPersistTaps="handled"
                keyExtractor={keyExtractor}
                maxToRenderPerBatch={30}
                onScrollToIndexFailed={() => {
                  /* ignore — safe fallback */
                }}
                renderItem={renderItem}
                showsVerticalScrollIndicator
                windowSize={10}
              />
            </PlainCard>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  triggerValue: {
    flex: 1,
  },
  triggerCaret: {
    marginLeft: 8,
  },
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetWrapper: {
    maxWidth: 400,
    width: '88%',
  },
  sheet: {
    borderCurve: 'continuous',
    maxHeight: '85%',
  },
  sheetHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  closeButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  searchWrap: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  searchInput: {
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  listContent: {
    paddingBottom: 16,
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  item: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    height: ITEM_HEIGHT,
    justifyContent: 'space-between',
    marginHorizontal: 4,
    paddingHorizontal: 16,
  },
  itemCopy: {
    flex: 1,
    gap: 2,
  },
  selectedLabel: {
    fontWeight: '700',
  },
  checkmark: {
    fontSize: 16,
  },
});
