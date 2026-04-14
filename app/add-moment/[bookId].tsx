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
import { useTranslation } from "react-i18next";

import { ScreenContainer } from "@/components/screen-container";
import { NavigationBar } from "@/components/navigation-bar";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useSubscription } from "@/hooks/use-subscription";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { storePhoto } from "@/lib/photo-storage";
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
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_STREAK_ALERT,
      content: {
        title: "Serin kırmak üzeresin",
        body: "Bugün henüz bir an kaydetmedin. Serinini koru.",
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
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("addMoment.error"), error.message || t("addMoment.createError"));
    },
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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0].uri) {
      const photoUri = result.assets[0].uri;
      setPageImageUri(photoUri);
      setOcrText(null);
      setIsOcrComplete(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/ocr-edit",
        params: { photoUri, bookId, ocrText: "" },
      } as any);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("addMoment.permissionRequired"), t("addMoment.cameraPermission"));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0].uri) {
      const photoUri = result.assets[0].uri;
      setPageImageUri(photoUri);
      setOcrText(null);
      setIsOcrComplete(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/ocr-edit",
        params: { photoUri, bookId, ocrText: "" },
      } as any);
    }
  };

  const handleSubmit = async () => {
    if (!pageImageUri) {
      Alert.alert(t("addMoment.warning"), t("addMoment.photoRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      // 1. Yerel olarak işle (resize + compress)
      const stored = await storePhoto(pageImageUri, "page");

      // 2. Presigned URL al
      const { presignedUrl, key } = await getPresignedUrlMutation.mutateAsync({
        fileName: "page.jpg",
        fileType: "image/jpeg",
        fileSize: 800_000,
      });

      // 3. R2'ye yükle
      const fileContent = await fetch(stored.fullPath);
      const blob = await fileContent.blob();
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/jpeg" },
      });
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const r2PublicBase = process.env.EXPO_PUBLIC_R2_PUBLIC_URL;
      if (!r2PublicBase) {
        throw new Error("R2 public URL not configured");
      }
      const uploadedPageImageUrl = `${r2PublicBase}/${key}`;

      await createMomentMutation.mutateAsync({
        bookId: bookIdNum,
        pageImageUrl: uploadedPageImageUrl,
        userNote: userNote.trim() || undefined,
      });
    } catch (error) {
      // Surface upload failures rather than silently falling back to base64.
      // Sentry catches the unhandled rejection; user gets a warm retry prompt.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("common.error"), t("errors.photoUploadFailed"));
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
    </ScreenContainer>
  );
}
