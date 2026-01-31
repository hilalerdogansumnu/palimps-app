import { View, Text, FlatList, ActivityIndicator, Image, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function BookDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = parseInt(id, 10);

  const { data: book, isLoading: bookLoading } = trpc.books.getById.useQuery({ id: bookId });
  const { data: moments, isLoading: momentsLoading, refetch } = trpc.readingMoments.listByBook.useQuery(
    { bookId },
  );

  const handleAddMoment = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/add-moment/${bookId}` as any);
  };

  const handleMomentPress = (momentId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/moment/${momentId}` as any);
  };

  if (bookLoading || momentsLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!book) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-xl font-semibold text-foreground mb-3">Kitap bulunamadı</Text>
        <Pressable
          onPress={() => router.back()}
          className="bg-primary px-6 py-3 rounded-full"
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text className="text-background font-semibold">Geri Dön</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="p-6 pb-4 border-b border-border">
        <Pressable
          onPress={() => router.back()}
          className="mb-4 p-2 self-start"
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <Text className="text-primary text-base">← Geri</Text>
        </Pressable>

        <View className="flex-row">
          {book.coverImageUrl ? (
            <Image
              source={{ uri: book.coverImageUrl }}
              className="w-16 h-24 rounded-lg mr-4"
              resizeMode="cover"
            />
          ) : (
            <View className="w-16 h-24 rounded-lg mr-4 bg-border items-center justify-center">
              <IconSymbol name="house.fill" size={24} color={colors.muted} />
            </View>
          )}

          <View className="flex-1 justify-center">
            <Text className="text-2xl font-bold text-foreground mb-1">{book.title}</Text>
            {book.author && <Text className="text-sm text-muted mb-2">{book.author}</Text>}
            <Text className="text-xs text-muted">{moments?.length || 0} okuma anı</Text>
          </View>
        </View>
      </View>

      {/* Okuma Anları Listesi */}
      {!moments || moments.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-xl font-semibold text-foreground mb-3 text-center">
            Henüz okuma anı eklemediniz
          </Text>
          <Text className="text-base text-muted text-center mb-6">
            Bu kitaptan ilk okuma anınızı ekleyerek başlayın.
          </Text>
          <Pressable
            onPress={handleAddMoment}
            className="bg-primary px-8 py-4 rounded-full"
            style={({ pressed }) => [
              { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text className="text-background font-semibold text-base">Okuma Anı Ekle</Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-1">
          <View className="flex-row items-center justify-between p-6 pb-3">
            <Text className="text-lg font-semibold text-foreground">Zaman Çizgisi</Text>
            <Pressable
              onPress={handleAddMoment}
              className="bg-primary w-10 h-10 rounded-full items-center justify-center"
              style={({ pressed }) => [
                { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text className="text-background text-xl font-bold">+</Text>
            </Pressable>
          </View>

          <FlatList
            data={moments}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => {
              const createdDate = new Date(item.createdAt);
              const now = new Date();
              const diffMs = now.getTime() - createdDate.getTime();
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              
              let timeText = "";
              if (diffDays === 0) {
                timeText = "Bugün";
              } else if (diffDays === 1) {
                timeText = "Dün";
              } else if (diffDays < 7) {
                timeText = `${diffDays} gün önce`;
              } else {
                timeText = createdDate.toLocaleDateString("tr-TR");
              }

              return (
                <Pressable
                  onPress={() => handleMomentPress(item.id)}
                  className="mx-6 mb-4 bg-surface rounded-2xl p-4 border border-border"
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <View className="flex-row">
                    <Image
                      source={{ uri: item.pageImageUrl }}
                      className="w-20 h-28 rounded-lg mr-4"
                      resizeMode="cover"
                    />

                    <View className="flex-1">
                      {item.ocrText && (
                        <Text className="text-sm text-foreground mb-2" numberOfLines={3}>
                          {item.ocrText}
                        </Text>
                      )}
                      {item.userNote && (
                        <Text className="text-xs text-muted italic mb-2" numberOfLines={2}>
                          "{item.userNote}"
                        </Text>
                      )}
                      <Text className="text-xs text-muted">{timeText}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            }}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </ScreenContainer>
  );
}
