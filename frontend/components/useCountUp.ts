"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

type CountUpOptions = {
  /** Seconds. */
  duration?: number;
  /** Decimal places to render. */
  decimals?: number;
  /** Delay before the animation starts, in seconds. */
  delay?: number;
};

/**
 * Animate a number from its previous value up (or down) to `value` whenever it
 * changes. Returns the formatted, in-flight value as a string so callers can
 * render tabular figures without layout shift.
 */
export function useCountUp(value: number, options: CountUpOptions = {}): string {
  const { duration = 1.1, decimals = 0, delay = 0 } = options;
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const controls = animate(from, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1], // soft, decelerating ease-out
      onUpdate: (latest) => setDisplay(latest),
    });
    fromRef.current = value;
    return () => controls.stop();
  }, [value, duration, delay]);

  return display.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
