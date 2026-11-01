import { BIRD_CATALOGUE, PETS, PredatorKind } from './data';

export interface BirdLogEntry {
  id: string;
  name: string;
  subtitle: string;
  category: 'Evolution' | 'Sanctuary' | 'Exotic' | 'Legendary';
  diet: string;
  drops: string;
  behavior: string;
  lore: string;
  fieldTips: string;
  spriteKey: string;
  animKey?: string;
  hasCrown?: boolean;
  scale?: number;
}

export interface AllyLogEntry {
  id: string;
  name: string;
  title: string;
  worldStage: string;
  stageReq: number;
  ability: string;
  lore: string;
  tactics: string;
  spriteKey: string;
}

export interface EnemyLogEntry {
  id: PredatorKind;
  name: string;
  title: string;
  dangerStars: number;
  hpRange: string;
  worldHabitat: string;
  threatType: string;
  description: string;
  weaknessStrategy: string;
  spriteKey: string;
}

export const BIRD_ENTRIES: BirdLogEntry[] = [
  {
    id: 'sparrow_0',
    name: 'Songbird Chick',
    subtitle: 'Stage 0 • Baby Fledgling',
    category: 'Evolution',
    diet: 'Fresh Seeds & Fine Grains',
    drops: 'Silver Coins (15c)',
    behavior: 'Hungry Forager (hops & flutters)',
    lore: 'Newly hatched from a warm twig nest! A round ball of downy feathers with an insatiable appetite. Chirps enthusiastically whenever seeds tumble from the sky.',
    fieldTips: 'Feed regularly with Basic Seeds (5c) to accelerate growth into Stage 1. Keep close watch during early predator waves—chicks are vulnerable targets!',
    spriteKey: 'bird_sparrow_0',
    scale: 0.85,
  },
  {
    id: 'sparrow_1',
    name: 'Juvenile Songbird',
    subtitle: 'Stage 1 • Agile Scout',
    category: 'Evolution',
    diet: 'Seeds & Canopy Grains',
    drops: 'Gold Coins (35c)',
    behavior: 'Curious Acrobat (swifter flight)',
    lore: 'Having sprouted vibrant teal feathers and a double crest, this juvenile songbird takes to the air with speed and confidence. Helps spot drifting food before it touches the soil.',
    fieldTips: 'Drops valuable gold coins on a steady rhythm. Can survive longer between meals, but keeping its fullness above 60% ensures max coin production.',
    spriteKey: 'bird_sparrow_1',
    scale: 0.82,
  },
  {
    id: 'sparrow_2',
    name: 'Adult Songbird',
    subtitle: 'Stage 2 • Master Aviator',
    category: 'Evolution',
    diet: 'Seeds, Berries & Helicopter Nuts',
    drops: 'Gold Coins (35c) & Sapphires (75c)',
    behavior: 'Canopy Weaver (gathers twigs for nests)',
    lore: 'The pride of the canopy! Boasts sweeping plumage, layered amber wings, and deep harmonic singing. At full maturity, it actively seeks dry branches to weave sturdy nests.',
    fieldTips: 'Weaves nests on perches that allow Mama Songbird to incubate eggs. Drops rare blue sapphires when singing in harmony with Canary companions.',
    spriteKey: 'bird_sparrow_2',
    scale: 0.80,
  },
  {
    id: 'sparrow_3',
    name: 'King Songbird',
    subtitle: 'Stage 3 • Royal Flock Patriarch',
    category: 'Evolution',
    diet: 'Premium Berries & Royal Seeds',
    drops: 'Royal Diamonds & Golden Plumes (80 Feathers)',
    behavior: 'Monarch Aura (+25% Flock Drop Frequency)',
    lore: 'Adorned with an ancient triple-gem golden crown, this sovereign songbird commands the respect of the flock. In the volcanic peaks, sacrificing this crowned monarch to the Sacred Pyre ignites its rebirth as the immortal Golden Phoenix!',
    fieldTips: 'Achieved later in the game (World 3+): feed a Tier 3 Golden Berry to an Adult Songbird in a cozy nest! In World 4, offering this King to the Phoenix Pyre consumes it in holy flames to rebirth it as the legendary Golden Phoenix!',
    spriteKey: 'bird_sparrow_2',
    hasCrown: true,
    scale: 0.82,
  },
  {
    id: 'canary',
    name: 'Yellow Canary',
    subtitle: 'The Cheerful Choralist',
    category: 'Sanctuary',
    diet: 'Fine Canary Grass & Millet',
    drops: 'Gold Coins & Cheerful Notes',
    behavior: 'Songster (Trills choir melodies)',
    lore: 'Native to sun-drenched coastal groves. Its brilliant yellow plumage and sweet soprano voice bring joy to the entire aviary.',
    fieldTips: 'Every 20-30 seconds, the Canary bursts into song. Any birds within earshot are inspired to immediately drop bonus coins and gems!',
    spriteKey: 'bird_canary',
    scale: 0.9,
  },
  {
    id: 'mama',
    name: 'Mama Songbird',
    subtitle: 'Flock Matriarch & Breeder',
    category: 'Sanctuary',
    diet: 'Parachute Seeds & Sweet Corn',
    drops: 'Warm Nesting Eggs (Hatch Free Songbirds)',
    behavior: 'Breeder (Flies, feeds & breeds)',
    lore: 'A gentle rose-breasted songbird matriarch. Requires regular feeding to stay healthy; when well-fed, she visits completed nests and leaves warm eggs for flockmates to incubate.',
    fieldTips: 'Feed her nutritious parachute seeds or sweet corn! When sated, she seeks cozy completed nests to lay songbird eggs and moves on to keep the flock growing.',
    spriteKey: 'bird_mama',
    scale: 0.9,
  },
  {
    id: 'toucan',
    name: 'Rainbow Toucan',
    subtitle: 'Tropical Berry Connoisseur',
    category: 'Exotic',
    diet: 'Sweet Berries Only (Disdains Seeds)',
    drops: 'Golden Melons & Tropical Jewels (150c)',
    behavior: 'Gourmet (Refuses standard food)',
    lore: 'Famous for its enormous gradient rainbow beak. A true aristocrat of the rainforest who will turn its nose up at common seeds and grains.',
    fieldTips: 'Upgrade food quality in the toolbar to Level 3 (Sweet Berries) before purchasing a Toucan! In exchange, its fruit drops yield astronomical profit.',
    spriteKey: 'bird_toucan',
    scale: 0.9,
  },
  {
    id: 'piranha_finch',
    name: 'Peregrine Falcon',
    subtitle: 'Supersonic Raptor Hunter',
    category: 'Exotic',
    diet: 'Live Feeder Chicks (Carnivore)',
    drops: 'Brilliant Diamonds (200c)',
    behavior: 'Carnivore (Hunts baby chicks only)',
    lore: 'The undisputed master of the high skies. Reaching diving speeds over 240 mph, this hooded raptor specializes in striking baby chicks mid-flight.',
    fieldTips: 'Will not eat seeds! Strictly preys on baby chicks (stage 0) or feeder chicks. Keep Mama Songbird breeding or supply baby birds to satisfy its raptor appetite. Each hunt yields a sparkling Diamond!',
    spriteKey: 'bird_piranha_finch',
    scale: 0.9,
  },
  {
    id: 'owl',
    name: 'Great Horned Owl',
    subtitle: 'Apex Raptor of the Ancient Woods',
    category: 'Legendary',
    diet: 'Carnivores & Large Prey',
    drops: 'Ancient Treasure Chests (350c)',
    behavior: 'Apex Predator (Commands the high canopy)',
    lore: 'Wise, silent, and imposing. With razor-sharp vision and soundless flight, the Great Horned Owl presides over the high canopy like an ancient king.',
    fieldTips: 'Eats carnivores like the Piranha-Finch! An advanced luxury bird for late-game aviaries that drops enormous treasure chests worth 350 coins.',
    spriteKey: 'bird_owl',
    scale: 0.95,
  },
  {
    id: 'infiltrator',
    name: 'Suspicious Finch',
    subtitle: 'Mysterious Fluffy Companion (?)',
    category: 'Legendary',
    diet: 'Seeds, Treats & Head Scratches',
    drops: 'Shiny Mystery Trinkets (100c)',
    behavior: 'Playful Purring Hopper',
    lore: 'Something about this feathered friend is slightly unusual... It cannot fly especially high, purrs like a kitten when fed, and tries its absolute best to blend in.',
    fieldTips: 'A beloved quirky mascot. Highly resilient and drops reliable mystery currency while bringing a smile to your aviary.',
    spriteKey: 'bird_infiltrator',
    scale: 0.9,
  },
  {
    id: 'phoenix',
    name: 'Golden Phoenix',
    subtitle: 'Immortal Solar Deity',
    category: 'Legendary',
    diet: 'Sacred Berries & Solar Embers',
    drops: 'Sun Embers (500c) & Holy Sparks',
    behavior: 'Solar Deity (Revives fallen birds)',
    lore: 'Born from celestial flames atop the Volcanic Mystic Peak. Radiates an ambient aura of vitality that keeps the terrarium warm in the coldest storms.',
    fieldTips: 'Born when an adult bird consumes a burning Cinder Acorn dropped by the Sugar Glider! Drops dazzling 200-feather Sun Embers and periodically emits sacred sparks.',
    spriteKey: 'bird_phoenix',
    scale: 1.0,
  },
  {
    id: 'sugar_glider',
    name: 'Sugar Glider',
    subtitle: 'Nocturnal Gliding Marsupial',
    category: 'Exotic',
    diet: 'Nectar, Fruit & High Canopy Tree Sap',
    drops: 'Cinder Acorns (Phoenix Catalyst)',
    behavior: 'Arboreal Glider (Glides between perches)',
    lore: 'A charming non-avian resident of the high canopy with big curious nocturnal eyes and a soft gliding patagium membrane. Leaps from bough to bough across the aviary.',
    fieldTips: 'Periodically drops smoking Cinder Acorns! Beware: chicks will burn if they eat one, but an adult bird that consumes a Cinder Acorn ascends into the legendary Golden Phoenix!',
    spriteKey: 'sugar_glider_perch',
    scale: 1.1,
  },
];

