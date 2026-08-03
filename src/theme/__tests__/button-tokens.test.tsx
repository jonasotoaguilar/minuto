import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PrimaryButton } from '@/theme/primitives/Button';
import { THEME_COLORS } from '@/theme/tokens/colors';

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const value = hex.replace('#', '');
    const [r, g, blue] = [0, 2, 4].map((offset) =>
      linearize(parseInt(value.slice(offset, offset + 2), 16)),
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * blue;
  };
  const [lighter, darker] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('PrimaryButton — L04 F09 token wiring', () => {
  test('primary CTA label uses text.inverse on brand.primary', () => {
    jest.spyOn(require('react-native'), 'useColorScheme').mockReturnValue(null);

    render(<PrimaryButton label="Crear cuenta" onPress={jest.fn()} />);

    const label = screen.getByText('Crear cuenta');
    const style = StyleSheet.flatten(label.props.style);
    const bg = THEME_COLORS.light.brand.primary;
    const fg = THEME_COLORS.light.text.inverse;

    expect(style.color).toBe(fg);
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
