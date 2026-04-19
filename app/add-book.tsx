import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator, ScrollView, Image, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { useTranslation } from "react-i18next";
import { a11y } from "@/lib/accessibility";

import { ScreenContainer } from "@/components/screen-container";
import { NavigationBar } from "@/components/navigation-bar";
import { CropModal } from "@/components/crop-modal";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { storePhoto } from "@/lib/photo-storage";
import { captureException } from "@/lib/_core/sentry";

export default function AddBookScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Picker → CropModal → coverImageUri. Kullanıcı picker'dan seçtiği ham
  // fotoğrafı önce CropModal'da istediği gibi kırpıyor. iOS ImagePicker'ın
  // `allowsEditing` seçimi 1:1 square'e kilitli ve kitap kapağı için kötü;
  // CropModal freeform ve dikey kapaklara çok daha iyi uyuyor. (50319: user feedback)
  const [rawPickedUri, setRawPickedUri] = useState<string | null>(null);

  const getPresignedUrlMutation = trpc.upload.getPresignedUrl.useMutation();

  // onSuccess/onError moved to handleSubmit so we can sequence the
  // "cover didn't upload" warning BEFORE navigating — otherwise the alert
  // would pop up on the book detail screen, which is disorienting.
  const createBookMutation = trpc.books.create.useMutation();

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("addBook.permissionRequired"), t("addBook.galleryPermission"));
      return;
    }
    // allowsEditing YOK — CropModal kullanıyoruz (aspect: [2,3] de kaldırıldı,
    // freeform crop kullanıcıya daha çok kontrol veriyor).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0].uri) {
      setRawPickedUri(result.assets[0].uri);
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
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0].uri) {
      setRawPickedUri(result.assets[0].uri);
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
      let coverUploadFailed = false;

      // Fotoğraf varsa: yerel işle + presigned URL ile S3'e yükle
      if (coverImageUri) {
        try {
          // 1. Yerel olarak işle (resize + compress)
          const stored = await storePhoto(coverImageUri, "cover");

          // 2. Presigned URL al — sunucu uploadedPublicUrl'i de dönüyor
          const { presignedUrl, publicUrl } = await getPresignedUrlMutation.mutateAsync({
            fileName: "cover.jpg",
            fileType: "image/jpeg",
            fileSize: 500_000, // ~500KB tahmini
          });

          // 3. S3'e yükle — FileSystem.uploadAsync (native binary PUT).
          //
          // `fetch(file://...)` + `.blob()` + `fetch(PUT)` zinciri iOS + new
          // arch üzerinde 0-byte blob dönebiliyor (RN blob plugin + Hermes
          // etkileşimi). Uzak ucu 200 döner ama objeye boş body yazar; kapak
          // "uploaded" ama render edilemez. uploadAsync dosyayı native tarafta
          // okur, aynı cehennemden geçmez.
          const uploadRes = await FileSystem.uploadAsync(presignedUrl, stored.fullPath, {
            httpMethod: "PUT",
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: { "Content-Type": "image/jpeg" },
          });
          if (uploadRes.status < 200 || uploadRes.status >= 300) {
            throw new Error(`UPLOAD_HTTP_${uploadRes.status}`);
          }

          // 4. Sunucunun verdiği public URL'i kullan (istemci artık R2 base'i bilmiyor)
          coverImageUrl = publicUrl;
        } catch (uploadError) {
          // Kapak upload fail oldu: kullanıcıya söyleyeceğiz ama kitabı yine kaydedeceğiz.
          // Sessizce yutmayalım — Sentry'e logla ki upload regression'ı tespit edebilelim.
          coverUploadFailed = true;
          captureException(
            uploadError instanceof Error ? uploadError : new Error(String(uploadError)),
            { operation: "addBook.coverUpload", hasUri: String(!!coverImageUri) },
          );
        }
      }

      let newBook;
      try {
        newBook = await createBookMutation.mutateAsync({
          title: title.trim(),
          author: author.trim() || undefined,
          ...(coverImageUrl ? { coverImageUrl } : {}),
        });
      } catch (createError: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t("addBook.error"), createError?.message || t("addBook.createError"));
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate now — eğer kapak yüklenemediyse uyarıyı navigasyondan sonra
      // detay sayfasında göster. Bu sayede kullanıcı kitabını görür + sorunu fark eder.
      router.replace(`/book/${newBook.id}` as any);

      if (coverUploadFailed) {
        // Biraz bekleyerek alert'i stack'e koy — Expo Router transition ile çakışmasın.
        setTimeout(() => {
          Alert.alert(
            t("addBook.coverUploadFailedTitle"),
            t("addBook.coverUploadFailedMessage"),
          );
        }, 400);
      }
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

      {/* Crop modal — rawPickedUri varsa aç; kullanıcı kırpınca kapak olarak
          set et, iptal ederse ham uri'yi temizle. */}
      <CropModal
        uri={rawPickedUri}
        onDone={(croppedUri) => {
          setCoverImageUri(croppedUri);
          setRawPickedUri(null);
        }}
        onCancel={() => setRawPickedUri(null)}
      />
    </ScreenContainer>
  );
}
