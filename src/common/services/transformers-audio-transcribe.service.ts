import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { pipeline, Pipeline } from '@xenova/transformers';
import { WaveFile } from 'wavefile';

@Injectable()
export class TransformersAudioTranscribe implements OnModuleInit {
  private readonly logger = new Logger(TransformersAudioTranscribe.name);
  private transcriber: Pipeline | null = null;
  private queue = 0;
  private readonly MAX_QUEUE = 5; // Lower limit for better RAM management

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Preloading Whisper model...');
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny.en',
        { quantized: true } // Use quantized model for lower RAM usage
      );
      this.logger.log('✅ Model ready');
    } catch (err) {
      this.logger.error(`Init failed: ${err.message}`);
      throw err;
    }
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    // Simple queue check
    if (this.queue >= this.MAX_QUEUE) {
      throw new BadRequestException('Server busy, retry later');
    }

    this.queue++;
    try {
      // Direct conversion without intermediate steps
      const wav = new WaveFile(audioBuffer);
      wav.toBitDepth('32f');
      wav.toSampleRate(16000);

      let samples = wav.getSamples();
      
      // Stereo to mono if needed
      if (Array.isArray(samples)) {
        samples = samples[0]; // Just take left channel (simpler than mixing)
      }

      const result = await this.transcriber(samples, {
        chunk_length_s: 30, // Process in chunks to reduce RAM
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