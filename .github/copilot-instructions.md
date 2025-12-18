# LuminaPlayer - Copilot Instructions

## Project Overview
LuminaPlayer is a minimalist music player with synchronized lyrics. It uses **React 19 + TypeScript + Vite** with Tailwind CSS (via CDN). The app fetches synced lyrics from lrclib.net API with Gemini AI fallback.

## Architecture

### Data Flow
1. **File Import** → `metadataService.ts` extracts ID3 tags via jsmediatags
2. **Lyrics Fetch** → `geminiService.ts` queries lrclib.net first, falls back to Gemini AI
3. **Playback Sync** → `App.tsx` tracks `currentTime` and auto-scrolls to active lyric

### Key Files
- [App.tsx](../App.tsx) - Single-page app with all UI state (`SongState`), audio controls, playlist management
- [services/geminiService.ts](../services/geminiService.ts) - Lyrics fetching with multi-strategy search (lrclib → Gemini)
- [services/metadataService.ts](../services/metadataService.ts) - ID3 tag extraction with filename fallback parsing
- [components/Visualizer.tsx](../components/Visualizer.tsx) - Web Audio API frequency visualizer
- [types.ts](../types.ts) - Core interfaces: `LyricLine`, `SongMetadata`, `SongState`

## Development

### Commands
```bash
npm install          # Install dependencies
npm run dev          # Start dev server on port 3000
npm run build        # Production build
```

### Environment Setup
Create `.env.local` with:
```
GEMINI_API_KEY=your_key_here
```

## Code Conventions

### Coding Philosophy
- **Minimalist code** - Viết code đơn giản, dễ đọc cho người mới học
- **Avoid complexity** - Không dùng các hàm phức tạp như `reduce`, `flatMap`, destructuring lồng nhau
- **Prefer basic loops** - Ưu tiên `for`, `forEach`, `map` thay vì các pattern phức tạp
- **Simple functions** - Mỗi hàm chỉ làm một việc, tối đa 20-30 dòng
- **Clear variable names** - Đặt tên biến rõ ràng, không viết tắt khó hiểu

### Styling
- **Tailwind CSS only** - loaded via CDN in `index.html`, no CSS modules
- **Design system**: Black background, white text, `Space Grotesk` font
- **Button style**: Class `square-btn` for navigation buttons
- **Opacity scale**: `text-white/40` for muted text, `text-white/10` for disabled

### Metadata Display
- All titles/artist names are **UPPERCASED** (see `metadataService.ts`)
- Filename parsing pattern: `Artist - Title.mp3` → fallback when ID3 tags missing

### Lyrics Format
```typescript
interface LyricLine {
  time: number;  // Seconds (float), e.g., 15.5
  text: string;
}
```
- LRC parsing supports: `[mm:ss.xx]`, `[mm:ss:xx]`, `[mm:ss]`

### State Management
- Single `useState<SongState>` in App.tsx - no external state library
- Audio element accessed via `useRef<HTMLAudioElement>`
- Lyrics sync uses `findLastIndex()` on `currentTime`

## Integration Points

### lrclib.net API (Primary Lyrics Source)
- Search: `GET /api/search?track_name=X&artist_name=Y`
- Fallback search: `GET /api/search?q=artist+title`
- Returns LRC format in `syncedLyrics` field

### Gemini AI (Fallback)
- Model: `gemini-2.0-flash`
- Returns JSON array of `{time, text}` objects
- Prompts are in Vietnamese (project origin)

## Common Tasks

### Adding a new audio source
Update `handleFileChange` or `handleFolderChange` in App.tsx, then call `playSong()`.

### Modifying lyrics display
Edit the lyrics map in App.tsx (~line 230) - uses `.active-lyric` CSS class for highlighting.

### Changing visualizer style
Modify `draw()` function in `Visualizer.tsx` - uses `analyzer.frequencyBinCount` bars.
