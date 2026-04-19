import { View, Text, FlatList, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useState, useMemo } from "react";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { captureException } from "@/lib/_core/sentry";

type MessageKind = "normal" | "error" | "premiumRequired";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  kind?: MessageKind;
  retryPrompt?: string;
};

export default function ChatScreen() {
  const colors = useColors();
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");

  const QUICK_REPLIES = useMemo(() => [
    t("chat.example1"),
    t("chat.example2"),
    t("chat.example3"),
    t("chat.example4"),
  ], [t]);
  
  const sendMutation = trpc.chat.send.useMutation();

  const handleSend = async (message?: string, options?: { isRetry?: boolean }) => {
    const textToSend = (message || inputText.trim()).trim();
    if (!textToSend) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // On retry, drop prior error/premium cards so the transcript doesn't
    // accumulate dead system messages.
    if (options?.isRetry) {
      setMessages((prev) =>
        prev.filter((m) => m.kind !== "error" && m.kind !== "premiumRequired"),
      );
    } else {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: textToSend,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInputText("");
    }

    try {
      // Server uses this to pick reply language + translate data labels.
      const locale = i18n.language?.startsWith("en") ? "en" : "tr";
      const response = await sendMutation.mutateAsync({ message: textToSend, locale });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.reply,
        timestamp: response.timestamp,
        kind: "normal",
      };
      setMessages((prev) => [...prev, assistantMessage]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // tRPC attaches `data.code` and exposes the server `message` string.
      const trpcCode = (error as any)?.data?.code as string | undefined;
      const trpcMessage = (error as any)?.message as string | undefined;

      if (trpcCode === "FORBIDDEN" && trpcMessage === "PREMIUM_REQUIRED") {
        const premiumMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: t("chat.premiumRequiredBody"),
          timestamp: new Date().toISOString(),
          kind: "premiumRequired",
          retryPrompt: textToSend,
        };
        setMessages((prev) => [...prev, premiumMessage]);
        return;
      }

      // Unexpected server / network / LLM failure — capture for observability.
      const isKnownServerError =
        trpcMessage === "LLM_UNAVAILABLE" || trpcMessage === "LLM_EMPTY_RESPONSE";
      captureException(
        error instanceof Error ? error : new Error(trpcMessage || "chat.send failed"),
        {
          surface: "chat",
          trpcCode: trpcCode ?? null,
          trpcMessage: trpcMessage ?? null,
          isKnownServerError,
        },
      );

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: isKnownServerError ? t("chat.errorUnavailable") : t("chat.errorMessage"),
        timestamp: new Date().toISOString(),
        kind: "error",
        retryPrompt: textToSend,
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleQuickReply = (reply: string) => {
    handleSend(reply);
  };

  const handleRetry = (prompt: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleSend(prompt, { isRetry: true });
  };

  const handleGoPremium = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/premium");
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const isError = item.kind === "error";
    const isPremium = item.kind === "premiumRequired";
    const showsRetry = isError && !!item.retryPrompt;
    const showsPremiumCta = isPremium;

    const bubbleBg = isUser
      ? colors.primary
      : isError
        ? colors.surface
        : colors.surface;
    const bubbleBorder = isError ? colors.error : colors.border;

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
            backgroundColor: bubbleBg,
            borderWidth: isUser ? 0 : isError ? 1 : 0.5,
            borderColor: isUser ? undefined : bubbleBorder,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderBottomRightRadius: isUser ? 4 : 12,
            borderBottomLeftRadius: isUser ? 12 : 4,
          }}
        >
          {isPremium && (
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: colors.accent,
                marginBottom: 4,
              }}
            >
              {t("chat.premiumRequiredTitle")}
            </Text>
          )}
          <Text
            style={{
              fontSize: 16,
              lineHeight: 22,
              color: isUser ? "white" : isError ? colors.error : colors.foreground,
            }}
          >
            {item.content}
          </Text>
        </View>

        {showsRetry && (
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={t("chat.retry")}
            onPress={() => handleRetry(item.retryPrompt!)}
            disabled={sendMutation.isPending}
            style={({ pressed }) => ({
              marginTop: 6,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
              opacity: sendMutation.isPending ? 0.5 : pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.primary }}>
              {t("chat.retry")}
            </Text>
          </Pressable>
        )}

        {showsPremiumCta && (
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={t("chat.premiumCta")}
            onPress={handleGoPremium}
            style={({ pressed }) => ({
              marginTop: 8,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 10,
              backgroundColor: colors.accent,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: "white" }}>
              {t("chat.premiumCta")}
            </Text>
          </Pressable>
        )}

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
            {t("chat.title")}
          </Text>
        </View>

        {/* Messages */}
        {messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Text style={{ fontSize: 32 }}>◻</Text></View>
            <Text style={{ fontSize: 16, fontWeight: "500", color: colors.muted, textAlign: "center", marginBottom: 24 }}>
              {t("chat.subtitle")}
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
