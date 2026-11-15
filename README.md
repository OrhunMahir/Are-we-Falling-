# Are We Falling?

A talking game for two to four players, made at **HACK//OPS Game Jam Munich** (14 November 2026) by Orhun Mahir, Efe Kaan Salıcı and Batu Dallıağaç.

One player is the **pilot**, sitting in a failing 3D cockpit with about eighty unnamed panels. The other is the **tower**, who has the emergency handbook but cannot see the cockpit. They can only talk. The pilot describes what they see, the tower reads the right chapter and says what to do, before the timer hits zero.

Play it by opening `index.html` in a browser. No install, no build step.

## How a flight works

1. The pilot picks a mode and presses **TAKE THE CONTROLS**. The tower opens the handbook (`manual.html`, or the tower seat in an online lobby).
2. The pilot sees **FAILED SYSTEMS** (names such as ENGINE FIRE) and a four-digit **FLIGHT CODE** in the top right corner and reads both to the tower.
3. The tower types the code into the handbook. The handbook then shows which **picture** marks each failed panel on this flight ("ENGINE FIRE is the flamingo panel"). Pictures are dealt again on every flight. In an online lobby the code arrives by itself.
4. The pilot finds the panel with that picture (a red light blinks on failing panels), the tower reads the chapter, and they solve it together.
5. All failures solved in time: the aircraft is saved, and both players watch it land from the tower camera (flare, tyre smoke, braking). Three wrong actions or no time left: it is lost, and it flies straight into the control tower.

| Mode | Failures | Time | Where the panels are |
|---|---|---|---|
| SHORT HOP | 3 | 4:00 | within reach of the front seats |
| MAYDAY | 5 | 7:00 | the far side and the ceiling too |
| BLACK BOX | 7 | 10:00 | anywhere, even on the wall behind the seat |

Eight systems can fail: circuit breakers, engine fire, nav radio, hydraulics, cabin intercom, landing gear, transponder and override keys. A **wrong switch means turbulence**: the cockpit shakes and the cabin gets angrier. On top of that the **passengers** get restless and the pilot has to calm them with the right announcement, and there is a **bottle of whiskey** on the dash: every sip buys 8 seconds, but the cockpit gets blurry and the eyelids start to droop. Next to it stands an **ashtray**: a drag clears the head, but smoke too much and the cockpit fills with haze until the panels are hard to see. The smoke clears slowly by itself.

## Controls

**Pilot**

| Input | What it does |
|---|---|
| Drag | look around |
| Scroll / touchpad, Q and E | zoom |
| Click | operate a switch, button or key |
| Click a knob | the view moves in on the knob; turn it with the scroll wheel, by dragging sideways or with A and D; click or Enter to let go |
| Space or R | face forward again |
| F | stand up or sit down (panels on the rear wall can only be reached standing) |
| V | push to talk (online, when the mic is set to push to talk) |

**Tower**

The handbook lies on the desk of a 3D control tower. The tabs on the right edge turn the pages like a notepad: read pages fold up over the clip and pile up, going back brings them down again. **LOOK OUT THE WINDOW** or Space raises the head to watch the aircraft come in: it smokes and burns depending on what is failing. On a phone or small window the handbook is a plain page (`manual.html?plain=1` forces that).

When the flight ends the handbook is put down and the head follows the aircraft by itself. Saved: it lands on the runway in front of the tower. Lost: it banks round and flies into the tower windows, glass hits the controller's face, the cab burns, the controller gets up, staggers a few steps and collapses, and the screen goes black.

## Playing together

- **Same room:** one screen runs the cockpit, a second device opens `manual.html` (the title screen shows a QR code when the game is served over http).
- **Online:** press **PLAY ONLINE**, create a lobby and give the four-character code to your partner, or use one of the public lobbies (ALPHA to HOTEL). Pick seats in the lobby: PILOT and TOWER are needed, **INTRUDER** and **ATTENDANT** are optional seats in the aircraft cabin. The intruder sits among the passengers and does small jobs that cost the pilot time (lights out, call bells, a blocked aisle, a cracked cockpit door); the flight attendant undoes them, calms the cabin, brings the captain a black coffee and can catch the intruder in the act. Both walk in first person, see each other, and can step into the real cockpit behind the pilot. Voice chat is built in, with a radio effect; the mic can be open, push to talk or muted.

