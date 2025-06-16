import express, { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import axios from 'axios';

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

async function getServiceAttachmentUri(projectId: string, region: string, serviceAttachmentName: string): Promise<string> {
  return `projects/${projectId}/regions/${region}/serviceAttachments/${serviceAttachmentName}`;
}

router.post('/deploy/producer', async (req: Request, res: Response): Promise<void> => {
  const vars = req.body;
  console.log('Received deployment request with variables:', vars);

  // Optional: validate that required vars exist
  const requiredVars = [
    "project_id",
    "region",
    "zone",
    "vpc_name",
    "subnet_name",
    "instance_name",
    "port"
  ];
  for (const v of requiredVars) {
    if (!vars[v]) {
      console.error(`Missing required variable: ${v}`);
      res.status(400).json({ error: `Missing required variable: ${v}` });
      return;
    }
  }

  // Set default values
  const defaultVars = {
    instance_group_name: "producer-group",
    backend_service_name: "producer-backend",
    health_check_name: "tcp-hc",
    forwarding_rule_name: "producer-forwarding-rule",
    service_attachment_name: "producer-attachment"
  };

  // Merge default values with provided variables
  const mergedVars = { ...defaultVars, ...vars };

  try {
    console.log('Generating Terraform variables file...');
    generateTerraformVars(mergedVars, 'producer');
    console.log('Running Terraform...');
    const output = await runTerraform('producer');
    console.log('Terraform execution completed');

    // Get the service attachment URI
    const serviceAttachmentUri = await getServiceAttachmentUri(
      mergedVars.project_id,
      mergedVars.region,
      mergedVars.service_attachment_name
    );

    // Call the consumer route with default values
    try {
      const consumerResponse = await axios.post('http://localhost:3000/consumer/deploy/consumer', {
        service_attachment_uri: serviceAttachmentUri,
        project_id: "test-project-2-462619",
        region: "us-central1",
        vpc_name: "consumer-vpc",
        subnet_name: "consumer-subnet",
        psc_endpoint_name: "psc-endpoint"
      });

      res.status(200).json({ 
        message: 'Producer and Consumer setup successful', 
        producer_output: output,
        consumer_output: consumerResponse.data,
        service_attachment_uri: serviceAttachmentUri
      });
    } catch (consumerError) {
      console.error('Consumer setup failed:', consumerError);
      res.status(200).json({ 
        message: 'Producer setup successful but Consumer setup failed', 
        producer_output: output,
        service_attachment_uri: serviceAttachmentUri,
        consumer_error: consumerError instanceof Error ? consumerError.message : 'Unknown error occurred'
      });
    }
  } catch (error) {
    console.error('Terraform error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    });
  }
});

export default router;
