import express, { Request, Response, Router } from 'express';
import { runTerraform, getTerraformOutput, TerraformVariables, pollForPscCompletion } from '../utils/terraformExecutor.js';

const router: Router = express.Router();
router.use(express.json());

interface CreateSqlRequest {
  project_id?: string;
  region?: string;
  instance_id?: string;
  default_password?: string;
  allowed_consumer_project_id?: string;
}

interface CreateSqlResponse {
  message: string;
  project_id: string;
  region: string;
  instance_id: string;
  instance_connection_name: string;
  private_ip_address: string;
  database_name: string;
  user_name: string;
  allowed_consumer_project_id: string;
  terraform_output?: any;
  error?: string;
  psc_enabled?: boolean;
}

router.post('/deploy/create-sql', async (req: Request, res: Response): Promise<void> => {
  console.log('=== CREATE SQL ROUTE HIT ===');
  console.log('🟡 CHECKPOINT 1: Route handler started');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);

  // Set a timeout for the entire request
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.log('🔴 CHECKPOINT TIMEOUT: Request timeout - sending error response');
      res.status(408).json({ 
        error: 'Request timeout - SQL deployment took too long',
        message: 'The SQL deployment process exceeded the timeout limit'
      });
      res.end();
    }
  }, 35 * 60 * 1000); // 35 minutes timeout (30 min PSC polling + buffer)

  try {
    console.log('🟡 CHECKPOINT 2: Extracting request parameters');
    const { 
      project_id = "producer-test-project", 
      region = "us-central1",
      instance_id = "producer-sql",
      default_password = "postgres",
      allowed_consumer_project_id = "consumer-test-project-463821"
    } = req.body as CreateSqlRequest;

    console.log('🟡 CHECKPOINT 3: Validating request parameters');
    // Validate the project ID
    if (!project_id || typeof project_id !== 'string') {
      console.log('🔴 CHECKPOINT ERROR: Invalid project_id');
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

    // Validate the instance ID
    if (instance_id && typeof instance_id !== 'string') {
      console.log('🔴 CHECKPOINT ERROR: Invalid instance_id');
      clearTimeout(timeout);
      res.status(400).json({ 
        error: 'Invalid instance_id. Must be a string.',
        details: 'Please provide a valid instance ID'
      });
      return;
    }

    // Validate the allowed consumer project ID
    if (allowed_consumer_project_id && typeof allowed_consumer_project_id !== 'string') {
      console.log('🔴 CHECKPOINT ERROR: Invalid allowed_consumer_project_id');
      clearTimeout(timeout);
      res.status(400).json({ 
        error: 'Invalid allowed_consumer_project_id. Must be a string.',
        details: 'Please provide a valid consumer project ID'
      });
      return;
    }

    console.log('🟡 CHECKPOINT 4: Parameters validated successfully');
    console.log(`Starting SQL deployment for project: ${project_id} in region: ${region}`);
    console.log(`Instance ID: ${instance_id}, Consumer Project: ${allowed_consumer_project_id}`);

    console.log('🟡 CHECKPOINT 5: Preparing Terraform variables');
    // Prepare Terraform variables
    const terraformVariables: TerraformVariables = {
      project_id: project_id,
      region: region,
      instance_id: instance_id,
      default_password: default_password,
      allowed_consumer_project_id: allowed_consumer_project_id
    };
    console.log('Terraform variables prepared:', JSON.stringify(terraformVariables, null, 2));

    try {
      console.log('🟡 CHECKPOINT 6: Starting Terraform execution');
      // Run Terraform to create the Cloud SQL instance
      console.log('Running Terraform for SQL deployment...');
      const terraformResult = await runTerraform('create-sql', terraformVariables);
      console.log('🟢 CHECKPOINT 7: Terraform execution completed successfully');
      console.log('Terraform result:', terraformResult);

      console.log('🟡 CHECKPOINT 8: Retrieving Terraform outputs');
      // Get Terraform outputs
      console.log('Retrieving Terraform outputs...');
      const outputs = await getTerraformOutput('create-sql');
      console.log('🟢 CHECKPOINT 9: Terraform outputs retrieved successfully');
      console.log('Terraform outputs retrieved:', outputs);

      console.log('🟡 CHECKPOINT 10: Starting PSC completion polling');
      
      // Poll for PSC completion
      const pscCompleted = await pollForPscCompletion(
        project_id, 
        outputs.instance_name || instance_id,
        30 // 30 minutes timeout
      );
      
      if (pscCompleted) {
        console.log('🟢 CHECKPOINT 11: PSC polling completed successfully');
      } else {
        console.log('🔴 CHECKPOINT 11: PSC polling timed out');
      }

      console.log('🟡 CHECKPOINT 12: Preparing response');
      // Prepare response
      const response: CreateSqlResponse = {
        message: pscCompleted 
          ? 'SQL infrastructure deployed successfully with PSC enabled'
          : 'SQL infrastructure deployed successfully, but PSC enablement timed out',
        project_id: outputs.project_id || project_id,
        region: outputs.region || region,
        instance_id: outputs.instance_name || instance_id,
        instance_connection_name: outputs.instance_connection_name || '',
        private_ip_address: outputs.private_ip_address || '',
        database_name: outputs.database_name || 'postgres',
        user_name: outputs.user_name || 'postgres',
        allowed_consumer_project_id: outputs.allowed_consumer_project_id || allowed_consumer_project_id,
        terraform_output: outputs,
        psc_enabled: pscCompleted
      };

      console.log('🟡 CHECKPOINT 13: Sending success response');
      console.log('Sending success response:', JSON.stringify(response, null, 2));
      
      // Clear timeout since we're about to send response
      clearTimeout(timeout);
      
      // Set response headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'close'); // Explicitly close connection
      
      // Send response and end
      res.status(200).json(response);
      res.end();
      
      // Force close the connection to prevent hanging
      if (req.socket && !req.socket.destroyed) {
        req.socket.destroy();
      }
      
      console.log('🟢 CHECKPOINT 14: Response sent and connection closed successfully');
      
      // Ensure the function completes
      return;

    } catch (terraformError) {
      console.log('🔴 CHECKPOINT ERROR: Terraform execution failed');
      console.error('Terraform execution failed:', terraformError);
      
      clearTimeout(timeout);
      
      // Check if this is a PSC timeout error
      const isPscTimeout = terraformError instanceof Error && 
        terraformError.message.includes('PSC operation is taking longer than expected but was submitted successfully');
      
      // Check if this is a successful PSC submission
      const isPscSuccess = terraformError instanceof Error && 
        terraformError.message.includes('PSC operation submitted successfully and is running in background');
      
      const errorMessage = isPscTimeout 
        ? 'SQL instance created successfully, but PSC enablement is still in progress. The operation will complete automatically in a few minutes.'
        : isPscSuccess
        ? 'SQL instance created successfully, and PSC enablement operation was submitted successfully. The PSC operation is running in the background and will complete automatically.'
        : terraformError instanceof Error ? terraformError.message : 'Unknown Terraform error occurred';
      
      const errorResponse: CreateSqlResponse = {
        message: isPscTimeout || isPscSuccess ? 'SQL infrastructure deployed successfully (PSC in progress)' : 'SQL deployment failed',
        project_id: project_id,
        region: region,
        instance_id: instance_id,
        instance_connection_name: '',
        private_ip_address: '',
        database_name: 'postgres',
        user_name: 'postgres',
        allowed_consumer_project_id: allowed_consumer_project_id,
        error: errorMessage
      };

      res.status(isPscTimeout || isPscSuccess ? 200 : 500).json(errorResponse);
      res.end();
      
      // Force close the connection to prevent hanging
      if (req.socket && !req.socket.destroyed) {
        req.socket.destroy();
      }
      
      return;
    }

  } catch (error) {
    console.log('🔴 CHECKPOINT ERROR: General error in route handler');
    console.error('Error in SQL deployment route:', error);
    clearTimeout(timeout);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    });
    res.end();
    
    // Force close the connection to prevent hanging
    if (req.socket && !req.socket.destroyed) {
      req.socket.destroy();
    }
    
    return;
  }
});

