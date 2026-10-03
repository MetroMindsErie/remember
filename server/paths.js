import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');

export const paths = {
  data: DATA_DIR,
  db: path.join(DATA_DIR, 'remember.db'),
  uploads: path.join(DATA_DIR, 'uploads'),
  modelCache: path.join(DATA_DIR, 'model-cache'),
};

export function ensureDirs() {
  for (const dir of [paths.data, paths.uploads, paths.modelCache]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
