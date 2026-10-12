import "reflect-metadata";
import { Injectable, Module, NexusApplication, Scope } from "@nexus-ioc/core";

@Injectable({ scope: Scope.Singleton })
class SingletonService {
	readonly id = Math.random();
}

@Injectable({ scope: Scope.Transient })
class TransientService {
	readonly id = Math.random();
}

@Module({
	providers: [SingletonService, TransientService],
})
class AppModule {}

async function main() {
	const app = await NexusApplication.create(AppModule).bootstrap();

	// Singletons are created at bootstrap, so get() is synchronous.
	const s1 = app.get<SingletonService>(SingletonService);
	const s2 = app.get<SingletonService>(SingletonService);
	console.log("Singleton same instance:", s1.id === s2.id); // true

	// Transient providers are created on demand: use resolve().
	// get() would throw ProviderScopeError for them.
	const t1 = await app.resolve<TransientService>(TransientService);
	const t2 = await app.resolve<TransientService>(TransientService);
	console.log("Transient always new:", t1.id !== t2.id); // true

	await app.close();
}

main();
