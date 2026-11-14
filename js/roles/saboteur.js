/* ARE WE FALLING? — the saboteur's task pool. Owner: Batu.

   STARTER FILE. The three tasks below are Orhun's examples, so that the cabin has something to deal.
   Replace them and add your own. Every flight deals `perFlight` tasks from the pool at random.

   Try it:  cabin.html?role=saboteur          (add &seed=1234 to get the same deal every time)
   Fields:  ROADMAP.md, "How the three parts fit together".
   place:   'seat' (sitting in any seat), 'aisle', 'lavatory', 'galley', 'door' (the cockpit door)
   effect:  seconds added to the time to impact. Negative for the saboteur. */
window.KK = window.KK || {};
KK.ROLES = KK.ROLES || {};
KK.ROLES.saboteur = {
  perFlight: 2,
  tasks: [
    {
      id: 'vent',
      title: 'BLOCK THE VENT',
      place: 'lavatory',
      brief: 'Go into the lavatory and stuff the ventilation grille.',
      seconds: 14,
      effect: -20,
    },
    {
      id: 'toilet',
      title: 'CLOG THE TOILET',
      place: 'lavatory',
      brief: 'Go into the lavatory and clog the toilet.',
      seconds: 10,
      effect: -15,
    },
    {
      id: 'stir',
      title: 'STIR UP THE PASSENGERS',
      place: 'seat',
      brief: 'Sit down among the passengers and tell them the aircraft is going down.',
      seconds: 8,
      effect: -10,
    },
  ],
};
