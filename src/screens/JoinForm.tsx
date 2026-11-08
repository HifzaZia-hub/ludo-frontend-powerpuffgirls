import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { INVALID_CODE_MESSAGE, INVALID_NAME_MESSAGE, JOIN_TEXT } from "@/feedback/copy";
import { cleanRoomCode, isValidName, ROOM_CODE_LENGTH } from "@/interaction/formChecks";
import type { GameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";

// "unchecked": the look-up itself failed, say on a server hiccup. It is only a convenience, so
// the player can still try to join and hear the real answer from that.
type Lookup = "idle" | "checking" | "found" | "unchecked";

export interface JoinFormProps {
  store: GameStore;
  codeFieldRef: RefObject<HTMLInputElement>;
}

export function JoinForm({ store, codeFieldRef }: JoinFormProps) {
  const previewRoom = useStore(store, (state) => state.previewRoom);
  const joinRoom = useStore(store, (state) => state.joinRoom);
  const goToLobby = useUiStore((state) => state.goToLobby);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [lookup, setLookup] = useState<Lookup>("idle");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (code.length !== ROOM_CODE_LENGTH) {
      setLookup("idle");
      return;
    }

    let latest = true; // an answer about a code that has since been changed is ignored
    setLookup("checking");
    void previewRoom(code).then((result) => {
      if (!latest) return;
      if (result.ok) {
        setLookup("found");
      } else if (result.field === "roomCode") {
        setLookup("idle");
        setCodeError(result.message);
      } else {
        setLookup("unchecked");
        setFormError(result.message);
      }
    });

    return () => {
      latest = false;
    };
  }, [code, previewRoom]);

  function handleCodeChange(typed: string) {
    const cleaned = cleanRoomCode(typed);
    setCode(cleaned.code);
    setFormError(null);
    // NFR-SYS-08: without this, a typed O would just seem not to work.
    setCodeError(
      cleaned.rejected && cleaned.code.length < ROOM_CODE_LENGTH ? JOIN_TEXT.badCharacter : null,
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || lookup === "checking") return;

    if (code.length !== ROOM_CODE_LENGTH) {
      setCodeError(INVALID_CODE_MESSAGE);
      codeFieldRef.current?.focus();
      return;
    }
    if (lookup === "idle") return; // the look-up already said what is wrong with this code
    if (!isValidName(name)) {
      setNameError(INVALID_NAME_MESSAGE);
      nameFieldRef.current?.focus();
      return;
    }

    setNameError(null);
    setFormError(null);
    setSubmitting(true);
    const result = await joinRoom(code, name.trim());
    if (result.ok) {
      goToLobby();
      return;
    }

    // FR-SYS-01 ALT-01-1: both fields stay as typed, and the Join button is the retry.
    setSubmitting(false);
    if (result.field === "name") {
      setNameError(result.message);
      nameFieldRef.current?.focus();
    } else if (result.field === "roomCode") {
      setCodeError(result.message);
      codeFieldRef.current?.focus();
    } else {
      setFormError(result.message);
    }
  }

  const askForName = lookup === "found" || lookup === "unchecked";
  const status =
    lookup === "checking"
      ? JOIN_TEXT.checking
      : lookup === "found" && !codeError
        ? JOIN_TEXT.found
        : "";

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-2">
      <TextField
        ref={codeFieldRef}
        label={JOIN_TEXT.code}
        value={code}
        onChange={handleCodeChange}
        error={codeError}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
      />
      <p role="status" className="min-h-[1.5rem] text-[15px] text-mid">
        {status}
      </p>

      {askForName && (
        <TextField
          ref={nameFieldRef}
          label={JOIN_TEXT.name}
          value={name}
          onChange={(typed) => {
            setName(typed);
            setNameError(null);
          }}
          error={nameError}
          autoComplete="off"
        />
      )}

      {/* Not a toast: a modal covers the toast corner and blocks its Dismiss button. */}
      {formError && (
        <p role="alert" className="text-[15px] text-danger">
          {formError}
        </p>
      )}

      <Button type="submit" pending={submitting} className="mt-2">
        {JOIN_TEXT.join}
      </Button>
    </form>
  );
}
