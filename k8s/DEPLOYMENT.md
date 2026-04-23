# Runa Deployment Notes

Bu klasor, Docker/Compose release zemininin yanina gelecek sonraki orchestration adimi icin hafif bir not birakir.

## Image Build Yollari

Root Dockerfile target'lari:

```bash
docker build --target server-runtime -t runa-server:local .
docker build --target web-runtime -t runa-web:local .
```

Uygulama bazli Dockerfile'lar:

```bash
docker build -f apps/server/Dockerfile -t runa-server:local .
docker build -f apps/web/Dockerfile -t runa-web:local .
```

## Local Rehearsal

Secret icermeyen varsayilanlar `/.env.compose` icinde tutulur.

```bash
docker compose --env-file .env.compose up --build
```

Beklenen yuzeyler:

- Web: `http://127.0.0.1:8080`
- Server health: `http://127.0.0.1:3000/health`
- Postgres: `127.0.0.1:5432`

## Boundary Notes

- Compose dosyasi local rehearsal icin Postgres ekler; boylece server DB URL'si external cloud bagimliligina zorlanmaz.
- Local rehearsal varsayilanlari storage seam'ini boot edebilmek icin placeholder Supabase storage degiskenleri verir; gercek upload/storage davranisi icin bu alanlarin secret store uzerinden gercek degerlerle override edilmesi gerekir.
- Server container'i `startServer({ host: '0.0.0.0', port })` komutunu Docker seviyesinde cagirir; runtime kodu degistirilmedi.
- Web container'i SPA static assets'i Nginx ile servis eder ve `/auth`, `/conversations`, `/upload`, `/storage`, `/health`, `/ws` yuzeylerini backend'e proxy'ler.
- Gercek production secret'lari icin `.env.server.example` sadece kontrat listesi verir; degerler secret manager, CI/CD variable store veya deployment platformu uzerinden verilmelidir.

## Next K8s Step

Bir sonraki orchestration gorevinde su mapping izlenebilir:

1. `runa-server` image'i icin `Deployment` + `Service`
2. `runa-web` image'i icin `Deployment` + `Service` veya ingress-backed static service
3. DB ve Supabase degiskenleri icin `Secret`/`ConfigMap` ayrimi
4. `/health` endpoint'ini readiness/liveness probe olarak kullanma

Bu task K8s rollout'u tamamlamaz; yalnizca Docker/Compose release zemininin nasil tasinacagini belgeleyerek sonraki adimi netlestirir.
