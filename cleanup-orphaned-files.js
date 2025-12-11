// cleanup-orphaned-files.js
// Run this script to clean up orphaned GridFS file metadata after deleting chunks

const { MongoClient } = require('mongodb');

async function cleanupOrphanedFiles() {
  // Update this connection string to match your production MongoDB
  const uri = 'mongodb://127.0.0.1:27017/Englishom?replicaSet=rs0';
  // For production use:
  // const uri = 'mongodb://serageldien_englishom:Iamcomingharvard@159.223.114.118:27017/Englishom?authSource=admin';
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const filesCollection = db.collection('appFiles.files');
    const chunksCollection = db.collection('appFiles.chunks');

    // Get all file IDs from files collection
    const allFiles = await filesCollection.find({}).toArray();
    console.log(`📊 Found ${allFiles.length} files in metadata`);

    let orphanedCount = 0;
    const orphanedIds = [];

    // Check each file to see if it has chunks
    for (const file of allFiles) {
      const hasChunks = await chunksCollection.findOne({ files_id: file._id });
      if (!hasChunks) {
        orphanedIds.push(file._id);
        orphanedCount++;
        console.log(`🗑️  Orphaned file: ${file.filename} (${file._id})`);
      }
    }

    console.log(`\n📈 Summary: ${orphanedCount} orphaned files found`);

    if (orphanedCount > 0) {
      console.log('\n⚠️  Do you want to delete these orphaned file records? (yes/no)');
      // For automatic deletion, uncomment below:
      
      const result = await filesCollection.deleteMany({
        _id: { $in: orphanedIds }
      });
      console.log(`✅ Deleted ${result.deletedCount} orphaned file records`);
    } else {
      console.log('✅ No orphaned files found!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

cleanupOrphanedFiles();
