import { View, Text, FlatList, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useState, useMemo } from "react";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export default function ChatScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");

  const QUICK_REPLIES = useMemo(() => [
    t("chat.example1"),
    t("chat.example2"),
    t("chat.example3"),
    t("chat.example4"),
  ], [t]);
  
  const sendMutation = trpc.chat.send.useMutation();

  const handleSend = async (message?: string) => {
    const textToSend = message || inputText.trim();
    if (!textToSend) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Kullanıcı mesajını ekle
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");

    try {
      // AI'dan cevap al
      const response = await sendMutation.mutateAsync({ message: textToSend });
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.reply,
        timestamp: response.timestamp,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: t("chat.errorMessage"),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleQuickReply = (reply: string) => {
    handleSend(reply);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={{
          marginBottom: 16,
          alignItems: isUser ? "flex-end" : "flex-start",
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            maxWidth: "85%",
            backgroundColor: isUser ? colors.primary : colors.surface,
            borderWidth: isUser ? 0 : 0.5,
            borderColor: isUser ? undefined : colors.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderBottomRightRadius: isUser ? 4 : 12,
            borderBottomLeftRadius: isUser ? 12 : 4,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              lineHeight: 22,
              color: isUser ? "white" : colors.foreground,
            }}
          >
            {item.content}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 12,
            color: colors.muted,
            marginTop: 4,
            paddingHorizontal: 8,
          }}
        >
          {new Date(item.timestamp).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={100}
      >
        {/* Header */}
        <View style={{ paddingVertical: 16, alignItems: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>
            Asistan
          </Text>
        </View>

        {/* Messages */}
        {messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Text style={{ fontSize: 32 }}>◻</Text></View>
            <Text style={{ fontSize: 16, fontWeight: "500", color: colors.muted, textAlign: "center", marginBottom: 24 }}>
              Okuma verileriniz hakkında sorular sorun
            </Text>

            {/* Quick Reply Chips — 2x2 Grid */}
            <View style={{ width: "100%", gap: 12 }}>
              {QUICK_REPLIES.map((reply, index) => (
                <Pressable
                  key={index}
                  onPress={() => handleQuickReply(reply)}
                  disabled={sendMutation.isPending}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.surface,
                      borderWidth: 0.5,
                      borderColor: colors.border,
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 15, color: colors.foreground, textAlign: "center" }}>
                    {reply}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingVertical: 16 }}
            showsVerticalScrollIndicator={false}
            inverted={false}
          />
        )}

        {/* Loading Indicator */}
        {sendMutation.isPending && (
          <View style={{ alignItems: "center", paddingVertical: 8 }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
              ...
            </Text>
          </View>
        )}

        {/* Input Area */}
        <View style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={t("chat.placeholder")}
              placeholderTextColor={colors.muted}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={() => handleSend()}
              editable={!sendMutation.isPending}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 0.5,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                color: colors.foreground,
                maxHeight: 120,
              }}
            />
            <Pressable
              onPress={() => handleSend()}
              disabled={!inputText.trim() || sendMutation.isPending}
              style={({ pressed }) => [
                {
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor:
                    !inputText.trim() || sendMutation.isPending
                      ? colors.muted + "4D"
                      : colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: !inputText.trim() || sendMutation.isPending ? 0.5 : pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
