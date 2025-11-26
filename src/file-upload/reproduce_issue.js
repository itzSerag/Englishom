
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const os = require('os');

ffmpeg.setFfmpegPath(ffmpegPath);

async function concatenateAudioBuffers(buffers) {
    if (buffers.length === 1) return buffers[0];
    
    const tmpDir = os.tmpdir();
    const listFilePath = path.join(tmpDir, `concat_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
    const partFiles = [];
    
    try {
        // Write each buffer to a temp file
        let idx = 0;
        for (const buf of buffers) {
            const partPath = path.join(tmpDir, `part_${Date.now()}_${idx}.wav`);
            fs.writeFileSync(partPath, buf);
            partFiles.push(partPath);
            idx++;
        }
        
        // Create concat list file using String.raw for clarity
        // THIS IS THE SUSPECTED BUGGY LOGIC
        const listLines = [];
        for (const p of partFiles) {
            const sanitizedPath = p.replace(/\\/g, '/');
            const sanitized = sanitizedPath.replaceAll("'", String.raw`'\''`);
            listLines.push(String.raw`file '${sanitized}'`);
        }
        
        console.log('List file content:');
        console.log(listLines.join('\n'));
        
        fs.writeFileSync(listFilePath, listLines.join('\n'), 'utf-8');
        
        // Run ffmpeg concat
        const outputPath = path.join(tmpDir, `combined_${Date.now()}.wav`);
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(listFilePath)
                .inputOptions(['-f concat', '-safe 0'])
                .outputOptions(['-c:a pcm_s16le'])
                .on('error', (err) => reject(err))
                .on('end', () => resolve())
                .save(outputPath);
        });
        
        const outBuffer = fs.readFileSync(outputPath);
        return outBuffer;
    } finally {
        // Cleanup temp files
        try {
            if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath);
            for (const f of partFiles) if (fs.existsSync(f)) fs.unlinkSync(f);
        } catch (err) {
            console.warn(`Temp file cleanup failed: ${err.message}`);
        }
    }
}

async function run() {
    // Generate dummy wav buffers
    // We can't easily generate valid WAV buffers in pure JS without a library, 
    // so we will rely on existing files or just try to concatenate existing ones if we can find them.
    // Or we can use ffmpeg to generate them.
    
    const file1 = 'test1.wav';
    const file2 = 'test2.wav';
    
    if (!fs.existsSync(file1) || !fs.existsSync(file2)) {
        console.error('Please generate test1.wav and test2.wav first.');
        process.exit(1);
    }

    const buf1 = fs.readFileSync(file1);
    const buf2 = fs.readFileSync(file2);
    
    console.log(`Buffer 1 size: ${buf1.length}`);
    console.log(`Buffer 2 size: ${buf2.length}`);

    try {
        const combined = await concatenateAudioBuffers([buf1, buf2]);
        console.log(`Combined buffer size: ${combined.length}`);
        fs.writeFileSync('combined_output.wav', combined);
        console.log('Saved combined_output.wav');
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
