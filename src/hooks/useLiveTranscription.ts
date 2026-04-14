import { useCallback, useRef, useState } from "react";
import { API } from "@/utils/api";
import type {
  GoogleLiveTranscriptionSession,
  LiveTranscriptionSession,
  OpenAILiveTranscriptionSession,
} from "@/types";

interface TranscriptItem {
  itemId: string;
  previousItemId: string | null;
  delta: string;
  transcript: string | null;
}

export interface RecordingResult {
  sessionId: string;
  transcript: string;
  audioBlob: Blob;
  audioDuration: number;
  mimeType: string;
}

interface UseLiveTranscriptionOptions {
  facilityId?: string;
  encounterId?: string;
  language?: string;
}

interface UseLiveTranscriptionReturn {
  isConnected: boolean;
  isRecording: boolean;
  transcript: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecordingResult | null>;
}

function isGoogleSession(
  session: LiveTranscriptionSession,
): session is GoogleLiveTranscriptionSession {
  return "provider" in session && session.provider === "google";
}

export function useLiveTranscription(
  options: UseLiveTranscriptionOptions = {},
): UseLiveTranscriptionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef("");

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const itemsRef = useRef<Map<string, TranscriptItem>>(new Map());
  const orderRef = useRef<string[]>([]);

  // Local audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  const recordingStartTimeRef = useRef<number>(0);

  // Session tracking refs
  const sessionIdRef = useRef<string | null>(null);
  const providerRef = useRef<"google" | "openai" | null>(null);

  // ── OpenAI ordered-transcript helpers ──────────────────────────

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

  // ── Shared cleanup ─────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore stop errors during cleanup
        }
      }
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];
    sessionIdRef.current = null;
    providerRef.current = null;
    recordingStartTimeRef.current = 0;
    mimeTypeRef.current = "audio/webm";
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

  // ── Google STT provider ────────────────────────────────────────

  const startGoogleRecording = useCallback(
    async (session: GoogleLiveTranscriptionSession) => {
      // Build WS URL with session JWT token
      const wsUrl = `${session.url}?token=${encodeURIComponent(session.token)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        ws.onopen = () => {
          if (!settled) {
            settled = true;
            setIsConnected(true);

            // Send config as first text message
            ws.send(
              JSON.stringify({
                language: session.config.language,
                model: session.config.model,
                sample_rate: 16000,
                interim_results: true,
              }),
            );
            resolve();
          }
        };
        ws.onerror = () => {
          if (!settled) {
            settled = true;
            reject(new Error("WebSocket connection failed"));
          }
        };
        ws.onclose = (e) => {
          if (!settled) {
            settled = true;
            reject(new Error(`WebSocket closed: ${e.code} ${e.reason}`));
          }
        };
        setTimeout(() => {
          if (!settled) {
            settled = true;
            ws.close();
            reject(new Error("WebSocket connection timeout"));
          }
        }, 10000);
      });

      // Wait for the "ready" message from middleware
      await new Promise<void>((resolve, reject) => {
        const onMessage = (event: MessageEvent) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "ready") {
            ws.removeEventListener("message", onMessage);
            resolve();
          } else if (msg.type === "error") {
            ws.removeEventListener("message", onMessage);
            reject(new Error(msg.detail || "Transcription session error"));
          }
        };
        ws.addEventListener("message", onMessage);
        setTimeout(() => {
          ws.removeEventListener("message", onMessage);
          reject(new Error("Timed out waiting for transcription session"));
        }, 15000);
      });

      // Handle incoming transcript messages
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "transcript": {
            if (msg.is_final) {
              setTranscript((prev) => {
                const next = prev ? `${prev} ${msg.text}` : msg.text;
                transcriptRef.current = next;
                return next;
              });
            }
            break;
          }
          case "usage": {
            // Usage tracking handled server-side
            break;
          }
          case "error": {
            console.error("Google STT error:", msg.detail);
            setError(msg.detail || "Transcription error");
            break;
          }
        }
      };

      ws.onclose = () => setIsConnected(false);
      ws.onerror = () => {
        setError("WebSocket error");
        cleanup();
      };

      // Audio capture at 16kHz for Google STT (sends raw PCM16 binary)
      await setupAudioCapture(ws, 16000, "binary");
      providerRef.current = "google";
      setIsRecording(true);
    },
    [cleanup],
  );

  // ── OpenAI provider ────────────────────────────────────────────

  const startOpenAIRecording = useCallback(
    async (session: OpenAILiveTranscriptionSession) => {
      const model = session.model || "gpt-4o-transcribe";
      const wsUrl = "wss://api.openai.com/v1/realtime?intent=transcription";
      const ws = new WebSocket(wsUrl, [
        "realtime",
        `openai-insecure-api-key.${session.client_secret.value}`,
        "openai-beta.realtime-v1",
      ]);
      wsRef.current = ws;

      console.log("Connecting to:", wsUrl, "with model:", model);

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

      // Handle incoming transcription events
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
              if (!orderRef.current.includes(msg.item_id)) {
                orderRef.current.push(msg.item_id);
              }
            }
            {
              const next = buildOrderedTranscript();
              transcriptRef.current = next;
              setTranscript(next);
            }
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
            {
              const next = buildOrderedTranscript();
              transcriptRef.current = next;
              setTranscript(next);
            }
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

      ws.onclose = () => setIsConnected(false);
      ws.onerror = () => {
        setError("WebSocket error");
        cleanup();
      };

      // Audio capture at 24kHz for OpenAI (sends base64 JSON)
      await setupAudioCapture(ws, 24000, "base64");
      providerRef.current = "openai";
      setIsRecording(true);
    },
    [buildOrderedTranscript, insertInOrder, cleanup],
  );

  // ── Shared audio capture setup ─────────────────────────────────

  const setupAudioCapture = useCallback(
    async (ws: WebSocket, sampleRate: number, mode: "binary" | "base64") => {
      const audioContext = new AudioContext({ sampleRate });
      audioContextRef.current = audioContext;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Start local recording for later upload
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mimeTypeRef.current = mediaRecorder.mimeType || "audio/webm";
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      recordingStartTimeRef.current = Date.now();

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const sendAudio =
        mode === "binary"
          ? (pcm16Buffer: ArrayBuffer) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(pcm16Buffer);
              }
            }
          : (pcm16Buffer: ArrayBuffer) => {
              if (ws.readyState === WebSocket.OPEN) {
                const bytes = new Uint8Array(pcm16Buffer);
                let binary = "";
                for (let i = 0; i < bytes.length; i++) {
                  binary += String.fromCharCode(bytes[i]);
                }
                ws.send(
                  JSON.stringify({
                    type: "input_audio_buffer.append",
                    audio: btoa(binary),
                  }),
                );
              }
            };

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

        workletNode.port.onmessage = (e) => sendAudio(e.data);
      } catch {
        // Fallback to ScriptProcessorNode (deprecated but widely supported)
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
          const float32 = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            int16[i] = Math.max(
              -32768,
              Math.min(32767, Math.floor(float32[i] * 32768)),
            );
          }
          sendAudio(int16.buffer);
        };

        workletRef.current = processor as unknown as AudioWorkletNode;
      }
    },
    [],
  );

  // ── Entry point ────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript("");
    transcriptRef.current = "";
    itemsRef.current.clear();
    orderRef.current = [];

    try {
      const session = await API.liveTranscription.getToken({
        facility_id: options.facilityId,
        encounter_id: options.encounterId,
        language: options.language,
      });

      sessionIdRef.current = isGoogleSession(session)
        ? session.session_id
        : session.session_id;

      if (isGoogleSession(session)) {
        await startGoogleRecording(session);
      } else {
        await startOpenAIRecording(session);
      }
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
    options.encounterId,
    options.language,
    startGoogleRecording,
    startOpenAIRecording,
    cleanup,
  ]);

  const stopRecording =
    useCallback(async (): Promise<RecordingResult | null> => {
      // Capture values before cleanup resets them
      const sessionId = sessionIdRef.current;
      const currentTranscript = transcriptRef.current;
      const startTime = recordingStartTimeRef.current;

      // Stop MediaRecorder and collect recorded audio
      const audioBlob = await new Promise<Blob>((resolve) => {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state === "inactive") {
          resolve(
            new Blob(audioChunksRef.current, { type: mimeTypeRef.current }),
          );
          return;
        }
        recorder.addEventListener(
          "stop",
          () => {
            resolve(
              new Blob(audioChunksRef.current, { type: mimeTypeRef.current }),
            );
          },
          { once: true },
        );
        recorder.stop();
      });

      const audioDuration = startTime
        ? Number(((Date.now() - startTime) / 1000).toFixed(2))
        : 0;
      const mimeType = mimeTypeRef.current;
      const provider = providerRef.current;
      const ws = wsRef.current;

      // For Google: send stop signal before cleanup
      if (provider === "google" && ws?.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "stop" }));
        } catch {
          // Ignore send errors during cleanup
        }
      } else if (ws?.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "stop" }));
        } catch {
          // Ignore send errors during cleanup
        }
      }

      cleanup();

      if (!sessionId) return null;

      return {
        sessionId,
        transcript: currentTranscript,
        audioBlob,
        audioDuration,
        mimeType,
      };
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
