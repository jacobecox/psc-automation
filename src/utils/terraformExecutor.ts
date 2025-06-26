import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

export interface TerraformVariables {
  [key: string]: string | number | boolean;
}

export interface TerraformOutput {
  producer_project_id?: string;
  region?: string;
  zone?: string;
  vpc_name?: string;
  subnet_name?: string;
  instance_name?: string;
  port?: number;
  instance_group_name?: string;
  backend_service_name?: string;
  health_check_name?: string;
  forwarding_rule_name?: string;
  service_attachment_name?: string;
  service_attachment_uri?: string;
  allowed_consumer_project_id?: string;
  consumer_project_id?: string;
  instance_connection_name?: string;
  private_ip_address?: string;
  database_name?: string;
  user_name?: string;
  vm_instance_name?: string;
  vm_internal_ip?: string;
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
      
      // Set default values for environment variables
      const defaultVars = {
        producer_project_id: process.env.TF_VAR_producer_project_id || 'producer-test-project',
        region: process.env.TF_VAR_region || 'us-central1',
        zone: process.env.TF_VAR_zone || 'us-central1-a',
        vpc_name: process.env.TF_VAR_vpc_name || 'producer-vpc',
        subnet_name: process.env.TF_VAR_subnet_name || 'producer-subnet',
        instance_name: process.env.TF_VAR_instance_name || 'producer-instance',
        port: process.env.TF_VAR_port || 8080,
        instance_group_name: process.env.TF_VAR_instance_group_name || 'producer-group',
        backend_service_name: process.env.TF_VAR_backend_service_name || 'producer-backend',
        health_check_name: process.env.TF_VAR_health_check_name || 'tcp-hc',
        forwarding_rule_name: process.env.TF_VAR_forwarding_rule_name || 'producer-forwarding-rule',
        service_attachment_name: process.env.TF_VAR_service_attachment_name || 'producer-attachment',
        consumer_project_id: process.env.TF_VAR_consumer_project_id || 'consumer-test-project-463821',
        allowed_consumer_project_id: process.env.TF_VAR_allowed_consumer_project_id || 'consumer-test-project-463821'
      };
      
      // Determine which variables to include based on the Terraform directory
      let tfvars: any = {
        ...defaultVars
      };
      
      if (terraformDir.includes('consumer')) {
        // Consumer-specific variables
        tfvars = {
          ...tfvars,
          psc_endpoint_name: 'psc-endpoint',
          service_attachment_uri: process.env.TF_VAR_service_attachment_uri || ''
        };
      } else if (terraformDir.includes('create-vm')) {
        // Create-vm specific variables - only include what's declared in variables.tf
        tfvars = {
          consumer_project_id: tfvars.consumer_project_id,
          region: tfvars.region,
          instance_name: tfvars.instance_name,
          machine_type: tfvars.machine_type,
          os_image: tfvars.os_image
        };
      }
      
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
          
          // Determine the target project based on the Terraform directory
          let targetProject;
          if (terraformDir.includes('create-vm') || terraformDir.includes('consumer')) {
            targetProject = tfvars.consumer_project_id;
          } else {
            targetProject = tfvars.producer_project_id;
          }
          
          console.log(`Target project: ${targetProject}`);
          
