import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { GAME_TEXT } from "@/feedback/copy";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** A new value means there is something new to draw, so the screen is worth trying again. */
  resetKey: unknown;
  onResync: () => void;
}

interface ErrorBoundaryState {
  failed: boolean;
}

// NFR-SYS-03: a crash shows a way back instead of a blank page. This is the project's one class
// component, because React has no way to write an error boundary as a function.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("The game screen crashed.", error, info.componentStack);
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  // The store drops a snapshot with the version it already has (CLAUDE.md §4), so a bad snapshot
  // can only be replaced by a newer one. Until then this draws the same one and may land here again.
  private retry = (): void => {
    this.props.onResync();
    this.setState({ failed: false });
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
        <p role="alert" className="text-center text-xl font-semibold text-high">
          {GAME_TEXT.crashed}
        </p>
        <Button onClick={this.retry}>{GAME_TEXT.retry}</Button>
      </main>
    );
  }
}
