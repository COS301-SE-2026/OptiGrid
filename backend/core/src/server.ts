import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
	if (req.method === "GET" && req.url === "/health") {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ status: "ok", service: "core" }));
		return;
	}

	res.writeHead(404, { "Content-Type": "application/json" });
	res.end(JSON.stringify({ status: "error", message: "Not found" }));
});

server.listen(port, () => {
	console.log(`Core service listening on port ${port}`);
});
