// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

// Bundle ID format: space.manus.<project_name_dots>.<timestamp>
// e.g., "my-app" created at 2024-01-15 10:30:45 -> "space.manus.my.app.t20240115103045"
// Bundle ID can only contain letters, numbers, and dots
// Android requires each dot-separated segment to start with a letter
const rawBundleId = "space.manus.okuma.hafizasi.mvp.t20260130232125";
const bundleId =
  rawBundleId
    .replace(/[-_]/g, ".") // Replace hyphens/underscores with dots
    .replace(/[^a-zA-Z0-9.]/g, "") // Remove invalid chars
    .replace(/\.+/g, ".") // Collapse consecutive dots
    .replace(/^\.+|\.+$/g, "") // Trim leading/trailing dots
    .toLowerCase()
    .split(".")
    .map((segment) => {
      // Android requires each segment to start with a letter
      // Prefix with 'x' if segment starts with a digit
      return /^[a-zA-Z]/.test(segment) ? segment : "x" + segment;
    })
    .join(".") || "space.manus.app";
// Extract timestamp from bundle ID and prefix with "manus" for deep link scheme
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: "PALIMPS",
  // appSlug: EAS projectId (f64f8212-7a0a-47f9-bb64-b2d4d6870ccd) expo.dev
  // dashboard'da "okuma-hafizasi-mvp" slug'ı ile bağlı. Local slug dashboard
  // ile EŞLEŞMELİ yoksa eas build "slug mismatch" ile erken exit eder.
  // v1.0.1 post-launch: önce expo.dev UI → Project Settings → Rename → palimps,
  // SONRA bu satırı "palimps" yap. Şimdi ship blocker'ı değil.
  appSlug: "okuma-hafizasi-mvp",
  // logoUrl: manus dönemi artifact. Code yolunda kullanılmıyor (asset
  // `./assets/images/icon.png` üzerinden geliyor). v1.0.1 cleanup'ta
  // env objesinden çıkarılabilir.
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  extra: {
    eas: {
      projectId: "f64f8212-7a0a-47f9-bb64-b2d4d6870ccd"
    }
  },
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    // iPad desteği kapatıldı — 50333 öncesi 1.0 submission Apple tarafında
    // Guideline 2.1 ile reject yedi: "we are unable to sign in using Sign in
    // with Apple" review device "iPad Air (5th gen) / iPadOS 26.2". iPad'de
    // Apple Sign In düzgün render olmuyor (provisioning profile veya layout
    // bug, iPhone'da çalışıyor). v1.0 için iPad-only listing kapatıldı —
    // kullanıcılar iPad'e iPhone modunda yine yükleyebilir, zoom edilir.
    // v1.1+'da proper iPad layout + Apple Sign In iPad fix ile açılacak.
    supportsTablet: false,
    bundleIdentifier: env.iosBundleId,
    buildNumber: "50336",
    usesAppleSignIn: true,
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeUserID",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhotosorVideos",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherUserContent",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
      ],
      NSPrivacyAccessedAPITypes: [
        {
          // AsyncStorage / auth token storage uses UserDefaults under the hood
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          // expo-file-system reads/writes file metadata for local photo caching
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1"],
        },
        {
          // expo-file-system checks disk space before saving photos
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1"],
        },
        {
          // System boot time used by tRPC/React Query for in-memory cache TTLs
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
      ],
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        "PALIMPS uses your camera to photograph book pages you want to remember. Photos are processed on-device for OCR and stored securely in your personal reading library.",
      NSPhotoLibraryUsageDescription:
        "PALIMPS needs access to your photo library so you can add existing book page photos or cover images to your reading memories.",
      NSPhotoLibraryAddUsageDescription:
        "PALIMPS can save exported reading notes to your photo library.",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#F8F6FF",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-asset",
    "expo-font",
    "expo-apple-authentication",
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        // Matches app icon gradient base (#7A5EE5 → #5C3BCC). Picking the
        // primary violet #6B4CDB keeps launch → icon tap → splash → app a
        // single tonal beat (Supercell-style continuous launch).
        backgroundColor: "#6B4CDB",
        dark: {
          // Deep violet (same hue family) for dark appearance.
          backgroundColor: "#4A2C9E",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
