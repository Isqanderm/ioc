import "reflect-metadata";
import { Inject, Injectable, NsModule } from "@nexus-ioc/core";
import { Test } from "../src/core/testing-container";

describe("Mocking and Provider Overriding", () => {
	describe("Provider Overriding", () => {
		it("should override provider with mock implementation", async () => {
			@Injectable()
			class RealDatabaseService {
				query() {
					return "real-data";
				}
			}

			@Injectable()
			class UserService {
				constructor(
					@Inject(RealDatabaseService) private db: RealDatabaseService,
				) {}

				getUsers() {
					return this.db.query();
				}
			}

			// Mock implementation
			@Injectable()
			class MockDatabaseService {
				query() {
					return "mock-data";
				}
			}

			const testingModule = Test.createModule({
				providers: [
					{
						provide: RealDatabaseService,
						useClass: MockDatabaseService,
					},
					UserService,
				],
			});

			const container = await testingModule.compile();
			const userService = await container.get<UserService>(UserService);

			expect(userService?.getUsers()).toBe("mock-data");
		});

		it("should override provider with value", async () => {
			const CONFIG_TOKEN = "APP_CONFIG";

			@Injectable()
			class ConfigService {
				constructor(@Inject(CONFIG_TOKEN) private config: unknown) {}

				getApiUrl() {
					return (this.config as { apiUrl: string }).apiUrl;
				}
			}

			const mockConfig = {
				apiUrl: "https://test-api.example.com",
			};

			const container = await Test.createModule({
				providers: [
					{ provide: CONFIG_TOKEN, useValue: mockConfig },
					ConfigService,
				],
			}).compile();

			const service = await container.get<ConfigService>(ConfigService);
			expect(service?.getApiUrl()).toBe("https://test-api.example.com");
		});

		it("should override provider with factory", async () => {
			@Injectable()
			class EmailService {
				send(to: string, message: string) {
					return `sent to ${to}`;
				}
			}

			@Injectable()
			class NotificationService {
				constructor(@Inject(EmailService) private email: EmailService) {}

				notify(user: string) {
					return this.email.send(user, "notification");
				}
			}

			const mockEmailFactory = () => ({
				send: (to: string, message: string) => `mock-sent to ${to}`,
			});

			const container = await Test.createModule({
				providers: [
					{
						provide: EmailService,
						useFactory: mockEmailFactory,
					},
					NotificationService,
				],
			}).compile();

			const service =
				await container.get<NotificationService>(NotificationService);
			expect(service?.notify("user@example.com")).toBe(
				"mock-sent to user@example.com",
			);
		});
	});

	describe("Spy and Mock Functions", () => {
		it("should use vitest spy for method tracking", async () => {
			const sendSpy = vi.fn().mockReturnValue("email-sent");

			@Injectable()
			class EmailService {
				send = sendSpy;
			}

			@Injectable()
			class UserService {
				constructor(@Inject(EmailService) private email: EmailService) {}

				registerUser(email: string) {
					return this.email.send(email, "Welcome!");
				}
			}

			const container = await Test.createModule({
				providers: [EmailService, UserService],
			}).compile();

			const service = await container.get<UserService>(UserService);
			const result = service?.registerUser("test@example.com");

			expect(result).toBe("email-sent");
			expect(sendSpy).toHaveBeenCalledWith("test@example.com", "Welcome!");
			expect(sendSpy).toHaveBeenCalledTimes(1);
		});

		it("should mock async operations", async () => {
			const fetchSpy = vi.fn().mockResolvedValue({ data: "mocked" });

			@Injectable()
			class ApiService {
				fetch = fetchSpy;
			}

			@Injectable()
			class DataService {
				constructor(@Inject(ApiService) private api: ApiService) {}

				async getData() {
					return await this.api.fetch("/data");
				}
			}

			const container = await Test.createModule({
				providers: [ApiService, DataService],
			}).compile();

			const service = await container.get<DataService>(DataService);
			const result = await service?.getData();

			expect(result).toEqual({ data: "mocked" });
			expect(fetchSpy).toHaveBeenCalledWith("/data");
		});

		it("should mock multiple method calls with different returns", async () => {
			const querySpy = vi
				.fn()
				.mockReturnValueOnce({ id: 1, name: "First" })
				.mockReturnValueOnce({ id: 2, name: "Second" });

			@Injectable()
			class DatabaseService {
				query = querySpy;
			}

			@Injectable()
			class UserRepository {
				constructor(@Inject(DatabaseService) private db: DatabaseService) {}

				findById(id: number) {
					return this.db.query(`SELECT * FROM users WHERE id = ${id}`);
				}
			}

			const container = await Test.createModule({
				providers: [DatabaseService, UserRepository],
			}).compile();

			const repo = await container.get<UserRepository>(UserRepository);

			const user1 = repo?.findById(1);
			const user2 = repo?.findById(2);

			expect(user1).toEqual({ id: 1, name: "First" });
			expect(user2).toEqual({ id: 2, name: "Second" });
			expect(querySpy).toHaveBeenCalledTimes(2);
		});
	});

	describe("Partial Mocking", () => {
		it("should partially mock service methods", async () => {
			@Injectable()
			class ComplexService {
				methodA() {
					return "real-A";
				}

				methodB() {
					return "real-B";
				}

				methodC() {
					return this.methodA() + this.methodB();
				}
			}

			const mockMethodA = vi.fn().mockReturnValue("mock-A");

			@Injectable()
			class PartialMockService extends ComplexService {
				methodA = mockMethodA;
			}

			const container = await Test.createModule({
				providers: [
					{
						provide: ComplexService,
						useClass: PartialMockService,
					},
				],
			}).compile();

			const service = await container.get<ComplexService>(ComplexService);

			expect(service?.methodA()).toBe("mock-A");
			expect(service?.methodB()).toBe("real-B");
			expect(service?.methodC()).toBe("mock-Areal-B");
		});
	});

	describe("Mock Dependencies in Modules", () => {
		it("should mock dependencies across modules", async () => {
			@Injectable()
			class DatabaseService {
				connect() {
					return "real-connection";
				}
			}

			@NsModule({
				providers: [DatabaseService],
				exports: [DatabaseService],
			})
			class DatabaseModule {}

			@Injectable()
			class UserRepository {
				constructor(@Inject(DatabaseService) private db: DatabaseService) {}

				getConnection() {
					return this.db.connect();
				}
			}

			@NsModule({
				imports: [DatabaseModule],
				providers: [UserRepository],
			})
			class UserModule {}

			// Create mock database
			@Injectable()
			class MockDatabaseService {
				connect() {
					return "mock-connection";
				}
			}

			@NsModule({
				providers: [MockDatabaseService],
				exports: [MockDatabaseService],
			})
			class MockDatabaseModule {}

			// Replace real module with mock
			@NsModule({
				imports: [MockDatabaseModule],
				providers: [
					{
						provide: DatabaseService,
						useClass: MockDatabaseService,
					},
					UserRepository,
				],
			})
			class TestUserModule {}

			const container = await Test.createModule({
				imports: [TestUserModule],
			}).compile();

			const repo = await container.get<UserRepository>(UserRepository);
			expect(repo?.getConnection()).toBe("mock-connection");
		});
	});

	describe("Testing with Fixtures", () => {
		it("should use fixture data for testing", async () => {
			interface User {
				id: string;
				name: string;
				email: string;
			}

			const userFixtures: User[] = [
				{ id: "1", name: "Alice", email: "alice@example.com" },
				{ id: "2", name: "Bob", email: "bob@example.com" },
				{ id: "3", name: "Charlie", email: "charlie@example.com" },
			];

			@Injectable()
			class UserRepository {
				findAll() {
					return userFixtures;
				}

				findById(id: string) {
					return userFixtures.find((u) => u.id === id);
				}
			}

			@Injectable()
			class UserService {
				constructor(@Inject(UserRepository) private repo: UserRepository) {}

				getAllUsers() {
					return this.repo.findAll();
				}

				getUser(id: string) {
					return this.repo.findById(id);
				}
			}

			const container = await Test.createModule({
				providers: [UserRepository, UserService],
			}).compile();

			const service = await container.get<UserService>(UserService);

			const allUsers = service?.getAllUsers();
			expect(allUsers?.length).toBe(3);

			const user = service?.getUser("2");
			expect(user?.name).toBe("Bob");
		});
	});

	describe("Error Mocking", () => {
		it("should mock error scenarios", async () => {
			const errorSpy = vi
				.fn()
				.mockRejectedValue(new Error("Database connection failed"));

			@Injectable()
			class DatabaseService {
				connect = errorSpy;
			}

			@Injectable()
			class UserService {
				constructor(@Inject(DatabaseService) private db: DatabaseService) {}

				async initialize() {
					try {
						await this.db.connect();
						return "initialized";
					} catch (error) {
						return "failed";
					}
				}
			}

			const container = await Test.createModule({
				providers: [DatabaseService, UserService],
			}).compile();

			const service = await container.get<UserService>(UserService);
			const result = await service?.initialize();

			expect(result).toBe("failed");
			expect(errorSpy).toHaveBeenCalled();
		});

		it("should test error handling in services", async () => {
			@Injectable()
			class ValidationService {
				validate(data: unknown) {
					if (!(data as { email?: string }).email) {
						throw new Error("Email is required");
					}
					return true;
				}
			}

			@Injectable()
			class UserService {
				constructor(
					@Inject(ValidationService) private validator: ValidationService,
				) {}

				createUser(data: unknown) {
					try {
						this.validator.validate(data);
						return { success: true, user: data };
					} catch (error) {
						return { success: false, error: (error as Error).message };
					}
				}
			}

			const container = await Test.createModule({
				providers: [ValidationService, UserService],
			}).compile();

			const service = await container.get<UserService>(UserService);

			const validResult = service?.createUser({ email: "test@example.com" });
			expect(validResult?.success).toBe(true);

			const invalidResult = service?.createUser({ name: "Test" });
			expect(invalidResult?.success).toBe(false);
			expect(invalidResult?.error).toBe("Email is required");
		});
	});
});
