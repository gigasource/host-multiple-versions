import Surreal from "surrealdb.js";
import { HttpEngine } from "../libs/engine";

let db: Surreal | null = null;

export async function initializeDatabase(): Promise<void> {
    const { SURREAL_DB_URL, SURREAL_DB_USERNAME, SURREAL_DB_PASSWORD } = process.env;
    if (!SURREAL_DB_URL || !SURREAL_DB_USERNAME || !SURREAL_DB_PASSWORD) {
        throw new Error("Missing DB info");
    }

    try {
        db = new Surreal({
            engines: {
                http: HttpEngine,
                https: HttpEngine,
            }
        });
        await db.connect(SURREAL_DB_URL, {
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
        db.pinger.stop();
        console.log('Connected to SurrealDB');
    } catch (e) {
        console.error('Failed to connect to SurrealDB:', e);
        throw e;
    }
}

export function getDb(): Surreal {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
    return db;
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
            console.log(queryString)
            return result as any[];
        },
        // Add other methods as needed
    };
};
