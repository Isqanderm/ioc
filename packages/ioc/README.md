![npm](https://img.shields.io/npm/v/nexus-ioc)
![license](https://img.shields.io/npm/l/nexus-ioc)
![CI](https://github.com/Isqanderm/ioc/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/Isqanderm/ioc/branch/main/graph/badge.svg)](https://codecov.io/gh/Isqanderm/ioc)

Nexus IoC is a powerful and flexible Inversion of Control (IoC) container for TypeScript applications. Inspired by Angular and NestJS, it leverages decorators to provide a simple and efficient way to manage dependencies and modules.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Testing](#testing)
- [License](#license)
- [Author](#author)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)
- [Wiki](#wiki)

## Features

- **Modular Architecture**: Easily create and manage modules.
- **Dependency Injection**: Use decorators to inject dependencies into your classes.
- **Lifecycle Management**: Manage the lifecycle of your components seamlessly.
- **Asynchronous Module Loading**: Load modules asynchronously for improved performance.

## Installation

```bash
npm install nexus-ioc reflect-metadata
```

## Quick Start

### Step 1: Define Your Modules and Providers

Create a module and a provider using decorators.

```typescript
import { NsModule, Injectable, Inject } from 'nexus-ioc';

@Injectable()
class DependencyService {
  public readonly name = 'World';
}

@Injectable()
export class AppService {
  constructor(
    @Inject(DependencyService)
    private readonly dependencyService: DependencyService,
  ) {
  }

  getHello(): string {
    return `Hello ${this.dependencyService.name}!`;
  }
}

@NsModule({
  providers: [AppService, DependencyService],
})
export class AppModule {}
```

### Step 2: Create an Application

Create and bootstrap your application.

```typescript
import { NexusApplications } from 'nexus-ioc';
import { AppModule, AppService } from './app.module';

async function bootstrap() {
  const app = await NexusApplications
    .create(AppModule)
    .bootstrap();

  const appService = app.get<AppService>(AppService);

  console.log(appService?.getHello());
}

bootstrap();

```

## Testing

### Installation

```bash
npm install @nexus-ioc/testing
```

### Usage 

```typescript
import { Injectable } from '@nexus-ioc/core';
import { Test } from '@nexus-ioc/testing';

describe('AppModule', () => {
  it('should create instance', async () => {
    @Injectable()
    class AppService {}

    const appModule = await Test.createModule({
      providers: [AppService],
    }).compile();

    const appService = await appModule.get<AppService>(AppService);
    expect(appService).toBeInstanceOf(AppService);
  });
});
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Author

Isqanderm (Aleksandr Melnik) - [LinkedIn](www.linkedin.com/in/isqander-melnik)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Acknowledgements

Special thanks to the developers of Angular and NestJS for the inspiration.

## Wiki

For more detailed documentation, please visit the [Wiki](https://github.com/Isqanderm/ioc/wiki).
