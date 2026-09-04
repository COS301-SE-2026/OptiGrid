import { Response } from 'express';

class SSEManager{
    private readonly clients: Map<string, Set<Response>> = new Map();
    public addClient(buildingId: string, res: Response){
        if(!this.clients.has(buildingId)){
            this.clients.set(buildingId, new Set());
        }
        this.clients.get(buildingId)!.add(res);
        res.write(': connected\n\n');

        // remove client on connection close
        res.on('close', () => {
            this.removeClient(buildingId, res);
        });
    }

    public removeClient(buildingId: string, res: Response){
        const buildingClients = this.clients.get(buildingId);
        if(buildingClients){
            buildingClients.delete(res);
            if(buildingClients.size === 0){
                this.clients.delete(buildingId);
            }
        }
    } 

    public broadcast(buildingId: string, data: any){
        const buildingClients = this.clients.get(buildingId);
        if(buildingClients){
            buildingClients.forEach((client) => {
                client.write(`data: ${JSON.stringify(data)}\n\n`);
            });
        }
    }
}

export const sseManager = new SSEManager();
