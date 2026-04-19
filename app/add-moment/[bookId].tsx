import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

import { ScreenContainer } from "@/components/screen-container";
import { NavigationBar } from "@/components/navigation-bar";
import { CropModal } from "@/components/crop-modal";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useSubscription } from "@/hooks/use-subscription";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { storePhoto } from "@/lib/photo-storage";
import { captureException } from "@/lib/_core/sentry";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIF_STREAK_ALERT = "palimps_streak_alert";

/**
 * Schedule a streak alert 22 hours from now.
 * Cancels any existing streak alert first (reset on each new moment).
 */
async function scheduleStreakAlert(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const stored = await AsyncStorage.getItem("notification_settings");
    const settings = stored ? JSON.parse(stored) : { streakAlert: true };
    if (!settings.streakAlert) return;

    // Cancel previous streak alert
    await Notifications.cancelScheduledNotificationAsync(NOTIF_STREAK_ALERT).catch(() => {});

    // Schedule 22 hours from now
    const trigger = new Date(Date.now() + 22 * 60 * 60 * 1000);
    // Use i18n.t() (not the hook) so this function stays usable outside
    // React render context. Locale is whatever the user has active when
    // the moment is saved — push copy matches UI language.
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_STREAK_ALERT,
      content: {
        title: i18n.t("notifications.streakPushTitle"),
        body: i18n.t("notifications.streakPushBody"),
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });
  } catch {
    // Non-critical, ignore
  }
}

