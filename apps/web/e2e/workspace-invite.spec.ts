import { expect, test } from '@playwright/test';
import { createWorkspaceViaUi, registerViaUi, uniqueEmail } from './helpers';

test('acceptance #1: a workspace is created and an invited user joins it', async ({
  page,
  browser,
}) => {
  // Owner signs up and creates a workspace.
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'Hesap oluşturun' }).click();
  await registerViaUi(page, 'Ayşe Yılmaz', uniqueEmail('owner'));
  const workspacePath = await createWorkspaceViaUi(page, 'Kadıköy Gayrimenkul');
  await expect(page.getByRole('heading', { name: 'Merhaba, Ayşe' })).toBeVisible();

  // Owner invites a consultant from the team page.
  await page.getByRole('link', { name: 'Ekip' }).first().click();
  await expect(page).toHaveURL(`${workspacePath}/team`);
  const inviteeEmail = uniqueEmail('invitee');
  await page.getByLabel('E-posta').fill(inviteeEmail);
  await page.getByLabel('Rol').selectOption('MEMBER');
  await page.getByRole('button', { name: 'Davet oluştur' }).click();
  const link = await page.getByLabel('Davet linki').inputValue();
  expect(link).toMatch(/\/invite#token=/);
  await expect(page.getByRole('cell', { name: inviteeEmail })).toBeVisible();

  // Invitee opens the link in a separate browser session, registers and joins.
  const inviteeContext = await browser.newContext();
  const invitee = await inviteeContext.newPage();
  await invitee.goto(link);
  await expect(invitee.getByText('Kadıköy Gayrimenkul')).toBeVisible();
  await expect(invitee).not.toHaveURL(/token=/); // token removed from the address bar
  await invitee.getByRole('link', { name: 'Hesap oluştur' }).click();
  await registerViaUi(invitee, 'Mehmet Demir', inviteeEmail);
  await expect(invitee).toHaveURL(/\/invite$/);
  await invitee.getByRole('button', { name: /workspace'ine katıl/ }).click();
  await expect(invitee).toHaveURL(workspacePath);
  await expect(invitee.getByRole('heading', { name: 'Merhaba, Mehmet' })).toBeVisible();

  // Both members are listed; the invitation is no longer pending.
  await page.reload();
  await expect(page.getByRole('cell', { name: /Mehmet Demir/ })).toBeVisible();
  await expect(page.getByText('Bekleyen davet yok.')).toBeVisible();
  await inviteeContext.close();
});

test('acceptance #13: a user cannot open another tenant’s workspace', async ({ page, browser }) => {
  await page.goto('/register');
  await registerViaUi(page, 'Tenant A', uniqueEmail('a'));
  const workspaceA = await createWorkspaceViaUi(page, 'Ofis A');

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.goto('/register');
  await registerViaUi(other, 'Tenant B', uniqueEmail('b'));
  await createWorkspaceViaUi(other, 'Ofis B');

  await other.goto(workspaceA);
  await expect(other.getByRole('heading', { name: 'Sayfa bulunamadı' })).toBeVisible();
  await other.goto(`${workspaceA}/team`);
  await expect(other.getByRole('heading', { name: 'Sayfa bulunamadı' })).toBeVisible();
  await otherContext.close();
});

test('protected pages send anonymous visitors to login and back', async ({ page }) => {
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/login\?next=%2Fonboarding$/);
  await page.getByRole('link', { name: 'Hesap oluşturun' }).click();
  await registerViaUi(page, 'Yeni Kişi', uniqueEmail('new'));
  await expect(page).toHaveURL(/\/onboarding$/);
});

test('login never redirects to another site', async ({ page }) => {
  await page.goto('/register?next=//evil.example/steal');
  await registerViaUi(page, 'Güvenli Kişi', uniqueEmail('safe'));
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/onboarding$/);
});
