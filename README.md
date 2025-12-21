# LuminaPlayer

Minimalist music player with synchronized lyrics display.

Website:

<img width="1919" height="958" alt="image" src="https://github.com/user-attachments/assets/758b372a-d5a3-4524-8589-dad142048b3d" />


Windows App:

<img width="1919" height="1020" alt="image" src="https://github.com/user-attachments/assets/860d3b90-d9bd-4e47-aecd-d3d0e13a432d" />


## Features

- **Local Library:** Import audio files or entire folders.
- **Synced Lyrics:** Auto-fetch synchronized lyrics from [lrclib.net](https://lrclib.net).
- **AI Lyrics Generation:** Gemini AI fallback for generating lyrics when not found online.
- **Visualizer:** Real-time audio frequency visualizer.
- **Discord Rich Presence:** Show your current track and playback status on Discord.
- **Playlist Management:** Create and manage your music queue.
- **Desktop Support:** Native Windows application via Electron.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Desktop:** Electron
- **Metadata:** jsmediatags (ID3 metadata extraction)
- **AI Integration:** Google Gemini AI
- **Integrations:** Discord RPC (Rich Presence)

## Run Locally

**Prerequisites:** Node.js (v18+)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` and add your Gemini API key:

   ```env
   VITE_GEMINI_API_KEY=your_key_here
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

App runs at `http://localhost:3000`

## Build Desktop App

Build the Windows desktop application:

```bash
npm run electron:build:win
```

The installer will be generated in the `release/` folder.

## Project Structure

```text
App.tsx                 # Main UI component
types.ts                # TypeScript interfaces
services/
  geminiService.ts      # Lyrics fetching (lrclib + Gemini)
  metadataService.ts    # ID3 tag extraction
  discordService.ts     # Discord Rich Presence activity management
components/
  Visualizer.tsx        # Audio frequency visualizer
```
