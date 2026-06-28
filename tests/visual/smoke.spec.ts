import { expect, test } from "@playwright/test";

const VEHICLES = ["truck", "ship", "plane"] as const;

test("renders every vehicle preset without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();

  for (const v of VEHICLES) {
    await page.click(`button[data-vehicle="${v}"]`);
    await page.waitForTimeout(1600); // let spawn/grow + autofit settle

    // Sample the canvas: the bright ULD strokes must paint pixels above the dark deck.
    const litPixels = await page.evaluate(() => {
      const c = document.querySelector("canvas") as HTMLCanvasElement;
      const ctx = c.getContext("2d");
      if (!ctx) return -1;
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let lit = 0;
      for (let i = 0; i < data.length; i += 4 * 1500) {
        if (data[i + 1]! > 140) lit++; // bright green/white strokes
      }
      return lit;
    });
    expect(litPixels, `${v} should render lit cargo`).toBeGreaterThan(0);
  }

  expect(errors).toEqual([]);
});

test("theme + autorotate toggles respond", async ({ page }) => {
  await page.goto("/");
  await page.click('button[data-theme="light"]');
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const autorotate = page.locator("#autorotate");
  await autorotate.uncheck();
  await expect(autorotate).not.toBeChecked();
});
