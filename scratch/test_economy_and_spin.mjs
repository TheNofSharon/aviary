import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('[Browser Error]', msg.text());
    }
  });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  // Click Adventure Mode / Play button to start level 1-1
  console.log('Checking Menu / Starting Adventure Mode...');
  const campaignStarted = await page.evaluate(() => {
    const game = window.game;
    if (!game) return false;
    const scene = game.scene.getScene('Menu');
    if (scene) {
      scene.scene.start('Aviary', { level: 1, pets: [] });
      return true;
    }
    return false;
  });
  console.log('Campaign started:', campaignStarted);
  await page.waitForTimeout(1500);

  // Test 1: Verify Toolbar Shop Prices
  const shopData = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    return {
      coins: aviary.coins,
      shops: aviary.shops.map((s) => ({
        title: s.title.text,
        sub: s.sub.text,
        tiny: s.tiny.text,
        cost: s.cost(),
      })),
    };
  });
  console.log('Shop Prices & State:', JSON.stringify(shopData, null, 2));

  // Assertions on shop prices
  const babyBirdShop = shopData.shops.find((s) => s.title === 'Baby Bird');
  if (!babyBirdShop || babyBirdShop.cost !== 35) {
    throw new Error(`Expected Baby Bird to cost 35c, got: ${babyBirdShop?.cost}`);
  }
  console.log('✅ Baby Bird price verified: 35c');

  const foodQualityShop = shopData.shops.find((s) => s.title === 'Food Quality');
  if (!foodQualityShop || foodQualityShop.cost !== 150) {
    throw new Error(`Expected Food Quality 1 to cost 150c, got: ${foodQualityShop?.cost}`);
  }
  console.log('✅ Food Quality 1 price verified: 150c');

  const moreFoodShop = shopData.shops.find((s) => s.title === 'More Food');
  if (!moreFoodShop || moreFoodShop.cost !== 100) {
    throw new Error(`Expected More Food 1 to cost 100c, got: ${moreFoodShop?.cost}`);
  }
  console.log('✅ More Food 1 price verified: 100c');

  const eggShop = shopData.shops.find((s) => s.title === 'Egg');
  if (!eggShop || eggShop.cost !== 60) {
    throw new Error(`Expected Egg piece 1 in World 1-1 to cost 60c, got: ${eggShop?.cost}`);
  }
  console.log('✅ World 1-1 Egg piece 1 verified: 60c');

  // Test 2: Test Purchasing a Baby Bird for 35c
  const buyResult = await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    const initialBirds = aviary.birds.length;
    const initialCoins = aviary.coins;
    // Click baby bird shop button
    const shop = aviary.shops.find((s) => s.title.text === 'Baby Bird');
    shop.buy();
    return {
      initialCoins,
      afterCoins: aviary.coins,
      initialBirds,
      afterBirds: aviary.birds.length,
    };
  });
  console.log('Buy Baby Bird Result:', buyResult);
  if (buyResult.afterCoins !== buyResult.initialCoins - 35) {
    throw new Error(`Expected coins to decrease by 35, got diff: ${buyResult.initialCoins - buyResult.afterCoins}`);
  }
  if (buyResult.afterBirds !== buyResult.initialBirds + 1) {
    throw new Error('Expected 1 new bird added');
  }
  console.log('✅ Successfully bought Baby Bird for 35c');

  // Test 3: Horizontal Seed Spin Autorotation
  console.log('Testing Horizontal Seed Spin...');
  await page.evaluate(() => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    // Drop a seed high up
    aviary.dropFood(600, 100, true);
  });

  const spinObservations = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(60);
    const obs = await page.evaluate(() => {
      const game = window.game;
      const aviary = game.scene.getScene('Aviary');
      const seed = aviary.foods[0];
      if (!seed) return null;
      return {
        scaleX: seed.img.scaleX,
        rotation: seed.img.rotation,
        y: seed.img.y,
        landed: seed.landed,
      };
    });
    if (obs) spinObservations.push(obs);
  }
  console.log('Seed spin sample frames:', spinObservations.slice(0, 5));
  const hasNegativeScaleX = spinObservations.some((o) => o.scaleX < -0.2);
  const hasPositiveScaleX = spinObservations.some((o) => o.scaleX > 0.2);
  if (!hasNegativeScaleX || !hasPositiveScaleX) {
    throw new Error(`Expected horizontal rotor scaleX to oscillate between positive and negative! Sample: ${JSON.stringify(spinObservations)}`);
  }
  console.log('✅ Seed horizontal rotor spin verified! scaleX oscillates between + and -');

  // Test 4: Hunger Drain Rate
  console.log('Testing Hunger Drain Rate...');
  const hungerStats = await page.evaluate(async () => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    const bird = aviary.birds[0];
    if (!bird) return null;
    const f1 = bird.fullness;
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          f1,
          f2: bird.fullness,
          drain: f1 - bird.fullness,
        });
      }, 1000);
    });
  });
  console.log('Hunger 1-sec drain stats:', hungerStats);
  if (!hungerStats || hungerStats.drain < 2.5 || hungerStats.drain > 5.5) {
    throw new Error(`Expected bird drain around ~3.8-4.5 per sec, got: ${hungerStats?.drain}`);
  }
  console.log('✅ Hunger drain verified: active feeding tension restored (~4.5/s for chick)');

  // Test 5: Bird coin drops are strictly timed and feeding does NOT trigger instant coin drop
  console.log('Testing Coin Drop Timers & Feeding...');
  const timedDropTest = await page.evaluate(async () => {
    const game = window.game;
    const aviary = game.scene.getScene('Aviary');
    const bird = aviary.birds[0];
    bird.growNow(); // grow to adult (stage 1) so it has a coin drop timer
    bird.coinT = 5.0; // 5 seconds remaining on drop clock
    const initialCoinsCount = aviary.coinList.length;

    // Simulate eating food immediately
    const fakeFood = {
      img: { x: bird.spr.x, y: bird.spr.y, destroy: () => {} },
      fill: 40,
      units: 1,
      landed: false,
      life: 10,
      groundY: 600,
      eaten: false,
    };
    aviary.eatFood(fakeFood, bird);

    const coinsAfterEat = aviary.coinList.length;
    const coinTAfterEat = bird.coinT;

    return {
      initialCoinsCount,
      coinsAfterEat,
      coinTAfterEat,
    };
  });
  console.log('Eating test result:', timedDropTest);
  if (timedDropTest.coinsAfterEat !== timedDropTest.initialCoinsCount) {
    throw new Error('Feeding bird incorrectly triggered a coin drop!');
  }
  if (timedDropTest.coinTAfterEat <= 0) {
    throw new Error('Feeding bird incorrectly reset coin drop timer!');
  }
  console.log('✅ Timed drop verified: Eating food does NOT drop coins or reset coin timer!');

  console.log('ALL TESTS PASSED SUCCESSFULLY! 🎉');
  await browser.close();
})().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
