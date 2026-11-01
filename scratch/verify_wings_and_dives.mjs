import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(600);

  // Jump into Aviary
  await page.evaluate(() => {
    const game = window.game;
    const menu = game.scene.getScene('Menu');
    menu.scene.start('Aviary', { level: 1, pets: ['hedgehog'] });
  });
  await page.waitForTimeout(800);

  // Test 1: Birds cruising (check wing flapping and orientation)
  await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    // Ensure we have 2 birds: one facing right, one facing left
    if (aviary.birds.length >= 2) {
      aviary.birds[0].dir = 1;
      aviary.birds[0].tx = 1100;
      aviary.birds[1].dir = -1;
      aviary.birds[1].tx = 100;
    }
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/Users/nofsharon/.gemini/antigravity/brain/212278e5-2732-4274-ad28-f9516ac35967/verify_flight_wings.png' });
  console.log('Saved verify_flight_wings.png');

  // Test 2: Trigger downward dives to the left and to the right
  await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    // Drop food deep down on left and right
    aviary.dropFood(200, 520);
    aviary.dropFood(1000, 520);
    // Make birds seek
    for (const b of aviary.birds) {
      b.fullness = 20; // hungry
      b.state = 'seek';
    }
  });
  await page.waitForTimeout(600);

  // Capture screenshot of diving birds
  await page.screenshot({ path: '/Users/nofsharon/.gemini/antigravity/brain/212278e5-2732-4274-ad28-f9516ac35967/verify_diving_headfirst.png' });
  console.log('Saved verify_diving_headfirst.png');

  // Also check rotation values in console
  const diveData = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    return aviary.birds.map(b => ({
      dir: b.dir,
      sprRot: b.spr.rotation,
      flipRot: b.flip.rotation,
      wingRot: b.wing.rotation,
      state: b.state
    }));
  });
  console.log('Bird dive data:', diveData);

  await browser.close();
})();
