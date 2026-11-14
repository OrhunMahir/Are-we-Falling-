/* ARE WE FALLING? — the FLIGHT ATTENDANT seat (Efe).
   The flight attendant works in the cabin and undoes what the intruder breaks. Every finished task gives the pilot time.

   This file DESCRIBES the task pool. js/roles/attendant-play.js plays it in first person (the lobby's seat).
   cabin.html runs the tasks, js/net.js carries them through the lobby, js/game.js applies them to the flight.
   Try it:  cabin.html?role=attendant            malfunctions turn up by themselves, the picker in the test controls
                                                 plays a sabotage; add &intruder=1 for a cabin without malfunctions

   Design rules:
   - One task for every sabotage in js/roles/saboteur.js, and it gives back exactly what that sabotage took
     (the intruder's tasks cost 2 or 3 seconds, so these give 2 or 3). Fixing takes a little longer than breaking.
   - One task that answers to nothing: COFFEE FOR THE CAPTAIN. Poured in the galley, handed over in the cockpit; it sobers the
     captain up and adds a little time. (KISS THE PILOT was here until the jam build; Orhun took it out after the jam.)

   Fields (all of them are read by cabin.html unless it says otherwise):
     id, title, place, brief, seconds, effect   as in ROADMAP.md (effect = seconds added to the time to impact, positive here)
     input    'hold' (hold E for `seconds`), 'mash' (tap Q and E in turns), 'code' (type the keys in `code`)
     undoes   the id of the sabotage this task answers. A pool with `undoes` is not dealt at random: the task comes
              onto the list when the intruder finishes that sabotage. With no intruder on board the same trouble
              turns up by itself now and then, as a malfunction that costs no time.
     always   true: on the list from the start of every flight (the coffee).
     fetch    a place to go first (the coffee: the galley), then `place` (the cockpit); brief2 is the brief for the second leg.
     near     the name of a thing the intruder planted (intruder_device, intruder_emp): the seat must be in that row or the next.
     once     true: can be done only once a flight; without it a finished task comes back when its trouble does.
     clears   the effects of that sabotage that end when the task is done: 'smoke', 'turbulence', 'blackout',
              'masks', 'panic', 'calls', 'block', 'door' (the same names as `fx` in saboteur.js). They end on the
              intruder's screen, and 'panic' also calms the pilot's passengers a little more.
     fx       [{ type: 'nocalm' }]: every finished flight attendant task calms the passengers a little (js/game.js),
              a task with this does not. [{ type: 'coffee' }]: the captain sobers up.
     sound    the voice line in audio/ that plays when the task is finished.
     spot     where exactly inside the place. Read by nobody yet (for a marker).
     perFlight is not used for this pool any more (it has `undoes`).
   Voice lines (ElevenLabs, take _a of each, copied from audio/extra/ to audio/): att_calm, att_sit, att_masks,
   att_cockpit. They were matched to the tasks by their file names, nobody has checked the wording against the
   task yet. att_stop and att_got are used by the chase in intruder-play.js. Tasks without a line stay silent. */
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
        near: 'intruder_emp',
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
        sound: 'att_masks',
      },
      {
        id: 'device', undoes: 'bomb',
        title: 'FIND THE DEVICE',
        place: 'seat', spot: 'under an empty seat',
        brief: 'Follow the beeping, sit down, reach under the seat and peel the device off the frame.',
        input: 'hold', seconds: 6,
        effect: 3,
        clears: ['panic'],
        near: 'intruder_device',
        sound: 'att_calm',
      },
      {
        id: 'rumour', undoes: 'rumour',
        title: 'KILL THE RUMOUR',
        place: 'seat', spot: 'next to another passenger',
        brief: 'Sit down next to the passengers who are whispering and tell them both engines are fine.',
        input: 'hold', seconds: 5,
        effect: 2,
        clears: ['panic'],
        sound: 'att_calm',
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
        sound: 'att_sit',
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
        sound: 'att_sit',
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
        sound: 'att_cockpit',
      },
      // ---------- on its own ----------
      {
        id: 'coffee',
        title: 'COFFEE FOR THE CAPTAIN',
        place: 'cockpit', fetch: 'galley', spot: 'pour it in the front galley, hand it over beside the left seat',
        brief: 'Pour a strong black coffee in the front galley. The captain has been at the whiskey.',
        brief2: 'Carry the cup into the cockpit (the door opens for the crew) and hand it to the captain.',
        input: 'hold', seconds: 2,
        effect: 3,
        always: true,
        fx: [{ type: 'coffee' }, { type: 'nocalm' }],   // sobers the captain up (js/game.js); time only, the passengers do not notice
      },
    ],
  };

})(typeof window !== 'undefined' ? window : this);
