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

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Bir şeyler yanlış gitti</Text>
          <Text style={styles.subtitle}>
            Bu sorun otomatik olarak raporlandı.
          </Text>
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
});
