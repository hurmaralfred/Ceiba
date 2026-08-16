"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props {
  senderName: string;
  senderPhoto: string | null;
  message: string;
  roomId: string;
  onDismiss: () => void;
}

const DURATION_MS = 6000;

export function ChatBubbleNotification({ senderName, senderPhoto, message, roomId, onDismiss }: Props) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismissRef.current(), DURATION_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const go = () => {
    onDismiss();
    router.push(`/chat/${roomId}`);
  };

  const initial = (senderName?.[0] ?? "?").toUpperCase();
  const preview = message.length > 72 ? message.slice(0, 69) + "…" : message;

  return (
    <>
      <style>{`
        @keyframes nb-enter {
          0%   { opacity:0; transform:translateX(110%) translateY(-6px) scale(0.88); }
          60%  { opacity:1; transform:translateX(-8px)  translateY(2px)  scale(1.02); }
          100% { opacity:1; transform:translateX(0)     translateY(0)    scale(1); }
        }
        @keyframes nb-trail {
          0%   { opacity:1; width:90px; }
          100% { opacity:0; width:0; }
        }
        @keyframes nb-timer {
          from { transform:scaleX(1); }
          to   { transform:scaleX(0); }
        }
        @keyframes nb-star {
          0%,100% { opacity:0.65; transform:scale(1); }
          50%     { opacity:1;    transform:scale(1.5);
                    filter:drop-shadow(0 0 4px rgba(242,180,60,0.95)); }
        }
        @keyframes nb-avatar-glow {
          0%,100% { box-shadow:0 0 10px rgba(242,180,60,0.20); }
          50%     { box-shadow:0 0 22px rgba(242,180,60,0.55); }
        }
      `}</style>

      {/* Comet trail — decorative, appears just before card */}
      <div style={{
        position:"fixed", top:76, right:0, zIndex:9990,
        display:"flex", alignItems:"center", pointerEvents:"none",
      }}>
        <div style={{
          height:2, borderRadius:1,
          background:"linear-gradient(to right, transparent 0%, rgba(242,180,60,0.70) 100%)",
          animation:`nb-trail 0.45s ease-out 0.05s both`,
        }} />
      </div>

      {/* Card */}
      <div
        onClick={go}
        style={{
          position:"fixed", top:64, right:12, zIndex:9991,
          width:"min(340px, calc(100vw - 24px))",
          background:"rgba(7,4,16,0.97)",
          backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)",
          borderRadius:22,
          borderTop:"1px solid rgba(242,180,60,0.50)",
          borderLeft:"1px solid rgba(242,180,60,0.18)",
          borderRight:"0.5px solid rgba(0,0,0,0.7)",
          borderBottom:"2px solid rgba(0,0,0,0.8)",
          boxShadow:"0 0 0 0.5px rgba(242,180,60,0.10), 0 12px 48px rgba(0,0,0,0.75), 0 0 32px rgba(242,180,60,0.07)",
          overflow:"hidden",
          cursor:"pointer",
          animation:"nb-enter 0.40s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* Progress bar — shrinks left-to-right */}
        <div style={{
          height:2.5,
          background:"linear-gradient(to right, rgba(242,180,60,0.95), rgba(200,140,40,0.6))",
          transformOrigin:"left center",
          animation:`nb-timer ${DURATION_MS}ms linear both`,
        }} />

        {/* Body */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 14px 15px" }}>

          {/* Avatar */}
          <div style={{
            width:46, height:46, borderRadius:"50%", flexShrink:0,
            background:"radial-gradient(circle at 35% 28%, rgba(242,180,60,0.25) 0%, rgba(6,3,14,0.98) 65%)",
            border:"1.5px solid rgba(242,180,60,0.40)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:17, fontWeight:700, color:"#F2B43C",
            overflow:"hidden",
            animation:"nb-avatar-glow 2.2s ease-in-out infinite",
          }}>
            {senderPhoto
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={senderPhoto} alt={senderName}
                  style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              : initial}
          </div>

          {/* Text */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
              <div style={{ fontSize:9, lineHeight:1, animation:"nb-star 2s ease-in-out infinite",
                filter:"drop-shadow(0 0 3px rgba(242,180,60,0.7))" }}>✦</div>
              <span style={{ fontSize:13.5, fontWeight:700, color:"#F5EDD8" }}>{senderName}</span>
            </div>
            <p style={{
              fontSize:13, color:"rgba(255,255,255,0.68)", margin:0,
              lineHeight:1.45,
              display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical",
              overflow:"hidden",
            }}>{preview}</p>
          </div>

          {/* Dismiss × */}
          <button
            onClick={e => { e.stopPropagation(); onDismiss(); }}
            style={{
              background:"none", border:"none", cursor:"pointer",
              padding:"4px 6px", flexShrink:0, alignSelf:"flex-start",
              color:"rgba(255,255,255,0.22)", fontSize:18, lineHeight:1,
            }}>×</button>
        </div>
      </div>
    </>
  );
}
