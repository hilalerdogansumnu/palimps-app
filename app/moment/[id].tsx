import React from "react";
import { Text, View, Pressable, ScrollView, Image, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export default function MomentDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const momentId = parseInt(id, 10);

  const [isEditModalVisible, setIsEditModalVisible] = React.useState(false);
  const [editedNote, setEditedNote] = React.useState("");

  const { data: moment, isLoading, refetch } = trpc.readingMoments.getById.useQuery({ id: momentId });
  const deleteMutation = trpc.readingMoments.delete.useMutation();
  const updateMutation = trpc.readingMoments.update.useMutation({
    onSuccess: () => {
      refetch();
      setIsEditModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Moment",
      "Are you sure you want to delete this moment? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id: momentId });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Error", "Failed to delete moment.");
            }
          },
        },
      ]
    );
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({
      id: momentId,
      userNote: editedNote.trim() || undefined,
    });
  };

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
        <Text className="text-xl font-semibold text-foreground mb-3">Moment not found</Text>
        <Pressable
          onPress={() => router.back()}
          className="bg-primary px-6 py-3 rounded-full"
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text className="text-background font-semibold">Go Back</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const createdDate = new Date(moment.createdAt);
  const formattedDate = createdDate.toLocaleDateString("en-US", {
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
        <View className="p-6 pb-4 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="p-2"
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text className="text-primary text-base">← Back</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setEditedNote(moment?.userNote || "");
              setIsEditModalVisible(true);
            }}
            className="p-2"
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text className="text-base text-foreground">Edit</Text>
          </Pressable>
        </View>

        {/* Page Image */}
        <View className="px-6 mb-6">
          <Image
            source={{ uri: moment.pageImageUrl }}
            className="w-full rounded-xl"
            style={{ aspectRatio: 0.7 }}
            resizeMode="contain"
          />
        </View>

        {/* OCR Text */}
        {moment.ocrText && (
          <View className="px-6 mb-6">
            <Text className="text-sm font-semibold text-muted mb-2">Extracted Text</Text>
            <View className="bg-surface rounded-xl p-4 border border-border">
              <Text className="text-base text-foreground leading-relaxed">{moment.ocrText}</Text>
            </View>
          </View>
        )}

        {/* User Note */}
        {moment.userNote && (
          <View className="px-6 mb-6">
            <Text className="text-sm font-semibold text-muted mb-2">Your Note</Text>
            <View className="bg-primary/10 rounded-xl p-4 border border-primary/20">
              <Text className="text-base text-foreground italic leading-relaxed">
                "{moment.userNote}"
              </Text>
            </View>
          </View>
        )}

        {/* Timestamp */}
        <View className="px-6 mb-4">
          <Text className="text-xs text-muted text-center">{formattedDate}</Text>
        </View>

        {/* Delete Button */}
        <View className="px-6 pb-8">
          <Pressable
            onPress={handleDelete}
            disabled={deleteMutation.isPending}
            style={({ pressed }) => [
              {
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
                backgroundColor: "#EF4444",
                opacity: pressed || deleteMutation.isPending ? 0.6 : 1,
              },
            ]}
          >
            <Text className="text-base text-white text-center font-medium">
              {deleteMutation.isPending ? "Deleting..." : "Delete Moment"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                backgroundColor: colors.background,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
                minHeight: 300,
              }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg text-foreground font-medium">Edit Note</Text>
                <Pressable
                  onPress={() => setIsEditModalVisible(false)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text className="text-base text-muted">Cancel</Text>
                </Pressable>
              </View>

              <TextInput
                value={editedNote}
                onChangeText={setEditedNote}
                placeholder="Add your thoughts..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={6}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 16,
                  color: colors.foreground,
                  fontSize: 16,
                  minHeight: 150,
                  textAlignVertical: "top",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />

              <Pressable
                onPress={handleSaveEdit}
                disabled={updateMutation.isPending}
                style={({ pressed }) => [
                  {
                    marginTop: 16,
                    paddingVertical: 14,
                    paddingHorizontal: 24,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                    opacity: pressed || updateMutation.isPending ? 0.6 : 1,
                  },
                ]}
              >
                <Text className="text-base text-white text-center font-medium">
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}
