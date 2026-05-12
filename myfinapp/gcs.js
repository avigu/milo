const { Storage } = require('@google-cloud/storage');
const path = require('path');

const BUCKET_NAME = process.env.GCS_BUCKET;
if (!BUCKET_NAME) {
  throw new Error('GCS_BUCKET environment variable is not set');
}

const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

async function gcsExists(filename) {
  const file = bucket.file(filename);
  const [exists] = await file.exists();
  return exists;
}

async function gcsRead(filename) {
  const file = bucket.file(filename);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [contents] = await file.download();
  return contents.toString('utf8');
}

async function gcsWrite(filename, data) {
  const file = bucket.file(filename);
  await file.save(data, { contentType: 'application/json' });
}

module.exports = {
  gcsExists,
  gcsRead,
  gcsWrite,
}; 