"use client";
import { Component, ReactNode } from "react";
import { TreePine, RefreshCw } from "lucide-react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export default class TreeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-[420px] rounded-2xl bg-gray-900 flex flex-col items-center justify-center gap-4 text-center px-6">
          <TreePine size={40} className="text-ceiba-400 opacity-50" />
          <div>
            <p className="text-white font-semibold mb-1">El árbol no pudo cargarse</p>
            <p className="text-gray-400 text-sm">Intenta recargar la página</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-ceiba-700 hover:bg-ceiba-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={14} /> Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
