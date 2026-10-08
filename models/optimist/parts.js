// Optimist — part catalogue (structure only; names and texts are in /i18n/<lang>/optimist.json).
// Order = list order and tour order.
//   group  key into i18n "groups"
//   off    where the part moves in the exploded view (metres; +x bow, +y up, +z starboard)
//   swing  part turns with the boom around the mast
//   sub    indented detail of the part above it (sail corners and edges)
//   label  shown when "Labels" is on

export const GROUPS = ['hull', 'rig', 'sail', 'foils', 'lines', 'equipment'];

export const PARTS = [
  // hull
  { id: 'hull', group: 'hull', off: [0, 0, 0], label: true },
  { id: 'bowTransom', group: 'hull', off: [0, 0, 0], label: true },
  { id: 'sternTransom', group: 'hull', off: [0, 0, 0], label: true },
  { id: 'gunwale', group: 'hull', off: [0, .14, 0] },
  { id: 'rubbingStrake', group: 'hull', off: [0, .14, 0] },
  { id: 'mastThwart', group: 'hull', off: [0, .42, 0], label: true },
  { id: 'mastStep', group: 'hull', off: [0, .2, 0] },
  { id: 'midshipFrame', group: 'hull', off: [0, .3, 0] },
  { id: 'daggerboardCase', group: 'hull', off: [0, .5, 0], label: true },
  { id: 'buoyancy', group: 'hull', off: [0, .6, 0], label: true },
  { id: 'toeStraps', group: 'hull', off: [0, .42, 0], label: true },
  { id: 'gudgeons', group: 'hull', off: [-.28, 0, 0] },
  // rig
  { id: 'mast', group: 'rig', off: [0, 1.1, 0], label: true },
  { id: 'boom', group: 'rig', off: [0, .55, 0], swing: true, label: true },
  { id: 'boomJaws', group: 'rig', off: [.12, .55, 0], swing: true },
  { id: 'sprit', group: 'rig', off: [0, 1.3, .35], swing: true, label: true },
  { id: 'windIndicator', group: 'rig', off: [0, 1.4, 0] },
  // sail
  { id: 'sail', group: 'sail', off: [-.2, 1.0, 0], swing: true, label: true },
  ...['luff', 'leech', 'foot', 'head', 'tack', 'clew', 'throat', 'peak', 'battens', 'window', 'sailNumber']
    .map(id => ({ id, group: 'sail', sub: true, off: [-.2, 1.0, 0], swing: true })),
  // foils and steering
  { id: 'daggerboard', group: 'foils', off: [0, -.8, 0], label: true },
  { id: 'rudder', group: 'foils', off: [-.55, -.25, 0], label: true },
  { id: 'tiller', group: 'foils', off: [-.35, .35, 0], label: true },
  { id: 'tillerExtension', group: 'foils', off: [-.2, .55, .15], label: true },
  // lines and controls
  { id: 'mainsheet', group: 'lines', off: [0, 0, 0], label: true },
  { id: 'blocks', group: 'lines', off: [0, .3, 0] },
  { id: 'vang', group: 'lines', off: [0, .7, 0], swing: true },
  { id: 'spritHalyard', group: 'lines', off: [0, 1.15, .2], swing: true },
  { id: 'outhaul', group: 'lines', off: [-.1, .75, 0], swing: true },
  { id: 'sailTies', group: 'lines', off: [-.2, 1.0, 0], swing: true },
  { id: 'painter', group: 'lines', off: [.45, .6, 0] },
  { id: 'daggerboardRetainer', group: 'lines', off: [0, .15, 0] },
  // equipment
  { id: 'bailer', group: 'equipment', off: [0, .65, -.35] },
  { id: 'paddle', group: 'equipment', off: [0, .75, .35] },
  { id: 'compass', group: 'equipment', off: [.1, .6, 0] },
];

// Hull paint choices: [i18n key in common.colours, colour]
export const PAINTS = [['white', '#f4f4ef'], ['red', '#d7303f'], ['sunflower', '#f3c331'], ['blue', '#1f68c9'], ['teal', '#169c8f']];
