import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';

import { BottomTabBar } from '@/components/bottom-tab-bar';

jest.mock('@/theme/hooks', () => ({
  useTheme: () => ({
    colors: {
      brand: { primary: '#047857', accent: '#0B775A' },
      text: { primary: '#1A2E22', secondary: '#5E7367', muted: '#5E7367' },
      shadow: { color: '#000000' },
    },
    surface: {
      glass: {
        strong: '#FFFFFF',
        soft: '#FFFFFF',
        tint: '#F0FDF4',
        border: '#D1FAE5',
      },
    },
    radius: { xl: 16, lg: 12 },
    spacing: { lg: 16 },
    elevation: { elevated: {} },
    typography: { caption: { fontSize: 12 } },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const SPANISH_LABELS = ['Inicio', 'Control', 'Equipo', 'Perfil'] as const;

function makeProps(activeIndex: number) {
  const routeNames = ['home', 'control', 'team', 'profile', 'control-history'];
  const routes = routeNames.map((name) => ({ key: `${name}-key`, name }));

  const state = {
    index: activeIndex,
    routes,
    routeNames,
    history: [],
    stale: false,
    type: 'tab',
  } as unknown as BottomTabBarProps['state'];

  const descriptors = Object.fromEntries(
    routes.map((route) => [route.key, { options: { title: route.name } }]),
  ) as unknown as BottomTabBarProps['descriptors'];

  const navigation = {
    navigate: jest.fn(),
  } as unknown as BottomTabBarProps['navigation'];

  return {
    state,
    descriptors,
    navigation,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
}

describe('BottomTabBar (L11 child PR1 — labels and selected state)', () => {
  it('renders four tabs with Spanish labels in order', () => {
    render(<BottomTabBar {...makeProps(0)} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual([
      ...SPANISH_LABELS,
    ]);
  });

  it('does not render the hidden control-history route as a tab', () => {
    render(<BottomTabBar {...makeProps(0)} />);

    expect(screen.queryByRole('tab', { name: /historial/i })).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('announces exactly one tab as selected', () => {
    render(<BottomTabBar {...makeProps(0)} />);

    expect(
      screen.getByRole('tab', { name: 'Inicio', selected: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('tab', { name: 'Control', selected: false }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('tab', { name: 'Equipo', selected: false }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('tab', { name: 'Perfil', selected: false }),
    ).toBeOnTheScreen();
  });

  it('moves the selected state when the active route changes', () => {
    const view = render(<BottomTabBar {...makeProps(2)} />);

    expect(screen.getByRole('tab', { name: 'Equipo' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Inicio' })).not.toBeSelected();

    view.rerender(<BottomTabBar {...makeProps(1)} />);

    expect(screen.getByRole('tab', { name: 'Control' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Equipo' })).not.toBeSelected();
  });

  it('marks the bar container as a tablist', () => {
    render(<BottomTabBar {...makeProps(0)} />);

    expect(screen.getByRole('tablist')).toBeOnTheScreen();
  });

  it('exposes Spanish accessible names that match the visible labels', () => {
    render(<BottomTabBar {...makeProps(0)} />);

    expect(screen.queryByRole('tab', { name: 'Home' })).toBeNull();

    for (const label of SPANISH_LABELS) {
      const tab = screen.getByRole('tab', { name: label });
      expect(within(tab).getByText(label)).toBeOnTheScreen();
    }
  });

  it('colors the selected label with the brand color and dims the rest', () => {
    render(<BottomTabBar {...makeProps(0)} />);

    expect(screen.getByText('Inicio')).toHaveStyle({ color: '#047857' });
    for (const label of ['Control', 'Equipo', 'Perfil']) {
      expect(screen.getByText(label)).toHaveStyle({ color: '#5E7367' });
    }
  });

  it('renders one icon per tab inside its tab', () => {
    render(<BottomTabBar {...makeProps(0)} />);

    const iconIds: Record<string, string> = {
      Inicio: 'bottom-tab-icon-home',
      Control: 'bottom-tab-icon-control',
      Equipo: 'bottom-tab-icon-team',
      Perfil: 'bottom-tab-icon-profile',
    };

    for (const [label, iconId] of Object.entries(iconIds)) {
      const tab = screen.getByRole('tab', { name: label });
      expect(within(tab).getByTestId(iconId)).toBeOnTheScreen();
    }
  });

  it.each([
    ['Control', 'control'],
    ['Equipo', 'team'],
    ['Perfil', 'profile'],
    ['Inicio', 'home'],
  ] as const)('navigates to %s when the tab is activated', (label, routeName) => {
    const props = makeProps(0);
    render(<BottomTabBar {...props} />);

    fireEvent.press(screen.getByRole('tab', { name: label }));

    expect(props.navigation.navigate).toHaveBeenCalledWith(routeName);
  });

  it('re-navigates when pressing the already selected tab', () => {
    const props = makeProps(0);
    render(<BottomTabBar {...props} />);

    fireEvent.press(screen.getByRole('tab', { name: 'Inicio' }));

    expect(props.navigation.navigate).toHaveBeenCalledWith('home');
  });
});
