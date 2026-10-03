type RecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const speech = window as Window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speech.SpeechRecognition ?? speech.webkitSpeechRecognition ?? null;
}

export function canUseSpeechRecognition(): boolean {
  return recognitionCtor() !== null;
}

export function canUseSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string): void {
  if (!canUseSpeechSynthesis()) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

export function listenOnce(timeoutMs = 8000): Promise<string> {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    return Promise.reject(new Error('Este navegador não reconhece voz. Digite o destino.'));
  }

  return new Promise((resolve, reject) => {
    const recognition = new Ctor();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.continuous = false;

    const timer = window.setTimeout(() => {
      recognition.stop();
      reject(new Error('Não ouvi nada. Tente de novo ou digite.'));
    }, timeoutMs);

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? '';
      window.clearTimeout(timer);
      if (transcript.length < 3) {
        reject(new Error('Fale o nome, o bloco ou a unidade.'));
        return;
      }
      resolve(transcript);
    };

    recognition.onerror = (event) => {
      window.clearTimeout(timer);
      reject(new Error(event.error === 'not-allowed' ? 'Permita o microfone para buscar por voz.' : 'Não foi possível ouvir.'));
    };

    recognition.onend = () => {
      window.clearTimeout(timer);
    };

    recognition.start();
  });
}
