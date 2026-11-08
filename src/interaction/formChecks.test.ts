import { cleanRoomCode, isValidName } from "@/interaction/formChecks";

describe("isValidName", () => {
  it.each(["Rida", "Hifza Zia", "player_1", "a.b-c", "سنیلا", "x".repeat(20), "  Rida  "])(
    "accepts %j",
    (name) => {
      expect(isValidName(name)).toBe(true);
    },
  );

  it.each(["", "   ", "x".repeat(21), "Rida!", "<b>Rida</b>"])("refuses %j", (name) => {
    expect(isValidName(name)).toBe(false);
  });
});

describe("cleanRoomCode", () => {
  it("upper-cases what is typed", () => {
    expect(cleanRoomCode("k7qx2m")).toEqual({ code: "K7QX2M", rejected: false });
  });

  // Contract §1: strip spaces, without treating them as a mistake.
  it("drops spaces quietly", () => {
    expect(cleanRoomCode(" K7Q X2M ")).toEqual({ code: "K7QX2M", rejected: false });
  });

  // Contract §2
  it.each(["I", "L", "O", "0", "1", "-"])("refuses %s and says so", (character) => {
    expect(cleanRoomCode(`K7${character}`)).toEqual({ code: "K7", rejected: true });
  });

  it("stops at six characters", () => {
    expect(cleanRoomCode("K7QX2MAB").code).toBe("K7QX2M");
  });
});
