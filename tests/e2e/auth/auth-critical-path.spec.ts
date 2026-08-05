import { expect, test } from '@playwright/test';

import { fillFormField, loginAs } from '../helpers';
import { SEED_USER } from '../seed/fixtures';

test.describe('Auth critical path (deterministic seed user)', () => {
  test('logs in and sees seeded attendance on home', async ({ page }) => {
    await loginAs(page, SEED_USER);

    await expect(page.getByText(SEED_USER.fullName)).toBeVisible();
    await expect(page.getByText('Jornada completada')).toBeVisible();
  });

  test('keeps the session after a full reload', async ({ page }) => {
    await loginAs(page, SEED_USER);
    // Wait until the home data has loaded so the reload boots the app from a
    // settled state instead of interrupting in-flight session refresh.
    await expect(page.getByText('Jornada completada')).toBeVisible();
    await page.reload();

    await expect(page.getByText(SEED_USER.fullName)).toBeVisible();
    await expect(page.getByText('Jornada completada')).toBeVisible();
  });

  test('logs out from profile and returns to login', async ({ page }) => {
    await loginAs(page, SEED_USER);

    await page.getByRole('tab', { name: 'Perfil' }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Bienvenido a Minuto')).toBeVisible();

    // Reloading after logout must not restore the session.
    await page.reload();
    await expect(page.getByText('Bienvenido a Minuto')).toBeVisible();
  });

  test('guards protected deep links: signed-out users land on login', async ({
    page,
  }) => {
    await page.goto('/profile');

    await expect(page).toHaveURL(/\/login\?redirect=/);
    await expect(page.getByText('Bienvenido a Minuto')).toBeVisible();
  });

  test('preserves the deep-link target after signing in', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login\?redirect=/);

    await fillFormField(page.getByLabel('Email'), SEED_USER.email);
    await fillFormField(
      page.getByRole('textbox', { name: '********' }),
      SEED_USER.password,
    );
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    await expect(page).toHaveURL(/\/profile/);
    await expect(
      page.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeVisible();
  });
});
