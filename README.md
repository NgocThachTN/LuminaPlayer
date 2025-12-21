# LuminaPlayer

Minimalist music player with synchronized lyrics display.

Website:

<img width="1919" height="953" alt="image" src="https://github.com/user-attachments/assets/14ee219b-022c-4915-b45a-428e49681f48" />



Windows App:

<img width="1919" height="1018" alt="image" src="https://github.com/user-attachments/assets/0a23fc13-c9e6-46e6-ae8d-fb0bf499a435" />



Discord Rich Presence:

<img width="624" height="296" alt="image" src="https://github.com/user-attachments/assets/0645db5e-9881-4410-a237-84ecc1b78070" />

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
