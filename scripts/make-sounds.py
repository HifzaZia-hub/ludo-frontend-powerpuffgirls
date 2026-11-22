"""Builds public/sounds/sprite.wav, the game's six sound effects in one file.

Every sound is synthesised here, so the file is ours and needs no licence. src/feedback/sound.ts
lists where each sound starts and how long it is; keep the two in step. Each sound stays under the
400 ms budget, and the noise is seeded so the file comes out the same every time.

Usage: python scripts/make-sounds.py
"""
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

RATE = 32000
TOTAL_SECONDS = 3.0
rng = np.random.default_rng(20261122)


def seconds(n: float) -> int:
    return int(round(n * RATE))


def time_axis(length: float) -> np.ndarray:
    return np.arange(seconds(length)) / RATE


def decay(length: float, rate: float) -> np.ndarray:
    """An exponential fall, `rate` per second, so each hit dies away naturally."""
    return np.exp(-rate * time_axis(length))


def band(noise: np.ndarray, low: float, high: float) -> np.ndarray:
    sos = butter(4, [low, high], btype="bandpass", fs=RATE, output="sos")
    return sosfilt(sos, noise)


def place(out: np.ndarray, sound: np.ndarray, at: float) -> None:
    start = seconds(at)
    end = min(len(out), start + len(sound))
    out[start:end] += sound[: end - start]


def finish(sound: np.ndarray, peak: float = 0.8, fade_out: float = 0.004) -> np.ndarray:
    """Fades at both ends (no clicks), then scaled to the same loudness as the others."""
    fade_in = min(len(sound) // 4, seconds(0.002))
    tail = min(len(sound) // 2, seconds(fade_out))
    sound[:fade_in] *= np.linspace(0, 1, fade_in)
    sound[-tail:] *= np.linspace(1, 0, tail) ** 2
    return sound / (np.max(np.abs(sound)) or 1) * peak


def bell(freq: float, length: float, rate: float = 14.0) -> np.ndarray:
    """A small bell: the note, plus the bright, quickly fading partials real bells have."""
    t = time_axis(length)
    body = np.sin(2 * np.pi * freq * t)
    shine = 0.45 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-rate * 2.2 * t)
    sparkle = 0.2 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-rate * 4 * t)
    return (body + shine + sparkle) * np.exp(-rate * t)


def roll() -> np.ndarray:
    """A die rattling in a cup and settling: clicks that come faster, then two slow last ones."""
    out = np.zeros(seconds(0.38))
    hits = [0.0, 0.045, 0.085, 0.118, 0.146, 0.171, 0.193, 0.24, 0.31]
    for index, at in enumerate(hits):
        click = band(rng.standard_normal(seconds(0.012)), 1800, 6500) * decay(0.012, 420)
        knock_freq = 700 + 140 * (index % 3)
        t = time_axis(0.05)
        knock = 0.9 * np.sin(2 * np.pi * knock_freq * t) * np.exp(-90 * t)
        strength = 1.0 if index < 7 else 0.75
        place(out, strength * click, at)
        place(out, strength * knock, at)
    rumble = 0.08 * band(rng.standard_normal(len(out)), 150, 900) * decay(0.38, 6)
    return finish(out + rumble, 0.95, fade_out=0.03)


def move() -> np.ndarray:
    """A wooden piece set down: a soft knock with a marimba-like ring."""
    t = time_axis(0.14)
    tone = np.sin(2 * np.pi * 620 * t) * np.exp(-38 * t)
    overtone = 0.35 * np.sin(2 * np.pi * 620 * 3.9 * t) * np.exp(-90 * t)
    tap = 0.5 * band(rng.standard_normal(len(t)), 2000, 5000) * np.exp(-600 * t)
    return finish(tone + overtone + tap, 0.7)


