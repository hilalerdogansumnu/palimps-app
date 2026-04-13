import React from "react";
import { Text, View, Pressable, ScrollView, Image, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export default function MomentDetailScreen() {
  const colors = useColors();
  const { t } = useTranslation();
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
      t("momentDetail.deleteTitle"),
      t("momentDetail.deleteConfirm"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id: momentId });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(t("common.error"), t("momentDetail.deleteError"));
            }
          },
        },
      ]
    );
  };

  const handleMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      t("common.options"),
      "",
      [
        {
          text: t("momentDetail.editNote"),
          onPress: () => {
            setEditedNote(moment?.userNote || "");
            setIsEditModalVisible(true);
          },
        },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: handleDelete,
        },
        {
          text: t("common.cancel"),
          style: "cancel",
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
        <Text className="text-xl font-semibold text-foreground mb-3">{t("momentDetail.notFound")}</Text>
        <Pressable
          onPress={() => router.back()}
          className="bg-primary px-6 py-3 rounded-full"
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text className="text-background font-semibold">{t("momentDetail.goBack")}</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const createdDate = new Date(moment.createdAt);
  const localeMap: Record<string, string> = { en: "en-US", tr: "tr-TR", de: "de-DE", es: "es-ES" };
  const locale = localeMap[i18n.language] || "en-US";
  const formattedDate = createdDate.toLocaleDateString(locale, {
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
        <View className="px-6 pt-4 pb-6 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text className="text-lg text-foreground">←</Text>
          </Pressable>
          <Pressable
            onPress={handleMenu}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text className="text-lg text-foreground">⋯</Text>
          </Pressable>
        </View>

        {/* Page Image */}
        <View className="px-6 mb-8">
          <Image
            source={{ uri: moment.pageImageUrl }}
            style={{
              width: "100%",
              maxHeight: 400,
              borderRadius: 16,
            }}
            resizeMode="contain"
          />
        </View>

        {/* OCR Text Section */}
        {moment.ocrText && (
          <View className="px-6 mb-8">
            <Text
              style={{
                fontSize: 12,
                color: colors.muted,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 12,
              }}
            >
              {t("momentDetail.ocrText")}
            </Text>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  color: colors.foreground,
                  lineHeight: 24,
                }}
              >
                {moment.ocrText}
              </Text>
            </View>
          </View>
        )}

        {/* User Note Section */}
        {moment.userNote && (
          <View className="px-6 mb-8">
            <Text
              style={{
                fontSize: 12,
                color: colors.muted,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 12,
              }}
            >
              {t("momentDetail.yourNote")}
            </Text>
            <View
              style={{
                borderLeftWidth: 3,
                borderLeftColor: colors.primary + "4D",
                paddingLeft: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  color: colors.primary,
                  fontStyle: "italic",
                  lineHeight: 24,
                }}
              >
                {moment.userNote}
              </Text>
            </View>
          </View>
        )}

        {/* Timestamp */}
        <View className="px-6 mb-8">
          <Text
            style={{
              fontSize: 13,
              color: colors.muted,
              textAlign: "center",
            }}
          >
            {formattedDate}
          </Text>
        </View>

        {/* Spacer for scroll */}
        <View style={{ height: 24 }} />
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
                <Text className="text-lg text-foreground font-medium">{t("momentDetail.editNote")}</Text>
                <Pressable
                  onPress={() => setIsEditModalVisible(false)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text className="text-base text-muted">{t("common.cancel")}</Text>
                </Pressable>
              </View>

              <TextInput
                value={editedNote}
                onChangeText={setEditedNote}
                placeholder={t("momentDetail.notePlaceholder")}
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
                  {updateMutation.isPending ? t("momentDetail.saving") : t("common.save")}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}
