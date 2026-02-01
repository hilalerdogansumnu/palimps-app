import { View, Text, Pressable, ActivityIndicator, FlatList } from "react-native";
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

  return (
    <ScreenContainer className="px-6">
      {/* Header */}
      <View className="pt-4 pb-6 flex-row items-center justify-between">
        <Text className="text-sm text-muted">Library</Text>
        <Pressable
          onPress={handleAddBook}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <Text className="text-2xl text-foreground">+</Text>
        </Pressable>
      </View>

      {/* Book List */}
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
    </ScreenContainer>
  );
}
