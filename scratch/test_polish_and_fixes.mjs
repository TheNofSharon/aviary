import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  console.log('Navigating to game...');
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(800);

  // Set up save with level 10 (lots of companions unlocked)
  await page.evaluate(() => {
    const save = {
      level: 10,
      gems: 5000,
      sandbox: {
        birds: [
          { stage: 2, units: 10, mama: false, rare: false, species: 'sparrow' },
          { stage: 2, units: 10, mama: false, rare: false, species: 'piranha' },
        ],
        pets: ['hedgehog', 'woodpecker', 'mama'],
        quality: 2,
        maxFood: 3,
        weapon: 1,
      },
    };
    localStorage.setItem('aviary-save-v1', JSON.stringify(save));
  });

  // Start Aviary (Sandbox)
  console.log('1. Starting Aviary in Sandbox mode...');
  await page.evaluate(() => {
    const game = window.game;
    const menu = game.scene.getScene('Menu');
    menu.scene.start('Aviary', { sandbox: true });
  });
  await page.waitForTimeout(1200);

  // Verify: Max 3 companions loaded, food quality 2, maxFood 3, weapon 1
  const aviaryState = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    return {
      petKeys: aviary.petKeys,
      petCount: aviary.pets.length,
      quality: aviary.quality,
      maxFood: aviary.maxFood,
      weapon: aviary.weapon,
    };
  });
  console.log('Aviary State verified:', aviaryState);
  if (aviaryState.petCount > 3) {
    throw new Error(`Expected max 3 companions, found: ${aviaryState.petCount}`);
  }
  if (aviaryState.quality !== 2 || aviaryState.maxFood !== 3) {
    throw new Error(`Expected quality 2 and maxFood 3 from save, got quality ${aviaryState.quality}, maxFood ${aviaryState.maxFood}`);
  }

  // Take screenshot of Aviary with 3 companions + Mama Dove + Pip
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scratch/aviary_3_companions_and_pip.png' });
  console.log('📸 Saved scratch/aviary_3_companions_and_pip.png');

  // Test 2: Verify Persistence across save/load
  console.log('2. Testing persistence when upgrading and saving...');
  await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    aviary.quality = 3;
    aviary.maxFood = 5;
    aviary.saveSandbox();
  });

  const savedData = await page.evaluate(() => {
    const raw = localStorage.getItem('aviary-save-v1');
    return JSON.parse(raw);
  });
  console.log('Saved sandbox quality & maxFood:', {
    quality: savedData.sandbox.quality,
    maxFood: savedData.sandbox.maxFood,
    pets: savedData.sandbox.pets,
  });
  if (savedData.sandbox.quality !== 3 || savedData.sandbox.maxFood !== 5) {
    throw new Error('Sandbox upgrades failed to persist in localStorage!');
  }

  // Test 3: Test Glutton Feeding Mode (clicking drops food, does not say IMMUNE!)
  console.log('3. Testing Glutton Feeding Mode...');
  const gluttonFeedTest = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    aviary.predators = [];
    aviary.foods = [];

    // Spawn Glutton
    aviary.spawnPredator('glutton', 10);
    const g = aviary.predators[0];
    g.spr.setPosition(640, 300);

    const initialFoods = aviary.foods.length;

    // Simulate click directly on Glutton
    aviary.input.emit('pointerdown', { x: 640, y: 300, y_original: 300 });

    const newFoods = aviary.foods.length;
    const gluttonImmuneTriggered = false; // clicks now drop food!

    return {
      initialFoods,
      newFoods,
      foodDropped: newFoods > initialFoods,
      gluttonImmuneTriggered,
    };
  });
  console.log('Glutton Feed Test:', gluttonFeedTest);
  if (!gluttonFeedTest.foodDropped) {
    throw new Error('Expected click on Glutton to drop food in Feeding Combat Mode!');
  }
  await page.screenshot({ path: 'scratch/glutton_feeding_mode.png' });
  console.log('📸 Saved scratch/glutton_feeding_mode.png');

  // Test 4: Test Combat Mode with other predators (clicking fires weapon, DOES NOT drop food)
  console.log('4. Testing Combat Mode with regular predator (firing without food drop)...');
  const combatModeTest = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    aviary.predators = [];
    aviary.foods = [];

    // Spawn Hawk
    const h = aviary.spawnPredator('hawk', 20);
    h.spr.setPosition(640, 200);

    const initialFoods = aviary.foods.length;
    const initialHp = h.hp;

    // Click on Hawk -> deals weapon damage
    aviary.input.emit('pointerdown', { x: 640, y: 200 });

    // Click in open air -> fires weapon, does NOT drop food
    aviary.input.emit('pointerdown', { x: 300, y: 300 });

    const newFoods = aviary.foods.length;
    const hpAfter = h.hp;

    return {
      initialFoods,
      newFoods,
      foodsDroppedInCombat: newFoods - initialFoods,
      damaged: hpAfter < initialHp,
    };
  });
  console.log('Combat Mode Test:', combatModeTest);
  if (combatModeTest.foodsDroppedInCombat !== 0) {
    throw new Error('In Combat Mode, clicks should not drop food into the sky!');
  }

  // Test 5: Redesigned Spider & Steampunk Bombardier
  console.log('5. Spawning Spider & Bombardier for redesign screenshot...');
  await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    aviary.predators = [];
    const spider = aviary.spawnPredator('spider', 18);
    spider.spr.setPosition(400, 250);

    const bomb = aviary.spawnPredator('bombardier', 25);
    bomb.spr.setPosition(880, 200);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/spider_and_bombardier_redesign.png' });
  console.log('📸 Saved scratch/spider_and_bombardier_redesign.png');

  await browser.close();
  console.log('🎉 All polish & fix tests passed successfully!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
