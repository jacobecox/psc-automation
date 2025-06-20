import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

export interface TerraformVariables {
  [key: string]: string | number | boolean;
}

export interface TerraformOutput {
  [key: string]: {
    value: string | number | boolean | object;
  };
}

// Helper function to wait for a specified time
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function runTerraform(folder: string, variables?: TerraformVariables): Promise<string> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dir = path.join(__dirname, `../../terraform/${folder}`);
  
  return new Promise(async (resolve, reject) => {
    // Debug environment variables
    console.log('Terraform execution environment:');
    console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log('Working directory:', dir);
    
    // Create terraform.tfvars.json if variables are provided
    if (variables) {
      const tfvarsPath = path.join(dir, 'terraform.tfvars.json');
      fs.writeFileSync(tfvarsPath, JSON.stringify(variables, null, 2));
      console.log(`terraform.tfvars.json written to ${tfvarsPath}`);
    }
    
    console.log('Starting Terraform execution in directory:', dir);
    
    // Function to execute Terraform with retry logic
    const executeTerraform = async (attempt: number = 1): Promise<string> => {
      return new Promise((resolveExec, rejectExec) => {
        const terraformProcess = exec('terraform init && terraform apply -auto-approve', { 
          cwd: dir,
          env: {
            ...process.env,
            GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS
          }
        }, (error, stdout, stderr) => {
          if (error) {
            console.error(`Terraform execution error (attempt ${attempt}):`, error);
            console.error('Terraform stderr:', stderr);
            
            // Check if it's an API enablement error that might resolve with retry
            const isApiError = stderr.includes('SERVICE_DISABLED') || 
                              stderr.includes('API has not been used') ||
                              stderr.includes('wait a few minutes') ||
                              stderr.includes('Cloud Resource Manager API has not been used') ||
                              stderr.includes('accessNotConfigured');
            
            console.log(`API error detection: ${isApiError ? 'YES' : 'NO'}`);
            
            if (isApiError && attempt < 3) {
              const waitTime = attempt * 60; // 60s, 120s, 180s
              console.log(`API enablement error detected. Retrying in ${waitTime} seconds... (attempt ${attempt}/3)`);
              setTimeout(async () => {
                try {
                  const result = await executeTerraform(attempt + 1);
                  resolveExec(result);
                } catch (retryError) {
                  rejectExec(retryError);
                }
              }, waitTime * 1000);
              return;
            }
            
            return rejectExec(new Error(stderr || error.message));
          }
          console.log('Terraform execution completed successfully');
          resolveExec(stdout);
        });

        // Add timeout handling
        const timeout = setTimeout(() => {
          terraformProcess.kill();
          rejectExec(new Error('Terraform execution timed out after 15 minutes'));
        }, 15 * 60 * 1000); // 15 minutes timeout

        terraformProcess.on('exit', () => {
          clearTimeout(timeout);
        });
      });
    };
    
    try {
      const result = await executeTerraform();
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

export function getTerraformOutput(folder: string): Promise<TerraformOutput> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dir = path.join(__dirname, `../../terraform/${folder}`);
  
  return new Promise((resolve, reject) => {
    exec('terraform output -json', { cwd: dir }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      try {
        const output = JSON.parse(stdout);
        resolve(output);
      } catch (parseError) {
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