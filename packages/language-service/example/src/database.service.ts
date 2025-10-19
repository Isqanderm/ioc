import { Injectable } from "@nexus-ioc/core";

/**
 * Database service that handles database connections and queries
 */
@Injectable()
export class DatabaseService {
	private connected = false;

	async connect(): Promise<void> {
		console.log("Connecting to database...");
		this.connected = true;
	}

	async query<T>(sql: string): Promise<T[]> {
		if (!this.connected) {
			throw new Error("Database not connected");
		}
		console.log(`Executing query: ${sql}`);
		return [] as T[];
	}

	async disconnect(): Promise<void> {
		console.log("Disconnecting from database...");
		this.connected = false;
	}
}

