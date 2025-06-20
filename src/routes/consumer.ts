import express, { Request, Response, Router } from 'express';
import { runTerraform, getTerraformOutput, TerraformVariables } from '../utils/terraformExecutor.js';

const router: Router = express.Router();
router.use(express.json());

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
  const mergedVars: TerraformVariables = { ...defaultVars, ...vars };

  try {
    console.log('Running Terraform for consumer...');
    const output = await runTerraform('consumer', mergedVars);
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

// Add status endpoint for consistency
router.get('/status/consumer', async (req: Request, res: Response): Promise<void> => {
  try {
    const { project_id } = req.query;

    if (!project_id || typeof project_id !== 'string') {
      res.status(400).json({ 
        error: 'Invalid project_id query parameter. Must be a non-empty string.',
        details: 'Please provide a valid GCP project ID'
      });
      return;
    }

    try {
      const outputs = await getTerraformOutput('consumer');
      
      res.status(200).json({
        message: 'Consumer infrastructure status retrieved successfully',
        project_id: project_id,
        terraform_output: outputs
      });

    } catch (terraformError) {
      console.error('Failed to get Terraform outputs:', terraformError);
      res.status(404).json({ 
        error: 'Consumer infrastructure not found or not deployed',
        project_id: project_id,
        details: terraformError instanceof Error ? terraformError.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('Error in consumer status route:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    });
  }
});

export default router;
