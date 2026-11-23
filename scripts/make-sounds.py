"""Builds public/sounds/sprite.wav, the game's six sound effects in one file.

Every sound is synthesised here, so the file is ours and needs no licence. src/feedback/sound.ts
lists where each sound starts and how long it is; keep the two in step. Each sound stays under the
400 ms budget, and all randomness is seeded, so the file comes out the same every time.

The sounds model real things rather than beeps:
- a hit is "modal": an object rings at a few frequencies of its own, each dying away at its own
  rate, plus a short click of contact (how wood, plastic and bells really sound);
- tones are made of their harmonics (brass) or of a frequency-modulated pair (bells);
- a small room's reverb ties each one together, so nothing sounds dry or "in a box".

Usage: python scripts/make-sounds.py          (writes public/sounds/sprite.wav)
       python scripts/make-sounds.py <folder>  (also writes each sound as its own .wav there)
"""
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

RATE = 44100
TOTAL_SECONDS = 3.0
# Where each sound starts in the sprite, and the longest it may be (sound.ts must agree).
SLOTS = {
    "roll": (0.0, 0.380),
    "move": (0.5, 0.200),
    "capture": (1.0, 0.380),
    "finish": (1.5, 0.390),
    "win": (2.0, 0.395),
    "error": (2.5, 0.240),
}
rng = np.random.default_rng(20261123)


# ---------------------------------------------------------------------------------------------
# Building blocks


def samples(length: float) -> int:
    return int(round(length * RATE))


def time_axis(length: float) -> np.ndarray:
    return np.arange(samples(length)) / RATE


def filtered(x: np.ndarray, kind: str, freq, order: int = 2) -> np.ndarray:
    sos = butter(order, freq, btype=kind, fs=RATE, output="sos")
    return sosfilt(sos, x)


def place(out: np.ndarray, sound: np.ndarray, at: float, gain: float = 1.0) -> None:
    start = samples(at)
    end = min(len(out), start + len(sound))
    if end > start:
        out[start:end] += gain * sound[: end - start]


def modal(freqs, taus, amps, length: float, detune: float = 0.0) -> np.ndarray:
    """An object struck once: it rings at its own frequencies, each fading at its own rate."""
    t = time_axis(length)
    out = np.zeros_like(t)
    for f, tau, a in zip(freqs, taus, amps):
        f *= 1 + detune * rng.uniform(-1, 1)
        phase = rng.uniform(0, 2 * np.pi)
        out += a * np.sin(2 * np.pi * f * t + phase) * np.exp(-t / tau)
    # The first half millisecond rises, as a real contact does, so there is no digital click.
    ramp = min(len(out), samples(0.0005))
    out[:ramp] *= np.linspace(0, 1, ramp)
    return out


def contact(length: float, low: float, high: float, tau: float) -> np.ndarray:
    """The tick of two hard surfaces touching: a very short burst of band-limited noise."""
    burst = rng.standard_normal(samples(length))
    return filtered(burst, "bandpass", [low, high]) * np.exp(-time_axis(length) / tau)


def room(sound: np.ndarray, mix: float, size: float = 0.32, tone: float = 5200) -> np.ndarray:
    """A small room: a few early echoes, then a soft tail of fading, darkened noise."""
    t = time_axis(size)
    tail = rng.standard_normal(len(t)) * np.exp(-t / (size / 6.5))
    tail = filtered(tail, "lowpass", tone)
    for delay, gain in ((0.0071, 0.5), (0.0119, 0.38), (0.0173, 0.3), (0.0241, 0.22)):
        tail[samples(delay)] += gain * 6
    tail[: samples(0.004)] = 0
    tail /= np.sqrt(np.sum(tail**2))
    wet = fftconvolve(sound, tail)[: len(sound)]
    return sound + mix * wet / (np.max(np.abs(wet)) or 1) * np.max(np.abs(sound))


CEILING = 0.95  # no sound peaks above this
KNEE = 0.7  # peaks above this are rounded off softly, not cut


