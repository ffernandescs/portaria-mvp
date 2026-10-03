export type LivenessStep = 'center' | 'blink' | 'turn';

export type LivenessProgress = {
  step: LivenessStep;
  hint: string;
  faceFound: boolean;
  centered: boolean;
  done: LivenessStep[];
};

export type FaceVerificationInput = {
  video: HTMLVideoElement;
  referenceImage: HTMLImageElement;
  onProgress?: (progress: LivenessProgress) => void;
};

export type FaceVerificationResult = {
  matchScore: number;
  distance: number;
  livenessPassed: boolean;
  reason?: string;
};

export interface FaceVerificationService {
  load(): Promise<void>;
  verify(input: FaceVerificationInput): Promise<FaceVerificationResult>;
}

export const FACE_MODELS_URL =
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/';
