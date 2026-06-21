'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="mb-2 font-heading text-xl font-bold text-white">Something went wrong</h2>
          <p className="mb-6 max-w-md text-sm text-text-secondary">
            An unexpected error occurred. Please refresh the page or try again later.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="rounded-lg bg-teal-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-600"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
