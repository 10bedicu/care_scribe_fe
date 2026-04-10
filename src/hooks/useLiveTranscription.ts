import { useCallback, useRef, useState } from "react";
import { API } from "@/utils/api";

interface TranscriptItem {
  itemId: string;
  previousItemId: string | null;
  delta: string;
  transcript: string | null;
}

interface UseLiveTranscriptionOptions {
  facilityId?: string;
  language?: string;
}

interface UseLiveTranscriptionReturn {
  isConnected: boolean;
  isRecording: boolean;
  transcript: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useLiveTranscription(
  options: UseLiveTranscriptionOptions = {},
): UseLiveTranscriptionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const itemsRef = useRef<Map<string, TranscriptItem>>(new Map());
  const orderRef = useRef<string[]>([]);

  const buildOrderedTranscript = useCallback(() => {
    const items = itemsRef.current;
    const order = orderRef.current;

    return order
      .map((itemId) => {
        const item = items.get(itemId);
        if (!item) return "";
        return item.transcript ?? item.delta;
      })
      .filter(Boolean)
      .join(" ");
  }, []);

  const insertInOrder = useCallback(
    (itemId: string, previousItemId: string | null) => {
      const order = orderRef.current;
      if (order.includes(itemId)) return;

      if (!previousItemId) {
        // No previous item - insert at start if order is empty, else append
        if (order.length === 0) {
          order.push(itemId);
        } else {
          order.push(itemId);
        }
      } else {
        const prevIdx = order.indexOf(previousItemId);
        if (prevIdx === -1) {
          order.push(itemId);
        } else {
          order.splice(prevIdx + 1, 0, itemId);
        }
      }
    },
    [],
  );

  const cleanup = useCallback(() => {
    if (workletRef.current) {
      workletRef.current.disconnect();
      workletRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript("");
    itemsRef.current.clear();
    orderRef.current = [];

    try {
      // Step 1: Get ephemeral token from backend
      const session = await API.liveTranscription.getToken({
        facility_id: options.facilityId,
        language: options.language,
      });

      console.log("Live transcription session:", {
        id: session.id,
        model: session.model,
        hasClientSecret: !!session.client_secret?.value,
        expiresAt: session.client_secret?.expires_at,
      });

      // Step 2: Connect WebSocket to OpenAI
      const model = session.model || "gpt-4o-transcribe";
      const wsUrl = "wss://api.openai.com/v1/realtime?intent=transcription";
      console.log("Connecting to:", wsUrl, "with model:", model);
      const ws = new WebSocket(wsUrl, [
        "realtime",
        `openai-insecure-api-key.${session.client_secret.value}`,
        "openai-beta.realtime-v1",
      ]);
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        ws.onopen = () => {
          if (!settled) {
            settled = true;
            setIsConnected(true);
            resolve();
          }
        };
        ws.onerror = (e) => {
          if (!settled) {
            settled = true;
            console.error("WebSocket error:", e);
            reject(new Error("WebSocket connection failed"));
          }
        };
        ws.onclose = (e) => {
          if (!settled) {
            settled = true;
            console.error("WebSocket closed during connect:", e.code, e.reason);
            reject(new Error(`WebSocket closed: ${e.code} ${e.reason}`));
          }
        };
        setTimeout(() => {
          if (!settled) {
            settled = true;
            console.error("WebSocket state at timeout:", ws.readyState);
            ws.close();
            reject(new Error("WebSocket connection timeout"));
          }
        }, 10000);
      });

      // Step 3: Handle incoming transcription events
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "conversation.item.input_audio_transcription.delta": {
            const item = itemsRef.current.get(msg.item_id);
            if (item) {
              item.delta += msg.delta;
            } else {
              itemsRef.current.set(msg.item_id, {
                itemId: msg.item_id,
                previousItemId: null,
                delta: msg.delta,
                transcript: null,
              });
              // If not yet in order, append (committed event may arrive later)
              if (!orderRef.current.includes(msg.item_id)) {
                orderRef.current.push(msg.item_id);
              }
            }
            setTranscript(buildOrderedTranscript());
            break;
          }

          case "conversation.item.input_audio_transcription.completed": {
            const item = itemsRef.current.get(msg.item_id);
            if (item) {
              item.transcript = msg.transcript;
            } else {
              itemsRef.current.set(msg.item_id, {
                itemId: msg.item_id,
                previousItemId: null,
                delta: "",
                transcript: msg.transcript,
              });
              if (!orderRef.current.includes(msg.item_id)) {
                orderRef.current.push(msg.item_id);
              }
            }
            setTranscript(buildOrderedTranscript());
            break;
          }

          case "input_audio_buffer.committed": {
            const existing = itemsRef.current.get(msg.item_id);
            if (existing) {
              existing.previousItemId = msg.previous_item_id ?? null;
            } else {
              itemsRef.current.set(msg.item_id, {
                itemId: msg.item_id,
                previousItemId: msg.previous_item_id ?? null,
                delta: "",
                transcript: null,
              });
            }
            insertInOrder(msg.item_id, msg.previous_item_id ?? null);
            break;
          }

          case "error": {
            console.error("Realtime API error:", msg.error);
            setError(msg.error?.message || "Transcription error");
            break;
          }
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      ws.onerror = () => {
        setError("WebSocket error");
        cleanup();
      };

      // Step 4: Set up microphone audio capture at 24kHz PCM16
      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Use AudioWorklet for efficient processing - fall back to ScriptProcessor
      try {
        const workletCode = `
          class PCM16Processor extends AudioWorkletProcessor {
            process(inputs) {
              const input = inputs[0];
              if (input.length > 0) {
                const float32 = input[0];
                const int16 = new Int16Array(float32.length);
                for (let i = 0; i < float32.length; i++) {
                  int16[i] = Math.max(-32768, Math.min(32767, Math.floor(float32[i] * 32768)));
                }
                this.port.postMessage(int16.buffer, [int16.buffer]);
              }
              return true;
            }
          }
          registerProcessor('pcm16-processor', PCM16Processor);
        `;
        const blob = new Blob([workletCode], {
          type: "application/javascript",
        });
        const url = URL.createObjectURL(blob);
        await audioContext.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);

        const workletNode = new AudioWorkletNode(
          audioContext,
          "pcm16-processor",
        );
        workletRef.current = workletNode;
        source.connect(workletNode);
        workletNode.connect(audioContext.destination);

        workletNode.port.onmessage = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const bytes = new Uint8Array(e.data);
            let binary = "";
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            ws.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: base64,
              }),
            );
          }
        };
      } catch {
        // Fallback to ScriptProcessorNode (deprecated but widely supported)
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const float32 = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            int16[i] = Math.max(
              -32768,
              Math.min(32767, Math.floor(float32[i] * 32768)),
            );
          }
          const bytes = new Uint8Array(int16.buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          ws.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: base64,
            }),
          );
        };

        // Store processor reference for cleanup via a workaround
        // ScriptProcessorNode doesn't have a clean ref, so store in worklet ref
        workletRef.current = processor as unknown as AudioWorkletNode;
      }

      setIsRecording(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to start live transcription";
      setError(message);
      cleanup();
      throw err;
    }
  }, [
    options.facilityId,
    options.language,
    buildOrderedTranscript,
    insertInOrder,
    cleanup,
  ]);

  const stopRecording = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return {
    isConnected,
    isRecording,
    transcript,
    error,
    startRecording,
    stopRecording,
  };
}