Online play uses [PeerJS](https://peerjs.com) with the public PeerJS signalling server, peer to peer data and audio. No own server is needed. `?peer=host:port` points the game at another PeerServer for testing.

## Running and packaging

- Run: open `index.html`. For the QR code and for microphone access use any static server, for example `python3 -m http.server 8765` in this folder, then `http://localhost:8765/`.
- Package for itch.io: `bash tools/package.sh` writes `arewefalling-v1.0-itch.zip` (the jam build was `arewefalling-itch.zip`; give another name as the first argument) with `index.html` at its root. Upload it as an HTML5 game, 1280 by 720, with the fullscreen button enabled.
- Fixed flight for testing: `index.html?seed=7`.

- Tower endings without a pilot: `manual.html?crash=1` plays a burning flight that ends in the tower, `manual.html?land=1` one that is saved. Add `&outside=1` to watch either from the outside cameras.
- Browsers cache `manual.html` and `js/tower3d.js` hard while you edit them. If a change does not show, reload with Cmd+Shift+R (or clear the cache); inside the online tower seat the handbook is a frame, so reload the game page too.

- The cabin on its own, for trying task pools: `cabin.html?role=saboteur` or `cabin.html?role=attendant` on a static server. The flight attendant's page raises malfunctions by itself and has a picker that plays a sabotage (`&intruder=1` turns the malfunctions off). See [ROADMAP.md](ROADMAP.md), "The cabin".


## File map

| File | What it is | Owner |
|---|---|---|
| `index.html`, `css/style.css`, `css/cockpit3d.css` | title screen, HUD, end screen | Orhun |
| `js/rules.js` | **every rule of the game** (failures, tables, handbook texts, flight generation, flight code, picture dealing). Loaded by the cockpit and by the handbook, so they cannot disagree | Orhun |
| `js/game.js` | flight loop, timer, strikes, cabin panic, whiskey, cigarettes, HUD | Orhun |
| `js/cockpit3d.js` | 3D cockpit engine: surfaces, panel slots, controls, picking, camera, hand, stand and sit, knob mode, dash toy | Orhun |
| `js/modules3d.js` | the eight failing panels | Orhun |
| `js/decoys.js` | the dozens of working panels that only look busy | Orhun |
| `js/audio.js`, `audio/` | sound engine, voices, music and effects (made with ElevenLabs) | Orhun |
| `js/sky.js` | the storm outside the cockpit | Orhun |
| `js/net.js`, `css/net.css` | lobbies, seats, voice chat, state sync | Orhun |
| `cabin.html`, `js/cabin3d.js` | the aircraft cabin where the intruder and the flight attendant play; also a test page of its own | Orhun |
| `js/roles/saboteur.js` | the intruder's task pool (the seat is called `saboteur` in the code) | **Batu** |
| `js/roles/attendant.js` | the flight attendant's task pool: one task that undoes each sabotage, opened when the sabotage (or a malfunction) happens, the cabin calm, and a black coffee for the captain | **Efe** |
| `manual.html` (handbook content and flight code box) | the tower handbook, generated from `rules.js` | Orhun |
| `manual.html` (everything under `body.t3d` in the CSS and the "3D tower room" part of the script) | how the handbook sits in the tower room | **Efe** |
| `js/tower3d.js` | **the 3D tower room**: sky, runway, cab, desk, aircraft, smoke, the crash into the tower, the landing, and outside cameras (`KKTower.start(canvas, { view: 'outside' })`) | **Efe** |
| `meshy/`, `js/models.js`, `tools/glb/` | 3D models made with Meshy and the tool that packs them | shared, see below |
| `classic.html` | the first 2D version of the cockpit, kept as a fallback | nobody, leave it |
| `js/vendor/` | three.js r159, PeerJS, QR code, bundled GLTF loader | do not edit |

See [ROADMAP.md](ROADMAP.md) for what is done, what is planned and how the work is split. The two optional cabin seats, **intruder** (Batu) and **flight attendant** (Efe), are in the online lobby in a first version; what is still open is listed there.

## 3D models (Meshy)

Two models were generated with Meshy: the bobblehead aeroplane on the dash (`meshy/bobble.glb`) and the airliner seen from the tower (`meshy/airliner.glb`). They are shrunk and embedded as base64 in `js/models.js`, so the game still runs from a plain file. If `js/models.js` is empty the game falls back to built-in shapes.

To change a model, replace the GLB in `meshy/` and run:

```
cd tools/glb
npm install
npm run models     # rewrites js/models.js
```

`js/models.js` is generated. Never merge it by hand: regenerate it.

## Made with

three.js, PeerJS, ElevenLabs (voices, sound effects, music), Meshy (3D models), and Claude Code.
