import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';

@Injectable()
export class TransformersAudioTranscribe implements OnModuleInit {
  private readonly logger = new Logger(TransformersAudioTranscribe.name);
  
  private inFlight = 0;
  private readonly MAX_CONCURRENCY = 15;
  private transcriber: any | null = null;
  private pipeline: any;
  private WaveFile: any;

  async onModuleInit(): Promise<void> {
    // ✅ Dynamic import for ESM packages
    const transformers = await import('@xenova/transformers');
    this.pipeline = transformers.pipeline;
    
    const wavefile = await import('wavefile');
    this.WaveFile = wavefile.WaveFile;

    // Preload model
    try {
      this.logger.log('Preloading Whisper model...');
      this.transcriber = await this.pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
      this.logger.log('✅ Model preloaded successfully');
    } catch (err) {
      this.logger.warn(`Failed to preload model: ${err.message}`);
    }
  }

  async transcribeAudio(audioBuffer: Buffer, options?: { model?: string }): Promise<string> {
    return this.withConcurrencyLimit(async () => {
      try {
        if (!this.transcriber) {
          const modelName = options?.model ?? 'Xenova/whisper-tiny.en';
          this.logger.log(`Loading Whisper model: ${modelName}...`);
          this.transcriber = await this.pipeline('automatic-speech-recognition', modelName);
        }

        const audioData = this.processAudioBuffer(audioBuffer);

        this.logger.log('Running transcription...');
        const start = performance.now();
        const output = await this.transcriber(audioData);
        const duration = ((performance.now() - start) / 1000).toFixed(2);
        
        this.logger.log(`✅ Transcription completed in ${duration}s`);

        return output?.text ?? '';
      } catch (err) {
        this.logger.error(`Transcription failed: ${err.message}`);
        throw new BadRequestException(`Transcription error: ${err.message}`);
      }
    });
  }

  private processAudioBuffer(buffer: Buffer): Float32Array {
    try {
      const wav = new this.WaveFile(buffer);
      
      wav.toBitDepth('32f');
      wav.toSampleRate(16000);
      
      let audioData = wav.getSamples();
      
      if (Array.isArray(audioData)) {
        if (audioData.length > 1) {
          const SCALING_FACTOR = Math.sqrt(2);
          
          for (let i = 0; i < audioData[0].length; ++i) {
            audioData[0][i] = SCALING_FACTOR * (audioData[0][i] + audioData[1][i]) / 2;
          }
        }
        
        audioData = audioData[0];
      }
      
      return audioData as Float32Array;
    } catch (err) {
      this.logger.error(`Audio processing failed: ${err.message}`);
      throw new Error(`Invalid audio format: ${err.message}`);
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