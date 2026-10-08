// ILCA 6 — part catalogue (structure only; names and texts are in /i18n/<lang>/laser.json).
// Order = list order and tour order.
//   group  key into i18n "groups"
//   off    where the part moves in the exploded view (metres; +x bow, +y up, +z starboard)
//   swing  part turns with the boom around the mast (the ILCA mast turns with the sail)
//   sub    indented detail of the part above it (sail corners and edges)
//   label  shown when "Labels" is on

export const GROUPS = ['hull', 'rig', 'sail', 'foils', 'lines', 'equipment'];

const SAIL_OFF = [-.25, 1.2, 0];

export const PARTS = [
  // hull and deck
  { id: 'hull', group: 'hull', off: [0, 0, 0], label: true },
  { id: 'deck', group: 'hull', off: [0, .35, 0], label: true },
  { id: 'cockpit', group: 'hull', off: [0, .35, 0], label: true },
  { id: 'transom', group: 'hull', off: [-.3, 0, 0] },
  { id: 'mastStep', group: 'hull', off: [0, .5, 0] },
  { id: 'daggerboardTrunk', group: 'hull', off: [0, .55, 0], label: true },
  { id: 'bowEye', group: 'hull', off: [.25, .45, 0] },
  { id: 'gudgeons', group: 'hull', off: [-.4, 0, 0] },
  { id: 'drainBung', group: 'hull', off: [-.4, -.1, .1] },
  { id: 'selfBailer', group: 'hull', off: [0, .2, 0] },
  { id: 'hikingStrap', group: 'hull', off: [0, .65, 0] },
  { id: 'travellerFairleads', group: 'hull', off: [-.15, .5, 0] },
  { id: 'deckBlock', group: 'hull', off: [0, .6, 0] },
  { id: 'controlCleats', group: 'hull', off: [0, .6, 0] },
  { id: 'plaque', group: 'hull', off: [-.1, .45, 0] },
  // rig
  { id: 'mastLower', group: 'rig', off: [0, .9, 0], swing: true, label: true },
  { id: 'mastTop', group: 'rig', off: [0, 1.5, 0], swing: true, label: true },
  { id: 'gooseneck', group: 'rig', off: [.15, .9, 0], swing: true },
  { id: 'boom', group: 'rig', off: [0, .7, 0], swing: true, label: true },
  { id: 'windIndicator', group: 'rig', off: [.3, 1.0, 0], swing: true },
  // sail
  { id: 'sail', group: 'sail', off: SAIL_OFF, swing: true, label: true },
  { id: 'luffSleeve', group: 'sail', sub: true, off: SAIL_OFF, swing: true },
  ...['luff', 'leech', 'foot', 'head', 'tack', 'clew', 'battens', 'window', 'sailNumber', 'telltales']
    .map(id => ({ id, group: 'sail', sub: true, off: SAIL_OFF, swing: true })),
  // foils and steering
  { id: 'daggerboard', group: 'foils', off: [0, -.9, 0], label: true },
  { id: 'rudder', group: 'foils', off: [-.75, -.3, 0], label: true },
  { id: 'rudderHead', group: 'foils', off: [-.6, .15, 0] },
  { id: 'tiller', group: 'foils', off: [-.35, .45, 0], label: true },
  { id: 'tillerExtension', group: 'foils', off: [-.2, .65, .2] },
  // lines and controls
  { id: 'mainsheet', group: 'lines', off: [0, 0, 0], label: true },
  { id: 'ratchetBlock', group: 'lines', off: [0, .45, 0] },
  { id: 'boomBlocks', group: 'lines', off: [0, .7, 0], swing: true },
  { id: 'traveller', group: 'lines', off: [-.15, .5, 0], label: true },
  { id: 'vang', group: 'lines', off: [.2, .8, 0], swing: true, label: true },
  { id: 'cunningham', group: 'lines', off: [0, 0, 0] },
  { id: 'outhaul', group: 'lines', off: [0, 0, 0] },
  { id: 'clewTieDown', group: 'lines', off: SAIL_OFF, swing: true },
  { id: 'hikingStrapSupport', group: 'lines', off: [0, .65, 0] },
  { id: 'daggerboardRetainer', group: 'lines', off: [0, .2, 0] },
  { id: 'rudderDownhaul', group: 'lines', off: [-.6, .15, 0] },
  { id: 'mastRetainer', group: 'lines', off: [0, .75, 0] },
  // equipment
  { id: 'compass', group: 'equipment', off: [0, .6, -.2] },
];

// Hull paint choices: [i18n key in common.colours, colour]. The deck stays white.
export const PAINTS = [['white', '#f4f4ef'], ['red', '#d7303f'], ['sunflower', '#f3c331'], ['blue', '#1f68c9'], ['teal', '#169c8f']];
