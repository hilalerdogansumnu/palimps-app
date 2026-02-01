import React from "react";
import { Text, View, Pressable, FlatList, ActivityIndicator, TextInput, ScrollView } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { useTranslation } from "react-i18next";

type BookWithCount = {
  id: number;
  title: string;
  author: string | null;
  coverImageUrl: string | null;
  momentCount: number;
  createdAt: Date;
  lastMomentDate: Date | null;
};

export default function HomeScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { data: books, isLoading, refetch } = trpc.books.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);

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
        <View className="pt-4 pb-6">
          <Text className="text-sm text-muted">{t("home.title")}</Text>
        </View>

        {/* Empty state */}
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-muted mb-8 text-center">
            {t("home.emptyState")}
          </Text>
          <Pressable
            onPress={handleAddBook}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text className="text-base text-foreground">{t("home.emptyStateAction")}</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  // Format date helper
  const formatDate = (date: Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  // Determine what to display
  const showSearchResults = searchQuery.length > 0;
  const hasSearchResults = searchResults && (searchResults.books.length > 0 || searchResults.moments.length > 0);

  return (
    <ScreenContainer className="px-6">
      {/* Header */}
      <View className="pt-4 pb-4 flex-row items-center justify-between">
        <Text className="text-sm text-muted">Library</Text>
        <Pressable
          onPress={handleAddBook}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <Text className="text-2xl text-foreground">+</Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View className="mb-6">
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search books and moments..."
          placeholderTextColor={colors.muted}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 15,
            color: colors.foreground,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        />
      </View>

      {/* Search Results or Book List */}
      {showSearchResults ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {searchLoading ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="small" color={colors.foreground} />
            </View>
          ) : hasSearchResults ? (
            <>
              {/* Books Section */}
              {searchResults.books.length > 0 && (
                <View className="mb-8">
                  <Text className="text-xs text-muted mb-4 uppercase tracking-wider">
                    Books ({searchResults.books.length})
                  </Text>
                  {searchResults.books.map((book, index) => (
                    <View key={book.id}>
                      {index > 0 && (
                        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 16 }} />
                      )}
                      <Pressable
                        onPress={() => handleBookPress(book.id)}
                        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                      >
                        <View>
                          <Text className="text-base text-foreground mb-1 font-medium">
                            {book.title}
                          </Text>
                          {book.author && (
                            <Text className="text-sm text-muted">
                              {book.author}
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {/* Moments Section */}
              {searchResults.moments.length > 0 && (
                <View>
                  <Text className="text-xs text-muted mb-4 uppercase tracking-wider">
                    Moments ({searchResults.moments.length})
                  </Text>
                  {searchResults.moments.map((moment, index) => {
                    const book = books?.find((b) => b.id === moment.bookId);
                    return (
                      <View key={moment.id}>
                        {index > 0 && (
                          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 16 }} />
                        )}
                        <Pressable
                          onPress={() => handleMomentPress(moment.id)}
                          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                        >
                          <View>
                            {/* Book title (small) */}
                            <Text className="text-xs text-muted mb-2">
                              {book?.title || "Unknown Book"}
                            </Text>
                            
                            {/* OCR text preview */}
                            {moment.ocrText && (
                              <Text 
                                className="text-sm text-foreground mb-2" 
                                numberOfLines={3}
                              >
                                {moment.ocrText}
                              </Text>
                            )}
                            
                            {/* User note preview */}
                            {moment.userNote && (
                              <Text 
                                className="text-sm text-muted italic" 
                                numberOfLines={2}
                              >
                                "{moment.userNote}"
                              </Text>
                            )}
                            
                            {/* Date */}
                            <Text className="text-xs text-muted mt-2">
                              {formatDate(moment.createdAt)}
                            </Text>
                          </View>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          ) : (
            <View className="py-8 items-center">
              <Text className="text-base text-muted">No results found</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 24 }} />
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleBookPress(item.id)}
              onLongPress={() => handleBookLongPress(item.id)}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <View>
                {/* Book title */}
                <Text className="text-base text-foreground mb-1 font-medium">
                  {item.title}
                </Text>
                
                {/* Author (if exists) */}
                {item.author && (
                  <Text className="text-sm text-muted mb-2">
                    {item.author}
                  </Text>
                )}
                
                {/* Last moment date */}
                {item.momentCount > 0 && (
                  <Text className="text-xs text-muted">
                    {item.momentCount} {item.momentCount === 1 ? "moment" : "moments"}
                  </Text>
                )}
              </View>
            </Pressable>
          )}
        />
      )}

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
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 24,
              width: "80%",
              maxWidth: 400,
            }}
          >
            <Text className="text-lg text-foreground font-medium mb-4">
              Delete book?
            </Text>
            <Text className="text-sm text-muted mb-6">
              This will delete the book and all its moments. This action cannot be undone.
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setBookToDelete(null)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: 8,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text className="text-base text-foreground text-center">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteBook}
                disabled={deleteBookMutation.isPending}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: 8,
                    backgroundColor: "#EF4444",
                    opacity: pressed || deleteBookMutation.isPending ? 0.6 : 1,
                  },
                ]}
              >
                <Text className="text-base text-white text-center font-medium">
                  {deleteBookMutation.isPending ? "..." : "Delete"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
