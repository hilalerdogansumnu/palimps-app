import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator, ScrollView, Image, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { a11y } from "@/lib/accessibility";

import { ScreenContainer } from "@/components/screen-container";
import { NavigationBar } from "@/components/navigation-bar";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { storePhoto } from "@/lib/photo-storage";

export default function AddBookScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getPresignedUrlMutation = trpc.upload.getPresignedUrl.useMutation();

  const createBookMutation = trpc.books.create.useMutation({
    onSuccess: (newBook) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/book/${newBook.id}` as any);
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
    });
    if (!result.canceled && result.assets[0].uri) {
      setCoverImageUri(result.assets[0].uri);
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
    });
    if (!result.canceled && result.assets[0].uri) {
      setCoverImageUri(result.assets[0].uri);
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
      let coverImageUrl: string | undefined;

      // Fotoğraf varsa: yerel işle + presigned URL ile S3'e yükle
      if (coverImageUri) {
        try {
          // 1. Yerel olarak işle (resize + compress)
          const stored = await storePhoto(coverImageUri, "cover");

          // 2. Presigned URL al
          const { presignedUrl, key } = await getPresignedUrlMutation.mutateAsync({
            fileName: "cover.jpg",
            fileType: "image/jpeg",
            fileSize: 500_000, // ~500KB tahmini
          });

          // 3. S3'e yükle (fetch PUT)
          const fileContent = await fetch(stored.fullPath);
          const blob = await fileContent.blob();
          await fetch(presignedUrl, {
            method: "PUT",
            body: blob,
            headers: { "Content-Type": "image/jpeg" },
          });

          // 4. Public URL oluştur (key'den)
          const r2PublicBase = process.env.EXPO_PUBLIC_R2_PUBLIC_URL;
          coverImageUrl = r2PublicBase ? `${r2PublicBase}/${key}` : undefined;
        } catch (uploadError) {
          console.warn("[AddBook] Presigned upload failed, skipping cover:", uploadError);
          // Upload başarısız olsa bile kitabı kaydet (kapaksız)
        }
      }

      await createBookMutation.mutateAsync({
        title: title.trim(),
        author: author.trim() || undefined,
        ...(coverImageUrl ? { coverImageUrl } : {}),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = title.trim().length > 0;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <NavigationBar
        title={t("addBook.title")}
        backLabel={t("common.cancel")}
        onBack={() => router.back()}
        rightLabel={isSubmitting ? undefined : t("addBook.save")}
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
        <View className="px-6 py-8">
          {/* Cover Picker */}
          <View className="mb-8 items-center">
            <Pressable
              onPress={() => {
                Alert.alert(
                  t("common.selectPhoto"),
                  t("addBook.selectPhotoSource"),
                  [
                    { text: t("addBook.chooseFromLibrary"), onPress: handlePickImage },
                    { text: t("addBook.takePhoto"), onPress: handleTakePhoto },
                    { text: t("common.cancel"), style: "cancel" },
                  ]
                );
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={a11y.takePhoto.label}
              accessibilityHint={a11y.takePhoto.hint}
            >
              <View
                style={{
                  width: 120,
                  height: 180,
                  borderRadius: 12,
                  borderWidth: coverImageUri ? 0 : 1.5,
                  borderStyle: "dashed",
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {coverImageUri ? (
                  <>
                    <Image
                      source={{ uri: coverImageUri }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={() => {
                        setCoverImageUri(null);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: "rgba(0,0,0,0.55)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="Remove cover photo"
                      accessibilityHint="Clears the selected cover image"
                    >
                      <MaterialIcons name="close" size={14} color="white" />
                    </Pressable>
                  </>
                ) : (
                  <View style={{ alignItems: "center", gap: 8 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 20, color: colors.muted, lineHeight: 24 }}>+</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center" }}>
                      {t("addBook.coverPhoto")}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          </View>

          {/* Title Input */}
          <View className="mb-5">
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {t("addBook.bookTitle")}
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t("addBook.enterTitle")}
              placeholderTextColor={colors.muted}
              accessible={true}
              accessibilityRole="none"
              accessibilityLabel={t("addBook.bookTitle")}
              accessibilityHint="Enter the book title here"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 13,
                fontSize: 16,
                color: colors.foreground,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              returnKeyType="next"
            />
          </View>

          {/* Author Input */}
          <View className="mb-6">
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {t("addBook.author")}
            </Text>
            <TextInput
              value={author}
              onChangeText={setAuthor}
              placeholder={t("addBook.enterAuthor")}
              placeholderTextColor={colors.muted}
              accessible={true}
              accessibilityRole="none"
              accessibilityLabel={t("addBook.author")}
              accessibilityHint="Enter the author name here (optional)"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 13,
                fontSize: 16,
                color: colors.foreground,
                borderWidth: 1,
                borderColor: colors.border,
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