def capture() -> np.ndarray:
    """A swoosh as the piece is knocked away, then a soft thud as it lands back in its yard."""
    out = np.zeros(seconds(0.36))
    length = 0.2
    noise = rng.standard_normal(seconds(length))
    # The swoosh: the same noise heard through a band that slides down, high to low.
    pieces = []
    steps = 10
    chunk = len(noise) // steps
    for step in range(steps):
        centre = 3200 * (0.25 ** (step / (steps - 1)))
        part = band(noise, max(200, centre * 0.6), min(RATE / 2 - 100, centre * 1.4))
        pieces.append(part[step * chunk : (step + 1) * chunk])
    swoosh = np.concatenate(pieces)
    swoosh *= np.sin(np.linspace(0, np.pi, len(swoosh))) ** 1.5
    place(out, swoosh, 0.0)
    t = time_axis(0.16)
    sweep = 2 * np.pi * np.cumsum(np.linspace(150, 60, len(t))) / RATE
    thud = 1.4 * np.sin(sweep) * np.exp(-24 * t)
    place(out, thud, 0.19)
    return finish(out)


def finish_chime() -> np.ndarray:
    """A piece home: three rising bell notes, C, E and G."""
    out = np.zeros(seconds(0.39))
    for at, freq in [(0.0, 1046.5), (0.07, 1318.5), (0.14, 1568.0)]:
        place(out, bell(freq, 0.25), at)
    return finish(out)


def win() -> np.ndarray:
    """A short fanfare: G, C, E rising to a held high G, with a shimmer on top."""
    out = np.zeros(seconds(0.395))
    for at, freq, length in [(0.0, 784.0, 0.12), (0.06, 1046.5, 0.12), (0.12, 1318.5, 0.12), (0.18, 1568.0, 0.215)]:
        t = time_axis(length)
        # A brassy tone: a few warm harmonics, with a little vibrato on the last note.
        vibrato = 1 + (0.004 * np.sin(2 * np.pi * 6 * t) if length > 0.2 else 0)
        phase = 2 * np.pi * freq * np.cumsum(np.full(len(t), 1.0) * vibrato) / RATE
        tone = np.sin(phase) + 0.5 * np.sin(2 * phase) + 0.25 * np.sin(3 * phase)
        shape = np.minimum(1, t / 0.01) * np.exp(-(5 if length > 0.2 else 12) * t)
        place(out, tone * shape, at)
    shimmer = 0.12 * band(rng.standard_normal(len(out)), 6000, 12000)
    shimmer *= np.linspace(0, 1, len(out)) ** 2
    # The held note fades out over the last 120 ms, so it ends rather than stops.
    return finish(out + shimmer, fade_out=0.12)


def error() -> np.ndarray:
    """A gentle 'no': two soft low notes falling, never harsh."""
    out = np.zeros(seconds(0.22))
    for at, freq in [(0.0, 330.0), (0.09, 247.0)]:
        t = time_axis(0.12)
        tone = np.sin(2 * np.pi * freq * t) + 0.18 * np.sin(2 * np.pi * freq * 3 * t)
        place(out, tone * np.minimum(1, t / 0.006) * np.exp(-22 * t), at)
    return finish(out, 0.6)


# Where each sound starts in the file. sound.ts must say the same.
LAYOUT = [
    ("roll", 0.0, roll),
    ("move", 0.5, move),
    ("capture", 1.0, capture),
    ("finish", 1.5, finish_chime),
    ("win", 2.0, win),
    ("error", 2.5, error),
]


def main() -> None:
    sprite = np.zeros(seconds(TOTAL_SECONDS))
    for name, at, make in LAYOUT:
        sound = make()
        print(f"{name:8} starts {int(at * 1000):5} ms, lasts {len(sound) * 1000 // RATE:4} ms")
        place(sprite, sound, at)
    samples = np.clip(sprite, -1, 1)
    path = Path(__file__).resolve().parent.parent / "public" / "sounds" / "sprite.wav"
    with wave.open(str(path), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes((samples * 32767).astype("<i2").tobytes())
    print(f"written {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
