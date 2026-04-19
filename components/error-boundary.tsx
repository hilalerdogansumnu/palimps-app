import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Sentry from "@sentry/react-native";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Error Boundary — catches unhandled render errors and reports to Sentry.
 * Wrap critical subtrees (screens, heavy components) with this component.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <MyScreen />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
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

      const err = this.state.error;
      const errMsg = err?.message ?? String(err);
      const errStack = err?.stack ?? "(no stack)";
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Bir şeyler yanlış gitti</Text>
          <Text style={styles.subtitle}>
            Bu sorun otomatik olarak raporlandı.
          </Text>
          {/* TEMP: surface the real error so we can diagnose post-login crash */}
          <View style={styles.debugBox}>
            <Text style={styles.debugLabel}>Error:</Text>
            <Text style={styles.debugText} selectable>{errMsg}</Text>
            <Text style={[styles.debugLabel, { marginTop: 8 }]}>Stack (first 500 chars):</Text>
            <Text style={styles.debugText} selectable>{errStack.slice(0, 500)}</Text>
          </View>
          <Pressable
            onPress={this.handleReset}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Tekrar dene"
          >
            <Text style={styles.buttonText}>Tekrar Dene</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#FFFDF7",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2D2A26",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B6560",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#3D7A5F",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: "#FFFDF7",
    fontSize: 15,
    fontWeight: "600",
  },
  debugBox: {
    backgroundColor: "#F5F0E8",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    width: "100%",
    maxHeight: 300,
  },
  debugLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B6560",
  },
  debugText: {
    fontSize: 11,
    fontFamily: "Menlo",
    color: "#2D2A26",
  },
});
