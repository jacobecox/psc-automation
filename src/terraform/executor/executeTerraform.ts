import { TerraformConfig, TerraformOutput } from './types.js';
import { writeTfVarsFile } from './getTfVars.js';
import { switchGCloudProject } from './switchProject.js';
import { shouldEnableApis } from './enableApis.js';
import { getTerraformOutput } from './getTerraformOutput.js';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);

export async function executeTerraform(config: TerraformConfig): Promise<TerraformOutput> {
  const { 
    terraformDir, 
    tfVars, 
    enableApis = shouldEnableApis(path.basename(terraformDir)), 
    retryPolicy = { maxAttempts: 1, waitSeconds: 60 } 
  } = config;
  
  let attempt = 1;

  console.log(`Starting Terraform execution in directory: ${terraformDir}`);

  // Write terraform.tfvars.json
  writeTfVarsFile(terraformDir, tfVars);
  
  // Switch gcloud project
  switchGCloudProject(tfVars.project_id);

  const runTerraform = async () => {
    const initApply = `terraform init && terraform apply -auto-approve`;
    console.log(`Running: ${initApply}`);
    
    return await execAsync(initApply, {
      cwd: terraformDir,
      env: {
        ...process.env,
        TF_VAR_project_id: tfVars.project_id,
        TF_VAR_region: tfVars.region,
      },
    });
  };

  while (attempt <= retryPolicy.maxAttempts) {
    try {
      if (enableApis) {
        console.log('Enabling APIs and creating infrastructure...');
        try {
          const { stdout } = await runTerraform();
          console.log('Terraform execution completed successfully');
          console.log('Terraform stdout:', stdout);
        } catch (apiError: any) {
          console.error('Terraform execution failed:', apiError.message);
          console.error('Terraform stderr:', apiError.stderr);
          throw apiError;
        }
        
        console.log(`Waiting ${retryPolicy.waitSeconds} seconds for API propagation...`);
        await new Promise(resolve => setTimeout(resolve, retryPolicy.waitSeconds * 1000));
      } else {
        console.log('Creating infrastructure (APIs already enabled)...');
        const { stdout } = await runTerraform();
        console.log('Terraform execution completed successfully');
        console.log('Terraform stdout:', stdout);
      }
      
      // Get and return Terraform outputs
      return await getTerraformOutput(terraformDir);
      
    } catch (err: any) {
      console.error(`Terraform execution failed (attempt ${attempt}):`, err.message);
      
      const isRetryable = err.message.includes('SERVICE_DISABLED') || 
                         err.message.includes('not been used') ||
                         err.message.includes('API has not been used');
      
      if (!isRetryable || attempt === retryPolicy.maxAttempts) {
        throw err;
      }
      
      console.log(`Retrying terraform (attempt ${attempt + 1}/${retryPolicy.maxAttempts})...`);
      attempt++;
      await new Promise(resolve => setTimeout(resolve, retryPolicy.waitSeconds * 1000));
    }
  }
  
  throw new Error('Max retry attempts exceeded');
} 