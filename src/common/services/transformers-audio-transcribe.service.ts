import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';

@Injectable()
export class TransformersAudioTranscribe implements OnModuleInit {
  private readonly logger = new Logger(TransformersAudioTranscribe.name);
  private transcriber: any = null;
  private pipeline: any;
  private WaveFile: any;
  private queue = 0;
  private readonly MAX_QUEUE = 5;

  async onModuleInit(): Promise<void> {
    try {
      // Dynamic imports for ESM modules
      const { pipeline } = await import('@xenova/transformers');
      const { WaveFile } = await import('wavefile');
      
      this.pipeline = pipeline;
      this.WaveFile = WaveFile;

      this.logger.log('Preloading Whisper model...');
      this.transcriber = await this.pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny.en',
        { quantized: true }
      );
      this.logger.log('✅ Model ready');
    } catch (err) {
      this.logger.error(`Init failed: ${err.message}`);
      throw err;
    }
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    if (this.queue >= this.MAX_QUEUE) {
      throw new BadRequestException('Server busy, retry later');
    }

    this.queue++;
    try {
      const wav = new this.WaveFile(audioBuffer);
      wav.toBitDepth('32f');
      wav.toSampleRate(16000);

      let samples = wav.getSamples();
      
      if (Array.isArray(samples)) {
        samples = samples[0];
      }

      const result = await this.transcriber(samples, {
        chunk_length_s: 30,
        stride_length_s: 5,
      });

      return result.text || '';
    } catch (err) {
      this.logger.error(`Transcription failed: ${err.message}`);
      throw new BadRequestException('Transcription failed');
    } finally {
      this.queue--;
    }
  }
}