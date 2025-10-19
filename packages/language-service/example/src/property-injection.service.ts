import { Inject, Injectable } from "@nexus-ioc/core";
import { DatabaseService } from "./database.service";
import { LoggerService } from "./logger.service";

/**
 * Service demonstrating property injection
 *
 * This demonstrates:
 * - Property injection using @Inject decorator
 * - Mixed constructor and property injection
 * - Auto-completion should work on @Inject decorators for properties
 * - Go-to-definition should work from property @Inject decorators
 * - Semantic diagnostics should detect missing property dependencies
 */
@Injectable()
export class PropertyInjectionService {
	/**
	 * Property injection example
	 * Try:
	 * 1. Hover over DatabaseService - should show type info
	 * 2. Cmd+Click on DatabaseService - should navigate to definition
	 * 3. Remove DatabaseService from module providers - should show error
	 */
	@Inject(DatabaseService)
	private database!: DatabaseService;

	/**
	 * Another property injection example
	 */
	@Inject(LoggerService)
	private logger!: LoggerService;

	/**
	 * Constructor injection for comparison
	 * Both constructor and property injection work together
	 */
	constructor(@Inject("API_KEY") private apiKey: string) {}

	async fetchData(): Promise<string> {
		this.logger.log("Fetching data with property-injected dependencies");

		const connection = await this.database.connect();
		this.logger.log(`Database connection: ${connection}`);

		return "Data fetched using API key: [REDACTED]";
	}

	getInjectionInfo(): string {
		return `
			Property Injection Service:
			- Database (property): ${this.database ? "injected" : "missing"}
			- Logger (property): ${this.logger ? "injected" : "missing"}
			- API Key (constructor): ${this.apiKey ? "injected" : "missing"}
		`;
	}
}
