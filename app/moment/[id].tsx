import { View, Text, ScrollView, ActivityIndicator, Image, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export default function MomentDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const momentId = parseInt(id, 10);

  const { data: moment, isLoading } = trpc.readingMoments.getById.useQuery({ id: momentId });

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!moment) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-xl font-semibold text-foreground mb-3">Okuma anı bulunamadı</Text>
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

  const createdDate = new Date(moment.createdAt);
  const formattedDate = createdDate.toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <ScreenContainer>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="p-6 pb-4">
          <Pressable
            onPress={() => router.back()}
            className="mb-4 p-2 self-start"
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text className="text-primary text-base">← Geri</Text>
          </Pressable>
        </View>

        {/* Sayfa Fotoğrafı */}
        <View className="px-6 mb-6">
          <Image
            source={{ uri: moment.pageImageUrl }}
            className="w-full rounded-xl"
            style={{ aspectRatio: 0.7 }}
            resizeMode="contain"
          />
        </View>

        {/* OCR Metni */}
        {moment.ocrText && (
          <View className="px-6 mb-6">
            <Text className="text-sm font-semibold text-muted mb-2">Çıkarılan Metin</Text>
            <View className="bg-surface rounded-xl p-4 border border-border">
              <Text className="text-base text-foreground leading-relaxed">{moment.ocrText}</Text>
            </View>
          </View>
        )}

        {/* Kullanıcı Notu */}
        {moment.userNote && (
          <View className="px-6 mb-6">
            <Text className="text-sm font-semibold text-muted mb-2">Notunuz</Text>
            <View className="bg-primary/10 rounded-xl p-4 border border-primary/20">
              <Text className="text-base text-foreground italic leading-relaxed">
                "{moment.userNote}"
              </Text>
            </View>
          </View>
        )}

        {/* Zaman Damgası */}
        <View className="px-6 pb-8">
          <Text className="text-xs text-muted text-center">{formattedDate}</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
