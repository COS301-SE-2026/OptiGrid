//This file is to prevent duplicate building creation if user retries and
//and also for horizontal scaling. Redis stores these keys 

import { redis } from '../lib/redis';
//24 hours is standard for these keys, thus used
const IDEMPOTENCY_TTL_SECONDS = 86400;

// I made the keys so that they are scoped per user so one user's Idempotency key can never return another user's cached response 
const buildRedisKey = (userId: string, key: string) => `idempotency:${userId}:${key}`;

//this function checks if key exists and is returned
export const checkIdempotencyKey = async (userId: string, key: string) => {
  try {
    const cachedResponse = await redis.get(buildRedisKey(userId, key));
    //we parse string to json before returning, if it exists
    if (cachedResponse) {
      return JSON.parse(cachedResponse);
    }
  } catch (error: any) {
    if(error instanceof SyntaxError || error.name === "Syntax Error") throw error;
    console.warn('[IDEMPOTENCY] Redis unavailable for checkIdempotencyKey, allowing request through:', error);
  }
  return null; 
};

//saves key so future retries will hit cache n not db
export const saveIdempotencyKey = async (userId: string, key: string, responseData: any) => {
  try {
    await redis.set(
      buildRedisKey(userId, key),
      JSON.stringify(responseData),
      //remove after 24 hours, so we don't store stale data forever 
      'EX', IDEMPOTENCY_TTL_SECONDS       
    );
  } catch (error) {
    console.warn('[IDEMPOTENCY] Redis unavailable for saveIdempotencyKey, continuing without cache:', error);
  }
};
