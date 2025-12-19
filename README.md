# LuminaPlayer

Minimalist music player with synchronized lyrics display.

Website:

<img width="1919" height="914" alt="image" src="https://github.com/user-attachments/assets/69d9e5f0-7358-4224-97d4-be31ef92355e" />


Windows App:

<img width="1919" height="1019" alt="image" src="https://github.com/user-attachments/assets/aca6bbd8-636d-4819-94a2-4cf73d3043a5" />


## Features

- Import audio files or folders
- Auto-fetch synced lyrics from lrclib.net
- Gemini AI fallback for lyrics generation (option)
- Real-time audio visualizer
- Playlist management

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS (CDN)
- jsmediatags (ID3 metadata)
- Google Gemini AI

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` and add your Gemini API key:

   ```
   GEMINI_API_KEY=your_key_here
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

```
App.tsx                 # Main UI component
types.ts                # TypeScript interfaces
services/
  geminiService.ts      # Lyrics fetching (lrclib + Gemini)
  metadataService.ts    # ID3 tag extraction
components/
  Visualizer.tsx        # Audio frequency visualizer
```
