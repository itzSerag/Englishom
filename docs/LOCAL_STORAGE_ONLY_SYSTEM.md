# Local File Storage System Documentation

## 🚀 Overview

The Local File Storage System stores all files locally on your server, providing a simple and cost-effective alternative to cloud storage. This system maintains **100% API compatibility** with your existing frontend while storing files directly on the server's file system.

## 🎯 Key Features

- **Local Storage Only**: All files stored on server disk
- **Zero Frontend Changes**: Same API endpoints and response formats
- **URL Security**: Encoded paths prevent directory traversal attacks
- **Static File Serving**: Built-in file server with proper MIME types
- **Cost Effective**: No cloud storage fees
- **Simple Deployment**: No external dependencies

## 📁 File Structure

```
./uploads/
├── json/                    # Course content JSON files
│   └── Levels/
│       └── BEGINNER/1/LISTEN.json
│       └── INTERMEDIATE/2/READ.json
├── Images/                  # Uploaded images
│   └── BEGINNER/1/LISTEN/image.jpg
├── Audio/                   # Uploaded audio files
│   └── BEGINNER/1/LISTEN/audio.mp3
└── UserAudios/             # User recordings
    └── {userId}/BEGINNER/1/today_audio.mp3
```

## 🔧 Configuration

### **Environment Variables**

```env
# Local Storage Configuration
LOCAL_STORAGE_PATH=./uploads                    # Where files are stored
LOCAL_STORAGE_URL=http://localhost:3000/uploads # Base URL for file access
```

### **Directory Creation**

The system automatically creates necessary directories on startup:

- `./uploads/Images/`
- `./uploads/Audio/`
- `./uploads/UserAudios/`
- `./uploads/json/`

## 🌐 URL Structure

### **File URLs**

```
http://localhost:3000/uploads/Images%2FBEGINNER%2F1%2FLISTEN%2Fimage.jpg
http://localhost:3000/uploads/Audio%2FBEGINNER%2F1%2FLISTEN%2Faudio.mp3
http://localhost:3000/uploads/UserAudios%2F{userId}%2FBEGINNER%2F1%2Ftoday_audio.mp3
```

### **URL Security Features**

- **Path Encoding**: All file paths are URL-encoded for security
- **No Directory Traversal**: Prevents `../` attacks through path sanitization
- **Structured Paths**: Maintains consistent directory organization
- **Access Control**: Served through NestJS with built-in security

## 🚀 API Endpoints (Unchanged)

All existing endpoints work exactly the same:

### **File Upload**

```http
POST /files/single-file
Content-Type: multipart/form-data

# Response
{
  "url": "http://localhost:3000/uploads/Images%2FBEGINNER%2F1%2FLISTEN%2Fimage.jpg"
}
```

### **Get Course Content**

```http
GET /files?level_name=BEGINNER&day=1&lesson_name=LISTEN

# Response
{
  "data": [...]
}
```

### **User Audio Management**

```http
POST /files/user-audio     # Upload user audio
GET /files/user-audio      # Get user audios
DELETE /files/user-audio   # Delete user audio
```

### **Static File Access**

```http
GET /uploads/{encoded-file-path}
# Automatically served with proper MIME types
```

## 🔒 Security Considerations

### **Path Security**

- Files stored outside web root
- Path sanitization prevents directory traversal
- URL encoding prevents special character exploits
- Resolved path validation ensures files stay within storage directory

### **Access Control**

- All file endpoints are public (like AWS S3 public buckets)
- Files served through NestJS application
- Can add authentication middleware if needed
- File permissions controlled by operating system

### **Example Security Implementation**

```typescript
// Current: Public access
GET /uploads/Images%2FBEGINNER%2F1%2FLISTEN%2Fimage.jpg

// Future: Can add authentication
@UseGuards(AuthGuard)
GET /uploads/Images%2FBEGINNER%2F1%2FLISTEN%2Fimage.jpg
```

## 🛠️ Technical Implementation

### **File Operations**

| Operation    | Method               | Purpose                        |
| ------------ | -------------------- | ------------------------------ |
| Upload File  | `uploadToLocal()`    | Save files to local storage    |
| Delete File  | `fs.unlink()`        | Remove files from disk         |
| List Files   | `listLocalFiles()`   | Find files by prefix           |
| Check Exists | `fs.access()`        | Verify file existence          |
| Get JSON     | `getJsonFromLocal()` | Read JSON configuration files  |
| Update JSON  | `updateJsonLocal()`  | Write JSON configuration files |

