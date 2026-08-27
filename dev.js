import { spawn } from 'child_process';

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

console.log('🚀 [Dev Server] Starting Backend (server/index.js) and Frontend (vite)...');

const server = spawn(npmCmd, ['run', 'dev:server'], { stdio: 'inherit', shell: true });
const client = spawn(npxCmd, ['vite'], { stdio: 'inherit', shell: true });

const cleanup = () => {
  console.log('\n🛑 Stopping dev servers...');
  server.kill();
  client.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
