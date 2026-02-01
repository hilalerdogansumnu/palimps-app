import { View, Text, Pressable, ActivityIndicator, FlatList, ScrollView, Alert, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useState } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export default function BookDetailScreen() {
  const colors = useColors();
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

  const handleExport = () => {
    Alert.alert(
      "Export Format",
      "Choose export format",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Markdown",
          onPress: () => performExport("markdown"),
        },
        {
          text: "PDF",
          onPress: () => performExport("pdf"),
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
        Alert.alert("Success", "Exported successfully");
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
      Alert.alert("Error", "Export failed");
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
        <Text className="text-base text-muted mb-8">Book not found</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <Text className="text-base text-foreground">Go back</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  // Format date helper
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
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
            <Text className="text-base text-foreground">←</Text>
          </Pressable>
          <View className="flex-row gap-4">
            <Pressable
              onPress={handleExport}
              disabled={isExporting}
              style={({ pressed }) => [{ opacity: pressed || isExporting ? 0.6 : 1 }]}
            >
              <Text className="text-base text-foreground">{isExporting ? "..." : "↓"}</Text>
            </Pressable>
            <Pressable
              onPress={handleAddMoment}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <Text className="text-2xl text-foreground">+</Text>
            </Pressable>
          </View>
        </View>

        {/* Book title (small, quiet) */}
        <View className="mb-8">
          <Text className="text-base text-foreground font-medium mb-1">{book.title}</Text>
          {book.author && (
            <Text className="text-sm text-muted">{book.author}</Text>
          )}
        </View>

        {/* Empty state */}
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-muted mb-8 text-center">
            No moments yet
          </Text>
          <Pressable
            onPress={handleAddMoment}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text className="text-base text-foreground">Add your first moment</Text>
          </Pressable>
        </View>
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
          <Text className="text-base text-foreground">←</Text>
        </Pressable>
        <View className="flex-row gap-4">
          <Pressable
            onPress={handleExport}
            disabled={isExporting}
            style={({ pressed }) => [{ opacity: pressed || isExporting ? 0.6 : 1 }]}
          >
            <Text className="text-base text-foreground">{isExporting ? "..." : "↓"}</Text>
          </Pressable>
          <Pressable
            onPress={handleAddMoment}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text className="text-2xl text-foreground">+</Text>
          </Pressable>
        </View>
      </View>

      {/* Book title (small, quiet) */}
      <View className="mb-8">
        <Text className="text-base text-foreground font-medium mb-1">{book.title}</Text>
        {book.author && (
          <Text className="text-sm text-muted">{book.author}</Text>
        )}
      </View>

      {/* Chronological moments (timeline) */}
      <FlatList
        data={moments}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 32 }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleMomentPress(item.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <View>
              {/* Date (system gray) */}
              <Text className="text-xs text-muted mb-2">
                {formatDate(item.createdAt)}
              </Text>

              {/* OCR text (main content) */}
              {item.ocrText && (
                <Text className="text-base text-foreground mb-2 leading-6">
                  {item.ocrText.length > 200
                    ? item.ocrText.substring(0, 200) + "..."
                    : item.ocrText}
                </Text>
              )}

              {/* User note (lighter tone) */}
              {item.userNote && (
                <Text className="text-sm text-muted leading-5">
                  {item.userNote}
                </Text>
              )}


            </View>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}
