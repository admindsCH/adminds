"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Hook for voice dictation using the Web Speech API.
 * Appends recognized speech to a text setter (e.g. notes textarea).
 * Falls back gracefully if the browser doesn't support it.
 */
export function useVoiceDictation(
  setText: React.Dispatch<React.SetStateAction<string>>
) {
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const toggle = useCallback(() => {
    // Stop if already listening
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    // Check browser support — vendor-prefixed on most browsers
    const SpeechRecognition =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-CH"; // Swiss French
    recognition.continuous = true; // Keep listening until stopped
    recognition.interimResults = false; // Only final transcripts

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      // Append each recognized phrase to the existing text
      const transcript = Array.from(e.results)
        .slice(e.resultIndex)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join("");
      setText((prev) => (prev ? prev + " " + transcript : transcript));
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [setText]);

  return { listening, toggle };
}
