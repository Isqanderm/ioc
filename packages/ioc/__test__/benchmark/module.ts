import Benchmark from 'benchmark';
import { Test } from "@nexus-ioc/testing";
import { generateAppModule } from "./module-generator";

(async () => {
  const suite = new Benchmark.Suite();

  const AppModule10 = generateAppModule(10);
  const AppModule100 = generateAppModule(100);
  const AppModule500 = generateAppModule(1000);

  suite
    .add('Регистрация модулей - маленький контейнер', {
      defer: true,
      async fn(deferred) {
        await Test
          .createModule({
            imports: [AppModule10],
          })
          .compile();

        deferred.resolve();
      }
    })
    .add('Регистрация модулей - средний контейнер', {
      defer: true,
      async fn(deferred) {
        await Test
          .createModule({
            imports: [AppModule100],
          })
          .compile();
        deferred.resolve();
      }
    })
    .add('Регистрация модулей - большой контейнер', {
      defer: true,
      async fn(deferred) {
        await Test
          .createModule({
            imports: [AppModule500],
          })
          .compile();

        deferred.resolve();
      }
    })
    .on('cycle', (event: Benchmark.Event) => {
      console.log(String(event.target));
    })
    .on('complete', function () {
      console.log('Самый быстрый тест: ' + this.filter('fastest').map('name'));
    })
    .run({ async: true });
})();
