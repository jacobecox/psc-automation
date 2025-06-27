import express, { Request, Response, Router } from 'express';
import { executeTerraform, getTerraformOutput, TerraformVariables } from '../utils/terraformExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';

const router: Router = express.Router();
router.use(express.json());

interface CreateVmRequest {
  project_id: string;
  region?: string;
  instance_name?: string;
  machine_type?: string;
  os_image?: string;
}

interface CreateVmResponse {
  message: string;
  project_id: string;
  region: string;
  instance_name: string;
  instance_id: string;
  zone: string;
  internal_ip: string;
  subnet_name: string;
  vpc_name: string;
  machine_type: string;
  os_image: string;
  terraform_output?: any;
  error?: string;
}

router.post('/deploy/create-vm', async (req: Request, res: Response): Promise<void> => {
  console.log('=== CREATE VM ROUTE HIT ===');
  console.log('🟢 CHECKPOINT 1: Route handler started');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  
  // Set a timeout for the entire request
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.log('🔴 CHECKPOINT TIMEOUT: Request timeout - sending error response');
      res.status(408).json({ 
        error: 'Request timeout - VM creation took too long',
        message: 'The VM creation process exceeded the timeout limit'
      });
      res.end();
    }
  }, 30 * 60 * 1000); // 30 minutes timeout

  try {
    console.log('🟢 CHECKPOINT 2: Extracting request parameters');
    const { 
      project_id,
      region = "us-central1",
      instance_name = "consumer-vm",
      machine_type = "e2-micro",
      os_image = "debian-cloud/debian-12"
    } = req.body as CreateVmRequest;

    console.log('🟢 CHECKPOINT 3: Validating request parameters');
    // Validate the project ID (required)
    if (!project_id || typeof project_id !== 'string') {
      console.log('🔴 CHECKPOINT ERROR: Invalid or missing project_id');
      clearTimeout(timeout);
      res.status(400).json({ 
        error: 'Invalid project_id. Must be a non-empty string.',
        details: 'Please provide a valid GCP project ID'
      });
      return;
    }

    // Validate the region
    if (region && typeof region !== 'string') {
      console.log('🔴 CHECKPOINT ERROR: Invalid region');
      clearTimeout(timeout);
      res.status(400).json({ 
        error: 'Invalid region. Must be a string.',
        details: 'Please provide a valid GCP region'
      });
      return;
    }

    // Validate the instance name
    if (instance_name && typeof instance_name !== 'string') {
      console.log('🔴 CHECKPOINT ERROR: Invalid instance_name');
      clearTimeout(timeout);
      res.status(400).json({ 
        error: 'Invalid instance_name. Must be a string.',
        details: 'Please provide a valid VM instance name'
      });
      return;
    }

    // Validate the machine type
    if (machine_type && typeof machine_type !== 'string') {
      console.log('🔴 CHECKPOINT ERROR: Invalid machine_type');
      clearTimeout(timeout);
      res.status(400).json({ 
        error: 'Invalid machine_type. Must be a string.',
        details: 'Please provide a valid GCP machine type'
      });
      return;
    }

    // Validate the OS image
    if (os_image && typeof os_image !== 'string') {
      console.log('🔴 CHECKPOINT ERROR: Invalid os_image');
      clearTimeout(timeout);
      res.status(400).json({ 
        error: 'Invalid os_image. Must be a string.',
        details: 'Please provide a valid GCP OS image'
      });
      return;
    }

    console.log('🟢 CHECKPOINT 4: Parameters validated successfully');
    console.log(`Starting VM creation for project: ${project_id} in region: ${region}`);
    console.log(`Instance: ${instance_name}, Machine Type: ${machine_type}, OS: ${os_image}`);

    // Set environment variables for Terraform
    process.env.TF_VAR_project_id = project_id;
    process.env.TF_VAR_region = region;
    process.env.TF_VAR_instance_name = instance_name;
    process.env.TF_VAR_machine_type = machine_type;
    process.env.TF_VAR_os_image = os_image;

    try {
      console.log('🟢 CHECKPOINT 5: Getting Terraform directory path');
      // Get the Terraform directory path
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const terraformDir = path.join(__dirname, '../../terraform/create-vm');

      console.log('🟢 CHECKPOINT 6: Starting Terraform execution');
      // Run Terraform to create the VM
      console.log('Running Terraform for VM creation...');
      const terraformResult = await executeTerraform(terraformDir);
      console.log('🟢 CHECKPOINT 7: Terraform execution completed successfully');
      console.log('Terraform result:', JSON.stringify(terraformResult, null, 2));

      console.log('🟢 CHECKPOINT 8: Preparing response');
      // Prepare response
      const response: CreateVmResponse = {
        message: 'VM created successfully in consumer VPC',
        project_id: terraformResult.project_id || project_id,
        region: terraformResult.region || region,
        instance_name: terraformResult.instance_name || instance_name,
        instance_id: terraformResult.instance_id || '',
        zone: terraformResult.zone || `${region}-a`,
        internal_ip: terraformResult.internal_ip || '',
        subnet_name: terraformResult.subnet_name || 'vm-subnet',
        vpc_name: terraformResult.vpc_name || 'consumer-vpc',
        machine_type: terraformResult.machine_type || machine_type,
        os_image: terraformResult.os_image || os_image,
        terraform_output: terraformResult
      };

      console.log('🟢 CHECKPOINT 9: Sending success response');
      console.log('Sending success response:', JSON.stringify(response, null, 2));
      
      // Clear timeout since we're about to send response
      clearTimeout(timeout);
      
      // Check if response has already been sent
      if (res.headersSent) {
        console.log('🟢 RESPONSE CHECKPOINT 0: Response already sent, skipping');
        return;
      }
      
      console.log('🟢 RESPONSE CHECKPOINT 1: Preparing to send response');
      
      // Set comprehensive response headers for better compatibility
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Connection', 'close');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      console.log('🟢 RESPONSE CHECKPOINT 2: Headers set');
      
      // Convert response to string to get exact length
      const responseString = JSON.stringify(response);
      res.setHeader('Content-Length', Buffer.byteLength(responseString, 'utf8'));
      
      console.log('🟢 RESPONSE CHECKPOINT 3: Response stringified, length:', Buffer.byteLength(responseString, 'utf8'));
      
      // Send response and explicitly end connection
      res.status(200).send(responseString);
      
      console.log('🟢 RESPONSE CHECKPOINT 4: Response sent');
      
      // Force end the response and close connection
      res.end();
      
      console.log('🟢 RESPONSE CHECKPOINT 5: Response ended');
      
      // Destroy the socket to ensure connection closure
      if (res.socket && !res.socket.destroyed) {
        res.socket.destroy();
        console.log('🟢 RESPONSE CHECKPOINT 6: Socket destroyed');
      } else {
        console.log('🟢 RESPONSE CHECKPOINT 6: Socket already destroyed or not available');
      }
      
      console.log('Response sent and ended successfully');
      
      // Ensure the function completes
      return;

    } catch (terraformError) {
      console.log('🔴 CHECKPOINT ERROR: Terraform execution failed');
      console.error('Terraform execution failed:', terraformError);
      
      clearTimeout(timeout);
      
      // Check if response has already been sent
      if (res.headersSent) {
        console.log('🟢 ERROR RESPONSE CHECKPOINT 0: Response already sent, skipping error response');
        return;
      }
      
      const errorResponse: CreateVmResponse = {
        message: 'VM creation failed',
        project_id: project_id,
        region: region,
        instance_name: instance_name,
        instance_id: '',
        zone: `${region}-a`,
        internal_ip: '',
        subnet_name: 'vm-subnet',
        vpc_name: 'consumer-vpc',
        machine_type: machine_type,
        os_image: os_image,
        error: terraformError instanceof Error ? terraformError.message : 'Unknown Terraform error'
      };
      
      console.log('Sending error response:', JSON.stringify(errorResponse, null, 2));
      
      res.status(500).json(errorResponse);
      
    }
  } catch (error) {
    console.log('🔴 CHECKPOINT ERROR: General error in route handler');
    console.error('General error:', error);
    
    clearTimeout(timeout);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error during VM creation',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Status endpoint to check VM status
router.get('/status/create-vm', async (req: Request, res: Response): Promise<void> => {
  try {
    const { project_id } = req.query;

    if (!project_id || typeof project_id !== 'string') {
      res.status(400).json({ 
        error: 'Invalid project_id query parameter. Must be a non-empty string.',
        details: 'Please provide a valid GCP project ID'
      });
      return;
    }

    console.log(`Checking VM status for project: ${project_id}`);

    // Get the Terraform directory path
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const terraformDir = path.join(__dirname, '../../terraform/create-vm');

    try {
      const outputs = await getTerraformOutput(terraformDir);
      
      if (outputs && outputs.success) {
        const response: CreateVmResponse = {
          message: 'VM status retrieved successfully',
          project_id: outputs.project_id || project_id,
          region: outputs.region || 'us-central1',
          instance_name: outputs.instance_name || 'consumer-vm',
          instance_id: outputs.instance_id || '',
          zone: outputs.zone || 'us-central1-a',
          internal_ip: outputs.internal_ip || '',
          subnet_name: outputs.subnet_name || 'vm-subnet',
          vpc_name: outputs.vpc_name || 'consumer-vpc',
          machine_type: outputs.machine_type || 'e2-micro',
          os_image: outputs.os_image || 'debian-cloud/debian-12',
          terraform_output: outputs
        };

        res.status(200).json(response);
      } else {
        res.status(404).json({ 
          error: 'VM not found or not deployed',
          project_id: project_id,
          details: 'No VM infrastructure found for this project'
        });
      }
    } catch (terraformError) {
      console.error('Error getting Terraform output:', terraformError);
      res.status(404).json({ 
        error: 'VM not found or not deployed',
        project_id: project_id,
        details: terraformError instanceof Error ? terraformError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error in VM status check:', error);
    res.status(500).json({ 
      error: 'Internal server error during VM status check',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 