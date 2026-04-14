import React from "react";
import { Text, View, Pressable, FlatList, ActivityIndicator, TextInput, ScrollView, Alert, Image } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { a11y } from "@/lib/accessibility";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type BookWithCount = {
  id: number;
  title: string;
  author: string | null;
  coverImageUrl: string | null;
  momentCount: number;
  createdAt: Date;
  lastMomentDate: Date | null;
};

type SortOption = "relevance" | "date-newest" | "date-oldest" | "author";

export default function HomeScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { data: books, isLoading, refetch } = trpc.books.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortOption>("date-newest");

  // Backend search API
  const { data: searchResults, isLoading: searchLoading } = trpc.search.all.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 0 }
  );

  const handleAddBook = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/add-book");
  };

  const [bookToDelete, setBookToDelete] = React.useState<number | null>(null);
  const deleteBookMutation = trpc.books.delete.useMutation({
    onSuccess: () => {
      refetch();
      setBookToDelete(null);
    },
  });

  const handleBookPress = (bookId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/book/${bookId}` as any);
  };

  const handleBookLongPress = (bookId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBookToDelete(bookId);
  };

  const handleDeleteBook = () => {
    if (bookToDelete) {
      deleteBookMutation.mutate({ id: bookToDelete });
    }
  };

  const handleMomentPress = (momentId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/moment/${momentId}` as any);
  };

  const handleSortChange = (option: SortOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortBy(option);
  };

  // Sort search results based on selected option
  const sortedSearchResults = React.useMemo(() => {
    if (!searchResults) return null;

    const sortedBooks = [...searchResults.books];
    const sortedMoments = [...searchResults.moments];

    switch (sortBy) {
      case "date-newest":
        sortedBooks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        sortedMoments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "date-oldest":
        sortedBooks.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        sortedMoments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "author":
        sortedBooks.sort((a, b) => {
          const authorA = a.author?.toLowerCase() || "";
          const authorB = b.author?.toLowerCase() || "";
          return authorA.localeCompare(authorB);
        });
        // For moments, sort by book author
        sortedMoments.sort((a, b) => {
          const bookA = books?.find((book) => book.id === a.bookId);
          const bookB = books?.find((book) => book.id === b.bookId);
          const authorA = bookA?.author?.toLowerCase() || "";
          const authorB = bookB?.author?.toLowerCase() || "";
          return authorA.localeCompare(authorB);
        });
        break;
      case "relevance":
      default:
        // Calculate relevance score based on query match
        const calculateRelevance = (text: string | null | undefined, query: string): number => {
          if (!text) return 0;
          const lowerText = text.toLowerCase();
          const lowerQuery = query.toLowerCase();
          
          // Exact match gets highest score
          if (lowerText === lowerQuery) return 100;
          
          // Match at start of text
          if (lowerText.startsWith(lowerQuery)) return 80;
          
          // Match as whole word
          const wordMatch = new RegExp(`\\b${lowerQuery}\\b`, "i").test(text);
          if (wordMatch) return 60;
          
          // Partial match - count occurrences
          const occurrences = (lowerText.match(new RegExp(lowerQuery, "g")) || []).length;
          return Math.min(40 + occurrences * 10, 50);
        };

        sortedBooks.sort((a, b) => {
          const scoreA = Math.max(
            calculateRelevance(a.title, searchQuery),
            calculateRelevance(a.author, searchQuery)
          );
          const scoreB = Math.max(
            calculateRelevance(b.title, searchQuery),
            calculateRelevance(b.author, searchQuery)
          );
          return scoreB - scoreA;
        });

        sortedMoments.sort((a, b) => {
          const scoreA = Math.max(
            calculateRelevance(a.ocrText, searchQuery),
            calculateRelevance(a.userNote, searchQuery)
          );
          const scoreB = Math.max(
            calculateRelevance(b.ocrText, searchQuery),
            calculateRelevance(b.userNote, searchQuery)
          );
          return scoreB - scoreA;
        });
        break;
    }

    return {
      books: sortedBooks,
      moments: sortedMoments,
    };
  }, [searchResults, sortBy, searchQuery, books]);

  if (authLoading || isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="small" color={colors.foreground} />
      </ScreenContainer>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <ScreenContainer className="items-center justify-center px-8">
        <Text className="text-lg text-foreground mb-2 text-center font-medium">{t("app.name")}</Text>
        <Text className="text-sm text-muted text-center mb-8">
          {t("app.tagline")}
        </Text>
        <Pressable
          onPress={() => router.push("/login" as any)}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t("auth.signIn")}
          accessibilityHint="Navigates to login screen"
        >
          <Text className="text-base text-foreground">{t("auth.signOut")}</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  // Empty state
  if (!books || books.length === 0) {
    return (
      <ScreenContainer className="px-6">
        {/* Header */}
        <View className="pt-8 pb-6">
          <Text style={{ fontSize: 28, fontWeight: "700", color: colors.foreground, marginBottom: 24 }}>
            Kitaplarım
          </Text>
        </View>

        {/* Search bar */}
        <View className="mb-8">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("home.search")}
            placeholderTextColor={colors.muted}
            accessible={true}
            accessibilityRole="search"
            accessibilityLabel={a11y.searchBar.label}
            accessibilityHint={a11y.searchBar.hint}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 15,
              color: colors.foreground,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        </View>

        {/* Empty state */}
        <View className="flex-1 items-center justify-center">
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <MaterialIcons name="menu-book" size={36} color={colors.muted} />
          </View>
          <Text style={{ fontSize: 16, color: colors.muted, marginBottom: 8, textAlign: "center" }}>
            Henüz kitap yok
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", marginBottom: 24 }}>
            Okuma yolculuğunuza başlayın
          </Text>
          <Pressable
            onPress={handleAddBook}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderRadius: 12,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={a11y.addBook.label}
            accessibilityHint={a11y.addBook.hint}
          >
            <Text style={{ fontSize: 16, color: "white", fontWeight: "600" }}>
              İlk Kitabınızı Ekleyin
            </Text>
          </Pressable>
        </View>

        {/* FAB */}
        <Pressable
          onPress={handleAddBook}
          style={({ pressed }) => [
            {
              position: "absolute",
              bottom: 24,
              right: 24,
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.primary,
              justifyContent: "center",
              alignItems: "center",
              opacity: pressed ? 0.8 : 1,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 5,
            },
          ]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={a11y.addBook.label}
          accessibilityHint={a11y.addBook.hint}
        >
          <Text style={{ fontSize: 24, color: "white" }}>+</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  // Format date helper with i18n
  const formatDate = (date: Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t("dates.today");
    if (diffDays === 1) return t("dates.yesterday");
    if (diffDays < 7) return t("dates.daysAgo", { count: diffDays });
    if (diffDays < 30) return t("dates.weeksAgo", { count: Math.floor(diffDays / 7) });
    if (diffDays < 365) return t("dates.monthsAgo", { count: Math.floor(diffDays / 30) });
    return t("dates.yearsAgo", { count: Math.floor(diffDays / 365) });
  };

  // Determine what to display
  const showSearchResults = searchQuery.length > 0;
  const hasSearchResults = sortedSearchResults && (sortedSearchResults.books.length > 0 || sortedSearchResults.moments.length > 0);

  // Helper function to get initials from book title
  const getBookInitials = (title: string): string => {
    const words = title.trim().split(/\s+/);
    if (words.length === 0) return "??";
    if (words.length === 1) return title.substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  return (
    <ScreenContainer className="px-6">
      {/* Header - iOS Large Title Style */}
      <View style={{ paddingTop: 16, paddingBottom: 12 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.foreground }}>
          Kitaplarım
        </Text>
      </View>

      {/* Search Bar */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", position: "relative" }}>
          <MaterialIcons name="search" size={18} color={colors.muted} style={{ position: "absolute", left: 12 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("home.search")}
            placeholderTextColor={colors.muted}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              paddingHorizontal: 40,
              paddingVertical: 10,
              fontSize: 15,
              color: colors.foreground,
              borderWidth: 1,
              borderColor: colors.border,
              flex: 1,
            }}
          />
        </View>
      </View>

      {/* Search Results or Book List */}
      {showSearchResults ? (
        <FlatList
          data={[
            ...(searchLoading || !sortedSearchResults ? [] : sortedSearchResults.books.map(b => ({ type: "book" as const, item: b }))),
            ...(searchLoading || !sortedSearchResults ? [] : sortedSearchResults.moments.map(m => ({ type: "moment" as const, item: m }))),
          ]}
          keyExtractor={(entry) => `${entry.type}-${entry.item.id}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            searchLoading ? (
              <View style={{ paddingVertical: 32, alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.foreground} />
              </View>
            ) : (
              <View style={{ paddingVertical: 32, alignItems: "center" }}>
                <Text style={{ fontSize: 16, color: colors.muted }}>{t("home.noResults")}</Text>
              </View>
            )
          }
          ItemSeparatorComponent={() => (
            <View style={{ height: 0.5, backgroundColor: colors.border, marginVertical: 12 }} />
          )}
          renderItem={({ item: entry }) => {
            if (entry.type === "book") {
              const book = entry.item as NonNullable<typeof sortedSearchResults>["books"][0];
              return (
                <Pressable
                  onPress={() => handleBookPress(book.id)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    {book.coverImageUrl ? (
                      <Image
                        source={{ uri: book.coverImageUrl }}
                        style={{ width: 48, height: 72, borderRadius: 6, backgroundColor: colors.surface }}
                      />
                    ) : (
                      <View style={{ width: 60, height: 90, borderRadius: 8, backgroundColor: colors.accent + "20", justifyContent: "center", alignItems: "center" }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.accent }}>
                          {getBookInitials(book.title)}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, marginBottom: 2 }}>{book.title}</Text>
                      {book.author && <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 2 }}>{book.author}</Text>}
                      {"momentCount" in book && (book as any).momentCount > 0 && (
                        <Text style={{ fontSize: 13, color: colors.muted }}>{t("home.momentCount", { count: (book as any).momentCount })}</Text>
                      )}
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
                  </View>
                </Pressable>
              );
            }
            const moment = entry.item as NonNullable<typeof sortedSearchResults>["moments"][0];
            const book = books?.find((b) => b.id === moment.bookId);
            return (
              <Pressable
                onPress={() => handleMomentPress(moment.id)}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <View>
                  <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4 }}>{book?.title || t("home.unknownBook")}</Text>
                  {moment.ocrText && <Text style={{ fontSize: 14, color: colors.foreground, marginBottom: 2 }} numberOfLines={2}>{moment.ocrText}</Text>}
                  {moment.userNote && <Text style={{ fontSize: 13, color: colors.muted, fontStyle: "italic" }} numberOfLines={1}>"{moment.userNote}"</Text>}
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{formatDate(moment.createdAt)}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleBookPress(item.id)}
              onLongPress={() => handleBookLongPress(item.id)}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
                {/* Cover image or placeholder */}
                {item.coverImageUrl ? (
                  <Image
                    source={{ uri: item.coverImageUrl }}
                    style={{
                      width: 60,
                      height: 90,
                      borderRadius: 6,
                      backgroundColor: colors.surface,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 60,
                      height: 90,
                      borderRadius: 6,
                      backgroundColor: colors.accent + "20",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: colors.accent,
                      }}
                    >
                      {getBookInitials(item.title)}
                    </Text>
                  </View>
                )}
                {/* Content */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, marginBottom: 2 }}>
                    {item.title}
                  </Text>
                  {item.author && (
                    <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 2 }}>
                      {item.author}
                    </Text>
                  )}
                  <Text style={{ fontSize: 13, color: colors.muted }}>
                    {item.momentCount} an
                  </Text>
                </View>
                {/* Chevron */}
                <Text style={{ fontSize: 20, color: colors.muted }}>›</Text>
              </View>
              {/* Separator - inset from left */}
              <View
                style={{
                  height: 0.5,
                  backgroundColor: colors.border,
                  marginLeft: 64,
                }}
              />
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View />}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={handleAddBook}
        style={({ pressed }) => [
          {
            position: "absolute",
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            justifyContent: "center",
            alignItems: "center",
            opacity: pressed ? 0.8 : 1,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 5,
          },
        ]}
      >
        <Text style={{ fontSize: 24, color: "white", fontWeight: "600" }}>+</Text>
      </Pressable>

      {/* Delete Confirmation Dialog */}
      {bookToDelete !== null && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 50,
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderRadius: 20,
              padding: 24,
              width: "80%",
              maxWidth: 400,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground, marginBottom: 12 }}>
              {t("home.deleteTitle")}
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 20 }}>
              {t("home.deleteMessage")}
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => setBookToDelete(null)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 8,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 16, color: colors.foreground, textAlign: "center" }}>
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteBook}
                disabled={deleteBookMutation.isPending}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 8,
                    backgroundColor: "#EF4444",
                    opacity: pressed || deleteBookMutation.isPending ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 16, color: "white", textAlign: "center", fontWeight: "600" }}>
                  {deleteBookMutation.isPending ? "..." : t("common.delete")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
