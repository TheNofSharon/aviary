import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  // 1. Main Menu
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/Users/nofsharon/.gemini/antigravity/brain/212278e5-2732-4274-ad28-f9516ac35967/reverted_main_menu.png' });
  console.log('Saved reverted_main_menu.png');

  // 2. Stage Briefing (Songbird Evolution Sequence)
  await page.evaluate(() => {
    const game = window.game;
    const menu = game.scene.getScene('Menu');
    menu.switchView('stage_briefing', 1);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/Users/nofsharon/.gemini/antigravity/brain/212278e5-2732-4274-ad28-f9516ac35967/reverted_stage_briefing.png' });
  console.log('Saved reverted_stage_briefing.png');

  // 3. Aviary Gameplay (Chick, Fledgling, Adult, Nest, Food)
  await page.evaluate(() => {
    const game = window.game;
    const menu = game.scene.getScene('Menu');
    menu.scene.start('Aviary', { level: 1, pets: ['hedgehog'] });
  });
  await page.waitForTimeout(1000);

  // Drop seeds and spawn chicks
  await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    const shop = aviary.shops.find((s) => s.title.text === 'Baby Bird');
    if (shop) {
      shop.buy();
      shop.buy();
    }
    aviary.dropFood(400, 240);
    aviary.dropFood(640, 200);
    aviary.dropFood(880, 250);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/Users/nofsharon/.gemini/antigravity/brain/212278e5-2732-4274-ad28-f9516ac35967/reverted_gameplay.png' });
  console.log('Saved reverted_gameplay.png');

  // 4. Logbook View
  await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    aviary.openLogbookModal();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/Users/nofsharon/.gemini/antigravity/brain/212278e5-2732-4274-ad28-f9516ac35967/reverted_logbook.png' });
  console.log('Saved reverted_logbook.png');

  await browser.close();
  console.log('All verification screenshots captured!');
})();
