# Transformers AI Service Guide

## Overview

This project uses **@xenova/transformers** for audio transcription instead of paid OpenAI APIs. The library runs machine learning models directly in your Node.js environment, making it completely free and offline-capable.

## Features

- ✅ **Free Audio Transcription** - No API costs
- ✅ **Multiple Whisper Models** - Choose speed vs accuracy
- ✅ **Offline Capable** - Models cached locally after first download
- ✅ **Multilingual Support** - English-only or multilingual models
- ✅ **Concurrency Control** - Built-in request limiting

## Architecture

### Files Structure

```
src/
├── common/
│   ├── common.module.ts                          # Exports TransformersAIService globally
│   └── services/
│       ├── transformers-ai.service.ts             # Core AI service (audio transcription)
│       └── transformers-ai.controller.ts          # Stats endpoint (optional)
└── file-upload/
    └── services/
        └── user-results.service.ts                # Uses TransformersAIService for speech assessment
```

### How It Works

1. **Global Service**: `TransformersAIService` is registered in `CommonModule` as a global provider
2. **Lazy Initialization**: Whisper model loads on first transcription request (~39MB download)
3. **Model Caching**: Models are cached in `.cache/transformers/` folder
4. **Shared Usage**: Any service can inject `TransformersAIService` to use transcription

## Usage

### Basic Transcription

```typescript
import { Injectable } from '@nestjs/common';
import { TransformersAIService } from '../common/services/transformers-ai.service';

@Injectable()
export class YourService {
  constructor(private readonly aiService: TransformersAIService) {}

  async transcribe(audioBuffer: Buffer) {
    const text = await this.aiService.transcribeAudio(audioBuffer, {
      language: 'en',
      task: 'transcribe',
      model: 'Xenova/whisper-tiny.en', // Optional: defaults to tiny.en
    });

    return text;
  }
}
```

### Available Models

| Model                     | Size   | Accuracy | Speed      | Use Case                          |
| ------------------------- | ------ | -------- | ---------- | --------------------------------- |
| `Xenova/whisper-tiny.en`  | ~39MB  | Basic    | Fastest ⚡ | **Default** - Quick transcription |
| `Xenova/whisper-base.en`  | ~74MB  | Good     | Fast       | Better accuracy                   |
| `Xenova/whisper-small.en` | ~244MB | High     | Medium     | High quality needed               |
| `Xenova/whisper-tiny`     | ~39MB  | Basic    | Fast       | Multilingual support              |
| `Xenova/whisper-base`     | ~74MB  | Good     | Medium     | Multilingual + better accuracy    |

### Example: Change Model

To use a more accurate model, modify the options:

```typescript
const text = await this.aiService.transcribeAudio(audioBuffer, {
  language: 'en',
  task: 'transcribe',
  model: 'Xenova/whisper-base.en', // Better accuracy but slower
});
```

### Translation Task

You can also translate audio to English:

```typescript
const englishText = await this.aiService.transcribeAudio(audioBuffer, {
  language: 'ar', // Arabic audio
  task: 'translate', // Translate to English
  model: 'Xenova/whisper-base', // Must use multilingual model
});
```

## Current Implementation

### Speech Assessment (user-results.service.ts)

The `UserResultsService` uses `TransformersAIService` to:

1. Transcribe student's spoken audio
2. Compare with expected sentence
3. Calculate similarity score
4. Determine if student passed (70% threshold)

```typescript
// src/file-upload/services/user-results.service.ts
private async transcribeAudio(audioFile: Express.Multer.File): Promise<string> {
  this.validateAudioFileSize(audioFile);

  const text = await this.aiService.transcribeAudio(audioFile.buffer, {
    language: 'en',
    task: 'transcribe',
    model: 'Xenova/whisper-tiny.en',
  });

  return text;
}
```

## API Endpoints

### Check Service Stats

```bash
GET /ai/stats
```

Returns:

```json
{
  "isInitialized": true,
  "inFlightRequests": 2,
  "maxConcurrency": 15
}
```

## Configuration

### Adjust Concurrency Limit

In `transformers-ai.service.ts`:

```typescript
private readonly MAX_CONCURRENCY = 15; // Adjust based on server capacity
```

### Change Default Model

Modify the default in `transcribeAudio()` method:

```typescript
const model = options?.model || 'Xenova/whisper-base.en'; // Changed from tiny to base
```

## Performance Tips

1. **Use Tiny Model for Development** - Fastest downloads and response times
2. **Use Base Model for Production** - Better accuracy, reasonable speed
3. **Multilingual Only When Needed** - English-only models are faster
4. **Monitor Concurrency** - Adjust `MAX_CONCURRENCY` based on load
5. **Cache Warming** - Models download on first use (~30-60 seconds)

## Troubleshooting

### "Expected Float32Array but got Buffer" Error

**Fixed!** The service now properly converts Buffer to the correct audio format using `read_audio`:

```typescript
// The service automatically handles:
// 1. Buffer → Uint8Array conversion
// 2. Audio decoding (MP3, WAV, etc.)
// 3. Resampling to 16kHz (required by Whisper)
const audioData = await read_audio(uint8Array, 16000);
```

### Model Download Fails

If model download is interrupted, delete the cache and retry:

```bash
Remove-Item -Recurse -Force .cache/transformers/
```

### Out of Memory

If you get memory errors:

1. Reduce `MAX_CONCURRENCY` to 5-10
2. Use smaller model (tiny instead of base)
3. Increase Node.js memory: `node --max-old-space-size=4096`

### Slow First Request

- **Expected**: First request downloads model (~39-244MB)
- **Solution**: Pre-warm by calling transcription during app startup
- **Subsequent requests**: Fast (model cached in memory)

## Comparison: OpenAI Whisper vs @xenova/transformers

| Feature      | OpenAI Whisper API  | @xenova/transformers      |
| ------------ | ------------------- | ------------------------- |
| **Cost**     | $0.006/minute       | **Free** ✅               |
| **Speed**    | Very fast (cloud)   | Fast (local)              |
| **Accuracy** | Highest             | Very Good                 |
| **Privacy**  | Data sent to OpenAI | **Local only** ✅         |
| **Setup**    | API key required    | No API key needed ✅      |
| **Internet** | Required            | Optional (after cache) ✅ |

## Advanced: Future Extensions

If you need more AI features later, you can extend `TransformersAIService`:

- **Text Generation**: GPT-2, DistilGPT2
- **Sentiment Analysis**: DistilBERT
- **Translation**: T5, OPUS-MT
- **Question Answering**: DistilBERT-squad
- **Text Embeddings**: all-MiniLM-L6-v2

Example additions available in the service comments.

## Dependencies

```json
{
  "@xenova/transformers": "^2.17.2"
}
```

No additional dependencies needed! 🎉

## Support

For issues with:

- **@xenova/transformers**: https://github.com/xenova/transformers.js
- **Model availability**: https://huggingface.co/Xenova

## License

This implementation uses:

- `@xenova/transformers` (Apache 2.0)
- OpenAI Whisper models (MIT)
