import { Injectable, Inject } from 'nexus-ioc';
import { DatabaseService } from '../../core/database/database.service';
import { LoggerService } from '../../core/logger/logger.service';
import { CacheService } from '../../shared/cache/cache.service';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryDto {
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
}

@Injectable()
export class CategoryRepository {
  constructor(
    @Inject(DatabaseService) private database: DatabaseService,
    @Inject(CacheService) private cache: CacheService,
    @Inject(LoggerService) private logger: LoggerService
  ) {}

  async findById(id: string): Promise<Category | null> {
    const cached = await this.cache.get<Category>(`category:${id}`);
    if (cached) {
      return cached;
    }

    this.logger.debug(`Finding category by id: ${id}`, 'CategoryRepository');

    const categories = await this.database.query<Category>(
      'SELECT * FROM categories WHERE id = $1',
      [id]
    );

    const category = categories[0] || null;

    if (category) {
      await this.cache.set(`category:${id}`, category, { ttl: 3600 });
    }

    return category;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    this.logger.debug(`Finding category by slug: ${slug}`, 'CategoryRepository');

    const categories = await this.database.query<Category>(
      'SELECT * FROM categories WHERE slug = $1',
      [slug]
    );

    return categories[0] || null;
  }

  async create(data: CreateCategoryDto): Promise<Category> {
    this.logger.info(`Creating category: ${data.name}`, 'CategoryRepository');

    const category: Category = {
      id: Date.now().toString(),
      name: data.name,
      slug: data.slug,
      description: data.description,
      parentId: data.parentId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.database.query(
      'INSERT INTO categories (id, name, slug, description, parent_id) VALUES ($1, $2, $3, $4, $5)',
      [category.id, category.name, category.slug, category.description, category.parentId]
    );

    return category;
  }

  async update(id: string, data: Partial<CreateCategoryDto>): Promise<Category | null> {
    this.logger.info(`Updating category: ${id}`, 'CategoryRepository');

    const category = await this.findById(id);
    if (!category) {
      return null;
    }

    const updated: Category = {
      ...category,
      ...data,
      updatedAt: new Date()
    };

    await this.database.query(
      'UPDATE categories SET name = $1, slug = $2, description = $3, updated_at = $4 WHERE id = $5',
      [updated.name, updated.slug, updated.description, updated.updatedAt, id]
    );

    await this.cache.delete(`category:${id}`);

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    this.logger.info(`Deleting category: ${id}`, 'CategoryRepository');

    await this.database.query('DELETE FROM categories WHERE id = $1', [id]);
    await this.cache.delete(`category:${id}`);

    return true;
  }

  async findAll(): Promise<Category[]> {
    this.logger.debug('Finding all categories', 'CategoryRepository');

    return this.database.query<Category>(
      'SELECT * FROM categories ORDER BY name ASC'
    );
  }

  async findChildren(parentId: string): Promise<Category[]> {
    this.logger.debug(`Finding child categories of: ${parentId}`, 'CategoryRepository');

    return this.database.query<Category>(
      'SELECT * FROM categories WHERE parent_id = $1 ORDER BY name ASC',
      [parentId]
    );
  }
}

