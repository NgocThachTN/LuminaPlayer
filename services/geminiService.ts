import { GoogleGenAI, Type } from "@google/genai";
import { LyricLine, LyricsResult } from "../types";

// Get API key - from Electron storage or environment variable
let cachedApiKey: string | null = null;

export const getApiKey = async (): Promise<string> => {
  if (cachedApiKey) return cachedApiKey;

  // Try Electron first
  if (window.electronAPI) {
    cachedApiKey = await window.electronAPI.getApiKey();
    if (cachedApiKey) return cachedApiKey;
  }

  // Fallback to environment variable (web mode)
  cachedApiKey = process.env.API_KEY || "";
  return cachedApiKey;
};

export const setApiKey = async (apiKey: string): Promise<void> => {
  cachedApiKey = apiKey;
  if (window.electronAPI) {
    await window.electronAPI.setApiKey(apiKey);
  }
};

export const hasApiKey = async (): Promise<boolean> => {
  const key = await getApiKey();
  return !!key;
};

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

    // Method 2: Search with q parameter (artist + title)
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

    // Method 3: Search with title only (useful for CJK songs where artist may not match)
    response = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(title)}`
    );
    results = response.ok ? await response.json() : [];
    console.log(`[lrclib] Method 3 (q=title only): ${results.length} results`);

    // For title-only search, use relaxed matching (accept first result with matching title)
    bestMatch = findBestMatchRelaxed(results, title);
    if (bestMatch) {
      console.log(
        `[lrclib] Found (relaxed): "${bestMatch.trackName}" by "${bestMatch.artistName}"`
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

const fetchYouTubeMusicLyrics = async (
  title: string,
  artist: string,
  album = ""
): Promise<LyricsResult> => {
  const emptyResult: LyricsResult = { synced: [], plain: [], isSynced: false };

  try {
    console.log(
      `[youtube-music] Searching: title="${title}", artist="${artist}", album="${album}"`
    );

    const data = window.electronAPI?.fetchYouTubeMusicLyrics
      ? await window.electronAPI.fetchYouTubeMusicLyrics(title, artist, album)
      : await fetchYouTubeMusicLyricsFromDevProxy(title, artist, album);
    const synced = Array.isArray(data?.synced)
      ? data.synced.filter((line) => Number.isFinite(line?.time) && line?.text)
      : [];
    const rawLyrics = data?.lyrics || "";
    if (synced.length === 0 && !rawLyrics) {
      console.log("[youtube-music] No lyrics found");
      return emptyResult;
    }

    const plain = rawLyrics
      ? rawLyrics.split("\n").map((line) => line.trim()).filter(Boolean)
      : synced.map((line) => line.text);

    if (synced.length > 0 || plain.length > 0) {
      console.log(
        `[youtube-music] Found ${synced.length > 0 ? "synced" : "plain"} lyrics` +
          (data?.title || data?.artist
            ? `: "${data?.title || title}" by "${data?.artist || artist}"`
            : "")
      );
      return { synced, plain, isSynced: synced.length > 0 };
    }

    console.log("[youtube-music] Response did not include usable lyrics");
    return emptyResult;
  } catch (error) {
    console.error("Error fetching from YouTube Music:", error);
    return emptyResult;
  }
};

const fetchYouTubeMusicLyricsFromDevProxy = async (
  title: string,
  artist: string,
  album = ""
): Promise<{ lyrics: string; synced?: LyricLine[]; videoId?: string; title?: string; artist?: string } | null> => {
  try {
    const params = new URLSearchParams({ title, artist });
    if (album) params.set("album", album);
    const response = await fetch(`/api/youtube-music-lyrics?${params}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
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

const extractLyricsFromRaw = (rawLyrics: string): LyricsResult => {
  if (!rawLyrics) return { synced: [], plain: [], isSynced: false };

  const trimmedLyrics = rawLyrics.trim();
  const synced = trimmedLyrics.startsWith("<")
    ? parseTTML(trimmedLyrics)
    : parseLRC(trimmedLyrics);
  const plain = synced.length > 0
    ? synced.map((line) => line.text)
    : trimmedLyrics.split("\n").map((l) => l.trim()).filter(Boolean);

  return {
    synced,
    plain,
    isSynced: synced.length > 0,
  };
};

// Normalize string for comparison (supports CJK characters)
const normalizeStr = (str: string) =>
  str
    .toLowerCase()
    .replace(/[^\w\s\u3000-\u9fff\uac00-\ud7af\u0080-\u024F]/g, "")
    .trim();

