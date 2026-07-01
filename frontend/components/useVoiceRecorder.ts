"use client";

import { useCallback, useRef, useState } from "react";
import { blobToWav } from "@/lib/wav";

/**
 * Records a short voice note from the microphone and returns it as a WAV File
 * (Gemini friendly). The citizen can speak in Kannada, Hindi, or English; the
 * backend transcribes and translates it.
 */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setAudioFile(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot record audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        setProcessing(true);
        try {
          const webm = new Blob(chunksRef.current, {
            type: mr.mimeType || "audio/webm",
          });
          const wav = await blobToWav(webm);
          setAudioFile(new File([wav], "voice-note.wav", { type: "audio/wav" }));
        } catch {
          setError("Could not process the recording. Try again.");
        } finally {
          setProcessing(false);
          streamRef.current?.getTracks().forEach((t) => t.stop());
        }
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setError("Microphone permission is needed to record a voice note.");
    }
  }, []);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    setRecording(false);
  }, []);

  const reset = useCallback(() => {
    setAudioFile(null);
    setError(null);
  }, []);

  return { recording, processing, audioFile, error, start, stop, reset };
}
