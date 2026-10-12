import "reflect-metadata";
import { Injectable, Module, NexusApplication, Scope } from "@nexus-ioc/core";

@Injectable({ scope: Scope.Singleton })
class SingletonService {
	readonly id = Math.random();
}

@Injectable({ scope: Scope.Scoped })
class ScopedService {
	readonly id = Math.random();
}

@Injectable({ scope: Scope.Transient })
class TransientService {
	readonly id = Math.random();
}

@Module({
	providers: [SingletonService, ScopedService, TransientService],
})
class AppModule {}

async function main() {
	const app = await NexusApplication.create(AppModule).bootstrap();

	// Singletons are created at bootstrap, so get() is synchronous.
	const s1 = app.get<SingletonService>(SingletonService);
	const s2 = app.get<SingletonService>(SingletonService);
	console.log("Singleton same instance:", s1.id === s2.id); // true

	// Scoped and Transient providers are created on demand: use resolve().
	// get() would throw ProviderScopeError for them.
	const sc1 = await app.resolve<ScopedService>(ScopedService);
	const sc2 = await app.resolve<ScopedService>(ScopedService);
	console.log("Scoped new instance per resolve():", sc1.id !== sc2.id); // true

	const t1 = await app.resolve<TransientService>(TransientService);
	const t2 = await app.resolve<TransientService>(TransientService);
	console.log("Transient always new:", t1.id !== t2.id); // true

	await app.close();
}

main();
