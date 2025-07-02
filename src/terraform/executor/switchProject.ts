import { execSync } from 'child_process';

export function switchGCloudProject(projectId: string): void {
  console.log(`Switching gcloud project to: ${projectId}`);
  execSync(`gcloud config set project ${projectId}`, { stdio: 'inherit' });
  console.log(`✅ gcloud project switched to: ${projectId}`);
} 