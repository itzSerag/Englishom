import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { pipeline } from '@xenova/transformers';
import { WaveFile } from 'wavefile';

@Injectable()
export class TransformersAudioTranscribe  implements OnModuleInit {
  private readonly logger = new Logger(TransformersAudioTranscribe.name);
  
  private inFlight = 0;
  private readonly MAX_CONCURRENCY = 15;
  private transcriber: any | null = null;

  async transcribeAudio(audioBuffer: Buffer, options?: { model?: string }): Promise<string> {
    return this.withConcurrencyLimit(async () => {
      try {
        if (!this.transcriber) {
          const modelName = options?.model ?? 'Xenova/whisper-tiny.en';
          this.transcriber = await pipeline('automatic-speech-recognition', modelName);
        }

        // ✅ Process audio directly from buffer (no temp file needed!)
        const audioData = this.processAudioBuffer(audioBuffer);

        // ✅ Run transcription
        const output = await this.transcriber(audioData);
      
        return output?.text ?? '';
      } catch (err) {
        this.logger.error(`Transcription failed: ${err.message}`);
        throw new BadRequestException(`Transcription error: ${err.message}`);
      }
    });
  }

  /**
   * Convert audio buffer to Float32Array format required by Whisper
   */
  private processAudioBuffer(buffer: Buffer): Float32Array {
    try {
      // Read .wav file and convert to required format
      const wav = new WaveFile(buffer);
      
      // Convert to 32-bit float (pipeline expects Float32Array)
      wav.toBitDepth('32f');
      
      // Whisper expects 16kHz sampling rate
      wav.toSampleRate(16000);
      
      let audioData: any = wav.getSamples();
      
      // Handle multi-channel audio (merge to mono)
      if (Array.isArray(audioData)) {
        if (audioData.length > 1) {
          const SCALING_FACTOR = Math.sqrt(2);
          
          // Merge channels into first channel
          for (let i = 0; i < audioData[0].length; ++i) {
            audioData[0][i] = SCALING_FACTOR * (audioData[0][i] + audioData[1][i]) / 2;
          }
        }
        
        // Select first channel
        audioData = audioData[0];
      }
      
      // Ensure we return a Float32Array (convert from Float64Array, Array<number>, etc. if needed)
      if (!(audioData instanceof Float32Array)) {
        return Float32Array.from(audioData);
      }
      
      return audioData ;
    } catch (err) {
      this.logger.error(`Audio processing failed: ${err.message}`);
      throw new Error(`Invalid audio format: ${err.message}`);
    }
  }

  /**
   * Preload the model on application startup (optional but recommended)
   */
  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Preloading Whisper model...');
      const modelName = 'Xenova/whisper-tiny.en';
      this.transcriber = await pipeline('automatic-speech-recognition', modelName);
    } catch (err) {
      this.logger.warn(`Failed to preload model: ${err.message}`);
    }
  }

  private async withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inFlight < this.MAX_CONCURRENCY) {
      this.inFlight++;
      try {
        return await fn();
      } finally {
        this.inFlight--;
      }
    }

    const start = Date.now();
    const MAX_WAIT_MS = 10_000;
    let delay = 50;

    while (this.inFlight >= this.MAX_CONCURRENCY) {
      if (Date.now() - start > MAX_WAIT_MS) {
        throw new BadRequestException('Server is busy, please try again shortly.');
      }
      await new Promise(r => setTimeout(r, delay + Math.random() * 25));
      delay = Math.min(250, delay * 1.5);
    }

    this.inFlight++;
    try {
      return await fn();
    } finally {
      this.inFlight--;
    }
  }
}