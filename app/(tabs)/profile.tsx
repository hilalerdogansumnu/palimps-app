import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function ProfileScreen() {
  const colors = useColors();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { data: books } = trpc.books.list.useQuery();
  const bookCount = books?.length || 0;

  const handleLogout = () => {
    Alert.alert(
      "Çıkış Yap",
      "Hesabınızdan çıkış yapmak istediğinize emin misiniz?",
      [
        {
          text: "İptal",
          style: "cancel",
        },
        {
          text: "Çıkış Yap",
          style: "destructive",
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace("/login");
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert("Hata", "Çıkış yapılırken bir hata oluştu.");
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="p-6 pb-4">
          <Text className="text-3xl font-bold text-foreground">Profil</Text>
        </View>

        {/* Kullanıcı Bilgileri */}
        <View className="px-6 mb-6">
          <View className="bg-surface rounded-2xl p-6 border border-border">
            {/* Avatar */}
            <View className="items-center mb-4">
              <View className="w-20 h-20 rounded-full bg-primary items-center justify-center">
                <Text className="text-4xl text-background font-bold">
                  {user.email?.charAt(0).toUpperCase() || "?"}
                </Text>
              </View>
            </View>

            {/* Email */}
            <View className="items-center mb-2">
              <Text className="text-lg font-semibold text-foreground mb-1">
                {user.name || "Kullanıcı"}
              </Text>
              <Text className="text-sm text-muted">{user.email}</Text>
            </View>
          </View>
        </View>

        {/* İstatistikler */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-semibold text-muted mb-3">İSTATİSTİKLER</Text>
          <View className="bg-surface rounded-2xl p-6 border border-border">
            <View className="flex-row items-center justify-between">
              <View className="items-center flex-1">
                <Text className="text-3xl font-bold text-primary mb-1">{bookCount}</Text>
                <Text className="text-sm text-muted">Kitap</Text>
              </View>
              <View className="w-px h-12 bg-border" />
              <View className="items-center flex-1">
                <Text className="text-3xl font-bold text-primary mb-1">
                  {books?.reduce((sum, book) => sum + (book.momentCount || 0), 0) || 0}
                </Text>
                <Text className="text-sm text-muted">Okuma Anı</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Ayarlar */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-semibold text-muted mb-3">AYARLAR</Text>
          
          {/* Çıkış Yap Butonu */}
          <Pressable
            onPress={handleLogout}
            disabled={isLoggingOut}
            className="bg-error/10 border border-error/20 px-6 py-4 rounded-2xl flex-row items-center justify-center"
            style={({ pressed }) => [
              {
                opacity: isLoggingOut ? 0.5 : pressed ? 0.9 : 1,
                transform: [{ scale: pressed && !isLoggingOut ? 0.98 : 1 }],
              },
            ]}
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <Text className="text-xl mr-2">🚪</Text>
                <Text className="text-error font-semibold text-base">Çıkış Yap</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* App Version */}
        <View className="px-6 pb-8">
          <Text className="text-xs text-muted text-center">Okuma Hafızası v1.0</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
