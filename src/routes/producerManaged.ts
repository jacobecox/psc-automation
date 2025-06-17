import express, { Request, Response, Router } from 'express';
import axios from 'axios';

const router: Router = express.Router();
router.use(express.json());

interface ProducerManagedRequest {
  serviceAttachmentUri: string;
}

router.post('/deploy/managed', async (req: Request, res: Response): Promise<void> => {
  try {
    const { serviceAttachmentUri } = req.body;

    // Validate the service attachment URI format
    if (!serviceAttachmentUri || typeof serviceAttachmentUri !== 'string' || !serviceAttachmentUri.includes('/serviceAttachments/')) {
      res.status(400).json({ error: 'Invalid service attachment URI format' });
      return;
    }

    // Call the consumer route with default values
    try {
      const consumerResponse = await axios.post('http://localhost:3000/consumer/deploy/consumer', {
        service_attachment_uri: serviceAttachmentUri,
        project_id: "test-project-2-462619",
        region: "us-central1",
        vpc_name: "consumer-vpc",
        subnet_name: "consumer-subnet",
        psc_endpoint_name: "psc-endpoint"
      });

      res.status(200).json({ 
        message: 'Managed Producer and Consumer setup successful',
        consumer_output: consumerResponse.data,
        service_attachment_uri: serviceAttachmentUri
      });
    } catch (consumerError) {
      console.error('Consumer setup failed:', consumerError);
      res.status(200).json({ 
        message: 'Consumer setup failed', 
        service_attachment_uri: serviceAttachmentUri,
        consumer_error: consumerError instanceof Error ? consumerError.message : 'Unknown error occurred'
      });
    }
  } catch (error) {
    console.error('Error in managed producer route:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    });
  }
});

export default router; 