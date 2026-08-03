function loadConstantsFor(platform: string) {
  jest.resetModules();
  const { Platform } = require('react-native');
  jest.replaceProperty(Platform, 'OS', platform);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/constants/theme') as typeof import('@/constants/theme');
}

describe('theme layout constants', () => {
  test('BottomTabInset is nonzero on web (safe fallback ~64)', () => {
    expect(loadConstantsFor('web').BottomTabInset).toBe(64);
  });

  test('BottomTabInset keeps native values', () => {
    expect(loadConstantsFor('ios').BottomTabInset).toBe(50);
    expect(loadConstantsFor('android').BottomTabInset).toBe(80);
  });

  test('MaxContentWidth is the documented readable web width', () => {
    expect(loadConstantsFor('web').MaxContentWidth).toBe(720);
  });
});
