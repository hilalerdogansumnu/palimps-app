import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, Pressable } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

type BookWithCount = {
  id: number;
  title: string;
  author: string | null;
  coverImageUrl: string | null;
  momentCount: number;
  createdAt: Date;
};

export default function HomeScreen() {
  const colors = useColors();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { data: books, isLoading, refetch } = trpc.books.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const handleAddBook = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/add-book");
  };

  const handleBookPress = (bookId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/book/${bookId}` as any);
  };

  if (authLoading || isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-2xl font-bold text-foreground mb-4">Okuma Hafızası</Text>
        <Text className="text-base text-muted text-center mb-6">
          Kitaplarınızı ve okuma anılarınızı kaydetmek için giriş yapın.
        </Text>
        <Pressable
          onPress={() => router.push("/login" as any)}
          className="bg-primary px-8 py-4 rounded-full"
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <Text className="text-background font-semibold text-base">Giriş Yap</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  if (!books || books.length === 0) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-3xl font-bold text-foreground">Kitaplarım</Text>
          <Pressable
            onPress={handleAddBook}
            className="bg-primary w-12 h-12 rounded-full items-center justify-center"
            style={({ pressed }) => [
              { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text className="text-background text-2xl font-bold">+</Text>
          </Pressable>
        </View>

        <View className="flex-1 items-center justify-center">
          <Text className="text-xl font-semibold text-foreground mb-3 text-center">
            Henüz kitap eklemediniz
          </Text>
          <Text className="text-base text-muted text-center mb-6">
            İlk kitabınızı ekleyerek okuma hafızanızı oluşturmaya başlayın.
          </Text>
          <Pressable
            onPress={handleAddBook}
            className="bg-primary px-8 py-4 rounded-full"
            style={({ pressed }) => [
              { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text className="text-background font-semibold text-base">Kitap Ekle</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <View className="flex-row items-center justify-between mb-6">
        <Text className="text-3xl font-bold text-foreground">Kitaplarım</Text>
        <Pressable
          onPress={handleAddBook}
          className="bg-primary w-12 h-12 rounded-full items-center justify-center"
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text className="text-background text-2xl font-bold">+</Text>
        </Pressable>
      </View>

      <FlatList
        data={books}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleBookPress(item.id)}
            className="bg-surface rounded-2xl p-4 mb-4 border border-border"
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <View className="flex-row">
              {item.coverImageUrl ? (
                <Image
                  source={{ uri: item.coverImageUrl }}
                  className="w-20 h-28 rounded-lg mr-4"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-20 h-28 rounded-lg mr-4 bg-border items-center justify-center">
                  <IconSymbol name="house.fill" size={32} color={colors.muted} />
                </View>
              )}

              <View className="flex-1 justify-center">
                <Text className="text-lg font-semibold text-foreground mb-1" numberOfLines={2}>
                  {item.title}
                </Text>
                {item.author && (
                  <Text className="text-sm text-muted mb-2" numberOfLines={1}>
                    {item.author}
                  </Text>
                )}
                <Text className="text-xs text-muted">
                  {item.momentCount} okuma anı
                </Text>
              </View>

              <View className="justify-center">
                <IconSymbol name="chevron.right" size={20} color={colors.muted} />
              </View>
            </View>
          </Pressable>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}
