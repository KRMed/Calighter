"use client";
import * as React from "react";
import { TextField, FormHelperText } from "@mui/material";

/** Public API */
export type MaskFieldProps = {
  value: string;                 // "MM/DD/YY" or "HH:MM AM/PM"
  onChange: (v: string) => void; // emits formatted value
  label?: string;
  errorText?: string | null;
  disabled?: boolean;
  placeholder?: string;
  fullWidth?: boolean;
  size?: "small" | "medium";
  variant?: "outlined" | "filled" | "standard";
};

/* ================= Helpers ================= */
const pad2 = (n: number) => String(n).padStart(2, "0");
const onlyDigits = (s: string) => s.replace(/\D+/g, "");
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Formatters (Date -> mask strings) */
export function formatDateMaskFromDate(d: Date): string {
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${String(d.getFullYear()).slice(-2)}`;
}
export function formatTimeMaskFromDate(d: Date): string {
  let h = d.getHours();
  const m = pad2(d.getMinutes());
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${pad2(h)}:${m} ${ap}`;
}

/** Legacy compat: "MM/DD/YY HH:MM AM/PM" */
export function formatMaskedLocal(d: Date): string {
  return `${formatDateMaskFromDate(d)} ${formatTimeMaskFromDate(d)}`;
}

/* ================= Validators ================= */
export function isValidDateMask(v: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(v.trim());
  if (!m) return false;
  const mm = +m[1], dd = +m[2];
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;
  return true;
}
export function isValidTimeMask(v: string) {
  const m = /^(\d{2}):(\d{2})\s+(AM|PM)$/.exec(v.trim());
  if (!m) return false;
  const hh = +m[1], mm = +m[2];
  return hh >= 1 && hh <= 12 && mm >= 0 && mm <= 59;
}

/* ================= Date: MM/DD/YY ================= */
export const DateMaskField: React.FC<MaskFieldProps> = ({
  value,
  onChange,
  label = "Date",
  errorText = null,
  disabled,
  placeholder = "mm/dd/yy",
  fullWidth = true,
  size = "small",
  variant = "outlined",
}) => {
  // type as-you-type: insert slashes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = onlyDigits(e.target.value).slice(0, 6); // MM DD YY
    const mm = d.slice(0, 2);
    const dd = d.slice(2, 4);
    const yy = d.slice(4, 6);

    let out = "";
    if (mm) out += mm;
    if (d.length >= 3) out += "/" + dd;
    else if (d.length >= 2) out += "/";

    if (d.length >= 5) out += "/" + yy;
    else if (d.length >= 4) out += "/";

    onChange(out);
  };

  // inside DateMaskField component, add this handler:
  const handleKeyDownDate = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const pos = el.selectionStart ?? 0;
    const val = el.value; // use live input value, not React state

    if (e.key === "Backspace") {
      if (pos > 0 && val[pos - 1] === "/") {
        e.preventDefault();
        requestAnimationFrame(() => el.setSelectionRange(pos - 1, pos - 1));
      }
    } else if (e.key === "Delete") {
      if (pos < val.length && val[pos] === "/") {
        e.preventDefault();
        requestAnimationFrame(() => el.setSelectionRange(pos + 1, pos + 1));
      }
    }
  };

  // normalize on blur: pad/clamp soft
  const handleBlur = () => {
    const d = onlyDigits(value);
    if (!d) return;
    let mm = d.slice(0, 2).padEnd(2, "0");
    let dd = d.slice(2, 4).padEnd(2, "0");
    let yy = d.slice(4, 6).padEnd(2, "0");

    mm = pad2(clamp(parseInt(mm, 10) || 0, 1, 12));
    dd = pad2(clamp(parseInt(dd, 10) || 0, 1, 31));

    onChange(`${mm}/${dd}/${yy}`);
  };

  return (
    <>
      <TextField
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        error={!!errorText}
        slotProps={{
          input: {
            inputProps: {
              maxLength: 8,
              inputMode: "numeric",
              onKeyDown: handleKeyDownDate,
              autoComplete: "off",
              style: { textAlign: "left", fontVariantNumeric: "tabular-nums" },
            },
          },
        }}
      />
      {errorText && <FormHelperText error sx={{ m: 0 }}>{errorText}</FormHelperText>}
    </>
  );
};

