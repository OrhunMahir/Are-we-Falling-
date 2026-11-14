/* ARE WE FALLING? — the flight attendant's task pool. Owner: Efe.

   STARTER FILE. The three tasks below are placeholders, so that the cabin has something to deal.
   Replace them and add your own. Every flight deals `perFlight` tasks from the pool at random.

   Try it:  cabin.html?role=attendant         (add &seed=1234 to get the same deal every time)
   Fields:  ROADMAP.md, "How the three parts fit together".
   place:   'seat' (sitting in any seat), 'aisle', 'lavatory', 'galley', 'door' (the cockpit door)
   effect:  seconds added to the time to impact. Positive for the flight attendant. */
window.KK = window.KK || {};
KK.ROLES = KK.ROLES || {};
KK.ROLES.attendant = {
  perFlight: 2,
  tasks: [
    {
      id: 'calm',
      title: 'CALM THE CABIN',
      place: 'aisle',
      brief: 'Walk into the aisle and talk the passengers down.',
      seconds: 8,
      effect: 10,
    },
    {
      id: 'coffee',
      title: 'COFFEE FOR THE COCKPIT',
      place: 'galley',
      brief: 'Brew a pot of coffee in the galley for the pilot.',
      seconds: 10,
      effect: 12,
    },
    {
      id: 'door',
      title: 'CHECK THE COCKPIT DOOR',
      place: 'door',
      brief: 'Go to the cockpit door and make sure it is locked.',
      seconds: 6,
      effect: 8,
    },
  ],
};