// Find best matching result - prioritize those with synced lyrics
const findBestMatch = (
  results: any[],
  title: string,
  artist: string
): any | null => {
  if (!results || results.length === 0) return null;

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

// Relaxed matching - only requires title match (for CJK songs where artist may differ)
const findBestMatchRelaxed = (results: any[], title: string): any | null => {
  if (!results || results.length === 0) return null;

  const normalizedTitle = normalizeStr(title);

  // Score each result - only care about title matching
  const scored = results
    .filter((r: any) => r.plainLyrics || r.syncedLyrics) // Must have lyrics
    .map((r: any) => {
      const rTitle = normalizeStr(r.trackName || "");

      let score = 0;

      // Bonus for having synced lyrics
      if (r.syncedLyrics) {
        score += 30;
      }

      // Title match - this is the only requirement
      if (rTitle === normalizedTitle) {
        score += 100;
      } else if (rTitle.includes(normalizedTitle)) {
        score += 60;
      } else if (normalizedTitle.includes(rTitle)) {
        score += 40;
      }

      return { result: r, score };
    })
    .filter((item) => item.score >= 40) // Must have at least partial title match
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
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

const parseTTMLTime = (value: string | null): number | null => {
  if (!value) return null;

  const time = value.trim();
  const unitMatch = time.match(/^([\d.]+)\s*(ms|s|m|h)$/i);
  if (unitMatch) {
    const amount = parseFloat(unitMatch[1]);
    const unit = unitMatch[2].toLowerCase();
    if (unit === "ms") return amount / 1000;
    if (unit === "s") return amount;
    if (unit === "m") return amount * 60;
    if (unit === "h") return amount * 3600;
  }

  if (time.includes(":")) {
    const parts = time.split(":").map((part) => parseFloat(part));
    if (parts.some((part) => Number.isNaN(part))) return null;

    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
  }

  const seconds = parseFloat(time);
  return Number.isNaN(seconds) ? null : seconds;
};

const parseTTML = (ttml: string): LyricLine[] => {
  if (!ttml || typeof DOMParser === "undefined") return [];

  const doc = new DOMParser().parseFromString(ttml, "application/xml");
  if (doc.querySelector("parsererror")) return [];

  const lyrics: LyricLine[] = [];
  const lines = Array.from(doc.getElementsByTagName("p"));

  for (const line of lines) {
    const firstSpan = line.getElementsByTagName("span")[0];
    const time =
      parseTTMLTime(line.getAttribute("begin")) ??
      parseTTMLTime(firstSpan?.getAttribute("begin") || null);
    const text = (line.textContent || "").replace(/\s+/g, " ").trim();

    if (time !== null && text) {
      lyrics.push({ time, text });
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
  artist: string,
  album = ""
): Promise<LyricsResult> => {
  const emptyResult: LyricsResult = { synced: [], plain: [], isSynced: false };
  const originalTitle = title.trim();
  const originalArtist = artist.trim();
  const cleanTitle = cleanSearchTerm(title);
  const cleanArtist = cleanSearchTerm(artist);

  console.log(
    `Searching lyrics for: "${originalTitle}" by "${originalArtist}"`
  );

  // 1. YouTube Music - only use first-party synced lyrics.
  // If YouTube Music only returns plain lyrics, keep searching LRCLIB.
  let result = await fetchYouTubeMusicLyrics(originalTitle, originalArtist, album);
  if (result.synced.length > 0) {
    console.log("[lyrics] Using YouTube Music (synced)");
    return result;
  }
  if (result.plain.length > 0) {
    console.log("[lyrics] Skipping YouTube Music plain lyrics; trying LRCLIB");
  }

  if (cleanTitle !== originalTitle || cleanArtist !== originalArtist) {
    result = await fetchYouTubeMusicLyrics(cleanTitle, cleanArtist, album);
    if (result.synced.length > 0) {
      console.log("[lyrics] Using YouTube Music cleaned (synced)");
      return result;
    }
    if (result.plain.length > 0) {
      console.log("[lyrics] Skipping YouTube Music cleaned plain lyrics; trying LRCLIB");
    }
  }

  // 2. lrclib.net - Try with original first (for CJK songs)
  result = await fetchLrcLibLyrics(originalTitle, originalArtist);
  if (result.synced.length > 0 || result.plain.length > 0) {
    console.log(`[lyrics] Using LRCLIB (${result.isSynced ? "synced" : "plain"})`);
    return result;
  }

  // Try with cleaned terms if different
  if (cleanTitle !== originalTitle || cleanArtist !== originalArtist) {
    result = await fetchLrcLibLyrics(cleanTitle, cleanArtist);
    if (result.synced.length > 0 || result.plain.length > 0) {
      console.log(`[lyrics] Using LRCLIB cleaned (${result.isSynced ? "synced" : "plain"})`);
      return result;
    }
  }

  // 3. Fallback to Gemini AI (plain lyrics only)
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.log("No API key available for Gemini fallback");
    return emptyResult;
  }

  console.log("No lyrics found from online sources, using Gemini AI...");
  const ai = new GoogleGenAI({ apiKey });

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
