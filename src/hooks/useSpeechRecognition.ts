import { useState, useRef, useCallback } from "react";

export function useSpeechRecognition(onResult: (text: string) => void) {
  const [escuchando, setEscuchando] = useState(false);
  const recognitionRef = useRef<any>(null);

  const iniciar = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Tu navegador no soporta dictado de voz. Usa Chrome en Android.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "es-MX";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart  = () => setEscuchando(true);
    recognition.onend    = () => setEscuchando(false);
    recognition.onerror  = () => setEscuchando(false);
    recognition.onresult = (e: any) => {
      const texto = e.results[0][0].transcript;
      onResult(texto);
    };

    recognition.start();
  }, [onResult]);

  const detener = useCallback(() => {
    recognitionRef.current?.stop();
    setEscuchando(false);
  }, []);

  return { escuchando, iniciar, detener };
}