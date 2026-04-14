import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Photo storage utility for PALIMPS
 * Handles image manipulation, compression, and local file system storage
 */

export interface StoredPhoto {
  id: string;
  fullPath: string;
  thumbnailPath: string;
  originalUri: string;
  createdAt: number;
  width: number;
  height: number;
}

const PHOTOS_DIR = `${FileSystem.documentDirectory || ""}palimps-photos/`;
const PHOTOS_INDEX_KEY = "palimps-photos-index";

/**
 * Initialize photos directory if it doesn't exist
 */
export async function initializePhotoStorage(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error("[PhotoStorage] Failed to initialize directory:", error);
  }
}

/**
 * Process and store a photo
 * @param uri - Original photo URI (from camera or gallery)
 * @param type - "cover" (90x135) or "page" (max 1200px long side)
 * @returns Stored photo metadata
 */
export async function storePhoto(
  uri: string,
  type: "cover" | "page"
): Promise<StoredPhoto> {
  try {
    await initializePhotoStorage();

    // Get image dimensions
    const imageInfo = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 0.5,
    });

    const { width: origWidth, height: origHeight } = imageInfo;

    // Calculate target dimensions based on type
    let targetWidth: number, targetHeight: number;

    if (type === "cover") {
      // Cover: 90x135 (portrait, 2:3 ratio)
      targetWidth = 90;
      targetHeight = 135;
    } else {
      // Page: max 1200px on long side, maintain aspect ratio
      const maxDim = 1200;
      const isPortrait = origHeight >= origWidth;
      if (isPortrait) {
        targetHeight = Math.min(origHeight, maxDim);
        targetWidth = Math.round((origWidth / origHeight) * targetHeight);
      } else {
        targetWidth = Math.min(origWidth, maxDim);
        targetHeight = Math.round((origHeight / origWidth) * targetWidth);
      }
    }

    // Generate unique ID
    const photoId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Full-size image (compressed JPEG)
    const fullResult = await ImageManipulator.manipulateAsync(uri, [
      { resize: { width: targetWidth, height: targetHeight } },
    ]);

    const fullPath = `${PHOTOS_DIR}${photoId}-full.jpg`;
    await FileSystem.copyAsync({
      from: fullResult.uri,
      to: fullPath,
    });

    // Thumbnail (1/4 resolution, heavily compressed)
    const thumbWidth = Math.round(targetWidth / 4);
    const thumbHeight = Math.round(targetHeight / 4);

    const thumbResult = await ImageManipulator.manipulateAsync(uri, [
      { resize: { width: thumbWidth, height: thumbHeight } },
    ]);

    const thumbnailPath = `${PHOTOS_DIR}${photoId}-thumb.jpg`;
    await FileSystem.copyAsync({
      from: thumbResult.uri,
      to: thumbnailPath,
    });

    // Create metadata
    const photo: StoredPhoto = {
      id: photoId,
      fullPath,
      thumbnailPath,
      originalUri: uri,
      createdAt: Date.now(),
      width: targetWidth,
      height: targetHeight,
    };

    // Store in index
    await addPhotoToIndex(photo);

    return photo;
  } catch (error) {
    console.error("[PhotoStorage] Failed to store photo:", error);
    throw new Error(`Failed to store photo: ${error}`);
  }
}

/**
 * Get stored photo by ID
 */
export async function getPhoto(photoId: string): Promise<StoredPhoto | null> {
  try {
    const index = await getPhotosIndex();
    return index.find((p) => p.id === photoId) || null;
  } catch (error) {
    console.error("[PhotoStorage] Failed to get photo:", error);
    return null;
  }
}

/**
 * Delete stored photo (both full and thumbnail)
 */
export async function deletePhoto(photoId: string): Promise<void> {
  try {
    const photo = await getPhoto(photoId);
    if (!photo) return;

    // Delete files
    await Promise.all([
      FileSystem.deleteAsync(photo.fullPath, { idempotent: true }),
      FileSystem.deleteAsync(photo.thumbnailPath, { idempotent: true }),
    ]);

    // Remove from index
    const index = await getPhotosIndex();
    const updated = index.filter((p) => p.id !== photoId);
    await AsyncStorage.setItem(PHOTOS_INDEX_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("[PhotoStorage] Failed to delete photo:", error);
  }
}

/**
 * Get all stored photos
 */
export async function getAllPhotos(): Promise<StoredPhoto[]> {
  try {
    return await getPhotosIndex();
  } catch (error) {
    console.error("[PhotoStorage] Failed to get all photos:", error);
    return [];
  }
}

/**
 * Get photos index from AsyncStorage
 */
async function getPhotosIndex(): Promise<StoredPhoto[]> {
  try {
    const stored = await AsyncStorage.getItem(PHOTOS_INDEX_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("[PhotoStorage] Failed to read photos index:", error);
    return [];
  }
}

/**
 * Add photo to index
 */
async function addPhotoToIndex(photo: StoredPhoto): Promise<void> {
  try {
    const index = await getPhotosIndex();
    index.push(photo);
    await AsyncStorage.setItem(PHOTOS_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    console.error("[PhotoStorage] Failed to add photo to index:", error);
  }
}

/**
 * Get file URI for displaying photo
 * Returns file:// URI for local file system access
 */
export async function getPhotoUri(
  photoId: string,
  size: "full" | "thumbnail" = "full"
): Promise<string | null> {
  try {
    const photo = await getPhoto(photoId);
    if (!photo) return null;

    const path = size === "full" ? photo.fullPath : photo.thumbnailPath;
    return `file://${path}`;
  } catch (error) {
    console.error("[PhotoStorage] Failed to get photo URI:", error);
    return null;
  }
}

/**
 * Clean up old photos (older than 30 days)
 */
export async function cleanupOldPhotos(daysOld: number = 30): Promise<number> {
  try {
    const photos = await getAllPhotos();
    const now = Date.now();
    const cutoff = now - daysOld * 24 * 60 * 60 * 1000;

    let deleted = 0;
    for (const photo of photos) {
      if (photo.createdAt < cutoff) {
        await deletePhoto(photo.id);
        deleted++;
      }
    }

    return deleted;
  } catch (error) {
    console.error("[PhotoStorage] Failed to cleanup old photos:", error);
    return 0;
  }
}
