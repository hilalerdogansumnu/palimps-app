import { View, Text, FlatList, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useState, useMemo } from "react";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";

import { AssistantMessage } from "@/components/assistant-message";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useSubscription } from "@/hooks/use-subscription";
import { captureException } from "@/lib/_core/sentry";

// "quotaExhausted" = free user 10 lifetime Hafıza sorusunu tüketti; upsell CTA
// renderlanır. Legacy "premiumRequired" kind'ini artık üretmiyoruz — free user
// artık asistana erişebiliyor — ama copy/CTA tasarımı aynı olduğu için tek
// "upsell" kolunu kullanıyoruz.
type MessageKind = "normal" | "error" | "quotaExhausted";

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
  const { isPremium, isFree } = useSubscription();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");

  const QUICK_REPLIES = useMemo(() => [
    t("chat.example1"),
    t("chat.example2"),
    t("chat.example3"),
    t("chat.example4"),
  ], [t]);

  // Hafıza kullanım sayacı — sadece free user için. İlk açılışta server'dan
  // gelen usage ile dolar; her başarılı mesajda response.quotaRemaining ile
  // düşer. Pro user için query enabled değil → network noise yok.
  const usageQuery = trpc.subscriptions.usage.useQuery(undefined, {
    enabled: isFree,
    staleTime: 30_000,
  });
  const serverRemaining =
    usageQuery.data && usageQuery.data.isPremium === false
      ? Math.max(0, usageQuery.data.assistantQuestions.limit - usageQuery.data.assistantQuestions.used)
      : null;
  const [localRemaining, setLocalRemaining] = useState<number | null>(null);
  const remainingQuestions = localRemaining ?? serverRemaining;

  const sendMutation = trpc.chat.send.useMutation();

  const handleSend = async (message?: string, options?: { isRetry?: boolean }) => {
    const textToSend = (message || inputText.trim()).trim();
    if (!textToSend) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // On retry, drop prior error/upsell cards so the transcript doesn't
    // accumulate dead system messages.
    if (options?.isRetry) {
      setMessages((prev) =>
        prev.filter((m) => m.kind !== "error" && m.kind !== "quotaExhausted"),
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
      // Server free user için quotaRemaining döner; optimistic UI update
      // (query refetch beklemeden sayacı düşür). Pro user için null.
      if (typeof response.quotaRemaining === "number") {
        setLocalRemaining(response.quotaRemaining);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // tRPC attaches `data.code` and exposes the server `message` string.
      const trpcCode = (error as any)?.data?.code as string | undefined;
      const trpcMessage = (error as any)?.message as string | undefined;

      // 50325: Free user lifetime 10 Hafıza sorusunu tüketti. Upsell CTA'lı
      // in-transcript kart göster; retry yok (cap absolute). Pro upgrade
      // route.push('/premium') → CTA üzerinden.
      if (trpcCode === "FORBIDDEN" && trpcMessage === "ASSISTANT_QUOTA_EXHAUSTED") {
        const quotaMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: t("freemium.assistantQuota.body"),
          timestamp: new Date().toISOString(),
          kind: "quotaExhausted",
        };
        setMessages((prev) => [...prev, quotaMessage]);
        setLocalRemaining(0);
        return;
      }

      // Rate limit (saatlik 20 mesaj tavanı). Retry affordance eklemiyoruz —
      // saat içinde tekrar denemek yine fail eder, retry haptic spam'i olur.
      const isRateLimit =
        trpcCode === "TOO_MANY_REQUESTS" || trpcMessage === "RATE_LIMIT_EXCEEDED";
      if (isRateLimit) {
        const rateLimitMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: t("chat.errorRateLimit"),
          timestamp: new Date().toISOString(),
          kind: "error",
        };
        setMessages((prev) => [...prev, rateLimitMessage]);
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

  // 26 Nis 2026 UI redesign (Hilal onayı, "Yön B refined"):
  // - User mesajı: sağda mor balon (korunur)
  // - Asistan normal cevap: balonsuz, AssistantMessage component'i
  //   parse'lar ve uygun kart/prose render'ı seçer
  // - Error/quota cevapları: küçük surface balonda kalır (kart paradigmasına
  //   girmez, sistem mesajı niteliğinde)
  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const isError = item.kind === "error";
    const isQuotaUpsell = item.kind === "quotaExhausted";
    const isSystemCard = isError || isQuotaUpsell;
    const showsRetry = isError && !!item.retryPrompt;
    const showsPremiumCta = isQuotaUpsell;

    const timestamp = new Date(item.timestamp).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // User mesajı — sağda mor balon
    if (isUser) {
      return (
        <View
          style={{
            marginBottom: 14,
            alignItems: "flex-end",
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              maxWidth: "78%",
              backgroundColor: colors.primary,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ fontSize: 15, lineHeight: 21, color: "white" }}>
              {item.content}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 11,
              color: colors.muted,
              marginTop: 3,
              paddingHorizontal: 4,
            }}
          >
            {timestamp}
          </Text>
        </View>
      );
    }

    // Sistem kartı (error / quota upsell) — kart, sola yaslı, surface balon
    if (isSystemCard) {
      return (
        <View style={{ marginBottom: 14, paddingHorizontal: 16, alignItems: "flex-start" }}>
          <View
            style={{
              maxWidth: "85%",
              backgroundColor: colors.surface,
              borderWidth: isError ? 1 : 0.5,
              borderColor: isError ? colors.error : colors.border,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            {isQuotaUpsell && (
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: colors.accent,
                  marginBottom: 4,
                }}
              >
                {t("freemium.assistantQuota.title")}
              </Text>
            )}
            <Text
              style={{
                fontSize: 15,
                lineHeight: 21,
                color: isError ? colors.error : colors.foreground,
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
              fontSize: 11,
              color: colors.muted,
              marginTop: 3,
              paddingHorizontal: 4,
            }}
          >
            {timestamp}
          </Text>
        </View>
      );
    }

    // Asistan normal cevap — balonsuz, AssistantMessage parse'lar ve render'lar
    return (
      <View style={{ marginBottom: 18, alignItems: "flex-start" }}>
        <AssistantMessage content={item.content} />
        <Text
          style={{
            fontSize: 11,
            color: colors.muted,
            marginTop: 4,
            paddingHorizontal: 18,
          }}
        >
          {timestamp}
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
        {/* Header — "Asistan" başlık (50332 versiyonuna geri dönüş, 25 Nis
            2026 dogfood: Eco voice cevap kalitesinde regresyon yarattı,
            legacy CHAT_SYSTEM_PROMPT'a dönüldü, UI eşlendi). Tagline kaldırıldı. */}
        <View style={{ paddingVertical: 16, alignItems: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>
            {t("chat.title")}
          </Text>
          {/* Free user sayacı — Linear tarzı: sessiz, fonksiyonel, kaygı yaratmayan.
              Sayı bittiğinde (0) da göster çünkü kullanıcı neden gönderemediğini anlasın. */}
          {!isPremium && remainingQuestions !== null && (
            <Text
              accessible
              accessibilityRole="text"
              style={{
                fontSize: 12,
                color: colors.muted,
                marginTop: 2,
              }}
            >
              {t("freemium.assistantQuota.remaining", { count: remainingQuestions })}
            </Text>
          )}
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
