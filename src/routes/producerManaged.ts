import express, { Request, Response, Router } from 'express';
import { executeTerraform, getTerraformOutput, TerraformVariables, pollForPscCompletion } from '../utils/terraformExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { runTerraform } from '../utils/terraformExecutor.js';

const router: Router = express.Router();
router.use(express.json());

interface ProducerManagedRequest {
  project_id: string;
  region?: string;
  // SQL configuration parameters
  instance_id?: string;
  default_password?: string;
  allowed_consumer_project_id?: string;
  tier?: string;
  database_version?: string;
  deletion_protection?: boolean;
  backup_enabled?: boolean;
  backup_start_time?: string;
  maintenance_day?: number;
  maintenance_hour?: number;
  maintenance_update_track?: string;
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
  sql_creation_result?: any;
  terraform_output?: any;
  error?: string;
}

router.post('/deploy/managed', async (req: Request, res: Response): Promise<void> => {
  console.log('=== MANAGED PRODUCER ROUTE HIT ===');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  
  // Set a timeout for the entire request
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.log('Request timeout - sending error response');
      res.status(408).json({ 
        error: 'Request timeout - deployment took too long',
        message: 'The deployment process exceeded the timeout limit'
      });
      res.end();
    }
  }, 40 * 60 * 1000); // 40 minutes timeout (30 min PSC polling + infrastructure creation + buffer)

  try {
    const { 
      project_id = "test-project-2-462619", 
      region = "us-central1"
    } = req.body as ProducerManagedRequest;

    // Validate the project ID
    if (!project_id || typeof project_id !== 'string') {
      clearTimeout(timeout);
      res.status(400).json({ 
        error: 'Invalid project_id. Must be a non-empty string.',
        details: 'Please provide a valid GCP project ID'
      });
      return;
    }

    // Validate the region
    if (region && typeof region !== 'string') {
      clearTimeout(timeout);
      res.status(400).json({ 
        error: 'Invalid region. Must be a string.',
        details: 'Please provide a valid GCP region'
      });
      return;
    }

    console.log(`Starting managed producer deployment for project: ${project_id} in region: ${region}`);

    // Set environment variables for Terraform
    process.env.TF_VAR_project_id = project_id;
    process.env.TF_VAR_region = region;

    try {
      // Get the Terraform directory path
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const terraformDir = path.join(__dirname, '../../terraform/producer-managed');

      // Run Terraform to create the infrastructure
      console.log('Running Terraform for managed producer...');
      const terraformResult = await executeTerraform(terraformDir);
      console.log('Terraform execution completed successfully');
      console.log('Terraform result:', JSON.stringify(terraformResult, null, 2));

      // Prepare base response
      const response: ProducerManagedResponse = {
        message: 'Managed Producer infrastructure deployed successfully',
        project_id: terraformResult.project_id || project_id,
        region: region,
        vpc_name: terraformResult.vpc_name || '',
        subnet_name: terraformResult.subnet_name || '',
        psc_ip_range: terraformResult.psc_ip_range || '',
        psc_ip_range_name: terraformResult.psc_ip_range_name || '',
        vpc_self_link: terraformResult.vpc_self_link || '',
        subnet_self_link: terraformResult.subnet_self_link || '',
        terraform_output: terraformResult
      };

      // Automatically call the createSql route after infrastructure deployment
      try {
        console.log('Starting automatic SQL creation via createSql route...');
        
        // Prepare SQL creation variables
        const sqlVariables = {
          project_id: project_id,
          region: region,
          instance_id: "producer-sql",
          default_password: "postgres",
          allowed_consumer_project_ids: ["consumer-test-project-463821"]
        };

        // Run SQL creation using the same logic as createSql route
        console.log('Running Terraform for SQL deployment...');
        const sqlResult = await runTerraform('create-sql', sqlVariables);
        console.log('SQL creation completed successfully');
        
        // Get SQL outputs
        console.log('Retrieving Terraform outputs...');
        const sqlOutputs = await getTerraformOutput('create-sql');
        console.log('Terraform outputs retrieved:', sqlOutputs);
        
        // Poll for PSC completion
        console.log('Starting PSC completion polling for automatic SQL creation...');
        const pscCompleted = await pollForPscCompletion(
          project_id,
          sqlOutputs.instance_name || 'producer-sql',
          30 // 30 minutes timeout
        );
        
        // Add SQL results to response
        response.sql_creation_result = {
          success: true,
          message: pscCompleted 
            ? 'SQL instance created successfully with PSC enabled'
            : 'SQL instance created successfully, but PSC enablement timed out',
          instance_name: sqlOutputs.instance_name || 'producer-sql',
          instance_connection_name: sqlOutputs.instance_connection_name || '',
          private_ip_address: sqlOutputs.private_ip_address || '',
          database_name: sqlOutputs.database_name || 'postgres',
          user_name: sqlOutputs.user_name || 'postgres',
          allowed_consumer_project_id: sqlOutputs.allowed_consumer_project_id || 'consumer-test-project-463821',
          service_attachment_uri: sqlOutputs.service_attachment_uri || '',
          terraform_output: sqlOutputs,
          psc_enabled: pscCompleted
        };
        
        response.message = pscCompleted 
          ? 'Managed Producer infrastructure and SQL instance deployed successfully with PSC enabled'
          : 'Managed Producer infrastructure and SQL instance deployed successfully (PSC timed out)';
        
      } catch (sqlError) {
        console.error('SQL creation failed:', sqlError);
        
        // Check if this is a PSC timeout error
        const isPscTimeout = sqlError instanceof Error && 
          sqlError.message.includes('PSC operation is taking longer than expected but was submitted successfully');
        
        // Check if this is a successful PSC submission
        const isPscSuccess = sqlError instanceof Error && 
          sqlError.message.includes('PSC operation submitted successfully and is running in background');
        
        const errorMessage = isPscTimeout 
          ? 'SQL instance created successfully, but PSC enablement is still in progress. The operation will complete automatically in a few minutes.'
          : isPscSuccess
          ? 'SQL instance created successfully, and PSC enablement operation was submitted successfully. The PSC operation is running in the background and will complete automatically.'
          : sqlError instanceof Error ? sqlError.message : 'Unknown Terraform error occurred';
        
        response.sql_creation_result = {
          success: isPscTimeout || isPscSuccess,
          message: isPscTimeout || isPscSuccess ? 'SQL instance created successfully (PSC in progress)' : 'SQL creation failed',
          error: errorMessage
        };
        
        // Don't fail the entire request, just log the SQL error
      }

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
      console.error('Terraform execution failed:', terraformError);
      
      clearTimeout(timeout);
      
      // Check if response has already been sent
      if (res.headersSent) {
        console.log('🟢 ERROR RESPONSE CHECKPOINT 0: Response already sent, skipping error response');
        return;
      }
      
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
    console.error('Error in managed producer route:', error);
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
      // Get the Terraform directory path
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const terraformDir = path.join(__dirname, '../../terraform/producer-managed');

      const outputs = await getTerraformOutput('producer-managed');
      
      const response: ProducerManagedResponse = {
        message: 'Managed Producer infrastructure status retrieved successfully',
        project_id: project_id as string,
        region: 'us-central1', // Default region
        vpc_name: outputs.vpc_name || '',
        subnet_name: outputs.subnet_name || '',
        psc_ip_range: outputs.psc_ip_range || '',
        psc_ip_range_name: outputs.psc_ip_range_name || '',
        vpc_self_link: outputs.vpc_self_link || '',
        subnet_self_link: outputs.subnet_self_link || '',
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

// Add a simple test route to verify response handling
router.get('/test', async (_req: Request, res: Response): Promise<void> => {
  console.log('=== TEST ROUTE HIT ===');
  
  const testResponse = {
    message: 'Test response successful',
    timestamp: new Date().toISOString(),
    test: true
  };
  
  console.log('Sending test response:', JSON.stringify(testResponse, null, 2));
  
  // Set comprehensive response headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Connection', 'close');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Convert response to string to get exact length
  const responseString = JSON.stringify(testResponse);
  res.setHeader('Content-Length', Buffer.byteLength(responseString, 'utf8'));
  
  // Send response and explicitly end connection
  res.status(200).send(responseString);
  
  // Force end the response and close connection
  res.end();
  
  // Destroy the socket to ensure connection closure
  if (res.socket && !res.socket.destroyed) {
    res.socket.destroy();
  }
  
  console.log('Test response sent and ended successfully');
});

export default router; 