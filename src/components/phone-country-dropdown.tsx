import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import {
  countryCodeToFlag,
  getPhoneCountry,
  PHONE_COUNTRIES,
  type PhoneCountryCode,
} from '@/lib/phone';

type ThemeShape = {
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  backgroundElement: string;
  backgroundSelected: string;
  shadow: string;
};

type PhoneCountryDropdownProps = {
  countryCode: PhoneCountryCode;
  onChangeCountry: (countryCode: PhoneCountryCode) => void;
  theme: ThemeShape;
  disabled?: boolean;
  minWidth?: number;
};

export function PhoneCountryDropdown({
  countryCode,
  onChangeCountry,
  theme,
  disabled,
  minWidth = 120,
}: PhoneCountryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState({
    x: 0,
    y: 0,
    width: minWidth,
    height: 40,
  });
  const triggerRef = useRef<View | null>(null);
  const selectedCountry = getPhoneCountry(countryCode);
  const selectedFlag = countryCodeToFlag(countryCode);

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({
        x,
        y,
        width: Math.max(width, minWidth),
        height,
      });
      setIsOpen(true);
    });
  };

  return (
    <View style={[styles.wrapper, { minWidth }]}>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          disabled={disabled}
          onPress={() => {
            if (isOpen) {
              setIsOpen(false);
              return;
            }
            openMenu();
          }}
          style={[
            styles.trigger,
            {
              borderColor: theme.border,
              backgroundColor: theme.backgroundElement,
              opacity: disabled ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.triggerText, { color: theme.text }]}>
            {selectedFlag} +{selectedCountry.dialCode}
          </Text>
          <Text style={[styles.triggerCaret, { color: theme.textSecondary }]}>
            {isOpen ? '^' : 'v'}
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setIsOpen(false)}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View
              style={[
                styles.menu,
                {
                  width: Math.max(anchor.width, 220),
                  top: anchor.y + anchor.height + 6,
                  left: anchor.x,
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}
            >
              <ScrollView style={styles.menuList} showsVerticalScrollIndicator>
                {PHONE_COUNTRIES.map((country) => (
                  <Pressable
                    key={country.code}
                    onPress={() => {
                      onChangeCountry(country.code);
                      setIsOpen(false);
                    }}
                    style={[
                      styles.menuItem,
                      country.code === countryCode
                        ? { backgroundColor: theme.backgroundSelected }
                        : null,
                    ]}
                  >
                    <Text style={[styles.menuItemText, { color: theme.text }]}>
                      {countryCodeToFlag(country.code)} {country.name} (+
                      {country.dialCode})
                    </Text>
                    <Text
                      style={[
                        styles.menuCheck,
                        {
                          color:
                            country.code === countryCode
                              ? theme.primary
                              : 'transparent',
                        },
                      ]}
                    >
                      ✓
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 120,
    elevation: 120,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  trigger: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  triggerCaret: {
    fontSize: 12,
    fontWeight: '700',
  },
  menu: {
    position: 'absolute',
    top: 42,
    width: 220,
    borderRadius: 14,
    borderWidth: 1,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 140,
    zIndex: 140,
  },
  menuList: {
    maxHeight: 220,
  },
  menuItem: {
    marginHorizontal: Spacing.one,
    marginVertical: 2,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuCheck: {
    fontSize: 14,
    fontWeight: '700',
  },
});
