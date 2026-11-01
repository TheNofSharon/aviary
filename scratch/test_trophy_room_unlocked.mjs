import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(500);

  // Set save level to 16 (all unlocked)
  await page.evaluate(() => {
    localStorage.setItem('aviary-save-v1', JSON.stringify({ level: 16, gems: 85 }));
    const game = window.game;
    const scene = game.scene.getScene('Menu');
    scene.scene.restart({ view: 'trophy_room' });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scratch/menu_4_trophy_room_unlocked.png' });

  // Also check world select with progress
  await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Menu');
    scene.scene.restart({ view: 'world_select' });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scratch/menu_2_world_select_progress.png' });

  // Reset back to level 1 for clean state
  await page.evaluate(() => {
    localStorage.setItem('aviary-save-v1', JSON.stringify({ level: 1, gems: 0 }));
  });

  await browser.close();
  console.log('Trophy room & World select progress screenshots captured!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
