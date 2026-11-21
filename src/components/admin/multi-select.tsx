"use client";

import { useState } from "react";

/** Checkbox list that submits its value as a comma-separated hidden input (works with SimpleForm). */
export function MultiSelectClient({ id, name, options, selected }: { id: string; name: string; options: { id: string; name: string }[]; selected: string[] }) {
  const [value, setValue] = useState<string[]>(selected);
  return (
    <div id={id} className="max-h-40 overflow-y-auto rounded-xl border border-line bg-surface-2 p-2">
      <input type="hidden" name={name} value={value.join(",")} />
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => setValue((v) => (on ? v.filter((x) => x !== o.id) : [...v, o.id]))}
              className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg"}`}
            >
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
