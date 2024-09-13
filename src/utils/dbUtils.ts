import Surreal from "surrealdb.js";
import { HttpEngine } from "../libs/engine";

class DatabaseConnectionManager {
    private db: Surreal | null = null;

    public async initialize(): Promise<void> {
        const { SURREAL_DB_URL, SURREAL_DB_USERNAME, SURREAL_DB_PASSWORD } = process.env;
        if (!SURREAL_DB_URL || !SURREAL_DB_USERNAME || !SURREAL_DB_PASSWORD) {
            throw new Error("Missing DB info");
        }

        try {
            this.db = new Surreal({
                engines: {
                    http: HttpEngine,
                    https: HttpEngine,
                }
            });
            await this.db.connect(SURREAL_DB_URL, {
                versionCheck: false,
                namespace: 'cloud',
                database: 'cloud',
                auth: {
                    namespace: 'cloud',
                    username: SURREAL_DB_USERNAME,
                    password: SURREAL_DB_PASSWORD,
                },
            });
            // @ts-ignore
            this.db.pinger.stop();
            console.log('Connected to SurrealDB');
        } catch (e) {
            console.error('Failed to connect to SurrealDB:', e);
            throw e;
        }
    }

    public getDb(): Surreal {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize first.');
        }
        return this.db;
    }
}

// Create a single instance of DatabaseConnectionManager
const dbManager = new DatabaseConnectionManager();

// Export the initializeDatabase function
export async function initializeDatabase(): Promise<void> {
    await dbManager.initialize();
}

// Export the getDb function
export function getDb(): Surreal {
    return dbManager.getDb();
}

interface DbInterface {
    find: (query?: string) => Promise<any[]>;
}

export const getSurrealDbInterface = (tableName: string): DbInterface => {
    return {
        async find(query?: string): Promise<any[]> {
            const db = getDb();
            let queryString = `SELECT * FROM ${tableName}`;
            if (query) {
                queryString += ` ${query}`;
            }
            const [result] = await db.query(queryString);
            console.log(queryString);
            return result as any[];
        },
        // Add other methods as needed
    };
};
