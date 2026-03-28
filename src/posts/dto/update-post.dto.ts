import { IsString, IsEnum, IsOptional, IsUrl, MinLength } from 'class-validator';
import { PostCategory, PostStatus } from '@prisma/client';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  content?: string;

  @IsOptional()
  @IsUrl()
  coverImage?: string;

  @IsOptional()
  @IsEnum(PostCategory)
  category?: PostCategory;

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}
