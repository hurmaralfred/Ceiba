"use client";

// Deep-link redirect used by Capacitor native builds for OAuth.
// Must be registered in Supabase Dashboard → Auth → URL Configuration → Redirect URLs.
export const CAPACITOR_OAUTH_REDIRECT = "ceiba://auth/callback";

export function isCapacitor(): boolean {
  return typeof window !== "undefined" && typeof (window as any).Capacitor !== "undefined";
}

/**
 * Opens Google OAuth in an external SFSafariViewController (iOS) or
 * Chrome Custom Tab (Android), then resolves when the deep link returns
 * a Supabase auth code. Returns the code so the caller can exchange it.
 *
 * Requires @capacitor/browser and @capacitor/app installed.
 */
export async function signInWithGoogleCapacitor(authUrl: string): Promise<string> {
  const { Browser } = await import("@capacitor/browser");
  const { App } = await import("@capacitor/app");

  await Browser.open({ url: authUrl, windowName: "_self" });

  return new Promise((resolve, reject) => {
    const listener = App.addListener("appUrlOpen", async (event: { url: string }) => {
      if (!event.url.startsWith("ceiba://auth/callback")) return;
      (await listener).remove();
      await Browser.close();

      const url = new URL(event.url.replace("ceiba://", "https://placeholder/"));
      const code = url.searchParams.get("code");
      if (code) {
        resolve(code);
      } else {
        reject(new Error("No auth code returned in deep link"));
      }
    });

    // Safety timeout — if the user cancels the browser
    setTimeout(async () => {
      (await listener).remove();
      reject(new Error("OAuth timeout"));
    }, 5 * 60 * 1000);
  });
}
