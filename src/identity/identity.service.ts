import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as soap from 'soap';
import { PrismaService } from '../prisma/prisma.service';
import { VerifyIdentityDto } from './dto/verify-identity.dto';

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async verifyIdentity(userId: string, dto: VerifyIdentityDto) {
    // Aktif pending_identity claim var mı?
    const claimRequest = await this.prisma.claimRequest.findFirst({
      where: { userId, status: 'pending_identity' },
      include: { player: true },
    });

    if (!claimRequest) {
      throw new NotFoundException(
        'Kimlik doğrulaması bekleyen bir profil talebiniz yok.',
      );
    }

    // NVİ SOAP çağrısı
    const nviResult = await this.callNvi(dto);

    // TCKN plaintext saklanmaz - bcrypt hash
    const tcknHash = await bcrypt.hash(dto.tckn, 12);

    // Verification kaydını oluştur
    await this.prisma.identityVerification.create({
      data: {
        userId,
        tcknHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthYear: dto.birthYear,
        nviResult,
      },
    });

    if (!nviResult) {
      throw new BadRequestException(
        'Kimlik doğrulaması başarısız. Bilgilerinizi kontrol edip tekrar deneyin.',
      );
    }

    // Claim ve kullanıcı durumunu güncelle
    await this.prisma.$transaction([
      this.prisma.claimRequest.update({
        where: { id: claimRequest.id },
        data: { status: 'pending_admin_review' },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { verificationStatus: 'pending_admin_review' },
      }),
    ]);

    return {
      message:
        'Kimliğiniz doğrulandı. Profiliniz en geç 2 saat içinde admin tarafından onaylanacaktır.',
      status: 'pending_admin_review',
    };
  }

  private async callNvi(dto: VerifyIdentityDto): Promise<boolean> {
    const endpoint = this.config.get('NVI_ENDPOINT');

    try {
      const client = await soap.createClientAsync(endpoint);
      const result = await client.TCKimlikNoDogrulaAsync({
        TCKimlikNo: dto.tckn,
        Ad: dto.firstName.toUpperCase(),
        Soyad: dto.lastName.toUpperCase(),
        DogumYili: dto.birthYear,
      });

      // NVİ true/false döner
      return result[0]?.TCKimlikNoDogrulaResult === true;
    } catch (err) {
      // NVİ erişilemiyorsa production'da fallback log at, dev'de hata fırlat
      if (this.config.get('NODE_ENV') === 'development') {
        console.warn('NVİ SOAP çağrısı başarısız (dev mode - mock true döndü):', err.message);
        return true; // Dev ortamında mock
      }
      throw new InternalServerErrorException(
        'Kimlik doğrulama servisi şu an kullanılamıyor. Lütfen tekrar deneyin.',
      );
    }
  }
}
