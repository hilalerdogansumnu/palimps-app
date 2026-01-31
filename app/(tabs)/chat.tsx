import { View, Text, FlatList, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useState } from "react";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

const QUICK_REPLIES = [
  "Hangi kitapları okudum?",
  "En çok hangi konulardan not aldım?",
  "Bana bir özet çıkar",
  "Okuma alışkanlıklarım nasıl?",
];

export default function ChatScreen() {
  const colors = useColors();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  
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
        content: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.",
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
        className={`mb-4 ${isUser ? "items-end" : "items-start"}`}
        style={{ paddingHorizontal: 16 }}
      >
        <View
          className={`max-w-[80%] rounded-2xl p-4 ${
            isUser
              ? "bg-primary"
              : "bg-surface border border-border"
          }`}
        >
          <Text
            className={`text-base leading-relaxed ${
              isUser ? "text-background" : "text-foreground"
            }`}
          >
            {item.content}
          </Text>
        </View>
        <Text className="text-xs text-muted mt-1 px-2">
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
        className="flex-1"
        keyboardVerticalOffset={100}
      >
        {/* Header */}
        <View className="p-6 pb-4 border-b border-border">
          <Text className="text-3xl font-bold text-foreground">Okuma Asistanı</Text>
          <Text className="text-sm text-muted mt-1">
            Okuma verileriniz hakkında sorular sorun
          </Text>
        </View>

        {/* Messages */}
        {messages.length === 0 ? (
          <View className="flex-1 items-center justify-center p-6">
            <Text className="text-2xl mb-2">📚</Text>
            <Text className="text-xl font-semibold text-foreground mb-3 text-center">
              Merhaba!
            </Text>
            <Text className="text-base text-muted text-center mb-6">
              Okuma verileriniz hakkında sorular sorabilirsiniz. Örneğin:
            </Text>
            
            {/* Quick Replies */}
            <View className="w-full gap-3">
              {QUICK_REPLIES.map((reply, index) => (
                <Pressable
                  key={index}
                  onPress={() => handleQuickReply(reply)}
                  disabled={sendMutation.isPending}
                  className="bg-surface border border-border rounded-xl py-3 px-4"
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text className="text-foreground text-center">{reply}</Text>
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
          <View className="items-center py-2">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="text-xs text-muted mt-1">Düşünüyor...</Text>
          </View>
        )}

        {/* Input */}
        <View className="p-4 border-t border-border">
          <View className="flex-row items-center gap-2">
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Mesajınızı yazın..."
              placeholderTextColor={colors.muted}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={() => handleSend()}
              editable={!sendMutation.isPending}
              className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-foreground max-h-24"
              style={{ color: colors.foreground }}
            />
            <Pressable
              onPress={() => handleSend()}
              disabled={!inputText.trim() || sendMutation.isPending}
              className="bg-primary w-12 h-12 rounded-full items-center justify-center"
              style={({ pressed }) => [
                {
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  opacity: !inputText.trim() || sendMutation.isPending ? 0.5 : pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text className="text-background text-xl">↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
