import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ScreenContainer } from "@/components/screen-container";
import { NavigationBar } from "@/components/navigation-bar";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import * as Auth from "@/lib/_core/auth";
import { captureException } from "@/lib/_core/sentry";

/**
 * Apple Sign-In `fullName`'i yalnızca ilk girişte veriyor. Kullanıcı daha
 * sonra (veya hiç) ismini değiştirmek isterse tek giriş noktası bu ekran.
 * Profil sayfasındaki user card'a tapılarak açılır.
 */
export default function EditNameScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();

  const initialName = user?.name ?? "";
  const [name, setName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const updateNameMutation = trpc.profile.updateName.useMutation();

  const trimmed = name.trim();
  const canSave =
    trimmed.length > 0 && trimmed.length <= 60 && trimmed !== initialName && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      await updateNameMutation.mutateAsync({ name: trimmed });

      // Native'de useAuth cached AsyncStorage'tan okuyor — backend güncellense
      // bile yeniden açılana kadar eski isim görünürdü. Web'de API.getMe'ye
      // düşüyor; refresh() iki durumu da kapsıyor. Cache'i de update edelim
      // ki refresh native'de zaten güncel cache'i okusun.
      if (user) {
        await Auth.setUserInfo({ ...user, name: trimmed });
      }
      await utils.auth.me.invalidate();
      await refresh();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      captureException(err instanceof Error ? err : new Error(String(err)), {
        operation: "profile.updateName",
      });
      Alert.alert(t("common.error"), t("profile.nameSaveError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <NavigationBar
        title={t("profile.editNameTitle")}
        backLabel={t("common.cancel")}
        onBack={() => router.back()}
        rightLabel={isSaving ? undefined : t("common.save")}
        rightDisabled={!canSave}
        onRight={handleSave}
        rightNode={
          isSaving ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : undefined
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: 24, paddingTop: 32 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.muted,
                marginBottom: 8,
                marginLeft: 4,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              {t("profile.editNameTitle")}
            </Text>
            <TextInput
              ref={inputRef}
              value={name}
              onChangeText={setName}
              placeholder={t("profile.namePlaceholder")}
              placeholderTextColor={colors.muted}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              editable={!isSaving}
              accessible
              accessibilityLabel={t("profile.editNameTitle")}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 17,
                color: colors.foreground,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