### **File Upload Process**

```
1. Client uploads file via existing API
2. FileUploadService validates file type
3. Generate secure file key/path
4. Create directory structure if needed
5. Save file to ./uploads/{key}
6. Return URL: {localStorageUrl}/{encodedKey}
```

### **JSON Data Management**

```
1. Course content stored as JSON files in ./uploads/json/
2. Same CRUD operations as before
3. Automatic directory creation
4. Error handling for missing files
```

### **Static File Serving**

```
1. StaticFilesController handles /uploads/* routes
2. Decodes URL-encoded file paths
3. Validates path security
4. Sets appropriate MIME types
5. Streams file content to client
```

## 📊 Benefits

### **Development Benefits**

- ✅ **No External Dependencies**: No cloud accounts needed
- ✅ **Fast Local Access**: No network latency
- ✅ **Easy Debugging**: Files visible on disk
- ✅ **Works Offline**: No internet required
- ✅ **Simple Backup**: Copy entire uploads folder

### **Production Benefits**

- ✅ **Cost Effective**: No storage fees
- ✅ **Simple Deployment**: Self-contained application
- ✅ **Full Control**: Complete ownership of files
- ✅ **No Vendor Lock-in**: Standard file system
- ✅ **Easy Migration**: Files easily portable

### **Performance Characteristics**

- **Local Access**: Extremely fast file serving
- **No API Limits**: No third-party rate limiting
- **Scalability**: Limited by server disk space
- **Bandwidth**: Uses server's network connection

## 🚀 Getting Started

### **Quick Setup**

1. The system is already configured with these environment variables:

   ```env
   LOCAL_STORAGE_PATH=./uploads
   LOCAL_STORAGE_URL=http://localhost:3000/uploads
   ```

2. Start your application:

   ```bash
   npm run start:dev
   ```

3. Upload files through existing API - they now save locally!

### **Verification**

- Check `./uploads/` folder for uploaded files
- URLs in API responses point to local server
- All existing frontend code works unchanged

### **File Structure Verification**

```bash
# Check if directories are created
ls -la ./uploads/
# Should see: Images/ Audio/ UserAudios/ json/

# Test file upload
curl -X POST http://localhost:3000/files/single-file \
  -F "file=@test-image.jpg" \
  -F "level_name=BEGINNER" \
  -F "day=1" \
  -F "lesson_name=TEST"

# Verify file exists
ls -la ./uploads/Images/BEGINNER/1/TEST/
```

## 🔄 Migration from AWS (If Needed)

### **From AWS S3 to Local Storage**

If you have existing AWS S3 files and want to migrate:

1. Download existing S3 files:

   ```bash
   aws s3 sync s3://your-bucket ./uploads/
   ```

2. Update file URLs in database (if stored):
   ```javascript
   // Replace AWS URLs with local URLs
   oldUrl: 'https://bucket.s3.region.amazonaws.com/path';
   newUrl: 'http://localhost:3000/uploads/path';
   ```

### **Preserving File Structure**

The local storage maintains the same file organization as AWS S3:

- Same directory hierarchy
- Same file naming conventions
- Same URL encoding patterns

## 📝 Monitoring and Logging

### **File Operations Logging**

```
[FileUploadService] File uploaded successfully to local storage: Images/BEGINNER/1/LISTEN/image.jpg
[FileUploadService] Local JSON updated successfully: Levels/BEGINNER/1/LISTEN.json
[StaticFilesController] Serving file: Images/BEGINNER/1/LISTEN/image.jpg
```

### **Error Handling**

- File not found errors return 404
- Invalid file types rejected with validation errors
- Directory creation errors logged
- Path traversal attempts blocked and logged

### **Storage Monitoring**

```bash
# Monitor disk usage
df -h

# Check uploads folder size
du -sh ./uploads/

# Monitor file access logs
tail -f logs/application.log | grep StaticFilesController
```

## 🎯 Summary

The Local File Storage System provides:

- **Drop-in Replacement**: Works exactly like AWS S3 from API perspective
- **Zero Frontend Changes**: All existing code continues to work
- **Cost Savings**: No cloud storage fees
- **Simplified Architecture**: Self-contained file storage
- **Enhanced Security**: Full control over file access
- **Better Performance**: Local file access speeds

The system is production-ready and provides a robust, secure file storage solution without external dependencies.
