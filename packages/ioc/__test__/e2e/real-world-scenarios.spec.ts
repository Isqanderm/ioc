import "reflect-metadata";
import { Test } from "@nexus-ioc/testing";
import {
	Global,
	Inject,
	Injectable,
	NsModule,
	type OnModuleInit,
	Optional,
	Scope,
} from "../../src";

describe("Real-World Scenarios E2E", () => {
	describe("E-Commerce Application", () => {
		it("should build complete e-commerce system", async () => {
			// Models
			interface Product {
				id: string;
				name: string;
				price: number;
			}

			interface Order {
				id: string;
				products: Product[];
				total: number;
			}

			// Core Module - Global Configuration
			@Injectable()
			class ConfigService {
				getConfig() {
					return {
						currency: "USD",
						taxRate: 0.1,
					};
				}
			}

			@Global()
			@NsModule({
				providers: [ConfigService],
				exports: [ConfigService],
			})
			class CoreModule {}

			// Database Module
			@Injectable()
			class DatabaseConnection implements OnModuleInit {
				private connected = false;

				onModuleInit() {
					this.connected = true;
				}

				isConnected() {
					return this.connected;
				}
			}

			@NsModule({
				providers: [DatabaseConnection],
				exports: [DatabaseConnection],
			})
			class DatabaseModule {}

			// Products Module
			@Injectable()
			class ProductRepository {
				constructor(
					@Inject(DatabaseConnection) private db: DatabaseConnection,
				) {}

				findById(id: string): Product {
					return { id, name: "Test Product", price: 100 };
				}
			}

			@Injectable()
			class ProductService {
				constructor(
					@Inject(ProductRepository) private repo: ProductRepository,
				) {}

				getProduct(id: string) {
					return this.repo.findById(id);
				}
			}

			@NsModule({
				imports: [DatabaseModule],
				providers: [ProductRepository, ProductService],
				exports: [ProductService],
			})
			class ProductsModule {}

			// Orders Module
			@Injectable()
			class OrderRepository {
				constructor(
					@Inject(DatabaseConnection) private db: DatabaseConnection,
				) {}

				save(order: Order) {
					return order;
				}
			}

			@Injectable()
			class OrderService {
				constructor(
					@Inject(OrderRepository) private repo: OrderRepository,
					@Inject(ProductService) private productService: ProductService,
					@Inject(ConfigService) private config: ConfigService,
				) {}

				createOrder(productIds: string[]): Order {
					const products = productIds.map((id) =>
						this.productService.getProduct(id),
					);
					const subtotal = products.reduce((sum, p) => sum + p.price, 0);
					const tax = subtotal * this.config.getConfig().taxRate;
					const total = subtotal + tax;

					const order: Order = {
						id: "order-1",
						products,
						total,
					};

					return this.repo.save(order);
				}
			}

			@NsModule({
				imports: [DatabaseModule, ProductsModule],
				providers: [OrderRepository, OrderService],
				exports: [OrderService],
			})
			class OrdersModule {}

			// App Module
			@NsModule({
				imports: [CoreModule, ProductsModule, OrdersModule],
			})
			class AppModule {}

			const container = await Test.createModule({
				imports: [AppModule],
			}).compile();

			const orderService = await container.get<OrderService>(OrderService);
			const order = orderService?.createOrder(["prod-1", "prod-2"]);

			expect(order?.products.length).toBe(2);
			expect(order?.total).toBe(220); // 200 + 10% tax
		});
	});

	describe("Microservices Architecture", () => {
		it("should implement microservices communication pattern", async () => {
			// Message Bus (Global)
			@Injectable()
			class MessageBus {
				private messages: Map<string, unknown[]> = new Map();

				publish(topic: string, message: unknown) {
					if (!this.messages.has(topic)) {
						this.messages.set(topic, []);
					}
					this.messages.get(topic)?.push(message);
				}

				getMessages(topic: string) {
					return this.messages.get(topic) || [];
				}
			}

			@Global()
			@NsModule({
				providers: [MessageBus],
				exports: [MessageBus],
			})
			class MessageBusModule {}

			// User Service
			@Injectable()
			class UserRepository {
				findById(id: string) {
					return { id, name: "John Doe", email: "john@example.com" };
				}
			}

			@Injectable()
			class UserService {
				constructor(
					@Inject(UserRepository) private repo: UserRepository,
					@Inject(MessageBus) private bus: MessageBus,
				) {}

				createUser(name: string, email: string) {
					const user = { id: "user-1", name, email };
					this.bus.publish("user.created", user);
					return user;
				}

				getUser(id: string) {
					return this.repo.findById(id);
				}
			}

			@NsModule({
				providers: [UserRepository, UserService],
				exports: [UserService],
			})
			class UserServiceModule {}

			// Notification Service
			@Injectable()
			class NotificationService {
				constructor(@Inject(MessageBus) private bus: MessageBus) {}

				sendWelcomeEmail(userId: string) {
					this.bus.publish("notification.sent", {
						type: "welcome",
						userId,
					});
				}

				getNotifications() {
					return this.bus.getMessages("notification.sent");
				}
			}

			@NsModule({
				providers: [NotificationService],
				exports: [NotificationService],
			})
			class NotificationServiceModule {}

			// Orchestrator
			@Injectable()
			class UserOrchestrator {
				constructor(
					@Inject(UserService) private userService: UserService,
					@Inject(NotificationService)
					private notificationService: NotificationService,
					@Inject(MessageBus) private bus: MessageBus,
				) {}

				registerUser(name: string, email: string) {
					const user = this.userService.createUser(name, email);
					this.notificationService.sendWelcomeEmail(user.id);
					return user;
				}

				getUserEvents() {
					return this.bus.getMessages("user.created");
				}
			}

			@NsModule({
				imports: [
					MessageBusModule,
					UserServiceModule,
					NotificationServiceModule,
				],
				providers: [UserOrchestrator],
			})
			class AppModule {}

			const container = await Test.createModule({
				imports: [AppModule],
			}).compile();

			const orchestrator =
				await container.get<UserOrchestrator>(UserOrchestrator);
			const user = orchestrator?.registerUser("John", "john@example.com");

			expect(user?.name).toBe("John");
			expect(orchestrator?.getUserEvents().length).toBe(1);

			const notificationService =
				await container.get<NotificationService>(NotificationService);
			expect(notificationService?.getNotifications().length).toBe(1);
		});
	});

	describe("Repository Pattern with Caching", () => {
		it("should implement repository pattern with cache layer", async () => {
			// Cache Service
			@Injectable({ scope: Scope.Singleton })
			class CacheService {
				private cache = new Map<string, unknown>();

				get(key: string) {
					return this.cache.get(key);
				}

				set(key: string, value: unknown) {
					this.cache.set(key, value);
				}

				has(key: string) {
					return this.cache.has(key);
				}
			}

			// Database
			@Injectable()
			class Database {
				private callCount = 0;

				query(sql: string) {
					this.callCount++;
					return { id: "1", data: "from-db" };
				}

				getCallCount() {
					return this.callCount;
				}
			}

			// Repository with Cache
			@Injectable()
			class UserRepository {
				constructor(
					@Inject(Database) private db: Database,
					@Inject(CacheService) private cache: CacheService,
				) {}

				findById(id: string) {
					const cacheKey = `user:${id}`;

					if (this.cache.has(cacheKey)) {
						return this.cache.get(cacheKey);
					}

					const user = this.db.query(`SELECT * FROM users WHERE id = ${id}`);
					this.cache.set(cacheKey, user);
					return user;
				}

				getDbCallCount() {
					return this.db.getCallCount();
				}
			}

			const container = await Test.createModule({
				providers: [CacheService, Database, UserRepository],
			}).compile();

			const repo = await container.get<UserRepository>(UserRepository);

			// First call - should hit database
			const user1 = repo?.findById("1");
			expect(user1?.data).toBe("from-db");
			expect(repo?.getDbCallCount()).toBe(1);

			// Second call - should hit cache
			const user2 = repo?.findById("1");
			expect(user2?.data).toBe("from-db");
			expect(repo?.getDbCallCount()).toBe(1); // Still 1, not 2

			// Different ID - should hit database again
			const user3 = repo?.findById("2");
			expect(user3?.data).toBe("from-db");
			expect(repo?.getDbCallCount()).toBe(2);
		});
	});

	describe("Plugin System", () => {
		it("should implement extensible plugin architecture", async () => {
			// Plugin Interface
			interface Plugin {
				name: string;
				execute(data: unknown): unknown;
			}

			// Plugins
			@Injectable()
			class ValidationPlugin implements Plugin {
				name = "validation";

				execute(data: unknown) {
					return { ...data, validated: true };
				}
			}

			@Injectable()
			class LoggingPlugin implements Plugin {
				name = "logging";

				execute(data: unknown) {
					return { ...data, logged: true };
				}
			}

			@Injectable()
			class TransformPlugin implements Plugin {
				name = "transform";

				execute(data: unknown) {
					return { ...data, transformed: true };
				}
			}

			// Plugin Manager
			@Injectable()
			class PluginManager {
				constructor(
					@Inject(ValidationPlugin) private validation: ValidationPlugin,
					@Inject(LoggingPlugin) private logging: LoggingPlugin,
					@Inject(TransformPlugin)
					@Optional()
					private transform?: TransformPlugin,
				) {}

				process(data: unknown) {
					let result = data;
					result = this.validation.execute(result);
					result = this.logging.execute(result);
					if (this.transform) {
						result = this.transform.execute(result);
					}
					return result;
				}
			}

			const container = await Test.createModule({
				providers: [
					ValidationPlugin,
					LoggingPlugin,
					TransformPlugin,
					PluginManager,
				],
			}).compile();

			const manager = await container.get<PluginManager>(PluginManager);
			const result = manager?.process({ input: "test" });

			expect(result?.validated).toBe(true);
			expect(result?.logged).toBe(true);
			expect(result?.transformed).toBe(true);
		});
	});

	describe("Multi-Tenant Application", () => {
		it("should support multi-tenant architecture", async () => {
			// Tenant Context
			@Injectable({ scope: Scope.Request })
			class TenantContext {
				private tenantId?: string;

				setTenantId(id: string) {
					this.tenantId = id;
				}

				getTenantId() {
					return this.tenantId;
				}
			}

			// Tenant-aware Repository
			@Injectable()
			class TenantRepository {
				constructor(@Inject(TenantContext) private context: TenantContext) {}

				findData() {
					const tenantId = this.context.getTenantId();
					return { tenantId, data: `data-for-${tenantId}` };
				}
			}

			// Service
			@Injectable()
			class TenantService {
				constructor(@Inject(TenantRepository) private repo: TenantRepository) {}

				getData() {
					return this.repo.findData();
				}
			}

			const container = await Test.createModule({
				providers: [TenantContext, TenantRepository, TenantService],
			}).compile();

			// Simulate request for tenant 1
			const context1 = await container.get<TenantContext>(TenantContext);
			context1?.setTenantId("tenant-1");
			const service1 = await container.get<TenantService>(TenantService);
			const data1 = service1?.getData();

			expect(data1?.tenantId).toBe("tenant-1");
			expect(data1?.data).toBe("data-for-tenant-1");
		});
	});
});