export const ALLY_ENTRIES: AllyLogEntry[] = PETS.map((pet) => {
  const tacticsMap: Record<string, string> = {
    hedgehog: 'Essential for beginners! Place Spike at the bottom to ensure no falling coins hit the dirt and vanish.',
    badger: 'Unearths bonus currency on a fixed timer. Excellent passive income booster for long stages.',
    squirrel: 'High-utility sniper. Stuns flying hawks and vipers, giving you valuable extra seconds to aim your slingshot.',
    porcupine: 'Great counter against diving hawks and leaping alley cats who strike low across the floor.',
    mama: 'Pet Mama Dove flutters freely and periodically lays warm eggs in completed nests without needing food!',
    woodpecker: 'Takes 5 minutes to excavate a cozy tree-hollow roost. Drums the oak canopy to drop basic Level 1 helicopter seeds whenever flock birds turn hungry (green), regardless of shop food upgrades.',
    butterfly: 'Intercepts coins and food mid-air. Pairs wonderfully with Toucans who drop high-flying fruit.',
    magpie: 'Brings high-value loot bags from outside. One of the strongest pure economy companions.',
    snail: 'Slows gravity for coins and food by 40%. Perfect for chaotic multi-bird frenzy levels.',
    mole: 'Click his tossed pinecones quickly before they fall to trigger high-yield coin explosions!',
    hound: 'His roar provides an instant 1.5s freeze across all active enemies. Essential in World 3 and 4 boss fights.',
    owl: 'Reveals incoming predator spawn beacons early and displays numerical enemy HP bars for tactical focus.',
    frog: 'Anti-air specialist! Headbutts diving raptors back to the top of the screen.',
    hummingbird: 'Creates upward air drafts to keep sinking seeds hovering within reach of juvenile birds.',
    firefly: 'Electrifies mature birds to drop rare glowing sparks worth high shop points.',
    ferret: 'Vicious DPS attacker. Leaps onto invading bosses and inflicts continuous physical damage.',
    hen: 'Lays solid 250c Golden Eggs on a reliable cadence. The gold standard of economy pets.',
    nightingale: 'Enhances overall flock productivity. Synergizes with Canaries for continuous coin fountains.',
    phoenix_chick: 'Protects your most valuable birds from accidental starvation with holy resurrection embers.',
    chameleon: 'Adaptable wild card! Tap Echo anytime during a stage to morph into whichever helper you need most.',
  };

  return {
    id: pet.key,
    name: pet.name,
    title: pet.role,
    worldStage: `World ${pet.stageLabel}`,
    stageReq: pet.stageReq,
    ability: pet.desc,
    lore: `Rescued companion helper discovered during your terrarium expedition. Pledges loyalty to aid your flock in battle and sanctuary care.`,
    tactics: tacticsMap[pet.key] ?? 'Select this companion before starting a stage to activate their unique passive buff.',
    spriteKey: 'pet_' + pet.key,
  };
});

