import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** 捕获子组件渲染错误，避免整页白屏；商用稳定性要求 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[200px] flex items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="text-center max-w-md">
            <AlertTriangle className="mx-auto text-amber-500 mb-4" size={48} />
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              {this.props.fallbackTitle ?? '页面出现错误'}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              请刷新页面重试。若问题持续，请联系支持。
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-medium"
            >
              <RefreshCw size={16} /> 刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
