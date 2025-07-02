import express, { Request, Response, Router } from 'express';
import { deployConsumer } from '../terraform/components/consumer.js';
import { createVm } from '../terraform/components/create-vm.js';

const router: Router = express.Router();
router.use(express.json());

interface ConsumerRequest {
  project_id: string;
  region: string;
  service_attachment_uri: string;
  consumer_vpc_name?: string;
  vm_subnet_name?: string;
  psc_subnet_name?: string;
  vm_subnet_cidr_range?: string;
  psc_subnet_cidr_range?: string;
  internal_firewall_source_ranges?: string[];
  postgres_egress_destination_ranges?: string[];
  instance_name?: string;
  machine_type?: string;
  os_image?: string;
  psc_endpoint_name?: string;
}

interface ConsumerResponse {
  message: string;
  project_id: string;
  region: string;
  infrastructure: any;
  vm?: any;
  error?: string;
}

router.post('/deploy/consumer', async (req: Request, res: Response): Promise<void> => {
  console.log('=== CONSUMER ROUTE ===');
  console.log('Request body:', req.body);

  try {
    const { 
      project_id, 
      region,
      service_attachment_uri,
      consumer_vpc_name,
      vm_subnet_name,
      psc_subnet_name,
      vm_subnet_cidr_range,
      psc_subnet_cidr_range,
      internal_firewall_source_ranges,
      postgres_egress_destination_ranges,
      instance_name,
      machine_type,
      os_image,
      psc_endpoint_name
    } = req.body as ConsumerRequest;

    // Validate required fields
    if (!project_id) {
      res.status(400).json({ error: 'project_id is required' });
      return;
    }

    if (!region) {
      res.status(400).json({ error: 'region is required' });
      return;
    }

    if (!service_attachment_uri) {
      res.status(400).json({ error: 'service_attachment_uri is required' });
      return;
    }

    console.log(`Starting consumer deployment for project: ${project_id} in region: ${region}`);

    // Deploy infrastructure
    const infrastructure = await deployConsumer({
      projectId: project_id,
      region: region,
      serviceAttachmentUri: service_attachment_uri,
      consumerVpcName: consumer_vpc_name,
      vmSubnetName: vm_subnet_name,
      pscSubnetName: psc_subnet_name,
      vmSubnetCidrRange: vm_subnet_cidr_range,
      pscSubnetCidrRange: psc_subnet_cidr_range,
      internalFirewallSourceRanges: internal_firewall_source_ranges,
      postgresEgressDestinationRanges: postgres_egress_destination_ranges,
      pscEndpointName: psc_endpoint_name
    });

    // Create VM instance
    let vm;
    try {
      vm = await createVm({
        projectId: project_id,
        region: region,
        consumerVpcName: consumer_vpc_name,
        vmSubnetName: vm_subnet_name,
        instanceName: instance_name,
        machineType: machine_type,
        osImage: os_image
      });
    } catch (vmError) {
      console.error('VM creation failed:', vmError);
      // Don't fail the entire request, just log the VM error
    }

    const response: ConsumerResponse = {
      message: vm ? 'Consumer infrastructure and VM deployed successfully' : 'Consumer infrastructure deployed successfully (VM creation failed)',
      project_id: project_id,
      region: region,
      infrastructure: infrastructure,
      vm: vm
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error in consumer route:', error);
    
    const errorResponse = { 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    
    res.status(500).json(errorResponse);
  }
});

export default router; 