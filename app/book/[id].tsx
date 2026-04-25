import { View, Text, Pressable, ActivityIndicator, FlatList, ScrollView, Alert, Platform, RefreshControl, Modal } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

import { ScreenContainer } from "@/components/screen-container";
import { NavigationBar } from "@/components/navigation-bar";
import { BookCover } from "@/components/book-cover";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { a11y } from "@/lib/accessibility";

export default function BookDetailScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = parseInt(id, 10);
  const [isExporting, setIsExporting] = useState(false);

  const { data: book, isLoading: bookLoading, refetch: refetchBook } = trpc.books.getById.useQuery({ id: bookId });
  const { data: moments, isLoading: momentsLoading, refetch } = trpc.readingMoments.listByBook.useQuery(
    { bookId },
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Pull-to-refresh — kitap + moment listesini paralel yenile. Kapak URL'si
   * signed ve 7 gün TTL'li; çok eski bir kitap açılırken URL süresi dolmuşsa
   * bu swipe yeni imza çıkaracak. 50319'da kullanıcı "aşağı çekince güncelle"
   * talebini ilettiği için eklendi.
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Promise.all([refetchBook(), refetch()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchBook, refetch]);

  const handleAddMoment = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/add-moment/${bookId}` as any);
  };

  const handleMomentPress = (momentId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/moment/${momentId}` as any);
  };

  const exportMutation = trpc.export.book.useMutation();
  const updateBookMutation = trpc.books.update.useMutation();
  const utils = trpc.useUtils();

  // Kitap adı düzenleme — iOS Alert.prompt (native, App Store onaylı pattern,
  // tasarım minimal). 50333 dogfood: kullanıcı yanlış başlıkla kitap eklerse
  // "şimdi düzeltebilirim" deneyimi olmuyordu. Backend `books.update` zaten
  // partial update destekliyor (title opsiyonel), sadece UI eksikti.
  // Android'de Alert.prompt yok; bu route iOS-first uygulamada kabul. v1.1
  // Android için custom Modal sheet açılabilir.
  const handleEditTitle = () => {
    if (!book) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS !== "ios") {
      // Android fallback — Alert.prompt mevcut değil, şimdilik basit Alert.
      Alert.alert(t("bookDetail.editTitle"), t("bookDetail.editTitlePrompt"));
      return;
    }
    Alert.prompt(
      t("bookDetail.editTitle"),
      t("bookDetail.editTitlePrompt"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.save"),
          onPress: async (newTitle) => {
            const trimmed = (newTitle ?? "").trim();
            if (!trimmed || trimmed === book.title) return;
            try {
              await updateBookMutation.mutateAsync({ id: book.id, title: trimmed });
              // Cache invalidate — kitap detay + kitaplar listesi yenilensin.
              await Promise.all([
                utils.books.getById.invalidate({ id: book.id }),
                utils.books.list.invalidate(),
              ]);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(t("common.success"), t("bookDetail.editTitleSuccess"));
            } catch {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(t("common.error"), t("bookDetail.editTitleError"));
            }
          },
        },
      ],
      "plain-text",
      book.title, // Mevcut başlık prefilled — kullanıcı küçük edit'leri kolayca yapsın.
    );
  };

  const handleMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      t("common.options"),
      "",
      [
        {
          text: t("bookDetail.editTitle"),
          onPress: handleEditTitle,
        },
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
      // Locale'i mutation'a geçir — server bu bilgiyle başlık + meta etiketleri
      // doğru dilde üretiyor. 50332 dogfood'da bu parametre yoktu, server
      // hard-coded "Author/Total Moments/Date/Extracted Text" yazıyordu.
      const exportLocale = i18n.language?.startsWith("en") ? "en" : "tr";
      const result = await exportMutation.mutateAsync({ bookId, format, locale: exportLocale });
      
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
          Alert.alert(t("common.success"), t("bookDetail.exportSuccess"));
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      // Export failure is rare but worth surfacing — Sentry picks up the
      // unhandled rejection path; user gets a warm retry prompt.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={a11y.backButton.label}
          accessibilityHint={a11y.backButton.hint}
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

  // Book meta line: "5 an · 3 gün önce eklendi"
  // Returns the localized, pluralized "Added X ago" string for a given date.
  const formatAddedAgo = (date: Date | string | number): string => {
    const created = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const day = 24 * 60 * 60 * 1000;
    const days = Math.floor(diffMs / day);
    if (days <= 0) return t("bookDetail.addedToday");
    if (days === 1) return t("bookDetail.addedYesterday");
    if (days < 7) return t("bookDetail.addedDaysAgo", { count: days });
    if (days < 30) return t("bookDetail.addedWeeksAgo", { count: Math.floor(days / 7) });
    if (days < 365) return t("bookDetail.addedMonthsAgo", { count: Math.floor(days / 30) });
    return t("bookDetail.addedYearsAgo", { count: Math.floor(days / 365) });
  };

  // Composes "{N an} · {added-ago}" — skips the moments segment when count is 0
  // so the empty-state hero below doesn't duplicate "Henüz an yok".
  const renderBookMeta = (momentsLen: number, createdAt: Date | string | number) => {
    const addedAgo = formatAddedAgo(createdAt);
    if (momentsLen === 0) return addedAgo;
    return `${t("bookDetail.momentsCount", { count: momentsLen })} · ${addedAgo}`;
  };

  // Export overlay — Modal-based loading indicator. PDF/Markdown export'u
  // 2-3 saniye sürebiliyor (server-side moment fetch + content render +
  // file write + iOS share sheet açılışı). Aksi takdirde menüye basıldıktan
  // sonra ekranda hiçbir görsel feedback olmuyor → kullanıcı "app dondu"
  // sanıp aynı butona tekrar basıyor (50332 dogfood: blank-screen frame'leri).
  // Modal RN portal'ı ile tüm ekranın üstünde gösteriyor; transparent + dim
  // backdrop kullanıcının başka bir şeye dokunamamasını sağlıyor (statusBar
  // dahil — statusBarTranslucent). Görsel: ortada mini card + spinner + label.
  const exportOverlay = (
    <Modal
      visible={isExporting}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        // No-op: export iptal edilemez (server mutation in-flight). Android
        // back tuşuna basılınca modal kapanmaya çalışır → engelliyoruz.
      }}
    >
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("bookDetail.exporting")}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            paddingHorizontal: 28,
            paddingVertical: 24,
            borderRadius: 14,
            alignItems: "center",
            minWidth: 180,
            borderWidth: 0.5,
            borderColor: colors.border,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={{
              marginTop: 12,
              color: colors.foreground,
              fontSize: 14,
              fontWeight: "500",
            }}
          >
            {t("bookDetail.exporting")}
          </Text>
        </View>
      </View>
    </Modal>
  );

  // Empty state
  if (!moments || moments.length === 0) {
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        <NavigationBar
          title={book.title}
          backLabel={t("tabs.library")}
          onBack={() => router.back()}
          rightNode={
            <Pressable
              onPress={handleMenu}
              disabled={isExporting}
              hitSlop={{ top: 10, bottom: 10, left: 16, right: 8 }}
              style={({ pressed }) => [{ paddingHorizontal: 8, paddingVertical: 6, opacity: isExporting ? 0.4 : pressed ? 0.4 : 1 }]}
            >
              <Text style={{ fontSize: 22, color: colors.primary, lineHeight: 26 }} accessible={true} accessibilityRole="button" accessibilityLabel={a11y.menu.label} accessibilityHint={a11y.menu.hint}>···</Text>
            </Pressable>
          }
        />
        <View className="px-6">

        {/* Book info section */}
        <View className="mb-10 flex-row gap-4">
          <BookCover uri={book.coverImageUrl} title={book.title} size="lg" />
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
              {renderBookMeta(moments?.length ?? 0, book.createdAt)}
            </Text>
          </View>
        </View>

        {/* Empty state — tek bir prominent CTA (iOS 2026 trend). FAB bu
            ekranda yer almıyor; ilk an eklemek "first-run" bir aksiyon
            olduğu için centered button çok daha davetkar. Populated listte
            FAB'i koruyoruz çünkü oradaki aksiyon "repeat" (daha fazla ekle). */}
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-muted mb-8 text-center">
            {t("bookDetail.noMomentsYet")}
          </Text>
          <Pressable
            onPress={handleAddMoment}
            className="px-6 py-3 rounded-full"
            accessible
            accessibilityRole="button"
            accessibilityLabel={t("bookDetail.addFirstMoment")}
            accessibilityHint={t("bookDetail.addFirstMomentHint")}
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
        </View>
        {exportOverlay}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <NavigationBar
        title={book.title}
        backLabel={t("tabs.library")}
        onBack={() => router.back()}
        rightNode={
          <Pressable
            onPress={handleMenu}
            disabled={isExporting}
            hitSlop={{ top: 10, bottom: 10, left: 16, right: 8 }}
            style={({ pressed }) => [{ paddingHorizontal: 8, paddingVertical: 6, opacity: isExporting ? 0.4 : pressed ? 0.4 : 1 }]}
          >
            <Text style={{ fontSize: 22, color: colors.primary, lineHeight: 26 }}>···</Text>
          </Pressable>
        }
      />
      <View className="px-6 flex-1">
      {/* Book info section */}
      <View className="mb-10 flex-row gap-4">
        <BookCover uri={book.coverImageUrl} title={book.title} size="lg" />
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
            {renderBookMeta(moments?.length ?? 0, book.createdAt)}
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
              {/* Page photo — expo-image: blurhash/transition ile loading
                  state, network fail sessiz blank yerine surface-rengi
                  fallback'i gösterir. rn Image silent-fail (50331 dogfood
                  bug) buradan kaynaklanıyordu. */}
              {item.pageImageUrl && (
                <Image
                  source={{ uri: item.pageImageUrl }}
                  style={{
                    width: "100%",
                    aspectRatio: 3 / 2,
                    backgroundColor: colors.surface,
                  }}
                  contentFit="cover"
                  transition={200}
                  accessibilityLabel={t("momentDetail.pageImageAlt")}
                />
              )}

              {/* Text content */}
              <View style={{ padding: 12 }}>
                {/* "İşleniyor" placeholder — moment server-side kaydedildi
                    ama OCR ve/veya image henüz hazır değil (OCR transient
                    fail, R2 propagation, Gemini 5xx). Silent blank yerine
                    açık davetle: "tekrar bak" → kullanıcı "app kırık" demez.
                    50331 dogfood: Hilal 06:29'da blank card gördü, 06:58'de
                    refetch sonrası dolmuştu; aradaki pencere için bu
                    placeholder tasarlandı. summary de fallback — enrichment
                    başarıldıysa image/ocr olmasa bile kart dolu görünür. */}
                {!item.pageImageUrl && !item.ocrText && !item.summary && (
                  <View style={{ paddingVertical: 16, alignItems: "center", marginBottom: 8 }}>
                    <MaterialIcons name="hourglass-empty" size={20} color={colors.muted} />
                    <Text style={{ fontSize: 13, color: colors.muted, marginTop: 6, textAlign: "center" }}>
                      {t("bookDetail.momentProcessing")}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2, textAlign: "center" }}>
                      {t("bookDetail.momentProcessingHint")}
                    </Text>
                  </View>
                )}
                {/* AI summary-first — enrichment Phase A'nın ürettiği kısa
                    özet (280 char cap), editoryal "sade kütüphaneci" voice.
                    Italic → AI üretimi sinyali, kullanıcının kendi notuyla
                    ayrışsın (userNote primary renkli, summary foreground).
                    Fallback: enrichment fail/pending ise ham OCR metnini
                    göster. `/tag/[name]` kartıyla aynı pattern — tutarlılık. */}
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
      </View>
      {exportOverlay}
    </ScreenContainer>
  );
}
