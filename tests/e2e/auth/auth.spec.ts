import { test } from '@playwright/test';

test.describe('Auth critical path', () => {
  test.skip('registers a user and reaches organization setup', async () => {
    // TODO: enable after auth form accessibility labels and Supabase E2E seed are in place.
  });
});
