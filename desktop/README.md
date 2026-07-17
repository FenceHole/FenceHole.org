# Nessie Orb — she floats on your desktop

A small always-on-top window that keeps Nessie hovering over everything you're
doing — every app, every desktop, even over full-screen. Press
**Cmd+Shift+N** (Mac) / **Ctrl+Shift+N** (Windows) anywhere to summon or hide
her, Siri-style.

It loads the real Nessie from fencehole.org, so this is the *same* Nessie as
the Hub and WhatsApp — one brain, one memory. Log in once inside the orb and
it remembers you.

## One-time setup (~5 minutes)

1. **Install Node.js** (once per computer): go to <https://nodejs.org>, click
   the big green **LTS** download, run the installer, keep clicking Next.
2. Get this folder onto the computer (clone the repo or download it):
   ```
   git clone https://github.com/FenceHole/FenceHole.org.git
   ```
3. Open **Terminal** and run:
   ```
   cd FenceHole.org/desktop
   npm install
   npm start
   ```

Nessie appears floating in her own little window. Drag her by the gold bar at
the top. The ✕ hides her; **Cmd/Ctrl+Shift+N** brings her back from anywhere.

## Day-to-day

After the one-time setup, starting her is just:

```
cd FenceHole.org/desktop && npm start
```

## Notes

- **Voice:** she can *speak her replies aloud* in the orb. The microphone
  button won't appear here — the free browser speech recognition Chrome
  provides isn't available inside desktop shells. (True hands-free voice in
  the orb is a planned upgrade via Whisper once GROQ_API_KEY is set.)
- Point the orb somewhere else (e.g. a local self-hosted Hub) with:
  `NESSIE_URL=http://localhost:3000/hq/nessie npm start`
- Want a double-clickable **Nessie.app** with her emblem as the icon (no
  Terminal at all)? That's an `electron-builder` step away — ask and it will
  be wired up.
