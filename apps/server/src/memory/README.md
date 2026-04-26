# Memory Module

## Bu modul nedir?

Bu dizin, memory alaninin mimari sinirini ve gelecekteki genisleme seam'ini temsil eder.
Bugunku concrete memory davranisi yalniz bu klasorde toplanmis degildir; `runtime/`, `context/` ve `persistence/` arasina dagilmis durumdadir.
Bu README, memory alaninin ne oldugunu ve hangi kontratlar uzerinden buyutulecegini baglam kaynagi haline getirir.

## KARAR.MD karsiligi

- Madde 3 - Memory Manager, Candidate Pipeline, Artifact Truth Store

## Implement ettigi interface'ler

Bu dizin altinda artik retrieval ve semantic-profile seam'leri vardir.
Memory alani su shared contract'lar uzerinden tanimlidir:

- `MemoryRecord` - `packages/types/src/memory.ts`
- `MemoryWriteCandidate` - `packages/types/src/memory.ts`
- `UserPreferenceMemory` - `packages/types/src/memory.ts`
- `RetrievedMemoryRecord` - `packages/types/src/memory.ts`

Concrete davranis icin bakilacak yerler:

- `apps/server/src/runtime/orchestrate-memory-write.ts`
- `apps/server/src/runtime/build-memory-write-candidate.ts`
- `apps/server/src/context/orchestrate-memory-read.ts`
- `apps/server/src/context/compose-memory-context.ts`
- `apps/server/src/persistence/memory-store.ts`
- `apps/server/src/memory/semantic-profile.ts`
- `apps/server/src/memory/retrieve-semantic-memories.ts`
- `apps/server/src/memory/search-memory-tool.ts`

## Yeni eleman eklerken takip edilecek pattern

- once `packages/types/src/memory.ts` icindeki shared shape'i netlestir
- sonra persistence / orchestration ayrimini koruyarak concrete kodu ilgili modullere dagit
- yeni memory katmani ekleniyorsa `context/` tarafinda composer kaydini ac
- memory truth ile session/run summary bilgisini birbirine karistirma
- testleri hem write hem read/composition zinciri uzerinden kur

## Bu modul ne DEGILDIR

- bugun icinde tum memory kodunun yasadigi concrete implementation klasoru degildir
- full vector database veya knowledge graph motoru degildir; Qdrant ve benzeri Phase 3 alanlari ayri tutulur
- prompt assembly modulu degildir; context composer'a tek basina donusmez
- dogrudan UI state store'u degildir
- policy veya approval sistemi degildir

## Aktif dosyalar

- `semantic-profile.ts`
- `retrieve-semantic-memories.ts`
- `search-memory-tool.ts`

## TASK-08C Embedding Provider Mini-RFC

### Karar

Bugunku release-grade minimum semantic memory icin mevcut `token_overlap_v1` profile'i kullanilir. Yeni local model, remote embedding provider, Qdrant veya pgvector dependency'si bu task'ta eklenmez.

### Degerlendirme

| Secenek | Model boyutu / ilk yukleme | CPU/memory etkisi | Offline/online | Deployment etkisi | Fallback/test |
| --- | --- | --- | --- | --- | --- |
| Existing `token_overlap_v1` helper | Model yok, lazy computation | Dusuk | Offline calisir | Yeni dependency yok | Unit test ile deterministik |
| Local `@xenova/transformers` | Model download ve warmup gerekir | Orta/yuksek | Offline cache gerekir | Binary/model artifact plan ister | Unavailable fallback sart |
| Remote embedding provider | Model Runa disinda | Dusuk local, network bagimli | Online gerekir | Provider key ve privacy kararlarini acikarir | Credential_missing path sart |
| Future Qdrant/pgvector hybrid | Harici servis veya extension | Servis maliyeti | Ortama bagli | Migration ve ops plan ister | Index unavailable fallback sart |

### Gerekce

Kapali test oncesi minimum hedef explicit memory + list/delete + privacy guard oldugu icin, semantic recall kalite artisi dependency riskinden once gelmez. `token_overlap_v1` eager model yuklemez; memory yaziminda retrieval text ve token metadata uretir, okuma tarafinda metadata yoksa deterministik hydrate eder. Boylece unavailable embedding provider durumunda fallback dogal olarak ayni typed retrieval path'ine duser.

### Sonraki karar kapisi

Gercek vector provider acilmadan once ayri bir RFC su kanitlari istemelidir: model artifact boyutu, first-load suresi, CPU/memory profili, secret/privacy etkisi, cloud/local davranis farki, index unavailable fallback ve user-visible deletion/export etkisi.
