import { executeTerraform, TerraformConfig } from '../executor/index.js';
import path from 'path';

export async function deployConsumer(params: {
  projectId: string;
  region: string;
  serviceAttachmentUri: string;
  consumerVpcName?: string;
  vmSubnetName?: string;
  pscSubnetName?: string;
  vmSubnetCidrRange?: string;
  pscSubnetCidrRange?: string;
  internalFirewallSourceRanges?: string[];
  postgresEgressDestinationRanges?: string[];
  pscEndpointName?: string;
}): Promise<any> {
  const {
    projectId,
    region,
    serviceAttachmentUri,
    consumerVpcName,
    vmSubnetName,
    pscSubnetName,
    vmSubnetCidrRange,
    pscSubnetCidrRange,
    internalFirewallSourceRanges,
    postgresEgressDestinationRanges,
    pscEndpointName
  } = params;

  const config: TerraformConfig = {
    terraformDir: path.resolve(process.cwd(), 'terraform/consumer'),
    tfVars: {
      project_id: projectId,
      region: region,
      service_attachment_uri: serviceAttachmentUri,
      ...(consumerVpcName && { consumer_vpc_name: consumerVpcName }),
      ...(vmSubnetName && { vm_subnet_name: vmSubnetName }),
      ...(pscSubnetName && { psc_subnet_name: pscSubnetName }),
      ...(vmSubnetCidrRange && { vm_subnet_cidr_range: vmSubnetCidrRange }),
      ...(pscSubnetCidrRange && { psc_subnet_cidr_range: pscSubnetCidrRange }),
      ...(internalFirewallSourceRanges && { internal_firewall_source_ranges: internalFirewallSourceRanges }),
      ...(postgresEgressDestinationRanges && { postgres_egress_destination_ranges: postgresEgressDestinationRanges }),
      ...(pscEndpointName && { psc_endpoint_name: pscEndpointName })
    },
    enableApis: true,
    retryPolicy: {
      maxAttempts: 3,
      waitSeconds: 60
    }
  };

  return await executeTerraform(config);
} 