import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(500);

  // Start stage 1
  await page.evaluate(() => {
    const game = window.game;
    game.scene.stop('Menu');
    game.scene.start('Aviary', { level: 1 });
  });
  await page.waitForTimeout(800);

  // Drop 3 seeds
  await page.mouse.click(400, 200);
  await page.waitForTimeout(100);
  await page.mouse.click(600, 180);
  await page.waitForTimeout(100);
  await page.mouse.click(800, 220);

  await page.waitForTimeout(300);
  await page.screenshot({ path: 'scratch/spinny_seeds_falling.png' });

  const foodInfo = await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Aviary');
    return scene.foods.map((f) => ({
      x: f.img.x,
      y: f.img.y,
      rotation: f.img.rotation,
      landed: f.landed,
    }));
  });
  console.log('Food seeds falling:', foodInfo);

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
