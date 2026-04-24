import React from "react";
import { View, Text, Pressable } from "react-native";
import * as Sentry from "@sentry/react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/use-colors";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryClassProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Copy + theme injected from the functional wrapper so the class
   *  component can access useColors/useTranslation results without hooks. */
  title: string;
  subtitle: string;
  retryLabel: string;
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  primary: string;
  background: string;
}

/**
 * Error Boundary — catches unhandled render errors and reports to Sentry.
 * Wrap critical subtrees (screens, heavy components) with this component.
 *
 * Bu class component; React hooks (useColors, useTranslation) class içinde
 * kullanılamaz. Bunun yerine functional wrapper (`ErrorBoundary`) hook'ları
 * okuyup theme token'larını + localized copy'yi class'a prop olarak geçer.
 * Bu pattern sayesinde fallback render dinamik kalır:
 *   - dark/light mode theme doğru
 *   - TR/EN copy doğru (önceden hardcoded Türkçe idi → EN user karışıyordu)
 *   - brand palette doğru (önceden stale amber/green skill'in varsayılanı
 *     vardı; PALIMPS gerçek mor/lavender paletten kopuk bir kaza ekranıydı)
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <MyScreen />
 * </ErrorBoundary>
 * ```
 */
class ErrorBoundaryClass extends React.Component<ErrorBoundaryClassProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryClassProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { title, subtitle, retryLabel, background, fg, muted, primary } = this.props;

      return (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            backgroundColor: background,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: fg,
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: muted,
              marginBottom: 24,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            {subtitle}
          </Text>
          <Pressable
            onPress={this.handleReset}
            style={({ pressed }) => [
              {
                backgroundColor: primary,
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 12,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={retryLabel}
          >
            <Text
              style={{
                color: "white",
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              {retryLabel}
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const colors = useColors();
  const { t } = useTranslation();

  // i18n'in kendisi boot sırasında fail ederse (useErrorBoundary başlatmadan
  // önceki window), t() key'i return eder (string fallback). Kaza ekranı
  // yine görünür kalır; key string'i "Bir şeyler yanlış gitti" yerine
  // "errors.unhandled.title" gösterir — ideal değil ama crash loop yok.
  return (
    <ErrorBoundaryClass
      title={t("errors.unhandled.title")}
      subtitle={t("errors.unhandled.subtitle")}
      retryLabel={t("errors.unhandled.retry")}
      bg={colors.background}
      surface={colors.surface}
      fg={colors.foreground}
      muted={colors.muted}
      primary={colors.primary}
      background={colors.background}
      fallback={fallback}
    >
      {children}
    </ErrorBoundaryClass>
  );
}
