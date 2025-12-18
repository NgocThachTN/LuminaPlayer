import { GoogleGenAI, Type } from "@google/genai";
import { LyricLine, LyricsResult } from "../types";

// Fetch lyrics from lrclib.net API - prioritize synced, fallback to plain
const fetchLrcLibLyrics = async (
  title: string,
  artist: string
): Promise<LyricsResult> => {
  const emptyResult: LyricsResult = { synced: [], plain: [], isSynced: false };

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

    // Find best match - prioritize synced lyrics
    let bestMatch = findBestMatch(results, title, artist);
    if (bestMatch) {
      console.log(
        `[lrclib] Found: "${bestMatch.trackName}" by "${bestMatch.artistName}"`
      );
      return extractLyrics(bestMatch);
    }

    // Method 2: Search with q parameter
    response = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(
        `${artist} ${title}`
      )}`
    );
    results = response.ok ? await response.json() : [];
    console.log(
      `[lrclib] Method 2 (q=artist+title): ${results.length} results`
    );

    bestMatch = findBestMatch(results, title, artist);
    if (bestMatch) {
      console.log(
        `[lrclib] Found: "${bestMatch.trackName}" by "${bestMatch.artistName}"`
      );
      return extractLyrics(bestMatch);
    }

    console.log("[lrclib] No matching lyrics found");
    return emptyResult;
  } catch (error) {
    console.error("Error fetching from lrclib:", error);
    return emptyResult;
  }
};

// Extract both synced and plain lyrics from result
const extractLyrics = (result: any): LyricsResult => {
  const synced = result.syncedLyrics ? parseLRC(result.syncedLyrics) : [];
  const plain = result.plainLyrics
    ? result.plainLyrics.split("\n").filter((l: string) => l.trim())
    : parsePlainFromSynced(result.syncedLyrics);

  return {
    synced,
    plain,
    isSynced: synced.length > 0,
  };
};

// Find best matching result - prioritize those with synced lyrics
const findBestMatch = (
  results: any[],
  title: string,
  artist: string
): any | null => {
  if (!results || results.length === 0) return null;

  const normalizeStr = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^\w\s\u3000-\u9fff\uac00-\ud7af]/g, "")
      .trim();
  const normalizedTitle = normalizeStr(title);
  const normalizedArtist = normalizeStr(artist);

  // Score each result
  const scored = results
    .filter((r: any) => r.plainLyrics || r.syncedLyrics) // Must have lyrics
    .map((r: any) => {
      const rTitle = normalizeStr(r.trackName || "");
      const rArtist = normalizeStr(r.artistName || "");

      let score = 0;

      // Bonus for having synced lyrics
      if (r.syncedLyrics) {
        score += 20;
      }

      // Artist match is most important
      if (rArtist === normalizedArtist) {
        score += 100;
      } else if (
        rArtist.includes(normalizedArtist) ||
        normalizedArtist.includes(rArtist)
      ) {
        score += 50;
      }

      // Title match
      if (rTitle === normalizedTitle) {
        score += 50;
      } else if (
        rTitle.includes(normalizedTitle) ||
        normalizedTitle.includes(rTitle)
      ) {
        score += 25;
      }

      return { result: r, score };
    })
    .filter((item) => item.score > 0) // Must have some match
    .sort((a, b) => b.score - a.score);

  // Return best match only if it has a decent score (at least partial artist match)
  if (scored.length > 0 && scored[0].score >= 50) {
    return scored[0].result;
  }

  return null;
};

// Parse LRC format to LyricLine array
const parseLRC = (lrc: string): LyricLine[] => {
  if (!lrc) return [];

  const lines = lrc.split("\n");
  const lyrics: LyricLine[] = [];

  for (const line of lines) {
    // Support multiple timestamp formats: [mm:ss.xx], [mm:ss:xx], [mm:ss]
    const match = line.match(/\[(\d{2}):(\d{2})[.:]?(\d{0,3})?\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = match[3] ? parseInt(match[3].padEnd(3, "0")) : 0;
      const time = minutes * 60 + seconds + ms / 1000;
      const text = match[4].trim();
      if (text) {
        lyrics.push({ time, text });
      }
    }
  }

  return lyrics.sort((a, b) => a.time - b.time);
};

// Parse plain lyrics from synced lyrics (strip timestamps)
const parsePlainFromSynced = (lrc: string): string[] => {
  if (!lrc) return [];

  const lines = lrc.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const text = line
      .replace(/\[\d{2}:\d{2}[.:]\d{0,3}\]/g, "")
      .replace(/\[\d{2}:\d{2}\]/g, "")
      .trim();
    if (text) {
      result.push(text);
    }
  }

  return result;
};

// Clean search terms for better matching
const cleanSearchTerm = (term: string): string => {
  return term
    .replace(/\(.*?\)|\[.*?\]/g, "") // Remove parentheses content
    .replace(/feat\.?|ft\.?|featuring/gi, "") // Remove featuring
    .replace(/official|music|video|audio|lyrics|mv/gi, "") // Remove common suffixes
    .replace(/\s+/g, " ")
    .trim();
};

export const getLyrics = async (
  title: string,
  artist: string
): Promise<LyricsResult> => {
  const emptyResult: LyricsResult = { synced: [], plain: [], isSynced: false };
  const originalTitle = title.trim();
  const originalArtist = artist.trim();
  const cleanTitle = cleanSearchTerm(title);
  const cleanArtist = cleanSearchTerm(artist);

  console.log(
    `Searching lyrics for: "${originalTitle}" by "${originalArtist}"`
  );

  // 1. lrclib.net - Try with original first (for CJK songs)
  let result = await fetchLrcLibLyrics(originalTitle, originalArtist);
  if (result.synced.length > 0 || result.plain.length > 0) return result;

  // Try with cleaned terms if different
  if (cleanTitle !== originalTitle || cleanArtist !== originalArtist) {
    result = await fetchLrcLibLyrics(cleanTitle, cleanArtist);
    if (result.synced.length > 0 || result.plain.length > 0) return result;
  }

  // 2. Fallback to Gemini AI (plain lyrics only)
  console.log("No lrclib lyrics found, using Gemini AI...");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `Tìm lời bài hát "${title}" của "${artist}".
  
  Yêu cầu:
  - Chỉ trả về lời bài hát, mỗi dòng một câu
  - Không cần timestamp hay thời gian
  - Giữ nguyên ngôn ngữ gốc của bài hát
  
  Trả về JSON array với format: ["dòng 1", "dòng 2", ...]
  
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
            type: Type.STRING,
          },
        },
      },
    });

    const aiLyrics: string[] = JSON.parse(response.text || "[]");
    return {
      synced: [],
      plain: aiLyrics,
      isSynced: false,
    };
  } catch (error) {
    console.error("Error fetching lyrics from Gemini:", error);
    return emptyResult;
  }
};
