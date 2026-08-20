import { Component, type ReactNode } from "react";

/**
 * Isolates the analytics/chart area so a failure there degrades to a small
 * note instead of blanking the whole dashboard.
 */
export class StatsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[StatsBoundary]", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-xl bg-surface p-3 text-xs font-medium text-muted-foreground shadow-card">
          Stats unavailable right now.
        </div>
      );
    }
    return this.props.children;
  }
}
