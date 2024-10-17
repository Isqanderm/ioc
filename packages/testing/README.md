![npm](https://img.shields.io/npm/v/@nexus-ioc/testing)
![license](https://img.shields.io/npm/l/@nexus-ioc/testing)
![build](https://img.shields.io/github/actions/workflow/status/Isqanderm/ioc/build.yml)

Test library for Nexus IoC

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [License](#license)
- [Author](#author)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)
- [Wiki](#wiki)

## Installation

```bash
npm install @nexus-ioc/core @nexus-ioc/testing
```

## Quick Start

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

For more detailed documentation, please visit the [Wiki](https://github.com/Isqanderm/ioc/wiki/Testing).
