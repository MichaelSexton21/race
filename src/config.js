export const LAPS = 3;
export const KARTS_TOTAL = 6;

export const PLAYER = { name: 'You', color: 0xffcc00 };
export const AI_ROSTER = [
  { name: 'Blaze', color: 0xff3b3b },
  { name: 'Nova', color: 0x3b82ff },
  { name: 'Rusty', color: 0xc07a30 },
  { name: 'Pip', color: 0x3bd16f },
  { name: 'Viper', color: 0xb13bff },
];

export const PHYS = {
  accel: 24,
  brake: 34,
  reverseAccel: 16,
  reverseMax: -11,
  drag: 0.78,
  offRoadDrag: 2.4,
  offRoadMax: 14,
  topSpeed: 30,
  boostSpeed: 52,
  boostAccel: 46,
  boostTime: 1.25,
  turnRate: 2.3,
  driftTurn: 1.55,
  driftGrip: 2.0,
  grip: 8.0,
  iceGrip: 1.1,
  slopeAccel: 14,
  slipTime: 1.0,
  shieldTime: 4.0,
  bananaLife: 14,
  kartRadius: 1.1,
};

export const ITEM_INFO = {
  boost: { label: 'MUSHROOM', color: '#ff7043' },
  banana: { label: 'BANANA', color: '#f4e04d' },
  shield: { label: 'SHIELD', color: '#66ccff' },
};
