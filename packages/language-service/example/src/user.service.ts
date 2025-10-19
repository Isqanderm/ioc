import { Injectable, Inject } from "@nexus-ioc/core";
import { DatabaseService } from "./database.service";
import { LoggerService } from "./logger.service";

/**
 * User service that demonstrates class token injection
 * 
 * This demonstrates:
 * - Injecting class tokens (DatabaseService, LoggerService)
 * - Auto-completion inside @Inject() should show available providers
 * - Go-to-definition should navigate to the service definitions
 * - No errors should appear (all dependencies are provided)
 */
@Injectable()
export class UserService {
	constructor(
		@Inject(DatabaseService) private db: DatabaseService,
		@Inject(LoggerService) private logger: LoggerService,
	) {}

	async findById(id: number): Promise<User | null> {
		this.logger.log(`Finding user by id: ${id}`);
		const users = await this.db.query<User>(`SELECT * FROM users WHERE id = ${id}`);
		return users[0] || null;
	}

	async create(userData: Partial<User>): Promise<User> {
		this.logger.log(`Creating user: ${userData.email}`);
		const users = await this.db.query<User>(
			`INSERT INTO users (email, name) VALUES ('${userData.email}', '${userData.name}')`,
		);
		return users[0];
	}

	async update(id: number, userData: Partial<User>): Promise<User> {
		this.logger.log(`Updating user ${id}`);
		const users = await this.db.query<User>(
			`UPDATE users SET name = '${userData.name}' WHERE id = ${id}`,
		);
		return users[0];
	}

	async delete(id: number): Promise<void> {
		this.logger.log(`Deleting user ${id}`);
		await this.db.query(`DELETE FROM users WHERE id = ${id}`);
	}
}

export interface User {
	id: number;
	email: string;
	name: string;
	createdAt: Date;
}

