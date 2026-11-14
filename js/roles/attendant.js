/* ARE WE FALLING? — the FLIGHT ATTENDANT seat (Efe).
   The flight attendant works in the cabin and undoes what the intruder breaks. Every finished task gives the pilot time.

   This file DESCRIBES the task pool and brings one small effect of its own (the kiss, at the end of the file).
   The game side (Orhun: cabin.html, js/net.js, js/game.js) deals the tasks, runs them and applies them to the flight.
   Try it:  cabin.html?role=attendant&seed=1006   (this seed deals KISS THE PILOT; any other seed gives another deal)

   Design rules:
   - One task for every sabotage in js/roles/saboteur.js, and it gives back exactly what that sabotage took
     (the intruder's tasks cost 2 or 3 seconds, so these give 2 or 3). Fixing takes a little longer than breaking.
   - One task that answers to nothing: KISS THE PILOT. It only adds time.

   Fields the cabin page uses today:
     id, title, place, brief, seconds, effect   as in ROADMAP.md (effect = seconds added to the time to impact, positive here)
     input    'hold' (hold E for `seconds`), 'mash' (tap Q and E in turns), 'code' (type the keys in `code`)

   Fields that are a PROPOSAL for the game side (nothing reads them yet; requests for Orhun):
     undoes   the id of the sabotage this task answers. Wanted: the task is not dealt at random but appears on the
              attendant's list when the intruder finishes that sabotage. With no intruder on board the same trouble
              should turn up by itself now and then (as a plain malfunction), so the attendant still has work.
     clears   the effects of that sabotage that end when the task is done: 'smoke', 'turbulence', 'blackout',
              'masks', 'panic', 'calls', 'block', 'door' (the same names as `fx` in saboteur.js).
     spot     where exactly inside the place, for a marker.
     always   true: on the list on every flight (the kiss).
     once     true: can be done only once a flight.
     anim     a screen effect this file plays itself; today only 'kiss'.
   Voice lines exist in audio/extra/ (att_calm, att_sit, att_stop, att_masks, att_cockpit, att_got, each as _a and _b).
   The cabin page plays `sound` from audio/ only, so they are not wired yet: move the chosen takes to audio/ and
   add `sound: 'att_calm'` and so on. */
