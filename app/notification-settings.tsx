import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Switch,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";

import { ScreenContainer } from "@/components/screen-container";
import { NavigationBar } from "@/components/navigation-bar";
import { useColors } from "@/hooks/use-colors";

const SETTINGS_KEY = "notification_settings";

// Notification identifier constants
const NOTIF_DAILY_REMINDER = "palimps_daily_reminder";
const NOTIF_WEEKLY_SUMMARY = "palimps_weekly_summary";

interface NotificationSettings {
  dailyReminder: boolean;
  dailyReminderHour: number;
  streakAlert: boolean;
  weeklySummary: boolean;
  weeklySummaryDay: number; // 0=Sun, 1=Mon ... 6=Sat
}

const DEFAULT_SETTINGS: NotificationSettings = {
  dailyReminder: true,
  dailyReminderHour: 21,
  streakAlert: true,
  weeklySummary: true,
  weeklySummaryDay: 0, // Sunday
};

// Day short-name keys in notifications.days.* — order matches JS Date.getDay()
// (0=Sun ... 6=Sat) so indexing with weeklySummaryDay is direct.
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

// Configure notification handler (idempotent)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Schedule or cancel the daily reminder local notification.
 * Uses a repeating calendar trigger at the specified hour.
 * Title/body are passed in from the screen so we use the active locale.
 */
async function scheduleDailyReminder(hour: number, title: string, body: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIF_DAILY_REMINDER).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIF_DAILY_REMINDER,
    content: { title, body, sound: false },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute: 0,
      repeats: true,
    },
  });
}

/**
 * Schedule or cancel the weekly summary local notification.
 * Uses a repeating weekly calendar trigger on the specified weekday.
 */
async function scheduleWeeklySummary(weekday: number, title: string, body: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIF_WEEKLY_SUMMARY).catch(() => {});

  // expo-notifications weekday: 1=Sun, 2=Mon ... 7=Sat
  const expoWeekday = weekday + 1;

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIF_WEEKLY_SUMMARY,
    content: { title, body, sound: false },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      weekday: expoWeekday,
      hour: 9,
      minute: 0,
      repeats: true,
    },
  });
}

/**
 * Cancel a scheduled notification by identifier.
 */
async function cancelNotification(identifier: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
}