def finish(sound: np.ndarray, loudness: float, fade_out: float = 0.01) -> np.ndarray:
    """No clicks at either end, set to a loudness (RMS) so the six sit together, with any peak
    above the knee rounded off softly so nothing clips."""
    sound = sound - np.mean(sound)
    sound = filtered(sound, "highpass", 45)
    fade_in = samples(0.0015)
    tail = min(len(sound) // 2, samples(fade_out))
    sound[:fade_in] *= np.linspace(0, 1, fade_in)
    sound[-tail:] *= np.cos(np.linspace(0, np.pi / 2, tail)) ** 2
    sound *= loudness / (np.sqrt(np.mean(sound**2)) or 1)
    size = np.abs(sound)
    room_left = CEILING - KNEE
    rounded = KNEE + room_left * np.tanh((size - KNEE) / room_left)
    return np.sign(sound) * np.where(size > KNEE, rounded, size)


def harmonics(freq: float, length: float, brightness: np.ndarray, detune_cents: float = 0) -> np.ndarray:
    """A brass-like tone: all the harmonics, the higher ones let through as `brightness` rises."""
    t = time_axis(length)
    f = freq * 2 ** (detune_cents / 1200)
    out = np.zeros_like(t)
    for k in range(1, int(9000 / f) + 1):
        # Harmonic k is heard once the "lip" opens far enough; 1/k is a bright, brassy spectrum.
        weight = np.clip(brightness * 9 - (k - 1), 0, 1)
        out += weight * np.sin(2 * np.pi * k * f * t) / k
    return out


def fm_bell(freq: float, length: float, tau: float, ratio: float = 3.5, index: float = 2.6) -> np.ndarray:
    """A bell: one tone modulating another at an uneven ratio gives a bell's clangy partials."""
    t = time_axis(length)
    depth = index * np.exp(-t / (tau * 0.45))
    tone = np.sin(2 * np.pi * freq * t + depth * np.sin(2 * np.pi * freq * ratio * t))
    strike = np.minimum(1, t / 0.002)
    return tone * np.exp(-t / tau) * strike


# ---------------------------------------------------------------------------------------------
# The six sounds


def die_hit(strength: float) -> np.ndarray:
    """A resin die landing on a wooden board: the die's own ring, its click, and the board's thump."""
    die = modal(
        [2950, 4630, 6870, 9240],
        [0.009, 0.007, 0.005, 0.0035],
        [1.0, 0.7, 0.45, 0.25],
        0.06,
        detune=0.05,  # it lands on a different face or edge each time
    )
    click = contact(0.004, 2500, 11000, 0.0008)
    board = modal([142, 231, 418, 706], [0.05, 0.04, 0.025, 0.015], [0.9, 0.6, 0.35, 0.2], 0.12)
    out = np.zeros(samples(0.12))
    place(out, die, 0, 0.55)
    place(out, click, 0, 0.5)
    place(out, board, 0, 0.75 * strength)  # a hard landing shakes the board more
    return out * strength


def roll() -> np.ndarray:
    """Thrown onto the board: a hard first landing, bounces that come faster and softer, and a
    few small tumbling ticks before it settles."""
    out = np.zeros(samples(SLOTS["roll"][1]))
    at, gap, strength = 0.004, 0.085, 1.0
    while gap > 0.012 and at < 0.32:
        place(out, die_hit(strength), at)
        # On its way over, it catches an edge now and then.
        if gap > 0.03:
            place(out, die_hit(0.18), at + gap * rng.uniform(0.45, 0.6))
        at += gap
        gap *= 0.72
        strength *= 0.74
    # Settling: a rock onto its face, then still.
    place(out, die_hit(0.22), at + 0.012)
    place(out, die_hit(0.12), at + 0.032)
    return finish(room(out, 0.16), loudness=0.12, fade_out=0.03)


def move() -> np.ndarray:
    """A turned wooden pawn set down: a round "plock", a little lift in pitch as it lands."""
    length = SLOTS["move"][1]
    t = time_axis(length)
    # The pawn's main ring, sliding up 4 % over the first 25 ms: it sounds lifted and placed.
    glide = 1 + 0.04 * (1 - np.exp(-t / 0.008))
    body = np.sin(2 * np.pi * np.cumsum(880 * glide) / RATE) * np.exp(-t / 0.028)
    upper = modal([2360, 4120], [0.012, 0.006], [0.35, 0.15], length)
    board = modal([168, 305], [0.035, 0.02], [0.55, 0.25], length)
    click = contact(0.003, 1800, 8000, 0.0006)
    out = body + upper + board
    place(out, click, 0, 0.35)
    return finish(room(out, 0.12), loudness=0.13, fade_out=0.03)


def capture() -> np.ndarray:
    """One piece knocks another off the board and home: a sharp clack, a whoosh away, and a
    falling "whoop" that says it has gone back to the start."""
    length = SLOTS["capture"][1]
    out = np.zeros(samples(length))
    clack = modal([1280, 2710, 4390, 6550], [0.03, 0.018, 0.01, 0.006], [1.0, 0.65, 0.4, 0.2], 0.12)
    place(out, clack, 0, 0.9)
    place(out, contact(0.006, 2000, 12000, 0.0012), 0, 0.7)

    # The whoosh: noise through a filter that sweeps down as the piece flies off.
    swoosh_len = 0.26
    t = time_axis(swoosh_len)
    noise = rng.standard_normal(len(t))
    centre = 3800 * (650 / 3800) ** (t / swoosh_len)
    swoosh = np.zeros_like(t)
    hop = samples(0.01)
    for start in range(0, len(t), hop):  # a filter re-tuned every 10 ms is smooth enough
        c = centre[start]
        part = filtered(noise[max(0, start - 400) : start + hop], "bandpass", [c * 0.6, c * 1.5])
        swoosh[start : start + hop] = part[-min(hop, len(t) - start) :]
    swoosh *= np.sin(np.pi * np.clip(t / swoosh_len, 0, 1)) ** 1.5
    place(out, swoosh, 0.03, 0.45)

    # The whoop: a soft tone falling an octave and a half.
    whoop_len = 0.3
    t = time_axis(whoop_len)
    freq = 760 * (250 / 760) ** (t / whoop_len)
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    whoop = (np.sin(phase) + 0.25 * np.sin(2 * phase)) * np.sin(np.pi * t / whoop_len) ** 0.8
    place(out, whoop, 0.05, 0.32)

    # It lands back in its yard.
    place(out, modal([180, 330], [0.03, 0.02], [0.6, 0.3], 0.08), 0.33, 0.35)
    return finish(room(out, 0.18), loudness=0.14, fade_out=0.02)


def finish_chime() -> np.ndarray:
    """A piece reaches home: bells climbing C, E, G, C, and a shimmer of sparkle above them."""
    out = np.zeros(samples(SLOTS["finish"][1]))
    # Each bell is struck clearly and fades fast, so the four are heard one by one, not as a
    # wall; the top one rings longest.
    for i, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0]):
        place(out, fm_bell(f, 0.38, tau=0.07 if i < 3 else 0.13, index=2.0), i * 0.06, 1.0)
    # Sparkle: a few tiny high pings, seeded, scattered after the last bell.
    for _ in range(7):
        f = rng.uniform(5000, 9000)
        place(out, fm_bell(f, 0.04, tau=0.01, ratio=1.41, index=0.6), rng.uniform(0.18, 0.34), 0.1)
    return finish(room(out, 0.2, size=0.4, tone=7000), loudness=0.12, fade_out=0.05)


