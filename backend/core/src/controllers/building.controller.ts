import { Request, Response } from 'express';
import { createBuilding } from '../services/building.services';
import { checkIdempotencyKey, saveIdempotencyKey } from '../services/idempotency.services';
import { createBuildingSchema } from '../validation/building.validation';


// creates buildings with payload validation, idempotency handling, and error management
export const createBuildingController = async (req: Request, res: Response) => {
  try {
    //get users, tenant info and idempotency key from headers and body
    if (!req.user) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    const userId = req.user.id;
    const tenantId = req.user.user_metadata.tenant_id;
    const idempotencyKey = req.headers['idempotency-key'] as string;
    const cachedResponse = await checkIdempotencyKey(idempotencyKey);

    //handle missing key and already requested scenarios
    if (!idempotencyKey) return res.status(400).json({ status: 'error', message: 'Idempotency-Key header is required' });
    if (cachedResponse) {
        console.log('Request already processed. Returning cached response.');
        return res.status(200).json(cachedResponse);
    }

    // validate payload, create building, save to redis and return success
    const validatedLoad = createBuildingSchema.parse(req.body);
    const building = await createBuilding(userId, {
      ...validatedLoad,
      tenant_id: tenantId 
    });
    const successResponse = {
      status: 'success',
      data: building
    };
    await saveIdempotencyKey(idempotencyKey, successResponse);
    res.status(201).json(successResponse);

  } catch (error) {
    console.error('Building creation failed:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};