import { expect, test } from '@playwright/test';

const SHOT_DIR = '/tmp/opencode/minuto-8082';

function wcagContrast(a: string, b: string): number {
  const parse = (hex: string) =>
    hex
      .replace('#', '')
      .match(/../g)!
      .map((c) => parseInt(c, 16) / 255);
  const lin = (v: number) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const lum = (hex: string) => {
    const [r, g, b] = parse(hex).map(lin);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function primaryCtaContrast(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll('[role="button"]'),
    ) as HTMLElement[];
    const primary = buttons.sort(
      (a, b) => b.textContent!.length - a.textContent!.length,
    )[0];
    if (!primary) return null;
    const bg = getComputedStyle(primary).backgroundColor;
    const label = primary.querySelector('div,span');
    const fg = getComputedStyle(label ?? primary).color;
    const toHex = (rgb: string) => {
      const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return null;
      return (
        '#' +
        [m[1], m[2], m[3]]
          .map((v) => (+v).toString(16).padStart(2, '0'))
          .join('')
      );
    };
    return { bg: toHex(bg), fg: toHex(fg), text: primary.textContent };
  });
}

function maxWidthElements(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const boxes = Array.from(document.querySelectorAll('div'))
      .map((el) => {
        const cs = getComputedStyle(el);
        return { maxWidth: cs.maxWidth, el };
      })
      .filter(({ maxWidth }) => maxWidth === '720px');
    return boxes.map(({ el }) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, left: rect.left };
    });
  });
}

test.describe('L04 F12/F09 web adaptive + contrast', () => {
  test('light-mode login: CTA AA contrast and centered max-width at 1280x800', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.waitForSelector('[role="button"]');

    const cta = await primaryCtaContrast(page);
    expect(cta).not.toBeNull();
    const ratio = wcagContrast(cta!.fg!, cta!.bg!);
    expect(ratio).toBeGreaterThanOrEqual(4.5);

    const boxes = await maxWidthElements(page);
    expect(boxes.length).toBeGreaterThan(0);
    const content = boxes[0];
    expect(content.width).toBe(720);
    expect(content.left).toBeCloseTo((1280 - 720) / 2, 0);

    await page.screenshot({
      path: `${SHOT_DIR}/login-1280x800.png`,
      fullPage: true,
    });
  });

  test('light-mode login: content spans mobile viewport at 390x844', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.waitForSelector('[role="button"]');

    const boxes = await maxWidthElements(page);
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes[0].width).toBe(390);
    expect(boxes[0].left).toBe(0);

    await page.screenshot({
      path: `${SHOT_DIR}/login-390x844.png`,
      fullPage: true,
    });
  });
});
