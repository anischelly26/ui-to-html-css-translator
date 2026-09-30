import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { sampleProject } from '../src/sample';

const key = process.env.FORM_TEST_KEY || 'ci-fixture-key';

async function connect(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Make pixels programmable.' })).toBeVisible();
  await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await page.getByLabel('Server access key').fill(key);
  await page.getByRole('button', { name: 'Save and test connection' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
}

test('editing, saving, reload, removal and recovery preserve the workspace', async ({ page }) => {
  await connect(page);
  await page.getByRole('tab', { name: 'Preview', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Source', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Code', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await page.getByLabel('HTML code editor').fill('<main><h1>My saved interface</h1></main>');
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await expect(page.getByLabel('HTML code editor')).toHaveValue('<main><h1>My saved interface</h1></main>');

  // Remove a saved copy while its next autosave is pending; it must stay removed.
  await page.getByLabel('HTML code editor').fill('<main><h1>Unsaved local changes</h1></main>');
  await page.getByRole('button', { name: /^My workspaces/ }).click();
  await page.getByRole('button', { name: /^Remove saved copy of/ }).click();
  await expect(page.getByRole('heading', { name: 'A clean slate.' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.locator('.toast').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Workspace restored.');
  await page.getByRole('button', { name: /^My workspaces/ }).click();
  await expect(page.locator('.saved-project')).toHaveCount(1);
  await page.getByRole('button', { name: /^Remove saved copy of/ }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.getByRole('button', { name: /^My workspaces/ }).click();
  const backup = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up current workspace' }).click();
  await backup;
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('.toast').getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
  await page.waitForTimeout(1000); // Cross the autosave boundary before reloading.
  await page.reload();
  await page.getByRole('button', { name: /^My workspaces/ }).click();
  await expect(page.getByRole('heading', { name: 'A clean slate.' })).toBeVisible();
});

test('real screenshot → OCR → correction → undo → ZIP works at desktop and mobile widths', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await connect(page);
  const fixture = JSON.parse(await readFile(new URL('./fixtures/screenshot.json', import.meta.url), 'utf8'));
  await page.getByLabel('Upload screenshot', { exact: true }).setInputFiles({ name: 'Hello FORM.png',
    mimeType: 'image/png', buffer: Buffer.from(fixture.png, 'base64') });
  await expect(page.getByRole('tab', { name: 'Source', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Generate interface' }).click();
  await expect(page.getByRole('tab', { name: 'Compare', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
  await page.getByLabel('Search detected elements').fill('Hello FORM');
  await page.locator('.element-row').filter({ hasText: 'Hello FORM' }).click();
  await page.getByRole('textbox', { name: 'Element content', exact: true }).fill('A corrected heading');
  await page.getByRole('button', { name: 'Apply correction' }).click();
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await expect(page.getByLabel('HTML code editor')).toHaveValue(/A corrected heading/);
  await page.getByRole('button', { name: 'Undo last reconstruction change' }).click();
  await expect(page.getByRole('textbox', { name: 'Element content', exact: true })).toHaveValue('Hello FORM');
  await expect(page.getByLabel('HTML code editor')).not.toHaveValue(/A corrected heading/);
  await page.getByRole('tab', { name: 'Preview', exact: true }).click();
  await expect(page.frameLocator('iframe[title="Reconstructed interface preview"]').getByText('Hello FORM', { exact: true })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export code' }).click();
  const archive = await download;
  expect(archive.suggestedFilename()).toBe('form-interface.zip');
  const zip = await readFile((await archive.path())!);
  expect(zip.subarray(0, 2).toString()).toBe('PK');
  await page.getByLabel('Search detected elements').fill('');
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('desktop.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: info.outputPath('dark.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Mobile preview', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('mobile.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('button', { name: /^My workspaces/ })).toBeVisible();
  await page.getByRole('button', { name: 'Close navigation' }).click();
  expect(errors).toEqual([]);
});

test('offline editing and backup remain available when processing fails', async ({ page }) => {
  await page.route('**/api/**', route => route.abort());
  await page.goto('/');
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await page.getByLabel('HTML code editor').fill('<main><h1>Offline draft</h1></main>');
  await page.getByRole('tab', { name: 'Preview', exact: true }).click();
  await expect(page.frameLocator('iframe[title="Reconstructed interface preview"]').getByRole('heading', { name: 'Offline draft' })).toBeVisible();
  await page.getByRole('button', { name: 'Export code' }).click();
  await expect(page.getByRole('alert')).toContainText('processing server is unavailable');
  await page.getByRole('button', { name: /^My workspaces/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up current workspace' }).click();
  const backup = await download;
  const restored = JSON.parse(await readFile((await backup.path())!, 'utf8'));
  expect(restored.code.html).toContain('Offline draft');
});

test('backup import rejects invalid geometry and restores a valid workspace', async ({ page }) => {
  await connect(page);
  const restored = sampleProject();
  restored.name = 'Imported workspace';
  const invalid = structuredClone(restored);
  invalid.result.elements[0].bounds.x = 3000;
  await page.getByLabel('Import workspace backup').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.getByRole('alert')).toContainText('not a valid FORM workspace');
  await expect(page.getByLabel('Workspace name')).not.toHaveValue('Imported workspace');
  await page.getByLabel('Import workspace backup').setInputFiles({ name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(restored)) });
  await expect(page.getByLabel('Workspace name')).toHaveValue('Imported workspace');
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
});