export default function NotificationSettingsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  useEffect(() => {
    loadSettings();
    checkPermission();
  }, []);

  const checkPermission = async () => {
    if (Platform.OS === "web") {
      setPermissionGranted(true);
      return;
    }
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionGranted(status === "granted");
  };

  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS === "web") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    const granted = status === "granted";
    setPermissionGranted(granted);
    if (!granted) {
      Alert.alert(
        t("notifications.permissionTitle"),
        t("notifications.permissionMessage"),
        [{ text: t("common.done") }]
      );
    }
    return granted;
  };

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch {
      // use defaults
    }
  };

  /**
   * Persist settings and re-schedule notifications accordingly.
   */
  const applySettings = useCallback(async (updated: NotificationSettings) => {
    setSettings(updated);
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Daily reminder — push copy comes from active locale
      if (updated.dailyReminder) {
        await scheduleDailyReminder(
          updated.dailyReminderHour,
          t("notifications.dailyPushTitle"),
          t("notifications.dailyPushBody"),
        );
      } else {
        await cancelNotification(NOTIF_DAILY_REMINDER);
      }

      // Weekly summary
      if (updated.weeklySummary) {
        await scheduleWeeklySummary(
          updated.weeklySummaryDay,
          t("notifications.weeklyPushTitle"),
          t("notifications.weeklyPushBody"),
        );
      } else {
        await cancelNotification(NOTIF_WEEKLY_SUMMARY);
      }

      // Streak alert: scheduled externally when a moment is saved (22h window).
      // Here we just persist the preference; actual scheduling is in add-moment flow.
    }
  }, [t]);

  const toggleSetting = async (key: keyof NotificationSettings, value: boolean) => {
    if (value && !permissionGranted) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    await applySettings({ ...settings, [key]: value });
  };

  // 24h format is unambiguous in both TR and EN and avoids AM/PM i18n.
  // e.g. 21 -> "21:00", 9 -> "09:00"
  const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

  const handleHourChange = async (direction: "up" | "down") => {
    const current = settings.dailyReminderHour;
    const next = direction === "up" ? (current + 1) % 24 : (current + 23) % 24;
    await applySettings({ ...settings, dailyReminderHour: next });
  };

  const handleDayChange = async (direction: "up" | "down") => {
    const current = settings.weeklySummaryDay;
    const next = direction === "up" ? (current + 1) % 7 : (current + 6) % 7;
    await applySettings({ ...settings, weeklySummaryDay: next });
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <NavigationBar
        title={t("notifications.title")}
        backLabel={t("profile.title")}
        onBack={() => router.back()}
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>

          {/* Permission Banner */}
          {permissionGranted === false && (
            <Pressable
              onPress={requestPermission}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.warning + "18",
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 24,
                  borderWidth: 1,
                  borderColor: colors.warning + "44",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("notifications.permissionTitle")}
              accessibilityHint={t("notifications.permissionHint")}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.warning, marginBottom: 4 }}>
                {t("notifications.permissionTitle")}
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
                {t("notifications.permissionBanner")}
              </Text>
            </Pressable>
          )}

          {/* Daily Reminder */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.muted,
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              {t("notifications.dailySection")}
            </Text>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                overflow: "hidden",
                borderWidth: 0.5,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottomWidth: settings.dailyReminder ? 0.5 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: "500" }}>
                    {t("notifications.dailyReminder")}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                    {t("notifications.dailyReminderDesc")}
                  </Text>
                </View>
                <Switch
                  value={settings.dailyReminder}
                  onValueChange={(v) => toggleSetting("dailyReminder", v)}
                  trackColor={{ false: colors.border, true: colors.primary + "99" }}
                  thumbColor={settings.dailyReminder ? colors.primary : colors.muted}
                  accessible
                  accessibilityLabel={t("notifications.dailyReminder")}
                  accessibilityRole="switch"
                />
              </View>

              {settings.dailyReminder && (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 15, color: colors.muted }}>
                    {t("notifications.reminderTime")}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pressable
                      onPress={() => handleHourChange("down")}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={({ pressed }) => [{ opacity: pressed ? 0.4 : 1 }]}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={t("notifications.a11y.hourDecrease")}
                    >
                      <Text style={{ fontSize: 20, color: colors.primary, fontWeight: "300" }}>‹</Text>
                    </Pressable>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground, minWidth: 72, textAlign: "center" }}>
                      {formatHour(settings.dailyReminderHour)}
                    </Text>
                    <Pressable
                      onPress={() => handleHourChange("up")}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={({ pressed }) => [{ opacity: pressed ? 0.4 : 1 }]}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={t("notifications.a11y.hourIncrease")}
                    >
                      <Text style={{ fontSize: 20, color: colors.primary, fontWeight: "300" }}>›</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Streak Alert */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.muted,
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              {t("notifications.streakSection")}
            </Text>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                overflow: "hidden",
                borderWidth: 0.5,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: "500" }}>
                    {t("notifications.streakAlert")}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                    {t("notifications.streakAlertDesc")}
                  </Text>
                </View>
                <Switch
                  value={settings.streakAlert}
                  onValueChange={(v) => toggleSetting("streakAlert", v)}
                  trackColor={{ false: colors.border, true: colors.primary + "99" }}
                  thumbColor={settings.streakAlert ? colors.primary : colors.muted}
                  accessible
                  accessibilityLabel={t("notifications.streakAlert")}
                  accessibilityRole="switch"
                />
              </View>
            </View>
          </View>

          {/* Weekly Summary */}
          <View style={{ marginBottom: 40 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.muted,
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              {t("notifications.weeklySection")}
            </Text>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                overflow: "hidden",
                borderWidth: 0.5,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottomWidth: settings.weeklySummary ? 0.5 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: "500" }}>
                    {t("notifications.weeklySummary")}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                    {t("notifications.weeklySummaryDesc")}
                  </Text>
                </View>
                <Switch
                  value={settings.weeklySummary}
                  onValueChange={(v) => toggleSetting("weeklySummary", v)}
                  trackColor={{ false: colors.border, true: colors.primary + "99" }}
                  thumbColor={settings.weeklySummary ? colors.primary : colors.muted}
                  accessible
                  accessibilityLabel={t("notifications.weeklySummary")}
                  accessibilityRole="switch"
                />
              </View>

              {settings.weeklySummary && (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 15, color: colors.muted }}>
                    {t("notifications.summaryDay")}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pressable
                      onPress={() => handleDayChange("down")}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={({ pressed }) => [{ opacity: pressed ? 0.4 : 1 }]}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={t("notifications.a11y.dayPrev")}
                    >
                      <Text style={{ fontSize: 20, color: colors.primary, fontWeight: "300" }}>‹</Text>
                    </Pressable>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground, minWidth: 40, textAlign: "center" }}>
                      {t(`notifications.days.${DAY_KEYS[settings.weeklySummaryDay]}`)}
                    </Text>
                    <Pressable
                      onPress={() => handleDayChange("up")}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={({ pressed }) => [{ opacity: pressed ? 0.4 : 1 }]}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={t("notifications.a11y.dayNext")}
                    >
                      <Text style={{ fontSize: 20, color: colors.primary, fontWeight: "300" }}>›</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>

        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
