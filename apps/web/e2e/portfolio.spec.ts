import { expect, test } from '@playwright/test';
import { createWorkspaceViaUi, registerViaUi, uniqueEmail } from './helpers';

test('acceptance #2 and #3: import a CSV, see it listed, open detail with coverage', async ({
  page,
}) => {
  await page.goto('/register');
  await registerViaUi(page, 'Portföy Sahibi', uniqueEmail('portfolio'));
  const workspacePath = await createWorkspaceViaUi(page, 'Portföy Ofisi');

  await page.goto(`${workspacePath}/properties/import`);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'portfoy.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'Portföy No;İlan Başlığı;İşlem Türü;Fiyat;Oda Sayısı;Brüt m²;İl;İlçe',
        'E2E-1;Moda 3+1;Satılık;12.500.000 TL;3+1;145;İstanbul;Kadıköy',
        'E2E-2;Bahçeli 2+1;Kiralık;45.000 TL;2+1;95;İstanbul;Kadıköy',
        'E2E-3;Hatalı;Devren;1.000 TL;;;İstanbul;Şişli',
      ].join('\n'),
      'utf8',
    ),
  });
  await expect(page.getByText('Sütunları eşleyin', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Önizle' }).click();
  await expect(page.getByText('Önizleme', { exact: true })).toBeVisible();
  await expect(page.getByText('3 satırın 2 tanesi içe aktarılabilir')).toBeVisible();
  await page.getByRole('button', { name: '2 kaydı içe aktar' }).click();
  await expect(page.getByText('İçe aktarma tamamlandı')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('link', { name: 'Portföye git' }).click();
  await expect(page.getByRole('link', { name: 'Moda 3+1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bahçeli 2+1' })).toBeVisible();

  await page.getByRole('link', { name: 'Moda 3+1' }).click();
  await expect(page.getByText('Veri doluluğu', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Fotoğraflar (0)')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Veri doluluğu' })).toBeVisible();
});
