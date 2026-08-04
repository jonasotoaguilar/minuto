import { createRequestKey, RequestCache } from '@/lib/request-cache';

describe('createRequestKey', () => {
  it('is deterministic regardless of property insertion order', () => {
    const left = createRequestKey('rpc', {
      a: 1,
      b: 'x',
      nested: { y: true, x: null },
    });
    const right = createRequestKey('rpc', {
      b: 'x',
      nested: { x: null, y: true },
      a: 1,
    });

    expect(left).toBe(right);
  });

  it('distinguishes different values and undefined params', () => {
    const base = createRequestKey('rpc', { a: 1, b: 'x' });

    expect(createRequestKey('rpc', { a: 2, b: 'x' })).not.toBe(base);
    expect(createRequestKey('rpc', { a: 1, b: 'x', c: undefined })).not.toBe(
      base,
    );
    expect(createRequestKey('other', { a: 1, b: 'x' })).not.toBe(base);
  });

  it('handles arrays and nested objects', () => {
    const left = createRequestKey('rpc', { ids: [3, 1, 2] });
    const right = createRequestKey('rpc', { ids: [3, 1, 2] });

    expect(left).toBe(right);
    expect(createRequestKey('rpc', { ids: [1, 2, 3] })).not.toBe(left);
  });
});

describe('RequestCache', () => {
  it('deduplicates concurrent identical requests into one load', async () => {
    let resolveLoad!: (value: string) => void;
    const load = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const cache = new RequestCache();

    const first = cache.getOrLoad('key', load);
    const second = cache.getOrLoad('key', load);

    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);

    resolveLoad('value');

    await expect(first).resolves.toBe('value');
    await expect(second).resolves.toBe('value');
  });

  it('serves cached hits without reloading', async () => {
    const load = jest.fn().mockResolvedValue('value');
    const cache = new RequestCache();

    await cache.getOrLoad('key', load);
    await expect(cache.getOrLoad('key', load)).resolves.toBe('value');

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('loads separately for different keys', async () => {
    const load = jest.fn().mockResolvedValue('value');
    const cache = new RequestCache();

    await cache.getOrLoad('a', load);
    await cache.getOrLoad('b', load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('expires entries once the ttl elapses', async () => {
    let clock = 0;
    const load = jest.fn().mockResolvedValue('value');
    const cache = new RequestCache({ defaultTtlMs: 30_000, now: () => clock });

    await cache.getOrLoad('key', load);

    clock = 29_999;
    await cache.getOrLoad('key', load);
    expect(load).toHaveBeenCalledTimes(1);

    clock = 30_000;
    await cache.getOrLoad('key', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('honors the per-call ttl override', async () => {
    let clock = 0;
    const load = jest.fn().mockResolvedValue('value');
    const cache = new RequestCache({ defaultTtlMs: 1_000, now: () => clock });

    await cache.getOrLoad('key', load, { ttlMs: 100 });

    clock = 101;
    await cache.getOrLoad('key', load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('evicts the least recently used entry at capacity', async () => {
    const clock = 0;
    const cache = new RequestCache({ maxEntries: 2, now: () => clock });
    const loadA = jest.fn().mockResolvedValue('a');
    const loadB = jest.fn().mockResolvedValue('b');
    const loadC = jest.fn().mockResolvedValue('c');

    await cache.getOrLoad('a', loadA);
    await cache.getOrLoad('b', loadB);
    await cache.getOrLoad('a', loadA);

    await cache.getOrLoad('c', loadC);

    await expect(cache.getOrLoad('a', loadA)).resolves.toBe('a');
    expect(loadA).toHaveBeenCalledTimes(1);

    await expect(cache.getOrLoad('b', loadB)).resolves.toBe('b');
    expect(loadB).toHaveBeenCalledTimes(2);
  });

  it('never caches rejected loads', async () => {
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue('recovered');
    const cache = new RequestCache();

    await expect(cache.getOrLoad('key', load)).rejects.toThrow('boom');
    await expect(cache.getOrLoad('key', load)).resolves.toBe('recovered');

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not evict a newer entry when a stale load rejects', async () => {
    const staleLoad = jest.fn().mockRejectedValueOnce(new Error('boom'));
    const freshLoad = jest.fn().mockResolvedValue('fresh');
    const cache = new RequestCache();

    const stale = cache.getOrLoad('key', staleLoad);
    cache.invalidate('key');
    const fresh = cache.getOrLoad('key', freshLoad);

    await expect(stale).rejects.toThrow('boom');
    await expect(fresh).resolves.toBe('fresh');

    await expect(
      cache.getOrLoad('key', jest.fn().mockResolvedValue('other')),
    ).resolves.toBe('fresh');
    expect(freshLoad).toHaveBeenCalledTimes(1);
  });

  it('invalidate removes a single key', async () => {
    const load = jest.fn().mockResolvedValue('value');
    const cache = new RequestCache();

    await cache.getOrLoad('a', load);
    expect(cache.size).toBe(1);

    cache.invalidate('a');
    expect(cache.size).toBe(0);

    await cache.getOrLoad('a', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('invalidateWhere removes only matching keys', async () => {
    const load = jest.fn().mockResolvedValue('value');
    const cache = new RequestCache();

    await cache.getOrLoad('get_attendance_history_page(org-1)', load);
    await cache.getOrLoad('get_attendance_records(org-1)', load);

    cache.invalidateWhere((key) =>
      key.startsWith('get_attendance_history_page'),
    );

    await cache.getOrLoad('get_attendance_history_page(org-1)', load);
    await cache.getOrLoad('get_attendance_records(org-1)', load);

    expect(load).toHaveBeenCalledTimes(3);
  });

  it('clear resets every entry', async () => {
    const load = jest.fn().mockResolvedValue('value');
    const cache = new RequestCache();

    await cache.getOrLoad('a', load);
    await cache.getOrLoad('b', load);
    expect(cache.size).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);

    await cache.getOrLoad('a', load);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it.each([
    [{ maxEntries: 0 }],
    [{ defaultTtlMs: 0 }],
  ])('passes through when caching is disabled (%o)', async (options) => {
    const load = jest.fn().mockResolvedValue('value');
    const cache = new RequestCache(options);

    await cache.getOrLoad('key', load);
    await cache.getOrLoad('key', load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('passes through when the per-call ttl is zero', async () => {
    const load = jest.fn().mockResolvedValue('value');
    const cache = new RequestCache();

    await cache.getOrLoad('key', load, { ttlMs: 0 });
    await cache.getOrLoad('key', load, { ttlMs: 0 });

    expect(load).toHaveBeenCalledTimes(2);
  });
});
