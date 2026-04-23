import React from "react";
import { Text, View, Pressable, FlatList, ActivityIndicator, Image, RefreshControl } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

import { ScreenContainer } from "@/components/screen-container";
import { NavigationBar } from "@/components/navigation-bar";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

/**
 * Tag detay ekranı — cross-book tema browser.
 * AN detay'daki tag chip'ine basınca buraya gelir. Aynı tema'ya sahip
 * TÜM an'ları tarih sırasına göre gösterir (en yeni üstte).
 *
 * Moment kartı book/[id].tsx'teki kartla aynı görsel dile sahip:
 *   sayfa fotosu → summary (özet) → kitap adı rozeti → tarih.
 * Kitap adı burada "from book" sinyali — kullanıcı cross-book bakarken
 * hangi kitaptan olduğunu scan edebilsin diye. Normalde book detail'de
 * bu gereksiz çünkü zaten context belli.
 *
 * URL param `name` encodeURIComponent edilmiş geliyor (özel karakterler
 * Türkçe tag'lerde yaygın: "kendilik gerçekleştirimi" → boşluk yok ama
 * "manevî anlam" → aksan var). decodeURIComponent bunu geri açıyor.
 */
export default function TagDetailScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { name } = useLocalSearchParams<{ name: string }>();
  const tag = React.useMemo(() => {
    try {
      return decodeURIComponent(name ?? "");
    } catch {
      return name ?? "";
    }
  }, [name]);

  const { data: moments, isLoading, refetch } = trpc.readingMoments.listByTag.useQuery(
    { tag },
    { enabled: tag.length > 0 },
  );
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleMomentPress = (momentId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/moment/${momentId}` as any);
  };

  const localeMap: Record<string, string> = { en: "en-US", tr: "tr-TR", de: "de-DE", es: "es-ES" };
  const locale = localeMap[i18n.language] || "en-US";
  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <NavigationBar
        title={tag}
        onBack={() => router.back()}
      />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (moments?.length ?? 0) === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text style={{ fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22 }}>
            {t("tagDetail.empty")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={moments}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80, paddingTop: 8 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.muted}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleMomentPress(item.id)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {item.pageImageUrl && (
                  <Image
                    source={{ uri: item.pageImageUrl }}
                    style={{ width: "100%", aspectRatio: 3 / 2 }}
                    resizeMode="cover"
                  />
                )}
                <View style={{ padding: 12 }}>
                  {item.summary ? (
                    <Text
                      style={{
                        fontSize: 14,
                        color: colors.foreground,
                        lineHeight: 20,
                        marginBottom: 8,
                        fontStyle: "italic",
                      }}
                      numberOfLines={2}
                    >
                      {item.summary}
                    </Text>
                  ) : item.ocrText ? (
                    <Text
                      style={{
                        fontSize: 14,
                        color: colors.foreground,
                        lineHeight: 20,
                        marginBottom: 8,
                      }}
                      numberOfLines={2}
                    >
                      {item.ocrText}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    {item.bookTitle ? (
                      <Text
                        style={{ fontSize: 12, color: colors.muted, flex: 1 }}
                        numberOfLines={1}
                      >
                        {item.bookTitle}
                      </Text>
                    ) : <View style={{ flex: 1 }} />}
                    <Text style={{ fontSize: 12, color: colors.muted, marginLeft: 8 }}>
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </ScreenContainer>
  );
}
