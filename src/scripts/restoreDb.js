const fs = require('fs');
const path = require('path');

async function restore(src) {
  const srcPath = path.resolve(process.cwd(), src || 'backups');
  if (!fs.existsSync(srcPath)) {
    console.error('Backup source not found:', srcPath);
    process.exit(1);
  }
  // if directory provided, pick the latest file
  let fileStat = await fs.promises.stat(srcPath);
  let srcFile = srcPath;
  if (fileStat.isDirectory()) {
    const files = (await fs.promises.readdir(srcPath)).filter(f => f.endsWith('.db')).sort();
    if (files.length === 0) { console.error('No .db files in', srcPath); process.exit(1); }
    srcFile = path.join(srcPath, files[files.length - 1]);
  }
  const dbPath = path.resolve(process.cwd(), 'meals.db');
  // backup current DB
  if (fs.existsSync(dbPath)) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.promises.copyFile(dbPath, path.join(path.dirname(dbPath), `meals-before-restore-${ts}.db`));
  }
  await fs.promises.copyFile(srcFile, dbPath);
  console.log('Restored', srcFile, 'to', dbPath);
}

const arg = process.argv[2];
restore(arg).catch(err => { console.error(err); process.exit(1); });
