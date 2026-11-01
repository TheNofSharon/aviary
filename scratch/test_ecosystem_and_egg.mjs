import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', (msg) => console.log('LOG:', msg.text()));

  console.log('Navigating to game...');
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1000);

  // Take screenshot of Menu with updated goal text
  await page.screenshot({ path: 'scratch/test_1_menu.png' });
  console.log('Saved scratch/test_1_menu.png');

  // Start Level 1
  console.log('Starting Level 1...');
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Menu');
    scene?.scene?.start('Aviary', { level: 1 });
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'scratch/test_2_level1.png' });
  console.log('Saved scratch/test_2_level1.png');

  // Verify single egg button in Adventure Mode:
  const eggButtonInfo = await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    if (!scene) return null;
    const eggShop = scene.shops[6];
    return {
      title: eggShop?.title?.text,
      sub: eggShop?.sub?.text,
      tiny: eggShop?.tiny?.text,
      coins: scene.coins,
      eggs: scene.eggs,
    };
  });
  console.log('Egg Button initial state:', eggButtonInfo);

  // Grant coins to buy egg pieces
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    scene.coins = 5000;
    scene.refreshUi();
  });

  // Click Egg piece 1
  console.log('Buying egg piece 1/3...');
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    scene.shops[6].btn.c.emit('pointerdown');
  });
  await page.waitForTimeout(500);

  const eggAfter1 = await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    const eggShop = scene.shops[6];
    return {
      sub: eggShop?.sub?.text,
      tiny: eggShop?.tiny?.text,
      eggs: scene.eggs,
      coins: scene.coins,
    };
  });
  console.log('Egg after 1st purchase:', eggAfter1);

  // Click Egg piece 2
  console.log('Buying egg piece 2/3...');
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    scene.shops[6].btn.c.emit('pointerdown');
  });
  await page.waitForTimeout(500);

  const eggAfter2 = await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    const eggShop = scene.shops[6];
    return {
      sub: eggShop?.sub?.text,
      tiny: eggShop?.tiny?.text,
      eggs: scene.eggs,
      coins: scene.coins,
    };
  });
  console.log('Egg after 2nd purchase:', eggAfter2);

  // Click Egg piece 3 -> triggers win
  console.log('Buying final egg piece 3/3...');
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    scene.shops[6].btn.c.emit('pointerdown');
  });
  await page.waitForTimeout(1200);

  await page.screenshot({ path: 'scratch/test_3_level_complete.png' });
  console.log('Saved scratch/test_3_level_complete.png');

  // Now go to My Aviary
  console.log('Testing My Aviary...');
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    scene.scene.start('Aviary', { sandbox: true });
  });
  await page.waitForTimeout(1000);

  const sandboxInfo = await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    return {
      sandbox: scene.sandbox,
      gems: scene.gems,
      gemText: scene.gemText?.text,
      birdCount: scene.birds.length,
      shopCount: scene.shops.length,
    };
  });
  console.log('Sandbox initial info:', sandboxInfo);
  await page.screenshot({ path: 'scratch/test_4_my_aviary.png' });
  console.log('Saved scratch/test_4_my_aviary.png');

  // Open Pet Store in My Aviary
  console.log('Opening Pet Store in My Aviary...');
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    scene.openPetStoreModal();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scratch/test_5_pet_store_modal.png' });
  console.log('Saved scratch/test_5_pet_store_modal.png');

  // Close modal
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    scene.closeModal();
  });
  await page.waitForTimeout(300);

  // Test ecosystem interactions:
  // Add 1 Mama Dove, 1 Piranha-Finch, and test Mama 1-offspring constraint & Piranha hunting
  console.log('Testing Mama 1-offspring limit & Piranha hunting...');
  const ecosystemTest = await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    const BirdClass = scene.birds[0].constructor;
    // Clear birds and add a Mama Dove
    scene.birds.forEach(b => b.spr.destroy());
    scene.birds = [];
    const mama = new BirdClass(scene, 745, 400, 2, true, false, 'mama');
    scene.birds.push(mama);
    
    // Simulate Mama laying an egg
    const nestSpot = scene.spots.find(s => s.nest);
    nestSpot.bird = mama;
    mama.spot = nestSpot;
    mama.state = 'rest';
    mama.layT = 0;
    mama.restElapsed = 5;
    mama.fullness = 90;
    mama.update(0.1, 1000);

    const hasEgg = !!nestSpot.egg;
    const eggMother = nestSpot.eggMother === mama;

    // Hatch egg into chick
    nestSpot.eggT = 0;
    scene.update(2000, 100);

    const chick = scene.birds.find(b => b.stage === 0);
    const chickHasParent = chick?.parent === mama;

    // Check if mama will lay ANOTHER egg while chick is alive
    mama.layT = 0;
    mama.restElapsed = 5;
    nestSpot.egg = undefined;
    mama.update(0.1, 3000);
    const secondEggDenied = !nestSpot.egg; // Should be true! Only 1 offspring allowed!

    // Now introduce Piranha-Finch
    const piranha = new BirdClass(scene, 100, 100, 2, false, false, 'piranha_finch');
    scene.birds.push(piranha);
    piranha.fullness = 50; // hungry

    const targetPrey = scene.nearestPrey(piranha.spr.x, piranha.spr.y, piranha);
    const targetedChick = targetPrey === chick;

    // Piranha chomps chick
    const initialGems = scene.gems;
    scene.eatPrey(piranha, chick);

    // Verify chick is dead, gem dropped
    const chickDead = chick.dead;
    const gemDropped = scene.coinList.some(c => c.isGem);

    // Now that chick is dead, can Mama lay again when she rests in a nest?
    mama.spot = nestSpot;
    mama.state = 'rest';
    mama.restT = 10;
    mama.layT = 0;
    mama.restElapsed = 5;
    mama.update(0.1, 4000);
    const secondEggAllowedNow = !!nestSpot.egg;

    return {
      hasEgg,
      eggMother,
      chickHasParent,
      secondEggDenied,
      targetedChick,
      chickDead,
      gemDropped,
      secondEggAllowedNow,
    };
  });

  console.log('Ecosystem test results:', ecosystemTest);
  await page.screenshot({ path: 'scratch/test_6_ecosystem_verified.png' });
  console.log('Saved scratch/test_6_ecosystem_verified.png');

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
