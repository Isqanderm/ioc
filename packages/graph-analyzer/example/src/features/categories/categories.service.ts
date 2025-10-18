import { Injectable, Inject } from 'nexus-ioc';
import { CategoryRepository, Category, CreateCategoryDto } from './category.repository';
import { LoggerService } from '../../core/logger/logger.service';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(CategoryRepository) private categoryRepository: CategoryRepository,
    @Inject(LoggerService) private logger: LoggerService
  ) {}

  async getCategoryById(id: string): Promise<Category | null> {
    return this.categoryRepository.findById(id);
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    return this.categoryRepository.findBySlug(slug);
  }

  async createCategory(data: CreateCategoryDto): Promise<Category> {
    // Verify parent exists if provided
    if (data.parentId) {
      const parent = await this.categoryRepository.findById(data.parentId);
      if (!parent) {
        throw new Error(`Parent category not found: ${data.parentId}`);
      }
    }

    const category = await this.categoryRepository.create(data);

    this.logger.info(`Category created successfully: ${category.id}`, 'CategoriesService');

    return category;
  }

  async updateCategory(id: string, data: Partial<CreateCategoryDto>): Promise<Category | null> {
    const category = await this.categoryRepository.update(id, data);

    if (category) {
      this.logger.info(`Category updated successfully: ${id}`, 'CategoriesService');
    }

    return category;
  }

  async deleteCategory(id: string): Promise<boolean> {
    // Check if category has children
    const children = await this.categoryRepository.findChildren(id);
    if (children.length > 0) {
      throw new Error('Cannot delete category with children');
    }

    const deleted = await this.categoryRepository.delete(id);

    if (deleted) {
      this.logger.info(`Category deleted successfully: ${id}`, 'CategoriesService');
    }

    return deleted;
  }

  async getAllCategories(): Promise<Category[]> {
    return this.categoryRepository.findAll();
  }

  async getChildCategories(parentId: string): Promise<Category[]> {
    return this.categoryRepository.findChildren(parentId);
  }

  async getCategoryTree(): Promise<Category[]> {
    const allCategories = await this.categoryRepository.findAll();

    // Build tree structure (simplified)
    return allCategories.filter(cat => !cat.parentId);
  }
}