export const ENEMY_ENTRIES: EnemyLogEntry[] = [
  {
    id: 'hawk',
    name: 'Wild Hawk',
    title: 'Swooping Canopy Raider',
    dangerStars: 3,
    hpRange: '10 - 14 HP',
    worldHabitat: 'World 1: Verdant Meadow',
    threatType: 'High-Speed Aerial Dive',
    description: 'A sharp-eyed bird of prey that circles high above the tree line before locking onto any bird and executing sudden supersonic dive attacks.',
    weaknessStrategy: 'Use your Slingshot to click directly on its body as soon as it enters. Acorn Sniper (Nutty) or Spike can deflect its dive trajectory.',
    spriteKey: 'enemy_hawk',
  },
  {
    id: 'crow',
    name: 'Thieving Shadow Crow',
    title: 'Coin & Trinket Pilferer',
    dangerStars: 2,
    hpRange: '10 - 14 HP',
    worldHabitat: 'World 2: Rainforest Canopy',
    threatType: 'Currency Thefts & Swerving Feints',
    description: 'An intelligent, crafty corvid attracted to all things shiny. Swerves through the flock to snatch silver and gold coins right out of mid-air.',
    weaknessStrategy: 'Prioritize collecting high-value coins quickly before the crow swoops. Flutter the Butterfly and Spike the Hedgehog help scoop coins first.',
    spriteKey: 'enemy_crow',
  },
  {
    id: 'cat',
    name: 'Prowling Alley Cat',
    title: 'Ambush Branch Stalker',
    dangerStars: 3,
    hpRange: '14 - 18 HP',
    worldHabitat: 'World 1 & 4',
    threatType: 'Vertical Leaping Swats',
    description: 'Stealthy predator that prowls lower tree limbs and perches. Coils its hind legs before launching vertical pounces to swat low-flying birds.',
    weaknessStrategy: 'Strike the cat while it is coiling to leap! If it lands on a branch, hit it with rapid slingshot clicks to knock it off balance.',
    spriteKey: 'enemy_cat',
  },
  {
    id: 'snake',
    name: 'Tree Viper',
    title: 'Venomous Foliage Lurker',
    dangerStars: 3,
    hpRange: '14 - 20 HP',
    worldHabitat: 'World 2: Rainforest Canopy',
    threatType: 'Branch Strikes & Nest Invasions',
    description: 'Camouflaged emerald viper that slithers along tree branches. Strikes with lightning speed at resting birds or unattended eggs.',
    weaknessStrategy: 'Inspect branches before resting your birds. Bouncer the Frog and Bristle the Porcupine punish its lunges severely.',
    spriteKey: 'enemy_snake',
  },
  {
    id: 'raccoon',
    name: 'Masked Tree Raccoon',
    title: 'Nocturnal Nest Raider',
    dangerStars: 4,
    hpRange: '16 - 20 HP',
    worldHabitat: 'World 2: Rainforest Canopy',
    threatType: 'Egg Thefts & Sturdy Defense',
    description: 'Dexterous and surprisingly durable raider with bandit markings. Targets active nesting spots to carry off precious unhatched eggs.',
    weaknessStrategy: 'Requires concentrated slingshot fire. Bramble the Hound’s bark will stun the raccoon, forcing it to drop stolen eggs immediately.',
    spriteKey: 'enemy_raccoon',
  },
  {
    id: 'bombardier',
    name: 'Bombardier Osprey',
    title: 'Aerial Artillery Raptor',
    dangerStars: 4,
    hpRange: '20 - 25 HP',
    worldHabitat: 'World 2 & 4',
    threatType: 'Guided Homing Missiles',
    description: 'Armored high-altitude raptor equipped with dual ordnance missile pods that launches guided homing missiles downward into your flock.',
    weaknessStrategy: 'Shoot down its guided missiles before they strike your birds! Concentrated weapon fire brings down the Osprey.',
    spriteKey: 'enemy_bombardier',
  },
  {
    id: 'spider',
    name: 'Canopy Silk Spider',
    title: 'Web Trapper & Weaver',
    dangerStars: 3,
    hpRange: '16 - 20 HP',
    worldHabitat: 'World 3: Blossom Sanctuary',
    threatType: 'Sticky Web Traps',
    description: 'A giant arachnid that lowers itself on glistening silk lines and weaves adhesive web nets that paralyze flying birds upon contact.',
    weaknessStrategy: 'Click directly on spun spiderwebs with your cursor to tear them down before your birds fly into them. Take down the spider to clear all webs.',
    spriteKey: 'enemy_spider',
  },
  {
    id: 'weasel',
    name: 'Sly Woodland Weasel',
    title: 'Evasive Feint Acrobat',
    dangerStars: 4,
    hpRange: '16 - 22 HP',
    worldHabitat: 'World 3: Blossom Sanctuary',
    threatType: 'Erratic Zig-Zag Dodging',
    description: 'An extraordinarily agile predator that dashes and feints. Can detect your cursor aim and dodge incoming single-target slingshot fire.',
    weaknessStrategy: 'Do not click where the weasel is; click slightly ahead in its path of movement. Upgraded weapons with spread shot counter its agility.',
    spriteKey: 'enemy_weasel',
  },
  {
    id: 'glutton',
    name: 'Gorgon the Glutton',
    title: 'Insatiable Armored Behemoth',
    dangerStars: 5,
    hpRange: 'Immune to Weapons (Food Meter)',
    worldHabitat: 'World 3: Blossom Sanctuary',
    threatType: 'Weapon Immunity & Chick Vacuum',
    description: 'A monstrous gluttonous beast encased in thick armadillo-like plating. Physical stones and laser blasts bounce harmlessly off its hide!',
    weaknessStrategy: 'OVERFEED HIM! Drop seeds and berries directly into his gaping maw. When his belly becomes over-stuffed, he bursts into a massive fountain of coins!',
    spriteKey: 'enemy_glutton',
  },
  {
    id: 'vulture',
    name: 'Gourmet Vulture',
    title: 'Titanic Carrion Scavenger',
    dangerStars: 5,
    hpRange: '35 - 45 HP',
    worldHabitat: 'World 3 & 4',
    threatType: 'Colossal HP Pool & Adult Bird Snatcher',
    description: 'A massive feathered titan with a hooked iron beak and huge wingspan. Targets adult birds and drains terrarium resources through brute force.',
    weaknessStrategy: 'Unleash full firepower with upgraded slingshots and bow/rifles. Fang the Ferret and Nutty the Squirrel provide crucial automated DPS.',
    spriteKey: 'enemy_vulture',
  },
  {
    id: 'wyvern',
    name: 'Volcanic Wyvern',
    title: 'The Blazing Tyrant • Final Boss',
    dangerStars: 5,
    hpRange: '40 - 55+ HP',
    worldHabitat: 'World 4: Volcanic Mystic Peaks',
    threatType: 'Firewave Breaths & Minion Summons',
    description: 'The supreme ancient dragon of the volcanic heights. Breathes incinerating firestorm waves across the sky and summons Ash Crows to shield itself.',
    weaknessStrategy: 'Target its glowing horns when charging breath attacks to interrupt its firewave. Use holy embers from Asher or Phoenix to revive fallen birds.',
    spriteKey: 'enemy_wyvern',
  },
];
