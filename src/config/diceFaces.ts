// Which of the nine spots on a die face hold a pip, numbered left to right, top to bottom.
// Drawing only: the value always comes from the server (NFR-SYS-05).
export const PIP_SPOTS: Readonly<Record<number, readonly number[]>> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export const NINE_SPOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
