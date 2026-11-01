import { loadSave, patchSave } from './data';
import { playAchievementSound } from './audio';

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  gemReward: number;
  category: 'general' | 'secret' | 'challenge';
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- GENERAL ADVENTURE ACHIEVEMENTS ---
  {
    id: 'first_chick',
    title: 'First Peep',
    desc: 'Hatch or adopt your very first baby songbird in the aviary.',
    icon: '🐣',
    gemReward: 5,
    category: 'general',
  },
  {
    id: 'first_adult',
    title: 'Wings of Maturity',
    desc: 'Nurture a young bird through its growth stages to full adulthood.',
    icon: '🪶',
    gemReward: 10,
    category: 'general',
  },
  {
    id: 'flock_eight',
    title: 'Flourishing Canopy',
    desc: 'Care for a bustling flock of 8 or more living birds simultaneously.',
    icon: '🌳',
    gemReward: 15,
    category: 'general',
  },
  {
    id: 'coin_hoarder',
    title: 'Avian Tycoon',
    desc: 'Harvest and accumulate 1,000 coins in a single stage session.',
    icon: '💰',
    gemReward: 15,
    category: 'general',
  },
  {
    id: 'weapon_master',
    title: 'Guardian Marksman',
    desc: 'Upgrade your aviary defense arsenal all the way to the Laser.',
    icon: '⚡',
    gemReward: 20,
    category: 'general',
  },
  {
    id: 'world1_clear',
    title: 'Meadow Champion',
    desc: 'Conquer all 4 stages of World 1 (Verdant Meadow) and fend off the Wild Hawk.',
    icon: '🌿',
    gemReward: 20,
    category: 'general',
  },
  {
    id: 'world2_clear',
    title: 'Rainforest Sovereign',
    desc: 'Conquer World 2 (Rainforest Canopy) and overcome the sneaky Tree Viper.',
    icon: '🌴',
    gemReward: 25,
    category: 'general',
  },
  {
    id: 'falcon_feeder',
    title: 'Raptor Sovereign',
    desc: 'Feed a Peregrine Falcon or raptor its natural live feeder chick diet.',
    icon: '🦅',
    gemReward: 15,
    category: 'general',
  },
  {
    id: 'phoenix_rising',
    title: 'Born of the Pyre',
    desc: 'Witness a bird ascend into the mythical, shimmering Golden Phoenix.',
    icon: '🔥',
    gemReward: 30,
    category: 'general',
  },

  // --- SECRET & EASTER EGG ACHIEVEMENTS ---
  {
    id: 'rainmaker',
    title: 'Sunshower Summoner',
    desc: 'Locate the discreet puffy cloud and invoke a radiant rainbow sunshower.',
    icon: '🌈',
    gemReward: 15,
    category: 'secret',
  },
  {
    id: 'frogmouth_spotter',
    title: 'Master of Camouflage',
    desc: 'Spot and click the deceptive Tawny Frogmouth disguised as tree bark.',
    icon: '🦉',
    gemReward: 20,
    category: 'secret',
  },
  {
    id: 'disco_frenzy',
    title: 'Nocturnal Groove',
    desc: 'Trigger the secret disco ball dance party in the aviary.',
    icon: '🪩',
    gemReward: 15,
    category: 'secret',
  },

  // --- TIME TRIAL & CHALLENGE ACHIEVEMENTS ---
  {
    id: 'speed_demon',
    title: 'Clockwork Frenzy',
    desc: 'Collect 1,500 coins or more in a single 5-minute Time Trial stage.',
    icon: '⏱️',
    gemReward: 25,
    category: 'challenge',
  },
  {
    id: 'bat_challenge_clear',
    title: 'Nocturnal Navigator',
    desc: 'Survive the deep midnight sky and complete the Night of the Bats Challenge!',
    icon: '🦇',
    gemReward: 35,
    category: 'challenge',
  },
  {
    id: 'bat_hunter',
    title: 'Moonlight Stunner',
    desc: 'Defeat 5 swooping nocturnal bats with accurate weapon fire.',
    icon: '🌙',
    gemReward: 20,
    category: 'challenge',
  },
];

