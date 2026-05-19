import { Request, Response } from 'express';
import { createBuilding, compareBuildingsService } from '../services/building.services';
import { checkIdempotencyKey, saveIdempotencyKey } from '../services/idempotency.services';
import { createBuildingSchema, compareBuildingsSchema } from '../validation/building.validation';


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
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export const compareBuildingsController = async (req: Request, res: Response) => {
  try {
    //create these vars and check if the indeed exist, and then validate query
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const idempotencyKey = req.headers['idempotency-key'] as string;
    const cachedResponse = await checkIdempotencyKey(idempotencyKey);

    if (!idempotencyKey) return res.status(400).json({ status: 'error', message: 'Idempotency-Key header is required' });
    if (cachedResponse) return res.status(200).json(cachedResponse);

    const validatedQuery = compareBuildingsSchema.parse(req.query);

    // 4. Execute Business Logic
    const comparisonData = await compareBuildingsService(
      userId,
      validatedQuery.building_id_a,
      validatedQuery.building_id_b,
      validatedQuery.time_range
    );
    const successResponse = {
      status: 'success',
      data: comparisonData
    };

    // here we save to redis
    await saveIdempotencyKey(idempotencyKey, successResponse);
    return res.status(200).json(successResponse);

  } 
  catch (error: any) {
    // this handles zod errors
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Invalid request parameters', 
        details: error.errors 
      });
    }
    // this handles any access denied erros
    if (error.message.includes('Access Denied')) return res.status(403).json({ status: 'error', message: error.message });
    //this handles any unexpected errors
    console.error('[compareBuildingsController] Error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};