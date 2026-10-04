import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { paths, ensureDirs } from './paths.js';
import { router as memoriesRouter } from './routes/memories.js';
import { router as reflectRouter } from './routes/reflect.js';
import { warmUp } from './ai/embeddings.js';
import { llmStatus } from './ai/llm.js';
import { referencedFiles } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', 'client', 'dist');

ensureDirs();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// Uploaded photos. Long cache, filenames are content-unique.
app.use(
  '/uploads',
  express.static(paths.uploads, {
    maxAge: '365d',
    immutable: true,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  })
);

app.use('/api', memoriesRouter);
app.use('/api', reflectRouter);

// Built SPA
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '7d', index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) =>
    res
      .status(503)
      .send('<h1>Remember</h1><p>The client is not built yet. Run <code>npm run build</code>, or use <code>npm run dev</code> for the Vite dev server.</p>')
  );
}

app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (err.message?.includes('Only image') ? 400 : 500);
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: err.message || 'Something went wrong.' });
});

/**
 * Capture uploads files as they are picked, before the memory is saved. If
 * somebody backs out halfway, those files are on disk with nothing pointing at
 * them. Sweep anything unreferenced and older than a day, the age check means
 * an in-progress capture is never touched.
 */
async function sweepOrphanUploads() {
  try {
    const referenced = referencedFiles();
    const names = await fs.promises.readdir(paths.uploads);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let removed = 0;
    let bytes = 0;
    for (const name of names) {
      if (referenced.has(name)) continue;
      const file = path.join(paths.uploads, name);
      const stat = await fs.promises.stat(file).catch(() => null);
      if (!stat?.isFile() || stat.mtimeMs > cutoff) continue;
      bytes += stat.size;
      await fs.promises.unlink(file).catch(() => {});
      removed += 1;
    }
    if (removed) {
      console.log(`[disk] swept ${removed} abandoned upload(s), ${Math.round(bytes / 1024 / 1024)}MB`);
    }
  } catch (err) {
    console.warn('[disk] orphan sweep skipped:', err.message);
  }
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  const llm = llmStatus();
  console.log(`\n  Remember, reconnect with who you are.`);
  console.log(`  http://localhost:${port}`);
  console.log(`  data: ${paths.data}`);
  console.log(
    `  llm:  ${llm.configured ? `${llm.model} @ ${llm.endpoint}${llm.local ? ' (local)' : ''}` : 'not configured (composer only)'}\n`
  );
  warmUp();
  sweepOrphanUploads();
});
