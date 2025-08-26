import { Usuario } from "@prisma/client";

declare global {
    namespace Express {
        interface Request {
            userId?: string; 
            user?: Partial<User>;
        }
    }
}