import { THEME_COLORS } from '@/theme/tokens/colors';

const AA = 4.5;
const light = THEME_COLORS.light;
const dark = THEME_COLORS.dark;

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

function expectPair(fg: string, bg: string, min = AA): number {
  const ratio = contrastRatio(fg, bg);
  expect(ratio).toBeGreaterThanOrEqual(min);
  return ratio;
}

describe('L04 F09 — light-mode contrast (AA >= 4.5:1)', () => {
  test('primary CTA label (text.inverse on brand.primary) meets AA', () => {
    expectPair(light.text.inverse, light.brand.primary);
  });

  test('light brand.primary covers every common surface', () => {
    expectPair(light.brand.primary, light.background.card);
    expectPair(light.brand.primary, light.background.screen);
    expectPair(light.brand.primary, light.brand.muted);
  });

  test('light brand.accent covers links and pill text surfaces', () => {
    expectPair(light.brand.accent, light.background.card);
    expectPair(light.brand.accent, light.brand.muted);
  });

  test('light text.muted and text.secondary meet AA on card and screen', () => {
    expectPair(light.text.muted, light.background.card);
    expectPair(light.text.muted, light.background.screen);
    expectPair(light.text.secondary, light.background.card);
    expectPair(light.text.secondary, light.background.screen);
  });

  test('primary CTA contrast improved from measured 2.36:1', () => {
    const before = contrastRatio('#11B981', light.text.inverse);
    const after = contrastRatio(light.brand.primary, light.text.inverse);
    expect(after).toBeGreaterThanOrEqual(AA);
    expect(after).toBeGreaterThan(before * 2);
  });
});

describe('dark mode unaffected and still AA', () => {
  test('dark tokens keep AA on dark surfaces', () => {
    expectPair(dark.text.inverse, dark.brand.primary);
    expectPair(dark.brand.accent, dark.background.card);
    expectPair(dark.text.muted, dark.background.card);
    expectPair(dark.text.primary, dark.background.card);
  });

  test('dark brand.primary and text.muted are unchanged from trunk', () => {
    expect(dark.brand.primary).toBe('#12C187');
    expect(dark.brand.accent).toBe('#0FA579');
    expect(dark.text.muted).toBe('#8EA197');
  });
});
