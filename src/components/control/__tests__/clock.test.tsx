import { act, render, screen } from '@testing-library/react-native';

import { LiveClock } from '@/components/control/clock';

describe('LiveClock', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-03T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the current time and the long date', () => {
    render(<LiveClock currentTimezone="UTC" />);

    expect(screen.getByText('12:00:00')).toBeOnTheScreen();
    expect(screen.getByText(/de 2026/)).toBeOnTheScreen();
  });

  it('ticks the clock every second', () => {
    render(<LiveClock currentTimezone="UTC" />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('12:00:01')).toBeOnTheScreen();

    act(() => {
      jest.advanceTimersByTime(59_000);
    });

    expect(screen.getByText('12:01:00')).toBeOnTheScreen();
  });

  it('stops the interval on unmount', () => {
    const { unmount } = render(<LiveClock currentTimezone="UTC" />);

    unmount();

    expect(jest.getTimerCount()).toBe(0);
  });
});
