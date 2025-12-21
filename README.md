# LuminaPlayer

Minimalist music player with synchronized lyrics display.

Windows App:

<img width="1829" height="961" alt="image" src="https://github.com/user-attachments/assets/910bd4d3-eaea-4813-84ed-6cd14a04121c" />


<img width="1919" height="1021" alt="image" src="https://github.com/user-attachments/assets/e6f61917-6524-42d4-99c3-8c153498b448" />


<img width="1919" height="1020" alt="image" src="https://github.com/user-attachments/assets/20046ac9-113d-4691-b6ed-99a3354f69ec" />


Discord Rich Presence:

<img width="616" height="282" alt="image" src="https://github.com/user-attachments/assets/b50bd7c7-2fe6-4fbe-a7ec-426656aac251" />


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
