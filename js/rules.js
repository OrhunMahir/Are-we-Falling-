/* KARA KUTU — shared rules. Used by BOTH the cockpit (to check answers) and the
   tower handbook (to print the rules), so the two can never disagree. */
(function (root) {
  'use strict';

  // ---------- seeded RNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) {
    const r = mulberry32(seed);
    const rng = () => r();
    rng.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    rng.pick = (arr) => arr[Math.floor(r() * arr.length)];
    rng.chance = (p) => r() < p;
    rng.shuffle = (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    return rng;
  }

  const VOWELS = 'AEIOU';
  const isVowel = (ch) => VOWELS.includes(ch);

  // ---------- aircraft data (the placard) ----------
  function genAircraft(rng) {
    const cons = 'BCDFGHJKLMNPRSTVWXZ';
    const letters = [];
    for (let i = 0; i < 3; i++) letters.push(rng.chance(0.4) ? rng.pick(VOWELS.split('')) : rng.pick(cons.split('')));
    return {
      flight: rng.int(101, 998),
      reg: 'D-A' + letters.join(''),
      souls: rng.int(9, 21) * 10 + rng.int(1, 9),
      apu: rng.chance(0.5),
      ice: rng.chance(0.5),
    };
  }
  const ac = {
    flightLast: (a) => a.flight % 10,
    flightOdd: (a) => a.flight % 2 === 1,
    regLastVowel: (a) => isVowel(a.reg[a.reg.length - 1]),
    regVowelCount: (a) => a.reg.slice(3).split('').filter(isVowel).length,
    lightsLit: (a) => (a.apu ? 1 : 0) + (a.ice ? 1 : 0),
  };

  const ORD = ['1st', '2nd', '3rd', '4th', '5th'];

  // =====================================================================
  // MODULE: BREAKERS
  // =====================================================================
  const BRK_COLORS = ['RED', 'AMBER', 'BLUE', 'WHITE', 'GREEN'];
  const BRK_AMPS = [5, 10, 15, 20, 30];
  const breakerRules = [
    {
      text: 'If the <b>APU</b> light is lit and there is at least one <b>GREEN</b> breaker: pull the <b>leftmost GREEN</b> breaker.',
      when: (a, s) => a.apu && s.breakers.some((b) => b.color === 'GREEN'),
      pick: (a, s) => s.breakers.findIndex((b) => b.color === 'GREEN'),
    },
    {
      text: 'Otherwise, if any amp rating appears <b>more than once</b>: pull the <b>rightmost</b> breaker whose rating is repeated.',
      when: (a, s) => repeatedIdx(s).length > 0,
      pick: (a, s) => Math.max.apply(null, repeatedIdx(s)),
    },
    {
      text: 'Otherwise, if there is <b>no RED</b> breaker: pull the breaker with the <b>highest</b> amp rating.',
      when: (a, s) => !s.breakers.some((b) => b.color === 'RED'),
      pick: (a, s) => extremeIdx(s, +1),
    },
    {
      text: 'Otherwise, if the <b>last digit of the flight number is even</b>: pull the breaker <b>immediately right of the leftmost RED</b> one. (If that RED breaker is the last in the row, pull the 1st breaker.)',
      when: (a, s) => !ac.flightOdd(a),
      pick: (a, s) => {
        const i = s.breakers.findIndex((b) => b.color === 'RED');
        return i === s.breakers.length - 1 ? 0 : i + 1;
      },
    },
    {
      text: 'Otherwise: pull the breaker with the <b>lowest</b> amp rating.',
      when: () => true,
      pick: (a, s) => extremeIdx(s, -1),
    },
  ];
  function repeatedIdx(s) {
    const out = [];
    s.breakers.forEach((b, i) => {
      if (s.breakers.filter((x) => x.amps === b.amps).length > 1) out.push(i);
    });
    return out;
  }
  function extremeIdx(s, dir) {
    let best = 0;
    s.breakers.forEach((b, i) => { if ((b.amps - s.breakers[best].amps) * dir > 0) best = i; });
    return best;
  }
  const breakers = {
    id: 'breakers', title: 'CIRCUIT BREAKERS', short: 'BREAKERS',
    gen(rng) {
      const unique = rng.chance(0.6);
      const amps = unique ? rng.shuffle(BRK_AMPS) : [0, 1, 2, 3, 4].map(() => rng.pick(BRK_AMPS));
      return { breakers: amps.map((amp) => ({ color: rng.pick(BRK_COLORS), amps: amp })) };
    },
    solve(a, s) {
      for (let i = 0; i < breakerRules.length; i++) {
        if (breakerRules[i].when(a, s)) return { index: breakerRules[i].pick(a, s), rule: i };
      }
    },
    manual: {
      ask: 'Ask the pilot: the <b>colour</b> and <b>amp rating</b> of all five breakers, left to right. You may also need the <b>APU light</b> and the <b>flight number</b> from the placard.',
      intro: 'A short circuit is feeding the fault. Exactly <b>one</b> breaker must be pulled. Go down the list and stop at the <b>first</b> line that is true.',
      list: breakerRules.map((r) => r.text),
      warn: 'Pulling the wrong breaker damages the aircraft.',
    },
  };

  // =====================================================================
  // MODULE: ENGINE FIRE
  // =====================================================================
  const FIRE_STEPS = { IDLE: 'THRUST IDLE', CUTOFF: 'FUEL CUTOFF', HANDLE: 'FIRE HANDLE', A: 'BOTTLE A', B: 'BOTTLE B' };
  const fireTable = [
    { light: 'STEADY', cond: 'EGT below 900 °C', when: (s) => s.egt < 900, seq: ['IDLE', 'CUTOFF', 'HANDLE', 'A'] },
    { light: 'STEADY', cond: 'EGT 900 °C or more', when: (s) => s.egt >= 900, seq: ['CUTOFF', 'HANDLE', 'A', 'B'] },
    { light: 'FLASHING', cond: 'OIL below 20 psi', when: (s) => s.oil < 20, seq: ['HANDLE', 'CUTOFF', 'B'] },
    { light: 'FLASHING', cond: 'OIL 20 psi or more', when: (s) => s.oil >= 20, seq: ['IDLE', 'HANDLE', 'B', 'CUTOFF'] },
  ];
  const fire = {
    id: 'fire', title: 'ENGINE FIRE', short: 'ENG FIRE',
    gen(rng) {
      return {
        side: rng.int(1, 2),
        light: rng.pick(['STEADY', 'FLASHING']),
        egt: rng.int(70, 109) * 10,
        oil: rng.int(6, 44),
      };
    },
    solve(a, s) {
      const row = fireTable.find((r) => r.light === s.light && r.when(s));
      let seq = row.seq.slice();
      if (ac.regLastVowel(a)) seq = seq.map((x) => (x === 'A' ? 'B' : x === 'B' ? 'A' : x));
      return { side: s.side, seq };
    },
    STEPS: FIRE_STEPS,
    manual: {
      ask: 'Ask the pilot: <b>which engine</b> is burning (1 or 2), whether its FIRE light is <b>steady or flashing</b>, the <b>EGT</b> and the <b>OIL</b> pressure of that engine. You may also need the <b>registration</b> from the placard.',
      intro: 'The pilot must perform these steps <b>in exactly this order</b>, and only on the <b>burning</b> engine.',
      table: {
        head: ['FIRE light', 'Reading', 'Sequence (in order)'],
        rows: fireTable.map((r) => [r.light, r.cond, r.seq.map((x) => FIRE_STEPS[x]).join(' → ')]),
      },
      notes: [
        'If the <b>registration ends in a vowel</b> (A, E, I, O, U): swap the bottles. Every BOTTLE A becomes BOTTLE B and every BOTTLE B becomes BOTTLE A.',
        'Touching any control of the <b>healthy</b> engine counts as a mistake.',
        'After a mistake the sequence starts again from the first step.',
      ],
    },
  };

  // =====================================================================
  // MODULE: NAV RADIO (morse ident)
  // =====================================================================
  const MORSE = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
    K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
    U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  };
  const BEACONS = [
    ['MUN', '112.30'], ['MNU', '114.75'], ['NUM', '109.50'], ['MUC', '117.10'],
    ['UMN', '113.40'], ['DKB', '115.90'], ['DBK', '110.65'], ['KBD', '116.25'],
    ['OTT', '111.80'], ['TTO', '108.45'], ['WLD', '112.95'], ['LDW', '118.05'],
  ];
  const radio = {
    id: 'radio', title: 'NAV RADIO', short: 'NAV RADIO',
    gen(rng) {
      const b = rng.pick(BEACONS);
      let mhz, khz;
      do { mhz = rng.int(108, 118); khz = rng.int(0, 19) * 5; } while (fmt(mhz, khz) === b[1]);
      return { ident: b[0], mhz, khz };
    },
    solve(a, s) { return { freq: BEACONS.find((b) => b[0] === s.ident)[1] }; },
    fmt,
    MORSE, BEACONS,
    manual: {
      ask: 'Ask the pilot to describe the blinking <b>IDENT lamp</b>: short and long flashes, with a pause between letters. The beacon sends <b>three letters</b>, then a long gap, then repeats.',
      intro: 'Decode the three letters, find the beacon below, and have the pilot <b>tune that frequency</b> with the two knobs (MHz and kHz) and press <b>TUNE</b>.',
      morse: MORSE,
      table: { head: ['Beacon', 'Frequency'], rows: BEACONS.map((b) => [b[0], b[1]]) },
      notes: ['Several beacons use the same letters in a different order. Order matters.', 'Pressing TUNE on the wrong frequency is a mistake.'],
    },
  };
  function fmt(mhz, khz) { return mhz + '.' + String(khz).padStart(2, '0'); }

  // =====================================================================
  // MODULE: HYDRAULICS
  // =====================================================================
  const HYD_SW = [
    { key: 'gp', label: 'GREEN ENG PUMP', on: 'ON', off: 'OFF',
      text: '<b>GREEN ENG PUMP</b>: <b>OFF</b> if GREEN pressure is below 1000. Otherwise <b>ON</b>.',
      want: (a, s) => s.g >= 1000 },
    { key: 'yp', label: 'YELLOW ENG PUMP', on: 'ON', off: 'OFF',
      text: '<b>YELLOW ENG PUMP</b>: <b>OFF</b> if YELLOW pressure is below 1000. Otherwise <b>ON</b>.',
      want: (a, s) => s.y >= 1000 },
    { key: 'bp', label: 'BLUE ELEC PUMP', on: 'ON', off: 'OFF',
      text: '<b>BLUE ELEC PUMP</b>: <b>ON</b> if BLUE pressure is 1500 or more, or if the <b>ICE</b> light is lit. Otherwise <b>OFF</b>.',
      want: (a, s) => s.b >= 1500 || a.ice },
    { key: 'ptu', label: 'PTU', on: 'ON', off: 'OFF',
      text: '<b>PTU</b>: <b>ON</b> only if <b>exactly one</b> of GREEN and YELLOW is below 1000. Otherwise <b>OFF</b>.',
      want: (a, s) => (s.g < 1000) !== (s.y < 1000) },
    { key: 'rat', label: 'RAT', on: 'DEPLOY', off: 'STOW',
      text: '<b>RAT</b>: <b>DEPLOY</b> if <b>two or more</b> of the three systems are below 1000, or if BLUE is below 1500 and there are <b>more than 150 souls</b> on board. Otherwise <b>STOW</b>.',
      want: (a, s) => [s.g, s.b, s.y].filter((p) => p < 1000).length >= 2 || (s.b < 1500 && a.souls > 150) },
  ];
  const hyd = {
    id: 'hyd', title: 'HYDRAULICS', short: 'HYDRAULICS',
    SW: HYD_SW,
    gen(rng) {
      const p = () => (rng.chance(0.45) ? rng.int(2, 19) * 50 : rng.int(21, 60) * 50);
      const s = { g: p(), b: p(), y: p(), sw: {} };
      HYD_SW.forEach((w) => { s.sw[w.key] = rng.chance(0.5); });
      return s;
    },
    solve(a, s) {
      const want = {};
      HYD_SW.forEach((w) => { want[w.key] = !!w.want(a, s); });
      return { want };
    },
    ensureUnsolved(a, s, rng) {
      const want = hyd.solve(a, s).want;
      if (HYD_SW.every((w) => s.sw[w.key] === want[w.key])) {
        const k = rng.pick(HYD_SW).key; s.sw[k] = !s.sw[k];
      }
    },
    manual: {
      ask: 'Ask the pilot: the pressure (psi) of the <b>GREEN</b>, <b>BLUE</b> and <b>YELLOW</b> systems. You may also need the <b>ICE light</b> and <b>souls on board</b> from the placard.',
      intro: 'Work out the correct position of <b>all five</b> switches. Only when every switch is set, the pilot presses <b>CONFIRM</b>.',
      list: HYD_SW.map((w) => w.text),
      warn: 'Pressing CONFIRM with any switch wrong is a mistake. The panel will not say which one.',
    },
  };

  // =====================================================================
  // MODULE: CABIN INTERCOM (voice)
  // =====================================================================
  const CALLS = [
    { key: 'SMOKE', clip: 'call_smoke', text: 'Captain! Captain, it\'s the cabin! There\'s smoke, thick smoke, coming out of the rear galley! People are screaming back here, what do we do?!' },
    { key: 'WINDOW', clip: 'call_window', text: 'Captain, a window just cracked! The whole pane is spiderwebbing, I can hear the air whistling through it! That window is not going to hold!' },
    { key: 'DOOR', clip: 'call_door', text: 'Captain! A passenger is at the rear exit, he\'s pulling the handle! He is trying to open the door! We can\'t hold him back much longer!' },
    { key: 'INJURED', clip: 'call_injured', text: 'Captain, that last drop threw people into the ceiling! We have injured passengers lying in the aisle. Injured, bleeding, and half the cabin isn\'t strapped in!' },
    { key: 'SPARKS', clip: 'call_sparks', text: 'Captain! Passengers on the left side are seeing sparks! Bright sparks shooting out from under the wing! Everyone is out of their seats trying to look!' },
    { key: 'FAINTING', clip: 'call_faint', text: 'Captain... it\'s getting really hard to breathe back here. People are fainting in their seats... they\'re fainting, and nothing is happening! Please, hurry!' },
  ];
  const PA = { MASKS: 'OXY MASKS', BELTS: 'SEAT BELTS', BRACE: 'BRACE', GALLEY: 'GALLEY OFF', LOCK: 'LOCK DOORS', MEDIC: 'MEDIC' };
  const PA_KEYS = ['MASKS', 'BELTS', 'BRACE', 'GALLEY', 'LOCK', 'MEDIC'];
  const ALT_COLORS = ['GREEN', 'AMBER', 'RED'];
  const PA_TABLE = {
    //           GREEN     AMBER     RED
    SMOKE:    ['GALLEY', 'GALLEY', 'MASKS'],
    WINDOW:   ['BELTS',  'MASKS',  'MASKS'],
    DOOR:     ['LOCK',   'LOCK',   'BRACE'],
    INJURED:  ['MEDIC',  'BELTS',  'BELTS'],
    SPARKS:   ['BELTS',  'GALLEY', 'BRACE'],
    FAINTING: ['MEDIC',  'MASKS',  'MASKS'],
  };
  const intercom = {
    id: 'intercom', title: 'CABIN INTERCOM', short: 'INTERCOM',
    CALLS, PA, PA_KEYS,
    gen(rng) {
      const calls = rng.shuffle(CALLS).slice(0, 2).map((c) => ({ key: c.key, alt: rng.pick(ALT_COLORS) }));
      return { calls, stage: 0 };
    },
    solve(a, s) {
      return { answers: s.calls.map((c) => PA_TABLE[c.key][ALT_COLORS.indexOf(c.alt)]) };
    },
    manual: {
      ask: 'The cabin crew is calling the cockpit. Ask the pilot to <b>answer the call</b> and tell you <b>what the crew reports</b>, and the colour of the <b>CABIN ALT</b> lamp on that panel.',
      intro: 'Find the key word of the report, then the lamp colour. The pilot presses that <b>one</b> button. There are <b>two calls</b>; the lamp may change between them.',
      table: {
        head: ['Crew reports…', 'CABIN ALT green', 'CABIN ALT amber', 'CABIN ALT red'],
        rows: CALLS.map((c) => [c.key, PA[PA_TABLE[c.key][0]], PA[PA_TABLE[c.key][1]], PA[PA_TABLE[c.key][2]]]),
      },
      notes: ['Key words: SMOKE, cracked WINDOW, passenger at the DOOR, INJURED passengers, SPARKS from the wing, passengers FAINTING.'],
    },
  };

  // =====================================================================
  // MODULE: LANDING GEAR
  // =====================================================================
  const GEAR_STATES = ['GREEN', 'RED', 'DARK'];
  const gear = {
    id: 'gear', title: 'LANDING GEAR', short: 'GEAR',
    gen(rng) {
      let lights;
      do { lights = [0, 1, 2].map(() => rng.pick(GEAR_STATES)); } while (lights.every((l) => l === 'GREEN'));
      return { lights, turns: 0 };
    },
    solve(a, s) {
      const red = s.lights.filter((l) => l === 'RED').length;
      const dark = s.lights.filter((l) => l === 'DARK').length;
      const n = red * 2 + dark * 4 + (a.ice ? 2 : 0);
      return { turns: n, dir: ac.flightOdd(a) ? 'CCW' : 'CW', net: ac.flightOdd(a) ? -n : n };
    },
    manual: {
      ask: 'Ask the pilot: the colour of the three gear lights, <b>NOSE, LEFT, RIGHT</b> (green, red or dark). You may also need the <b>ICE light</b> and the <b>flight number</b> from the placard.',
      intro: 'The gear must be cranked down by hand. Count the turns, pick the direction, then the pilot pulls <b>RELEASE</b>.',
      list: [
        'Each <b>RED</b> light: <b>2 turns</b>.',
        'Each <b>DARK</b> light: <b>4 turns</b>.',
        'Each GREEN light: no turns.',
        'If the <b>ICE</b> light is lit: add <b>2 turns</b>.',
        'Direction: if the <b>last digit of the flight number is even</b>, crank <b>clockwise (CW)</b>. If it is odd, crank <b>counter-clockwise (CCW)</b>.',
      ],
      warn: 'Pulling RELEASE with the wrong number of turns or the wrong direction is a mistake. The RESET button is free.',
      plain: true,
    },
  };

  // =====================================================================
  // MODULE: TRANSPONDER
  // =====================================================================
  const xpdr = {
    id: 'xpdr', title: 'TRANSPONDER', short: 'XPDR',
    gen(rng) {
      return { digits: [0, 0, 0, 0].map(() => rng.int(0, 7)) };
    },
    solve(a, s) {
      const d = [7, 5 + ac.lightsLit(a), ac.flightLast(a) % 8, ac.regVowelCount(a)];
      return { code: d.join('') };
    },
    ensureUnsolved(a, s) {
      if (s.digits.join('') === xpdr.solve(a, s).code) s.digits[3] = (s.digits[3] + 4) % 8;
    },
    manual: {
      ask: 'Everything you need is on the cockpit <b>placard</b>: flight number, registration, and the <b>APU</b> and <b>ICE</b> lights.',
      intro: 'Radar has lost the aircraft. Build the four-digit <b>squawk code</b>, the pilot dials it in and presses <b>IDENT</b>.',
      list: [
        '<b>1st digit</b>: always <b>7</b>.',
        '<b>2nd digit</b>: <b>5</b>, plus 1 for each of the APU and ICE lights that is lit (so 5, 6 or 7).',
        '<b>3rd digit</b>: the <b>last digit of the flight number</b>. If it is 8 use 0, if it is 9 use 1.',
        '<b>4th digit</b>: how many of the <b>last three letters</b> of the registration are vowels (0 to 3).',
      ],
      warn: 'Pressing IDENT with a wrong code is a mistake.',
      plain: true,
    },
  };

  const MODULES = { breakers, fire, radio, hyd, intercom, gear, xpdr };
  // =====================================================================
  // MODULE: OVERRIDE KEYS (unlabelled coloured keys; the rule depends on the panel's symbol)
  // =====================================================================
  const SYMBOLS = [['🦅', 'EAGLE'], ['🐺', 'WOLF'], ['🐍', 'SNAKE'], ['🦉', 'OWL'], ['🐻', 'BEAR'], ['🦊', 'FOX'], ['🦈', 'SHARK'], ['🌙', 'MOON'], ['🐟', 'FISH'], ['🐢', 'TURTLE'], ['🦋', 'BUTTERFLY'], ['🐝', 'BEE'], ['🦀', 'CRAB'], ['🐙', 'OCTOPUS'], ['🐘', 'ELEPHANT'], ['🦒', 'GIRAFFE'], ['🐧', 'PENGUIN'], ['🦇', 'BAT'], ['🕷️', 'SPIDER'], ['⭐', 'STAR'], ['☀️', 'SUN'], ['⚡', 'BOLT'], ['🔥', 'FLAME'], ['❄️', 'SNOWFLAKE'], ['🌵', 'CACTUS'], ['🍄', 'MUSHROOM'], ['🍀', 'CLOVER'], ['🌲', 'TREE'], ['⚓', 'ANCHOR'], ['🔑', 'KEY'], ['🔔', 'BELL'], ['👑', 'CROWN'], ['💎', 'DIAMOND'], ['🎲', 'DICE'], ['🚀', 'ROCKET'], ['⚙️', 'GEAR'], ['🧲', 'MAGNET'], ['🕯️', 'CANDLE'], ['💀', 'SKULL'], ['👁️', 'EYE'], ['🎩', 'HAT'], ['☂️', 'UMBRELLA'], ['🎈', 'BALLOON'], ['🍎', 'APPLE'], ['🍋', 'LEMON'], ['🍒', 'CHERRY'], ['🥕', 'CARROT'], ['🌶️', 'PEPPER'], ['🐸', 'FROG'], ['🐷', 'PIG'], ['🐮', 'COW'], ['🐔', 'CHICKEN'], ['🐴', 'HORSE'], ['🦁', 'LION'], ['🐯', 'TIGER'], ['🐵', 'MONKEY'], ['🐭', 'MOUSE'], ['🐰', 'RABBIT'], ['🐱', 'CAT'], ['🐶', 'DOG'], ['🦆', 'DUCK'], ['🐌', 'SNAIL'], ['🐞', 'LADYBUG'], ['🦂', 'SCORPION'], ['🐊', 'CROCODILE'], ['🐳', 'WHALE'], ['🦜', 'PARROT'], ['🦩', 'FLAMINGO'], ['🌈', 'RAINBOW'], ['🌊', 'WAVE'], ['🌋', 'VOLCANO'], ['🌻', 'SUNFLOWER'], ['🌹', 'ROSE'], ['🍌', 'BANANA'], ['🍇', 'GRAPES'], ['🍉', 'WATERMELON'], ['🍕', 'PIZZA'], ['🍩', 'DONUT'], ['🎸', 'GUITAR'], ['🥁', 'DRUM'], ['🎺', 'TRUMPET'], ['⚽', 'BALL'], ['🏆', 'TROPHY'], ['🎯', 'TARGET'], ['🧭', 'COMPASS'], ['⏰', 'CLOCK'], ['💡', 'BULB'], ['🔨', 'HAMMER'], ['✂️', 'SCISSORS'], ['🔒', 'LOCK'], ['📎', 'PAPERCLIP'], ['🧊', 'ICE CUBE'], ['🪐', 'PLANET'], ['☁️', 'CLOUD'], ['🌪️', 'TORNADO'], ['🛟', 'LIFEBUOY'], ['⛵', 'SAILBOAT'], ['🚲', 'BICYCLE'], ['🎁', 'GIFT'], ['👻', 'GHOST'], ['🤖', 'ROBOT'], ['👽', 'ALIEN'], ['🧦', 'SOCKS'], ['👓', 'GLASSES']];
  const KEY_SYMBOLS = 8;                         // the first eight symbols only ever appear on OVERRIDE KEYS
  // Every flight deals new pictures to all panels. Pilot and tower share a four digit flight code,
  // so the handbook can work out which picture marks each failing panel on this flight.
  function assignSymbols(flight) {
    const r = makeRng((flight.seed ^ 0x51b0c5) >>> 0);
    const pool = r.shuffle(SYMBOLS.slice(KEY_SYMBOLS));
    const out = { modules: {}, pool };
    flight.modules.forEach((m) => { out.modules[m.id] = m.id === 'keys' ? SYMBOLS.find((x) => x[1] === m.state.symbol) : pool.pop(); });
    out.pa = pool.pop(); out.data = pool.pop();
    return out;
  }
  const MODE_KEYS = ['short', 'mayday', 'blackbox'];
  function newCode(mode) { return (MODE_KEYS.indexOf(mode) + 1) * 1000 + Math.floor(Math.random() * 1000); }
  function codeMode(code) { return MODE_KEYS[Math.floor(code / 1000) - 1] || null; }
  const KEY_COLORS = ['WHITE', 'RED', 'BLUE', 'GREEN', 'AMBER'];
  const KC = 4, KR = 3;                          // 4 columns x 3 rows
  const count = (g, c) => g.filter((x) => x === c).length;
  const KEY_RULES = {
    EAGLE: { text: 'Press the key directly to the <b>right</b> of the <b>WHITE</b> key.',
      ok: (g) => count(g, 'WHITE') === 1 && g.indexOf('WHITE') % KC < KC - 1, pick: (g) => g.indexOf('WHITE') + 1 },
    WOLF: { text: 'Press the key directly <b>below</b> the <b>RED</b> key.',
      ok: (g) => count(g, 'RED') === 1 && g.indexOf('RED') < KC * (KR - 1), pick: (g) => g.indexOf('RED') + KC },
    SNAKE: { text: 'Count the <b>BLUE</b> keys. Press the key with that number, counting from the top left, left to right, row by row.',
      ok: (g) => count(g, 'BLUE') >= 2, pick: (g) => count(g, 'BLUE') - 1 },
    OWL: { text: 'Press the <b>GREEN</b> key that is furthest to the <b>right</b>. If two are equally far right, the upper one.',
      ok: (g) => count(g, 'GREEN') >= 2, pick: (g) => { let b = -1; g.forEach((c, i) => { if (c === 'GREEN' && (b < 0 || i % KC > b % KC)) b = i; }); return b; } },
    BEAR: { text: 'Find the row with the most <b>AMBER</b> keys (the upper row on a tie). Press the first key in that row, from the left, that is <b>not</b> amber.',
      ok: (g) => { const r = bearRow(g); return count(g, 'AMBER') >= 2 && g.slice(r * KC, r * KC + KC).some((c) => c !== 'AMBER'); },
      pick: (g) => { const r = bearRow(g); for (let i = r * KC; i < r * KC + KC; i++) if (g[i] !== 'AMBER') return i; return 0; } },
    FOX: { text: 'Press the key directly to the <b>left</b> of the <b>GREEN</b> key.',
      ok: (g) => count(g, 'GREEN') === 1 && g.indexOf('GREEN') % KC > 0, pick: (g) => g.indexOf('GREEN') - 1 },
    SHARK: { text: 'Exactly one colour appears only <b>once</b>. Press the key directly <b>above</b> it. If it is in the top row, press that key itself.',
      ok: (g) => KEY_COLORS.filter((c) => count(g, c) === 1).length === 1,
      pick: (g) => { const i = g.indexOf(KEY_COLORS.find((c) => count(g, c) === 1)); return i >= KC ? i - KC : i; } },
    MOON: { text: 'If the <b>bottom right</b> key is WHITE or BLUE, press it. Otherwise press the <b>top left</b> key.',
      ok: () => true, pick: (g) => (g[g.length - 1] === 'WHITE' || g[g.length - 1] === 'BLUE' ? g.length - 1 : 0) },
  };
  function bearRow(g) { let best = 0, bn = -1; for (let r = 0; r < KR; r++) { const n = count(g.slice(r * KC, r * KC + KC), 'AMBER'); if (n > bn) { bn = n; best = r; } } return best; }
  const keys = {
    id: 'keys', title: 'OVERRIDE KEYS', short: 'OVERRIDE', COLORS: KEY_COLORS, COLS: KC, ROWS: KR, RULES: KEY_RULES,
    gen(rng) {
      const symbol = rng.pick(Object.keys(KEY_RULES)), grids = [];
      for (let s = 0; s < 2; s++) { let g; do { g = []; for (let i = 0; i < KC * KR; i++) g.push(rng.pick(KEY_COLORS)); } while (!KEY_RULES[symbol].ok(g)); grids.push(g); }
      return { symbol, grids, stage: 0 };
    },
    solve(a, s) { return { answers: s.grids.map((g) => KEY_RULES[s.symbol].pick(g)) }; },
    manual: {
      ask: 'Ask the pilot which <b>symbol</b> is in the top left corner of that panel, then ask for the <b>colours of the twelve keys</b>: three rows of four, read left to right, top row first.',
      intro: 'The keys have no labels, only colours, and the colours are different on every flight. The symbol tells you which rule applies. The panel must be cleared <b>twice</b>: after the first correct key the colours change, the symbol stays.',
      table: { head: ['Symbol', 'Which key to press'], rows: Object.keys(KEY_RULES).map((k) => ['<span class="sym">' + SYMBOLS.find((s) => s[1] === k)[0] + '</span> <b>' + k + '</b>', KEY_RULES[k].text]) },
      warn: 'Every other panel in the cockpit carries a symbol too, so the pilot can tell you where things are ("the cactus panel, next to the trumpet"). Those symbols are different on every flight and mean nothing by themselves.',
    },
  };

  MODULES.keys = keys;
  const ORDER = ['breakers', 'fire', 'radio', 'hyd', 'intercom', 'gear', 'xpdr', 'keys'];

  const MODES = {
    short: { name: 'SHORT HOP', modules: 3, time: 240, desc: '3 failures · 4:00 · all within reach of the front seats' },
    mayday: { name: 'MAYDAY', modules: 5, time: 420, desc: '5 failures · 7:00 · the far side and the ceiling too' },
    blackbox: { name: 'BLACK BOX', modules: 7, time: 600, desc: '7 failures · 10:00 · anywhere, even behind you' },
  };

  function genFlight(seed, modeKey) {
    const rng = makeRng(seed);
    const mode = MODES[modeKey] || MODES.short;
    const aircraft = genAircraft(rng);
    let ids = rng.shuffle(ORDER);
    // a short hop always includes the voice module: it is the showpiece
    // every flight has the voice module and the symbol module: they are the showpieces
    const forced = ['intercom', 'keys'];
    if (mode.modules < ORDER.length) ids = forced.concat(ids.filter((x) => !forced.includes(x)));
    ids = ids.slice(0, mode.modules);
    ids.sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y));
    const modules = ids.map((id) => {
      const m = MODULES[id];
      const state = m.gen(rng);
      if (m.ensureUnsolved) m.ensureUnsolved(aircraft, state, rng);
      return { id, state };
    });
    return { seed, mode: modeKey, aircraft, modules, time: mode.time };
  }

  // =====================================================================
  // THE CABIN: restless passengers and the captain's announcements
  // =====================================================================
  const CABIN = {
    COMPLAINTS: [
      { key: 'SHAKING', hear: 'They shout about the aircraft <b>shaking</b>.', clip: 'pax_shake', text: 'Hey! Why is the plane shaking like this?! Somebody tell us why everything is shaking!' },
      { key: 'FALLING', hear: 'They scream that the aircraft is <b>falling</b> or going down.', clip: 'pax_fall', text: 'We\'re falling! Oh my god, we are falling! We\'re going down!' },
      { key: 'STANDING UP', hear: 'Someone refuses to stay seated and is <b>getting up</b>.', clip: 'pax_seat', text: 'No! I am not staying in this seat! I am getting up, everybody is getting up!' },
      { key: 'ANGRY', hear: 'Someone is outraged and <b>demands the captain</b>.', clip: 'pax_angry', text: 'This is outrageous! I demand to speak to the captain. Come out here this instant!' },
    ],
    PA: [
      { key: 'WEATHER', clip: 'pa_weather', text: 'Ladies and gentlemen, this is your captain. We\'re passing through some rough weather. It\'s only turbulence. Nothing to worry about.' },
      { key: 'DESCENT', clip: 'pa_descent', text: 'This is your captain speaking. We have started a controlled descent into Munich. Controlled. Everything you feel is completely normal.' },
      { key: 'SEATS', clip: 'pa_seats', text: 'This is your captain. Everyone back in your seats. Seatbelts fastened. Now. Thank you.' },
      { key: 'DRINKS', clip: 'pa_drinks', text: 'Ladies and gentlemen, on behalf of the airline: after we land, the drinks are on us. All of them. Please, stay calm.' },
    ],
    // complaint n is answered by announcement n, but never the same announcement twice in a row
    answer(complaintKey, lastPA) {
      let i = CABIN.COMPLAINTS.findIndex((c) => c.key === complaintKey);
      if (CABIN.PA[i].key === lastPA) i = (i + 1) % CABIN.PA.length;
      return CABIN.PA[i].key;
    },
    PANIC_PENALTY: 20,
  };

  root.KK = { makeRng, genFlight, genAircraft, MODULES, ORDER, MODES, CABIN, SYMBOLS, KEY_SYMBOLS, assignSymbols, newCode, codeMode, ac, ORD, MAX_STRIKES: 3, STRIKE_PENALTY: 15 };
  if (typeof module !== 'undefined') module.exports = root.KK;
})(typeof window !== 'undefined' ? window : globalThis);
