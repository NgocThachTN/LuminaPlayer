const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const jsmediatags = require("jsmediatags");

// Store for config (API key + playlist)
const configPath = path.join(app.getPath("userData"), "config.json");

function getConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (e) {
    console.error("Error reading config:", e);
  }
  return {};
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error("Error saving config:", e);
  }
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#000000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
    frame: true,
    titleBarStyle: "default",
  });

  // Load the app
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for API key management
ipcMain.handle("get-api-key", () => {
  const config = getConfig();
  return config.apiKey || "";
});

ipcMain.handle("set-api-key", (event, apiKey) => {
  const config = getConfig();
  config.apiKey = apiKey;
  saveConfig(config);
  return true;
});

ipcMain.handle("has-api-key", () => {
  const config = getConfig();
  return !!config.apiKey;
});

// IPC handlers for playlist persistence
ipcMain.handle("save-playlist", (event, filePaths) => {
  const config = getConfig();
  config.playlist = filePaths;
  saveConfig(config);
  return true;
});

ipcMain.handle("get-playlist", () => {
  const config = getConfig();
  return config.playlist || [];
});

ipcMain.handle("save-current-index", (event, index) => {
  const config = getConfig();
  config.currentSongIndex = index;
  saveConfig(config);
  return true;
});

ipcMain.handle("get-current-index", () => {
  const config = getConfig();
  return config.currentSongIndex ?? -1;
});

// Read file as buffer for audio playback
ipcMain.handle("read-file-buffer", async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".wma": "audio/x-ms-wma",
      };
      const mimeType = mimeTypes[ext] || "audio/mpeg";
      return {
        buffer: buffer.toString("base64"),
        mimeType,
        name: path.basename(filePath),
      };
    }
    return null;
  } catch (e) {
    console.error("Error reading file:", e);
    return null;
  }
});

// Check if file exists
ipcMain.handle("file-exists", async (event, filePath) => {
  return fs.existsSync(filePath);
});

// Open folder dialog and return audio file paths
ipcMain.handle("open-folder-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select Music Folder",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  const folderPath = result.filePaths[0];
  const audioExtensions = [
    ".mp3",
    ".wav",
    ".ogg",
    ".flac",
    ".m4a",
    ".aac",
    ".wma",
  ];

  try {
    const files = fs.readdirSync(folderPath);
    const audioFiles = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return audioExtensions.includes(ext);
      })
      .map((file) => path.join(folderPath, file))
      .sort();

    return audioFiles;
  } catch (e) {
    console.error("Error reading folder:", e);
    return [];
  }
});

// Open file dialog and return audio file paths
ipcMain.handle("open-file-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    title: "Select Music Files",
    filters: [
      {
        name: "Audio Files",
        extensions: ["mp3", "wav", "ogg", "flac", "m4a", "aac", "wma"],
      },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  return result.filePaths;
});

// Get basic metadata from filename (fast)
ipcMain.handle("get-file-info", async (event, filePath) => {
  try {
    const name = path.basename(filePath);
    const nameWithoutExt = name.replace(/\.[^/.]+$/, "");
    
    // Get file size
    const stats = fs.statSync(filePath);
    const size = stats.size;

    // Try to parse artist - title format
    let title = nameWithoutExt;
    let artist = "Unknown Artist";

    // Common formats: "Artist - Title" or "01 - Title" or "01. Title"
    const dashMatch = nameWithoutExt.match(/^(.+?)\s*-\s*(.+)$/);
    if (dashMatch) {
      const first = dashMatch[1].trim();
      const second = dashMatch[2].trim();
      // If first part is a number, it's probably track number
      if (/^\d+$/.test(first)) {
        title = second;
      } else {
        artist = first;
        title = second;
      }
    }

    return { title, artist, name, size };
  } catch (e) {
    return {
      title: path.basename(filePath).replace(/\.[^/.]+$/, ""),
      artist: "Unknown Artist",
      name: path.basename(filePath),
      size: null,
    };
  }
});

// Extract full metadata with cover art from file (using jsmediatags - reads only metadata, not entire file)
ipcMain.handle("extract-metadata", async (event, filePath) => {
  return new Promise((resolve) => {
    const name = path.basename(filePath);
    const nameWithoutExt = name.replace(/\.[^/.]+$/, "");

    // Default metadata from filename
    let defaultTitle = nameWithoutExt;
    let defaultArtist = "Unknown Artist";

    const dashMatch = nameWithoutExt.match(/^(.+?)\s*-\s*(.+)$/);
    if (dashMatch) {
      const first = dashMatch[1].trim();
      const second = dashMatch[2].trim();
      if (/^\d+$/.test(first)) {
        defaultTitle = second;
      } else {
        defaultArtist = first;
        defaultTitle = second;
      }
    }

    jsmediatags.read(filePath, {
      onSuccess: (tag) => {
        const tags = tag.tags;
        let cover = undefined;

        // Extract cover art
        if (tags.picture) {
          const { data, format } = tags.picture;
          const base64 = Buffer.from(data).toString("base64");
          cover = `data:${format};base64,${base64}`;
        }

        resolve({
          title: tags.title || defaultTitle,
          artist: tags.artist || defaultArtist,
          album: tags.album || "Unknown Album",
          cover: cover,
        });
      },
      onError: (error) => {
        console.error("Error reading metadata:", error);
        resolve({
          title: defaultTitle,
          artist: defaultArtist,
          album: "Unknown Album",
          cover: undefined,
        });
      },
    });
  });
});
