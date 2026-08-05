import { expect, test } from '@playwright/test';

import { loginAs } from '../helpers';
import { SEED_ORG_NAME, SEED_USER } from '../seed/fixtures';

test.describe('Read-only authenticated navigation', () => {
  test('walks the main tabs as the seeded user without mutating data', async ({
    page,
  }) => {
    await loginAs(page, SEED_USER);

    // Inicio: seeded user snapshot and today attendance.
    await expect(page.getByText(SEED_USER.fullName)).toBeVisible();

    // Control: recent history rendered from seeded records.
    await page.getByRole('tab', { name: 'Control' }).click();
    await expect(page).toHaveURL(/\/control/);
    await expect(page.getByText('Historial reciente')).toBeVisible();

    // Equipo: seeded organization and its members.
    await page.getByRole('tab', { name: 'Equipo' }).click();
    await expect(page).toHaveURL(/\/team/);
    await expect(page.getByText(SEED_ORG_NAME).first()).toBeVisible();
    await expect(page.getByText('Miembros', { exact: true })).toBeVisible();

    // Perfil: settings surface and seeded identity.
    await page.getByRole('tab', { name: 'Perfil' }).click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByText('Configuración')).toBeVisible();

    // Back to Inicio: session still intact after the walk.
    await page.getByRole('tab', { name: 'Inicio' }).click();
    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByText(SEED_USER.fullName).first()).toBeVisible();
  });
});
