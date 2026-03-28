# Futakademi Backend API

NestJS + Prisma + PostgreSQL ile geliştirilmiş futbol platformu backend'i.

---

## Kurulum

### Gereksinimler
- Node.js 18+
- PostgreSQL 14+
- npm

### Adımlar

```bash
# Bağımlılıkları yükle
npm install

# .env dosyasını oluştur
cp .env.example .env
# .env dosyasını düzenle

# Prisma migration çalıştır
npx prisma migrate dev --name init

# Prisma client oluştur
npx prisma generate

# Geliştirme sunucusu
npm run start:dev
```

---

## API Endpoint Listesi

### Auth
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | /api/v1/auth/register | Kayıt ol |
| POST | /api/v1/auth/login | Giriş yap |

### Oyuncular (Public)
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | /api/v1/players | Oyuncu listesi + filtrele |
| GET | /api/v1/players/:id | Oyuncu detayı |

**Filtre parametreleri:** `name`, `position`, `club`, `league`, `birthYear`, `page`, `limit`

### Profil Claim (Premium)
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | /api/v1/claims | Claim başlat |
| GET | /api/v1/claims/me | Aktif claim durumu |
| PUT | /api/v1/claims/players/:id/custom-data | Profil düzenle |

### Kimlik Doğrulama (Premium)
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | /api/v1/identity/verify | NVİ kimlik doğrula |

### Ödeme
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | /api/v1/payments/checkout | Stripe checkout başlat |
| POST | /api/v1/payments/webhook | Stripe webhook (Stripe'dan) |

### Haberler (Public okuma, Admin yazma)
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | /api/v1/posts | Haber listesi |
| GET | /api/v1/posts/:slug | Haber detayı |
| POST | /api/v1/posts | Haber oluştur (admin) |
| PUT | /api/v1/posts/:id | Haber güncelle (admin) |
| DELETE | /api/v1/posts/:id | Haber sil (admin) |

**Filtre:** `?category=haber` veya `?category=gelisim`

### Ligler (Public okuma)
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | /api/v1/leagues | Lig listesi |
| GET | /api/v1/leagues/:id/standings | Puan durumu |
| POST | /api/v1/leagues | Lig oluştur (admin) |
| POST | /api/v1/leagues/:id/teams | Takım ekle (admin) |
| PUT | /api/v1/leagues/teams/:teamId | Takım güncelle (admin) |

### Admin
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | /api/v1/admin/dashboard | İstatistikler |
| GET | /api/v1/admin/claims/pending | Bekleyen talepler |
| PUT | /api/v1/admin/claims/:id/approve | Claim onayla |
| PUT | /api/v1/admin/claims/:id/reject | Claim reddet |
| GET | /api/v1/admin/users | Kullanıcılar |
| PUT | /api/v1/admin/users/:id/role | Rol değiştir |
| POST | /api/v1/admin/import/players | TFF oyuncu import |
| GET | /api/v1/admin/audit-logs | Audit logları |

---

## Claim Akışı

```
1. POST /payments/checkout     → Ödeme yap, premium ol
2. POST /claims                → Oyuncu seç, claim başlat
3. POST /identity/verify       → TC, Ad, Soyad, Doğum yılı gönder
4. Admin panel                 → Admin onaylar veya reddeder
5. PUT /claims/players/:id/custom-data → Profil düzenle
```

**Kurallar:**
- Maksimum 3 claim hakkı (her deneme 1 hak yakar)
- Aynı anda yalnızca 1 aktif claim açık olabilir
- Premium süresi dolarsa claim bağlantısı korunur, edit yetkisi askıya alınır

---

## Ortam Değişkenleri

| Değişken | Açıklama |
|----------|----------|
| DATABASE_URL | PostgreSQL bağlantı URL |
| JWT_SECRET | JWT imzalama anahtarı |
| JWT_EXPIRES_IN | Token geçerlilik süresi (örn: 7d) |
| STRIPE_SECRET_KEY | Stripe gizli anahtar |
| STRIPE_WEBHOOK_SECRET | Stripe webhook doğrulama |
| STRIPE_PREMIUM_PRICE_ID | Premium abonelik fiyat ID |
| NVI_ENDPOINT | NVİ SOAP servis URL |
| AWS_ACCESS_KEY_ID | S3 dosya yükleme |
| AWS_SECRET_ACCESS_KEY | S3 gizli anahtar |
| AWS_S3_BUCKET | S3 bucket adı |
| FRONTEND_URL | Frontend URL (CORS + redirect) |

---

## Güvenlik Notları

- TCKN asla plaintext saklanmaz, bcrypt(12) ile hash'lenir
- Rich text içerik XSS filtresinden geçirilir
- Tüm endpointlerde input validation (class-validator)
- Rate limiting: 100 istek/dakika
- Admin işlemleri audit log'a yazılır
- Stripe webhook imzası doğrulanır (idempotent)
- Premium süresi dolan kullanıcılar middleware'de otomatik free'ye düşer
