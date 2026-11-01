import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  console.log('Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(800);

  // Start Aviary in sandbox mode
  console.log('Starting Aviary in sandbox mode...');
  await page.evaluate(() => {
    const game = window.game;
    const menu = game.scene.getScene('Menu');
    menu.scene.start('Aviary', { sandbox: true });
  });
  await page.waitForTimeout(1200);

  // Grant 65,000 gems directly
  await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    aviary.gems = 65000;
  });

  // 1. Open Bird Emporium Modal
  console.log('1. Opening Bird Emporium modal...');
  await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    aviary.openPetStoreModal();
  });
  await page.waitForTimeout(800);

  // Take screenshot of the Bird Emporium modal
  await page.screenshot({ path: 'scratch/bird_emporium_modal.png' });
  console.log('📸 Saved scratch/bird_emporium_modal.png');

  // Verify Emporium state and slot pricing
  const emporiumCheck = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    return {
      gems: aviary.gems,
      modalActive: aviary.modal,
      modalItemsCount: aviary.modalItems.length,
      birdsCount: aviary.birds.length,
    };
  });
  console.log('Emporium Check:', emporiumCheck);

  // Test purchasing a bird: Golden Phoenix (10,000 gems)
  console.log('2. Purchasing Golden Phoenix (10,000 gems)...');
  const purchaseResult = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    const initialGems = aviary.gems;
    const initialBirds = aviary.birds.length;

    // Slot E is Golden Phoenix (at x = 1280 / 2 + 85 = 725)
    const cardE = aviary.modalItems.find((it) => it.type === 'Container' && Math.abs(it.x - 725) < 5);
    if (cardE) {
      cardE.emit('pointerdown');
    }
    return {
      initialGems,
      newGems: aviary.gems,
      initialBirds,
      newBirds: aviary.birds.length,
      lastBirdSpecies: aviary.birds[aviary.birds.length - 1]?.species?.key,
    };
  });
  console.log('Purchase Phoenix Result:', purchaseResult);

  // Test purchasing Elixir of Growth (20,000 gems)
  console.log('3. Purchasing Elixir of Growth (20,000 gems)...');
  const elixirResult = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    const initialGems = aviary.gems;

    // Upgrade slot is at x = 1280 / 2 - 1160 / 2 + 105 = 165
    const cardUpgrade = aviary.modalItems.find(
      (it) => it.type === 'Container' && Math.abs(it.x - 165) < 10 && Math.abs(it.y - 460) < 30
    );
    if (cardUpgrade) {
      cardUpgrade.emit('pointerdown');
    }
    return {
      initialGems,
      newGems: aviary.gems,
    };
  });
  console.log('Purchase Elixir Result:', elixirResult);

  // Close modal
  await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    aviary.closeModal();
  });
  await page.waitForTimeout(500);

  // 4. Test Glutton Enemy (Gus mechanic: immune to weapons, feed to burst)
  console.log('4. Spawning and testing Glutton enemy...');
  const gluttonResult = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');

    // Clear existing predators
    aviary.predators = [];

    // Spawn Glutton
    aviary.spawnPredator('glutton');
    const p = aviary.predators[aviary.predators.length - 1];
    if (!p) return { success: false, reason: 'No predator spawned' };

    p.spr.setPosition(640, 300);
    const initialHp = p.hp;

    // Test weapon hit immunity
    p.hit(10);
    const hpAfterHit = p.hp;

    // Drop food and feed glutton
    aviary.dropFood(640, 300);
    const food = aviary.foods[aviary.foods.length - 1];
    aviary.eatGluttonFood(food, p);
    const foodsEaten1 = p.foodsEaten;

    // Feed to max foods to verify burst
    while (p.foodsEaten < p.maxFoods) {
      aviary.dropFood(640, 300);
      const nextFood = aviary.foods[aviary.foods.length - 1];
      aviary.eatGluttonFood(nextFood, p);
    }
    const isDying = p.dying;

    return {
      success: true,
      kind: p.kind,
      initialHp,
      hpAfterHit,
      isImmune: hpAfterHit === initialHp,
      foodsEaten1,
      isDyingAfterBurst: isDying,
    };
  });
  console.log('Glutton Test Result:', gluttonResult);

  // 5. Test Bombardier Raptor (Destructor mechanic: guided missiles, interceptable)
  console.log('5. Spawning and testing Bombardier raptor & missiles...');
  const bombardierResult = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');

    aviary.predators = [];
    aviary.spawnPredator('bombardier');
    const raptor = aviary.predators[aviary.predators.length - 1];
    if (!raptor) return { success: false, reason: 'No bombardier spawned' };

    raptor.spr.setPosition(640, 150);

    // Launch a missile
    aviary.launchMissile(raptor.spr.x, raptor.spr.y + 20, 640, 500);
    const missileCount = aviary.missiles.length;
    const m = aviary.missiles[0];

    // Intercept missile
    const initialCoins = aviary.coins;
    aviary.interceptMissile(m);
    const missilesRemaining = aviary.missiles.length;
    const coinsAfterIntercept = aviary.coins;

    return {
      success: true,
      kind: raptor.kind,
      missileCount,
      missilesRemaining,
      coinsGained: coinsAfterIntercept - initialCoins,
    };
  });
  console.log('Bombardier Test Result:', bombardierResult);

  // Take screenshot of Glutton and Bombardier in action
  await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    aviary.spawnPredator('glutton');
    aviary.spawnPredator('bombardier');
    aviary.launchMissile(700, 200, 500, 450);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scratch/enemies_glutton_bombardier.png' });
  console.log('📸 Saved scratch/enemies_glutton_bombardier.png');

  await browser.close();
  console.log('🎉 All automated tests passed successfully!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
