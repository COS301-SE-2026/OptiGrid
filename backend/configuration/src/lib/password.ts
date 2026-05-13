import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';

const length = 64;
const type = 'hex';
//make scryppt work with promises, such that
//we can use async/await syntax instead of callbacks
const scrypt = async (pass: string, salt: string): Promise<string> => {
  return await new Promise((resolve, reject) => {
    scryptCallback(pass, salt, length, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve((derivedKey as Buffer).toString(type));
    });
  });
};

//we hashpassword using scrypt, 
//store salt n key in db 
export const hashPassword = async (pass: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(pass, salt);
  return `scrypt$${salt}$${derivedKey}`;
};

//we ensure each password is unique
export const comparePass = async (pass: string, hash: string): Promise<boolean> => {
  const [algorithm, salt, storedKey] = hash.split('$');
  if (algorithm !== 'scrypt' || !salt || !storedKey) return false;
  const derivedKey = await scrypt(pass, salt);
  const storedBuffer = Buffer.from(storedKey, type);
  const derivedBuffer = Buffer.from(derivedKey, type);
  if (storedBuffer.length !== derivedBuffer.length) return false;

  return timingSafeEqual(storedBuffer, derivedBuffer);
};