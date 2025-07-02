import { executeTerraform, TerraformConfig } from '../executor/index.js';
import path from 'path';

export async function createVm(params: {
  projectId: string;
  region: string;
  consumerVpcName?: string;
  vmSubnetName?: string;
  instanceName?: string;
  machineType?: string;
  osImage?: string;
}): Promise<any> {
  const {
    projectId,
    region,
    consumerVpcName,
    vmSubnetName,
    instanceName = 'consumer-vm',
    machineType = 'e2-micro',
    osImage = 'debian-cloud/debian-12'
  } = params;

  const config: TerraformConfig = {
    terraformDir: path.resolve(process.cwd(), 'terraform/create-vm'),
    tfVars: {
      project_id: projectId,
      region: region,
      instance_name: instanceName,
      machine_type: machineType,
      os_image: osImage,
      ...(consumerVpcName && { consumer_vpc_name: consumerVpcName }),
      ...(vmSubnetName && { vm_subnet_name: vmSubnetName })
    },
    enableApis: false, // APIs already enabled by previous modules
    retryPolicy: {
      maxAttempts: 1,
      waitSeconds: 0
    }
  };

  return await executeTerraform(config);
} 