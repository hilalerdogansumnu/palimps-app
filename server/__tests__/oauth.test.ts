import { describe, it, expect, beforeAll } from "vitest";

describe("OAuth Flow", () => {
  const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  it("should return 400 if redirect_uri is missing", async () => {
    const response = await fetch(`${API_URL}/auth/login/google`);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("redirect_uri");
  });

  it("should return 400 for invalid provider", async () => {
    const response = await fetch(
      `${API_URL}/auth/login/invalid?redirect_uri=http://example.com`,
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Invalid provider");
  });

  it("should redirect to OAuth provider with correct parameters for Google", async () => {
    const redirectUri = "myapp://oauth/callback";
    const response = await fetch(
      `${API_URL}/auth/login/google?redirect_uri=${encodeURIComponent(redirectUri)}&platform=mobile`,
      {
        redirect: "manual",
      },
    );

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(location).toContain("oauth.manus.space/authorize");
    expect(location).toContain("provider=google");
    expect(location).toContain("redirect_uri=");
    expect(location).toContain("state=");

    // Verify state is a random string, not the redirect URI
    const url = new URL(location!);
    const state = url.searchParams.get("state");
    expect(state).toBeTruthy();
    expect(state).not.toBe(redirectUri);
    expect(state!.length).toBeGreaterThan(10); // Random state should be long
  });

  it("should redirect to OAuth provider with correct parameters for Apple", async () => {
    const redirectUri = "myapp://oauth/callback";
    const response = await fetch(
      `${API_URL}/auth/login/apple?redirect_uri=${encodeURIComponent(redirectUri)}&platform=mobile`,
      {
        redirect: "manual",
      },
    );

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(location).toContain("oauth.manus.space/authorize");
    expect(location).toContain("provider=apple");
    expect(location).toContain("redirect_uri=");
    expect(location).toContain("state=");
  });

  it("should set state cookie when initiating OAuth", async () => {
    const redirectUri = "myapp://oauth/callback";
    const response = await fetch(
      `${API_URL}/auth/login/google?redirect_uri=${encodeURIComponent(redirectUri)}&platform=mobile`,
      {
        redirect: "manual",
      },
    );

    const cookies = response.headers.get("set-cookie");
    expect(cookies).toBeTruthy();
    expect(cookies).toContain("oauth_state_");
  });

  it("should return 400 if OAuth callback is missing code or state", async () => {
    const response = await fetch(`${API_URL}/api/oauth/callback`);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("code and state are required");
  });

  it("should return 400 if OAuth callback has invalid state", async () => {
    const response = await fetch(
      `${API_URL}/api/oauth/callback?code=test_code&state=invalid_state`,
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Invalid or expired OAuth state");
  });
});
