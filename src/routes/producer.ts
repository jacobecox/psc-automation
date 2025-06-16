import express, { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router: Router = express.Router();
router.use(express.json());

function generateTerraformVars(vars: Record<string, any>, folder = 'producer'): void {
  const dir = path.join(__dirname, '../../terraform', folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tfvarsPath = path.join(dir, 'terraform.tfvars.json');
  fs.writeFileSync(tfvarsPath, JSON.stringify(vars, null, 2), 'utf8');
  console.log(`terraform.tfvars.json written to ${tfvarsPath}`);
}

function runTerraform(folder = 'producer'): Promise<string> {
  const dir = path.join(__dirname, '../../terraform', folder);
  return new Promise((resolve, reject) => {
    exec('terraform init && terraform apply -auto-approve', { cwd: dir }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

router.post('/deploy/producer', async (req: Request, res: Response): Promise<void> => {
  const vars = req.body;

  // Optional: validate that required vars exist
  const requiredVars = [
    "region",
    "zone",
    "vpc_name",
    "subnet_name",
    "instance_name",
    "instance_group_name",
    "backend_service_name",
    "health_check_name",
    "forwarding_rule_name",
    "service_attachment_name"
  ];
  for (const v of requiredVars) {
    if (!vars[v]) {
      res.status(400).json({ error: `Missing required variable: ${v}` });
      return;
    }
  }

  try {
    generateTerraformVars(vars, 'producer');
    const output = await runTerraform('producer');
    res.status(200).json({ message: 'Terraform apply successful', output });
  } catch (error) {
    console.error('Terraform error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error occurred' });
  }
});

export default router;
