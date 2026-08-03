import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { Screen } from '@/theme/primitives/Screen';

describe('Screen — L04 F11 landmark semantics', () => {
  test('renders without a landmark role by default', () => {
    render(<Screen testID="screen-root">content</Screen>);

    expect(screen.getByTestId('screen-root').props.role).toBeUndefined();
  });

  test('applies the main landmark role on native', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    render(
      <Screen role="main" testID="screen-root">
        content
      </Screen>,
    );

    expect(screen.getByTestId('screen-root').props.role).toBe('main');
  });

  test('applies the main landmark role on web', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    render(
      <Screen role="main" testID="screen-root">
        content
      </Screen>,
    );

    expect(screen.getByTestId('screen-root').props.role).toBe('main');
  });
});
