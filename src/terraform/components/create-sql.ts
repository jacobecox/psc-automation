import { executeTerraform, TerraformConfig } from '../executor/index.js';
import path from 'path';

export async function createSql(params: {
  projectId: string;
  region: string;
  instanceId?: string;
  defaultPassword?: string;
  allowedConsumerProjectIds: string[];
  producerVpcName?: string;
  producerSubnetName?: string;
}): Promise<any> {
  const {
    projectId,
    region,
    instanceId,
    defaultPassword,
    allowedConsumerProjectIds,
    producerVpcName,
    producerSubnetName
  } = params;

  const config: TerraformConfig = {
    terraformDir: path.resolve(process.cwd(), 'terraform/create-sql'),
    tfVars: {
      project_id: projectId,
      region: region,
      allowed_consumer_project_ids: allowedConsumerProjectIds,
      ...(instanceId && { instance_id: instanceId }),
      ...(defaultPassword && { default_password: defaultPassword }),
      ...(producerVpcName && { producer_vpc_name: producerVpcName }),
      ...(producerSubnetName && { producer_subnet_name: producerSubnetName })
    },
    enableApis: false, // APIs already enabled by previous modules
    retryPolicy: {
      maxAttempts: 3,
      waitSeconds: 60
    }
  };

  return await executeTerraform(config);
} 