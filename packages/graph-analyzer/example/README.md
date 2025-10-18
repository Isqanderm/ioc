# Realistic Blog Platform Example

This is a realistic example application that demonstrates a complex dependency injection architecture similar to real-world backend applications (NestJS, Angular, etc.).

## Application Architecture

The application is structured as a **Blog/CMS Platform** with the following layers:

### 📦 Core Modules (Infrastructure)

#### **ConfigModule**
- `ConfigService` - Application configuration management
- Provides centralized configuration for database, Redis, JWT, email, etc.

#### **LoggerModule**
- `LoggerService` - Logging service with multiple log levels
- Dependencies: `ConfigService`

#### **DatabaseModule**
- `DatabaseService` - Database connection and query execution
- Dependencies: `ConfigService`, `LoggerService`
- Simulates PostgreSQL/MySQL connection

#### **AuthModule**
- `AuthService` - Authentication and registration logic
- `JwtService` - JWT token generation and verification
- `PasswordService` - Password hashing and validation
- Dependencies: `ConfigService`, `LoggerService`

### 🔄 Shared Modules (Cross-cutting concerns)

#### **CacheModule**
- `CacheService` - Redis-like caching service
- Dependencies: `ConfigService`, `LoggerService`

#### **EmailModule**
- `EmailService` - Email sending and templating
- Dependencies: `ConfigService`, `LoggerService`
- Supports welcome emails, password reset, notifications

#### **StorageModule**
- `StorageService` - File upload and storage management
- Dependencies: `ConfigService`, `LoggerService`
- Handles avatar uploads, file attachments

### 🎯 Feature Modules (Business Logic)

#### **UsersModule**
- `UserRepository` - User data access layer
- `UsersService` - User management business logic
- Dependencies: `DatabaseService`, `CacheService`, `EmailService`, `StorageService`, `LoggerService`
- Features:
  - User CRUD operations
  - Avatar upload
  - User statistics
  - Email notifications

#### **PostsModule**
- `PostRepository` - Post data access layer
- `PostsService` - Post management business logic
- Dependencies: `DatabaseService`, `CacheService`, `UsersService`, `LoggerService`
- Features:
  - Post CRUD operations
  - Draft/Published/Archived status
  - Author verification
  - Category assignment

#### **CommentsModule**
- `CommentRepository` - Comment data access layer
- `CommentsService` - Comment management business logic
- Dependencies: `DatabaseService`, `UsersService`, `PostsService`, `EmailService`, `LoggerService`
- Features:
  - Comment CRUD operations
  - Nested comments (replies)
  - Email notifications to post authors

#### **CategoriesModule**
- `CategoryRepository` - Category data access layer
- `CategoriesService` - Category management business logic
- Dependencies: `DatabaseService`, `CacheService`, `LoggerService`
- Features:
  - Category CRUD operations
  - Hierarchical categories (parent/child)
  - Category tree building

## Module Dependency Graph

```
AppsModule
├── CoreModule
│   ├── ConfigModule
│   ├── LoggerModule → ConfigModule
│   ├── DatabaseModule → ConfigModule, LoggerModule
│   └── AuthModule → ConfigModule, LoggerModule
├── SharedModule
│   ├── CacheModule → ConfigModule, LoggerModule
│   ├── EmailModule → ConfigModule, LoggerModule
│   └── StorageModule → ConfigModule, LoggerModule
├── UsersModule → DatabaseModule, LoggerModule, CacheModule, EmailModule, StorageModule
├── PostsModule → DatabaseModule, LoggerModule, CacheModule, UsersModule
├── CommentsModule → DatabaseModule, LoggerModule, UsersModule, PostsModule, EmailModule
└── CategoriesModule → DatabaseModule, LoggerModule, CacheModule
```

## Statistics

- **Total Modules**: 14
- **Total Providers**: 17
- **Module Imports**: 41 relationships
- **Provider Dependencies**: Complex cross-module dependencies

## Architecture Patterns

### 1. **Layered Architecture**
- **Core Layer**: Infrastructure services (Config, Logger, Database, Auth)
- **Shared Layer**: Cross-cutting concerns (Cache, Email, Storage)
- **Feature Layer**: Business logic (Users, Posts, Comments, Categories)

### 2. **Repository Pattern**
- Separation of data access (`*Repository`) from business logic (`*Service`)
- Repositories handle database queries and caching
- Services handle business rules and orchestration

### 3. **Dependency Injection**
- Constructor-based dependency injection
- Module-level dependency management
- Service reusability across modules

### 4. **Module Composition**
- Core modules provide infrastructure
- Shared modules provide utilities
- Feature modules compose core + shared modules
- Clear separation of concerns

## Real-World Similarities

This example mirrors real production applications:

1. **NestJS Backend**: Similar module structure and DI patterns
2. **Angular Frontend**: Same module/service architecture
3. **Microservices**: Each feature module could be a separate service
4. **Clean Architecture**: Clear boundaries between layers

## Use Cases

This architecture supports:

- ✅ User registration and authentication
- ✅ Blog post creation and management
- ✅ Comment system with notifications
- ✅ Category organization
- ✅ File uploads (avatars)
- ✅ Email notifications
- ✅ Caching for performance
- ✅ Centralized logging
- ✅ Configuration management

## Visualization

Run the graph analyzer to visualize the complete dependency graph:

```bash
cd packages/graph-analyzer
npm run build
node dist/cli.js -f html -o output/graph.html -c example/tsconfig.json example/src/entry.ts
```

Open `output/graph.html` in a browser to explore:
- 14 modules with clear hierarchical grouping
- 17 providers organized by their parent modules
- Interactive dependency exploration
- Module import relationships

## Key Takeaways

1. **Realistic Complexity**: This example demonstrates real-world application complexity
2. **Proper Separation**: Clear separation between infrastructure, shared, and feature code
3. **Scalability**: Easy to add new features by creating new modules
4. **Testability**: Each service can be tested in isolation
5. **Maintainability**: Clear dependencies make the codebase easy to understand

