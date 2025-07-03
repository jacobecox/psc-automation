import { executeTerraform, TerraformConfig } from '../executor/index.js';
import path from 'path';

export async function deployProducerManaged(params: {
  projectId: string;
  region: string;
  allowedConsumerProjectIds: string[];
  internalFirewallSourceRanges?: string[];
  pscIpRangePrefixLength?: number;
}): Promise<any> {
  const {
    projectId,
    region,
    allowedConsumerProjectIds,
    internalFirewallSourceRanges,
    pscIpRangePrefixLength
  } = params;

  const config: TerraformConfig = {
    terraformDir: path.resolve(process.cwd(), 'terraform/producer'),
    tfVars: {
      project_id: projectId,
      region: region,
      allowed_consumer_project_ids: allowedConsumerProjectIds,
      ...(internalFirewallSourceRanges && { internal_firewall_source_ranges: internalFirewallSourceRanges }),
      ...(pscIpRangePrefixLength && { psc_ip_range_prefix_length: pscIpRangePrefixLength })
    },
    enableApis: true,
    retryPolicy: {
      maxAttempts: 3,
      waitSeconds: 60
    }
  };

  return await executeTerraform(config);
} 