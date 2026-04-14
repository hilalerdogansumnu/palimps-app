import { View, Text, Pressable, ActivityIndicator, FlatList, ScrollView, Alert, Platform, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export default function BookDetailScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = parseInt(id, 10);
  const [isExporting, setIsExporting] = useState(false);

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

  const exportMutation = trpc.export.book.useMutation();

  const handleMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      t("common.options"),
      "",
      [
        {
          text: t("bookDetail.exportPDF"),
          onPress: () => performExport("pdf"),
        },
        {
          text: t("bookDetail.exportMarkdown"),
          onPress: () => performExport("markdown"),
        },
        {
          text: t("common.cancel"),
          style: "cancel",
        },
      ]
    );
  };

  const performExport = async (format: "pdf" | "markdown") => {
    setIsExporting(true);
    try {
      const result = await exportMutation.mutateAsync({ bookId, format });
      
      // Web platformunda direkt download
      if (Platform.OS === "web") {
        const blob = new Blob([result.content], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert(t("common.success"), t("bookDetail.exportSuccess"));
      } else {
        // Mobil platformlarda dosyaya yaz ve paylaş
        const fileUri = `${FileSystem.documentDirectory}${result.filename}`;
        await FileSystem.writeAsStringAsync(fileUri, result.content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert("Success", `Saved to ${fileUri}`);
        }
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert(t("common.error"), t("bookDetail.exportError"));
    } finally {
      setIsExporting(false);
    }
  };

  if (bookLoading || momentsLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="small" color={colors.foreground} />
      </ScreenContainer>
    );
  }

  if (!book) {
    return (
      <ScreenContainer className="items-center justify-center px-8">
        <Text className="text-base text-muted mb-8">{t("bookDetail.notFound")}</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <Text className="text-base text-foreground">{t("bookDetail.goBack")}</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  // Format date helper
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const localeMap: Record<string, string> = { en: "en-US", tr: "tr-TR", de: "de-DE", es: "es-ES" };
    const locale = localeMap[i18n.language] || "en-US";
    return d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  };

  // Helper to generate initials placeholder
  const getInitials = (title: string) => {
    return title
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  };

  // Empty state
  if (!moments || moments.length === 0) {
    return (
      <ScreenContainer className="px-6">
        {/* Header */}
        <View className="pt-4 pb-6 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text className="text-lg text-foreground">←</Text>
          </Pressable>
          <Pressable
            onPress={handleMenu}
            disabled={isExporting}
            style={({ pressed }) => [{ opacity: pressed || isExporting ? 0.6 : 1 }]}
          >
            <Text className="text-lg text-foreground">⋯</Text>
          </Pressable>
        </View>

        {/* Book info section */}
        <View className="mb-10 flex-row gap-4">
          {book.coverImageUrl ? (
            <Image
              source={{ uri: book.coverImageUrl }}
              style={{ width: 80, height: 110, borderRadius: 12 }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 80,
                height: 110,
                borderRadius: 12,
                backgroundColor: colors.primary,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text className="text-lg font-bold text-background">{getInitials(book.title)}</Text>
            </View>
          )}
          <View className="flex-1 justify-center">
            <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.foreground }} className="mb-1">
              {book.title}
            </Text>
            {book.author && (
              <Text style={{ fontSize: 14, color: colors.muted }} className="mb-2">
                {book.author}
              </Text>
            )}
            <Text style={{ fontSize: 13, color: colors.muted }}>
              {t("bookDetail.momentsCount")} · {t("bookDetail.addedAgo")}
            </Text>
          </View>
        </View>

        {/* Empty state */}
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-muted mb-8 text-center">
            {t("bookDetail.noMomentsYet")}
          </Text>
          <Pressable
            onPress={handleAddMoment}
            className="px-6 py-3 rounded-full"
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Text className="text-base font-semibold text-background">
              {t("bookDetail.addFirstMoment")}
            </Text>
          </Pressable>
        </View>

        {/* FAB */}
        <Pressable
          onPress={handleAddMoment}
          style={({ pressed }) => [
            {
              position: "absolute",
              bottom: 32,
              right: 24,
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.primary,
              justifyContent: "center",
              alignItems: "center",
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
        >
          <Text className="text-2xl text-background">+</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-6">
      {/* Header */}
      <View className="pt-4 pb-6 flex-row items-center justify-between">
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <Text className="text-lg text-foreground">←</Text>
        </Pressable>
        <Pressable
          onPress={handleMenu}
          disabled={isExporting}
          style={({ pressed }) => [{ opacity: pressed || isExporting ? 0.6 : 1 }]}
        >
          <Text className="text-lg text-foreground">⋯</Text>
        </Pressable>
      </View>

      {/* Book info section */}
      <View className="mb-10 flex-row gap-4">
        {book.coverImageUrl ? (
          <Image
            source={{ uri: book.coverImageUrl }}
            style={{ width: 80, height: 110, borderRadius: 12 }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: 80,
              height: 110,
              borderRadius: 12,
              backgroundColor: colors.primary,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text className="text-lg font-bold text-background">{getInitials(book.title)}</Text>
          </View>
        )}
        <View className="flex-1 justify-center">
          <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.foreground }} className="mb-1">
            {book.title}
          </Text>
          {book.author && (
            <Text style={{ fontSize: 14, color: colors.muted }} className="mb-2">
              {book.author}
            </Text>
          )}
          <Text style={{ fontSize: 13, color: colors.muted }}>
            {t("bookDetail.momentsCount")} · {t("bookDetail.addedAgo")}
          </Text>
        </View>
      </View>

      {/* Section header with badge */}
      <View className="flex-row items-center justify-between mb-6">
        <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>
          {t("bookDetail.moments")}
        </Text>
        <View
          style={{
            backgroundColor: colors.primary + "15",
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 12,
          }}
        >
          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "500" }}>
            {moments?.length || 0}
          </Text>
        </View>
      </View>

      {/* Moment list (FlatList) */}
      <FlatList
        data={moments}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
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
              {/* Page photo */}
              {item.pageImageUrl && (
                <Image
                  source={{ uri: item.pageImageUrl }}
                  style={{
                    width: "100%",
                    aspectRatio: 3 / 2,
                  }}
                  resizeMode="cover"
                />
              )}

              {/* Text content */}
              <View style={{ padding: 12 }}>
                {/* OCR text preview */}
                {item.ocrText && (
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
                )}

                {/* User note if exists */}
                {item.userNote && (
                  <Text
                    style={{
                      fontSize: 13,
                      fontStyle: "italic",
                      color: colors.primary,
                      marginBottom: 8,
                    }}
                  >
                    {item.userNote}
                  </Text>
                )}

                {/* Date right-aligned */}
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.muted,
                    textAlign: "right",
                  }}
                >
                  {formatDate(item.createdAt)}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />

      {/* FAB */}
      <Pressable
        onPress={handleAddMoment}
        style={({ pressed }) => [
          {
            position: "absolute",
            bottom: 32,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            justifyContent: "center",
            alignItems: "center",
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}
      >
        <Text className="text-2xl text-background">+</Text>
      </Pressable>
    </ScreenContainer>
  );
}
