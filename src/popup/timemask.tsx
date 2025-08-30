import React from "react";
import { IMask, IMaskInput } from "react-imask";

interface CustomProps {
  onChange: (event: { target: { name: string; value: string } }) => void;
  name: string;
  style?: React.CSSProperties;
}

// Input mask component for MUI
export const DateTimeMask = React.forwardRef<HTMLInputElement, CustomProps>(
  function DateTimeMask(props, ref) {
    const { onChange, ...other } = props;
    return (
      <IMaskInput
        {...other}
        mask="00/00/0000, 00:00:00 aa"
        blocks={{
            MM: { mask: IMask.MaskedRange, from: 1, to: 12, maxLength: 2 },
            DD: { mask: IMask.MaskedRange, from: 1, to: 31, maxLength: 2 },
            YYYY: { mask: IMask.MaskedRange, from: 2000, to: 2099, maxLength: 4 },
            hh: { mask: IMask.MaskedRange, from: 1, to: 12, maxLength: 2 },
            mm: { mask: IMask.MaskedRange, from: 0, to: 59, maxLength: 2 },
            ss: { mask: IMask.MaskedRange, from: 0, to: 59, maxLength: 2 },
            aa: { mask: IMask.MaskedEnum, enum: ["AM", "PM"] },
        }}
        inputRef={ref}
        overwrite
        lazy={false}
        style={{ fontSize: 13, ...props.style }} 
        onAccept={(value: any) =>
            onChange({ target: { name: props.name, value: value || "" } })
        }
    />
    );
  }
);

// Formatter utility to turn a Date into the same mask format
export function formatMaskedLocal(d: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const MM = pad2(d.getMonth() + 1);
  const DD = pad2(d.getDate());
  const YYYY = d.getFullYear();

  let h24 = d.getHours();
  const ampm = h24 >= 12 ? "PM" : "AM";
  let hh = h24 % 12 || 12;
  const hh12 = pad2(hh);
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());

  return `${MM}/${DD}/${YYYY}, ${hh12}:${mm}:${ss} ${ampm}`;
}