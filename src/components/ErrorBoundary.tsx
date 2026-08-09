"use client";
import React from "react";
import { RotateCcw } from "lucide-react";

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: "100dvh", background: "#030208", display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 20, padding: 24, textAlign: "center",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "rgba(212,175,55,0.1)", border: "1.5px solid rgba(212,175,55,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <RotateCcw size={26} style={{ color: "rgba(212,175,55,0.6)" }} />
        </div>
        <div>
          <p style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
            Algo salió mal
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
            Ocurrió un error inesperado. Recarga la página para continuar.
          </p>
        </div>
        <button
          onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
          style={{
            padding: "12px 28px", borderRadius: 14, fontSize: 14, fontWeight: 700,
            color: "#030208", background: "linear-gradient(135deg,#f0c040,#c8902a)",
            border: "none", cursor: "pointer",
            boxShadow: "0 6px 20px rgba(212,175,55,0.35)",
          }}>
          Recargar
        </button>
      </div>
    );
  }
}
