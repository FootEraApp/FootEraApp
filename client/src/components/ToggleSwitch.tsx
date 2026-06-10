import React from "react";

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
};

export default function ToggleSwitch({ checked, onChange, disabled, label }: Props) {
  return (
    <label className={`inline-flex items-center gap-3 select-none ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
      {label ? <span className="text-sm text-gray-700">{label}</span> : null}

      <span className="relative inline-flex items-center">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />

        <span
          className={[
            "w-11 h-6 rounded-full transition-colors",
            checked ? "bg-green-700" : "bg-gray-300",
            disabled ? "" : "group-hover:brightness-95",
          ].join(" ")}
        />

        <span
          className={[
            "absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </span>
    </label>
  );
}