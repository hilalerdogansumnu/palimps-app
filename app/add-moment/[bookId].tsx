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
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useSubscription } from "@/hooks/use-subscription";

export default function AddMomentScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const bookIdNum = parseInt(bookId, 10);

  const [pageImage, setPageImage] = useState<string | null>(null);
  const [userNote, setUserNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [isOcrComplete, setIsOcrComplete] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const { isPremium } = useSubscription();

  const createMomentMutation = trpc.readingMoments.create.useMutation({
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOcrText(data.ocrText);
      setIsOcrComplete(true);
      router.back();
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        t("addMoment.error"),
        error.message || t("addMoment.createError")
      );
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
        {
          text: t("premiumGate.upgrade"),
          onPress: () => router.push("/premium"),
        },
      ]);
      return;
    }

    setIsGeneratingAI(true);
    try {
      await generateNoteMutation.mutateAsync({ ocrText });
    } catch (error) {
      // Error handled in onError
    }
  };

  const handlePickImage = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        t("addMoment.permissionRequired"),
        t("addMoment.galleryPermission")
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPageImage(result.assets[0].base64);
      setOcrText(null);
      setIsOcrComplete(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        t("addMoment.permissionRequired"),
        t("addMoment.cameraPermission")
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPageImage(result.assets[0].base64);
      setOcrText(null);
      setIsOcrComplete(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSubmit = async () => {
    if (!pageImage) {
      Alert.alert(t("addMoment.warning"), t("addMoment.photoRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createMomentMutation.mutateAsync({
        bookId: bookIdNum,
        pageImageBase64: pageImage,
        userNote: userNote.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = pageImage !== null;

  return (
    <ScreenContainer>
      {/* Header */}
      <View>
        <View className="flex-row items-center justify-between px-6 py-4">
          <Pressable
            onPress={() => router.back()}
            className="p-2"
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text className="text-lg" style={{ color: colors.muted }}>
              ✕
            </Text>
          </Pressable>
          <Text className="text-lg font-semibold text-foreground">
            {t("addMoment.title")}
          </Text>
          <Pressable
            onPress={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            style={({ pressed }) => [
              {
                opacity:
                  !isFormValid || isSubmitting
                    ? 0.5
                    : pressed
                      ? 0.7
                      : 1,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text
                className="font-semibold text-sm"
                style={{
                  color: !isFormValid ? colors.muted : colors.primary,
                }}
              >
                {t("addMoment.save")}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-6">
          {/* Photo Picker */}
          <View className="mb-6">
            <Pressable
              onPress={() => {
                Alert.alert(
                  t("common.selectPhoto"),
                  t("addMoment.selectPhotoSource"),
                  [
                    {
                      text: t("addMoment.chooseFromLibrary"),
                      onPress: handlePickImage,
                    },
                    {
                      text: t("addMoment.takePhoto"),
                      onPress: handleTakePhoto,
                    },
                    { text: t("common.cancel"), style: "cancel" },
                  ]
                );
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View
                className="w-full aspect-[3/2] rounded-2xl border-2 border-dashed items-center justify-center relative"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                {pageImage ? (
                  <>
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${pageImage}` }}
                      className="w-full h-full rounded-2xl"
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={() => {
                        setPageImage(null);
                        setOcrText(null);
                        setIsOcrComplete(false);
                        Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Light
                        );
                      }}
                      className="absolute top-3 right-3 w-6 h-6 rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.foreground + "99" }}
                    >
                      <Text className="text-white text-xs font-bold">✕</Text>
                    </Pressable>
                  </>
                ) : (
                  <View className="items-center">
                    <Text className="text-4xl mb-3">📷</Text>
                    <Text
                      className="text-base font-semibold text-center"
                      style={{ color: colors.muted }}
                    >
                      {t("addMoment.pagePhotoTitle")}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          </View>

          {/* OCR Status */}
          {pageImage && (
            <View className="mb-6 flex-row items-center px-4 py-3 rounded-xl" style={{ backgroundColor: colors.surface }}>
              {isSubmitting ? (
                <>
                  <ActivityIndicator
                    color={colors.muted}
                    size="small"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    className="text-xs"
                    style={{ color: colors.muted }}
                  >
                    {t("addMoment.ocrProcessing")}
                  </Text>
                </>
              ) : isOcrComplete ? (
                <>
                  <Text className="text-base mr-2">✓</Text>
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: colors.primary }}
                  >
                    {t("addMoment.ocrComplete")}
                  </Text>
                </>
              ) : null}
            </View>
          )}

          {/* Note Input */}
          <View className="mb-6">
            <Text
              className="text-xs font-semibold mb-2"
              style={{ color: colors.muted }}
            >
              {t("addMoment.yourNote")}
            </Text>
            <TextInput
              value={userNote}
              onChangeText={setUserNote}
              placeholder={t("addMoment.notePlaceholder")}
              placeholderTextColor={colors.muted}
              className="rounded-2xl px-4 py-3 text-base"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.foreground,
                height: 100,
              }}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              returnKeyType="done"
              editable={!isGeneratingAI}
            />
          </View>

          {/* AI Note Button */}
          {pageImage && isOcrComplete && (
            <Pressable
              onPress={handleGenerateAINote}
              disabled={isGeneratingAI}
              className="mb-6 rounded-2xl py-3 items-center"
              style={({ pressed }) => [
                {
                  backgroundColor:
                    colors.accent + "26",
                  opacity: isGeneratingAI
                    ? 0.5
                    : pressed
                      ? 0.7
                      : 1,
                },
              ]}
            >
              {isGeneratingAI ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Text
                  className="font-semibold text-sm"
                  style={{ color: colors.accent }}
                >
                  {t("addMoment.aiGenerateNote")}
                </Text>
              )}
            </Pressable>
          )}

          {/* OCR Info */}
          <View>
            <Text
              className="text-xs text-center"
              style={{ color: colors.muted }}
            >
              💡 {t("addMoment.ocrInfo")}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
