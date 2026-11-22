import { expect, type Page } from '@playwright/test';

let counter = 0;
export function uniqueEmail(label: string): string {
  counter += 1;
  return `${label}.${Date.now()}.${counter}@example.test`;
}

export const PASSWORD = 'correct-horse-battery';

export async function registerViaUi(page: Page, name: string, email: string): Promise<void> {
  await page.getByLabel('Ad soyad').fill(name);
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre').fill(PASSWORD);
  // Consent to terms (required) before submitting.
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: 'Hesap oluştur' }).click();
}

export async function createWorkspaceViaUi(page: Page, name: string): Promise<string> {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel('Ofis veya ekip adı').fill(name);
  await page.getByRole('button', { name: 'Workspace oluştur' }).click();
  await expect(page).toHaveURL(/\/w\/[a-z0-9-]+$/);
  return new URL(page.url()).pathname;
}
