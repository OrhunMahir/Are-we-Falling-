# Release QA scripts (15 November, v1.0.1)

Playwright scripts that play the game the way a person would, through the real pages. They need the game served over http and, for the online ones, a local PeerServer:

    node -e "require('peer').PeerServer({ port: 9000, path: '/', host: '127.0.0.1' })" &
    python3 -m http.server 8765 --bind 127.0.0.1 &      # in the repo root

| Script | What it plays |
|---|---|
| `solo.js` | one pilot: a flight in each mode, every failure solved through its panel controls by the handbook rules, the landing and end screen; a crash by three mistakes; time running out; abort; whiskey, cigarette, PA |
| `net2.js` | tower hosts and a guest flies, mode and start rights, crash seen by the tower, back to the lobby, second flight, the pilot aborts, public lobby list, a full lobby refuses the fifth player, the host leaves |
| `three.js` | `ROLE=saboteur|attendant END=crash|land`: three seats, the cabin layer, a sabotage or a malfunction, the end played in the cabin, back to the lobby |
| `fixes2.js` | `ROLE=saboteur`: the intruder's clock survives a quiet line; `ROLE=attendant`: one landing at touchdown, the approach banner, the frames unloaded after the flight, the second flight |
| `pages.js` | every page on its own (handbook, 3D tower, intruder page, cabin test pages, classic redirect) with no errors |
| `full.js` | four joins in a row, the fifth is refused |

Software rendering (swiftshader) runs at about one frame a second: run one script at a time.
