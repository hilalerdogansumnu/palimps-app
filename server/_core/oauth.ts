import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { getUserByOpenId, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

async function syncUser(userInfo: {
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  platform?: string | null;
}) {
  if (!userInfo.openId) {
    throw new Error("openId missing from user info");
  }

  const lastSignedIn = new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn,
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return (
    saved ?? {
      openId: userInfo.openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: userInfo.loginMethod ?? null,
      lastSignedIn,
    }
  );
}

function buildUserResponse(
  user:
    | Awaited<ReturnType<typeof getUserByOpenId>>
    | {
        openId: string;
        name?: string | null;
        email?: string | null;
        loginMethod?: string | null;
        lastSignedIn?: Date | null;
      },
) {
  return {
    id: (user as any)?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

export function registerOAuthRoutes(app: Express) {
  // Login endpoint - redirects to Manus OAuth
  app.get("/auth/login/:provider", async (req: Request, res: Response) => {
    const provider = req.params.provider;
    const redirectUri = getQueryParam(req, "redirect_uri");
    const platform = getQueryParam(req, "platform") || "web"; // mobile or web

    if (!redirectUri) {
      res.status(400).json({ error: "redirect_uri is required" });
      return;
    }

    if (provider !== "google" && provider !== "apple") {
      res.status(400).json({ error: "Invalid provider. Must be 'google' or 'apple'" });
      return;
    }

    try {
      // Manus OAuth base URL
      const oauthBaseUrl = process.env.MANUS_OAUTH_URL || "https://oauth.manus.space";
      
      // Build OAuth URL with provider and callback
      const callbackUrl = `${req.protocol}://${req.get("host")}/api/oauth/callback`;
      
      // Generate a random OAuth state for security
      const oauthState = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Store app redirect URI and platform in a signed cookie (expires in 10 minutes)
      const stateData = JSON.stringify({ redirectUri, platform });
      res.cookie(`oauth_state_${oauthState}`, stateData, {
        httpOnly: true,
        secure: req.protocol === "https",
        sameSite: "lax",
        maxAge: 10 * 60 * 1000, // 10 minutes
      });
      
      const loginUrl = `${oauthBaseUrl}/authorize?provider=${provider}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${encodeURIComponent(oauthState)}`;

      console.log("[OAuth] Redirecting to login URL:", loginUrl);
      console.log("[OAuth] OAuth state:", oauthState);
      console.log("[OAuth] App redirect URI:", redirectUri);
      console.log("[OAuth] Platform:", platform);
      
      // Redirect user to Manus OAuth
      res.redirect(302, loginUrl);
    } catch (error) {
      console.error("[OAuth] Login URL generation failed", error);
      res.status(500).json({ error: "Failed to generate login URL" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const oauthState = getQueryParam(req, "state");

    if (!code || !oauthState) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      // Retrieve stored state data from cookie
      const stateCookieName = `oauth_state_${oauthState}`;
      const stateDataStr = req.cookies[stateCookieName];
      
      if (!stateDataStr) {
        console.error("[OAuth] State cookie not found:", stateCookieName);
        res.status(400).json({ error: "Invalid or expired OAuth state" });
        return;
      }
      
      const stateData = JSON.parse(stateDataStr);
      const { redirectUri, platform } = stateData;
      
      console.log("[OAuth] State data retrieved:", { redirectUri, platform, oauthState });
      
      // Clear the state cookie
      res.clearCookie(stateCookieName);
      
      // Exchange code for token
      const tokenResponse = await sdk.exchangeCodeForToken(code, oauthState);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);
      
      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      
      // Build user response
      const userResponse = buildUserResponse(user);
      
      // Redirect based on platform
      if (platform === "mobile") {
        // For mobile: redirect to deep link with sessionToken and user data
        const userDataEncoded = Buffer.from(JSON.stringify(userResponse)).toString("base64");
        const separator = redirectUri.includes("?") ? "&" : "?";
        const mobileRedirectUrl = `${redirectUri}${separator}sessionToken=${encodeURIComponent(sessionToken)}&user=${encodeURIComponent(userDataEncoded)}`;
        
        console.log("[OAuth] Redirecting to mobile deep link:", mobileRedirectUrl);
        res.redirect(302, mobileRedirectUrl);
      } else {
        // For web: redirect to frontend URL (cookie-based auth)
        const frontendUrl =
          process.env.EXPO_WEB_PREVIEW_URL ||
          process.env.EXPO_PACKAGER_PROXY_URL ||
          "http://localhost:8081";
        
        console.log("[OAuth] Redirecting to web frontend:", frontendUrl);
        res.redirect(302, frontendUrl);
      }
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  app.get("/api/oauth/mobile", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);

      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user),
      });
    } catch (error) {
      console.error("[OAuth] Mobile exchange failed", error);
      res.status(500).json({ error: "OAuth mobile exchange failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // Get current authenticated user - works with both cookie (web) and Bearer token (mobile)
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/me failed:", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Establish session cookie from Bearer token
  // Used by iframe preview: frontend receives token via postMessage, then calls this endpoint
  // to get a proper Set-Cookie response from the backend (3000-xxx domain)
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      // Authenticate using Bearer token from Authorization header
      const user = await sdk.authenticateRequest(req);

      // Get the token from the Authorization header to set as cookie
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();

      // Set cookie for this domain (3000-xxx)
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}
