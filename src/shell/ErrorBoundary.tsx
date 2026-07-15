import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Shown in the fallback heading/button, e.g. "Ear Trainer" or a topic's title. */
  label: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** Bumped on reset so the wrapped subtree remounts fresh instead of re-rendering the same crashed instance. */
  resetCount: number;
}

// Contains a render crash to the boundary it wraps instead of white-screening
// the whole app (docs/09-improvement-plan.md §11.1). One instance wraps the
// whole router in App.tsx; one wraps each topic's Component in TopicHost so
// a single topic crashing can't take down the others that stay mounted (D9a).
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.label}] crashed:`, error, info.componentStack);
  }

  private reset = (): void => {
    this.setState((s) => ({ error: null, resetCount: s.resetCount + 1 }));
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <section className="card">
          <h2>{this.props.label} hit an error</h2>
          <p className="status error">{this.state.error.message || 'Something went wrong.'}</p>
          <div className="buttons">
            <button type="button" onClick={this.reset}>
              Reload {this.props.label}
            </button>
          </div>
        </section>
      );
    }
    return <div key={this.state.resetCount}>{this.props.children}</div>;
  }
}
