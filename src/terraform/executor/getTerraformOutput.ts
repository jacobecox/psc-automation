import { exec } from 'child_process';
import { TerraformOutput } from './types.js';
import util from 'util';

const execAsync = util.promisify(exec);

export async function getTerraformOutput(terraformDir: string): Promise<TerraformOutput> {
  console.log(`Getting Terraform outputs from: ${terraformDir}`);
  
  try {
    const { stdout } = await execAsync('terraform output -json', { cwd: terraformDir });
    const outputs = JSON.parse(stdout);
    console.log('Terraform outputs:', outputs);
    
    // Transform the outputs to match our interface
    const result: TerraformOutput = {
      project_id: outputs.project_id?.value || '',
      region: outputs.region?.value,
      zone: outputs.zone?.value,
      vpc_name: outputs.vpc_name?.value,
      subnet_name: outputs.subnet_name?.value,
      vm_subnet_name: outputs.vm_subnet_name?.value,
      psc_subnet_name: outputs.psc_subnet_name?.value,
      instance_name: outputs.instance_name?.value,
      port: outputs.port?.value,
      instance_group_name: outputs.instance_group_name?.value,
      backend_service_name: outputs.backend_service_name?.value,
      health_check_name: outputs.health_check_name?.value,
      forwarding_rule_name: outputs.forwarding_rule_name?.value,
      service_attachment_name: outputs.service_attachment_name?.value,
      service_attachment_uri: outputs.service_attachment_uri?.value,
      allowed_consumer_project_ids: outputs.allowed_consumer_project_ids?.value,
      instance_connection_name: outputs.instance_connection_name?.value,
      private_ip_address: outputs.private_ip_address?.value,
      database_name: outputs.database_name?.value,
      user_name: outputs.user_name?.value,
      vm_instance_name: outputs.vm_instance_name?.value,
      vm_internal_ip: outputs.vm_internal_ip?.value,
      psc_ip_range: outputs.psc_ip_range?.value,
      psc_ip_range_name: outputs.psc_ip_range_name?.value,
      vpc_self_link: outputs.vpc_self_link?.value,
      vm_subnet_self_link: outputs.vm_subnet_self_link?.value,
      psc_subnet_self_link: outputs.psc_subnet_self_link?.value,
    };
    
    return result;
  } catch (error) {
    console.error('Error getting Terraform outputs:', error);
    throw error;
  }
} 