export function getAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function isAchievementUnlocked(id: string): boolean {
  const save = loadSave();
  return !!save.achievements?.[id];
}

export function getUnlockedCount(): { unlocked: number; total: number; totalGemsEarned: number } {
  const save = loadSave();
  const map = save.achievements || {};
  let unlocked = 0;
  let totalGemsEarned = 0;
  for (const a of ACHIEVEMENTS) {
    if (map[a.id]) {
      unlocked++;
      totalGemsEarned += a.gemReward;
    }
  }
  return { unlocked, total: ACHIEVEMENTS.length, totalGemsEarned };
}

/**
 * Unlocks an achievement if not already earned.
 * Plays fanfare audio, increments save gems, saves timestamp,
 * and renders an animated popup banner toast if a Phaser scene is provided.
 */
export function unlockAchievement(id: string, scene?: any): boolean {
  const def = getAchievement(id);
  if (!def) return false;

  const save = loadSave();
  const achievements = { ...(save.achievements || {}) };
  if (achievements[id]) {
    return false; // Already unlocked
  }

  // Record unlock
  achievements[id] = Date.now();
  const newGems = (save.gems || 0) + def.gemReward;
  patchSave({ achievements, gems: newGems });

  // Sound fanfare
  playAchievementSound();

  // If scene is valid, show triumphant pop-down banner toast
  if (scene && scene.add && scene.tweens) {
    try {
      showAchievementPopup(scene, def);
    } catch {
      /* ignore render error */
    }
  }

  return true;
}

function showAchievementPopup(scene: any, def: AchievementDef) {
  const W = 1280;
  const FONT = 'Trebuchet MS, Verdana, sans-serif';

  const container = scene.add.container(W / 2, -70).setDepth(999);

  const bg = scene.add.graphics();
  const pw = 420;
  const ph = 64;
  // Shadow
  bg.fillStyle(0x000000, 0.45);
  bg.fillRoundedRect(-pw / 2 + 4, -ph / 2 + 5, pw, ph, 16);
  // Banner Body
  bg.fillStyle(0x1e152d, 0.96);
  bg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 16);
  bg.lineStyle(2.5, 0xf59e0b, 1);
  bg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 16);

  // Icon Badge
  const iconTxt = scene.add
    .text(-pw / 2 + 36, 0, def.icon, {
      fontFamily: FONT,
      fontSize: '30px',
    })
    .setOrigin(0.5);

  // Header tag
  const tag = scene.add
    .text(-pw / 2 + 70, -14, '🏆 ACHIEVEMENT UNLOCKED!', {
      fontFamily: FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#fbbf24',
    })
    .setOrigin(0, 0.5);

  // Title
  const title = scene.add
    .text(-pw / 2 + 70, 8, def.title, {
      fontFamily: FONT,
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff',
    })
    .setOrigin(0, 0.5);

  // Reward pill
  const rewardTxt = scene.add
    .text(pw / 2 - 20, 0, `+${def.gemReward} 💎`, {
      fontFamily: FONT,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#67e8f9',
    })
    .setOrigin(1, 0.5);

  container.add([bg, iconTxt, tag, title, rewardTxt]);

  // Particle burst at banner center
  if (scene.burst) {
    scene.burst(W / 2, 45, 0xffd54f, 16);
    scene.burst(W / 2, 45, 0x67e8f9, 12);
  }

  // Slide down, pause, slide up
  scene.tweens.add({
    targets: container,
    y: 52,
    duration: 450,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.time.delayedCall(3200, () => {
        scene.tweens.add({
          targets: container,
          y: -80,
          alpha: 0,
          duration: 350,
          ease: 'Cubic.easeIn',
          onComplete: () => container.destroy(),
        });
      });
    },
  });
}
