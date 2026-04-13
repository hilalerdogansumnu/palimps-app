import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator, ScrollView, Image, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export default function AddBookScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createBookMutation = trpc.books.create.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("addBook.error"), error.message || t("addBook.createError"));
    },
  });

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("addBook.permissionRequired"), t("addBook.galleryPermission"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setCoverImage(result.assets[0].base64);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("addBook.permissionRequired"), t("addBook.cameraPermission"));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setCoverImage(result.assets[0].base64);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert(t("addBook.warning"), t("addBook.titleEmpty"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createBookMutation.mutateAsync({
        title: title.trim(),
        author: author.trim() || undefined,
        coverImageBase64: coverImage || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = title.trim().length > 0;

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
            {t("addBook.title")}
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
              <ActivityIndicator
                color={colors.primary}
                size="small"
              />
            ) : (
              <Text
                className="font-semibold text-sm"
                style={{
                  color: !isFormValid ? colors.muted : colors.primary,
                }}
              >
                {t("addBook.save")}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-8">
          {/* Cover Picker */}
          <View className="mb-8">
            <Pressable
              onPress={() => {
                Alert.alert(
                  t("common.selectPhoto"),
                  t("addBook.selectPhotoSource"),
                  [
                    {
                      text: t("addBook.chooseFromLibrary"),
                      onPress: handlePickImage,
                    },
                    {
                      text: t("addBook.takePhoto"),
                      onPress: handleTakePhoto,
                    },
                    { text: t("common.cancel"), style: "cancel" },
                  ]
                );
              }}
              className="items-center w-full"
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View
                className="w-32 h-48 rounded-2xl border-2 border-dashed items-center justify-center relative"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                {coverImage ? (
                  <>
                    <Image
                      source={{
                        uri: `data:image/jpeg;base64,${coverImage}`,
                      }}
                      className="w-full h-full rounded-2xl"
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={() => {
                        setCoverImage(null);
                        Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Light
                        );
                      }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.foreground + "99" }}
                    >
                      <Text className="text-white text-xs font-bold">✕</Text>
                    </Pressable>
                  </>
                ) : (
                  <View className="items-center">
                    <Text className="text-3xl mb-2">📖</Text>
                    <Text
                      className="text-xs text-center"
                      style={{ color: colors.muted }}
                    >
                      {t("addBook.coverPhoto")}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          </View>

          {/* Title Input */}
          <View className="mb-6">
            <Text
              className="text-xs font-semibold mb-2"
              style={{ color: colors.muted }}
            >
              {t("addBook.bookTitle")}
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t("addBook.enterTitle")}
              placeholderTextColor={colors.muted}
              className="rounded-2xl px-4 py-3 text-base"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.foreground,
              }}
              returnKeyType="next"
            />
          </View>

          {/* Author Input */}
          <View className="mb-6">
            <Text
              className="text-xs font-semibold mb-2"
              style={{ color: colors.muted }}
            >
              {t("addBook.author")}
            </Text>
            <TextInput
              value={author}
              onChangeText={setAuthor}
              placeholder={t("addBook.enterAuthor")}
              placeholderTextColor={colors.muted}
              className="rounded-2xl px-4 py-3 text-base"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.foreground,
              }}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
