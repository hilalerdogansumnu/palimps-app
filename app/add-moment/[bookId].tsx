import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator, ScrollView, Image, Pressable, Alert } from "react-native";
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
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const { isPremium } = useSubscription();

  const createMomentMutation = trpc.readingMoments.create.useMutation({
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOcrText(data.ocrText);
      // OCR sonucu gösterildikten sonra geri dön
      setTimeout(() => {
        router.back();
      }, 1500);
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
      Alert.alert(
        t("premiumGate.title"),
        t("premiumGate.premiumRequired"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("premiumGate.upgrade"), onPress: () => router.push("/premium") },
        ]
      );
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
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("addMoment.permissionRequired"), t("addMoment.galleryPermission"));
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPageImage(result.assets[0].base64);
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
      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center mb-6">
          <Pressable
            onPress={() => router.back()}
            className="mr-4 p-2"
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text className="text-primary text-base">{"← " + t("common.back")}</Text>
          </Pressable>
          <Text className="text-2xl font-bold text-foreground">{t("addMoment.title")}</Text>
        </View>

        {/* Sayfa Fotoğrafı */}
        <View className="items-center mb-6">
          <Pressable
            onPress={() => {
              Alert.alert(t("common.selectPhoto"), t("addMoment.selectPhotoSource"), [
                { text: t("addMoment.chooseFromLibrary"), onPress: handlePickImage },
                { text: t("addMoment.takePhoto"), onPress: handleTakePhoto },
                { text: t("common.cancel"), style: "cancel" },
              ]);
            }}
            className="w-full h-96 rounded-xl border-2 border-dashed border-border items-center justify-center bg-surface"
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            {pageImage ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${pageImage}` }}
                className="w-full h-full rounded-xl"
                resizeMode="contain"
              />
            ) : (
              <View className="items-center">
                <Text className="text-6xl text-muted mb-4">📸</Text>
                <Text className="text-base text-foreground font-semibold text-center mb-2">
                  {t("addMoment.pagePhotoTitle")}
                </Text>
                <Text className="text-sm text-muted text-center px-8">
                  {t("addMoment.pagePhotoDesc")}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Not Alanı */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-semibold text-foreground">{t("addMoment.yourNote")}</Text>
            {ocrText && (
              <View className="flex-row items-center px-3 py-1 rounded-full bg-muted/20">
                <Text className="text-xs font-semibold text-muted">
                  {"🕒 " + t("addMoment.aiComingSoon")}
                </Text>
              </View>
            )}
          </View>
          <TextInput
            value={userNote}
            onChangeText={setUserNote}
            placeholder={t("addMoment.notePlaceholder")}
            placeholderTextColor={colors.muted}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            returnKeyType="done"
            editable={!isGeneratingAI}
          />
        </View>

        {/* OCR Bilgisi */}
        <View className="mb-6 bg-surface rounded-xl p-4 border border-border">
          <Text className="text-xs text-muted text-center">
            💡 {t("addMoment.ocrInfo")}
          </Text>
        </View>

        {/* Kaydet Butonu */}
        <Pressable
          onPress={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          className="bg-primary rounded-full py-4 items-center mb-4"
          style={({ pressed }) => [
            {
              opacity: !isFormValid || isSubmitting ? 0.5 : pressed ? 0.9 : 1,
              transform: [{ scale: pressed && isFormValid && !isSubmitting ? 0.97 : 1 }],
            },
          ]}
        >
          {isSubmitting ? (
            <View className="flex-row items-center">
              <ActivityIndicator color={colors.background} size="small" />
              <Text className="text-background font-semibold text-base ml-2">
                {t("addMoment.ocrProcessing")}
              </Text>
            </View>
          ) : (
            <Text className="text-background font-semibold text-base">{t("addMoment.save")}</Text>
          )}
        </Pressable>

        {/* OCR Sonucu (Başarılı kayıt sonrası) */}
        {ocrText && (
          <View className="bg-success/10 rounded-xl p-4 border border-success">
            <Text className="text-sm font-semibold text-success mb-2">{"✓ " + t("addMoment.savedSuccess")}</Text>
            <Text className="text-xs text-muted">{t("addMoment.extractedText")}</Text>
            <Text className="text-sm text-foreground mt-2" numberOfLines={5}>
              {ocrText}
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