export default function AddMomentScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const bookIdNum = parseInt(bookId, 10);

  const [pageImageUri, setPageImageUri] = useState<string | null>(null);
  // Raw URI from picker/camera, awaiting user-driven crop. When non-null,
  // CropModal is visible; onDone → setPageImageUri, onCancel → clear.
  const [pendingCropUri, setPendingCropUri] = useState<string | null>(null);
  const [userNote, setUserNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [isOcrComplete, setIsOcrComplete] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const { isPremium } = useSubscription();

  const getPresignedUrlMutation = trpc.upload.getPresignedUrl.useMutation();

  const createMomentMutation = trpc.readingMoments.create.useMutation({
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOcrText(data.ocrText);
      setIsOcrComplete(true);
      // Streak alert: schedule a reminder 22 hours from now if user has streak alerts enabled
      scheduleStreakAlert();
      router.back();
    },
    // onError intentionally omitted: handleSubmit's try/catch routes failures
    // through handleUploadError, which decides alert copy + Sentry context +
    // retry. Having a local Alert here would double-fire on upload errors.
  });

  const generateNoteMutation = trpc.ai.generateNote.useMutation({
    onSuccess: (data) => {
      setUserNote(data.note);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsGeneratingAI(false);
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("addMoment.error"), error.message || t("common.error"));
      setIsGeneratingAI(false);
    },
  });

  const handleGenerateAINote = async () => {
    if (!ocrText) {
      Alert.alert(t("addMoment.warning"), t("addMoment.ocrFirst"));
      return;
    }
    if (!isPremium) {
      Alert.alert(t("premiumGate.title"), t("premiumGate.premiumRequired"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("premiumGate.upgrade"), onPress: () => router.push("/premium") },
      ]);
      return;
    }
    setIsGeneratingAI(true);
    try {
      await generateNoteMutation.mutateAsync({ ocrText });
    } catch {
      // handled in onError
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("addMoment.permissionRequired"), t("addMoment.galleryPermission"));
      return;
    }
    // NOT using ImagePicker'ın `allowsEditing: true` çünkü iOS 1:1 square'e
    // kilitli; kitap sayfasında kenarda kalan masa/parmak/komşu sayfa OCR
    // metnine sızıyor. Onun yerine kendi CropModal'ımızı kullanıyoruz.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0].uri) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPendingCropUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("addMoment.permissionRequired"), t("addMoment.cameraPermission"));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0].uri) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPendingCropUri(result.assets[0].uri);
    }
  };

  // Called by CropModal once the user confirms the crop. The cropped URI is
  // a JPEG on the local filesystem; we treat it exactly like a picker result.
  const handleCropDone = (croppedUri: string) => {
    setPageImageUri(croppedUri);
    setPendingCropUri(null);
    setOcrText(null);
    setIsOcrComplete(false);
  };

  const handleCropCancel = () => {
    // Keep any previously-selected page photo intact; just discard the raw
    // uncropped URI so the modal closes.
    setPendingCropUri(null);
  };

  // Upload timeout: long enough for a large photo on a slow 4G link, short
  // enough that the user doesn't stare at a silent spinner forever. The
  // observability SKILL's "no silent failures" rule drives the 30s cap — past
  // this point we explicitly tell the user rather than waiting.
  const UPLOAD_TIMEOUT_MS = 30_000;

  /**
   * Categorised upload-error alert with Sentry context + Retry CTA.
   * P0-3 fix: the previous implementation surfaced a single generic
   * "Fotoğraf yüklenemedi. Lütfen tekrar dene." for every failure mode — no
   * Sentry event, no retry affordance, no distinction between network /
   * server / config. See AMND-2026-001 L1: silent failures are how users
   * lose trust.
   */
  const handleUploadError = (error: unknown, phase: string) => {
    const err = error instanceof Error ? error : new Error(String(error));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    // tRPC rate-limit hataları Error.message = "RATE_LIMIT_EXCEEDED" taşır
    // ve (error as any).data.code === "TOO_MANY_REQUESTS" olur. Bu mesaj
    // retry'a anlam yüklemez — "yarın tekrar dene" + cancel sunalım.
    const trpcCode = (error as any)?.data?.code as string | undefined;
    const isRateLimit =
      trpcCode === "TOO_MANY_REQUESTS" || err.message === "RATE_LIMIT_EXCEEDED";

    let messageKey = "errors.photoUploadFailed";
    if (isRateLimit) messageKey = "errors.rateLimitOcr";
    else if (err.message === "UPLOAD_TIMEOUT") messageKey = "errors.uploadTimeout";
    else if (err.message === "NETWORK_ERROR") messageKey = "errors.networkError";
    else if (err.message.startsWith("UPLOAD_HTTP_4")) messageKey = "errors.uploadBadRequest";
    else if (err.message.startsWith("UPLOAD_HTTP_5")) messageKey = "errors.serverError";
    else if (err.message === "PRESIGN_FAILED") messageKey = "errors.serverError";

    captureException(err, {
      operation: "addMoment.handleSubmit",
      bookId: bookIdNum,
      phase,
      isRateLimit: String(isRateLimit),
    });

    Alert.alert(
      t("common.error"),
      t(messageKey),
      isRateLimit
        ? [{ text: t("common.cancel"), style: "cancel" }]
        : [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("errors.retry"), onPress: handleSubmit },
          ],
    );
  };

  const handleSubmit = async () => {
    if (!pageImageUri) {
      Alert.alert(t("addMoment.warning"), t("addMoment.photoRequired"));
      return;
    }
    setIsSubmitting(true);
    let phase: string = "init";
    try {
      // 1. Yerel olarak işle (resize + compress)
      phase = "storePhoto";
      const stored = await storePhoto(pageImageUri, "page");

      // 2. Presigned URL al
      phase = "presign";
      let presigned: { presignedUrl: string; key: string; publicUrl: string };
      try {
        presigned = await getPresignedUrlMutation.mutateAsync({
          fileName: "page.jpg",
          fileType: "image/jpeg",
          fileSize: 800_000,
        });
      } catch (err) {
        // Preserve the underlying message for Sentry, but tag the phase so
        // handleUploadError can pick the right user-facing copy.
        const e = new Error("PRESIGN_FAILED");
        (e as any).cause = err;
        throw e;
      }
      const { presignedUrl, publicUrl: uploadedPageImageUrl } = presigned;

      // 3. R2'ye yükle — FileSystem.uploadAsync (native binary PUT) + 30s
      // timeout Promise.race ile.
      //
      // Daha önce `fetch(fileUri).blob()` + `fetch(PUT)` zinciri kullanıyorduk;
      // iOS new arch'ta blob plugin 0-byte body dönebiliyor, R2 de boş objeyi
      // 200 ile kabul edip saklıyordu — kapak "uploaded" ama render
      // edilemiyordu. uploadAsync dosyayı native tarafta okur, bu kusuru
      // tamamen atlıyor. Timeout için AbortController yok (uploadAsync
      // desteklemiyor); Promise.race yeterli — race kaybolursa underlying
      // upload arka planda ölür, kullanıcı error görür.
      phase = "r2Put";
      let uploadRes: FileSystem.FileSystemUploadResult;
      try {
        const uploadPromise = FileSystem.uploadAsync(presignedUrl, stored.fullPath, {
          httpMethod: "PUT",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { "Content-Type": "image/jpeg" },
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("UPLOAD_TIMEOUT")), UPLOAD_TIMEOUT_MS),
        );
        uploadRes = await Promise.race([uploadPromise, timeoutPromise]);
      } catch (err) {
        if (err instanceof Error && err.message === "UPLOAD_TIMEOUT") throw err;
        // Any other uploadAsync throw is a network failure (DNS, offline, TLS).
        const e = new Error("NETWORK_ERROR");
        (e as any).cause = err;
        throw e;
      }
      if (uploadRes.status < 200 || uploadRes.status >= 300) {
        throw new Error(`UPLOAD_HTTP_${uploadRes.status}`);
      }

      // 4. Create moment (server-side OCR runs inside this mutation)
      phase = "createMoment";
      await createMomentMutation.mutateAsync({
        bookId: bookIdNum,
        pageImageUrl: uploadedPageImageUrl,
        userNote: userNote.trim() || undefined,
      });
    } catch (error) {
      handleUploadError(error, phase);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = pageImageUri !== null;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <NavigationBar
        title={t("addMoment.title")}
        backLabel={t("common.cancel")}
        onBack={() => router.back()}
        rightLabel={isSubmitting ? undefined : t("addMoment.save")}
        rightDisabled={!isFormValid || isSubmitting}
        onRight={handleSubmit}
        rightNode={
          isSubmitting ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : undefined
        }
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="px-6 py-6">
          {/* Photo Picker */}
          <View className="mb-6">
            <Pressable
              onPress={() => {
                Alert.alert(
                  t("common.selectPhoto"),
                  t("addMoment.selectPhotoSource"),
                  [
                    { text: t("addMoment.chooseFromLibrary"), onPress: handlePickImage },
                    { text: t("addMoment.takePhoto"), onPress: handleTakePhoto },
                    { text: t("common.cancel"), style: "cancel" },
                  ]
                );
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View
                style={{
                  width: "100%",
                  aspectRatio: 3 / 2,
                  borderRadius: 16,
                  borderWidth: pageImageUri ? 0 : 1.5,
                  borderStyle: "dashed",
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {pageImageUri ? (
                  <>
                    <Image
                      source={{ uri: pageImageUri }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={() => {
                        setPageImageUri(null);
                        setOcrText(null);
                        setIsOcrComplete(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: "rgba(0,0,0,0.55)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons name="close" size={14} color="white" />
                    </Pressable>
                  </>
                ) : (
                  <View style={{ alignItems: "center", gap: 10 }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons name="photo-camera" size={24} color={colors.muted} />
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: "500", color: colors.muted }}>
                      {t("addMoment.pagePhotoTitle")}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center", paddingHorizontal: 24 }}>
                      {t("addMoment.pagePhotoDesc")}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          </View>

          {/* OCR Status */}
          {pageImageUri && isSubmitting && (
            <View
              style={{
                marginBottom: 16,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: colors.surface,
              }}
            >
              <ActivityIndicator color={colors.muted} size="small" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 13, color: colors.muted }}>{t("addMoment.ocrProcessing")}</Text>
            </View>
          )}

          {/* Note Input */}
          <View className="mb-5">
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {t("addMoment.yourNote")}
            </Text>
            <TextInput
              value={userNote}
              onChangeText={setUserNote}
              placeholder={t("addMoment.notePlaceholder")}
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 13,
                fontSize: 16,
                color: colors.foreground,
                borderWidth: 1,
                borderColor: colors.border,
                minHeight: 100,
                textAlignVertical: "top",
              }}
              multiline
              numberOfLines={4}
              editable={!isGeneratingAI}
            />
          </View>

          {/* AI Note Button */}
          {pageImageUri && isOcrComplete && (
            <Pressable
              onPress={handleGenerateAINote}
              disabled={isGeneratingAI}
              style={({ pressed }) => [
                {
                  marginBottom: 20,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  backgroundColor: colors.primary + "18",
                  opacity: isGeneratingAI ? 0.5 : pressed ? 0.7 : 1,
                },
              ]}
            >
              {isGeneratingAI ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.primary }}>
                  {t("addMoment.aiGenerateNote")}
                </Text>
              )}
            </Pressable>
          )}

          {/* OCR Info hint */}
          <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", lineHeight: 18 }}>
            {t("addMoment.ocrInfo")}
          </Text>
        </View>
      </ScrollView>

      {/* In-app crop step — shown between picker and OCR. */}
      <CropModal
        uri={pendingCropUri}
        onDone={handleCropDone}
        onCancel={handleCropCancel}
      />
    </ScreenContainer>
  );
}
