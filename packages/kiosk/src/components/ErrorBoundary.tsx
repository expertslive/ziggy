import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <p className="text-el-light/60 text-lg text-center">
            Something went wrong.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-6 py-3 bg-el-blue text-white rounded-xl font-bold active:scale-[0.96]"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
