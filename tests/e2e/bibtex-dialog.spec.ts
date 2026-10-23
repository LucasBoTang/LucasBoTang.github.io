import { expect, test } from '@playwright/test';
import { routes } from '../../src/data/navigation';

test('BibTeX stays modal until its closing animation finishes', async ({ page }) => {
  await page.goto(routes.research);
  const dialog = page.locator('#h-pdlp-bibtex');
  await page
    .locator('#h-pdlp')
    .getByRole('button', { name: /^BibTeX:/ })
    .click();
  const state = await dialog.evaluate((element) => {
    element.querySelector<HTMLButtonElement>('[data-bibtex-close]')!.click();
    const animation = element
      .getAnimations()
      .find(
        (animation) =>
          animation instanceof CSSAnimation && animation.animationName === 'bibtex-off',
      );
    animation?.pause();
    const state = { open: (element as HTMLDialogElement).open, animated: !!animation };
    animation?.finish();
    return state;
  });
  expect(state).toEqual({ open: true, animated: true });
  await expect(dialog).not.toHaveAttribute('open', '');
});

for (const interrupted of [false, true]) {
  test(`BibTeX closes when its animation is ${interrupted ? 'cancelled' : 'disabled'}`, async ({
    page,
  }) => {
    await page.goto(routes.research);
    const dialog = page.locator('#h-pdlp-bibtex');
    await page
      .locator('#h-pdlp')
      .getByRole('button', { name: /^BibTeX:/ })
      .click();
    await expect(dialog).toBeVisible();
    await dialog.evaluate((element, interrupt) => {
      if (!interrupt) (element as HTMLElement).style.animation = 'none';
      element.querySelector<HTMLButtonElement>('[data-bibtex-close]')!.click();
      if (interrupt) {
        for (const animation of element.getAnimations()) animation.cancel();
      }
    }, interrupted);
    await expect(dialog).not.toHaveAttribute('open', '');
    await page
      .locator('#h-pdlp')
      .getByRole('button', { name: /^BibTeX:/ })
      .click();
    await expect(dialog).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toHaveAttribute('open', '');
  });
}

test('changing to reduced motion finishes BibTeX printing and closing', async ({ page }) => {
  await page.goto(routes.research);
  const dialog = page.locator('#h-pdlp-bibtex');
  const text = await dialog.locator('code').textContent();
  await page
    .locator('#h-pdlp')
    .getByRole('button', { name: /^BibTeX:/ })
    .click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(dialog.locator('code')).toHaveText(text!);
  await expect(dialog.locator('code span')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await dialog.evaluate((element) => {
    (element as HTMLElement).style.animationDuration = '10s';
    element.querySelector<HTMLButtonElement>('[data-bibtex-close]')!.click();
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(dialog).not.toHaveAttribute('open', '');
});

test('a late clipboard result cannot mark a reopened BibTeX dialog as copied', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () =>
          new Promise<void>((resolve) =>
            document.addEventListener('test:clipboard-ready', () => resolve(), { once: true }),
          ),
      },
    });
  });
  await page.goto(routes.research);
  const dialog = page.locator('#h-pdlp-bibtex');
  const openButton = page.locator('#h-pdlp').getByRole('button', { name: /^BibTeX:/ });
  await openButton.click();
  await dialog.getByRole('button', { name: 'Copy BibTeX', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).not.toHaveAttribute('open', '');
  await openButton.click();
  await page.evaluate(async () => {
    document.dispatchEvent(new Event('test:clipboard-ready'));
    // Flush the clipboard continuation before checking its effect on the new session.
    await Promise.resolve();
  });
  await expect(dialog.locator('[data-bibtex-copy]')).not.toHaveAttribute('data-copied', '');
  await expect(dialog.locator('[data-bibtex-status]')).toHaveText('');
});
