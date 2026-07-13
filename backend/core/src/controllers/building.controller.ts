import { Request, Response } from 'express';
import { createBuilding, compareBuildingsService, deleteBuildingService, getAllBuildings, getBuildingEnergyConsumptionDetails, listBuildingsForUser, updateBuildingService } from '../services/building.services';
import { checkIdempotencyKey, saveIdempotencyKey } from '../services/idempotency.services';
import { adminBuildingsSchema, buildingEnergyConsumptionParamsSchema, buildingEnergyConsumptionQuerySchema, compareBuildingsSchema, createBuildingSchema, deleteBuildingSchema, updateBuildingSchema } from '../validation/building.validation';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toUuidOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : undefined;
}

// creates buildings with payload validation, idempotency handling, and error management
export const createBuildingController = async (req: Request, res: Response) => {
  try {
    //get users, tenant info and idempotency key from headers and body
    if (!req.user) {
        return res.status(401).json({ 
          status: 'error', 
          message: 'Unauthorized' 
        });
    }

    const userId = req.user.id;
    const tenantId = toUuidOrUndefined(req.user.user_metadata?.tenant_id);
    const idempotencyKey = req.headers['idempotency-key'] as string;

    //handle missing key and already requested scenarios
    if (!idempotencyKey) return res.status(400).json({ status: 'error', message: 'Idempotency-Key header is required' });
    const cachedResponse = await checkIdempotencyKey(userId, idempotencyKey);
    if (cachedResponse) {
        return res.status(200).json(cachedResponse);
    }

    // validate payload, create building, save to redis and return success
    const validatedLoad = createBuildingSchema.parse(req.body);
    const building = await createBuilding(userId, {
      ...validatedLoad,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    });
    const successResponse = {
      status: 'success',
      data: building
    };
    await saveIdempotencyKey(userId, idempotencyKey, successResponse);
    res.status(201).json(successResponse);

  } catch (error: any) {
    //added this to esnure we return 400 if validation error occurs(figured after integration tets)
    if(error.name === 'ZodError') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request payload',
        details: error.errors
      });
    }
    console.error('createBuildingController error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export const listBuildingsController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const buildings = await listBuildingsForUser(req.user.id);
    return res.status(200).json({
      status: 'success',
      data: buildings,
    });
  } catch (error) {
    console.error('listBuildingsController error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export const getBuildingEnergyConsumptionController = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const { building_id } = buildingEnergyConsumptionParamsSchema.parse(req.params);
    const { time_range } = buildingEnergyConsumptionQuerySchema.parse(req.query);

    const details = await getBuildingEnergyConsumptionDetails(req.user.id, building_id, time_range);
    return res.status(200).json({
      status: 'success',
      data: details,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request parameters',
        details: error.errors,
      });
    }

    if (error.message?.includes('Access Denied')) {
      return res.status(403).json({
        status: 'error',
        message: error.message,
      });
    }

    if (error.message === 'Building not found') {
      return res.status(404).json({
        status: 'error',
        message: 'Building not found',
      });
    }

    console.error('getBuildingEnergyConsumptionController error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export const compareBuildingsController = async (req: Request, res: Response) => {
  try {
    //create these vars and check if the indeed exist, and then validate query
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const idempotencyHeader = req.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(idempotencyHeader) ? idempotencyHeader[0] : idempotencyHeader;

    if (!idempotencyKey) return res.status(400).json({ status: 'error', message: 'Idempotency-Key header is required' });
    const cachedResponse = await checkIdempotencyKey(userId, idempotencyKey);
    if (cachedResponse) return res.status(200).json(cachedResponse);

    const validatedQuery = compareBuildingsSchema.parse(req.query);

    // we give the data to the service layer to handle
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
    await saveIdempotencyKey(userId, idempotencyKey, successResponse);
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
    if (error.message.includes('Access Denied')) {
      return res.status(403).json({ 
        status: 'error', 
        message: error.message 
      });
    }
    //this handles any unexpected errors
    console.error('[compareBuildingsController] Error:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Internal server error' 
    });
  }
};

export const deleteBuildingController = async (req: Request, res: Response) => {
  try {
    // enforce strict authentication check
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized'
      });
    }
    //enforce rbac where the roleType is the role set by the auth middleware which is verified by DB
    const role = req.user.roleType;
    if(role !== "ADMIN") {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to delete a building, submit a support ticket"
      })
    }
    const userId = req.user.id;

    // enforce strict idempotency processing
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      return res.status(400).json({ status: 'error', message: 'Idempotency-Key header is required' });
    }

    const cachedResponse = await checkIdempotencyKey(userId, idempotencyKey);
    if (cachedResponse) {
      return res.status(200).json(cachedResponse);
    }

    // validate parameter format string
    const { building_id } = deleteBuildingSchema.parse(req.params);

    // delegate to the service layer
    await deleteBuildingService(userId, building_id, role);

    const successResponse = {
      status: 'success',
      message: 'Building successfully deleted'
    };

    //store in redis cache cache before responding
    await saveIdempotencyKey(userId, idempotencyKey, successResponse);
    return res.status(200).json(successResponse);

  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ status: "error", message: "Invalid request parameters", details: error.errors });
    }
    if (error.message.includes("Access Denied") || error.message.includes("permission")) {
      return res.status(403).json({ status: "error", message: error.message });
    }
    
    console.error("Delete Building Error: ", error);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

export const updateBuildingController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    //enforce rbac so the roleType is the DB-verified role set by the auth middleware
    const role = req.user.roleType;
    if(role !== "ADMIN" && role !== "BUILDING_MANAGER") {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to edit the building"
      })
    }

    const { building_id } = deleteBuildingSchema.parse(req.params);
    const validatedPayload = updateBuildingSchema.parse(req.body);

    const building = await updateBuildingService(req.user.id, building_id, validatedPayload, role);
    return res.status(200).json({
      status: 'success',
      data: building,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request payload',
        details: error.errors,
      });
    }

    if (error.message.includes('Access Denied')) {
      return res.status(403).json({ status: 'error', message: error.message });
    }

    console.error('updateBuildingController error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export const getAllBuildingsController = async (req:Request, resp: Response) => {
  try {
    // enforce strict authentication check
    if (!req.user) {
      return resp.status(401).json({
        status: 'error',
        message: 'Unauthorized'
      });
    }
    //enfore rbac
    const role = req.user.roleType;
    if(role !== "ADMIN") {
      return resp.status(403).json({
        status: "error",
        message: "You do not have enough permission"
      })
    }

    const validated = adminBuildingsSchema.parse(req.query);
    const buildings = await getAllBuildings(validated.lifecycle_state);

    return resp.status(200).json({
      status: "success",
      data: buildings,
    });
  }
  catch(error: any) {
    if(error.name === "ZodError") {
      return resp.status(400).json({
        status: 'error',
        message: 'Invalid request payload',
        details: error.errors
      });
    }
    //console.error('createBuildingController error:', error);
    resp.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}
