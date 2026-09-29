import { spawn } from "node:child_process";
const serverProcess = spawn("/usr/bin/env", ["corepack", "pnpm", "--filter", "@optigrid/core", "run", "dev"], { stdio: "ignore" });

for (let i = 0; i < 30; i++) {
  try{
    await fetch("http://localhost:4000/health");
    break;
  }
  catch(err) {
    await new Promise(r => setTimeout(r, 1000));
  }
}

const creds = {
  email: `perf_${Date.now()}@test.com`, password: "SecurePass123!",
  name: "Perf Tester"
};
const signup = await fetch("http://localhost:4000/api/users/signup", {
  method: "POST", headers:
    { "Content-Type": "application/json" },
  body: JSON.stringify(creds)
});

const loginRes = await fetch("http://localhost:4000/api/users/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: creds.email, password: creds.password })
});
serverProcess.kill();