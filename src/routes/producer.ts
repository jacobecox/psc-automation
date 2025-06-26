import express, { Request, Response, Router } from 'express';
import { runTerraform, getTerraformOutput, TerraformVariables } from '../utils/terraformExecutor.js';
import axios from 'axios';

const router: Router = express.Router();
router.use(express.json());

interface ProducerRequest {
  producer_project_id?: string;
  region?: string;
}

async function getServiceAttachmentUri(projectId: string, region: string, serviceAttachmentName: string): Promise<string> {
  return `projects/${projectId}/regions/${region}/serviceAttachments/${serviceAttachmentName}`;
}

router.post('/deploy/producer', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      producer_project_id = "test-project-2-462619", 
      region = "us-central1"
    } = req.body as ProducerRequest;

    // Validate the project ID
    if (!producer_project_id || typeof producer_project_id !== 'string') {
      res.status(400).json({ 
        error: 'Invalid producer_project_id. Must be a non-empty string.',
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

    console.log(`Starting producer deployment for project: ${producer_project_id} in region: ${region}`);

    // Set environment variables for Terraform
    process.env.TF_VAR_producer_project_id = producer_project_id;
    process.env.TF_VAR_region = region;

    const vars = req.body;
    console.log('Received deployment request with variables:', vars);

    // Optional: validate that required vars exist
    const requiredVars = [
      "producer_project_id",
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
    const mergedVars: TerraformVariables = { ...defaultVars, ...vars };

    try {
      console.log('Running Terraform for producer...');
      const output = await runTerraform('producer', mergedVars);
      console.log('Terraform execution completed');

      // Get the service attachment URI
      const serviceAttachmentUri = await getServiceAttachmentUri(
        mergedVars.producer_project_id as string,
        mergedVars.region as string,
        mergedVars.service_attachment_name as string
      );

      // Call the consumer route with default values
      try {
        const consumerResponse = await axios.post('http://localhost:3000/consumer/deploy/consumer', {
          service_attachment_uri: serviceAttachmentUri,
          consumer_project_id: "consumer-test-project-463821",
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
  } catch (error) {
    console.error('Error in producer deployment:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    });
  }
});

// Add status endpoint for consistency
router.get('/status/producer', async (req: Request, res: Response): Promise<void> => {
  try {
    const { producer_project_id } = req.query;

    if (!producer_project_id || typeof producer_project_id !== 'string') {
      res.status(400).json({ 
        error: 'Invalid producer_project_id query parameter. Must be a non-empty string.',
        details: 'Please provide a valid GCP project ID'
      });
      return;
    }

    try {
      const outputs = await getTerraformOutput('producer');
      
      res.status(200).json({
        message: 'Producer infrastructure status retrieved successfully',
        producer_project_id: producer_project_id,
        terraform_output: outputs
      });

    } catch (terraformError) {
      console.error('Failed to get Terraform outputs:', terraformError);
      res.status(404).json({ 
        error: 'Producer infrastructure not found or not deployed',
        producer_project_id: producer_project_id,
        details: terraformError instanceof Error ? terraformError.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('Error in producer status route:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    });
  }
});

export default router;
