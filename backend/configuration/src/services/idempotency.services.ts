//This file is to prevent duplicate building crreation if user retries and
//and also for horizontal scaling. Redis stores these keys 

import { redis } from '../lib/redis';
//24 hours is standard for these keys, thus used
const IDEMPOTENCY_TTL_SECONDS = 86400; 

//this function checks if key exists and is returne
export const checkIdempotencyKey = async (key: string) => {
  const cachedResponse = await redis.get(`idempotency:${key}`);
  //we parse string to json before returning, if it exists
  if (cachedResponse) {
    return JSON.parse(cachedResponse);
  }
  else {
    return null; 
  }
};

//saves key so future retries will hit cache n not db
export const saveIdempotencyKey = async (key: string, responseData: any) => {
  await redis.set(
    `idempotency:${key}`,
    JSON.stringify(responseData),
    //remove after 24 hours, so we don't store stale data forever 
    'EX', IDEMPOTENCY_TTL_SECONDS       
  );
};