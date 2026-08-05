import { expect, test } from '@playwright/test';

import { createTestUser, fillFormField } from '../helpers';

test.describe('Auth: register and organization setup', () => {
  test('registers a fresh user and reaches home after creating an organization', async ({
    page,
  }) => {
    const user = createTestUser();

    await page.goto('/register');
    await expect(page.getByText('Crea tu cuenta')).toBeVisible();
    await fillFormField(page.getByLabel('Nombre completo'), user.fullName);
    await fillFormField(page.getByLabel('Dirección'), 'Av. Siempre Viva 123');
    await fillFormField(page.getByLabel('Email'), user.email);
    await fillFormField(
      page.getByRole('textbox', { name: '0 0000 0000' }),
      '9 1234 5678',
    );
    await fillFormField(
      page.getByRole('textbox', { name: '********' }).nth(0),
      user.password,
    );
    await fillFormField(
      page.getByRole('textbox', { name: '********' }).nth(1),
      user.password,
    );
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    // Successful sign-up redirects back to login.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Bienvenido a Minuto')).toBeVisible();

    // First login lands on organization setup for a user without orgs.
    await fillFormField(page.getByLabel('Email'), user.email);
    await fillFormField(
      page.getByRole('textbox', { name: '********' }),
      user.password,
    );
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    await expect(page.getByText('Organización requerida')).toBeVisible();
    await fillFormField(
      page.getByLabel('Nombre de la organización'),
      'E2E Registro Org',
    );
    await page.getByRole('button', { name: 'Crear organización' }).click();

    await expect(page.getByText(user.fullName).first()).toBeVisible();
    await expect(page.getByText('Registrá tu jornada')).toBeVisible();
  });
});
