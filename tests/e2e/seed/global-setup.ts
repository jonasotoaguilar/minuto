import { spawnSync } from 'node:child_process';
import type { FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import {
  getLocalSupabaseEnv,
  resetSeedUserSql,
  SEED_USER,
  seedUserSql,
} from './fixtures';

/**
 * Playwright global setup: deterministic local Supabase seed. Resets and
 * recreates the seed user (admin API) plus its org/member/office/attendance
 * fixtures via SQL against the local stack. Idempotent.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const { apiUrl, serviceRoleKey } = getLocalSupabaseEnv();

  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existing = await admin.auth.admin.listUsers({ perPage: 1000 });
  const seedUser = existing.data.users.find(
    (user) => user.email === SEED_USER.email,
  );

  if (seedUser) {
    runSql(resetSeedUserSql(seedUser.id));
    const { error: resetError } = await admin.auth.admin.deleteUser(
      seedUser.id,
    );
    if (resetError) {
      throw new Error(
        `E2E seed: could not delete previous seed user: ${resetError.message}`,
      );
    }
  }

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: SEED_USER.email,
      password: SEED_USER.password,
      email_confirm: true,
      user_metadata: {
        display_name: SEED_USER.fullName,
        phone: SEED_USER.phone,
      },
    });

  if (createError || !created.user) {
    throw new Error(
      `E2E seed: could not create seed user: ${createError?.message}`,
    );
  }

  runSql(seedUserSql(created.user.id));

  console.log(
    `E2E seed: seeded ${SEED_USER.email} (${created.user.id}) on ${apiUrl}`,
  );
}

function runSql(sql: string): void {
  const result = spawnSync('supabase', ['db', 'query', '--local', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(
      `E2E seed: SQL failed: ${result.stderr?.trim() || result.stdout?.trim()}`,
    );
  }
}
