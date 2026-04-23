import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
          <div className="bg-slate-800 p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-700">
            <div className="w-16 h-16 bg-red-900/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Xəta baş verdi</h2>
            <p className="text-slate-400 mb-6 text-sm">
              Sistemdə gözlənilməz bir xəta baş verdi. Zəhmət olmasa səhifəni yeniləyin və ya daha sonra təkrar cəhd edin.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-cyan-600 transition-colors"
            >
              Səhifəni Yenilə
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