/* ================= Time: HH:MM AM/PM ================= */
export const TimeMaskField: React.FC<MaskFieldProps> = ({
  value,
  onChange,
  label = "Time",
  errorText = null,
  disabled,
  placeholder = "hh:mm PM",
  fullWidth = true,
  size = "small",
  variant = "outlined",
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // keep digits + letters (for am/pm), strip everything else dynamically
    const digits = onlyDigits(raw).slice(0, 4); // HHMM
    let letters = raw.replace(/[^a-zA-Z]/g, "").toUpperCase();
    if (letters.startsWith("A")) letters = "AM";
    else if (letters.startsWith("P")) letters = "PM";
    else letters = "";

    const hh = digits.slice(0, 2);
    const mm = digits.slice(2, 4);

    let out = "";
    if (hh) out += hh;
    if (digits.length >= 3) out += ":" + mm;
    else if (digits.length >= 2) out += ":";

    if (letters) out += ` ${letters}`;

    onChange(out);
  };

  const handleKeyDownTime = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const pos = el.selectionStart ?? 0;
    const selEnd = el.selectionEnd ?? pos;
    const v = el.value;

    // Let the browser handle range deletions normally.
    if (pos !== selEnd) return;

    if (e.key === "Backspace") {
      // Case 1: caret at end and value ends with " AM" or " PM"
      if (pos === v.length && /\s[AP]M$/i.test(v)) {
        e.preventDefault();
        const cut = v.lastIndexOf(" ");              // space before AM/PM
        const newV = cut >= 0 ? v.slice(0, cut) : v; // remove " AM"/" PM"
        onChange(newV);
        requestAnimationFrame(() => {
          const newPos = newV.length;                // -> after minutes ("HH:MM|")
          el.setSelectionRange(newPos, newPos);
        });
        return;
      }

      // Case 2: skip mask chars just before caret (":" or space)
      if (pos > 0 && (v[pos - 1] === ":" || v[pos - 1] === " ")) {
        e.preventDefault();
        requestAnimationFrame(() => el.setSelectionRange(pos - 1, pos - 1));
        return;
      }
    } else if (e.key === "Delete") {
      // Optional symmetry: skip mask chars just after caret
      if (pos < v.length && (v[pos] === ":" || v[pos] === " ")) {
        e.preventDefault();
        requestAnimationFrame(() => el.setSelectionRange(pos + 1, pos + 1));
        return;
      }
    }
  };

  // NEW: after the browser deletes 'M' or 'A', collapse over trailing space/colon
  const handleKeyUpTime = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Backspace") return;
    const el = e.currentTarget;
    requestAnimationFrame(() => {
      let pos = el.selectionStart ?? 0;
      const v = el.value;
      // if we're now just after a space, hop left over it
      if (pos > 0 && v[pos - 1] === " ") {
        el.setSelectionRange(pos - 1, pos - 1);
        pos = pos - 1;
      }
      // if we're now just after a colon, hop left over it too
      if (pos > 0 && v[pos - 1] === ":") {
        el.setSelectionRange(pos - 1, pos - 1);
      }
    });
  };

  // normalize on blur: pad/clamp + ensure AM/PM capitalization
  const handleBlur = () => {
    const m = value.match(/^(\d{1,2})(?::?(\d{0,2}))?\s*(am|pm)?$/i);
    if (!m) return;

    let h = parseInt(m[1] || "0", 10);
    let mins = parseInt((m[2] || "0").padEnd(2, "0"), 10);
    const ap = (m[3] || "").toUpperCase() as "" | "AM" | "PM";

    h = clamp(h || 0, 1, 12);
    mins = clamp(mins || 0, 0, 59);

    const out = `${pad2(h)}:${pad2(mins)}${ap ? ` ${ap}` : ""}`;
    onChange(out);
  };

  return (
    <>
      <TextField
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        error={!!errorText}
        slotProps={{
          input: {
            inputProps: {
              maxLength: 8, 
              inputMode: "numeric",
              onKeyDown: handleKeyDownTime,
              onKeyUp: handleKeyUpTime,
              autoComplete: "off",
              style: { textAlign: "left", fontVariantNumeric: "tabular-nums" },
            },
          },
        }}
      />
      {errorText && <FormHelperText error sx={{ m: 0 }}>{errorText}</FormHelperText>}
    </>
  );
};
