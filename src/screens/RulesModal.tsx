import { useStore } from "zustand";
import { Modal } from "@/components/Modal";
import { RulesSummary } from "@/components/RulesSummary";
import { defaultRules } from "@/config/defaultRules";
import { RULES_MODAL_TITLE } from "@/feedback/copy";
import type { GameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";

export interface RulesModalProps {
  store: GameStore;
}

// D2 FR-07, NFR-SYS-11: the room's own rules once there is a room, and the standard ones before.
export function RulesModal({ store }: RulesModalProps) {
  const open = useUiStore((state) => state.modal === "rules");
  const closeModal = useUiStore((state) => state.closeModal);
  const rules = useStore(store, (state) => state.snapshot?.rules ?? state.room?.rules ?? null);

  return (
    <Modal open={open} title={RULES_MODAL_TITLE} onClose={closeModal}>
      <RulesSummary rules={rules ?? defaultRules} standard={rules === null} />
    </Modal>
  );
}
