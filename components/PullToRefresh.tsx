"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { RefreshIcon } from "@/components/ui/Icons";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { colors } from "@/lib/theme";

/** Finger travel (px) needed to arm a refresh. */
const THRESHOLD = 68;
/** Hard cap on how far the content follows the finger. */
const MAX_PULL = 96;
/** Where the spinner rests while the refresh runs. */
const REST = 52;
/** Drag is damped so the pull feels elastic. */
const DAMP = 0.55;

interface PullToRefreshProps {
  /** When false the wrapper is a plain scroll container (no gesture / button). */
  enabled: boolean;
  /** Re-fetch the data. Awaited so the spinner stays up until it settles. */
  onRefresh: () => Promise<void> | void;
  /** Applied to the inner scroll element (e.g. the shared `.scr` class). */
  className?: string;
  /** Extra style merged onto the inner scroll element. */
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Scroll container with pull-to-refresh. On touch devices, pulling down from the
 * top arms a refresh; on the web (no coarse pointer) a floating button triggers
 * the same refresh instead. Drop-in replacement for the shells' `.scr` div.
 */
export function PullToRefresh({ enabled, onRefresh, className, style, children }: PullToRefreshProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Touch bookkeeping kept in refs so the native listeners never see stale state.
  const startY = useRef(0);
  const active = useRef(false);
  const pullRef = useRef(0);
  const busy = useRef(false);

  const isTouch = useMediaQuery("(pointer: coarse)");
  const showButton = enabled && !isTouch;

  const setPullBoth = (v: number) => {
    pullRef.current = v;
    setPull(v);
  };

  const runRefresh = async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    setPullBoth(REST);
    try {
      await onRefresh();
    } finally {
      busy.current = false;
      setRefreshing(false);
      setPulling(false);
      setPullBoth(0);
    }
  };
  // Keep the latest closure reachable from the (once-attached) touch listeners.
  const runRef = useRef(runRefresh);
  useEffect(() => {
    runRef.current = runRefresh;
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    const onStart = (e: TouchEvent) => {
      if (busy.current || e.touches.length !== 1) return;
      active.current = el.scrollTop <= 0;
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (!active.current || busy.current) return;
      if (el.scrollTop > 0) {
        active.current = false;
        if (pullRef.current) setPullBoth(0);
        setPulling(false);
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        if (pullRef.current) setPullBoth(0);
        setPulling(false);
        return;
      }
      // Owning the gesture: stop the native scroll/overscroll while we pull.
      e.preventDefault();
      setPulling(true);
      setPullBoth(Math.min(MAX_PULL, dy * DAMP));
    };
    const onEnd = () => {
      if (!active.current) return;
      active.current = false;
      if (pullRef.current >= THRESHOLD) {
        void runRef.current();
      } else {
        setPulling(false);
        setPullBoth(0);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled]);

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {enabled && (pull > 0 || refreshing) && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: REST,
            display: "grid",
            placeItems: "center",
            transform: `translateY(${pull - REST}px)`,
            transition: pulling ? "none" : "transform 0.22s ease",
            opacity: Math.min(1, pull / THRESHOLD),
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: colors.surface,
              border: `1px solid ${colors.hairline}`,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 8px 20px -8px rgba(0,0,0,0.7)",
            }}
          >
            <RefreshIcon
              size={18}
              color={pull >= THRESHOLD || refreshing ? colors.info : colors.textMuted}
              style={{
                transform: refreshing ? undefined : `rotate(${(pull / THRESHOLD) * 270}deg)`,
                animation: refreshing ? "tribuSpin 0.8s linear infinite" : undefined,
              }}
            />
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className={className}
        style={{ flex: 1, overflowY: "auto", overflowX: "hidden", ...style }}
      >
        <div
          style={{
            transform: pull > 0 ? `translateY(${pull}px)` : undefined,
            transition: pulling ? "none" : "transform 0.22s ease",
          }}
        >
          {children}
        </div>
      </div>

      {showButton && (
        <button
          type="button"
          onClick={() => void runRef.current()}
          disabled={refreshing}
          aria-label="Actualizar"
          title="Actualizar"
          style={{
            position: "absolute",
            left: 18,
            bottom: 18,
            width: 46,
            height: 46,
            borderRadius: 14,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            display: "grid",
            placeItems: "center",
            cursor: refreshing ? "default" : "pointer",
            boxShadow: "0 10px 26px -10px rgba(0,0,0,0.7)",
            zIndex: 6,
          }}
        >
          <RefreshIcon
            size={20}
            color={colors.textSecondary}
            style={{ animation: refreshing ? "tribuSpin 0.8s linear infinite" : undefined }}
          />
        </button>
      )}
    </div>
  );
}
