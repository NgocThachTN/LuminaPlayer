import { GoogleGenAI, Type } from "@google/genai";

// Fetch plain lyrics from lrclib.net API
const fetchLrcLibLyrics = async (
  title: string,
  artist: string
): Promise<string[]> => {
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
      console.log(
        `[lrclib] Found: "${bestMatch.trackName}" by "${bestMatch.artistName}"`
      );
      return parsePlainLyrics(bestMatch.plainLyrics || bestMatch.syncedLyrics);
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
      return parsePlainLyrics(bestMatch.plainLyrics || bestMatch.syncedLyrics);
    }

    console.log("[lrclib] No matching lyrics found");
    return [];
  } catch (error) {
    console.error("Error fetching from lrclib:", error);
    return [];
  }
};

// Find best matching result - prioritize artist match
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

// Parse plain lyrics or strip timestamps from synced lyrics
const parsePlainLyrics = (lyrics: string): string[] => {
  if (!lyrics) return [];

  const lines = lyrics.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    // Remove LRC timestamps if present [mm:ss.xx] or [mm:ss:xx] or [mm:ss]
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

export const getPlainLyrics = async (
  title: string,
  artist: string
): Promise<string[]> => {
  const originalTitle = title.trim();
  const originalArtist = artist.trim();
  const cleanTitle = cleanSearchTerm(title);
  const cleanArtist = cleanSearchTerm(artist);

  console.log(
    `Searching lyrics for: "${originalTitle}" by "${originalArtist}"`
  );

  // 1. lrclib.net - Try with original first (for CJK songs)
  let lyrics = await fetchLrcLibLyrics(originalTitle, originalArtist);
  if (lyrics.length > 0) return lyrics;

  // Try with cleaned terms if different
  if (cleanTitle !== originalTitle || cleanArtist !== originalArtist) {
    lyrics = await fetchLrcLibLyrics(cleanTitle, cleanArtist);
    if (lyrics.length > 0) return lyrics;
  }

  // 2. Fallback to Gemini AI
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
    return aiLyrics;
  } catch (error) {
    console.error("Error fetching lyrics from Gemini:", error);
    return [];
  }
};
