import { SegmentedControl } from "@/components/SegmentedControl";
import { LABELS } from "@/feedback/copy";

type ThemeName = "dark" | "light";

const THEME_OPTIONS = [
  { value: "dark", label: LABELS.dark },
  { value: "light", label: LABELS.light },
] as const;

export interface ThemeToggleProps {
  value: ThemeName;
  onChange: (theme: ThemeName) => void;
}

export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  return (
    <SegmentedControl
      label={LABELS.theme}
      options={THEME_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