          if (gcloudProject !== targetProject) {
            console.log('WARNING: gcloud default project differs from target project!');
            console.log('This might cause API enablement issues.');
          }
        }
      });
      
      // Switch gcloud project to match target project
      let targetProject;
      if (terraformDir.includes('create-vm') || terraformDir.includes('consumer')) {
        targetProject = tfvars.consumer_project_id;
      } else {
        targetProject = tfvars.producer_project_id;
      }
      
      console.log(`Switching gcloud project to: ${targetProject}`);
      
      // Make gcloud project switching synchronous
      await new Promise<void>((resolve, reject) => {
        exec(`gcloud config set project ${targetProject}`, (error, stdout, stderr) => {
          if (error) {
            console.log('Failed to switch gcloud project:', error.message);
            reject(error);
          } else {
            console.log(`✅ gcloud project switched to: ${targetProject}`);
            resolve();
          }
        });
      });
      
      // Verify the project was switched correctly
      await new Promise<void>((resolve) => {
        exec('gcloud config get-value project', (error, stdout, stderr) => {
          if (error) {
            console.log('Could not verify gcloud project:', error.message);
          } else {
            const currentProject = stdout.trim();
            console.log(`Verified gcloud project is now: ${currentProject}`);
            if (currentProject !== targetProject) {
              console.log('⚠️ WARNING: gcloud project verification failed!');
            }
          }
          resolve();
        });
      });
      
      // Phase 1: Enable APIs only (skip for create-vm)
      if (terraformDir.includes('create-vm')) {
        console.log('Skipping API enablement for create-vm module (APIs already enabled by consumer route)');
        console.log('Phase 2: Creating VM infrastructure...');
      } else {
        console.log('Phase 1: Enabling required APIs...');
        
        // Determine which APIs to target based on the Terraform directory
        let apiTargets = '';
        if (terraformDir.includes('consumer')) {
          // Consumer only needs cloud_resource_manager and compute_engine
          apiTargets = '-target=google_project_service.cloud_resource_manager -target=google_project_service.compute_engine';
        } else if (terraformDir.includes('producer-managed')) {
          // Producer-managed needs all APIs
          apiTargets = '-target=google_project_service.cloud_resource_manager -target=google_project_service.sql_admin -target=google_project_service.compute_engine -target=google_project_service.service_networking';
        } else {
          // Default fallback - try to target all common APIs
          apiTargets = '-target=google_project_service.cloud_resource_manager -target=google_project_service.compute_engine';
        }
        
        const phase1Command = apiTargets 
          ? `terraform init && terraform apply -auto-approve ${apiTargets}`
          : 'terraform init && terraform apply -auto-approve';
        
        exec(phase1Command, { 
          cwd: terraformDir,
          env: { 
            ...process.env, 
            ...(terraformDir.includes('consumer') 
              ? {
                  TF_VAR_project_id: tfvars.consumer_project_id,
                  TF_VAR_region: tfvars.region
                }
              : {
                  TF_VAR_producer_project_id: tfvars.producer_project_id,
                  TF_VAR_region: tfvars.region
                }
            )
          }
        }, async (error, stdout, stderr) => {
          console.log('=== TERRAFORM PHASE 1 EXECUTION ===');
          console.log('Command executed:', phase1Command);
          console.log('Working directory:', terraformDir);
          console.log('Environment variables:', terraformDir.includes('consumer')
            ? {
                TF_VAR_project_id: tfvars.consumer_project_id,
                TF_VAR_region: tfvars.region
              }
            : {
                TF_VAR_producer_project_id: tfvars.producer_project_id,
                TF_VAR_region: tfvars.region
              }
          );
          console.log('stdout:', stdout);
          console.log('stderr:', stderr);
          
          if (error) {
            console.log(`Terraform execution error (attempt ${attempt}):`, error.message);
            console.log('Terraform stderr:', stderr);
            
            // Check if this is a permission/authentication error
            const isPermissionError = stderr.includes('Permission denied') || 
                                     stderr.includes('AUTH_PERMISSION_DENIED') ||
                                     stderr.includes('403') ||
                                     stderr.includes('forbidden') ||
                                     stderr.includes('not authorized') ||
                                     stderr.includes('insufficient permissions');
            
            if (isPermissionError) {
              console.log('🔴 PERMISSION ERROR DETECTED');
              console.log('The service account does not have sufficient permissions to enable APIs or manage resources in this project.');
              console.log('');
              console.log('To resolve this issue, please run the following command to grant the necessary permissions:');
              console.log('');
              const projectId = terraformDir.includes('consumer') ? tfvars.consumer_project_id : tfvars.producer_project_id;
              console.log(`gcloud projects add-iam-policy-binding ${projectId} \\`);
              console.log('  --member="serviceAccount:central-service-account@admin-project-463522.iam.gserviceaccount.com" \\');
              console.log('  --role="roles/editor"');
              console.log('');
              console.log('Or run the provided script:');
              console.log(`./grant-permissions.sh ${projectId}`);
              console.log('');
              console.log('After granting permissions, try the deployment again.');
              console.log('');
              
              rejectExec(new Error(`Permission denied: Service account lacks sufficient permissions to manage project ${projectId}. Please grant the service account 'roles/editor' permission and try again.`));
              return;
            }
            
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
                  const projectId = terraformDir.includes('consumer') ? tfvars.consumer_project_id : tfvars.producer_project_id;
                  const enableCommand = `gcloud services enable compute.googleapis.com --project=${projectId}`;
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
                env: { 
                  ...process.env, 
                  ...(terraformDir.includes('consumer')
                    ? {
                        TF_VAR_project_id: tfvars.consumer_project_id,
                        TF_VAR_region: tfvars.region
                      }
                    : {
                        TF_VAR_producer_project_id: tfvars.producer_project_id,
                        TF_VAR_region: tfvars.region
                      }
                  )
                }
              }, (phase2Error, phase2Stdout, phase2Stderr) => {
                if (phase2Error) {
                  console.log('Phase 2 error:', phase2Error.message);
                  console.log('Phase 2 stderr:', phase2Stderr);
                  
                  // Check if this is a permission/authentication error in Phase 2
                  const isPhase2PermissionError = phase2Stderr.includes('Permission denied') || 
                                                 phase2Stderr.includes('AUTH_PERMISSION_DENIED') ||
                                                 phase2Stderr.includes('403') ||
                                                 phase2Stderr.includes('forbidden') ||
                                                 phase2Stderr.includes('not authorized') ||
                                                 phase2Stderr.includes('insufficient permissions');
                  
                  if (isPhase2PermissionError) {
                    console.log('🔴 PERMISSION ERROR DETECTED IN PHASE 2');
                    console.log('The service account does not have sufficient permissions to create infrastructure in this project.');
                    console.log('');
                    console.log('To resolve this issue, please run the following command to grant the necessary permissions:');
                    console.log('');
                    const projectId = terraformDir.includes('consumer') ? tfvars.consumer_project_id : tfvars.producer_project_id;
                    console.log(`gcloud projects add-iam-policy-binding ${projectId} \\`);
                    console.log('  --member="serviceAccount:central-service-account@admin-project-463522.iam.gserviceaccount.com" \\');
                    console.log('  --role="roles/editor"');
                    console.log('');
                    console.log('Or run the provided script:');
                    console.log(`./grant-permissions.sh ${projectId}`);
                    console.log('');
                    console.log('After granting permissions, try the deployment again.');
                    console.log('');
                    
                    rejectExec(new Error(`Permission denied in infrastructure creation: Service account lacks sufficient permissions to manage project ${projectId}. Please grant the service account 'roles/editor' permission and try again.`));
                    return;
                  }
                  
                  // Check if this is a Service Networking API propagation error
                  const isServiceNetworkingError = phase2Stderr.includes('Service Networking API has not been used') ||
                                                 phase2Stderr.includes('servicenetworking.googleapis.com') ||
                                                 phase2Stderr.includes('wait a few minutes for the action to propagate');
                  
                  if (isServiceNetworkingError && attempt < 3) {
                    const waitTime = 180; // 3 minutes for Service Networking API propagation
                    console.log(`Service Networking API propagation error detected. Retrying in ${waitTime} seconds... (attempt ${attempt}/3)`);
                    
                    // Extract the actual project ID from the error message
                    const projectMatch = phase2Stderr.match(/project (\d+)/);
                    const projectId = terraformDir.includes('consumer') ? tfvars.consumer_project_id : tfvars.producer_project_id;
                    const actualProjectId = projectMatch ? projectMatch[1] : projectId;
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
                    if (actualProjectId !== projectId) {
                      console.log(`Also enabling Service Networking API in target project: ${projectId}...`);
                      try {
                        const enableTargetCommand = `gcloud services enable servicenetworking.googleapis.com --project=${projectId}`;
                        exec(enableTargetCommand, (error, stdout, stderr) => {
                          if (error) {
                            console.log('Manual target Service Networking API enablement failed:', error.message);
                          } else {
                            console.log('Manual target Service Networking API enablement successful:', stdout);
                          }
                        });
                      } catch (manualError) {
                        console.log('Manual target Service Networking API enablement error:', manualError);
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
                  
                  rejectExec(new Error(`Phase 2 failed: ${phase2Error.message}`));
                  return;
                }
                
                console.log('Phase 2 completed successfully');
                
                // Get Terraform outputs
                try {
                  console.log('Getting Terraform outputs...');
                  exec('terraform output -json', { cwd: terraformDir }, (outputError, outputStdout, outputStderr) => {
                    if (outputError) {
                      console.log('Output parsing error:', outputError.message);
                      console.log('Output stderr:', outputStderr);
                      
                      // If output parsing fails but Phase 2 succeeded, create a basic result
                      console.log('Creating fallback result since infrastructure was created successfully');
                      const projectId = terraformDir.includes('consumer') ? tfvars.consumer_project_id : tfvars.producer_project_id;
                      const fallbackResult: TerraformOutput = {
                        ...(terraformDir.includes('consumer') 
                          ? { consumer_project_id: projectId }
                          : { producer_project_id: projectId }
                        ),
                        vpc_name: terraformDir.includes('consumer') ? 'consumer-vpc' : 'producer-vpc',
                        subnet_name: terraformDir.includes('consumer') ? 'vm-subnet' : 'producer-subnet',
                        region: tfvars.region
                      };
                      
                      console.log('Resolving with fallback result:', JSON.stringify(fallbackResult, null, 2));
                      resolveExec(fallbackResult);
                      return;
                    }
                    
                    try {
                      const outputs = JSON.parse(outputStdout);
                      console.log('Terraform outputs:', outputs);
                      
                      const projectId = terraformDir.includes('consumer') ? tfvars.consumer_project_id : tfvars.producer_project_id;
                      const result: TerraformOutput = {
                        ...(terraformDir.includes('consumer') 
                          ? { consumer_project_id: outputs.consumer_project_id?.value || projectId }
                          : { producer_project_id: outputs.producer_project_id?.value || projectId }
                        ),
                        vpc_name: outputs.vpc_name?.value || (terraformDir.includes('consumer') ? 'consumer-vpc' : 'producer-vpc'),
                        subnet_name: outputs.subnet_name?.value || (terraformDir.includes('consumer') ? 'vm-subnet' : 'producer-subnet'),
                        region: outputs.region?.value || tfvars.region
                      };
                      
                      console.log('Terraform execution completed successfully, resolving with result:', JSON.stringify(result, null, 2));
                      resolveExec(result);
                    } catch (parseError) {
                      console.log('Output parsing failed:', parseError);
                      
                      // If JSON parsing fails but Phase 2 succeeded, create a basic result
                      console.log('Creating fallback result since infrastructure was created successfully');
                      const projectId = terraformDir.includes('consumer') ? tfvars.consumer_project_id : tfvars.producer_project_id;
                      const fallbackResult: TerraformOutput = {
                        ...(terraformDir.includes('consumer') 
                          ? { consumer_project_id: projectId }
                          : { producer_project_id: projectId }
                        ),
                        vpc_name: terraformDir.includes('consumer') ? 'consumer-vpc' : 'producer-vpc',
                        subnet_name: terraformDir.includes('consumer') ? 'vm-subnet' : 'producer-subnet',
                        region: tfvars.region
                      };
                      
                      console.log('Resolving with fallback result:', JSON.stringify(fallbackResult, null, 2));
                      resolveExec(fallbackResult);
                    }
                  });
                } catch (outputError) {
                  console.log('Output retrieval error:', outputError);
                  rejectExec(outputError);
                }
              });
            } catch (phase2Error) {
              rejectExec(phase2Error);
            }
          }, 120000); // Wait 120 seconds (2 minutes) for API propagation
        });
        
        return; // Exit early for non-create-vm modules
      }
      
      // For create-vm, go directly to Phase 2
      console.log('Phase 2: Creating VM infrastructure...');
      const phase2Command = 'terraform init && terraform apply -auto-approve';
      
      exec(phase2Command, { 
        cwd: terraformDir,
        env: { 
          ...process.env, 
          TF_VAR_consumer_project_id: tfvars.consumer_project_id,
          TF_VAR_region: tfvars.region,
          TF_VAR_instance_name: tfvars.instance_name,
          TF_VAR_machine_type: tfvars.machine_type,
          TF_VAR_os_image: tfvars.os_image
        }
      }, (phase2Error, phase2Stdout, phase2Stderr) => {
        if (phase2Error) {
          console.log('Phase 2 error:', phase2Error.message);
          console.log('Phase 2 stderr:', phase2Stderr);
          
          // Check if this is a permission/authentication error in Phase 2
          const isPhase2PermissionError = phase2Stderr.includes('Permission denied') || 
                                         phase2Stderr.includes('AUTH_PERMISSION_DENIED') ||
                                         phase2Stderr.includes('403') ||
                                         phase2Stderr.includes('forbidden') ||
                                         phase2Stderr.includes('not authorized') ||
                                         phase2Stderr.includes('insufficient permissions');
          
          if (isPhase2PermissionError) {
            console.log('🔴 PERMISSION ERROR DETECTED IN PHASE 2');
            console.log('The service account does not have sufficient permissions to create VM infrastructure in this project.');
            console.log('');
            console.log('To resolve this issue, please run the following command to grant the necessary permissions:');
            console.log('');
            console.log(`gcloud projects add-iam-policy-binding ${tfvars.consumer_project_id} \\`);
            console.log('  --member="serviceAccount:central-service-account@admin-project-463522.iam.gserviceaccount.com" \\');
            console.log('  --role="roles/editor"');
            console.log('');
            console.log('Or run the provided script:');
            console.log(`./grant-permissions.sh ${tfvars.consumer_project_id}`);
            console.log('');
            console.log('After granting permissions, try the deployment again.');
            console.log('');
            
            rejectExec(new Error(`Permission denied in VM creation: Service account lacks sufficient permissions to manage project ${tfvars.consumer_project_id}. Please grant the service account 'roles/editor' permission and try again.`));
            return;
          }
          
          rejectExec(new Error(`Phase 2 failed: ${phase2Error.message}`));
          return;
        }
        
        console.log('Phase 2 completed successfully');
        
        // Get Terraform outputs
        try {
          console.log('Getting Terraform outputs...');
          exec('terraform output -json', { cwd: terraformDir }, (outputError, outputStdout, outputStderr) => {
            if (outputError) {
              console.log('Output parsing error:', outputError.message);
              console.log('Output stderr:', outputStderr);
              
              // If output parsing fails but Phase 2 succeeded, create a basic result
              console.log('Creating fallback result since VM was created successfully');
              const fallbackResult: TerraformOutput = {
                consumer_project_id: tfvars.consumer_project_id,
                vpc_name: 'consumer-vpc',
                subnet_name: 'vm-subnet',
                region: tfvars.region,
                instance_name: tfvars.instance_name,
                zone: `${tfvars.region}-a`,
                vm_internal_ip: ''
              };
              
              console.log('Resolving with fallback result:', JSON.stringify(fallbackResult, null, 2));
              resolveExec(fallbackResult);
              return;
            }
            
            try {
              const outputs = JSON.parse(outputStdout);
              console.log('Terraform outputs:', outputs);
              
              const result: TerraformOutput = {
                consumer_project_id: outputs.consumer_project_id?.value || tfvars.consumer_project_id,
                vpc_name: outputs.vpc_name?.value || 'consumer-vpc',
                subnet_name: outputs.subnet_name?.value || 'vm-subnet',
                region: outputs.region?.value || tfvars.region,
                instance_name: outputs.instance_name?.value || tfvars.instance_name,
                zone: outputs.zone?.value || `${tfvars.region}-a`,
                vm_internal_ip: outputs.internal_ip?.value || ''
              };
              
              console.log('Terraform execution completed successfully, resolving with result:', JSON.stringify(result, null, 2));
              resolveExec(result);
            } catch (parseError) {
              console.log('Output parsing failed:', parseError);
              
              // If JSON parsing fails but Phase 2 succeeded, create a basic result
              console.log('Creating fallback result since VM was created successfully');
              const fallbackResult: TerraformOutput = {
                consumer_project_id: tfvars.consumer_project_id,
                vpc_name: 'consumer-vpc',
                subnet_name: 'vm-subnet',
                region: tfvars.region,
                instance_name: tfvars.instance_name,
                zone: `${tfvars.region}-a`,
                vm_internal_ip: ''
              };
              
              console.log('Resolving with fallback result:', JSON.stringify(fallbackResult, null, 2));
              resolveExec(fallbackResult);
            }
          });
        } catch (outputError) {
          console.log('Output retrieval error:', outputError);
          rejectExec(outputError);
        }
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
          producer_project_id: rawOutput.producer_project_id?.value || '',
          vpc_name: rawOutput.vpc_name?.value || '',
          subnet_name: rawOutput.subnet_name?.value || '',
          region: rawOutput.region?.value || '',
          zone: rawOutput.zone?.value || '',
          instance_name: rawOutput.instance_name?.value || '',
          port: rawOutput.port?.value || undefined,
          instance_group_name: rawOutput.instance_group_name?.value || '',
          backend_service_name: rawOutput.backend_service_name?.value || '',
          health_check_name: rawOutput.health_check_name?.value || '',
          forwarding_rule_name: rawOutput.forwarding_rule_name?.value || '',
          service_attachment_name: rawOutput.service_attachment_name?.value || '',
          service_attachment_uri: rawOutput.service_attachment_uri?.value || '',
          allowed_consumer_project_id: rawOutput.allowed_consumer_project_id?.value || '',
          consumer_project_id: rawOutput.consumer_project_id?.value || '',
          instance_connection_name: rawOutput.instance_connection_name?.value || '',
          private_ip_address: rawOutput.private_ip_address?.value || '',
          database_name: rawOutput.database_name?.value || '',
          user_name: rawOutput.user_name?.value || '',
          vm_instance_name: rawOutput.vm_instance_name?.value || '',
          vm_internal_ip: rawOutput.vm_internal_ip?.value || ''
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