/**
 * NumericInput — Text input that behaves like a normal text field
 * but only commits integer values.
 *
 * Uses type="text" with inputMode="numeric" so the field can be
 * fully cleared, selected, and edited like normal text. Parses
 * and commits the integer value on blur or Enter.
 */

import { useState, useEffect } from 'react';

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function NumericInput({ value, onChange, min, max, className, style }: NumericInputProps) {
  const [text, setText] = useState(String(value));

  // Sync when the external value changes (e.g. undo/redo)
  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseInt(text, 10);
    if (isNaN(parsed)) {
      // Reset to current value if invalid
      setText(String(value));
      return;
    }
    let clamped = parsed;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    setText(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <input
      className={className ?? 'field-input'}
      type="text"
      inputMode="numeric"
      style={style}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        // Allow empty, minus sign, or digits
        if (raw === '' || raw === '-' || /^-?\d+$/.test(raw)) {
          setText(raw);
          // Live-commit valid integers
          const parsed = parseInt(raw, 10);
          if (!isNaN(parsed)) {
            let clamped = parsed;
            if (min !== undefined && clamped < min) clamped = min;
            if (max !== undefined && clamped > max) clamped = max;
            if (clamped !== value) onChange(clamped);
          }
        }
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}
