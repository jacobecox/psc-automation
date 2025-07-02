import { executeTerraform, TerraformConfig } from '../executor/index.js';
import path from 'path';

export async function createSql(params: {
  projectId: string;
  region: string;
  instanceId?: string;
  defaultPassword?: string;
  allowedConsumerProjectIds: string[];
  producerVpcSelfLink: string;
  producerSubnetSelfLink: string;
}): Promise<any> {
  const {
    projectId,
    region,
    instanceId,
    defaultPassword,
    allowedConsumerProjectIds,
    producerVpcSelfLink,
    producerSubnetSelfLink
  } = params;

  const config: TerraformConfig = {
    terraformDir: path.resolve(process.cwd(), 'terraform/create-sql'),
    tfVars: {
      project_id: projectId,
      region: region,
      allowed_consumer_project_ids: allowedConsumerProjectIds,
      producer_vpc_self_link: producerVpcSelfLink,
      producer_subnet_self_link: producerSubnetSelfLink,
      ...(instanceId && { instance_id: instanceId }),
      ...(defaultPassword && { default_password: defaultPassword })
    },
    enableApis: false, // APIs already enabled by previous modules
    retryPolicy: {
      maxAttempts: 3,
      waitSeconds: 60
    }
  };

  return await executeTerraform(config);
} 