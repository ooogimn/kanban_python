import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans"
          role="alert"
        >
          <h1 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
            Произошла ошибка
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 max-w-lg">
            {this.state.error.message}
          </p>
          {this.state.errorInfo?.componentStack && (
            <pre className="text-xs bg-slate-200 dark:bg-slate-800 p-4 rounded overflow-auto max-h-48 max-w-2xl">
              {this.state.errorInfo.componentStack}
            </pre>
          )}
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
