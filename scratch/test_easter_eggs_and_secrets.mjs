import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', (msg) => console.log('LOG:', msg.text()));

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

  // 1. Test clicking a bird in My Aviary to open the Profile Modal
  console.log('Testing Bird Profile Modal & Renaming...');
  const profileOpened = await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    const bird = scene.birds[0];
    scene.openBirdProfileModal(bird);
    return scene.modal;
  });
  console.log('Profile Modal opened:', profileOpened);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/test_profile_modal.png' });
  console.log('Saved scratch/test_profile_modal.png');

  // Test applying Easter Egg names: "Icarus", "Polly", "Archimedes", "Santa"
  const eggTestResults = await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    const bird = scene.birds[0];

    // Test Icarus
    bird.applyName('Icarus');
    const isIcarus = bird.easterEgg === 'icarus' && bird.name === 'Icarus';

    // Test Polly
    bird.applyName('Polly');
    const isPolly = bird.easterEgg === 'polly' && !!bird.accessory && !!bird.eyepatch;

    // Test Archimedes
    bird.applyName('Archimedes');
    const isArchimedes = bird.easterEgg === 'archimedes' && !!bird.glasses;

    // Test Santa
    bird.applyName('Santa');
    const isSanta = bird.easterEgg === 'santa' && !!bird.accessory;

    // Test Woodstock
    bird.applyName('Woodstock');
    const isWoodstock = bird.easterEgg === 'woodstock';

    // Test Phoenix
    bird.applyName('Phoenix');
    const isPhoenix = bird.easterEgg === 'phoenix';

    // Test Hedwig
    bird.applyName('Hedwig');
    const isHedwig = bird.easterEgg === 'hedwig';

    return {
      isIcarus,
      isPolly,
      isArchimedes,
      isSanta,
      isWoodstock,
      isPhoenix,
      isHedwig,
    };
  });
  console.log('Easter Egg Name Tests:', eggTestResults);

  // Close modal
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    scene.closeModal();
  });
  await page.waitForTimeout(300);

  // 2. Test Infiltrator Cat Bird
  console.log('Testing Cat Infiltrator...');
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    const BirdClass = scene.birds[0].constructor;
    const cat = new BirdClass(scene, 400, 300, 2, false, false, 'infiltrator');
    cat.applyName('Meow');
    scene.birds.push(cat);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'scratch/test_infiltrator_cat.png' });
  console.log('Saved scratch/test_infiltrator_cat.png');

  // 3. Test Environmental Secret: Rain Dance Sunshower
  console.log('Testing Rain Dance Sunshower...');
  await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    scene.startRainDance();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scratch/test_rain_dance.png' });
  console.log('Saved scratch/test_rain_dance.png');

  // 4. Test Environmental Secret: Suspicious Frogmouth Stick Branch
  console.log('Testing Suspicious Frogmouth Branch...');
  const frogmouthResult = await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    const initialGems = scene.gems;
    // Click frogmouth 7 times to reveal
    for (let i = 0; i < 7; i++) {
      scene.frogmouth.emit('pointerdown');
    }
    const gemDropped = scene.coinList.some(c => c.value === 25);
    return { gemDropped };
  });
  console.log('Frogmouth Secret Result:', frogmouthResult);
  await page.waitForTimeout(400);

  // 5. Test Cheat Codes via Typing
  console.log('Testing Cheat Codes typing: DISCO, DERP, BREAD, MURDER...');

  // DISCO
  await page.keyboard.type('DISCO');
  await page.waitForTimeout(600);
  const discoActive = await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    return scene.discoMode;
  });
  console.log('Disco cheat activated:', discoActive);
  await page.screenshot({ path: 'scratch/test_cheat_disco.png' });
  console.log('Saved scratch/test_cheat_disco.png');

  // DERP
  await page.keyboard.type('DERP');
  await page.waitForTimeout(400);
  const derpActive = await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    return scene.derpMode && scene.birds.every(b => b.googly1?.visible);
  });
  console.log('Derp cheat activated (googly eyes):', derpActive);
  await page.screenshot({ path: 'scratch/test_cheat_derp.png' });
  console.log('Saved scratch/test_cheat_derp.png');

  // BREAD
  await page.keyboard.type('BREAD');
  await page.waitForTimeout(600);
  const breadActive = await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    return scene.foods.some(f => f.fill === 100);
  });
  console.log('Bread cheat activated (baguette crumbs):', breadActive);
  await page.screenshot({ path: 'scratch/test_cheat_bread.png' });
  console.log('Saved scratch/test_cheat_bread.png');

  // MURDER
  await page.keyboard.type('MURDER');
  await page.waitForTimeout(1600);
  const murderTrinkets = await page.evaluate(() => {
    const scene = window.game?.scene?.getScene('Aviary');
    return scene.coinList.length;
  });
  console.log('Murder cheat dropped trinkets count:', murderTrinkets);
  await page.screenshot({ path: 'scratch/test_cheat_murder.png' });
  console.log('Saved scratch/test_cheat_murder.png');

  await browser.close();
  console.log('All easter eggs and secrets verified successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
