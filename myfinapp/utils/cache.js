// utils/cache.js
// Two-tier persistent cache: Google Cloud Storage when configured + accessible,
// local file system as a fallback (default `<repo>/.data/cache`, override with LOCAL_CACHE_DIR).
const fs = require('fs/promises');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

// === Local file cache ===
const LOCAL_CACHE_DIR = process.env.LOCAL_CACHE_DIR
  || path.join(__dirname, '..', '.data', 'cache');
let localDirReady = false;

async function ensureLocalDir() {
  if (localDirReady) return;
  await fs.mkdir(LOCAL_CACHE_DIR, { recursive: true });
  localDirReady = true;
}

function localPath(file) {
  return path.join(LOCAL_CACHE_DIR, file);
}

async function readLocalTimestamped(file, maxAge) {
  try {
    await ensureLocalDir();
    const raw = await fs.readFile(localPath(`${file}.json`), 'utf8');
    const cache = JSON.parse(raw);
    if (cache && typeof cache.timestamp === 'number' && Date.now() - cache.timestamp < maxAge) {
      console.log(`[DEBUG] Local cache hit for ${file}`);
      return cache.data;
    }
    console.log(`[DEBUG] Local cache expired for ${file}`);
    return null;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[WARN] Local cache read failed for ${file}: ${err.message}`);
    }
    return null;
  }
}

async function writeLocalTimestamped(file, data) {
  try {
    await ensureLocalDir();
    const cache = { data, timestamp: Date.now() };
    await fs.writeFile(localPath(`${file}.json`), JSON.stringify(cache));
    console.log(`[DEBUG] Local cache write successful for ${file}`);
  } catch (err) {
    console.error(`[ERROR] Local cache write failed for ${file}: ${err.message}`);
  }
}

async function readLocalRaw(file) {
  try {
    await ensureLocalDir();
    const raw = await fs.readFile(localPath(file), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[WARN] Local cache file load failed for ${file}: ${err.message}`);
    }
    return null;
  }
}

async function writeLocalRaw(file, data) {
  try {
    await ensureLocalDir();
    await fs.writeFile(localPath(file), JSON.stringify(data));
  } catch (err) {
    console.error(`[ERROR] Local cache file save failed for ${file}: ${err.message}`);
  }
}

// === GCS cache ===
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET;
let gcsEnabled = false;

if (bucketName) {
  console.log(`[INFO] Using Google Cloud Storage bucket: ${bucketName}`);
  gcsEnabled = true;
  (async () => {
    try {
      const [exists] = await storage.bucket(bucketName).exists();
      if (exists) {
        console.log(`[INFO] GCS bucket ${bucketName} is accessible`);
      } else {
        console.warn(`[WARN] GCS bucket ${bucketName} does not exist. Falling back to local cache at ${LOCAL_CACHE_DIR}`);
        gcsEnabled = false;
      }
    } catch (err) {
      console.warn(`[WARN] GCS bucket ${bucketName} not accessible. Falling back to local cache at ${LOCAL_CACHE_DIR}: ${err.message}`);
      gcsEnabled = false;
    }
  })();
} else {
  console.log(`[INFO] GCS_BUCKET not set. Using local file cache at ${LOCAL_CACHE_DIR}`);
}

function disableGcsIfBucketLevel(err) {
  if (err.code === 403 || (err.code === 404 && err.message && err.message.includes('bucket'))) {
    console.warn('[WARN] Disabling GCS caching due to bucket access issue; subsequent calls use local cache');
    gcsEnabled = false;
  }
}

async function readGcsTimestamped(file, maxAge) {
  try {
    const [data] = await storage.bucket(bucketName).file(`${file}.json`).download();
    const cache = JSON.parse(data.toString());
    if (Date.now() - cache.timestamp < maxAge) {
      console.log(`[DEBUG] GCS cache hit for ${file}`);
      return cache.data;
    }
    return null;
  } catch (err) {
    if (err.code !== 404) {
      console.error(`[ERROR] GCS read failed for ${file}: ${err.message} (code=${err.code})`);
      disableGcsIfBucketLevel(err);
    }
    return null;
  }
}

async function writeGcsTimestamped(file, data) {
  try {
    await storage.bucket(bucketName).file(`${file}.json`).save(
      JSON.stringify({ data, timestamp: Date.now() })
    );
    console.log(`[DEBUG] GCS cache write successful for ${file}`);
    return true;
  } catch (err) {
    console.error(`[ERROR] GCS write failed for ${file}: ${err.message}`);
    disableGcsIfBucketLevel(err);
    return false;
  }
}

async function readGcsRaw(file) {
  try {
    const [data] = await storage.bucket(bucketName).file(file).download();
    return JSON.parse(data.toString());
  } catch (err) {
    if (err.code !== 404) {
      console.error(`[ERROR] GCS file load failed for ${file}: ${err.message}`);
      disableGcsIfBucketLevel(err);
    }
    return null;
  }
}

async function writeGcsRaw(file, data) {
  try {
    await storage.bucket(bucketName).file(file).save(JSON.stringify(data));
    return true;
  } catch (err) {
    console.error(`[ERROR] GCS file save failed for ${file}: ${err.message}`);
    disableGcsIfBucketLevel(err);
    return false;
  }
}

// === Public API ===
async function readCache(file, maxAge) {
  if (gcsEnabled) {
    const fromGcs = await readGcsTimestamped(file, maxAge);
    if (fromGcs !== null) return fromGcs;
    if (gcsEnabled) return null;
  }
  return readLocalTimestamped(file, maxAge);
}

async function writeCache(file, data) {
  if (gcsEnabled) {
    const ok = await writeGcsTimestamped(file, data);
    if (ok) return;
  }
  await writeLocalTimestamped(file, data);
}

async function loadCacheFile(file) {
  if (gcsEnabled) {
    const fromGcs = await readGcsRaw(file);
    if (fromGcs !== null) return fromGcs;
    if (gcsEnabled) return {};
  }
  const local = await readLocalRaw(file);
  return local !== null ? local : {};
}

async function saveCacheFile(file, data) {
  if (gcsEnabled) {
    const ok = await writeGcsRaw(file, data);
    if (ok) return;
  }
  await writeLocalRaw(file, data);
}

module.exports = { readCache, writeCache, loadCacheFile, saveCacheFile };
