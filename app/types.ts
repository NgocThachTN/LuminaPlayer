
import { PlaylistItemMetadata } from "../types";

export * from "../types";

export type ViewMode =
  | "lyrics"
  | "playlist"
  | "albums"
  | "artists"
  | "album-detail"
  | "artist-detail";

export interface PlaylistItem {
  file?: File;
  path?: string;
  name: string;
  relativeFolder?: string;
  playlistName?: string;
  metadata?: PlaylistItemMetadata;
}

export interface FolderPlaylistInfo {
  id: string;
  name: string;
  trackIndices: number[];
}

