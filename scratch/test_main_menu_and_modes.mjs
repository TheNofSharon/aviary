import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  console.log('Navigating to game...');
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1000);

  // 1. MAIN MENU
  console.log('1. Checking Main Menu...');
  await page.screenshot({ path: 'scratch/menu_1_main.png' });

  // Check that Main Menu scene is active
  const menuInfo = await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Menu');
    return {
      isActive: scene && scene.scene.isActive(),
      view: scene ? scene.view : null,
    };
  });
  console.log('Main Menu State:', menuInfo);

  // 2. NAVIGATE TO WORLD & STAGE SELECT
  console.log('2. Navigating to World & Stage Select...');
  await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Menu');
    scene.switchView('world_select');
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/menu_2_world_select.png' });

  const worldSelectInfo = await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Menu');
    return {
      view: scene.view,
      maxUnlockedLevel: scene.maxUnlockedLevel,
    };
  });
  console.log('World Select State:', worldSelectInfo);

  // 3. NAVIGATE TO STAGE BRIEFING
  console.log('3. Navigating to Stage Briefing for World 2-1 (Level 5)...');
  await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Menu');
    scene.switchView('stage_briefing', 5);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/menu_3_stage_briefing.png' });

  // 4. NAVIGATE TO TROPHY ROOM
  console.log('4. Navigating to Trophy Room...');
  await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Menu');
    scene.switchView('trophy_room');
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/menu_4_trophy_room.png' });

  // 5. NAVIGATE TO OPTIONS
  console.log('5. Navigating to Options...');
  await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Menu');
    scene.switchView('options');
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/menu_5_options.png' });

  // 6. TEST TIME TRIAL MODE
  console.log('6. Launching Time Trial Mode...');
  await page.evaluate(() => {
    const game = window.game;
    game.scene.stop('Menu');
    game.scene.start('Aviary', { timeTrial: true });
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'scratch/game_time_trial.png' });

  const timeTrialState = await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Aviary');
    return {
      isActive: scene && scene.scene.isActive(),
      timeTrial: scene ? scene.timeTrial : false,
      timeLeft: scene ? scene.timeTrialTime : 0,
      coins: scene ? scene.coins : 0,
      birds: scene ? scene.birds.length : 0,
    };
  });
  console.log('Time Trial State:', timeTrialState);

  // 7. TEST HUD MENU BUTTON / PAUSE MODAL
  console.log('7. Testing HUD Menu Pause Modal in Time Trial...');
  await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Aviary');
    scene.openPauseModal();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'scratch/game_paused_modal.png' });

  // 8. TEST RETURN TO MAIN MENU FROM PAUSE
  console.log('8. Returning to Main Menu from Pause Modal...');
  await page.evaluate(() => {
    const game = window.game;
    game.scene.stop('Aviary');
    game.scene.start('Menu', { view: 'main_menu' });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/menu_returned_main.png' });

  await browser.close();
  console.log('ALL MAIN MENU & MODE TESTS COMPLETED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
