import express, { Request, Response, Router } from 'express';
import { executeTerraform, getTerraformOutput, TerraformVariables } from '../utils/terraformExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const router: Router = express.Router();
router.use(express.json());

interface ConsumerRequest {
  project_id: string;
  region?: string;
  service_attachment_uri: string;
  reserved_ip_name?: string;
}

interface ConsumerResponse {
  message: string;
  project_id: string;
  region: string;
  vpc_name: string;
  vm_subnet_name: string;
  psc_subnet_name: string;
  vpc_self_link: string;
  vm_subnet_self_link: string;
  psc_subnet_self_link: string;
  psc_ip_address: string;
  psc_endpoint_name: string;
  service_attachment_uri: string;
  terraform_output?: any;
  error?: string;
  vm_info?: any;
  vm_error?: string;
}

router.post('/deploy/consumer', async (req: Request, res: Response): Promise<void> => {
  console.log('=== CONSUMER ROUTE HIT ===');
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
        error: 'Request timeout - consumer deployment took too long',
        message: 'The consumer deployment process exceeded the timeout limit'
      });
      res.end();
    }
  }, 30 * 60 * 1000); // 30 minutes timeout

  try {
    console.log('🟢 CHECKPOINT 2: Extracting request parameters');
    const { 
      project_id,
      region = "us-central1",
      service_attachment_uri,
      reserved_ip_name = "psc-ip"
    } = req.body as ConsumerRequest;

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

    // Validate the service attachment URI (required)
    if (!service_attachment_uri || typeof service_attachment_uri !== 'string') {
      console.log('🔴 CHECKPOINT ERROR: Invalid or missing service_attachment_uri');
      clearTimeout(timeout);
      res.status(400).json({ 
        error: 'Invalid service_attachment_uri. Must be a non-empty string.',
        details: 'Please provide a valid service attachment URI from the producer'
      });
      return;
    }

    console.log('🟢 CHECKPOINT 4: Parameters validated successfully');
    console.log(`Starting consumer deployment for project: ${project_id} in region: ${region}`);
    console.log(`Service Attachment URI: ${service_attachment_uri}`);

    // Set environment variables for Terraform
    process.env.TF_VAR_project_id = project_id;
    process.env.TF_VAR_region = region;
    process.env.TF_VAR_service_attachment_uri = service_attachment_uri;
    process.env.TF_VAR_reserved_ip_name = reserved_ip_name;

    try {
      console.log('🟢 CHECKPOINT 5: Getting Terraform directory path');
      // Get the Terraform directory path
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const terraformDir = path.join(__dirname, '../../terraform/consumer');

      console.log('🟢 CHECKPOINT 6: Starting Terraform execution');
      // Run Terraform to create the infrastructure
      console.log('Running Terraform for consumer...');
      const terraformResult = await executeTerraform(terraformDir);
      console.log('🟢 CHECKPOINT 7: Terraform execution completed successfully');
      console.log('Terraform result:', JSON.stringify(terraformResult, null, 2));

      console.log('🟢 CHECKPOINT 8: Preparing response');
      // Prepare response
      const response: ConsumerResponse = {
        message: 'Consumer infrastructure deployed successfully',
        project_id: terraformResult.project_id || project_id,
        region: region,
        vpc_name: terraformResult.vpc_name || 'consumer-vpc',
        vm_subnet_name: terraformResult.subnet_name || 'vm-subnet',
        psc_subnet_name: terraformResult.subnet_name || 'psc-subnet',
        vpc_self_link: '',
        vm_subnet_self_link: '',
        psc_subnet_self_link: '',
        psc_ip_address: '',
        psc_endpoint_name: 'psc-endpoint',
        service_attachment_uri: terraformResult.service_attachment_uri || service_attachment_uri,
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
      
      // Create VM in the consumer VPC after successful deployment
      console.log('🟢 CHECKPOINT 10: Starting automatic VM creation');
      try {
        console.log('Calling create-vm route to create VM in consumer VPC...');
        const vmResponse = await axios.post('http://localhost:3000/api/create-vm/deploy/create-vm', {
          project_id: project_id,
          region: region,
          instance_name: 'consumer-vm',
          machine_type: 'e2-micro',
          os_image: 'debian-cloud/debian-12'
        });
        
        console.log('🟢 CHECKPOINT 11: VM creation successful');
        console.log('VM creation response:', JSON.stringify(vmResponse.data, null, 2));
        
        // Update the response to include VM information
        response.message = 'Consumer infrastructure and VM deployed successfully';
        response.vm_info = vmResponse.data;
        
      } catch (vmError) {
        console.log('🟡 CHECKPOINT 11: VM creation failed, but consumer infrastructure was successful');
        console.error('VM creation error:', vmError);
        
        // Don't fail the entire request, just log the VM creation failure
        response.message = 'Consumer infrastructure deployed successfully, but VM creation failed';
        response.vm_error = vmError instanceof Error ? vmError.message : 'Unknown VM creation error';
      }
      
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
      
      const errorResponse: ConsumerResponse = {
        message: 'Consumer deployment failed',
        project_id: project_id,
        region: region,
        vpc_name: '',
        vm_subnet_name: '',
        psc_subnet_name: '',
        vpc_self_link: '',
        vm_subnet_self_link: '',
        psc_subnet_self_link: '',
        psc_ip_address: '',
        psc_endpoint_name: '',
        service_attachment_uri: service_attachment_uri,
        error: terraformError instanceof Error ? terraformError.message : 'Unknown Terraform error occurred',
        vm_info: undefined,
        vm_error: undefined
      };

      // Set comprehensive response headers for better compatibility
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Connection', 'close');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // Convert response to string to get exact length
      const errorResponseString = JSON.stringify(errorResponse);
      res.setHeader('Content-Length', Buffer.byteLength(errorResponseString, 'utf8'));
      
      // Send response and explicitly end connection
      res.status(500).send(errorResponseString);
      
      // Force end the response and close connection
      res.end();
      
      // Destroy the socket to ensure connection closure
      if (res.socket && !res.socket.destroyed) {
        res.socket.destroy();
      }
      
      return;
    }

  } catch (error) {
    console.log('🔴 CHECKPOINT ERROR: General error in route handler');
    console.error('Error in consumer route:', error);
    clearTimeout(timeout);
    
    // Check if response has already been sent
    if (res.headersSent) {
      console.log('🟢 ERROR RESPONSE CHECKPOINT 0: Response already sent, skipping error response');
      return;
    }
    
    const errorResponse = { 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    };
    
    // Set comprehensive response headers for better compatibility
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Connection', 'close');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Convert response to string to get exact length
    const errorResponseString = JSON.stringify(errorResponse);
    res.setHeader('Content-Length', Buffer.byteLength(errorResponseString, 'utf8'));
    
    // Send response and explicitly end connection
    res.status(500).send(errorResponseString);
    
    // Force end the response and close connection
    res.end();
    
    // Destroy the socket to ensure connection closure
    if (res.socket && !res.socket.destroyed) {
      res.socket.destroy();
    }
    
    return;
  }
});

// Add a route to get the current state of the consumer
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
      
      const response: ConsumerResponse = {
        message: 'Consumer infrastructure status retrieved successfully',
        project_id: project_id as string,
        region: outputs.region || 'us-central1',
        vpc_name: outputs.vpc_name || 'consumer-vpc',
        vm_subnet_name: outputs.subnet_name || 'vm-subnet',
        psc_subnet_name: outputs.subnet_name || 'psc-subnet',
        vpc_self_link: '',
        vm_subnet_self_link: '',
        psc_subnet_self_link: '',
        psc_ip_address: '',
        psc_endpoint_name: 'psc-endpoint',
        service_attachment_uri: outputs.service_attachment_uri || '',
        terraform_output: outputs
      };

      res.status(200).json(response);

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
