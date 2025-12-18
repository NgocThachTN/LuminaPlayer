import { GoogleGenAI, Type } from "@google/genai";
import { LyricLine } from "../types";

// Fetch synced lyrics from lrclib.net API
const fetchLrcLibLyrics = async (title: string, artist: string, duration?: number): Promise<LyricLine[]> => {
  try {
    console.log(`[lrclib] Searching: title="${title}", artist="${artist}"`);
    
    // Method 1: Search by track and artist first (most accurate)
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });
    let response = await fetch(`https://lrclib.net/api/search?${params}`);
    let results = response.ok ? await response.json() : [];
    console.log(`[lrclib] Method 1 (track+artist): ${results.length} results`);
    
    // Find best match - prioritize matching artist
    let bestMatch = findBestMatch(results, title, artist);
    if (bestMatch) {
      console.log(`[lrclib] Found: "${bestMatch.trackName}" by "${bestMatch.artistName}"`);
      return parseLRC(bestMatch.syncedLyrics);
    }
    
    // Method 2: Search with q parameter
    response = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${title}`)}`);
    results = response.ok ? await response.json() : [];
    console.log(`[lrclib] Method 2 (q=artist+title): ${results.length} results`);
    
    bestMatch = findBestMatch(results, title, artist);
    if (bestMatch) {
      console.log(`[lrclib] Found: "${bestMatch.trackName}" by "${bestMatch.artistName}"`);
      return parseLRC(bestMatch.syncedLyrics);
    }
    
    // Method 3: Try direct get if we have duration
    if (duration) {
      const getParams = new URLSearchParams({
        track_name: title,
        artist_name: artist,
        duration: Math.round(duration).toString()
      });
      response = await fetch(`https://lrclib.net/api/get?${getParams}`);
      if (response.ok) {
        const directResult = await response.json();
        if (directResult?.syncedLyrics) {
          console.log("[lrclib] Found via direct match with duration");
          return parseLRC(directResult.syncedLyrics);
        }
      }
    }
    
    console.log("[lrclib] No matching synced lyrics found");
    return [];
  } catch (error) {
    console.error("Error fetching from lrclib:", error);
    return [];
  }
};

// Find best matching result - prioritize artist match
const findBestMatch = (results: any[], title: string, artist: string): any | null => {
  if (!results || results.length === 0) return null;
  
  const normalizeStr = (str: string) => str.toLowerCase().replace(/[^\w\s\u3000-\u9fff\uac00-\ud7af]/g, '').trim();
  const normalizedTitle = normalizeStr(title);
  const normalizedArtist = normalizeStr(artist);
  
  // Score each result
  const scored = results
    .filter((r: any) => r.syncedLyrics) // Must have synced lyrics
    .map((r: any) => {
      const rTitle = normalizeStr(r.trackName || '');
      const rArtist = normalizeStr(r.artistName || '');
      
      let score = 0;
      
      // Artist match is most important
      if (rArtist === normalizedArtist) {
        score += 100;
      } else if (rArtist.includes(normalizedArtist) || normalizedArtist.includes(rArtist)) {
        score += 50;
      }
      
      // Title match
      if (rTitle === normalizedTitle) {
        score += 50;
      } else if (rTitle.includes(normalizedTitle) || normalizedTitle.includes(rTitle)) {
        score += 25;
      }
      
      return { result: r, score };
    })
    .filter(item => item.score > 0) // Must have some match
    .sort((a, b) => b.score - a.score);
  
  // Return best match only if it has a decent score (at least partial artist match)
  if (scored.length > 0 && scored[0].score >= 50) {
    return scored[0].result;
  }
  
  return null;
};

// Parse LRC format to LyricLine array
const parseLRC = (lrc: string): LyricLine[] => {
  const lines = lrc.split('\n');
  const lyrics: LyricLine[] = [];
  
  for (const line of lines) {
    // Support multiple timestamp formats: [mm:ss.xx], [mm:ss:xx], [mm:ss]
    const match = line.match(/\[(\d{2}):(\d{2})[.:]?(\d{0,3})?\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0;
      const time = minutes * 60 + seconds + ms / 1000;
      const text = match[4].trim();
      if (text) {
        lyrics.push({ time, text });
      }
    }
  }
  
  return lyrics.sort((a, b) => a.time - b.time);
};

// Clean search terms for better matching
const cleanSearchTerm = (term: string): string => {
  return term
    .replace(/\(.*?\)|\[.*?\]/g, '') // Remove parentheses content
    .replace(/feat\.?|ft\.?|featuring/gi, '') // Remove featuring
    .replace(/official|music|video|audio|lyrics|mv/gi, '') // Remove common suffixes
    .replace(/\s+/g, ' ')
    .trim();
};

export const getSyncedLyrics = async (title: string, artist: string, duration?: number): Promise<LyricLine[]> => {
  const originalTitle = title.trim();
  const originalArtist = artist.trim();
  const cleanTitle = cleanSearchTerm(title);
  const cleanArtist = cleanSearchTerm(artist);
  
  console.log(`Searching lyrics for: "${originalTitle}" by "${originalArtist}"`);
  
  // 1. lrclib.net - Try with original first (for CJK songs)
  let lyrics = await fetchLrcLibLyrics(originalTitle, originalArtist, duration);
  if (lyrics.length > 0) return lyrics;
  
  // Try with cleaned terms if different
  if (cleanTitle !== originalTitle || cleanArtist !== originalArtist) {
    lyrics = await fetchLrcLibLyrics(cleanTitle, cleanArtist, duration);
    if (lyrics.length > 0) return lyrics;
  }

  // 2. Fallback to Gemini AI
  console.log("No lrclib lyrics found, using Gemini AI...");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Tìm lời bài hát "${title}" của "${artist}" với timestamp chính xác.
  
  Yêu cầu:
  - Mỗi câu lời phải có thời gian bắt đầu (tính bằng giây)
  - Thời gian phải theo nhịp điệu thực tế của bài hát
  - Thường mỗi câu cách nhau 3-5 giây tùy tempo bài hát
  - Intro thường bắt đầu từ giây 0-15
  - Verse đầu thường bắt đầu từ giây 15-30
  
  Trả về JSON array với format: [{"time": số_giây, "text": "lời bài hát"}]
  
  Nếu không biết bài hát, trả về array rỗng [].`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              time: { type: Type.NUMBER, description: "Thời điểm bắt đầu lời (giây)" },
              text: { type: Type.STRING, description: "Lời bài hát" }
            },
            required: ["time", "text"]
          }
        }
      }
    });

    const aiLyrics: LyricLine[] = JSON.parse(response.text || "[]");
    return aiLyrics.sort((a, b) => a.time - b.time);
  } catch (error) {
    console.error("Error fetching lyrics from Gemini:", error);
    return [];
  }
};

