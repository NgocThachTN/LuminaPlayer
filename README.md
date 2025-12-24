# LuminaPlayer

A minimalist music player with synchronized lyrics, high-res audio support, and Discord Rich Presence integration.

<img src="assets/banner.png" width="100%">

Windows App:

<img width="1829" height="961" alt="image" src="https://github.com/user-attachments/assets/910bd4d3-eaea-4813-84ed-6cd14a04121c" />


<img width="1919" height="1021" alt="image" src="https://github.com/user-attachments/assets/e6f61917-6524-42d4-99c3-8c153498b448" />


<img width="1917" height="1019" alt="image" src="https://github.com/user-attachments/assets/acddcf15-3cda-4fd5-ac1c-a7d7c881be5e" />


Discord Rich Presence:

<img width="616" height="282" alt="image" src="https://github.com/user-attachments/assets/b50bd7c7-2fe6-4fbe-a7ec-426656aac251" />

## Features

- **Local Library:** Import audio files, folders, and manage them with persistent metadata.
- **High-Res Audio:** **LDAC** software decoding support for high-fidelity Bluetooth playback on Windows.
- **Context-Aware Playback:** Queue system allowing playback from specific Albums, Artists, or the Global Queue.
- **Smart Metadata:** Background metadata extraction with **music-metadata**.
- **Performance:** Optimized cover art caching (file-based) for instant library loading.
- **Synced Lyrics:** Auto-fetch synchronized lyrics from [lrclib.net](https://lrclib.net) with Gemini AI fallback.
- **Visualizer:** Real-time audio frequency visualizer.
- **Discord Rich Presence:** Show your current track and playback status on Discord.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Desktop:** Electron (IPC architecture)
- **Audio Processing:** 
    - `music-metadata` (Metadata & Duration)
    - Custom Native LDAC Module
- **Storage:** File-based cover caching & JSON configuration

## Project Structure

```text
electron/
  main.cjs               # Main Process (IPC, Metadata, File System)
  preload.cjs            # Preload script
app/
  components/            # React UI components (Library, Player, Visualizer)
  hooks/                 # Custom Hooks (useAudio, useLibrary, useLyrics)
  services/              # Services (Gemini, Metadata Fallback)
  App.tsx                # Main Application Logic
native/
  ldac/                  # LDAC Codec Integration
```

## Run Locally

**Prerequisites:** Node.js (v18+)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` and add your keys (Optional):
   ```env
   DISCORD_CLIENT_ID=YOUR_CLIENT_ID_HERE
   ```

3. Run the app (Development Mode):
   ```bash
   npm run dev
   # To launch Electron window:
   npm run electron:dev
   ```
4. How to Use Fullscreen Player

- Click **F11** button to open the fullscreen player with album art and lyrics display.
- To exit fullscreen, click the **F11** button again to exit full screen mode 

<img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/ad2bed6b-064e-45fa-b412-64b6eac3839b" />


## Build Desktop App

Build the Windows desktop application:

```bash
npm run electron:build:win
```

The installer will be generated in the `release/` folder.

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 LuminaPlayer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

