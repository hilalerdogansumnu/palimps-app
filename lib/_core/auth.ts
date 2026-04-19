import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";
import { devLog } from "./logger";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  isPremium: number; // 0 = free, 1 = premium
  lastSignedIn: Date;
};

export async function getSessionToken(): Promise<string | null> {
  try {
    // Web platform uses cookie-based auth, no manual token management needed
    if (Platform.OS === "web") {
      devLog("[Auth] Web platform uses cookie-based auth, skipping token retrieval");
      return null;
    }

    // Use SecureStore for native
    devLog("[Auth] Getting session token...");
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    devLog("[Auth] Session token retrieved:", token ? "present" : "missing");
    return token;
  } catch (error) {
    console.error("[Auth] Failed to get session token:", error);
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  try {
    // Web platform uses cookie-based auth, no manual token management needed
    if (Platform.OS === "web") {
      devLog("[Auth] Web platform uses cookie-based auth, skipping token storage");
      return;
    }

    // Use SecureStore for native
    devLog("[Auth] Setting session token");
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    devLog("[Auth] Session token stored");
  } catch (error) {
    console.error("[Auth] Failed to set session token:", error);
    throw error;
  }
}

export async function removeSessionToken(): Promise<void> {
  try {
    // Web platform uses cookie-based auth, logout is handled by server clearing cookie
    if (Platform.OS === "web") {
      devLog("[Auth] Web platform uses cookie-based auth, skipping token removal");
      return;
    }

    // Use SecureStore for native
    devLog("[Auth] Removing session token");
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    devLog("[Auth] Session token removed");
  } catch (error) {
    console.error("[Auth] Failed to remove session token:", error);
  }
}

export async function getUserInfo(): Promise<User | null> {
  try {
    devLog("[Auth] Getting user info");

    let info: string | null = null;
    if (Platform.OS === "web") {
      // Use localStorage for web
      info = window.localStorage.getItem(USER_INFO_KEY);
    } else {
      // Use SecureStore for native
      info = await SecureStore.getItemAsync(USER_INFO_KEY);
    }

    if (!info) {
      devLog("[Auth] No user info found");
      return null;
    }
    const user = JSON.parse(info);
    devLog("[Auth] User info retrieved");
    return user;
  } catch (error) {
    console.error("[Auth] Failed to get user info:", error);
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  try {
    devLog("[Auth] Setting user info");

    if (Platform.OS === "web") {
      // Use localStorage for web
      window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
      devLog("[Auth] User info stored (web)");
      return;
    }

    // Use SecureStore for native
    await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
    devLog("[Auth] User info stored (native)");
  } catch (error) {
    console.error("[Auth] Failed to set user info:", error);
  }
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      // Use localStorage for web
      window.localStorage.removeItem(USER_INFO_KEY);
      return;
    }

    // Use SecureStore for native
    await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch (error) {
    console.error("[Auth] Failed to clear user info:", error);
  }
}

// Simple auth change notification so useAuth can re-fetch after login
type AuthChangeListener = () => void;
const listeners: Set<AuthChangeListener> = new Set();

export function onAuthChange(listener: AuthChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyAuthChange(): void {
  listeners.forEach((fn) => fn());
}
