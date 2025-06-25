import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

export interface TerraformVariables {
  [key: string]: string | number | boolean;
}

export interface TerraformOutput {
  success: boolean;
  vpc_name?: string;
  subnet_name?: string;
  psc_ip_range?: string;
  psc_ip_range_name?: string;
  vpc_self_link?: string;
  subnet_self_link?: string;
  project_id: string;
  apis_enabled?: Record<string, any>;
  // SQL-specific outputs
  region?: string;
  instance_name?: string;
  instance_connection_name?: string;
  private_ip_address?: string;
  database_name?: string;
  user_name?: string;
  allowed_consumer_project_id?: string;
}

// Helper function to wait for a specified time
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to poll for PSC completion
export async function pollForPscCompletion(projectId: string, instanceName: string, maxWaitMinutes: number = 30): Promise<boolean> {
  console.log(`🟡 PSC POLLING: Starting PSC completion polling for ${instanceName} in project ${projectId}`);
  console.log(`🟡 PSC POLLING: Will poll for up to ${maxWaitMinutes} minutes`);
  
  const maxAttempts = maxWaitMinutes * 2; // Check every 30 seconds
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🟡 PSC POLLING: Attempt ${attempts}/${maxAttempts} - Checking PSC status...`);
    
    try {
      // Check if PSC is enabled
      const { exec } = await import('child_process');
      const checkPsc = () => new Promise<string>((resolve, reject) => {
        exec(`gcloud sql instances describe ${instanceName} --project=${projectId} --format="value(settings.ipConfiguration.pscConfig.pscEnabled)"`, 
          (error, stdout, stderr) => {
            if (error) {
              reject(error);
            } else {
              resolve(stdout.trim());
            }
          });
      });
      
      const pscStatus = await checkPsc();
      console.log(`🟡 PSC POLLING: PSC status: ${pscStatus}`);
      
      if (pscStatus === 'True') {
        console.log('🟢 PSC POLLING: PSC is now enabled!');
        return true;
      }
      
      // Check if there are any pending operations
      const checkPendingOps = () => new Promise<string>((resolve, reject) => {
        exec(`gcloud sql operations list --project=${projectId} --instance=${instanceName} --filter="status=PENDING" --format="value(name)"`, 
          (error, stdout, stderr) => {
            if (error) {
              resolve(''); // No pending ops if command fails
            } else {
              resolve(stdout.trim());
            }
          });
      });
      
      const pendingOps = await checkPendingOps();
      if (pendingOps) {
        console.log(`🟡 PSC POLLING: Found pending operations: ${pendingOps}`);
      } else {
        console.log('🟡 PSC POLLING: No pending operations found');
      }
      
    } catch (error) {
      console.log(`🟡 PSC POLLING: Error checking PSC status: ${error}`);
    }
    
    // Wait 30 seconds before next check
    if (attempts < maxAttempts) {
      console.log('🟡 PSC POLLING: Waiting 30 seconds before next check...');
      await wait(30000);
    }
  }
  
  console.log('🔴 PSC POLLING: PSC did not complete within the expected time');
  return false;
}

export async function executeTerraform(terraformDir: string, attempt: number = 1): Promise<TerraformOutput> {
  return new Promise(async (resolveExec, rejectExec) => {
    try {
      console.log(`Starting Terraform execution in directory: ${terraformDir}`);
      
      // Load environment variables
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
      }
      
      // Generate terraform.tfvars.json
      const tfvarsPath = path.join(terraformDir, 'terraform.tfvars.json');
      const tfvars = {
        project_id: process.env.TF_VAR_project_id || 'producer-test-project',
        region: process.env.TF_VAR_region || 'us-central1'
      };
      
      fs.writeFileSync(tfvarsPath, JSON.stringify(tfvars, null, 2));
      console.log(`Generated terraform.tfvars.json: ${JSON.stringify(tfvars, null, 2)}`);
      
      // Debug: Check which project the service account is using
      console.log('Checking service account project...');
      exec('gcloud config get-value project', (error, stdout, stderr) => {
        if (error) {
          console.log('Could not get gcloud project:', error.message);
        } else {
          const gcloudProject = stdout.trim();
          console.log(`gcloud default project: ${gcloudProject}`);
          console.log(`Target project: ${tfvars.project_id}`);
          
          if (gcloudProject !== tfvars.project_id) {
            console.log('WARNING: gcloud default project differs from target project!');
            console.log('This might cause API enablement issues.');
          }
        }
      });
      
      // Phase 1: Enable APIs only
      console.log('Phase 1: Enabling required APIs...');
      const phase1Command = 'terraform init && terraform apply -auto-approve -target=google_project_service.cloud_resource_manager -target=google_project_service.sql_admin -target=google_project_service.compute_engine -target=google_project_service.service_networking';
      
      exec(phase1Command, { 
        cwd: terraformDir,
        env: { ...process.env, TF_VAR_project_id: tfvars.project_id, TF_VAR_region: tfvars.region }
      }, async (error, stdout, stderr) => {
        if (error) {
          console.log(`Terraform execution error (attempt ${attempt}):`, error.message);
          console.log('Terraform stderr:', stderr);
          
          // Check if this is an API enablement error
          const isApiError = stderr.includes('SERVICE_DISABLED') || 
                           stderr.includes('API has not been used') || 
                           stderr.includes('not been used in project') ||
                           stderr.includes('Compute Engine API has not been used');
          
          if (isApiError && attempt < 3) {
            const waitTime = attempt * 300; // 300s, 600s, 900s (5min, 10min, 15min)
            console.log(`API enablement error detected. Retrying in ${waitTime} seconds... (attempt ${attempt}/3)`);
            
            // For the first attempt, try to manually enable the Compute Engine API
            if (attempt === 1) {
              console.log('Attempting to manually enable Compute Engine API...');
              try {
                const enableCommand = `gcloud services enable compute.googleapis.com --project=${process.env.TF_VAR_project_id || 'producer-test-project'}`;
                exec(enableCommand, (error, stdout, stderr) => {
                  if (error) {
                    console.log('Manual API enablement failed, will retry with delay:', error.message);
                  } else {
                    console.log('Manual API enablement successful:', stdout);
                  }
                });
              } catch (manualError) {
                console.log('Manual API enablement error:', manualError);
              }
            }
            
            setTimeout(async () => {
              try {
                const result = await executeTerraform(terraformDir, attempt + 1);
                resolveExec(result);
              } catch (retryError) {
                rejectExec(retryError);
              }
            }, waitTime * 1000);
            return;
          }
          
          rejectExec(new Error(`Terraform execution failed: ${error.message}`));
          return;
        }
        
        console.log('Phase 1 completed successfully. Waiting 120 seconds for API propagation...');
        
        // Wait for API propagation
        setTimeout(async () => {
          try {
            // Phase 2: Create infrastructure
            console.log('Phase 2: Creating infrastructure...');
            const phase2Command = 'terraform apply -auto-approve';
            
            exec(phase2Command, { 
              cwd: terraformDir,
              env: { ...process.env, TF_VAR_project_id: tfvars.project_id, TF_VAR_region: tfvars.region }
            }, (phase2Error, phase2Stdout, phase2Stderr) => {
              if (phase2Error) {
                console.log('Phase 2 error:', phase2Error.message);
                console.log('Phase 2 stderr:', phase2Stderr);
                
                // Check if this is a Service Networking API propagation error
                const isServiceNetworkingError = phase2Stderr.includes('Service Networking API has not been used') ||
                                               phase2Stderr.includes('servicenetworking.googleapis.com') ||
                                               phase2Stderr.includes('wait a few minutes for the action to propagate');
                
                if (isServiceNetworkingError && attempt < 3) {
                  const waitTime = 180; // 3 minutes for Service Networking API propagation
                  console.log(`Service Networking API propagation error detected. Retrying in ${waitTime} seconds... (attempt ${attempt}/3)`);
                  
                  // Extract the actual project ID from the error message
                  const projectMatch = phase2Stderr.match(/project (\d+)/);
                  const actualProjectId = projectMatch ? projectMatch[1] : tfvars.project_id;
                  console.log(`Detected actual project ID from error: ${actualProjectId}`);
                  
                  // Try to manually enable Service Networking API in the correct project
                  console.log(`Attempting to manually enable Service Networking API in project: ${actualProjectId}...`);
                  try {
                    const enableCommand = `gcloud services enable servicenetworking.googleapis.com --project=${actualProjectId}`;
                    exec(enableCommand, (error, stdout, stderr) => {
                      if (error) {
                        console.log('Manual Service Networking API enablement failed:', error.message);
                      } else {
                        console.log('Manual Service Networking API enablement successful:', stdout);
                      }
                    });
                  } catch (manualError) {
                    console.log('Manual Service Networking API enablement error:', manualError);
                  }
                  
                  // Also try to enable in the target project if different
                  if (actualProjectId !== tfvars.project_id) {
                    console.log(`Also enabling Service Networking API in target project: ${tfvars.project_id}...`);
                    try {
                      const enableTargetCommand = `gcloud services enable servicenetworking.googleapis.com --project=${tfvars.project_id}`;
                      exec(enableTargetCommand, (error, stdout, stderr) => {
                        if (error) {
                          console.log('Manual Service Networking API enablement in target project failed:', error.message);
                        } else {
                          console.log('Manual Service Networking API enablement in target project successful:', stdout);
                        }
                      });
                    } catch (manualError) {
                      console.log('Manual Service Networking API enablement in target project error:', manualError);
                    }
                  }
                  
                  setTimeout(async () => {
                    try {
                      const result = await executeTerraform(terraformDir, attempt + 1);
                      resolveExec(result);
                    } catch (retryError) {
                      rejectExec(retryError);
                    }
                  }, waitTime * 1000);
                  return;
                }
                
                rejectExec(new Error(`Infrastructure creation failed: ${phase2Error.message}`));
                return;
              }
              
              console.log('Phase 2 completed successfully');
              
              // Parse outputs
              const outputCommand = 'terraform output -json';
              exec(outputCommand, { cwd: terraformDir }, (outputError, outputStdout, outputStderr) => {
                if (outputError) {
                  console.log('Output parsing error:', outputError.message);
                  console.log('Output stderr:', outputStderr);
                  
                  // If output parsing fails but Phase 2 succeeded, create a basic result
                  console.log('Creating fallback result since infrastructure was created successfully');
                  const fallbackResult: TerraformOutput = {
                    success: true,
                    vpc_name: 'producer-vpc',
                    subnet_name: 'producer-subnet',
                    psc_ip_range: '',
                    psc_ip_range_name: 'psc-ip-range',
                    vpc_self_link: '',
                    subnet_self_link: '',
                    project_id: tfvars.project_id,
                    apis_enabled: {}
                  };
                  
                  console.log('Resolving with fallback result:', JSON.stringify(fallbackResult, null, 2));
                  resolveExec(fallbackResult);
                  return;
                }
                
                try {
                  const outputs = JSON.parse(outputStdout);
                  console.log('Terraform outputs:', outputs);
                  
                  const result: TerraformOutput = {
                    success: true,
                    vpc_name: outputs.vpc_name?.value || 'producer-vpc',
                    subnet_name: outputs.subnet_name?.value || 'producer-subnet',
                    psc_ip_range: outputs.psc_ip_range?.value || '',
                    psc_ip_range_name: outputs.psc_ip_range_name?.value || 'psc-ip-range',
                    vpc_self_link: outputs.vpc_self_link?.value || '',
                    subnet_self_link: outputs.subnet_self_link?.value || '',
                    project_id: outputs.project_id?.value || tfvars.project_id,
                    apis_enabled: outputs.apis_enabled?.value || {}
                  };
                  
                  console.log('Terraform execution completed successfully, resolving with result:', JSON.stringify(result, null, 2));
                  resolveExec(result);
                } catch (parseError) {
                  console.log('Output parsing failed:', parseError);
                  
                  // If JSON parsing fails but Phase 2 succeeded, create a basic result
                  console.log('Creating fallback result since infrastructure was created successfully');
                  const fallbackResult: TerraformOutput = {
                    success: true,
                    vpc_name: 'producer-vpc',
                    subnet_name: 'producer-subnet',
                    psc_ip_range: '',
                    psc_ip_range_name: 'psc-ip-range',
                    vpc_self_link: '',
                    subnet_self_link: '',
                    project_id: tfvars.project_id,
                    apis_enabled: {}
                  };
                  
                  console.log('Resolving with fallback result:', JSON.stringify(fallbackResult, null, 2));
                  resolveExec(fallbackResult);
                }
              });
            });
          } catch (phase2Error) {
            rejectExec(phase2Error);
          }
        }, 120000); // Wait 120 seconds (2 minutes) for API propagation
      });
      
    } catch (error) {
      console.log('Terraform execution setup error:', error);
      rejectExec(error);
    }
  });
}

export function getTerraformOutput(folder: string): Promise<TerraformOutput> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dir = path.join(__dirname, `../../terraform/${folder}`);
  
  console.log(`🟡 OUTPUT CHECKPOINT 1: Getting Terraform outputs for folder: ${folder}`);
  console.log('Output directory:', dir);
  
  return new Promise((resolve, reject) => {
    console.log('🟡 OUTPUT CHECKPOINT 2: Running terraform output -json');
    exec('terraform output -json', { cwd: dir }, (error, stdout, stderr) => {
      if (error) {
        console.log('🔴 OUTPUT CHECKPOINT ERROR: Failed to get Terraform outputs');
        console.error('Error getting outputs:', error);
        console.error('stderr:', stderr);
        return reject(new Error(stderr || error.message));
      }
      
      console.log('🟡 OUTPUT CHECKPOINT 3: Parsing Terraform outputs');
      try {
        const rawOutput = JSON.parse(stdout);
        console.log('Raw Terraform output:', JSON.stringify(rawOutput, null, 2));
        
        // Convert the raw Terraform output format to our interface
        const output: TerraformOutput = {
          success: true,
          vpc_name: rawOutput.vpc_name?.value || '',
          subnet_name: rawOutput.subnet_name?.value || '',
          psc_ip_range: rawOutput.psc_ip_range?.value || '',
          psc_ip_range_name: rawOutput.psc_ip_range_name?.value || '',
          vpc_self_link: rawOutput.vpc_self_link?.value || '',
          subnet_self_link: rawOutput.subnet_self_link?.value || '',
          project_id: rawOutput.project_id?.value || '',
          apis_enabled: rawOutput.apis_enabled?.value || {},
          // SQL-specific outputs
          region: rawOutput.region?.value || '',
          instance_name: rawOutput.instance_name?.value || '',
          instance_connection_name: rawOutput.instance_connection_name?.value || '',
          private_ip_address: rawOutput.private_ip_address?.value || '',
          database_name: rawOutput.database_name?.value || '',
          user_name: rawOutput.user_name?.value || '',
          allowed_consumer_project_id: rawOutput.allowed_consumer_project_id?.value || ''
        };
        
        console.log('🟢 OUTPUT CHECKPOINT 4: Terraform outputs parsed successfully');
        console.log('Parsed output:', JSON.stringify(output, null, 2));
        resolve(output);
      } catch (parseError) {
        console.log('🔴 OUTPUT CHECKPOINT ERROR: Failed to parse Terraform output');
        console.error('Parse error:', parseError);
        reject(new Error('Failed to parse Terraform output'));
      }
    });
  });
}

export function destroyTerraform(folder: string): Promise<string> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dir = path.join(__dirname, `../../terraform/${folder}`);
  
  return new Promise((resolve, reject) => {
    exec('terraform destroy -auto-approve', { cwd: dir }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve(stdout);
    });
  });
}

export function runTerraform(folder: string, variables?: TerraformVariables): Promise<string> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dir = path.join(__dirname, `../../terraform/${folder}`);
  
  return new Promise(async (resolve, reject) => {
    console.log('🟡 TERRAFORM CHECKPOINT 1: Starting Terraform execution');
    // Debug environment variables
    console.log('Terraform execution environment:');
    console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log('Working directory:', dir);
    
    // Create terraform.tfvars.json if variables are provided
    if (variables) {
      console.log('🟡 TERRAFORM CHECKPOINT 2: Creating terraform.tfvars.json');
      const tfvarsPath = path.join(dir, 'terraform.tfvars.json');
      fs.writeFileSync(tfvarsPath, JSON.stringify(variables, null, 2));
      console.log(`terraform.tfvars.json written to ${tfvarsPath}`);
    }
    
    console.log('🟡 TERRAFORM CHECKPOINT 3: Starting Terraform execution in directory:', dir);
    
    // Function to execute Terraform with retry logic
    const executeTerraformWithRetry = async (attempt: number = 1): Promise<string> => {
      return new Promise((resolveExec, rejectExec) => {
        console.log(`🟡 TERRAFORM CHECKPOINT 4: Executing Terraform (attempt ${attempt})`);
        // Set longer timeout for SQL operations
        const isSqlModule = folder === 'create-sql';
        const timeoutMinutes = isSqlModule ? 45 : 15; // 45 minutes for SQL, 15 for others
        console.log(`Timeout set to ${timeoutMinutes} minutes for ${isSqlModule ? 'SQL' : 'standard'} module`);
        
        console.log('🟡 TERRAFORM CHECKPOINT 5: Running terraform init && terraform apply -auto-approve');
        const terraformProcess = exec('terraform init && terraform apply -auto-approve', { 
          cwd: dir,
          env: {
            ...process.env,
            GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS
          }
        }, (error, stdout, stderr) => {
          if (error) {
            console.log(`🔴 TERRAFORM CHECKPOINT ERROR: Terraform execution failed (attempt ${attempt})`);
            console.error(`Terraform execution error (attempt ${attempt}):`, error);
            console.error('Terraform stderr:', stderr);
            
            // Check if it's an API enablement error that might resolve with retry
            const isApiError = stderr.includes('SERVICE_DISABLED') || 
                             stderr.includes('API has not been used') || 
                             stderr.includes('wait a few minutes') ||
                             stderr.includes('Cloud Resource Manager API has not been used') ||
                             stderr.includes('accessNotConfigured');
            
            // Check if it's a PSC enablement error for SQL module
            const isPscError = isSqlModule && (
              stderr.includes('Failed to enable Private Service Connect') ||
              stderr.includes('PSC') ||
              stderr.includes('private service connect')
            );
            
            // Check if it's a PSC timeout error (which is expected and shouldn't retry)
            const isPscTimeoutError = isSqlModule && (
              stderr.includes('Operation is taking longer than expected') ||
              stderr.includes('timeout') ||
              stderr.includes('wait for the operation')
            );
            
            // Check if it's a successful PSC operation submission (not an error)
            const isPscSuccess = isSqlModule && (
              stderr.includes('PSC enablement command submitted successfully') ||
              stderr.includes('operation is now running in the background') ||
              stderr.includes('PSC operation was submitted successfully but gcloud timed out') ||
              stderr.includes('operation is running in the background and will complete automatically')
            );
            
            console.log(`API error detection: ${isApiError ? 'YES' : 'NO'}`);
            console.log(`PSC error detection: ${isPscError ? 'YES' : 'NO'}`);
            console.log(`PSC timeout error detection: ${isPscTimeoutError ? 'YES' : 'NO'}`);
            console.log(`PSC success detection: ${isPscSuccess ? 'YES' : 'NO'}`);
            
            // Don't retry on PSC timeout errors - the operation is likely still in progress
            if (isPscTimeoutError) {
              console.log('🟡 PSC timeout detected - operation is likely still in progress, not retrying');
              return rejectExec(new Error('PSC operation is taking longer than expected but was submitted successfully'));
            }
            
            // Don't retry on successful PSC submission - the operation was submitted successfully
            if (isPscSuccess) {
              console.log('🟢 PSC operation submitted successfully - not retrying');
              return rejectExec(new Error('PSC operation submitted successfully and is running in background'));
            }
            
            if ((isApiError || isPscError) && attempt < 3) {
              const waitTime = isSqlModule ? attempt * 300 : attempt * 120; // 5min/10min/15min for SQL, 2min/4min/6min for others
              console.log(`🟡 TERRAFORM CHECKPOINT RETRY: Error detected. Retrying in ${waitTime} seconds... (attempt ${attempt}/3)`);
              
              setTimeout(async () => {
                try {
                  const result = await executeTerraformWithRetry(attempt + 1);
                  resolveExec(result);
                } catch (retryError) {
                  rejectExec(retryError);
                }
              }, waitTime * 1000);
              return;
            }
            
            return rejectExec(new Error(stderr || error.message));
          }
          console.log('🟢 TERRAFORM CHECKPOINT 6: Terraform execution completed successfully');
          console.log('Terraform stdout:', stdout);
          resolveExec(stdout);
        });
        
        // Add timeout handling
        const timeout = setTimeout(() => {
          console.log(`🔴 TERRAFORM CHECKPOINT TIMEOUT: Terraform execution timed out after ${timeoutMinutes} minutes, killing process...`);
          terraformProcess.kill('SIGKILL'); // Force kill the process
          rejectExec(new Error(`Terraform execution timed out after ${timeoutMinutes} minutes`));
        }, timeoutMinutes * 60 * 1000); // Dynamic timeout based on module

        terraformProcess.on('exit', (code, signal) => {
          console.log(`🟡 TERRAFORM CHECKPOINT EXIT: Terraform process exited with code ${code} and signal ${signal}`);
          clearTimeout(timeout);
        });

        terraformProcess.on('error', (err) => {
          console.error('🔴 TERRAFORM CHECKPOINT PROCESS ERROR: Terraform process error:', err);
          clearTimeout(timeout);
          rejectExec(new Error(`Terraform process error: ${err.message}`));
        });
      });
    };
    
    try {
      console.log('🟡 TERRAFORM CHECKPOINT 7: Starting Terraform execution with retry logic');
      const result = await executeTerraformWithRetry();
      console.log('🟢 TERRAFORM CHECKPOINT 8: Terraform execution completed successfully');
      resolve(result);
    } catch (error) {
      console.log('🔴 TERRAFORM CHECKPOINT 9: Terraform execution failed');
      reject(error);
    }
  });
} 