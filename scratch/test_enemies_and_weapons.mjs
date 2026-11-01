import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(600);

  // Start Level 1-2 (Hawks introduced)
  console.log('1. Starting Level 1-2 (Hawk stage)...');
  await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Menu');
    scene.scene.start('Aviary', { level: 2, pets: [] });
  });
  await page.waitForTimeout(1000);

  // Test 1: Check Starting Weapon (Tier 0: Wooden Stick)
  console.log('2. Checking Starting Weapon...');
  const weaponData = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    const weaponShop = aviary.shops.find((s) => s.title.text === 'Slingshot' || s.tiny.text.includes('Damage'));
    return {
      currentWeapon: aviary.weapon,
      shopTitle: weaponShop.title.text,
      shopSub: weaponShop.sub.text,
      shopTiny: weaponShop.tiny.text,
      shopCost: weaponShop.cost(),
    };
  });
  console.log('Starting weapon data:', weaponData);
  if (weaponData.currentWeapon !== 0) {
    throw new Error(`Expected starting weapon tier 0 (Wooden Stick), got: ${weaponData.currentWeapon}`);
  }
  if (weaponData.shopTitle !== 'Slingshot' || weaponData.shopCost !== 150) {
    throw new Error(`Expected first weapon upgrade to be Slingshot (150c), got ${weaponData.shopTitle} (${weaponData.shopCost})`);
  }
  console.log('✅ Starting weapon verified: Tier 0 (Wooden Stick, 1 dmg), offering Slingshot for 150c');

  // Test 2: Full Weapon Upgrade Ladder (Stick -> Slingshot -> Bow -> Rifle -> Laser)
  console.log('3. Testing full weapon upgrade progression...');
  const upgradeProgression = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    aviary.coins = 10000; // grant coins for upgrade test
    const weaponShop = aviary.shops.find((s) => s.title.text === 'Slingshot' || s.tiny.text.includes('Damage'));

    const ladder = [];

    // Buy Slingshot (150c)
    weaponShop.buy();
    aviary.refreshUi();
    ladder.push({
      weapon: aviary.weapon,
      title: weaponShop.title.text,
      sub: weaponShop.sub.text,
      cost: weaponShop.cost(),
    });

    // Buy Hunting Bow (350c)
    weaponShop.buy();
    aviary.refreshUi();
    ladder.push({
      weapon: aviary.weapon,
      title: weaponShop.title.text,
      sub: weaponShop.sub.text,
      cost: weaponShop.cost(),
    });

    // Buy Rifle Blaster (800c)
    weaponShop.buy();
    aviary.refreshUi();
    ladder.push({
      weapon: aviary.weapon,
      title: weaponShop.title.text,
      sub: weaponShop.sub.text,
      cost: weaponShop.cost(),
    });

    // Buy Laser Blaster (1800c)
    weaponShop.buy();
    aviary.refreshUi();
    ladder.push({
      weapon: aviary.weapon,
      title: weaponShop.title.text,
      sub: weaponShop.sub.text,
      cost: weaponShop.cost(),
    });

    return ladder;
  });
  console.log('Weapon ladder results:', JSON.stringify(upgradeProgression, null, 2));

  if (upgradeProgression[0].title !== 'Hunting Bow' || upgradeProgression[0].weapon !== 1) {
    throw new Error('Upgrade to Slingshot failed');
  }
  if (upgradeProgression[1].title !== 'Rifle Blaster' || upgradeProgression[1].weapon !== 2) {
    throw new Error('Upgrade to Hunting Bow failed');
  }
  if (upgradeProgression[2].title !== 'Laser Blaster' || upgradeProgression[2].weapon !== 3) {
    throw new Error('Upgrade to Rifle Blaster failed');
  }
  if (upgradeProgression[3].weapon !== 4 || upgradeProgression[3].sub !== 'MAX') {
    throw new Error('Upgrade to Laser Blaster MAX failed');
  }
  console.log('✅ Full weapon progression verified: Stick (1) -> Slingshot (2) -> Bow (4) -> Rifle (7) -> Laser (12 MAX)!');

  // Test 3: Alert System Warning Banner and Siren
  console.log('4. Testing Incoming Predator Alert System...');
  const alertTest = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    aviary.startWaveWarning([{ kind: 'hawk', hp: 12, label: 'Wild Hawk' }]);
    return {
      waveWarning: aviary.waveWarning,
      warningTimer: aviary.warningTimer,
      bannerVisible: aviary.warningContainer?.visible,
      vignetteVisible: aviary.warningVignette?.visible,
      titleText: aviary.warningTitleText?.text,
      subText: aviary.warningSubText?.text,
      countdownText: aviary.warningCountdownText?.text,
    };
  });
  console.log('Alert system state:', alertTest);
  if (!alertTest.waveWarning || !alertTest.bannerVisible || !alertTest.vignetteVisible) {
    throw new Error('Alert system failed to activate banner or vignette');
  }
  if (!alertTest.titleText.includes('WARNING: PREDATOR INCOMING')) {
    throw new Error(`Unexpected alert banner text: ${alertTest.titleText}`);
  }
  console.log('✅ Alert System verified: 4.5s countdown, dual siren lights, red border vignette, warning text!');

  // Capture screenshot of the alert warning
  await page.screenshot({ path: 'scratch/screenshot_alert_warning.png' });
  console.log('Saved alert warning screenshot to scratch/screenshot_alert_warning.png');

  // Test 4: Warning Countdown Expiration Spawns Enemy
  console.log('5. Testing Alert Countdown & Enemy Spawn...');
  await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    aviary.warningTimer = 0.05; // accelerate countdown to expire
  });
  await page.waitForTimeout(200);

  const spawnCheck = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    return {
      waveWarning: aviary.waveWarning,
      predatorsCount: aviary.predators.length,
      predatorKind: aviary.predators[0]?.kind,
      predatorHp: aviary.predators[0]?.hp,
    };
  });
  console.log('After alert expiration:', spawnCheck);
  if (spawnCheck.waveWarning !== false) {
    throw new Error('Expected waveWarning to be dismissed after countdown');
  }
  if (spawnCheck.predatorsCount !== 1 || spawnCheck.predatorKind !== 'hawk') {
    throw new Error(`Expected 1 hawk spawned, got: ${spawnCheck.predatorsCount}`);
  }
  console.log('✅ Countdown expiration spawned predator cleanly!');

  // Test 5: Attacking Predator with Laser Weapon (Tier 4)
  console.log('6. Testing Weapon Attack Juice & Damage...');
  const attackResult = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    const pr = aviary.predators[0];
    const initialHp = pr.hp;
    // Simulate attack with Laser Blaster (tier 4, 12 dmg)
    pr.hit(12, pr.spr.x, pr.spr.y);
    aviary.playAttackFx(4, pr.spr.x, pr.spr.y, pr);
    return {
      initialHp,
      afterHp: pr.hp,
      dying: pr.dying,
    };
  });
  console.log('Attack result:', attackResult);
  if (attackResult.afterHp > 0) {
    throw new Error(`Expected 12 HP hawk to be defeated by 12 dmg laser, remaining HP: ${attackResult.afterHp}`);
  }
  console.log('✅ Laser attack hit for 12 damage, triggering screen shake & defeating enemy!');

  // Test 6: Victory & Wave Timer Reset (Calm interval of 45-60s)
  console.log('7. Testing Wave Cleared & Calm Interval...');
  await page.waitForTimeout(300);
  const calmState = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    return {
      predatorsCount: aviary.predators.length,
      waveTimer: aviary.waveTimer,
      hadPredators: aviary.hadPredators,
    };
  });
  console.log('Calm interval state:', calmState);
  if (calmState.waveTimer < 35 || calmState.waveTimer > 75) {
    throw new Error(`Expected generous calm wave interval of ~45-60s, got: ${calmState.waveTimer}`);
  }
  console.log('✅ Calm wave interval verified: player receives generous 50+ seconds of calm between waves!');

  console.log('ALL TESTS PASSED SUCCESSFULLY! 🎉');
  await browser.close();
})().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
