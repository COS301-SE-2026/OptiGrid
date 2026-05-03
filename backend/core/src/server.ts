import dotenv from 'dotenv';
import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import userAuthRoutes from './routes/user_auth.routes';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);

// Swagger definition
const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'OptiGrid API Documentation',
            version: '0.1.0',
            description: 'OptiGrid API documentation using swagger-jsdoc and swagger-ui-express',
        },
        servers: [
            {
                url: `http://localhost:${port}`,
                description: 'Local development server',
            },
        ],
    },
    apis: ['./src/routes/*.ts'],
});

// Middleware
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/auth', userAuthRoutes);

// Merged Health Check: Express routing instead of native server
app.get('/health', (_req, res) => {
    return res.status(200).json({ status: "ok", service: "core" }); 
});

// Merged 404 Handler: we use express again instead ofnative server
app.use((_req, res) => {
    res.status(404).json({ status: "error", message: "Not found" });
});

app.listen(port, () => {
    console.log(`Core service (OptiGrid API) listening on port ${port}`);
    console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
});