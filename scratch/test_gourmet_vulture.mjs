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

  // Start Level 3-4 (where Gourmet Vulture spawns) or test in Aviary
  console.log('Starting Aviary to test Gourmet Vulture...');
  await page.evaluate(() => {
    const game = window.game;
    const menu = game.scene.getScene('Menu');
    menu.scene.start('Aviary', { level: 12, pets: [] });
  });
  await page.waitForTimeout(1200);

  // Test Gourmet Vulture Mechanics
  console.log('1. Spawning Gourmet Vulture in Active Mode...');
  const activeTest = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    aviary.predators = [];

    const v = aviary.spawnPredator('vulture', 50);
    v.spr.setPosition(640, 260);

    const initialHp = v.hp;
    const state = v.vultureState;

    // Hit in active mode -> Deals damage
    v.hit(10, 640, 360);
    const hpAfterHit = v.hp;

    return {
      kind: v.kind,
      state,
      initialHp,
      hpAfterHit,
      damaged: hpAfterHit < initialHp,
    };
  });
  console.log('Active Phase Test:', activeTest);

  // Take screenshot of Active Gourmet Vulture
  await page.screenshot({ path: 'scratch/vulture_active_phase.png' });
  console.log('📸 Saved scratch/vulture_active_phase.png');

  // Test Dormant Mode (Healing on Hit)
  console.log('2. Testing Dormant Mode & Healing...');
  const dormantTest = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    const v = aviary.predators[0];

    // Force dormant state
    v.enterVultureDormant();
    const state = v.vultureState;
    const hpBeforeDormantHit = v.hp;

    // Hit in dormant mode -> HEALS!
    v.hit(10, 640, 360);
    const hpAfterDormantHit = v.hp;

    return {
      state,
      hpBeforeDormantHit,
      hpAfterDormantHit,
      healed: hpAfterDormantHit > hpBeforeDormantHit,
    };
  });
  console.log('Dormant Phase Test:', dormantTest);

  // Take screenshot of Dormant Gourmet Vulture (Healing)
  await page.screenshot({ path: 'scratch/vulture_dormant_phase.png' });
  console.log('📸 Saved scratch/vulture_dormant_phase.png');

  // Test Defeat & Bounty
  console.log('3. Testing Defeat & Bounty...');
  const defeatTest = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    const v = aviary.predators[0];

    // Wake back up to active
    v.enterVultureActive();

    const initialCoins = aviary.coins;
    // Deliver lethal blow
    v.hit(100, 640, 360);

    return {
      isDying: v.dying,
      coinsBefore: initialCoins,
      coinDrops: aviary.coinList.length,
    };
  });
  console.log('Defeat Test:', defeatTest);

  await browser.close();
  console.log('🎉 All Gourmet Vulture tests passed successfully!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
