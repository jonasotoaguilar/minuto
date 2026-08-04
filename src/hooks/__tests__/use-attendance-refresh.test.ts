import { act, renderHook } from '@testing-library/react-native';

import { useAttendanceFocusRefresh } from '@/hooks/use-attendance-refresh';

const mockUseFocusEffect = jest.fn();

jest.mock('expo-router', () => ({
  useFocusEffect: (...args: unknown[]) => mockUseFocusEffect(...args),
}));

const mockRefresh = jest.fn();

function captureFocusCallbacks() {
  const focusCallbacks: Array<() => void> = [];
  mockUseFocusEffect.mockImplementation((callback: () => void) => {
    focusCallbacks.push(callback);
  });

  return focusCallbacks;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

function renderRefresh() {
  return renderHook(() => useAttendanceFocusRefresh({ refresh: mockRefresh }));
}

describe('useAttendanceFocusRefresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs the refresh only when the screen gains focus', () => {
    const focusCallbacks = captureFocusCallbacks();
    const { result } = renderRefresh();

    expect(mockRefresh).not.toHaveBeenCalled();

    act(() => {
      focusCallbacks.at(-1)!();
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.isRefreshing).toBe(true);
  });

  it('refreshes again on each re-focus', () => {
    const focusCallbacks = captureFocusCallbacks();
    renderRefresh();

    act(() => {
      focusCallbacks.at(-1)!();
      focusCallbacks.at(-1)!();
    });

    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it('resolves the imperative refresh when the loader completes', async () => {
    captureFocusCallbacks();
    const pending = deferred();
    mockRefresh.mockReturnValueOnce(pending.promise);

    const { result } = renderRefresh();

    let settled = false;
    act(() => {
      void result.current.refresh().then(() => {
        settled = true;
      });
    });

    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      pending.resolve();
    });

    expect(settled).toBe(true);
    expect(result.current.isRefreshing).toBe(false);
  });

  it('stale completions cannot clear a newer refresh flag', async () => {
    captureFocusCallbacks();
    const first = deferred();
    const second = deferred();
    mockRefresh.mockReturnValueOnce(first.promise);
    mockRefresh.mockReturnValueOnce(second.promise);

    const { result } = renderRefresh();

    act(() => {
      void result.current.refresh();
      void result.current.refresh();
    });

    expect(mockRefresh).toHaveBeenCalledTimes(2);
    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      first.resolve();
    });

    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      second.resolve();
    });

    expect(result.current.isRefreshing).toBe(false);
  });

  it('ignores focus and imperative refreshes after unmount', async () => {
    const focusCallbacks = captureFocusCallbacks();
    const { result, unmount } = renderRefresh();
    const refresh = result.current.refresh;

    unmount();

    act(() => {
      focusCallbacks.at(-1)!();
    });

    await act(async () => {
      await refresh();
    });

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('always invokes the latest refresh callback', () => {
    const focusCallbacks = captureFocusCallbacks();
    const firstRefresh = jest.fn();
    const secondRefresh = jest.fn();

    const { rerender } = renderHook(
      (props: { refresh: () => Promise<void> | void }) =>
        useAttendanceFocusRefresh({ refresh: props.refresh }),
      { initialProps: { refresh: firstRefresh } },
    );
    rerender({ refresh: secondRefresh });

    act(() => {
      focusCallbacks.at(-1)!();
    });

    expect(secondRefresh).toHaveBeenCalledTimes(1);
    expect(firstRefresh).not.toHaveBeenCalled();
  });

  it('handles a synchronous void refresh', async () => {
    captureFocusCallbacks();
    const { result } = renderRefresh();

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.isRefreshing).toBe(false);
  });
});
