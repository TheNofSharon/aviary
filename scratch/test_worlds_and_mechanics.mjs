import { chromium } from 'playwright';

async function run() {
  console.log('Launching browser to test Worlds and Mechanics...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', (msg) => console.log('BROWSER_LOG:', msg.text()));

  console.log('Navigating to game...');
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1000);

  // 1. MenuScene: Verify World 1-1
  await page.screenshot({ path: 'scratch/test_world_1_menu.png' });
  console.log('Captured scratch/test_world_1_menu.png');

  // Verify World 2 Menu Spotlight
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Menu');
    scene?.scene?.restart({ level: 5 }); // World 2-1
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/test_world_2_menu.png' });
  console.log('Captured scratch/test_world_2_menu.png');

  // Verify World 3 Menu Spotlight
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Menu');
    scene?.scene?.restart({ level: 9 }); // World 3-1
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/test_world_3_menu.png' });
  console.log('Captured scratch/test_world_3_menu.png');

  // Verify World 4 Menu Spotlight
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Menu');
    scene?.scene?.restart({ level: 13 }); // World 4-1
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/test_world_4_menu.png' });
  console.log('Captured scratch/test_world_4_menu.png');

  // 2. Test World 1-1: Tutorial & 5-button toolbar
  console.log('Testing World 1-1 Gameplay...');
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Menu');
    scene?.scene?.start('Aviary', { level: 1, pets: [] });
  });
  await page.waitForTimeout(800);
  const w1Info = await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    return {
      shopCount: s.shops.length,
      birdsCount: s.birds.length,
      birdStage: s.birds[0]?.stage,
      coins: s.coins,
      shopTitles: s.shops.map((sh) => sh.title.text),
    };
  });
  console.log('World 1 Info:', w1Info);
  await page.screenshot({ path: 'scratch/test_world_1_gameplay.png' });
  console.log('Captured scratch/test_world_1_gameplay.png');

  // 3. Test World 2-1: Piranha-Finch & 6-button toolbar
  console.log('Testing World 2-1 Gameplay...');
  await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    s?.scene?.start('Aviary', { level: 5, pets: [] }); // World 2-1
  });
  await page.waitForTimeout(800);
  const w2Info = await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    return {
      shopCount: s.shops.length,
      shopTitles: s.shops.map((sh) => sh.title.text),
      hasPiranha: s.shops.some((sh) => sh.title.text === 'Piranha-Finch'),
    };
  });
  console.log('World 2 Info:', w2Info);
  await page.screenshot({ path: 'scratch/test_world_2_gameplay.png' });
  console.log('Captured scratch/test_world_2_gameplay.png');

  // 4. Test World 3-1: Mama Dove & 7-button toolbar
  console.log('Testing World 3-1 Gameplay...');
  await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    s?.scene?.start('Aviary', { level: 9, pets: [] }); // World 3-1
  });
  await page.waitForTimeout(800);
  const w3Info = await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    return {
      shopCount: s.shops.length,
      shopTitles: s.shops.map((sh) => sh.title.text),
      hasMama: s.shops.some((sh) => sh.title.text === 'Mama Dove'),
      hasPiranha: s.shops.some((sh) => sh.title.text === 'Piranha-Finch'),
    };
  });
  console.log('World 3 Info:', w3Info);
  await page.screenshot({ path: 'scratch/test_world_3_gameplay.png' });
  console.log('Captured scratch/test_world_3_gameplay.png');

  // 5. Test World 4-1: Phoenix Pyre & Sacred Phoenix Rebirth!
  console.log('Testing World 4-1 Gameplay & Phoenix Rebirth...');
  await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    s?.scene?.start('Aviary', { level: 13, pets: [] }); // World 4-1
  });
  await page.waitForTimeout(800);
  const w4Info = await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    return {
      shopCount: s.shops.length,
      shopTitles: s.shops.map((sh) => sh.title.text),
      hasPyre: s.shops.some((sh) => sh.title.text === 'Phoenix Pyre'),
    };
  });
  console.log('World 4 Info:', w4Info);
  await page.screenshot({ path: 'scratch/test_world_4_gameplay.png' });
  console.log('Captured scratch/test_world_4_gameplay.png');

  // Test Sacred Phoenix Rebirth Trigger
  console.log('Triggering Phoenix Rebirth...');
  await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    s.coins = 2000; // give plenty of coins
    // Ensure we have a King bird
    const kingSparrow = s.birds[0];
    kingSparrow.stage = 3;
    if (kingSparrow.crown) kingSparrow.crown.setVisible(true);

    // Trigger Pyre purchase
    const pyreShop = s.shops.find((sh) => sh.title.text === 'Phoenix Pyre');
    pyreShop?.buy();
  });

  // Wait for sacred rebirth animation
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'scratch/test_phoenix_rebirth.png' });
  console.log('Captured scratch/test_phoenix_rebirth.png');

  const rebirthStatus = await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    const phoenix = s.birds.find((b) => b.species.key === 'phoenix');
    const hasSolarEmber = s.coinList.some((c) => c.value === 500);
    return {
      phoenixFound: !!phoenix,
      phoenixStage: phoenix?.stage,
      hasSolarEmber,
    };
  });
  console.log('Phoenix Rebirth Status:', rebirthStatus);

  // 6. Test Volcanic Wyvern Boss spawn
  console.log('Testing Volcanic Wyvern Boss Spawn...');
  await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    s.spawnPredator('wyvern', 80);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scratch/test_wyvern_boss.png' });
  console.log('Captured scratch/test_wyvern_boss.png');

  // 7. Test hitting and defeating Wyvern boss
  console.log('Defeating Wyvern Boss...');
  const wyvernDefeated = await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    const wyvern = s.predators.find((p) => p.kind === 'wyvern');
    if (!wyvern) return false;
    wyvern.hit(100, wyvern.spr.x, wyvern.spr.y);
    return true;
  });
  console.log('Wyvern hit with lethal damage:', wyvernDefeated);
  await page.waitForTimeout(500);

  await browser.close();
  console.log('All World and Mechanics tests completed successfully!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
