import type { GameSound } from "../shared/sound-events";
const files = {
  deal: ["card-slide-1"],
  flip: ["card-place-1"],
  shuffle: ["card-shuffle"],
  cards: ["card-slide-1", "card-place-1"],
  chips: ["chip-lay-1", "chips-collide-1", "chips-collide-2", "chips-stack-3"],
  payout: ["chips-handle-2", "chips-stack-1"],
};
export function createAudioPlayer() {
  let context: AudioContext | null = null,
    master: GainNode | null = null,
    enabled = true;
  const buffers = new Map<string, AudioBuffer>(),
    loading = new Set<string>();
  let closed = false;
  async function load(name: string) {
    if (!context || buffers.has(name) || loading.has(name)) return;
    loading.add(name);
    try {
      const response = await fetch(`/audio/${name}.mp3`);
      if (!response.ok) return;
      const buffer = await context.decodeAudioData(
        await response.arrayBuffer(),
      );
      if (!closed) buffers.set(name, buffer);
    } catch {
    } finally {
      loading.delete(name);
    }
  }
  return {
    setEnabled(value: boolean) {
      enabled = value;
      if (master) master.gain.value = value ? 0.75 : 0;
    },
    unlock() {
      if (!enabled || closed) return;
      try {
        if (!context) {
          context = new AudioContext();
          master = context.createGain();
          master.gain.value = 0.75;
          master.connect(context.destination);
          for (const name of new Set(Object.values(files).flat()))
            void load(name);
        }
        if (context.state === "suspended")
          void context.resume().catch(() => {});
      } catch {}
    },
    play(sound: GameSound, delay = 0) {
      if (!enabled || !context || context.state !== "running" || !master)
        return;
      const ctx = context,
        output = master,
        start = ctx.currentTime + delay;
      if (sound === "turn") {
        for (const [offset, frequency] of [
          [0, 523.25],
          [0.13, 783.99],
        ]) {
          const osc = ctx.createOscillator(),
            gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = frequency;
          gain.gain.setValueAtTime(0, start + offset);
          gain.gain.linearRampToValueAtTime(0.09, start + offset + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.001, start + offset + 0.23);
          osc.connect(gain);
          gain.connect(output);
          osc.start(start + offset);
          osc.stop(start + offset + 0.24);
        }
        return;
      }
      const options = files[sound],
        name = options[Math.floor(Math.random() * options.length)],
        buffer = buffers.get(name);
      if (!buffer) {
        void load(name);
        return;
      }
      const source = ctx.createBufferSource(),
        gain = ctx.createGain();
      source.buffer = buffer;
      source.playbackRate.value = 0.95 + Math.random() * 0.1;
      gain.gain.value = ["cards", "deal", "flip", "shuffle"].includes(sound)
        ? 0.62
        : 0.9;
      source.connect(gain);
      gain.connect(output);
      source.start(start);
      if (sound === "payout") {
        const stack = buffers.get("chips-stack-1");
        if (stack) {
          const extra = ctx.createBufferSource();
          extra.buffer = stack;
          extra.connect(gain);
          extra.start(start + 0.22);
        }
      }
    },
    close() {
      closed = true;
      if (context) void context.close().catch(() => {});
      context = null;
      master = null;
      buffers.clear();
    },
  };
}
