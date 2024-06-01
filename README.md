![npm](https://img.shields.io/npm/v/athena-ioc)
![license](https://img.shields.io/npm/l/athena-ioc)
![build](https://img.shields.io/github/actions/workflow/status/Isqanderm/ioc/build.yml)

Athena IoC is a powerful and flexible Inversion of Control (IoC) container for TypeScript applications. Inspired by Angular and NestJS, it leverages decorators to provide a simple and efficient way to manage dependencies and modules.

## Features

- **Modular Architecture**: Easily create and manage modules.
- **Dependency Injection**: Use decorators to inject dependencies into your classes.
- **Lifecycle Management**: Manage the lifecycle of your components seamlessly.
- **Asynchronous Module Loading**: Load modules asynchronously for improved performance.

## Installation

```bash
npm install athena-ioc reflect-metadata
```

## Quick Start

### Step 1: Define Your Modules and Providers

Create a module and a provider using decorators.

```typescript
import { Module } from 'athena-ioc';
import { Injectable } from 'athena-ioc';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}

@Module({
  providers: [AppService],
})
export class AppModule {}
```

### Step 2: Create an Application

Create and bootstrap your application.

```typescript
import { AthenaFactory } from 'athena-ioc';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await AthenaFactory.create(AppModule);
}

bootstrap();
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Author

Isqanderm (Aleksandr Melnik) - LinkedIn

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Acknowledgements

Special thanks to the developers of Angular and NestJS for the inspiration.


