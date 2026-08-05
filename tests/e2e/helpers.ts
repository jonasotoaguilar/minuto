import { expect, type Locator, type Page } from '@playwright/test';

export interface TestUser {
  email: string;
  fullName: string;
  password: string;
  phone: string;
}

export function createTestUser(prefix = 'e2e'): TestUser {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    email: `${prefix}.${id}@example.com`,
    fullName: 'E2E Test User',
    password: 'TestPassword123',
    phone: '+56912345678',
  };
}

/**
 * Fills a form field twice, paced. The Expo web build drops input events that
 * land in the first few milliseconds after a route mounts (the DOM shows the
 * value but React state never receives it, and the next render clears the
 * field), so the second fill guarantees the value reaches React state.
 */
export async function fillFormField(
  locator: Locator,
  value: string,
): Promise<void> {
  await locator.fill(value);
  await locator.page().waitForTimeout(250);
  await locator.fill(value);
}

/**
 * Signs in with the given credentials on the login screen and waits until the
 * authenticated home snapshot (user full name) is visible.
 */
export async function loginAs(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');
  await expect(page.getByText('Bienvenido a Minuto')).toBeVisible();
  await fillFormField(page.getByLabel('Email'), user.email);
  await fillFormField(
    page.getByRole('textbox', { name: '********' }),
    user.password,
  );
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await expect(page.getByText(user.fullName).first()).toBeVisible();
}
