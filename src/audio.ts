import type { GameSound } from "../shared/sound-events";

// Short synthesized foley, generated locally: no downloads or third-party audio.
export function createAudioPlayer() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let enabled = true;
  return {
    setEnabled(value: boolean) {
      enabled = value;
      if (master) master.gain.value = value ? 0.32 : 0;
    },
    unlock() {
      if (!enabled) return;
      try {
        if (!context) {
          context = new AudioContext();
          master = context.createGain();
          master.gain.value = 0.32;
          master.connect(context.destination);
        }
        if (context.state === "suspended")
          void context.resume().catch(() => {});
      } catch {
        /* A browser without audio still gets the complete game. */
      }
    },
    play(sound: GameSound, delay = 0) {
      if (!enabled || !context || context.state !== "running" || !master)
        return;
      const ctx = context,
        output = master,
        start = ctx.currentTime + delay;
      function tone(
        time: number,
        frequency: number,
        duration: number,
        volume: number,
      ) {
        const osc = ctx.createOscillator(),
          gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        osc.connect(gain);
        gain.connect(output);
        osc.start(time);
        osc.stop(time + duration);
      }
      function noise(
        time: number,
        duration: number,
        frequency: number,
        volume: number,
      ) {
        const buffer = ctx.createBuffer(
          1,
          Math.ceil(ctx.sampleRate * duration),
          ctx.sampleRate,
        );
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++)
          samples[i] = Math.random() * 2 - 1;
        const source = ctx.createBufferSource(),
          filter = ctx.createBiquadFilter(),
          gain = ctx.createGain();
        source.buffer = buffer;
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(frequency, time);
        filter.frequency.exponentialRampToValueAtTime(
          frequency * 0.55,
          time + duration,
        );
        filter.Q.value = 0.7;
        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(volume, time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(output);
        source.start(time);
        source.stop(time + duration);
      }
      if (sound === "cards") {
        for (let i = 0; i < 3; i++) noise(start + i * 0.085, 0.12, 3100, 0.42);
      } else if (sound === "chips") {
        for (let i = 0; i < 4; i++) {
          tone(start + i * 0.037, 1700 + i * 370, 0.065, 0.15);
          tone(start + i * 0.037, 3100 - i * 170, 0.035, 0.07);
          noise(start + i * 0.037, 0.045, 4800, 0.12);
        }
      } else {
        tone(start, 660, 0.15, 0.22);
        tone(start + 0.13, 880, 0.24, 0.2);
      }
    },
    close() {
      if (context) void context.close().catch(() => {});
      context = null;
      master = null;
    },
  };
}
