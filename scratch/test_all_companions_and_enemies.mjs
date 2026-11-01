import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(500);

  // 1. Check Trophy Room with full 16-stage roster
  console.log('1. Checking Trophy Room with all 16 companions unlocked...');
  await page.evaluate(() => {
    localStorage.setItem('aviary-save-v1', JSON.stringify({ level: 17, gems: 120 }));
    const game = window.game;
    const scene = game.scene.getScene('Menu');
    scene.scene.restart({ view: 'trophy_room' });
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'scratch/trophy_room_16_companions.png' });

  // 2. Check World Select with stage companions
  console.log('2. Checking World Select with stage companions...');
  await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Menu');
    scene.scene.restart({ view: 'world_select' });
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'scratch/world_select_16_stages.png' });

  // 3. Check Stage Briefing with 16 unlocked companions and 3-pet max cap
  console.log('3. Checking Stage Briefing companion selection...');
  await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Menu');
    scene.scene.restart({ view: 'stage_briefing', level: 5 });
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'scratch/stage_briefing_picker.png' });

  // 4. Test In-Game Spawning of Non-Bird Enemies
  console.log('4. Testing non-bird enemy spawns in AviaryScene...');
  await page.evaluate(() => {
    const game = window.game;
    game.scene.stop('Menu');
    game.scene.start('Aviary', { level: 8, pets: ['hedgehog', 'badger', 'squirrel'] });
  });
  await page.waitForTimeout(1000);

  // Manually spawn each non-bird enemy to verify animations, scales, and visuals
  await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Aviary');
    scene.spawnPredator('cat', 25);
    scene.spawnPredator('snake', 20);
    scene.spawnPredator('raccoon', 30);
    scene.spawnPredator('spider', 28);
    scene.spawnPredator('weasel', 22);
    scene.spawnSpiderWeb(520, 260);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'scratch/in_game_non_bird_enemies.png' });

  const enemyInfo = await page.evaluate(() => {
    const game = window.game;
    const scene = game.scene.getScene('Aviary');
    return {
      activeEnemies: scene.predators.map((p) => ({ kind: p.kind, x: Math.round(p.spr.x), y: Math.round(p.spr.y), hp: p.hp })),
      webs: scene.webs.length,
      companions: scene.pets.map((p) => p.key),
    };
  });
  console.log('In-Game Enemy State:', enemyInfo);

  // Clean reset
  await page.evaluate(() => {
    localStorage.setItem('aviary-save-v1', JSON.stringify({ level: 1, gems: 0 }));
  });

  await browser.close();
  console.log('ALL TESTS COMPLETED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
