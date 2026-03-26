"use client";

import { useState, useRef, useCallback } from "react";

/**
 * Hook for recording audio via the MediaRecorder API.
 * Returns a Blob (audio/webm) when recording stops.
 */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const startRecording = useCallback(async () => {
    // Reset previous blob
    setAudioBlob(null);
    chunksRef.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setAudioBlob(blob);
      // Stop all tracks so the browser mic indicator goes away
      stream.getTracks().forEach((t) => t.stop());
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  return { isRecording, audioBlob, startRecording, stopRecording };
}
