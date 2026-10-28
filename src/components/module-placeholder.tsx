import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

export function ModulePlaceholder({
  title,
  description,
  icon: Icon = Sparkles,
  features,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  features: string[];
}) {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-start gap-4 mb-6">
        <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
          <Icon className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-text-dim mt-1 max-w-2xl">{description}</p>
        </div>
      </div>

      <div className="bg-panel border border-border-subtle rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-text-dim">
            Module scaffold · Ready to build
          </span>
        </div>
        <p className="text-sm text-foreground/85 mb-5 max-w-2xl">
          The route, navigation, and design system are wired up. Pick a feature
          below and I'll build it out with real components and data.
        </p>
        <ul className="grid sm:grid-cols-2 gap-2">
          {features.map((f) => (
            <li
              key={f}
              className="flex items-center gap-2.5 rounded-md border border-border-subtle bg-canvas/50 px-3 py-2 text-sm"
            >
              <span className="size-1.5 rounded-full bg-primary/60" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
