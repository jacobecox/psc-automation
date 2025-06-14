import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

export function runTerraform(folder: string): Promise<string> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dir = path.join(__dirname, `../terraform/${folder}`);
  return new Promise((resolve, reject) => {
    exec('terraform init && terraform apply -auto-approve', { cwd: dir }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve(stdout);
    });
  });
} 