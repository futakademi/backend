import { IsString, IsEnum, IsOptional, IsUrl, MinLength } from 'class-validator';
import { PostCategory, PostStatus } from '@prisma/client';

export class CreatePostDto {
  @IsString()
  @MinLength(5)
  title: string;

  @IsString()
  @MinLength(20)
  content: string;

  @IsOptional()
  @IsUrl()
  coverImage?: string;

  @IsEnum(PostCategory)
  category: PostCategory;

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus = PostStatus.draft;
}
