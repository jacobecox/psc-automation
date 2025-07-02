import express, { Request, Response, Router } from 'express';
import { deployProducerManaged } from '../terraform/components/producer.js';
import { createSql } from '../terraform/components/create-sql.js';

const router: Router = express.Router();
router.use(express.json());

interface ProducerManagedRequest {
  project_id: string;
  region: string;
  allowed_consumer_project_ids: string[];
  instance_id?: string;
  default_password?: string;
  subnet_cidr_range?: string;
  internal_firewall_source_ranges?: string[];
  psc_ip_range_prefix_length?: number;
}

interface ProducerManagedResponse {
  message: string;
  project_id: string;
  region: string;
  infrastructure: any;
  sql?: any;
  error?: string;
}

router.post('/deploy/managed', async (req: Request, res: Response): Promise<void> => {
  console.log('===  PRODUCER ROUTE ===');
  console.log('Request body:', req.body);

  try {
    const { 
      project_id, 
      region,
      allowed_consumer_project_ids,
      instance_id,
      default_password,
      subnet_cidr_range,
      internal_firewall_source_ranges,
      psc_ip_range_prefix_length
    } = req.body as ProducerManagedRequest;

    // Validate required fields
    if (!project_id) {
      res.status(400).json({ error: 'project_id is required' });
      return;
    }

    if (!region) {
      res.status(400).json({ error: 'region is required' });
      return;
    }

    if (!allowed_consumer_project_ids || !Array.isArray(allowed_consumer_project_ids) || allowed_consumer_project_ids.length === 0) {
      res.status(400).json({ error: 'allowed_consumer_project_ids is required and must be a non-empty array' });
      return;
    }

    console.log(`Starting managed producer deployment for project: ${project_id} in region: ${region}`);

    // Deploy infrastructure
    const infrastructure = await deployProducerManaged({
      projectId: project_id,
      region: region,
      allowedConsumerProjectIds: allowed_consumer_project_ids,
      subnetCidrRange: subnet_cidr_range,
      internalFirewallSourceRanges: internal_firewall_source_ranges,
      pscIpRangePrefixLength: psc_ip_range_prefix_length
    });

    // Create SQL instance using the VPC and subnet self_links from infrastructure
    let sql;
    try {
      sql = await createSql({
        projectId: project_id,
        region: region,
        instanceId: instance_id,
        defaultPassword: default_password,
        allowedConsumerProjectIds: allowed_consumer_project_ids,
        producerVpcSelfLink: infrastructure.vpc_self_link,
        producerSubnetSelfLink: infrastructure.subnet_self_link
      });
    } catch (sqlError) {
      console.error('SQL creation failed:', sqlError);
      // Don't fail the entire request, just log the SQL error
    }

    const response: ProducerManagedResponse = {
      message: sql ? 'Managed Producer infrastructure and SQL instance deployed successfully' : 'Managed Producer infrastructure deployed successfully (SQL creation failed)',
      project_id: project_id,
      region: region,
      infrastructure: infrastructure,
      sql: sql
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error in managed producer route:', error);
    
    const errorResponse = { 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    
    res.status(500).json(errorResponse);
  }
});

export default router; 