(function (root) {
  'use strict';
  const KK = root.KK = root.KK || {};
  KK.ROLES = KK.ROLES || {};

  KK.ROLES.attendant = {
    seat: 'FLIGHT ATTENDANT',
    perFlight: 4,                       // the intruder gets 4 too
    tasks: [
      // ---------- the answers to the intruder's sabotage, in the order of saboteur.js ----------
      {
        id: 'vent', undoes: 'vent',
        title: 'CLEAR THE VENT',
        place: 'lavatory', spot: 'rear lavatory, ventilation grille above the mirror',
        brief: 'Pull the paper towels out of the ventilation grille and reset the smoke detector.',
        input: 'hold', seconds: 7,
        effect: 3,
        clears: ['smoke', 'panic'],
      },
      {
        id: 'plunge', undoes: 'flush',
        title: 'PLUNGE THE TOILET',
        place: 'lavatory', spot: 'rear lavatory, toilet',
        brief: 'Grab the plunger and pump until the vacuum flush runs free again. The banging in the tail stops.',
        input: 'mash', seconds: 5,
        effect: 2,
        clears: ['turbulence'],
      },
      {
        id: 'emp', undoes: 'emp',
        title: 'FIND THE EMP',
        place: 'seat', spot: 'overhead bin above any row',
        brief: 'Sit down by the dark rows, open the overhead bin, dig the charge out from between the bags and switch it off. The lights come back.',
        input: 'hold', seconds: 6,
        effect: 3,
        clears: ['blackout', 'panic'],
        once: true,
      },
      {
        id: 'masks', undoes: 'masks',
        title: 'STOW THE MASKS',
        place: 'galley', spot: 'front galley, crew panel',
        brief: 'Reset the mask release on the crew panel and tell the cabin over the PA that the air is fine.',
        input: 'code', code: 'EQEQ', seconds: 4,
        effect: 2,
        clears: ['masks', 'panic'],
        once: true,
      },
      {
        id: 'device', undoes: 'bomb',
        title: 'FIND THE DEVICE',
        place: 'seat', spot: 'under an empty seat',
        brief: 'Follow the beeping, sit down, reach under the seat and peel the device off the frame.',
        input: 'hold', seconds: 6,
        effect: 3,
        clears: ['panic'],
      },
      {
        id: 'rumour', undoes: 'rumour',
        title: 'KILL THE RUMOUR',
        place: 'seat', spot: 'next to another passenger',
        brief: 'Sit down next to the passengers who are whispering and tell them both engines are fine.',
        input: 'hold', seconds: 5,
        effect: 2,
        clears: ['panic'],
      },
      {
        id: 'bells', undoes: 'calls',
        title: 'RESET THE BELLS',
        place: 'aisle', spot: 'walk the aisle, call buttons above the seats',
        brief: 'Walk down the aisle and switch off every call light, row by row.',
        input: 'mash', seconds: 6,
        effect: 2,
        clears: ['calls'],
      },
      {
        id: 'trolley', undoes: 'trolley',
        title: 'SECURE THE TROLLEY',
        place: 'galley', spot: 'rear galley, drinks trolley',
        brief: 'Push the drinks trolley back into the galley and lock its brake. The aisle is free again.',
        input: 'hold', seconds: 4,
        effect: 2,
        clears: ['block', 'turbulence'],
      },
      {
        id: 'exit', undoes: 'exit',
        title: 'SECURE THE EXIT',
        place: 'aisle', spot: 'overwing emergency exit, row 12',
        brief: 'Push the emergency exit handle back in and snap the cover on. The pressure alarm goes quiet.',
        input: 'mash', seconds: 7,
        effect: 3,
        clears: ['turbulence', 'panic'],
        once: true,
      },
      {
        id: 'oven', undoes: 'oven',
        title: 'PUT OUT THE OVEN',
        place: 'galley', spot: 'front galley, oven',
        brief: 'Switch the galley oven off and empty the extinguisher into it.',
        input: 'code', code: 'QQE', seconds: 4,
        effect: 2,
        clears: ['smoke', 'panic'],
      },
      {
        id: 'lock', undoes: 'cockpit',
        title: 'LOCK THE DOOR',
        place: 'door', spot: 'cockpit door keypad, front galley',
        brief: 'Type the crew code into the keypad of the cockpit door so that it locks again.',
        input: 'code', code: 'EEQQE', seconds: 5,
        effect: 3,
        clears: ['door'],
        once: true,
      },
      // ---------- on its own ----------
      {
        id: 'kiss',
        title: 'KISS THE PILOT',
        place: 'door', spot: 'through the cockpit door, the left seat',
        brief: 'Slip into the cockpit and kiss the pilot on the cheek. Good for the nerves: it buys time.',
        input: 'hold', seconds: 2,
        effect: 5,
        always: true, once: true,
        anim: 'kiss',
      },
    ],
  };

  // ---------- the kiss: the screen goes dark and a few lipstick marks appear ----------
  // Starts the moment the interaction key goes down on KISS THE PILOT, stays while the task finishes, then clears.
  if (!root.document) return;
  const doc = root.document;
  let layer = null, running = false;
  function build() {
    if (layer) return layer;
    const st = doc.createElement('style');
    st.textContent = '#attKiss{position:fixed;inset:0;z-index:9999;background:#000;opacity:0;pointer-events:none;transition:opacity .25s;overflow:hidden}' +
      '#attKiss.on{opacity:1}#attKiss span{position:absolute;line-height:1;transform:translate(-50%,-50%) scale(0) rotate(var(--r));opacity:0;transition:transform .28s cubic-bezier(.2,1.6,.4,1),opacity .15s}' +
      '#attKiss span.in{transform:translate(-50%,-50%) scale(1) rotate(var(--r));opacity:1}';
    doc.head.appendChild(st);
    layer = doc.createElement('div'); layer.id = 'attKiss'; doc.body.appendChild(layer);
    return layer;
  }
  // kiss({ hold }): hold is a function that says whether to stay dark (the task is still being worked on). Returns nothing.
  function kiss(opts) {
    if (running) return; running = true;
    const el = build(); el.innerHTML = '';
    const spots = [[50, 46, -8, 24], [27, 30, 14, 15], [72, 28, -20, 17], [33, 70, -16, 13], [69, 68, 10, 19]];   // x %, y %, turn, size vmin
    spots.forEach((s, i) => {
      const m = doc.createElement('span'); m.textContent = '💋';
      m.style.left = s[0] + '%'; m.style.top = s[1] + '%'; m.style.fontSize = s[3] + 'vmin'; m.style.setProperty('--r', s[2] + 'deg');
      el.appendChild(m); setTimeout(() => m.classList.add('in'), 220 + i * 170);
    });
    el.classList.add('on');
    const t0 = Date.now(), hold = opts && opts.hold;
    const iv = setInterval(() => {
      const t = Date.now() - t0, state = hold ? hold() : 'done';   // 'working', 'done' or 'left'
      if (state === 'working' && t < 15000) return;
      if (state === 'done' && t < 1900) return;                    // let every mark land before the lights come back
      clearInterval(iv); el.classList.remove('on'); setTimeout(() => { el.innerHTML = ''; running = false; }, 300);
    }, 60);
  }
  KK.ROLES.attendant.kiss = kiss;

  // The cabin page has no hook for a task's own effect yet, so this watches for the key itself: it reads the page's
  // task list (window.__cabin, set by cabin.html) and does nothing anywhere else.
  let eDown = false;
  function kissTask() {
    const c = root.__cabin; if (!c || c.role !== 'attendant' || !c.cabin || !Array.isArray(c.tasks) || c.phase !== 'flight') return null;
    let at; try { at = c.cabin.at().place; } catch (e) { return null; }
    const cur = c.tasks.find((t) => !t.done && t.def && t.def.place === at);   // the task the page is working on here
    return cur && cur.def.anim === 'kiss' ? cur : null;
  }
  root.addEventListener('keyup', (e) => { if (e.key && e.key.toLowerCase() === 'e') eDown = false; });
  root.addEventListener('keydown', (e) => {
    if (!e.key || e.key.toLowerCase() !== 'e' || e.repeat) return;
    eDown = true;
    const t = kissTask(); if (!t) return;
    kiss({ hold: () => (t.done ? 'done' : eDown ? 'working' : 'left') });
  });
})(typeof window !== 'undefined' ? window : this);
