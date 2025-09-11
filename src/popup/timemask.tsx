'use client';
import * as React from "react";
import TextField from "@mui/material/TextField";
import { parse as dfParse, format as dfFormat, isValid as dfIsValid } from "date-fns";

// constants
const FMT = "MM/dd/yyyy, hh:mm aa";
const YEAR_MIN = 2000;
const YEAR_MAX = 2099;

function formatProgressive(raw: string): string {
  let s = (raw ?? "").toUpperCase();
  s = s.replace(/[^\dAPM]/g, ""); // keep only digits and A/P/M

  // accept partial AM/PM buffer at the end: "A", "P", "AM", "PM"
  let ampmBuf = "";
  const tail = s.match(/(AM?|PM?)$/i);
  if (tail) {
    ampmBuf = tail[1].toUpperCase();
    s = s.slice(0, -ampmBuf.length);
  }

  // Up to 12 digits (no seconds): MM(2) DD(2) YYYY(4) hh(2) mm(2)
  const digits = s.replace(/\D/g, "").slice(0, 12);

  const MM = digits.slice(0, 2);
  const DD = digits.slice(2, 4);
  const YYYY = digits.slice(4, 8);
  const hh = digits.slice(8, 10);
  const mm = digits.slice(10, 12);

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  const MMc = MM.length === 2 ? String(clamp(parseInt(MM, 10), 1, 12)).padStart(2, "0") : MM;
  const DDc = DD.length === 2 ? String(clamp(parseInt(DD, 10), 1, 31)).padStart(2, "0") : DD;

  let YYYYc = YYYY;
  if (YYYY.length === 4) {
    const yr = clamp(parseInt(YYYY, 10), YEAR_MIN, YEAR_MAX);
    YYYYc = String(yr);
  }

  let hhc = hh;
  if (hh.length === 2) {
    const h12 = (parseInt(hh, 10) % 12) || 12;
    hhc = String(clamp(h12, 1, 12)).padStart(2, "0");
  }

  const mmc = mm.length === 2 ? String(clamp(parseInt(mm, 10), 0, 59)).padStart(2, "0") : mm;

  // Rebuild progressively with separators (no placeholders)
  let out = "";
  if (MMc) out += MMc;
  if (DDc || YYYYc || hhc || mmc || ampmBuf) out += MMc.length ? "/" : "";
  if (DDc) out += DDc;
  if (YYYYc || hhc || mmc || ampmBuf) out += DDc.length ? "/" : "";
  if (YYYYc) out += YYYYc;
  if (hhc || mmc || ampmBuf) out += YYYYc.length ? ", " : "";
  if (hhc) out += hhc;
  if (mmc || ampmBuf) out += hhc.length ? ":" : "";
  if (mmc) out += mmc;

  // Append partial/full AM/PM buffer (with leading space)
  if (ampmBuf) out += (out.endsWith(" ") ? "" : " ") + ampmBuf;

  // Trim dangling separators
  return out.replace(/([:,/]\s*)$/, "");
}

function parseExactMasked(value: string): Date | null {
  const d = dfParse((value ?? "").trim(), FMT, new Date());
  if (!dfIsValid(d)) return null;
  const y = d.getFullYear();
  if (y < YEAR_MIN || y > YEAR_MAX) return null;
  return d;
}

export function formatMaskedLocal(d: Date): string {
  return dfFormat(d, FMT);
}

function countTokensBefore(rawUpper: string, caret: number): number {
  let n = 0;
  for (let i = 0; i < Math.min(caret, rawUpper.length); i++) {
    const ch = rawUpper[i];
    if ((ch >= "0" && ch <= "9") || ch === "A" || ch === "P" || ch === "M") n++;
  }
  return n;
}

function caretIndexAfterTokens(formatted: string, tokens: number): number {
  if (tokens <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    const ch = formatted[i].toUpperCase();
    const isToken =
      (ch >= "0" && ch <= "9") || ch === "A" || ch === "P" || ch === "M";
    if (isToken) {
      seen++;
      if (seen >= tokens) return i + 1; 
    }
  }
  return formatted.length;
}

/* ======================= INPUT COMPONENT ======================= */
export interface AutoDateProps {
  name: string;
  value: string; 
  onChange: (event: { target: { name: string; value: string } }) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  style?: React.CSSProperties;
}

export function DateTimeAutoformatField({
  name,
  value,
  onChange,
  label,
  placeholder = "MM/DD/YYYY, hh:mm AM",
  required,
}: AutoDateProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const el = e.target as HTMLInputElement;
    const raw = el.value ?? "";
    const caretPos = el.selectionStart ?? raw.length;
    const tokensBefore = countTokensBefore(raw.toUpperCase(), caretPos);
    const formatted = formatProgressive(raw);
    onChange({ target: { name, value: formatted } });
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      const newIndex = caretIndexAfterTokens(formatted, tokensBefore);
      node.setSelectionRange(newIndex, newIndex);
    });
  };

  return (
    <TextField
      name={name}
      label={label}
      value={value}
      onChange={handleChange}
      inputRef={inputRef}
      onBlur={() => {
        const d = parseExactMasked(value);
        if (d) {
          onChange({ target: { name, value: dfFormat(d, FMT) } });
        }
      }}
      onFocus={() => {
        const d = parseExactMasked(value);
        if (d) {
          onChange({ target: { name, value: dfFormat(d, FMT) } });
        }
      }}
      placeholder={placeholder}
      required={required}
      slotProps={{
        input: {
          inputRef, 
          inputProps: { inputMode: "text", spellCheck: "false" },
        },
      }}
      sx={{ '& .MuiFilledInput-input': { fontSize: 13 } }}
      fullWidth
      size="small"
    />
  );
}
