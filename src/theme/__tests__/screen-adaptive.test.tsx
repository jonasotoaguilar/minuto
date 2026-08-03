import { render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';

import { Screen } from '@/theme/primitives/Screen';

function flattenContentContainerStyle(testID: string) {
  const scroll = screen.getByTestId(testID);
  return StyleSheet.flatten(scroll.props.contentContainerStyle);
}

describe('Screen — L04 F12 web adaptive content', () => {
  test('applies MaxContentWidth default on web and centers content', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    render(
      <Screen scroll scrollProps={{ testID: 'screen-scroll' }}>
        content
      </Screen>,
    );

    const style = flattenContentContainerStyle('screen-scroll');
    expect(style).toMatchObject({ maxWidth: 720, width: '100%' });
    expect(style.alignSelf).toBe('center');
  });

  test('caller contentContainerStyle overrides the default max width', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    render(
      <Screen
        scroll
        contentContainerStyle={{ maxWidth: 960 }}
        scrollProps={{ testID: 'screen-scroll' }}
      >
        content
      </Screen>,
    );

    const style = flattenContentContainerStyle('screen-scroll');
    expect(style.maxWidth).toBe(960);
  });

  test('does not apply the web cap on native', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    render(
      <Screen scroll scrollProps={{ testID: 'screen-scroll' }}>
        content
      </Screen>,
    );

    const style = flattenContentContainerStyle('screen-scroll');
    expect(style.maxWidth).toBeUndefined();
    expect(style.alignSelf).toBeUndefined();
  });
});
