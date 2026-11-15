/* ARE WE FALLING? — title screen extras: HOW TO PLAY, CREDITS, the volume slider and the note for phones.
   Kept out of game.js so the flight loop stays as it is. Needs js/audio.js (window.KKAudio). */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const A = window.KKAudio;

  const HOW = `
    <h2>HOW TO PLAY</h2>
    <p class="lead">The aircraft is failing. The pilot can see the cockpit but has no handbook. The tower has the handbook but cannot see the cockpit. Talk, or fall.</p>
    <div class="roles">
      <div class="role"><h3>PILOT</h3><small>NEEDS A MOUSE</small>
        <p>Read the FAILED SYSTEMS and the four-digit FLIGHT CODE (top right) to the tower.</p>
        <p>Find the panel with the picture the tower names and do exactly what they say. Calm the passengers with the right announcement.</p></div>
      <div class="role"><h3>TOWER</h3><small>ANY DEVICE, A PHONE WORKS</small>
        <p>Type the flight code into the handbook. It tells you which picture marks each failed panel on this flight.</p>
        <p>Read the chapter and talk the pilot through it. Three wrong switches and the aircraft is lost.</p></div>
      <div class="role"><h3>INTRUDER</h3><small>OPTIONAL CABIN SEAT</small>
        <p>You look like every other passenger. Do small jobs that cost the pilot time, crack the cockpit door, plant the device.</p>
        <p>Sit down and act natural <kbd>Q</kbd> when the flight attendant walks past.</p></div>
      <div class="role"><h3>ATTENDANT</h3><small>OPTIONAL CABIN SEAT</small>
        <p>Undo the sabotage, calm the cabin, bring the captain a black coffee. The cockpit door is always open for you.</p>
        <p>Catch the intruder at work <kbd>C</kbd> and they are out. Grab an innocent passenger and the cabin gets angrier.</p></div>
    </div>
    <div class="keys">
      <div><kbd>drag</kbd> look around the cockpit</div><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> + <kbd>mouse</kbd> walk the cabin</div>
      <div><kbd>click</kbd> use a switch, button or knob</div><div><kbd>E</kbd> hold to work, pour or hand over</div>
      <div><kbd>scroll</kbd> <kbd>Q</kbd> <kbd>E</kbd> zoom, <kbd>Space</kbd> face forward</div><div><kbd>F</kbd> sit down or stand up</div>
      <div><kbd>V</kbd> push to talk online, <kbd>P</kbd> fullscreen</div><div><kbd>M</kbd> cabin sound on or off</div>
    </div>
    <p class="tip">Same room: the pilot plays here, the tower opens the handbook on a second device (scan the QR code). Online: PLAY ONLINE, make a lobby and share the four-letter code. Voice chat is built in. The whiskey on the dash buys time but blurs the view, the ashtray clears your head and fills the cockpit with smoke.</p>`;

  const CREDITS = `
    <h2>CREDITS</h2>
    <p class="lead">Made in one day at HACK//OPS Game Jam Munich, 14 November 2026, and finished for the Chroma Awards.</p>
    <div class="cred">
      <div><b>ORHUN MAHIR</b>cockpit, flight, handbook, sound, online play</div>
      <div><b>EFE KAAN SALICI</b>control tower, flight attendant</div>
      <div><b>BATU DALLIAĞAÇ</b>intruder, cabin passengers</div>
      <div><b>VOICES, MUSIC, SOUND</b>made with ElevenLabs</div>
      <div><b>3D PASSENGERS, CREW, PROPS</b>made with Meshy</div>
      <div><b>BUILT WITH</b>three.js, PeerJS, qrcode-generator</div>
      <div><b>THANKS</b>the HACK//OPS organisers, ElevenLabs, Rosebud AI, Meshy</div>
      <div><b>VERSION</b>1.0.1</div>
    </div>`;

  const modal = $('modal'), body = $('modalBody');
  function open(html) { if (!modal) return; body.innerHTML = html; modal.classList.add('show'); body.scrollTop = 0; $('modalX').focus(); }
  function close() { if (modal) modal.classList.remove('show'); }
  if (modal) {
    $('btnHow').onclick = (e) => { open(HOW); e.currentTarget.blur(); };
    $('btnCredits').onclick = (e) => { open(CREDITS); e.currentTarget.blur(); };
    $('modalX').onclick = close;
    modal.addEventListener('pointerdown', (e) => { if (e.target === modal) close(); });
    window.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('show')) return;
      if (e.key === 'Escape') { close(); e.preventDefault(); }
      e.stopPropagation();                                      // keys must not reach the cockpit or the title while it is open
    }, true);
  }
  window.__awfHelp = { open: () => open(HOW), credits: () => open(CREDITS), close };

  // ---------------------------------------------------------------- volume, remembered on this device
  const vol = $('volume');
  if (vol && A && A.setVolume) {
    let v = 80;
    try { const s = localStorage.getItem('awf_vol'); if (s != null && !isNaN(+s)) v = Math.max(0, Math.min(100, +s)); } catch (e) {}
    vol.value = v; A.setVolume(v / 100);
    vol.addEventListener('input', () => {
      A.setVolume(vol.value / 100);
      try { localStorage.setItem('awf_vol', String(vol.value)); } catch (e) {}
    });
    vol.addEventListener('change', () => vol.blur());
  }

  // ---------------------------------------------------------------- phones: the pilot needs a mouse, the tower does not
  const note = $('phoneNote');
  if (note) {
    document.body.appendChild(note);   // out of the scaled 1280x720 stage: on a phone it must fill the real screen
    let seen = false;
    try { seen = sessionStorage.getItem('awf_phone') === '1'; } catch (e) {}
    const phone = window.matchMedia && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
    if (phone && !seen && !/[?&](embed|seat)=/.test(location.search)) note.classList.add('show');
    $('phoneAnyway').onclick = () => { note.classList.remove('show'); try { sessionStorage.setItem('awf_phone', '1'); } catch (e) {} };
  }
})();
