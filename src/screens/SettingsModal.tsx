import { FormRow } from "@/components/FormRow";
import { Modal } from "@/components/Modal";
import { SegmentedControl, type SegmentedOption } from "@/components/SegmentedControl";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Toggle } from "@/components/Toggle";
import { LABELS, SETTINGS_TEXT } from "@/feedback/copy";
import { useSettingsStore, type AnimationMode } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";

const ANIMATION_OPTIONS: readonly SegmentedOption<AnimationMode>[] = [
  { value: "on", label: LABELS.on },
  { value: "fast", label: SETTINGS_TEXT.fast },
  { value: "off", label: LABELS.off },
];

// FR-SYS-10 POST-10-2, POST-10-3: this only ever talks to settingsStore, so nothing on it can
// reach the game. Each change applies the moment it is made.
export function SettingsModal() {
  const open = useUiStore((state) => state.modal === "settings");
  const closeModal = useUiStore((state) => state.closeModal);
  const sound = useSettingsStore((state) => state.sound);
  const animation = useSettingsStore((state) => state.animation);
  const theme = useSettingsStore((state) => state.theme);
  const setSound = useSettingsStore((state) => state.setSound);
  const setAnimation = useSettingsStore((state) => state.setAnimation);
  const setTheme = useSettingsStore((state) => state.setTheme);

  return (
    <Modal open={open} title={SETTINGS_TEXT.title} onClose={closeModal}>
      <div className="flex flex-col items-start gap-4">
        <Toggle label={SETTINGS_TEXT.sound} checked={sound} onChange={setSound} />
        <FormRow label={SETTINGS_TEXT.animations}>
          <SegmentedControl
            label={SETTINGS_TEXT.animations}
            options={ANIMATION_OPTIONS}
            value={animation}
            onChange={setAnimation}
          />
        </FormRow>
        <FormRow label={LABELS.theme}>
          <ThemeToggle value={theme} onChange={setTheme} />
        </FormRow>
      </div>
    </Modal>
  );
}
