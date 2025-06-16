import express, { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router: Router = express.Router();
router.use(express.json());

function generateTerraformVars(vars: Record<string, any>, folder = 'consumer'): void {
  const dir = path.join(__dirname, '../../terraform', folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tfvarsPath = path.join(dir, 'terraform.tfvars.json');
  fs.writeFileSync(tfvarsPath, JSON.stringify(vars, null, 2), 'utf8');
  console.log(`terraform.tfvars.json written to ${tfvarsPath}`);
}

function runTerraform(folder = 'consumer'): Promise<string> {
  const dir = path.join(__dirname, '../../terraform', folder);
  return new Promise((resolve, reject) => {
    console.log('Starting Terraform execution in directory:', dir);
    const process = exec('terraform init && terraform apply -auto-approve', { cwd: dir }, (err, stdout, stderr) => {
      if (err) {
        console.error('Terraform execution error:', err);
        console.error('Terraform stderr:', stderr);
        return reject(new Error(stderr || err.message));
      }
      console.log('Terraform execution completed successfully');
      resolve(stdout);
    });

    // Add timeout handling
    const timeout = setTimeout(() => {
      process.kill();
      reject(new Error('Terraform execution timed out after 15 minutes'));
    }, 15 * 60 * 1000); // 15 minutes timeout

    process.on('exit', () => {
      clearTimeout(timeout);
    });
  });
}

router.post('/deploy/consumer', async (req: Request, res: Response): Promise<void> => {
  const vars = req.body;
  console.log('Received deployment request with variables:', vars);

  // Only require service_attachment_uri
  if (!vars.service_attachment_uri) {
    console.error('Missing required variable: service_attachment_uri');
    res.status(400).json({ error: 'Missing required variable: service_attachment_uri' });
    return;
  }

  // Set default values
  const defaultVars = {
    project_id: "test-project-2-462619",
    region: "us-central1",
    vpc_name: "consumer-vpc",
    subnet_name: "consumer-subnet",
    psc_endpoint_name: "psc-endpoint",
    reserved_ip_name: "psc-reserved-ip"
  };

  // Merge default values with provided variables
  const mergedVars = { ...defaultVars, ...vars };

  try {
    console.log('Generating Terraform variables file...');
    generateTerraformVars(mergedVars, 'consumer');
    console.log('Running Terraform...');
    const output = await runTerraform('consumer');
    console.log('Terraform execution completed');
    res.status(200).json({ message: 'Terraform apply successful', output });
  } catch (error) {
    console.error('Terraform error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    });
  }
});

export default router;
