import bcrypt from 'bcrypt';

const no_of_salt_times = 10;

export const hashPassword = async (passwordPlain: string): Promise<string> => {
  return await bcrypt.hash(passwordPlain, no_of_salt_times);
};

export const comparePassword = async (passwordPlain: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(passwordPlain, hash);
};