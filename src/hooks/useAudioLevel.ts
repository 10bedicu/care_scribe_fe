import { useEffect, useState } from "react";

const DEFAULT_BAR_COUNT = 5;

/**
 * Analyses a live `MediaStream` and returns a set of normalized (0-1)
 * volume levels, one per bar, useful for rendering a simple speech
 * activity indicator while recording.
 *
 * Every bar tracks the same overall loudness, each one showing a
 * slightly older sample than the last. This produces a small ripple
 * effect across the bars while keeping all of them tied to how loud
 * the speaker is, rather than to any particular frequency range (e.g.
 * bass vs. treble), which would make individual bars react only to
 * certain sounds (like a low voice vs. a sharp snap).
 *
 * Metering is done on a dedicated, unprocessed copy of the microphone
 * input (autoGainControl/noiseSuppression/echoCancellation disabled),
 * rather than on the stream passed in directly. Browsers normalize the
 * default recording stream within about a second (auto gain control),
 * which otherwise makes the meter flatten out and stop reacting.
 *
 * Levels are read from a `ScriptProcessorNode` connected all the way to
 * `audioContext.destination` (writing nothing to its output, so it stays
 * silent). This is necessary for reliability: browsers can prove a node
 * like a muted `GainNode` will always produce silence and skip pulling
 * its entire upstream chain (including the analyser) as an optimization,
 * which freezes the meter after a few frames. A script processor's JS
 * callback has observable side effects the engine can't optimize away,
 * so the whole chain keeps being processed for as long as it's connected.
 *
 * Returns an array of zeros when `stream` is `null`.
 */
export function useAudioLevel(
  stream: MediaStream | null,
  barCount: number = DEFAULT_BAR_COUNT,
) {
  const [levels, setLevels] = useState<number[]>(() =>
    new Array(barCount).fill(0),
  );

  useEffect(() => {
    if (!stream) {
      setLevels(new Array(barCount).fill(0));
      return;
    }

    let cancelled = false;
    let meterStream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let processor: ScriptProcessorNode | null = null;

    const setup = async () => {
      const track = stream.getAudioTracks()[0];
      const deviceId = track?.getSettings().deviceId;

      try {
        meterStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch {
        // Fall back to the shared recording stream if a dedicated raw
        // stream can't be opened (e.g. device doesn't allow a second tap).
        meterStream = stream;
      }
      if (cancelled || !meterStream) return;

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioContext = new AudioContextClass();
      source = audioContext.createMediaStreamSource(meterStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      // Lower smoothing than the AnalyserNode default (0.8) so the meter
      // reacts snappily to speech instead of averaging it away.
      analyser.smoothingTimeConstant = 0.4;
      // Deprecated but still supported everywhere, and required here: see
      // the doc comment above for why this must reach the destination.
      processor = audioContext.createScriptProcessor(2048, 1, 1);

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(audioContext.destination);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let history = new Array(barCount).fill(0);
      // Adaptive noise floor: tracks the ambient background level so it
      // can be subtracted out, leaving mostly actual speech. Falls quickly
      // to follow the room getting quieter, but only creeps up slowly so a
      // sustained loud voice doesn't get mistaken for a noisier room.
      let noiseFloor: number | null = null;
      const NOISE_MARGIN = 6;

      processor.onaudioprocess = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;

        if (noiseFloor === null) {
          noiseFloor = average;
        } else if (average < noiseFloor) {
          noiseFloor = noiseFloor * 0.9 + average * 0.1;
        } else {
          noiseFloor = noiseFloor * 0.995 + average * 0.005;
        }
        const aboveFloor = Math.max(0, average - noiseFloor - NOISE_MARGIN);

        // Aggressively boost speech that rises above the noise floor (low
        // divisor + sqrt-like curve) so normal talking volume clearly
        // moves the meter, while ambient noise near the floor stays flat.
        const level = Math.min(1, Math.pow(aboveFloor / 25, 0.5));

        history = [...history.slice(1), level];
        setLevels(history);
      };
    };
    setup();

    return () => {
      cancelled = true;
      if (processor) processor.onaudioprocess = null;
      source?.disconnect();
      analyser?.disconnect();
      processor?.disconnect();
      audioContext?.close();
      if (meterStream && meterStream !== stream) {
        meterStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream, barCount]);

  return levels;
}

export default useAudioLevel;
