import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(600);

  // Start Level 1-1
  await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Menu');
    scene.scene.start('Aviary', { level: 1, pets: ['hedgehog'] });
  });
  await page.waitForTimeout(1000);

  // Drop 3 seeds and buy 2 baby birds
  await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    const shop = aviary.shops.find((s) => s.title.text === 'Baby Bird');
    shop.buy();
    shop.buy();
    aviary.dropFood(350, 200);
    aviary.dropFood(640, 160);
    aviary.dropFood(900, 220);
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'scratch/screenshot_economy_and_spin.png' });
  console.log('Saved screenshot to scratch/screenshot_economy_and_spin.png');
  await browser.close();
})();
