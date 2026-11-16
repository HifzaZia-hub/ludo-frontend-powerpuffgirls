import { SegmentedControl } from "@/components/SegmentedControl";
import { THEMES, type Theme } from "@/config/themes";
import { LABELS } from "@/feedback/copy";

// Built from the theme list, so a new theme needs no change here.
const THEME_OPTIONS = THEMES.map((theme) => ({ value: theme, label: LABELS[theme] }));

export interface ThemeToggleProps {
  value: Theme;
  onChange: (theme: Theme) => void;
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
