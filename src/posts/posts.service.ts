import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import slugify from 'slugify';
import * as xss from 'xss';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(category?: string, page = 1, limit = 12) {
    const skip = (page - 1) * limit;
    const where: any = { status: 'published' };
    if (category) where.category = category;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          coverImage: true,
          category: true,
          viewCount: true,
          createdAt: true,
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data: posts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findBySlug(slug: string) {
    const post = await this.prisma.post.findUnique({ where: { slug } });
    if (!post || post.status !== 'published') throw new NotFoundException('Yazı bulunamadı.');

    // View count artır
    await this.prisma.post.update({
      where: { slug },
      data: { viewCount: { increment: 1 } },
    });

    return post;
  }

  async create(dto: CreatePostDto) {
    const slug = this.generateSlug(dto.title);
    const sanitizedContent = xss.filterXSS(dto.content);

    return this.prisma.post.create({
      data: { ...dto, slug, content: sanitizedContent },
    });
  }

  async update(id: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Yazı bulunamadı.');

    const updateData: any = { ...dto };
    if (dto.title && dto.title !== post.title) {
      updateData.slug = this.generateSlug(dto.title);
    }
    if (dto.content) {
      updateData.content = xss.filterXSS(dto.content);
    }

    return this.prisma.post.update({ where: { id }, data: updateData });
  }

  async remove(id: string) {
    return this.prisma.post.delete({ where: { id } });
  }

  // Admin: tüm postlar (draft dahil)
  async findAllAdmin(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.post.count(),
    ]);
    return { data: posts, meta: { total, page, limit } };
  }

  private generateSlug(title: string): string {
    return slugify(title, { lower: true, locale: 'tr', strict: true }) +
      '-' + Date.now().toString(36);
  }
}
