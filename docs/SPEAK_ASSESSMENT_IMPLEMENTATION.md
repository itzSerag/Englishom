# Speech Assessment Feature Implementation Guide

## 📋 Overview

This feature allows users to record audio speaking a reference sentence, which is then transcribed using Whisper AI and compared with the original text for accuracy scoring.

---

## 🎯 How It Works

### Flow Diagram

```
1. User selects sentence from SPEAK lesson
2. User records audio
3. Frontend sends: { level_name, day, lesson_name, sentenceIndex, audioFile }
4. Backend transcribes audio using Whisper
5. Backend compares transcript with reference sentence
6. Backend returns: { similarityPercentage, isPassed, correctSentence, userTranscript }
```

---

## 🛠️ Technologies Used

- **Speech-to-Text**: Whisper AI via `whisper-node` package
- **Text Comparison**: `string-similarity` library with fuzzy matching (80% threshold)
- **Audio Processing**: Temporary file storage and cleanup

---

## 📡 API Endpoint

### **POST** `/user-results/speak/compare-transcript`

**Content-Type**: `multipart/form-data`

**Request Body**:

```typescript
{
  level_name: "LEVEL_A1",      // enum: Level_Name
  day: 1,                      // number (1-50)
  lesson_name: "SPEAK",        // enum: LESSONS
  sentenceIndex: 0,            // number (0-based)
  audio: File                  // audio file (form-data)
}
```

**Response**:

```json
{
  "message": "Transcript comparison completed",
  "similarityPercentage": 85,
  "correctSentence": "Anas is six years old.",
  "userTranscript": "anas is six years old",
  "sentenceIndex": 0,
  "isPassed": true
}
```

---

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
npm install whisper-node string-similarity
npm install --save-dev @types/string-similarity
```

### 2. Whisper Model Setup

On first run, Whisper will automatically download the `base.en` model (~140MB).

**Available Models**:

- `tiny.en` - Fastest, least accurate (~75MB)
- `base.en` - Good balance (~140MB) ✅ **Current**
- `small.en` - More accurate (~480MB)
- `medium.en` - Very accurate (~1.5GB)
- `large` - Best accuracy (~3GB)

To change the model, edit `user-results.service.ts`:

```typescript
this.whisper = new WhisperNode({
  modelName: 'small.en', // Change here
  autoDownloadModelName: 'small.en',
  ...
});
```

### 3. Temp Directory

The system automatically creates a `temp/` folder in the project root for temporary audio files. Files are cleaned up after transcription.

---

## 📊 Scoring Algorithm

### Fuzzy Matching (80% Threshold)

```typescript
Original: "the quick brown fox"
Spoken:   "the qick brown fox"

Position 0: "the"   vs "the"   → 100% ✅
Position 1: "quick" vs "qick"  → 85% ✅ (above 80%)
Position 2: "brown" vs "brown" → 100% ✅
Position 3: "fox"   vs "fox"   → 100% ✅

Score: 4/4 = 100%
```

### Penalties

- **Extra Words**: -0.5 points per extra word
- **Missing Words**: Naturally penalized (reduces match count)

### Pass Threshold

- **70%** or higher = PASSED ✅
- Below 70% = FAILED ❌

---

## 🧪 Testing

### Using Postman/Thunder Client

1. **Set Request Type**: POST
2. **URL**: `http://localhost:3000/user-results/speak/compare-transcript`
3. **Body Type**: form-data
4. **Fields**:
   - `level_name`: LEVEL_A1
   - `day`: 1
   - `lesson_name`: SPEAK
   - `sentenceIndex`: 0
   - `audio`: [Upload audio file]

### Using cURL

```bash
curl -X POST http://localhost:3000/user-results/speak/compare-transcript \
  -F "level_name=LEVEL_A1" \
  -F "day=1" \
  -F "lesson_name=SPEAK" \
  -F "sentenceIndex=0" \
  -F "audio=@/path/to/audio.wav"
```

---

## 🎤 Frontend Implementation Guide

### HTML5 Audio Recording

```javascript
// 1. Request microphone access
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// 2. Create MediaRecorder
const mediaRecorder = new MediaRecorder(stream);
const audioChunks = [];

mediaRecorder.ondataavailable = (event) => {
  audioChunks.push(event.data);
};

// 3. Start recording
mediaRecorder.start();

// 4. Stop recording
mediaRecorder.stop();

mediaRecorder.onstop = async () => {
  const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });

  // 5. Send to backend
  const formData = new FormData();
  formData.append('level_name', 'LEVEL_A1');
  formData.append('day', '1');
  formData.append('lesson_name', 'SPEAK');
  formData.append('sentenceIndex', '0');
  formData.append('audio', audioBlob, 'recording.wav');

  const response = await fetch('/user-results/speak/compare-transcript', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  console.log(result);
};
```

---

## 📁 File Structure

```
src/file-upload/
├── controllers/
│   └── user-results.controller.ts    // API endpoint
├── services/
│   └── user-results.service.ts       // Transcription & comparison logic
├── dto/
│   └── read-compare-transcripts.dto.ts  // Request validation
└── file-upload.service.ts            // S3 operations (if needed)
```

---

## 🚀 Performance Considerations

### Transcription Speed

- **tiny.en**: ~2-3 seconds
- **base.en**: ~3-5 seconds ✅ **Current**
- **small.en**: ~5-8 seconds
- **medium.en**: ~10-15 seconds

### Optimization Tips

1. Use smallest acceptable model for your accuracy needs
2. Consider using a queue system (Bull/BullMQ) for high traffic
3. Cache common sentences if possible
4. Limit audio file size (recommend max 10MB)

---

## 🐛 Troubleshooting

### Error: "Whisper model not found"

**Solution**: Let it download on first run, or manually download from Hugging Face

### Error: "Failed to transcribe audio"

**Causes**:

- Audio file format not supported (use WAV, MP3, M4A)
- Audio file corrupted
- Insufficient system resources

**Solution**: Check audio format and try a smaller model

### Error: "No user transcript provided"

**Cause**: Audio is silent or too quiet
**Solution**: Check microphone input levels

---

## 📈 Future Enhancements

1. **Pronunciation Scoring**: Add phonetic analysis
2. **Fluency Detection**: Analyze speech pace and pauses
3. **Accent Support**: Train on multiple English accents
4. **Real-time Feedback**: Stream audio for live transcription
5. **Progress Tracking**: Store user attempts in database
6. **Retry Mechanism**: Allow multiple attempts per sentence

---

## 📞 Support

For issues or questions, contact the development team or check the main README.md

---

**Last Updated**: October 15, 2025
**Version**: 1.0.0
