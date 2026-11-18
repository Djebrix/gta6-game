// SOLMAR — configuration: world layout, palette, vehicle types, tuning.
// Everything in this file is original: a fictional sun-soaked coastal city.
export const WORLD = { w: 2600, h: 1900 };

// Road grid: vertical avenues and horizontal streets (centrelines).
export const V_ROADS = [150, 450, 750, 1050, 1350, 1650, 1950, 2250];
export const H_ROADS = [150, 410, 670, 930, 1190, 1450, 1710];
export const ROAD_W = 64;
export const SIDEWALK = 18;

// Beach strip along the south edge; water below it.
export const BEACH = { y0: 1710, sandTo: 1820, waterTo: 1900 };

// Sun-soaked palette.
export const PALETTE = {
  grass: '#79a95b',
  grassDark: '#6b9a4e',
  asphalt: '#3b404b',
  asphaltLight: '#464c59',
  lane: '#e8c33a',
  sidewalk: '#b7b0a1',
  curb: '#9a927f',
  sand: '#e9d6a2',
  sandDark: '#dcc78d',
  water: '#2fa8c9',
  waterDeep: '#1e8fb0',
  park: '#6fa354',
  plaza: '#c9bfa9',
  buildingSide: '#8d8578',
  roofs: ['#c96f4a', '#d9a441', '#7fb3d5', '#a87fb0', '#e0d7c3', '#5f9e7a', '#c95f6e', '#8a7fb8'],
  glass: ['#8fc3dd', '#a8d0e0', '#7fb8cc'],
  tree: '#3f7a34',
  treeLight: '#5a9a44',
  palm: '#4d8a3c',
};

// Vehicle types. speed in px/s, accel in px/s^2, turn in rad/s at full lock.
export const CAR_TYPES = {
  sedan:  { w: 46, h: 22, accel: 260, maxSpeed: 330, reverse: 120, turn: 2.6, colors: ['#c0392b', '#2e6da4', '#e0e0e0', '#3a3a3a', '#7a4a8a'] },
  taxi:   { w: 46, h: 22, accel: 250, maxSpeed: 320, reverse: 120, turn: 2.6, colors: ['#f2c200'] },
  sport:  { w: 48, h: 21, accel: 420, maxSpeed: 470, reverse: 140, turn: 3.1, colors: ['#d81b60', '#ffb300', '#00acc1', '#e0e0e0'] },
  truck:  { w: 58, h: 24, accel: 200, maxSpeed: 280, reverse: 100, turn: 2.1, colors: ['#6d4c41', '#5d4037', '#37474f'] },
  van:    { w: 52, h: 24, accel: 220, maxSpeed: 300, reverse: 110, turn: 2.3, colors: ['#eceff1', '#90a4ae', '#a1887f'] },
  police: { w: 48, h: 22, accel: 380, maxSpeed: 440, reverse: 150, turn: 3.0, colors: ['#1c2733'] },
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  runSpeed: 265,
  health: 100,
  punchDamage: 25,
  pistolDamage: 34,
  pistolMag: 12,
  pistolRange: 420,
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 26,      // seconds without crime and out of sight to lose one star
  policePerStar: 1,       // extra police cars per star, on top of the base
  basePolice: 1,
  maxPoliceCars: 7,
  crimeSteal: 1,
  crimeHitPed: 1,
  crimeHitCop: 1,
  crimeShoot: 1,
  crimeKillCop: 2,
};

// Districts, by rectangle, for the minimap labels and building style.
export const DISTRICTS = [
  { name: 'DOWNTOWN', x: 750, y: 410, w: 900, h: 780, tall: true },
  { name: 'OLD TOWN', x: 150, y: 150, w: 600, h: 1040, tall: false },
  { name: 'MARINA', x: 1950, y: 150, w: 650, h: 1040, tall: false },
  { name: 'BEACHFRONT', x: 150, y: 1450, w: 2100, h: 260, tall: false },
];

export const GARAGE = { x: 480, y: 1225 };      // Lena's garage (mission hub), west side
export const HOSPITAL = { x: 1380, y: 700 };    // hospital (heal spot), downtown
export const STORE = { x: 1080, y: 960 };       // jewelry store (mission 4)
export const MARINA_PICKUP = { x: 2220, y: 440 };// marina pickup (mission 2)
export const SAFEHOUSE = { x: 210, y: 960 };    // safehouse (mission 3)
