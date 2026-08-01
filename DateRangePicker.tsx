"use client";

export type DateRange = {
  from: string; // YYYY-MM-DD or ""
  to: string;   // YYYY-MM-DD or ""
  preset: "today" | "yesterday" | "7d" | "30d" | "90d" | "1y" | "all" | "custom";
};

type Props = {
  value: DateRange;
  onChange: (range: DateRange) => void;
};

function toLocalISO(d: Date): string {
  return d.toLocaleDateString("en-CA"); // en-CA gives YYYY-MM-DD in local time
}

function subtractDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

const PRESETS: { label: string; preset: DateRange["preset"] }[] = [
  { label: "Today",     preset: "today"     },
  { label: "Yesterday", preset: "yesterday" },
  { label: "7d",        preset: "7d"        },
  { label: "30d",       preset: "30d"       },
  { label: "90d",       preset: "90d"       },
  { label: "1y",        preset: "1y"        },
  { label: "All",       preset: "all"       },
];

export function presetToRange(preset: DateRange["preset"]): { from: string; to: string } {
  const today = new Date();
  const todayStr = toLocalISO(today);

  switch (preset) {
    case "today":
      return { from: todayStr, to: todayStr };
    case "yesterday": {
      const y = toLocalISO(subtractDays(today, 1));
      return { from: y, to: y };
    }
    case "7d":
      return { from: toLocalISO(subtractDays(today, 6)), to: todayStr };
    case "30d":
      return { from: toLocalISO(subtractDays(today, 29)), to: todayStr };
    case "90d":
      return { from: toLocalISO(subtractDays(today, 89)), to: todayStr };
    case "1y":
      return { from: toLocalISO(subtractDays(today, 364)), to: todayStr };
    case "all":
      return { from: "", to: "" };
    default:
      return { from: "", to: "" };
  }
}

export function DateRangePicker({ value, onChange }: Props) {
  function applyPreset(preset: DateRange["preset"]) {
    const { from, to } = presetToRange(preset);
    onChange({ preset, from, to });
  }

  function handleFromChange(from: string) {
    onChange({ preset: "custom", from, to: value.to });
  }

  function handleToChange(to: string) {
    onChange({ preset: "custom", from: value.from, to });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {/* Preset buttons — 4 per row on mobile, single row on desktop */}
      <div className="grid grid-cols-4 gap-1 sm:flex sm:flex-wrap">
        {PRESETS.map(({ label, preset }) => (
          <button
            key={preset}
            type="button"
            onClick={() => applyPreset(preset)}
            className={[
              "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              value.preset === preset
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Vertical divider — desktop only */}
      <div className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />

      {/* Custom date range inputs */}
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          value={value.from}
          onChange={(e) => handleFromChange(e.target.value)}
          max={value.to || undefined}
          className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 sm:flex-none"
          aria-label="From date"
        />
        <span className="text-slate-400">—</span>
        <input
          type="date"
          value={value.to}
          onChange={(e) => handleToChange(e.target.value)}
          min={value.from || undefined}
          className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 sm:flex-none"
          aria-label="To date"
        />
      </div>
    </div>
  );
}