// Add a route to get the current state of the SQL infrastructure
router.get('/status/create-sql', async (req: Request, res: Response): Promise<void> => {
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
      const outputs = await getTerraformOutput('create-sql');
      
      const response: CreateSqlResponse = {
        message: 'SQL infrastructure status retrieved successfully',
        project_id: outputs.project_id || project_id as string,
        region: outputs.region || 'us-central1',
        instance_id: outputs.instance_name || 'producer-sql',
        instance_connection_name: outputs.instance_connection_name || '',
        private_ip_address: outputs.private_ip_address || '',
        database_name: outputs.database_name || 'postgres',
        user_name: outputs.user_name || 'postgres',
        allowed_consumer_project_id: outputs.allowed_consumer_project_id || 'consumer-test-project-463821',
        terraform_output: outputs
      };

      res.status(200).json(response);

    } catch (terraformError) {
      console.error('Failed to get Terraform outputs:', terraformError);
      res.status(404).json({ 
        error: 'SQL infrastructure not found or not deployed',
        project_id: project_id,
        details: terraformError instanceof Error ? terraformError.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('Error in SQL status route:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    });
    res.end();
    
    // Force close the connection to prevent hanging
    if (req.socket && !req.socket.destroyed) {
      req.socket.destroy();
    }
    
    return;
  }
});

export default router; 