import type {Request, Response, NextFunction } from "express";
import {redis } from "../lib/redis";

export const rateLimiter = (
capacity: number,
refillRate: number) => {//refillrate is in seconds
    return async (req:Request, resp: Response, nextFunc: NextFunction) : Promise<void> => {
        if (process.env.DISABLE_RATE_LIMIT === "true") {
            return nextFunc();
        }
        const id = req.ip || req.socket.remoteAddress || "unknown";
        const routes = `${req.baseUrl || ""}${req.path || ""}` || "unknown-route"; //allows for diff buckets for diff endpoints
        const key = `rateLimit:${routes}-${id}`;
        try {
            const currTime = Date.now();
            const exists = await redis.get(key);

            if(!exists) {
                const iniState = {
                    tokens: capacity - 1, 
                    lastRefill: currTime,
                };
                await redis.set(key, JSON.stringify(iniState));
                return nextFunc();
            }

            const currState = JSON.parse(exists);
            //divide by 1000 bcs date.now() gives time in ms so we convert to s
            const timeGone = (currTime - currState.lastRefill) / 1000;
            const addTokens = timeGone * refillRate; //Note: refillrate in seconds
            let currTokens = Math.min(capacity, currState.tokens + addTokens);
            
            //logic to subtract tokens and handle 0 tokens
            if(currTokens > 0) {
                currTokens -= 1;
                await redis.set(key,JSON.stringify({
                    tokens: currTokens,
                    lastRefill: currTime,
                }));
                return nextFunc();
            }
            else {
                resp.status(429).json({
                    status: "error",
                    message: "Please try again later. Too many requests",
                });
                return;
            }
        }
        catch(error) {
            console.error("Error by rate limit: ",error);
            return nextFunc();
        }
    };

};