def win() -> np.ndarray:
    """Ta-da: a quick brass pick-up, then a full C major chord that swells, with a cymbal."""
    length = SLOTS["win"][1]
    out = np.zeros(samples(length))

    def brass(freq: float, at: float, dur: float, gain: float) -> None:
        t = time_axis(dur)
        # The lip opens fast (a "blat"), settles, and the note gets a touch of vibrato.
        bright = 0.35 + 0.55 * (1 - np.exp(-t / 0.012))
        bright *= 1 - 0.25 * (1 - np.exp(-t / 0.12))
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.12) / 0.1, 0, 1)
        voice = sum(harmonics(freq, dur, bright, cents) for cents in (-6, 6))
        voice = np.interp(np.cumsum(vib) - 1, np.arange(len(voice)), voice)
        amp = np.minimum(1, t / 0.012) * np.where(t < dur - 0.03, 1, np.clip((dur - t) / 0.03, 0, 1))
        place(out, voice * amp, at, gain)

    brass(392.0, 0.0, 0.09, 0.55)  # G4, the pick-up
    for f, g in ((523.25, 0.6), (659.25, 0.5), (783.99, 0.45), (1046.5, 0.3)):
        brass(f, 0.1, length - 0.1, g)  # C5, E5, G5, C6 together

    t = time_axis(length - 0.1)
    cymbal = filtered(rng.standard_normal(len(t)), "highpass", 6000) * np.exp(-t / 0.12)
    place(out, cymbal, 0.1, 0.12)
    place(out, fm_bell(2093.0, length - 0.1, tau=0.2), 0.1, 0.08)
    return finish(room(out, 0.2, size=0.45), loudness=0.17, fade_out=0.07)


def error() -> np.ndarray:
    """Not allowed: two soft, rounded notes stepping down, like a gentle wooden "uh-uh"."""
    out = np.zeros(samples(SLOTS["error"][1]))
    for i, f in enumerate([392.0, 311.1]):  # G4 down to E-flat 4
        t = time_axis(0.12)
        bend = 1 - 0.03 * (1 - np.exp(-t / 0.04))  # each note sags a little
        phase = 2 * np.pi * np.cumsum(f * bend) / RATE
        tone = np.sin(phase) + 0.3 * np.sin(2 * phase) + 0.08 * np.sin(3 * phase)
        tone *= np.minimum(1, t / 0.006) * np.exp(-t / 0.05)
        place(out, tone, i * 0.1, 1.0)
    out = filtered(out, "lowpass", 2400)
    return finish(room(out, 0.1), loudness=0.11, fade_out=0.03)


SOUNDS = {
    "roll": roll,
    "move": move,
    "capture": capture,
    "finish": finish_chime,
    "win": win,
    "error": error,
}


def write_wav(path: Path, data: np.ndarray) -> None:
    with wave.open(str(path), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes((np.clip(data, -1, 1) * 32767).astype("<i2").tobytes())


def main() -> None:
    sprite = np.zeros(samples(TOTAL_SECONDS))
    made = {}
    for name, (start, longest) in SLOTS.items():
        sound = SOUNDS[name]()
        assert len(sound) <= samples(longest), f"{name} is longer than its slot"
        made[name] = sound
        place(sprite, sound, start)
    path = Path(__file__).resolve().parent.parent / "public" / "sounds" / "sprite.wav"
    write_wav(path, sprite)
    print(f"wrote {path} ({path.stat().st_size} bytes)")
    if len(sys.argv) > 1:
        folder = Path(sys.argv[1])
        folder.mkdir(parents=True, exist_ok=True)
        for name, sound in made.items():
            write_wav(folder / f"{name}.wav", sound)
        print(f"and each sound in {folder}")


if __name__ == "__main__":
    main()
