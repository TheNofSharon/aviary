import { chromium } from 'playwright';

async function run() {
  console.log('Launching browser to test Feeder Birds and Diets in My Aviary...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', (msg) => console.log('BROWSER_LOG:', msg.text()));

  console.log('Navigating to game...');
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1000);

  // Jump into My Aviary
  console.log('Entering My Aviary...');
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Menu');
    scene?.scene?.start('Aviary', { sandbox: true });
  });
  await page.waitForTimeout(1000);

  // 1. Verify My Aviary toolbar has Feeder Chick
  const shops = await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    return s.shops.map((sh) => sh.title.text);
  });
  console.log('My Aviary Shops:', shops);

  // 2. Buy a Feeder Chick
  console.log('Buying a Feeder Chick...');
  await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    s.gems = 50;
    const feederShop = s.shops.find((sh) => sh.title.text === 'Feeder Chick');
    feederShop?.buy();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scratch/test_feeder_chick_spawned.png' });
  console.log('Captured scratch/test_feeder_chick_spawned.png');

  const feederCheck = await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    const feeder = s.birds.find((b) => b.isFeeder);
    return {
      feederFound: !!feeder,
      isFeeder: feeder?.isFeeder,
      stage: feeder?.stage,
    };
  });
  console.log('Feeder Chick Check:', feederCheck);

  // 3. Test Clicking Feeder Bird (should NOT open rename profile modal!)
  console.log('Testing click on Feeder Bird (cannot be named)...');
  const clickedFeederResult = await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    const feeder = s.birds.find((b) => b.isFeeder);
    // Simulate pointer down directly on feeder bird
    s.input.emit('pointerdown', { x: feeder.spr.x, y: feeder.spr.y, wasTouch: false, isDown: true });
    return {
      modalOpened: !!s.modal,
    };
  });
  console.log('Click on feeder opened modal?:', clickedFeederResult.modalOpened); // Should be false!

  // 4. Test Feeder Bird Growth
  console.log('Feeding seeds to Feeder Bird...');
  await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    const feeder = s.birds.find((b) => b.isFeeder);
    feeder.addUnits(15); // Grow stage 0 -> stage 1 -> stage 2
  });
  await page.waitForTimeout(400);
  const grewStage = await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    const feeder = s.birds.find((b) => b.isFeeder);
    return feeder.stage;
  });
  console.log('Feeder bird stage after eating:', grewStage);

  // 5. Test Predator Hunting Feeder Bird
  console.log('Spawning Piranha-Finch to hunt Feeder Bird...');
  await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    const BirdClass = s.birds[0].constructor;
    // Spawn a hungry piranha finch right next to the feeder bird
    const feeder = s.birds.find((b) => b.isFeeder);
    const piranha = new BirdClass(s, feeder.spr.x + 30, feeder.spr.y, 2, false, false, 'piranha_finch', false);
    piranha.fullness = 20; // hungry!
    s.birds.push(piranha);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'scratch/test_piranha_hunting_feeder.png' });
  console.log('Captured scratch/test_piranha_hunting_feeder.png');

  // 6. Verify saveSandbox excludes feeder birds
  const saveCheck = await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    s.saveSandbox();
    const raw = localStorage.getItem('aviary-save-v1');
    const save = JSON.parse(raw);
    const savedBirds = save.sandbox?.birds ?? [];
    return {
      savedCount: savedBirds.length,
      hasAnyFeederSaved: savedBirds.some((b) => b.isFeeder),
    };
  });
  console.log('Sandbox Save Check (feeders excluded):', saveCheck);

  // 7. Verify Profile Modal displays Diet
  console.log('Opening Pet Profile Modal to verify Diet display...');
  await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    const pet = s.birds.find((b) => !b.isFeeder);
    s.openBirdProfileModal(pet);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scratch/test_profile_diet.png' });
  console.log('Captured scratch/test_profile_diet.png');

  // Close profile modal
  await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    s.closeModal();
  });
  await page.waitForTimeout(300);

  // 8. Verify Pet Store Modal displays Diets
  console.log('Opening Pet Store Modal to verify Diets...');
  await page.evaluate(() => {
    const s = window.game?.scene?.getScene('Aviary');
    s.openPetStoreModal();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scratch/test_pet_store_diets.png' });
  console.log('Captured scratch/test_pet_store_diets.png');

  await browser.close();
  console.log('All Feeder Bird and Diet tests completed successfully!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
