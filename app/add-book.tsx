import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator, ScrollView, Image, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export default function AddBookScreen() {
  const colors = useColors();
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
      Alert.alert("Hata", error.message || "Kitap eklenirken bir hata oluştu.");
    },
  });

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("İzin Gerekli", "Fotoğraf seçmek için galeri erişim izni gereklidir.");
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
      Alert.alert("İzin Gerekli", "Fotoğraf çekmek için kamera erişim izni gereklidir.");
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
      Alert.alert("Uyarı", "Kitap adı boş olamaz.");
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
      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center mb-6">
          <Pressable
            onPress={() => router.back()}
            className="mr-4 p-2"
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text className="text-primary text-base">← Geri</Text>
          </Pressable>
          <Text className="text-2xl font-bold text-foreground">Yeni Kitap Ekle</Text>
        </View>

        {/* Kapak Fotoğrafı */}
        <View className="items-center mb-6">
          <Pressable
            onPress={() => {
              Alert.alert("Fotoğraf Seç", "Kapak fotoğrafını nereden seçmek istersiniz?", [
                { text: "Galeri", onPress: handlePickImage },
                { text: "Kamera", onPress: handleTakePhoto },
                { text: "İptal", style: "cancel" },
              ]);
            }}
            className="w-40 h-56 rounded-xl border-2 border-dashed border-border items-center justify-center bg-surface"
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            {coverImage ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${coverImage}` }}
                className="w-full h-full rounded-xl"
                resizeMode="cover"
              />
            ) : (
              <View className="items-center">
                <Text className="text-4xl text-muted mb-2">📷</Text>
                <Text className="text-sm text-muted text-center">Kapak Fotoğrafı</Text>
                <Text className="text-xs text-muted text-center">(Opsiyonel)</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Kitap Adı */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2">Kitap Adı *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Kitap adını girin"
            placeholderTextColor={colors.muted}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
            returnKeyType="next"
          />
        </View>

        {/* Yazar Adı */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-foreground mb-2">Yazar Adı</Text>
          <TextInput
            value={author}
            onChangeText={setAuthor}
            placeholder="Yazar adını girin (opsiyonel)"
            placeholderTextColor={colors.muted}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </View>

        {/* Kaydet Butonu */}
        <Pressable
          onPress={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          className="bg-primary rounded-full py-4 items-center"
          style={({ pressed }) => [
            {
              opacity: !isFormValid || isSubmitting ? 0.5 : pressed ? 0.9 : 1,
              transform: [{ scale: pressed && isFormValid && !isSubmitting ? 0.97 : 1 }],
            },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text className="text-background font-semibold text-base">Kaydet</Text>
          )}
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
