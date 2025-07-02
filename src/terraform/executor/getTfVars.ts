import fs from 'fs';
import path from 'path';

export function writeTfVarsFile(terraformDir: string, tfVars: Record<string, any>): void {
  const tfvarsPath = path.join(terraformDir, 'terraform.tfvars.json');
  fs.writeFileSync(tfvarsPath, JSON.stringify(tfVars, null, 2));
  console.log(`Generated terraform.tfvars.json: ${JSON.stringify(tfVars, null, 2)}`);
} 