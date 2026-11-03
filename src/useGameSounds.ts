import { useEffect, useRef, useState } from "react";
import type { View } from "../shared/types";
import { soundEvents } from "../shared/sound-events";
import { createAudioPlayer } from "./audio";
const preference = "office-poker:sound";
export function useGameSounds(game: View | null) {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(preference) !== "off";
    } catch {
      return true;
    }
  });
  const player = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const previous = useRef<View | null>(null);
  useEffect(() => {
    const audio = createAudioPlayer();
    player.current = audio;
    const unlock = () => audio.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      audio.close();
      player.current = null;
    };
  }, []);
  useEffect(() => {
    player.current?.setEnabled(enabled);
    try {
      localStorage.setItem(preference, enabled ? "on" : "off");
    } catch {}
  }, [enabled]);
  useEffect(() => {
    if (!game) return;
    soundEvents(previous.current, game).forEach((sound, i) =>
      player.current?.play(sound, i * 0.12),
    );
    previous.current = game;
  }, [game]);
  return {
    enabled,
    toggle: () => {
      const value = !enabled;
      player.current?.setEnabled(value);
      if (value) player.current?.unlock();
      setEnabled(value);
    },
  };
}
