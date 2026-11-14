/* ARE WE FALLING? — the INTRUDER seat (Batu). Players see it as INTRUDER; in the code it is the `saboteur` seat.
   One of the passengers in an A320 cabin, identity hidden until the flight attendant catches them.
   Played in first person: WASD to walk, E to interact (hold), Q to "act natural" (stop a task and look innocent).
   A small bomb is strapped to the intruder's chest: visible when looking down, and the icon of the seat.

   This file only DESCRIBES the sabotage pool. The game side (Orhun) deals the tasks from the flight code,
   moves the player through the cabin, runs a task's timer, applies the effects and syncs them over the lobby.
   Registered as KK.ROLES.saboteur (what cabin.html and the game look up) and KK.ROLES.intruder (the same object).
   Try it:  cabin.html?role=saboteur          (add &seed=1234 to get the same deal every time)

   Design rule: time effects are SMALL (2 to 3 seconds), so the pilot can still win. A sabotage hurts
   mostly through what it does to the flight: turbulence, blackout, oxygen masks, panic, smoke.

   Fields (first proposal, on top of Orhun's interface in ROADMAP.md):
     id, title, place, brief, seconds, effect   as in ROADMAP.md (effect = seconds added to the time to impact)
     spot     where exactly inside the place (the cabin can put a marker there)
     input    how the player does it: 'hold' (hold E for `seconds`), 'mash' (alternate Q and E), 'code' (type `code` keys)
     fx       what happens to the flight. Each entry is { type, dur } with dur in seconds:
                turbulence  the cockpit and the cabin shake (the game already has this for wrong switches)
                blackout    cabin lights go out, cockpit panels flicker, only emergency floor lights stay
                masks       oxygen masks drop in the cabin, passengers panic
                smoke       smoke in the cabin, the smoke detector goes off, the pilot gets a cabin call
                panic       passengers get restless (the cabin panic bar the game already has)
                calls       every call button chimes, the flight attendant is pulled away
                door        the cockpit door unlocks, the intruder can walk into the cockpit
                block       something blocks the aisle, the flight attendant has to go around
              amount (0 to 1) where it matters, e.g. how much panic.
     noise    0 to 1, how suspicious the task looks. If the flight attendant sees the intruder while a task
              with high noise is running, the cover is blown faster.
     sound    the sound file in audio/ that plays during the task (made with ElevenLabs).
     once     true when the task can happen only once a flight.

   ASSETS (all ready, made with ElevenLabs and Meshy):
     audio/int_*.mp3      one sound per task (see `sound`), plus the ones in `sounds` below.
                          int_steps, int_tick and int_alarm are seamless loops.
     js/roles/intruder-models.js
                          three Meshy models embedded as base64, added to window.KK_GLB, so
                          KKModels.load('intruder_vest', cb) works like 'bobble'. Load it AFTER js/models.js
                          (models.js replaces window.KK_GLB). Sources in meshy/vest.glb, emp.glb, device.glb.
*/
(function (root) {
  'use strict';
  const KK = root.KK = root.KK || {};
  KK.ROLES = KK.ROLES || {};

  KK.ROLES.saboteur = KK.ROLES.intruder = {
    seat: 'INTRUDER',
    perFlight: 4,                       // fallback when no mode is known (cabin.html uses this)
    // Longer modes deal more tasks, and every task takes more time off, in the same ratio as the flight time
    // (KK.MODES: short 4:00, mayday 7:00, black box 10:00 -> x1, x1.75, x2.5). Task counts follow the failures: 3 / 5 / 7.
    perMode: { short: 3, mayday: 5, blackbox: 7 },
    effectScale: { short: 1, mayday: 1.75, blackbox: 2.5 },
    controls: { walk: 'WASD', interact: 'E', natural: 'Q', look: 'mouse' },
    models: {
      vest: 'intruder_vest',            // the bomb strapped to the chest, seen when looking down
      emp: 'intruder_emp',              // left in the overhead bin by the 'emp' task
      device: 'intruder_device',        // taped under a seat by the 'bomb' task
    },
    sounds: {
      steps: 'int_steps',               // loop while walking
      tick: 'int_tick',                 // loop, the chest bomb, quiet under everything
      blackout: 'int_blackout',         // fx blackout starts
      alarm: 'int_alarm',               // loop while fx smoke runs
      rumour: 'int_rumour',             // whispered line, played by the 'rumour' task
    },
    tasks: [
      {
        id: 'vent',
        title: 'BLOCK THE VENT',
        place: 'lavatory', spot: 'rear lavatory, ventilation grille above the mirror',
        brief: 'Lock yourself in the lavatory and stuff paper towels into the ventilation grille. Smoke builds up and the detector goes off.',
        input: 'hold', seconds: 6,
        effect: -3,
        fx: [{ type: 'smoke', dur: 20 }, { type: 'panic', amount: 0.2 }],
        noise: 0.2, sound: 'int_vent',
      },
      {
        id: 'flush',
        title: 'JAM THE FLUSH',
        place: 'lavatory', spot: 'rear lavatory, toilet',
        brief: 'Jam the vacuum flush. A loud bang runs through the waste line and shakes the tail.',
        input: 'mash', seconds: 4,
        effect: -2,
        fx: [{ type: 'turbulence', dur: 6 }],
        noise: 0.3, sound: 'int_flush',
      },
      {
        id: 'emp',
        title: 'PLANT THE EMP',
        place: 'seat', spot: 'overhead bin above any row',
        brief: 'Open an overhead bin, hide the EMP charge between the bags and arm it. Ten seconds later the lights die.',
        input: 'hold', seconds: 5,
        effect: -3,
        fx: [{ type: 'blackout', dur: 12 }, { type: 'panic', amount: 0.25 }],
        noise: 0.5, sound: 'int_emp', once: true,
      },
      {
        id: 'masks',
        title: 'DROP THE MASKS',
        place: 'galley', spot: 'front galley, crew panel',
        brief: 'Sneak into the galley and press the manual mask release on the crew panel. Every oxygen mask in the cabin drops.',
        input: 'code', code: 'QEQE', seconds: 3,
        effect: -2,
        fx: [{ type: 'masks', dur: 25 }, { type: 'panic', amount: 0.4 }],
        noise: 0.8, sound: 'int_masks', once: true,
      },
      {
        id: 'bomb',
        title: 'PLANT A DEVICE',
        place: 'seat', spot: 'under an empty seat',
        brief: 'Sit in an empty seat, reach under it and tape a small device to the frame. Its beeping makes the neighbours nervous.',
        input: 'hold', seconds: 5,
        effect: -3,
        fx: [{ type: 'panic', amount: 0.3 }],
        noise: 0.4, sound: 'int_bomb',
      },
      {
        id: 'rumour',
        title: 'START A RUMOUR',
        place: 'seat', spot: 'next to another passenger',
        brief: 'Lean over to your neighbour and whisper that one engine is on fire. The rumour runs down the rows.',
        input: 'hold', seconds: 4,
        effect: -2,
        fx: [{ type: 'panic', amount: 0.5 }],
        noise: 0.1, sound: 'int_rumour',
      },
      {
        id: 'calls',
        title: 'RING EVERY BELL',
        place: 'aisle', spot: 'walk the aisle, call buttons above the seats',
        brief: 'Walk down the aisle and press the call button above every row you pass. The flight attendant does not know where to go first.',
        input: 'mash', seconds: 5,
        effect: -2,
        fx: [{ type: 'calls', dur: 15 }],
        noise: 0.6, sound: 'int_calls',
      },
      {
        id: 'trolley',
        title: 'LOOSE TROLLEY',
        place: 'galley', spot: 'rear galley, drinks trolley',
        brief: 'Kick the brake off the drinks trolley. It rolls down the aisle, spills everything and blocks the way.',
        input: 'hold', seconds: 3,
        effect: -2,
        fx: [{ type: 'block', dur: 15 }, { type: 'turbulence', dur: 3 }],
        noise: 0.5, sound: 'int_trolley',
      },
      {
        id: 'exit',
        title: 'TAMPER THE EXIT',
        place: 'aisle', spot: 'overwing emergency exit, row 12',
        brief: 'Pry the cover off the emergency exit handle and pull it half way. A pressure alarm screams through the cabin.',
        input: 'mash', seconds: 6,
        effect: -3,
        fx: [{ type: 'turbulence', dur: 5 }, { type: 'panic', amount: 0.6 }],
        noise: 0.9, sound: 'int_exit', once: true,
      },
      {
        id: 'oven',
        title: 'OVEN FIRE',
        place: 'galley', spot: 'front galley, oven',
        brief: 'Turn the galley oven to maximum with the meal boxes still inside. Smoke comes out of the galley.',
        input: 'code', code: 'EEQ', seconds: 3,
        effect: -2,
        fx: [{ type: 'smoke', dur: 15 }, { type: 'panic', amount: 0.2 }],
        noise: 0.6, sound: 'int_oven',
      },
      {
        id: 'cockpit',
        title: 'CRACK THE DOOR',
        place: 'door', spot: 'cockpit door keypad, front galley',
        brief: 'Type a code into the keypad of the cockpit door. When it clicks open you can walk into the cockpit and flip one switch the pilot did not want flipped.',
        input: 'code', code: 'QQEEQ', seconds: 4,
        effect: -3,
        fx: [{ type: 'door', dur: 12 }],
        noise: 1, sound: 'int_door', once: true,
      },
    ],
  };
})(window);
