import express, { Request, Response, Router } from 'express';
import { runTerraform, getTerraformOutput, TerraformVariables } from '../utils/terraformExecutor.js';

const router: Router = express.Router();
router.use(express.json());

interface ProducerManagedRequest {
  project_id?: string;
  region?: string;
}

interface ProducerManagedResponse {
  message: string;
  project_id: string;
  region: string;
  vpc_name: string;
  subnet_name: string;
  psc_ip_range: string;
  psc_ip_range_name: string;
  vpc_self_link: string;
  subnet_self_link: string;
  terraform_output?: any;
  error?: string;
}

router.post('/deploy/managed', async (req: Request, res: Response): Promise<void> => {
  try {
    const { project_id = "test-project-2-462619", region = "us-central1" } = req.body as ProducerManagedRequest;

    // Validate the project ID
    if (!project_id || typeof project_id !== 'string') {
      res.status(400).json({ 
        error: 'Invalid project_id. Must be a non-empty string.',
        details: 'Please provide a valid GCP project ID'
      });
      return;
    }

    // Validate the region
    if (region && typeof region !== 'string') {
      res.status(400).json({ 
        error: 'Invalid region. Must be a string.',
        details: 'Please provide a valid GCP region'
      });
      return;
    }

    console.log(`Starting managed producer deployment for project: ${project_id} in region: ${region}`);

    // Prepare Terraform variables
    const terraformVariables: TerraformVariables = {
      project_id: project_id,
      region: region
    };

    try {
      // Run Terraform to create the infrastructure
      console.log('Running Terraform for managed producer...');
      const terraformResult = await runTerraform('producer-managed', terraformVariables);
      console.log('Terraform execution completed successfully');

      // Get Terraform outputs
      console.log('Retrieving Terraform outputs...');
      const outputs = await getTerraformOutput('producer-managed');
      console.log('Terraform outputs retrieved:', outputs);

      // Prepare response
      const response: ProducerManagedResponse = {
        message: 'Managed Producer infrastructure deployed successfully',
        project_id: project_id,
        region: region,
        vpc_name: outputs.vpc_name.value as string,
        subnet_name: outputs.subnet_name.value as string,
        psc_ip_range: outputs.psc_ip_range.value as string,
        psc_ip_range_name: outputs.psc_ip_range_name.value as string,
        vpc_self_link: outputs.vpc_self_link.value as string,
        subnet_self_link: outputs.subnet_self_link.value as string,
        terraform_output: outputs
      };

      res.status(200).json(response);

    } catch (terraformError) {
      console.error('Terraform execution failed:', terraformError);
      
      const errorResponse: ProducerManagedResponse = {
        message: 'Managed Producer deployment failed',
        project_id: project_id,
        region: region,
        vpc_name: '',
        subnet_name: '',
        psc_ip_range: '',
        psc_ip_range_name: '',
        vpc_self_link: '',
        subnet_self_link: '',
        error: terraformError instanceof Error ? terraformError.message : 'Unknown Terraform error occurred'
      };

      res.status(500).json(errorResponse);
    }

  } catch (error) {
    console.error('Error in managed producer route:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    });
  }
});

// Add a route to get the current state of the managed producer
router.get('/status/managed', async (req: Request, res: Response): Promise<void> => {
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
      const outputs = await getTerraformOutput('producer-managed');
      
      const response: ProducerManagedResponse = {
        message: 'Managed Producer infrastructure status retrieved successfully',
        project_id: project_id,
        region: outputs.region?.value as string || 'us-central1',
        vpc_name: outputs.vpc_name?.value as string || '',
        subnet_name: outputs.subnet_name?.value as string || '',
        psc_ip_range: outputs.psc_ip_range?.value as string || '',
        psc_ip_range_name: outputs.psc_ip_range_name?.value as string || '',
        vpc_self_link: outputs.vpc_self_link?.value as string || '',
        subnet_self_link: outputs.subnet_self_link?.value as string || '',
        terraform_output: outputs
      };

      res.status(200).json(response);

    } catch (terraformError) {
      console.error('Failed to get Terraform outputs:', terraformError);
      res.status(404).json({ 
        error: 'Managed Producer infrastructure not found or not deployed',
        project_id: project_id,
        details: terraformError instanceof Error ? terraformError.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('Error in managed producer status route:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    });
  }
});

export default router; 