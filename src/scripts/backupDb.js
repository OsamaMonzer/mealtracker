const fs = require('fs');
const path = require('path');

async function backup() {
  const dbPath = path.resolve(process.cwd(), 'meals.db');
  if (!fs.existsSync(dbPath)) {
    console.error('No meals.db found in project root');
    process.exit(1);
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups');
  await fs.promises.mkdir(backupDir, { recursive: true });
  const dest = path.join(backupDir, `meals-${ts}.db`);
  await fs.promises.copyFile(dbPath, dest);
  console.log('Backup created at', dest);
}

backup().catch(err => { console.error(err); process.exit(1); });
