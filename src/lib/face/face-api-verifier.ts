import type {
  FaceVerificationInput,
  FaceVerificationResult,
  FaceVerificationService,
  LivenessProgress,
  LivenessStep,
} from './face-verification';
import { FACE_MODELS_URL } from './face-verification';

type Point = { x: number; y: number };

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function eyeAspectRatio(eye: Point[]): number {
  if (eye.length < 6) {
    return 1;
  }
  return (distance(eye[1], eye[5]) + distance(eye[2], eye[4])) / (2 * distance(eye[0], eye[3]));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

type LiveFace = {
  box: { x: number; y: number; width: number; height: number };
  ear: number;
  yaw: number;
  mouth: number;
  eyeLuma: number;
  descriptor: Float32Array;
};

function mouthOpenRatio(mouth: Point[]): number {
  if (mouth.length < 10) {
    return 0;
  }
  const width = distance(mouth[0], mouth[6]) || 1;
  return distance(mouth[3], mouth[9]) / width;
}

const lumaCanvas = typeof document === 'undefined' ? null : document.createElement('canvas');

function regionLuma(video: HTMLVideoElement, points: Point[], alreadyDrawn = false): number {
  if (!lumaCanvas || points.length === 0 || video.videoWidth < 8) {
    return 0;
  }
  const ctx = lumaCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return 0;
  }
  if (!alreadyDrawn) {
    lumaCanvas.width = video.videoWidth;
    lumaCanvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.max(0, Math.floor(Math.min(...xs) - 3));
  const y = Math.max(0, Math.floor(Math.min(...ys) - 3));
  const w = Math.min(lumaCanvas.width - x, Math.max(6, Math.ceil(Math.max(...xs) - x + 3)));
  const h = Math.min(lumaCanvas.height - y, Math.max(4, Math.ceil(Math.max(...ys) - y + 3)));
  const pixels = ctx.getImageData(x, y, w, h).data;
  let total = 0;
  let count = 0;
  for (let i = 0; i < pixels.length; i += 16) {
    total += pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
    count += 1;
  }
  return count === 0 ? 0 : total / count;
}

export class FaceApiVerifier implements FaceVerificationService {
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }
    const faceapi = await import('@vladmandic/face-api');
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODELS_URL),
    ]);
    this.loaded = true;
  }

  async verify(input: FaceVerificationInput): Promise<FaceVerificationResult> {
    await this.load();
    const faceapi = await import('@vladmandic/face-api');
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });

    const reference = await faceapi
      .detectSingleFace(input.referenceImage, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!reference) {
      return {
        matchScore: 0,
        distance: 1,
        livenessPassed: false,
        reason: 'Não achei um rosto nítido na selfie inicial. Tire outra foto no início do fluxo.',
      };
    }

    const done: LivenessStep[] = [];
    const report = (progress: LivenessProgress) => input.onProgress?.(progress);

    const detect = async (): Promise<LiveFace | null> => {
      const live = await faceapi
        .detectSingleFace(input.video, options)
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!live) {
        return null;
      }

      const jaw = live.landmarks.getJawOutline();
      const nose = live.landmarks.getNose();
      const left = jaw[0];
      const right = jaw[jaw.length - 1];
      const tip = nose[Math.min(3, nose.length - 1)];
      const width = Math.abs(right.x - left.x) || 1;
      const yaw = (tip.x - (left.x + right.x) / 2) / width;
      const leftEye = live.landmarks.getLeftEye();
      const rightEye = live.landmarks.getRightEye();
      const ear = (eyeAspectRatio(leftEye) + eyeAspectRatio(rightEye)) / 2;
      if (lumaCanvas && input.video.videoWidth > 8) {
        lumaCanvas.width = input.video.videoWidth;
        lumaCanvas.height = input.video.videoHeight;
        lumaCanvas.getContext('2d', { willReadFrequently: true })?.drawImage(input.video, 0, 0);
      }
      const eyeLuma =
        (regionLuma(input.video, leftEye, true) + regionLuma(input.video, rightEye, true)) / 2;

      return {
        box: live.detection.box,
        ear,
        yaw,
        mouth: mouthOpenRatio(live.landmarks.getMouth()),
        eyeLuma,
        descriptor: live.descriptor,
      };
    };

    const centered = (face: LiveFace): boolean => {
      const video = input.video;
      const cx = (face.box.x + face.box.width / 2) / video.videoWidth;
      const cy = (face.box.y + face.box.height / 2) / video.videoHeight;
      const cover = face.box.height / video.videoHeight;
      return cx > 0.32 && cx < 0.68 && cy > 0.28 && cy < 0.72 && cover > 0.28 && cover < 0.82;
    };

    const hold = async (
      step: LivenessStep,
      hint: string,
      timeoutMs: number,
      check: (face: LiveFace) => boolean,
    ): Promise<LiveFace | null> => {
      const started = Date.now();
      let stable = 0;
      while (Date.now() - started < timeoutMs) {
        const face = await detect();
        report({
          step,
          hint: face ? hint : 'Aproxime o rosto da câmera',
          faceFound: Boolean(face),
          centered: Boolean(face && centered(face)),
          done,
        });
        if (face && check(face)) {
          stable += 1;
          if (stable >= 3) {
            return face;
          }
        } else {
          stable = 0;
        }
        await wait(90);
      }
      return null;
    };

    report({
      step: 'center',
      hint: 'Encaixe o rosto no oval',
      faceFound: false,
      centered: false,
      done,
    });

    const inOval = await hold('center', 'Encaixe o rosto no oval e fique parado', 12000, centered);
    if (!inOval) {
      return {
        matchScore: 0,
        distance: 1,
        livenessPassed: false,
        reason: 'Encaixe o rosto no oval, com boa luz, e tente de novo.',
      };
    }
    done.push('center');

    report({
      step: 'blink',
      hint: 'Pisque ou sorria',
      faceFound: true,
      centered: true,
      done,
    });

    const ears: number[] = [];
    const lumas: number[] = [];
    const mouths: number[] = [];
    const boxesY: number[] = [];
    let misses = 0;
    let living = false;
    const blinkStarted = Date.now();

    while (Date.now() - blinkStarted < 18000 && !living) {
      const face = await detect();
      report({
        step: 'blink',
        hint: face ? 'Pisque, sorria ou acene' : 'Pisque de novo — feche os olhos um instante',
        faceFound: Boolean(face),
        centered: Boolean(face && centered(face)),
        done,
      });

      if (!face) {
        // TinyFaceDetector some no piscar; perda curta do rosto conta como movimento.
        misses += 1;
        await wait(50);
        continue;
      }

      const droppedWhileBlinking = misses >= 1 && misses <= 10 && ears.length >= 2;
      misses = 0;
      ears.push(face.ear);
      lumas.push(face.eyeLuma);
      mouths.push(face.mouth);
      boxesY.push(face.box.y);

      const window = ears.slice(-14);
      const earSwing = Math.max(...window) - Math.min(...window);
      const lumaWindow = lumas.slice(-14);
      const lumaSwing =
        lumaWindow.length > 3 ? Math.max(...lumaWindow) - Math.min(...lumaWindow) : 0;
      const mouthBase = mouths.length >= 4 ? median(mouths.slice(0, 4)) : face.mouth;
      const smiled = face.mouth > mouthBase + 0.035 || face.mouth > mouthBase * 1.12;
      const nodded =
        boxesY.length >= 5 && Math.max(...boxesY.slice(-8)) - Math.min(...boxesY.slice(-8)) > 8;

      living =
        droppedWhileBlinking ||
        (window.length >= 4 && earSwing >= 0.01) ||
        (window.length >= 8 && earSwing >= 0.007) ||
        lumaSwing >= 5 ||
        smiled ||
        nodded;

      await wait(50);
    }

    if (!living) {
      return {
        matchScore: 0,
        distance: 1,
        livenessPassed: false,
        reason: 'Pisque, sorria ou acene com a cabeça, com boa luz no rosto.',
      };
    }
    done.push('blink');

    const side: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';
    const turnHint =
      side === 'left' ? 'Vire o rosto para a sua esquerda' : 'Vire o rosto para a sua direita';
    report({
      step: 'turn',
      hint: turnHint,
      faceFound: true,
      centered: true,
      done,
    });

    const turned = await hold('turn', turnHint, 14000, (face) => {
      // Câmera frontal: virar à esquerda do usuário joga o nariz para a direita no quadro.
      return side === 'left' ? face.yaw > 0.07 : face.yaw < -0.07;
    });

    if (!turned) {
      return {
        matchScore: 0,
        distance: 1,
        livenessPassed: false,
        reason: `Vire o rosto para a ${side === 'left' ? 'esquerda' : 'direita'} até o oval acompanhar.`,
      };
    }
    done.push('turn');

    const matchFace = (await detect()) ?? turned;
    const distanceValue = faceapi.euclideanDistance(reference.descriptor, matchFace.descriptor);
    const matchScore = Math.max(0, Math.min(1, 1 - distanceValue));

    report({
      step: 'turn',
      hint: 'Pronto',
      faceFound: true,
      centered: true,
      done,
    });

    return {
      matchScore,
      distance: distanceValue,
      livenessPassed: true,
    };
  }
}

let singleton: FaceApiVerifier | null = null;

export function getFaceVerifier(): FaceVerificationService {
  singleton ??= new FaceApiVerifier();
  return singleton;
}
