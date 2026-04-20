# Runa Architectural Constitution
Versiyon: 1.0  
Tarih: 09 Nisan 2026  
Durum: Kilitlendi (tüm maddeler)



Runa Architectural Constitution — Madde 1
Runtime Kernel, State Machine, Checkpointing ve Event Stream Anayasası

Durum: Kilitlendi
Kapsam: Agent runtime çekirdeği, state machine yapısı, checkpointing, idempotency, event stream standardı
Amaç: Runa’nın tüm ajan çalışma akışlarının güvenilir, yeniden başlatılabilir, ölçeklenebilir ve yüzeyden bağımsız şekilde işlemesini sağlamak

Kararın özü

Runa’nın çekirdeği tek bir basit chat request/response akışı olmayacaktır. Sistem, modüler bir agent runtime kernel etrafında inşa edilecektir. Bu kernel, kullanıcı isteğini çok adımlı şekilde işleyebilen, araç kullanabilen, state taşıyabilen, duraklayıp devam edebilen ve web, CLI, IDE, local-device agent gibi tüm yüzeylere aynı olay akışını sunabilen bir yapı olacaktır.

Runa’da “tek dev query fonksiyonu” yaklaşımı uygulanmayacaktır. Bunun yerine, ajan akışı state-machine tabanlı modüler runtime olarak tasarlanacaktır. Bu runtime, açık state geçişleri, durable step boundary’ler, checkpoint’ler, event stream ve idempotent effect management ile çalışacaktır.

Zorunlu ilkeler
1. Runtime mimarisi
Sistem, state-machine tabanlı bir runtime kernel kullanmalıdır.
Runtime, en az şu modülleri kavramsal olarak desteklemelidir:
Session Runtime
Context Composer
Model Gateway
Planner
Tool Registry
Tool Executor
Execution Scheduler
Memory Manager
Checkpoint Manager
Approval Manager
Event Publisher
Verifier
UI, runtime mantığından ayrılmalıdır. Web, CLI, IDE ve local agent aynı çekirdek event akışını tüketmelidir.
2. State management
Her run açık state’ler üzerinden ilerlemelidir.
State geçişleri deterministik ve izlenebilir olmalıdır.
State isimleri business-level anlam taşımalıdır. Örnek:
INIT
CONTEXT_READY
MODEL_THINKING
TOOL_EXECUTING
TOOL_RESULT_INGESTING
WAITING_APPROVAL
VERIFYING
COMPLETED
FAILED
“Gizli implicit akış” yerine açık state transition mantığı kullanılmalıdır.
3. Checkpointing yaklaşımı
Checkpointing modeli hibrit olacaktır:
append-only event log
periyodik ve boundary-tabanlı durable snapshot
Amaç “ajanın bilincini” saklamak değil, ajanın operasyonel yürütme state’ini korumaktır.
Her state geçişinde tam snapshot zorunlu değildir.
Checkpoint şu durable boundary’lerde oluşturulmalıdır:
önemli state transition sonrası
tool execution öncesi ve sonrası
dış dünyaya etkisi olan mutation öncesi ve sonrası
approval boundary’lerde
uzun görevlerde periyodik koruma amacıyla
Checkpoint objesi küçük, hızlı ve okunabilir tutulmalıdır.
Büyük payload’lar checkpoint içine gömülmemeli; artifact/blob/object storage referansları kullanılmalıdır.
4. Idempotency zorunluluğu
Her effectful step idempotent olacak şekilde tasarlanmalıdır.
Her effectful step için en az şu kavramlar bulunmalıdır:
step_id
idempotency_key
effect_status
Resume/replay sırasında sistem aynı mutasyonu ikinci kez bilinçsizce uygulamamalıdır.
Özellikle aşağıdaki işlemler idempotency korumasına sahip olmalıdır:
dosya yazma/düzenleme
git işlemleri
dış API mutation’ları
browser/desktop aksiyonları
gönderim işlemleri
artifact update işlemleri
5. Resume mantığı
Sistem yeniden başladığında en son durable checkpoint yüklenmelidir.
Son checkpoint sonrası event’ler replay edilerek state yeniden kurulmalıdır.
Yarım kalmış external operation’lar özel olarak kontrol edilmelidir.
Resume sonrası runtime:
tamamlanmış etkileri tekrar uygulamamalı
bekleyen approval’ları doğru restore etmeli
açık tool execution durumlarını doğrulamalı
devam edilebilir state’e geri dönebilmelidir
6. Event stream standardı
Event stream yapısı versioned envelope + typed payload modelini kullanmalıdır.
Tüm event’lerde ortak bir zarf bulunmalıdır. En az şu alanlar önerilir:
event_id
event_version
event_type
timestamp
sequence_no
session_id
run_id
trace_id
parent_event_id
source
actor
state_before
state_after
payload
metadata
Payload, event type’a göre değişebilir; ancak zarf standardı korunmalıdır.
Aynı event akışı UI, tracing, replay, eval ve analytics sistemleri tarafından kullanılabilir olmalıdır.
7. Başlangıç event ailesi

İlk sürümde event şeması minimum ama sağlam tutulmalıdır. Başlangıçta aşağıdaki temel event aileleri yeterlidir:

run.started
state.entered
model.completed
tool.call.started
tool.call.completed
approval.required
checkpoint.created
assistant.message.completed
run.failed
run.completed

Sistem olgunlaştıkça event ailesi genişletilebilir; ancak ilk sürümde schema hell yaratacak aşırı detaydan kaçınılmalıdır.

Yasak / kaçınılacak yaklaşımlar
Tek dev query() fonksiyonu içinde tüm runtime mantığını biriktirmek
UI’ya özel ajan mantıkları yazmak
Resume mantığını yalnızca ham chat transcript’e dayanarak kurmak
Checkpoint içine büyük blob, dev tool output veya tüm transcript’i gömmek
Effectful action’ları idempotency olmadan çalıştırmak
Serbest biçimli, standardsız event JSON’ları üretmek
Her küçük olayda ağır snapshot alarak sistemi IO cehennemine sokmak
State geçişlerini kod içinde dağınık if-else zincirleriyle gizlemek
Uygulama çerçevesi

Runa runtime’ı aşağıdaki stratejiyle uygulanmalıdır:

Çekirdek akış: state-machine tabanlı runtime
Dayanıklılık: hibrit checkpointing
Tekrar güvenliği: idempotent effect handling
Gözlemlenebilirlik: versioned event envelope
Yüzey bağımsızlığı: ortak event protocol
Genişleyebilirlik: modüler executor/scheduler yapısı

Bu mimari, ileride:

web browsing
coding agent
local device control
MCP tools
background daemons
multi-step research
human approval flows
verifier pipelines

gibi yetenekleri aynı omurga üzerinde taşıyabilecek şekilde tasarlanmalıdır.

Kabul kriterleri

Bir runtime implementasyonu, Madde 1 ile uyumlu sayılabilmesi için en az şu şartları sağlamalıdır:

Çalışma akışı state-machine mantığıyla modellenmiş olmalı
Run çöktüğünde veya yeniden başladığında durable checkpoint’ten devam edebilmeli
Aynı effectful step ikinci kez bilinçsizce uygulanmamalı
Event stream tüm yüzeyler için ortak sözleşme sunmalı
Approval boundary’ler ve dış etki oluşturan işlemler açıkça yönetilmeli
Debug ve replay mümkün olmalı
Runtime mantığı UI’dan bağımsız olmalı
Kısa mimari özeti

Runa, tek cevap üreten bir chat backend olarak değil; durum taşıyan, yeniden başlatılabilen, araç kullanan ve gözlemlenebilir bir agent runtime platformu olarak inşa edilecektir. Bu platformun çekirdeği state-machine tabanlı olacaktır. Güvenilirlik hibrit checkpointing ile, güvenli tekrar çalıştırma idempotency ile, görünürlük ise versioned event stream ile sağlanacaktır.

Madde 1’in resmi kararı:
Runa runtime mimarisi = modüler state-machine kernel + hibrit checkpointing + idempotent effect model + versioned event stream






Runa Architectural Constitution — Madde 2
Context Composer, System Prompt Assembly, Cache Regions, Budgeting ve Compilation Anayasası

Durum: Kilitlendi
Kapsam: System prompt mimarisi, context assembly, katman yapısı, cache region tasarımı, token budgeting, compile latency yönetimi
Amaç: Runa’nın her model turunda doğru bağlamı, kontrollü maliyetle, düşük gecikmeyle, açıklanabilir ve sağlayıcıdan bağımsız biçimde oluşturmasını sağlamak

Kararın özü

Runa’da system prompt tek parça bir metin, sabit bir prompt dosyası veya gelişi güzel büyüyen string birikimi olarak yönetilmeyecektir. Bunun yerine tüm model bağlamı, katmanlı ve versiyonlu bir Context Composer tarafından üretilecektir.

Bu composer, farklı kaynaklardan gelen bağlamı tek bir “compiled context artifact” haline getirecek; her katmanın önceliğini, bütçesini, cache davranışını ve sağlayıcıya göre uyarlanma biçimini yönetecektir.

Amaç, yalnızca modele bilgi göndermek değil;
doğru bilgi + doğru öncelik + doğru maliyet + doğru gecikme dengesini kurmaktır.

Zorunlu ilkeler
1. Prompt yazılmaz, derlenir
System prompt tek parça sabit metin olmayacaktır.
Model çağrısına giden bağlam, bir Context Composer pipeline tarafından üretilecektir.
Composer çıktısı, versiyonlu ve debug edilebilir bir “compiled context artifact” olmalıdır.
Her run için “modele ne gönderildi?” görünürlüğü sağlanmalıdır.
2. Katmanlı yapı zorunludur

İlk sürümde context en az şu 6 katmandan oluşmalıdır:

Core Rules Layer
Ürünün temel davranış kuralları, iletişim prensipleri, genel ajansal davranış standardı
Policy Layer
Güvenlik, izin, escalation, mutasyon kısıtları, approval ilkeleri
Surface Layer
Web, CLI, IDE, local-device agent gibi yüzeylere göre davranış farkları
Workspace Layer
Proje manifesti, repo kuralları, stack bilgisi, kritik sınırlamalar, dokunulmaması gereken alanlar
Run Layer
Aktif görev özeti, plan, alt görevler, çalışma amacı, mevcut durum
Memory Layer
İlgili ve geri çağrılmış kısa hafıza özetleri, kullanıcı tercihleri, görev geçmişi sinyalleri

Bu katmanlar açık öncelik sırasıyla birleştirilecektir.

3. Provider-aware cache regions zorunludur
İç sistem, bağlamı doğrudan tek bir sağlayıcının prompt formatına göre tasarlamayacaktır.
Bunun yerine, context katmanları mantıksal cache regions içinde organize edilecektir.
Sağlayıcı adaptörleri bu mantıksal bölgeleri ilgili model sağlayıcısının desteklediği cache/context temsiline çevirecektir.
Böylece sistem tek modele mahkum olmayacak, OpenAI, Anthropic, Gemini ve yerel modeller arasında taşınabilir kalacaktır.
4. Mantıksal cache region modeli

Runa en az şu mantıksal bölgeleri desteklemelidir:

Immutable Region
Neredeyse hiç değişmeyen katmanlar
Örnek: Core Rules
Semi-static Region
Tenant, surface veya workspace seviyesinde yavaş değişen katmanlar
Örnek: Policy, Surface, Workspace
Dynamic Region
Run/session boyunca düzenli güncellenen katmanlar
Örnek: Run Layer
Transient Turn Region
Sadece o tur için anlamlı olan kısa bağlam parçaları
Örnek: anlık tool özeti, turn-specific instruction

Bu ayrım, maliyet ve gecikme optimizasyonunun ana mekanizması olacaktır.

5. Katman bazlı budgeting zorunludur
Her katman sınırsız büyümeye bırakılmayacaktır.
Her katman için token budgeting uygulanacaktır.
Bu budgeting sabit tek limit değil, adaptive hierarchical budgeting modeliyle çalışacaktır.

Her katmanda en az şu kavramlar bulunmalıdır:

min_budget
target_budget
max_budget

Katmanlar ayrıca üç sınıfa ayrılmalıdır:

Mandatory layers
Priority elastic layers
Secondary elastic layers

Önerilen sınıflama:

Mandatory: Core, Policy
Priority elastic: Run, Memory
Secondary elastic: Surface, Workspace
6. Reserve budget zorunludur
Toplam context bütçesinin tamamı katmanlara dağıtılmayacaktır.
Her model çağrısında belirli bir reserve budget bırakılacaktır.
Bu rezerv, transient turn bağlamı, tool dönüşleri, kısa planlama blokları ve provider farkları için kullanılacaktır.
7. Compression ladder zorunludur
Bir katman hedef bütçesini aştığında rastgele kırpılmayacaktır.
Her katman için önceden tanımlanmış bir compression ladder bulunmalıdır.

Örnek basamaklar:

tam içerik
kısa özet
çok kısa özet
pointer/reference only
drop
Her katmanın taşma anında nasıl küçüleceği önceden belirlenmelidir.
Budgeting yalnızca sayı yönetimi değil, anlam kaybını kontrollü yönetme mekanizması olarak ele alınmalıdır.
8. Compilation low-latency olacak şekilde tasarlanmalıdır
Composer çalışması, model çağrısına göre düşük gecikmeli tutulmalıdır.
Compilation aşaması ağır retrieval motoruna dönüşmemelidir.
Context Composer’ın işi öncelikle assembly, ordering, budgeting, compression ve packaging olmalıdır.
Ağır retrieval, ranking ve hafıza seçimi ayrı alt servisler veya pipeline bileşenleri tarafından hazırlanmalıdır.
9. Hybrid incremental compilation zorunludur
Her model turunda her katman baştan pahalı biçimde yeniden hesaplanmayacaktır.
Derleme sistemi hybrid incremental compilation yaklaşımını kullanacaktır.
Bazı katmanlar uzun ömürlü cache ile tutulacak, bazı katmanlar fingerprint değiştiğinde yeniden derlenecek, bazıları ise her tur yeniden üretilecektir.

Örnek:

Core / Policy → uzun ömürlü cache
Surface → session seviyesinde cache
Workspace → manifest veya repo fingerprint’ine bağlı cache
Run → olay bazlı sık güncelleme
Memory → selected memory set değiştiğinde güncelleme
10. Layer fingerprinting zorunludur

Her katmanın yeniden derlenip derlenmeyeceğine karar verebilmek için fingerprint mantığı kullanılmalıdır.

Örnek fingerprint kaynakları:

Core → rule version
Policy → tenant policy version + org policy version
Surface → surface mode + client version
Workspace → manifest checksum + repo state marker
Run → task graph version
Memory → selected memory ids + summary version

Fingerprint değişmiyorsa katman gereksiz yere yeniden compile edilmemelidir.

11. Token accounting görünür olmalıdır
Her compiled context için per-layer token accounting tutulmalıdır.
Hangi katmanın ne kadar yer kapladığı görülebilmelidir.
Hangi katmanın hangi seviyede sıkıştırıldığı izlenebilmelidir.
Bu görünürlük olmadan sistem prompt kalitesi yönetilemez.
Yasak / kaçınılacak yaklaşımlar
Tüm system prompt’u tek bir dev metin olarak yönetmek
Her ekip üyesinin prompt’a kontrolsüz metin eklemesine izin vermek
Sadece “statik + dinamik” şeklinde aşırı kaba bir ayrımla uzun vadeli sistem kurmak
Tek sağlayıcının caching davranışına göre prompt mimarisi tasarlamak
Katmanlar için bütçe koymadan bağlamın zamanla şişmesine izin vermek
Bütçe aşıldığında rastgele string kırpma yapmak
Composer içine ağır retrieval ve ranking mantığını gömmek
Her tur tüm katmanları sıfırdan pahalı biçimde yeniden derlemek
Fingerprinting ve invalidation mantığı olmadan agresif cache kullanmak
“Prompt modülerliği” adı altında sahipliği belirsiz layer kaosu yaratmak
Uygulama çerçevesi

Runa Context Composer aşağıdaki ilkelere göre uygulanmalıdır:

Katmanlı context assembly
Deterministic merge order
Provider-agnostic internal model
Provider-aware external adaptation
Adaptive token budgeting
Compression ladder
Reserve budget
Incremental compilation
Layer fingerprinting
Per-layer token accounting
Debuggable compiled output

Bu yapı, ileride:

çok yüzeyli kullanım
tenant bazlı davranış
proje bazlı çalışma
güçlü hafıza entegrasyonu
çok sağlayıcılı model routing
tool-heavy ajan davranışları

gibi ihtiyaçları bozulmadan taşıyabilmelidir.

Kabul kriterleri

Bir Context Composer implementasyonu, Madde 2 ile uyumlu sayılabilmesi için en az şu şartları sağlamalıdır:

Context tek parça prompt değil, katmanlı assembly ile üretiliyor olmalı
En az 6 temel katman açıkça tanımlanmış olmalı
Sağlayıcıdan bağımsız mantıksal cache region modeli bulunmalı
Katman bazlı min/target/max budgeting uygulanıyor olmalı
Reserve budget ayrılmış olmalı
Her katmanın compression ladder’ı tanımlı olmalı
Compilation pipeline fingerprint tabanlı incremental çalışabiliyor olmalı
Per-layer token accounting görülebiliyor olmalı
Compiled context debug edilebilir olmalı
Composer, retrieval motoruna dönüşmeden düşük gecikmeli çalışmalı
Kısa mimari özeti

Runa’da modele giden bağlam, tek parça prompt değil; çok katmanlı, bütçeli, cache-aware ve sağlayıcıdan bağımsız bir compiled context artifact olacaktır. Bu artifact, Context Composer tarafından üretilecek; her katmanın önceliği, cache karakteri, sıkıştırma stratejisi ve sağlayıcı uyarlaması açık biçimde yönetilecektir.

Madde 2’nin resmi kararı:
Runa context mimarisi = multi-layered context composer + provider-aware cache regions + adaptive hierarchical budgeting + hybrid incremental compilation 









Runa Architectural Constitution — Madde 3
Memory, Context Management, Compaction, Artifact Truth Store ve Memory Candidate Pipeline Anayasası

Durum: Kilitlendi
Kapsam: Hafıza mimarisi, aktif bağlam yönetimi, compaction stratejisi, ham kayıt deposu, memory write governance
Amaç: Runa’nın uzun oturumlarda, çok adımlı görevlerde ve tekrar eden proje çalışmalarında doğruluğunu, sürekliliğini ve bağlamsal zekasını korumak

Kararın özü

Runa’da “context window” ile “memory” aynı şey olarak ele alınmayacaktır. Aktif modele verilen bağlam, toplam hafızanın yalnızca küçük ve seçilmiş bir parçası olacaktır. Hafıza sistemi çok katmanlı şekilde tasarlanacak; ham gerçekler, çalışma özetleri, proje bilgisi ve kullanıcı tercihleri birbirine karıştırılmadan yönetilecektir.

Runa’nın amacı her şeyi her tur modele taşımak değil;
doğru bilgiyi doğru katmanda saklamak, gerektiğinde geri çağırmak ve aktif çalışma alanını küçük ama güçlü tutmaktır.

Zorunlu ilkeler
1. Memory tek bir kutu değildir

Runa memory mimarisi tek katmanlı olmayacaktır. En az aşağıdaki 5 ana bileşen bulunmalıdır:

Working Context
O anki model çağrısına verilen canlı ve sınırlı bağlam
İçerik örnekleri:
aktif görev özeti
kısa plan
son tool sonuçlarının kısa özeti
gerekli memory recall parçaları
son konuşma akışı için kritik kısa bağlam
Session / Run Memory
Mevcut çalışma akışı boyunca oluşan ve run’a özgü hafıza
İçerik örnekleri:
hangi hipotezler denendi
ne başarısız oldu
hangi dosyalar kritik bulundu
bu run içinde alınan kararlar
bekleyen veya gerçekleşen approval bilgileri
Workspace / Project Memory
Projeye, repoya veya çalışma alanına özgü uzun ömürlü bilgi
İçerik örnekleri:
tech stack
build/test alışkanlıkları
proje kuralları
kritik ve dokunulmaması gereken alanlar
repo’ya özgü çalışma normları
User / Preference Memory
Kullanıcının uzun vadeli tercihleri ve çalışma alışkanlıkları
İçerik örnekleri:
diff gösterme tercihi
yanıt detay seviyesi
approval beklentileri
preferred workflow biçimi
Artifact / Transcript Truth Store
Ham gerçeklerin, büyük çıktılarının ve kaynak kayıtların deposu
İçerik örnekleri:
tam tool output’ları
transcript geçmişi
diff ve patch içerikleri
test çıktıları
log’lar
ekran veya dosya snapshot referansları
büyük execution artifact’ları
2. Artifact Store hakikat deposudur
Artifact / Transcript Truth Store, sistemin ham gerçeklik katmanı olacaktır.
Diğer memory katmanları bu depodan türetilebilir; ancak Artifact Store onların yerine geçmez.
Ham kayıtlar ile bunlardan türetilen özetler veya çıkarımlar birbirine karıştırılmamalıdır.
Özet veya kısa temsil hiçbir zaman tek başına tek hakikat kaynağı sayılmamalıdır.
3. Active context küçük tutulmalıdır
Working Context, tüm hafızayı temsil etmeye çalışmayacaktır.
Modele yalnızca o tur için gerekli, seçilmiş ve kısa bağlam verilecektir.
Amaç, “her şeyi bağlama yığmak” değil; küçük bağlam içinde yüksek fayda sağlamaktır.
4. Operational state ile semantic retrieval ayrıdır
Task state, approval state, execution state ve user preference bilgileri yalnızca vector retrieval ile yönetilmeyecektir.
Semantic retrieval faydalı olabilir, ancak operational memory katmanının yerini almayacaktır.
Özellikle ajan davranışını etkileyen görev/hakikat/izin durumları daha deterministik mekanizmalarla saklanmalıdır.
5. Hibrit compaction zorunludur

Runa context/memory sistemi, tek tür sıkıştırma yerine hibrit bir compaction modeli kullanacaktır:

Proactive compaction
Context limiti yaklaşmadan önce önleyici sıkıştırma
Reactive compaction
Budget aşıldığında veya sağlayıcı/model sınır hatası alındığında tepki bazlı sıkıştırma
Selective collapse
Büyük tool output’larının, log’ların, test sonuçlarının veya transcript bloklarının aktif bağlamdan çıkarılıp kısa temsile dönüştürülmesi
Targeted un-collapse
Gerektiğinde yalnızca ilgili parçanın Artifact Store’dan yeniden açılması ve working context’e kontrollü biçimde geri alınması
6. Collapse / un-collapse mantığı geri alınabilir olmalıdır
Büyük içerik aktif bağlamdan çıkarıldığında yok edilmemeli, Artifact Store referansı ile korunmalıdır.
Aktif bağlamda kısa bir temsil bırakılabilir.
Gerekli olduğunda yalnızca ilgili kısım yeniden geri çağrılabilmelidir.
Böylece aktif context küçük kalırken geçmiş gerçeklere kontrollü erişim korunur.
7. Memory yazma işlemi yönetilen bir süreçtir
Runa’da her yeni bilgi otomatik olarak kalıcı hafızaya yazılmayacaktır.
Hafıza güncellemesi, sınıflandırılmış ve yönetilen bir süreç olmalıdır.
Özellikle kullanıcı tercihleri, proje kuralları ve uzun vadeli kararlar rastgele değil, kontrollü biçimde yazılmalıdır.
8. Memory Candidate Pipeline zorunludur

Runa’da başlangıç yaklaşımı tam otomatik background memory consolidation olmayacaktır. Bunun yerine:

sistem hafıza adayı üretir
adayları kategorize eder
puanlar
risk düzeyini belirler
bazı düşük riskli adayları otomatik kabul edebilir
belirsiz veya kritik adayları review / onay akışına sokar

Bu yapı, romantik ama riskli tam otomatik “kendi kendine kesin hafıza üretme” modelinin yerine kontrollü ve izlenebilir bir memory write governance sağlayacaktır.

9. Özet ile ham gerçek ayrıştırılmalıdır
Session summary, workspace summary veya user summary gibi türetilmiş yapılar desteklenebilir.
Ancak summary katmanı ile Artifact Truth Store ayrı tutulmalıdır.
Özetler gerektiğinde güncellenebilir, ama ham gerçek referansları korunmalıdır.
Bu ayrım bozulursa ajan zamanla yanlış ama ikna edici hafıza üretir.
10. Memory recall seçici olmalıdır
Her tur tüm hafıza geri çağrılmayacaktır.
Recall, görev tipine, yüzeye, çalışma alanına ve kullanıcının niyetine göre seçici yapılmalıdır.
Memory sistemi küçük ama yüksek sinyal taşıyan bağlam parçalarını üretmeye odaklanmalıdır.
Yasak / kaçınılacak yaklaşımlar
Context window’u doğrudan hafıza sistemi gibi kullanmak
Tüm geçmişi sürekli aktif modele yüklemeye çalışmak
Tüm memory’yi yalnızca vector DB ile çözmeye çalışmak
Ham gerçek ile summary katmanını birbirine karıştırmak
Büyük tool output’larını veya transcript bloklarını sürekli aktif context içinde tutmak
Rastgele ve kuralsız otomatik memory yazımı yapmak
Tam otomatik, görünmez ve geri izlenemez “sessiz memory consolidation” süreçlerine erken aşamada güvenmek
Hangi bilginin hangi memory katmanına ait olduğunu belirsiz bırakmak
Yanlış veya düşük güvenli bilgiyi kalıcı hafızaya kolayca yazmak
Uygulama çerçevesi

Runa memory mimarisi aşağıdaki ilkelere göre uygulanmalıdır:

Katmanlı memory modeli
Küçük active context
Truth Store merkezli grounding
Controlled compaction
Artifact reference tabanlı collapse
Gerektiğinde targeted un-collapse
Session, project ve user memory ayrımı
Managed memory write pipeline
Candidate scoring ve review mekanizması
Summary ve raw truth ayrımı

Bu yapı, ileride:

uzun coding session’ları
çok adımlı research akışları
kullanıcı tercihi taşıma
proje bazlı ajan uzmanlaşması
background task sürekliliği
düşük token maliyetli uzun oturumlar

gibi kullanım senaryolarını güvenli ve tutarlı biçimde desteklemelidir.

Kabul kriterleri

Bir memory/context implementasyonu, Madde 3 ile uyumlu sayılabilmesi için en az şu şartları sağlamalıdır:

Memory en az 5 ana bileşene ayrılmış olmalı
Artifact / Transcript Truth Store ayrı ve korunmuş olmalı
Working Context tüm hafızayı taşımaya çalışmıyor olmalı
Session, Workspace ve User memory birbirinden ayrılmış olmalı
Hibrit compaction uygulanıyor olmalı
Collapse edilen büyük bağlam parçaları referansla korunuyor olmalı
Gerekli olduğunda targeted un-collapse yapılabiliyor olmalı
Memory write işlemi candidate pipeline ile yönetiliyor olmalı
Summary ile raw truth ayrımı korunuyor olmalı
Recall seçici ve bağlama duyarlı çalışıyor olmalı
Kısa mimari özeti

Runa’da hafıza, tek bir veri deposu veya tek bir vector katmanı olarak değil; çalışma bağlamı, oturum hafızası, proje hafızası, kullanıcı hafızası ve hakikat deposu olarak ayrıştırılmış çok katmanlı bir sistem olarak tasarlanacaktır. Aktif modele verilen bağlam küçük tutulacak; büyük gerçek kayıtlar Artifact Truth Store’da korunacak; compaction geri alınabilir olacak; memory write işlemi ise otomatik ama kontrolsüz değil, candidate pipeline üzerinden yönetilecektir.

Madde 3’ün resmi kararı:
Runa memory mimarisi = 5 katmanlı memory sistemi + Artifact Truth Store + hibrit compaction + collapse/un-collapse + memory candidate pipeline










Runa Architectural Constitution — Madde 4
Tool Plane, Capability Registry, Parallel Execution, Permission Engine ve Layered Editing Anayasası

Durum: Kilitlendi
Kapsam: Tool sistemi, capability registry, semantic-first tool kullanımı, parallel execution, action-context permission modeli, dosya düzenleme mimarisi
Amaç: Runa’nın araç kullanımını güvenli, güçlü, denetlenebilir, ölçeklenebilir ve yüksek kaliteli hale getirmek

Kararın özü

Runa’da tool use, prompt içinde rastgele karar verilen yardımcı fonksiyonlar olarak değil; runtime’ın birinci sınıf execution plane’i olarak tasarlanacaktır. Araçlar merkezi bir registry içinde tanımlanacak, zengin meta-veri taşıyacak, güvenlik ve concurrency kurallarıyla yönetilecek, parallel execution scheduler tarafından kontrol edilecek ve dosya düzenleme işlemleri semantik katmanlar üzerinden yürütülecektir.

Runa’nın temel yaklaşımı şudur:

Semantic-first
Capability-rich registry
Model proposes, scheduler decides
Action-context tabanlı permission
Layered editing before generic shell

Amaç, yalnızca “iş yapılabilsin” değil;
doğru iş doğru araçla, izlenebilir, güvenli ve tekrar edilebilir şekilde yapılsın ilkesini kalıcı hale getirmektir.

Zorunlu ilkeler
1. Tool plane, runtime’ın birinci sınıf parçasıdır
Tool sistemi yardımcı eklenti mantığında değil, agent runtime’ın çekirdek execution plane’i olarak tasarlanmalıdır.
Araç kullanımı scheduler, policy engine, audit sistemi ve state machine ile entegre çalışmalıdır.
Tool çağrıları gözlemlenebilir, sınırlandırılabilir ve yeniden yürütülebilir nitelikte olmalıdır.
2. Katmanlı tool plane zorunludur

Runa tool sistemi en az şu mantıksal katmanları desteklemelidir:

Semantic Tools
Yüksek anlamlı, güvenli, dar amaçlı ve öncelikli araçlar
Örnekler:
ReadFile
EditFile
ApplyPatch
SearchCode
RunTests
CreateDiff
Structured Capability Tools
Daha geniş ama hala yapılandırılmış araçlar
Örnekler:
GitInspect
BrowserNavigate
WorkspaceQuery
MemoryRecall
Escape Hatch Tools
Genel ama kontrollü araçlar
Örnekler:
ShellExec
PythonExec
TerminalCommand
External / MCP Tools
Dış sistemler ve entegrasyon araçları
Örnekler:
GitHub
Jira
Notion
internal service tools
MCP server tools
3. Semantic-first yaklaşımı zorunludur
Runa ana yol olarak specialized/semantic tool’ları kullanmalıdır.
Generic shell veya terminal araçları ilk tercih olmamalıdır.
Aynı iş daha güvenli ve anlamlı bir specialized tool ile yapılabiliyorsa öncelik her zaman specialized tool’a verilmelidir.
Shell, yalnızca gerekli olduğunda kontrollü fallback olarak kullanılmalıdır.
4. Capability-rich Tool Registry zorunludur

Runa’da tool registry yalnızca isim ve açıklama listesi olmayacaktır. Her tool en az şu metadata’yı desteklemelidir:

tool_id
namespace
description
input schema
output schema
capability class
risk level
side-effect level
idempotency behavior
timeout policy
concurrency policy
approval requirement
surface availability
model visibility mode
audit/logging policy
source/origin (native, MCP, plugin, internal, external)
cost hints

Registry, tool seçimi, permission değerlendirmesi, concurrency yönetimi, observability ve gelecekteki capability marketplace yapıları için temel kaynak olmalıdır.

5. Parallel execution scheduler tarafından yönetilmelidir
Paralellik yalnızca modelin prompt içi yönlendirmesi ile yürütülmeyecektir.
Model veya planner bağımsız işleri paralel yapılabilir olarak önerebilir.
Ancak son karar scheduler tarafından verilecektir.

Bu ilke şu şekilde uygulanacaktır:

Model proposes, scheduler decides

Scheduler karar verirken en az şu unsurları değerlendirmelidir:

tool concurrency policy
kaynak çakışması
aynı resource üzerinde yazma riski
risk seviyesi
timeout ve quota durumu
ordering gerekliliği
merge / fan-in stratejisi
partial failure davranışı
6. Paralellik prompt değil runtime konusudur
“Aynı anda yap” mantığı yalnızca prompt tavsiyesi olarak bırakılmayacaktır.
Runtime scheduler gerçek concurrency kontrolü, cancelation, retry, timeout ve merge mantığını yönetecektir.
Böylece modelin niyeti ile sistemin güvenli davranışı dengelenmiş olacaktır.
7. Permission modeli action-context tabanlı olmalıdır
İzin kararı yalnızca tool adına göre verilmeyecektir.
Runa’da permission değerlendirmesi şu bağlama göre yapılmalıdır:
tool tipi
istenen aksiyon
yan etki seviyesi
hedef kaynak
kullanıcı veya tenant policy
mevcut approval scope
surface mode
sandbox durumu

Aynı tool farklı çağrılarda farklı risk taşıyabilir.
Bu nedenle güvenlik değerlendirmesi isim bazlı değil, aksiyon bağlamı bazlı olmalıdır.

8. Policy engine zorunludur
Tool plane, basit allow/deny mantığı ile sınırlı kalmayacaktır.
Runa bir policy engine üzerinden karar vermelidir.
Policy engine:
izin verebilir
reddedebilir
onay isteyebilir
sandbox’a zorlayabilir
daha güvenli alternatife yönlendirebilir
9. Katmanlı edit sistemi zorunludur

Dosya düzenleme işlemleri için Runa tek bir kaba yöntem kullanmayacaktır. En az şu yaklaşım benimsenmelidir:

Basit semantik düzenleme
ReadFile / EditFile / ApplyPatch
Yapısal / AST-aware düzenleme
Gerektiğinde syntax-aware veya LSP/AST destekli araçlar
Fallback scripting / shell editing
Specialized yöntemlerin kapsamadığı alanlarda kontrollü fallback

Bu ilkenin özü şudur:

Önce semantik, sonra yapısal, en son genel kaçış alanı

10. Audit ve observability zorunludur
Her tool çağrısı loglanmalı ve izlenebilir olmalıdır.
Hangi tool’un ne amaçla çağrıldığı görülebilmelidir.
Yan etki oluşturan işlemler için audit trail tutulmalıdır.
Tool çağrıları runtime event stream ve tracing sistemi ile entegre olmalıdır.
11. Shell kontrollü escape hatch’tir
Shell/terminal gücü korunacaktır.
Ancak shell ana execution yolu olmayacaktır.
Shell kullanımı:
policy kontrolünden geçmeli
risk değerlendirmesi almalı
mümkünse sandbox içinde çalışmalı
timeout ve output sınırlarına tabi olmalı
audit edilmelidir
Yasak / kaçınılacak yaklaşımlar
Tool use’u prompt içinde rastgele bırakmak
Merkezi registry olmadan araçları dağınık biçimde yönetmek
Her işi shell ile çözmeye çalışmak
Specialized tool varken generic tool kullanmayı ana davranış yapmak
Tool’ları yalnızca isim ve input schema ile tanımlamak
Paralelliği yalnızca model niyetine bırakmak
Aksiyon bağlamını dikkate almadan tool bazlı kaba allow/deny kararları vermek
Dosya düzenlemeyi kontrolsüz shell script’leri ile ana yöntem haline getirmek
Tool çağrılarını audit ve tracing dışında bırakmak
Dış entegrasyonları runtime ve policy omurgasından bağımsız çalıştırmak
Uygulama çerçevesi

Runa tool mimarisi aşağıdaki ilkelere göre uygulanmalıdır:

Central capability-rich registry
Semantic-first tool selection
Structured fallback layers
Policy-driven execution
Scheduler-managed parallelism
Context-sensitive permission model
Layered editing pipeline
Auditability
Timeout, quota ve concurrency guard’ları
MCP ve external tool’lar için birleşik capability modeli

İlk sürümde Runa en az şu tool ailelerini desteklemelidir:

file.*
search.*
edit.*
git.*
test.*
browser.*
memory.*
shell.*
mcp.* (gated)

Bu aileler ileride genişleyebilir; ancak v1’de amaç çok sayıda araç değil, kaliteli ve iyi tanımlı araç omurgası kurmaktır.

Kabul kriterleri

Bir tool plane implementasyonu, Madde 4 ile uyumlu sayılabilmesi için en az şu şartları sağlamalıdır:

Tool sistemi runtime’ın çekirdek execution plane’i olarak modellenmiş olmalı
Tool’lar katmanlı mantıkla sınıflandırılmış olmalı
Semantic-first yaklaşım uygulanıyor olmalı
Registry, capability-rich metadata taşıyor olmalı
Parallel execution scheduler tarafından yönetiliyor olmalı
“Model proposes, scheduler decides” ilkesi uygulanıyor olmalı
Permission değerlendirmesi action-context tabanlı çalışıyor olmalı
Policy engine tool kararlarını etkiliyor olmalı
Dosya düzenleme katmanlı edit sistemi ile yapılıyor olmalı
Tool çağrıları audit ve observability sistemine bağlı olmalı
Kısa mimari özeti

Runa’da araç kullanımı rastgele function-calling değil; güçlü, katmanlı ve politika kontrollü bir execution plane olarak tasarlanacaktır. Semantic tool’lar ana yol olacak, generic shell kontrollü fallback olarak kalacak, paralellik scheduler tarafından yönetilecek, permission kararları aksiyon bağlamına göre verilecek ve dosya düzenleme işlemleri katmanlı edit sistemi üzerinden yürütülecektir.

Madde 4’ün resmi kararı:
Runa tool mimarisi = katmanlı tool plane + capability-rich registry + semantic-first execution + scheduler-managed parallelism + action-context permission engine + layered editing









Runa Architectural Constitution — Madde 5
UI/UX Yaklaşımı, Presentation Layer, Render Blocks, Streaming, Interaction Blocks ve Surface Renderers Anayasası

Durum: Kilitlendi
Kapsam: UI/UX mimarisi, rendering katmanı, event-to-presentation dönüşümü, render block standardı, streaming davranışı, approval interaction contract’ı, transport soyutlaması, block versioning, büyük çıktı yönetimi ve degraded/error rendering
Amaç: Runa’nın web, CLI/TUI, IDE ve local agent yüzeylerinde aynı runtime gerçekliğini tutarlı, açıklanabilir, zengin ve yüzeye uygun biçimde sunmasını sağlamak

Kararın özü

Runa’da hiçbir yüzey “tek gerçek arayüz” olmayacaktır. Sistem CLI-first değil, UI-agnostic ama developer-strong presentation architecture ile tasarlanacaktır. Runtime kendi canonical event stream’ini üretecek; bu event’ler backend-side çalışan bir Canonical Presentation Mapper tarafından yüzeyden bağımsız Standardized Render Blocks yapısına dönüştürülecek; ardından her surface bu blokları kendi doğal UX biçiminde render edecektir.

Runa’nın presentation mimarisi şu zincir üzerine kurulacaktır:

Runtime Event Stream → Canonical Presentation Mapper → Standardized Render Blocks → Surface-native Renderers

Bu mimaride:

event stream sistemsel gerçektir,
render blocks presentation sözleşmesidir,
surface renderers ise bu sözleşmenin yüzeye özgü görünümüdür.

Amaç yalnızca çıktı göstermek değil;
ajanın ne yaptığını, neden beklediğini, hangi sonuca ulaştığını ve kullanıcı etkileşimlerinin runtime’a nasıl geri döndüğünü tutarlı biçimde yönetmektir.

Zorunlu ilkeler
1. UI-agnostic presentation architecture zorunludur
Runa rendering mimarisi hiçbir tek yüzeye sabitlenmeyecektir.
CLI önemli ve birinci sınıf yüzey olabilir; ancak mimarinin canonical gerçekliği olmayacaktır.
Web, CLI/TUI, IDE ve local agent aynı presentation contract’ı paylaşmalıdır.
2. Event stream ile render modeli ayrılmalıdır
Runtime event stream doğrudan UI modeli olarak kullanılmayacaktır.
Event stream sistemsel gerçekleri taşır.
Presentation Mapper, bu event’leri kullanıcıya uygun anlatım ve blok modeline dönüştürmelidir.
Render edilen bloklar ile runtime event’leri birebir aynı kavram olmak zorunda değildir.
3. Canonical Presentation Mapper backend-side çalışmalıdır
Canonical presentation mapping backend tarafında yapılmalıdır.
Böylece tüm yüzeyler aynı semantik block stream’i görebilir.
Client tarafında yalnızca surface-native decoration ve render adaptasyonu yapılmalıdır.
Yüzeyler presentation semantics’ini değiştirmemeli, yalnızca uygun şekilde göstermelidir.
4. Standardized Render Blocks zorunludur
Runa, düz metin veya yalnızca markdown tabanlı gösterimle sınırlı kalmayacaktır.
Presentation katmanında standart block tipleri tanımlanacaktır.
Her surface bu blokları native biçimde render edebilmeli, desteklemediği durumlarda fallback’e dönebilmelidir.
Markdown/text, canonical render dili değil; fallback dili olmalıdır.
5. v1 minimum ama güçlü block seti

İlk sürümde en az aşağıdaki block tipleri desteklenmelidir:

text_block
status_block
progress_block
code_block
diff_block
table_block
tree_block
approval_block
artifact_block
warning_block
task_list_block
tool_result_block

image_block ve chart_block v1 için zorunlu değildir; daha sonraki fazlara bırakılabilir.

6. Block-type aware incremental streaming zorunludur
Render blokları yalnızca final halinde gönderilmeyecektir.
Streaming, block tipine göre değişen bir akış modeliyle çalışacaktır.
Bazı bloklar delta/patch bazlı incremental akabilir.
Bazı bloklar yalnızca tamamlandığında tek parça gönderilebilir.
Bu davranış block tipine göre tanımlı olmalıdır.

Örnek ilkeler:

text_block → incremental delta
status_block → coalesced update
progress_block → throttled update
approval_block → tam interaction block
diff_block → hazır olduğunda veya kontrollü patch halinde
7. Back-pressure aware streaming zorunludur
Tüm event ve block güncellemeleri eşit derecede kritik kabul edilmeyecektir.
Bazı yayınlar lossless olmalıdır:
approval
final outputs
warnings/errors
artifact creation
Bazı yayınlar coalescable olabilir:
progress updates
heartbeat
geçici status yenilemeleri
Yavaş renderer durumunda kritik olmayan akışlar birleştirilebilmeli, kritik olaylar kaybedilmemelidir.
8. Uzun işlemlerde canlılık sinyali zorunludur
Kullanıcıya sistemin halen çalıştığını gösteren görünür sinyaller sağlanmalıdır.
Uzun süren tool veya run işlemlerinde en az aşağıdakilerden biri gösterilmelidir:
status block
progress block
heartbeat / keepalive görünürlüğü
Kullanıcı “dondu mu?” hissine kapılmamalıdır.
9. Approval block özel interaction-capable block’tur
approval_block, sıradan bir tek yönlü render bloğu değildir.
Bu blok, runtime’dan presentation katmanına bir interaction request taşır.
Kullanıcının kararı surface tarafından canonical interaction contract’a çevrilerek runtime’a geri gönderilmelidir.
Tüm yüzeyler farklı UI kullanabilir; ancak interaction semantics aynı olmalıdır.

approval_block en az şu bilgileri taşımalıdır:

interaction_id
approval_id
requested_action
risk_level
scope
options
default_option
deadline (varsa)
artifact_refs (varsa)
consequences_summary

Kullanıcı kararı sonrasında canonical interaction mesajı üretilmelidir ve runtime bunun sonucunda approval.resolved benzeri canonical event üretmelidir.

10. Approval waiting time görünürlüğü zorunludur
Approval presentation contract’ı yalnızca “onay bekleniyor” bilgisini değil, bekleme süresi görünürlüğünü de desteklemelidir.
Kullanıcıya mümkünse şu bilgiler sunulmalıdır:
ne kadar süredir bekleniyor
kalan süre
deadline dolduysa bunun bilgisi
run’ın pause/wait durumunda olduğu
Bu görünürlük presentation katmanının sorumluluğundadır.
11. Approval timeout davranışının presentation tarafı tanımlı olmalıdır
Approval block timeout/expiry bilgisini taşıyabilmelidir.
Süre dolduğunda kullanıcıya açık biçimde expiration gösterilmelidir.
Presentation katmanı approval.expired durumunu tutarlı göstermelidir.
Timeout sonrası run’ın state transition davranışı runtime/policy katmanına aittir; ancak presentation bunu doğru yansıtmak zorundadır.
Auto-approve presentation düzeyinde hiçbir zaman varsayılan kabul edilmeyecektir.
12. Transport-agnostic schema zorunludur
Presentation katmanı belirli bir transport’a kilitlenmeyecektir.
Tek canonical message schema kullanılacaktır.
Farklı transport adaptörleri bu şemayı taşıyabilir.

Temel tercih:

remote interactive sessions → WebSocket
local daemon / local CLI sessions → IPC / Unix socket / named pipe
gerektiğinde read-mostly fallback → SSE

Tüm transport’lar aynı canonical message schema’yı taşımalıdır.

13. React + Ink yalnızca CLI/TUI renderer katmanında konumlanmalıdır
React + Ink kullanılabilir ve değerlidir.
Ancak presentation mimarisinin canonical gerçekliği olmayacaktır.
React + Ink, CLI/TUI surface renderer implementasyonu olarak düşünülmelidir.
Web ve IDE yüzeyleri aynı render contract’tan beslenmelidir.
14. Block schema versioning zorunludur
Render block’lar sürümsüz bırakılmayacaktır.
En az şu ayrım desteklenmelidir:
stream/envelope version
block schema version
Renderer’lar capability negotiation yapabilmelidir.
Backend, client’ın desteklediği block tipleri ve sürümlere göre uygun temsil veya fallback seçebilmelidir.
15. Graceful degradation zorunludur
Eski veya sınırlı renderer yeni block tipiyle karşılaştığında çökme veya anlamsız görünüm üretmemelidir.
Her block mümkün olduğunca aşağıdakilerden en az birini taşımalıdır:
fallback_text
fallback_markdown
fallback_summary
artifact_ref
Bilinmeyen block tipleri uygun fallback ile gösterilebilmelidir.
16. Büyük output’lar block içine gömülmemelidir
Çok büyük çıktılar doğrudan block içine tam gömülmeyecektir.
Büyük içerikler için aşağıdaki model kullanılmalıdır:
truncated preview
metadata
artifact reference
on-demand expansion
Bu model Madde 3’te kabul edilen collapse/un-collapse sistemiyle uyumlu çalışmalıdır.

Büyük output block’ları mümkünse şunları taşımalıdır:

preview
is_truncated
artifact_ref
estimated_size
line_count / byte_count
can_expand
expansion_modes
17. On-demand un-collapse presentation contract’ı desteklenmelidir
Kullanıcı tam içeriği istemediği sürece yalnızca kısa temsil gösterilmelidir.
Kullanıcı ihtiyaç duyduğunda:
full
head
tail
range
filtered/search-within
gibi kontrollü expansion modları sunulabilmelidir.
18. Error ve degraded state render contract zorunludur
Tüm yüzeyler hata ve kesinti durumlarında tutarlı davranmalıdır.
Tek bir kaba “hata” modeli yeterli değildir.
En az şu ayrımlar presentation contract’ta bulunmalıdır:

Runtime-level failures

run.failed
tool.failed
approval.expired

Stream/transport degradation

stream.interrupted
stream.resumed
stream.degraded
stream.sync_required

Block-level issues

block.partial
block.interrupted
block.failed
Kullanıcıya sorunun nerede olduğu görünür biçimde anlatılmalıdır.
Mümkünse retry/resume affordance sağlanmalıdır.
19. Surface renderers native ama sözleşmeye sadık olmalıdır
Her yüzey kendi doğal UX biçimini kullanabilir.
Ancak canonical block semantics değiştirilemez.
Surface renderers presentation contract’ı yorumlayabilir, fakat yeniden tanımlayamaz.
20. Gamification / Companion katmanı çekirdek dışıdır
Buddy / companion pet / oyunlaştırma benzeri fikirler çekirdek presentation mimarisine dahil edilmeyecektir.
Bunlar ancak ileride ayrı bir engagement/persona layer olarak değerlendirilecektir.
Frontier-grade capability roadmap’i ile karıştırılmayacaktır.
Yasak / kaçınılacak yaklaşımlar
UI mimarisini CLI-first gerçeklik olarak kurmak
Event stream’i doğrudan render modeli yerine koymak
Her yüzeyin kendi başına farklı presentation semantics üretmesine izin vermek
Tüm çıktıları düz text veya yalnızca markdown olarak taşımak
Büyük output’ları tam haliyle block içine gömmek
Approval akışını her yüzeye özgü dağınık UI mantığına bırakmak
Approval timeout ve waiting görünürlüğünü yok saymak
Transport protokolünü canonical semantik katmanın yerine geçirmek
Block versioning olmadan renderer ekosistemi büyütmek
Bilinmeyen block tiplerinde kırılmak yerine graceful fallback vermemek
Progress/status gibi gürültülü akışları back-pressure dikkate almadan sınırsız yayınlamak
Error, degraded ve interrupted durumlarını tek tip generic hata gibi göstermek
React + Ink’i tüm presentation mimarisinin canonical modeli haline getirmek
Gamification fikirlerini çekirdek capability UX’i ile karıştırmak
Uygulama çerçevesi

Runa presentation mimarisi aşağıdaki ilkelere göre uygulanmalıdır:

canonical backend-side presentation mapper
standardized render block stream
block-type aware incremental streaming
back-pressure aware coalescing
interaction-capable approval blocks
transport-agnostic message schema
remote için WebSocket, local için IPC tercihleri
schema versioning + capability negotiation
artifact-backed large output rendering
explicit degraded/error render contracts
surface-native renderers
markdown/text fallback desteği

v1’de öncelikli yüzeyler:

Web
CLI/TUI
IDE panel / extension

v1’de öncelikli renderer yaklaşımı:

Web → React tabanlı native renderer
CLI/TUI → React + Ink kullanılabilir
IDE → panel/webview + native action integration
Kabul kriterleri

Bir presentation/rendering implementasyonu, Madde 5 ile uyumlu sayılabilmesi için en az şu şartları sağlamalıdır:

UI mimarisi hiçbir tek yüzeye sabitlenmemiş olmalı
Runtime event stream ile presentation block modeli birbirinden ayrılmış olmalı
Canonical Presentation Mapper backend-side çalışıyor olmalı
Tüm yüzeyler standardized render block contract’ını tüketiyor olmalı
Block-type aware incremental streaming uygulanıyor olmalı
Back-pressure ve coalescing mekanizması bulunuyor olmalı
Uzun görevlerde canlılık sinyali görünür olmalı
Approval block bidirectional interaction contract olarak modellenmiş olmalı
Approval waiting duration / timeout görünürlüğü destekleniyor olmalı
Remote ve local transport’lar aynı canonical schema’yı taşıyor olmalı
Block schema versioning ve capability negotiation bulunuyor olmalı
Bilinmeyen block tipleri graceful fallback ile gösterilebiliyor olmalı
Büyük output’lar preview + artifact_ref + on-demand expansion modeliyle taşınıyor olmalı
Error/degraded/interrupted durumları için ayrı render contract’lar destekleniyor olmalı
tool_result_block v1 setinde yer alıyor olmalı
React + Ink, CLI/TUI renderer olarak kullanılabiliyor fakat canonical presentation katmanının yerine geçmiyor olmalı
Gamification / buddy katmanı çekirdek dışı tutuluyor olmalı
Kısa mimari özeti

Runa’da presentation katmanı, tek bir yüzeyin uzantısı veya düz metin tabanlı bir çıktı mekanizması değil; runtime gerçeklerini çok yüzeyli biçimde taşıyan, çift yönlü etkileşim destekleyen, block-temelli ve sürümlü bir sistem olarak tasarlanacaktır. Runtime event stream canonical gerçekliği oluşturacak; backend-side mapper bunu standardized render blocks’a çevirecek; web, CLI ve IDE bu blokları kendi doğal UX biçimlerinde gösterecektir. Büyük çıktılar artifact referanslarıyla yönetilecek, approval blokları bidirectional interaction taşıyacak, streaming block tipine göre optimize edilecek ve tüm yapı transport-agnostic çalışacaktır. Buddy/gamification gibi fikirler ise çekirdek dışı bırakılacaktır.

Madde 5’in resmi kararı:
Runa presentation mimarisi = UI-agnostic, backend-mapped, block-temelli, interaction-capable ve transport-agnostic rendering architecture









Runa Architectural Constitution — Madde 6
Proaktiflik, Bounded Daemon Mode, Escalation Engine, Capability Gating ve Governance Anayasası

Durum: Kilitlendi
Kapsam: Background/daemon çalışma modeli, escalation/de-escalation mimarisi, capability rollout governance, class violation yönetimi, compensation disiplini, guard governance ve engagement katmanının çekirdekten ayrıştırılması
Amaç: Runa’nın reactive assistant seviyesinden kontrollü biçimde proactive agent platformuna evrilmesini sağlamak; bunu yaparken güven, maliyet, izolasyon, rollout disiplini ve ürün odağını korumak

Resmi karar özeti

Runa’da proaktif çalışma yetenekleri, kontrolsüz otonomi olarak değil; bounded daemon mode, bidirectional policy-driven escalation engine, multi-dimensional ama governance-disiplinli capability gating ve güvenli compensation/guard governance çerçevesinde uygulanacaktır. Background görevler ortak runtime sözleşmelerini kullanacak ancak ayrı execution profile ve ayrı worker/sandbox izolasyonunda çalışacaktır; escalation kararları tek kaynaktan değil guardrail-first precedence ile çoklu sinyallerden üretilecektir; capability rollout “karar verilene kadar kapalı” ilkesiyle yönetilecek; buddy/gamification benzeri engagement fikirleri ise çekirdek capability roadmap’ine değil, ancak ürün olgunluk eşikleri sağlandıktan sonra değerlendirilecek ayrı bir katmana ait olacaktır.

Zorunlu ilkeler
Runa’da proaktiflik desteklenecek, ancak bu destek yalnızca bounded autonomy ilkesiyle uygulanacaktır.
Background görevler foreground ajanla aynı sözleşmeleri paylaşacak, fakat ayrı execution mode, ayrı worker pool ve ayrı sandbox/policy profile ile çalışacaktır.
Daemon job sınıfları deklaratif etiket değil, runtime-enforced execution profile olarak uygulanacaktır.
Her daemon job, en az observe_only, analyze_and_suggest veya bounded_action sınıflarından birine bağlanacaktır.
Job sınıfı aşımı tespit edildiğinde çağrı bloke edilecek, olay loglanacak ve run güvenli bir paused veya failed_policy benzeri terminal duruma taşınacaktır.
Bounded mutasyonlar yalnızca statik baseline capability seti ile dinamik policy değerlendirmesinin birleşimi üzerinden izin alacaktır.
Daemon görevlerinde sessiz ölüm yasaktır; her job görünür ve deterministik bir terminal duruma ulaşmalıdır.
Yarım kalan yan etki görünmez bırakılamaz; class violation veya zorunlu durdurma sonrası sistem kısmi etkileri tespit edip ya güvenli biçimde telafi edecek ya da review/compensation-required durumuna taşıyacaktır.
Compensation classifier nihai otorite olmayacaktır; reversible/irreversible tespiti yalnızca güven skoru ile birlikte öneri üretir.
Otomatik compensation yalnızca önceden doğrulanmış, düşük riskli, yüksek güvenli ve policy tarafından açıkça izin verilen reversible etki sınıflarında uygulanabilir.
Compensation sınıflandırması belirsiz, düşük güvenli veya tartışmalıysa varsayılan davranış quarantine / paused_for_review olacaktır.
Escalation engine yalnızca escalation değil, de-escalation da destekleyen çift yönlü bir karar sistemi olacaktır.
Escalation ve de-escalation kararları tek kaynaktan alınmayacak; model/planner önerileri, rule-based monitor sinyalleri ve verifier/quality sinyalleri bir controller tarafından birleştirilecektir.
Escalation controller, guardrail-first precedence ile çalışacaktır: hard policy/budget guards > safety/confidence guards > rule-based monitors > model/planner recommendations.
Model/planner önerileri tek başına escalation veya de-escalation için yeterli olmayacaktır.
Hard guard’lar açık sahipliği olan, telemetry ile izlenen ve periyodik olarak yeniden değerlendirilen operational controls olarak ele alınacaktır.
Guard’ların yanlış kalibrasyonu tespit edildiğinde güvenli varsayılanlara dönülmesi ve yeniden onay süreci zorunlu olacaktır.
Capability rollout sistemi yalnızca environment toggle mantığıyla değil, core dimensions first yaklaşımıyla çok boyutlu fakat yönetilebilir biçimde tasarlanacaktır.
V1’de capability gating en az environment, tenant, surface, cohort/experiment ring ve client/runtime compatibility boyutlarını desteklemelidir.
Capability gating’de explicit deny wins ve allow is conjunctive ilkeleri uygulanacaktır.
Bir capability için karar netleşene kadar varsayılan durum kapalı olacaktır.
Capability tier tayini tek aktörlü olmayacak; platform ve security/policy sahiplerinin ortak sınıflandırması ile yapılacaktır.
Tier tayininde anlaşmazlık oluşursa daha yüksek risk tier’ı esas alınacaktır.
Final arbitration authority, platform ve security/policy sahiplerinin ortak imzası ile oluşacaktır.
Düşük riskli capability’ler için risk-tiered governance altında fast-track approval yolu tanımlanabilir, ancak bu yetki revocable ve audit zorunlu olacaktır.
Fast-track veya capability suspend durumlarında varsayılan davranış karar verilene kadar kapalı olacaktır.
Her suspend tanımlı bir review deadline’ına sahip olmalı ve bu deadline geldiğinde joint review zorunlu olarak tetiklenmelidir.
Acil suspend tek taraflı başlatılabilir; ancak uzatma, yeniden açma veya kalıcı kapatma kararları joint review ile verilmelidir.
Buddy, companion, pet veya gamification benzeri engagement fikirleri çekirdek capability roadmap’ine dahil edilmeyecektir.
Engagement katmanı ancak çekirdek capability, güvenilirlik, daemon güveni, escalation disiplini ve ölçüm hazır oluşu yeterince olgunlaştıktan sonra değerlendirmeye alınacaktır.
Yasak yaklaşımlar
Daemon mode’u sınırsız ve kontrolsüz otonomi olarak açmak yapılamaz.
Background job’ları foreground ajanla aynı izin ve aynı izolasyon profiliyle çalıştırmak yapılamaz.
Job class’ı yalnızca metadata etiketi gibi bırakmak yapılamaz.
analyze_and_suggest veya observe_only sınıfındaki bir job’ın mutasyon yapmasına sessizce izin vermek yapılamaz.
Kısmi yan etkileri görünmez bırakmak veya kullanıcıyı yarım işle sahipsiz bırakmak yapılamaz.
Compensation classifier’ı tek başına rollback otoritesi yapmak yapılamaz.
Belirsiz veya düşük güvenli etki sınıflarında otomatik rollback yapmak yapılamaz.
Escalation kararını yalnızca modele, yalnızca monitöre veya yalnızca tek bir heuristiğe bırakmak yapılamaz.
Hard guard’ları bir kez tanımlayıp kalıcı/doğru varsaymak yapılamaz.
Capability rollout’u ownersız, rollback plansız ve kill switch’siz yürütmek yapılamaz.
Tier tayinini tek kişinin yorumu ile kesinleştirmek yapılamaz.
Karar bekleyen veya suspend durumundaki bir capability’yi gri alanda kısmen açık bırakmak yapılamaz.
Geçici suspend’i süresiz limbo durumuna dönüştürmek yapılamaz.
Buddy/gamification katmanını çekirdek capability eksikleri kapanmadan ürün odağına almak yapılamaz.
Uygulama çerçevesi
A. Daemon Mode

Runa’da daemon mode, foreground runtime ile aynı temel sözleşmeleri kullanacak; ancak ayrı execution profile, ayrı daemon worker pool, ayrı queue ve daha sıkı sandbox/policy rejimi ile çalışacaktır. V1’de daemon job’ları üç temel sınıfa ayrılacaktır: observe-only, analyze-and-suggest ve bounded-action. Her sınıf, izin verilen capability class’ları, yasak side-effect seviyeleri, timeout/retry sınırları, approval rejimi ve sandbox politikasını içeren bir execution profile ile temsil edilecektir. Job class aşımı capability profile ihlali olarak değerlendirilecek; sınıf dışı tool çağrısı bloklanacak, olay loglanacak ve run güvenli pause/fail akışına alınacaktır. Bounded mutasyonlar salt statik allowlist ile değil, statik baseline + dinamik policy birleşimi ile yönetilecektir. Daemon job’larında sessiz ölüm yasak olacak; her run completed, failed, paused, cancelled, expired veya compensation-required gibi görünür terminal durumlara taşınacaktır. Kısmi etkiler tespit edildiğinde etki sınıflandırılacak; güvenli ve doğrulanmış reversible sınıflarda telafi uygulanabilecek, şüpheli durumlarda quarantine/review akışı işleyecektir.

B. Escalation Engine

Runa’nın deep/ultra benzeri davranışları ayrı bir buton fantezisi değil, resmi bir bidirectional escalation subsystem olarak tasarlanacaktır. Escalation controller; model/planner önerisi, rule-based monitor sinyalleri, verifier/quality sinyalleri, cost/time budget durumu ve policy kısıtlarını birlikte değerlendirecektir. Controller guardrail-first precedence ile çalışacaktır: hard policy/budget guards önce gelir; safety/confidence guards ikinci sıradadır; heuristics ve monitor sinyalleri üçüncü sıradadır; model/planner tavsiyesi en altta yer alır. Hard budget ceiling, time ceiling, tenant restriction veya explicit user stop gibi üst düzey guard’lar alt seviye önerileri veto edebilir. Deep mode gereksiz hale geldiğinde de-escalation tetiklenebilecek; no-progress detector, verifier kararı, maliyet baskısı veya problem çözümünün rutin execution’a dönmesi bunu başlatabilecek. Controller belirsiz kaldığında varsayılan davranış güvenli standart moda geri dönmek ve gerektiğinde kullanıcıya görünür şekilde bilgi vermek olacaktır.

C. Capability Gating

Runa’da capability rollout çok boyutlu olacak ancak yönetilebilirliği korumak için v1’de çekirdek boyutlarla sınırlanacaktır. Environment, tenant, surface, cohort/experiment ring ve client/runtime compatibility ana boyutlar olarak kullanılacaktır. Karar mantığı explicit deny wins ve conjunctive allow ilkelerine dayanacaktır; bir capability ancak tüm gerekli boyutlarda izinli ise açılacaktır. Tier sınıflandırması platform ve security/policy sahipleri tarafından birlikte yapılacak; anlaşmazlıkta daha yüksek risk tier seçilecektir. Final arbitration joint sign-off ile verilecektir. Governance, risk-tiered approval path içerecektir: düşük riskli capability’ler için fast-track yolu tanımlanabilecek; orta ve yüksek riskli capability’ler daha ağır review, rollback planı ve kill switch disiplini isteyecektir. Suspend başlatma acil durumda tek taraflı yapılabilir; ancak uzatma, yeniden açma veya kalıcı kapatma joint review gerektirir. Karar verilene kadar her capability varsayılan olarak kapalı kalacaktır.

D. Compensation & Guard Governance

Compensation ve guard katmanları, Madde 6’nın güvenilirlik omurgası olarak ayrı yönetilecektir. Compensation classifier yalnızca etki sınıfı önerisi ve güven skoru üretir; tek başına rollback kararı vermez. Otomatik compensation ancak prevalidated recipe’ler, yüksek güvenli classifier sonucu ve policy izni birlikte varsa uygulanabilir. Aksi durumda varsayılan quarantine/review akışı devreye girer. Hard guards ise açık owner’lı operational controls olarak ele alınacaktır: platform owner cost/time ceilings ve runtime guard mantığından, security/policy owner deny overlays ve risk guard’larından sorumludur. Guard’lar düzenli telemetry review ve önemli incident’lerden sonra yeniden kalibre edilecektir. Yanlış guard kalibrasyonu tespit edildiğinde güvenli varsayılanlara dönüş ve yeniden onay süreci zorunludur. Suspend ve limbo yönetiminde sonsuz belirsizlik yasaktır; her suspend review deadline taşır, deadline geldiğinde joint review tetiklenir ve capability bu süreçte kapalı kalır.

Kabul kriterleri

Madde 6, aşağıdaki koşullar sağlandığında “implement edildi” sayılır:

Background görevler foreground oturumlardan ayrı execution profile ve ayrı worker/sandbox izolasyonunda çalışıyorsa.
Daemon job sınıfları runtime-enforced capability profile olarak uygulanıyorsa.
Job class aşımı tespit edildiğinde çağrı bloklanıyor, olay loglanıyor ve run güvenli terminal veya pause durumuna taşınıyorsa.
Kısmi yan etkiler görünmez bırakılmıyor; compensation veya quarantine/review akışı ile yönetiliyorsa.
Compensation classifier güven skoru üretiyor ve belirsiz durumda otomatik rollback yerine quarantine varsayımı uygulanıyorsa.
Escalation engine escalation ve de-escalation’ı birlikte destekliyor ve kararlar guardrail-first precedence ile alınıyorsa.
Hard policy/budget guards, model önerilerini veto edebiliyor ve controller belirsizlikte güvenli standard moda dönebiliyorsa.
Capability rollout, core dimensions first yaklaşımıyla ve explicit deny wins + conjunctive allow ilkeleriyle çalışıyorsa.
Tier tayini için joint classification ve final arbitration modeli uygulanıyorsa.
Fast-track approval yalnızca tanımlı risk sınırlarında, audit ile ve revocable biçimde çalışıyorsa.
Suspend durumlarında varsayılan davranış kapalı kalmaksa ve review deadline + joint review mekanizması aktifse.
Guard owner’ları tanımlıysa ve guard kalibrasyonu telemetry/incident review ile düzenli olarak yeniden değerlendiriliyorsa.
Buddy/gamification katmanı çekirdek capability roadmap’inden ayrı tutuluyor ve yalnızca olgunluk eşikleri sonrası değerlendiriliyorsa.
Resmi karar cümlesi

Runa’nın ileri seviye ürün mimarisi, bounded daemon mode, bidirectional policy-driven escalation engine, governance-disiplinli multi-dimensional capability gating ve confidence-gated compensation/guard governance ilkeleri üzerine kurulacak; karar verilene kadar kapalı ve şüphede quarantine varsayılanları korunacak; engagement katmanı ise çekirdek capability olgunluğu tamamlanmadan ürün merkezine alınmayacaktır.

Madde 6 Operasyonel Notlar
Runbook seviyesinde, anayasa dışı ama kaybolmaması gereken notlar
1. Compensation recipe versiyonlama

Compensation recipe’leri versiyonlu tutulmalı; hangi recipe’nin hangi capability sürümü, hangi side-effect sınıfı ve hangi tool/runtime versiyonu ile uyumlu olduğu izlenmelidir. Eski recipe’ler otomatik kullanıma açık kalmamalı; compatibility matrisi ve rollback geçmişi tutulmalıdır.

2. Guard review eşik tanımı

Hard guard review’ları için pratik eşikler ayrıca runbook’ta tanımlanmalıdır. Örnek olarak gereksiz escalation oranı, cost ceiling’e çarpma frekansı, false-positive policy deny oranı, no-progress abort oranı ve tenant bazlı blokaj anomalileri operasyonel dashboard’larda izlenmelidir. Sayısal eşikler anayasa değil, runbook seviyesinde revize edilebilir olmalıdır.

3. Suspend extend limiti

Suspend uzatmaları sınırsız olmamalıdır. Maksimum ardışık extend sayısı, tek extend süresi ve otomatik joint review tetikleme koşulları runbook’ta açık tanımlanmalıdır. Review yapılmadan suspend’in sessizce kalıcı hale gelmesi yasak olmalıdır.











Runa Architectural Constitution — Madde 7
Capability Packaging, Governance Transparency, Runtime-native Multi-agent Orchestration ve Lifecycle Registry Governance Anayasası

Durum: Kilitlendi
Kapsam: Build-time capability packaging, runtime gating ile ilişkisi, white-label/governance şeffaflığı, runtime-native subagent yapısı, side-effect ownership, query lifecycle ile mode-specific detail state yönetimi
Amaç: Runa’nın çekirdek mimarisi oturduktan sonra, sistemi güvenli, ürünleşmiş, çok profilli dağıtıma uygun, yönetilebilir ve production-grade hale getirmek

Bu madde, paylaşılan metindeki build-time dead code elimination, undercover/AI izini gizleme, native multi-agent orchestration ve production-grade query engine lifecycle sinyallerinin, Runa için anayasa seviyesinde rafine edilmesiyle oluşturulmuştur.

Resmi karar özeti

Runa, tek ve şişkin bir ürün dağıtımı olarak değil; shared core + capability packaging + runtime gating modeliyle ürünleştirilecektir. Build-time packaging capability’nin fiziksel mevcudiyetini, runtime gating ise mantıksal izin durumunu belirleyecektir. White-label ve enterprise branding senaryolarında dış marka görünürlüğü ayrıştırılabilecek, ancak governance provenance asla kaybolmayacaktır. Çoklu ajan davranışı dış framework bağımlılığıyla değil, runtime-native subagent orchestration ile kurulacak; subagent’lar scoped isolation, controlled memory access ve runtime-owned side-effect ledger altında çalışacaktır. Query/run yaşam döngüsü ortak bir global lifecycle contract ile yönetilecek; mode-specific detail state’ler ise registry-controlled biçimde, CI ve runtime validasyonu altında genişletilebilecektir. Deliberate boundary gereği, exact pipeline, schema, storage, retention ve workflow ayrıntıları operasyonel policy veya implementation RFC alanına bırakılacaktır.

Zorunlu ilkeler
Runa, shared core + capability packaging + profile-based builds yaklaşımıyla paketlenecektir.
Build-time packaging capability’nin fiziksel mevcudiyetini, runtime gating capability’nin mantıksal açılabilirliğini belirleyecektir.
Build’de bulunmayan bir capability runtime tarafından etkinleştirilemez.
Build/runtime çakışmaları sessizce yutulmayacak; görünür unavailable_in_build veya eşdeğer durum üretilmelidir.
Her build profile, versiyonlu, review edilebilir ve rollback edilebilir bir Capability Manifest ile tanımlanmalıdır.
Manifest, build inclusion kararının canonical artifact’ı olacaktır.
Manifest rollback varsayılan olarak yeni run’ların capability aktivasyonunu etkiler; aktif run’lar default olarak resolved capability snapshot ile devam eder.
Güvenlik açısından kritik capability’ler için in-flight invalidation desteklenebilir; bu davranış capability declaration/manifest içinde tanımlı default revoke class ve Security/Policy emergency revoke overlay mekanizması ile yönetilmelidir.
Emergency revoke, yeni invocation’ları derhal durdurur; ancak mevcut uncertain effect’lerin reconciliation yükümlülüğünü ortadan kaldırmaz.
White-label veya enterprise branding presentation katmanında desteklenebilir; ancak governance provenance kaydı korunmak zorundadır.
Audit, trace, actor origin, capability provenance ve automated action kayıtları tenant-isolated ve role-based biçimde saklanmalıdır.
Governance provenance’e normal erişim ürünleşmiş bir UI/API yolu üzerinden sağlanmalıdır; ad hoc veri tabanı erişimi ana işletim modeli olamaz.
İstisnai incident durumları için auditlenen, süreli ve kontrollü break-glass erişim yolu bulunmalıdır.
Break-glass erişim yalnızca tanımlı incident rolleri tarafından, güçlü kimlik doğrulama, gerekçe, zaman sınırlaması ve gerçek zamanlı uyarı ile açılabilir.
Runtime-native multi-agent orchestration, Runa’nın resmi çoklu ajan modeli olacaktır.
Subagent’lar daemon execution mode ile aynı şey değildir; varsayılan olarak foreground family içinde scoped logical isolation ile çalışırlar.
Subagent memory scope, caller request ∩ capability declaration ∩ runtime policy kesişimiyle belirlenmelidir.
Subagent’a varsayılan erişim, curated read-only memory slice olacaktır; parent memory’ye ham ve sınırsız doğrudan erişim verilemez.
Subagent’ların shared memory’ye doğrudan yazması yasaktır; write-back yalnızca candidate/provenance-tagged ve controlled merge akışıyla yapılabilir.
Scope reduction sessizce yutulamaz; runtime requested_scope, effective_scope, reduction_reason ve canonical severity üretmelidir.
Scope reduction severity, capability criticality hint’leri ve policy restriction reason’ları kullanılarak runtime tarafından canonical biçimde hesaplanacaktır.
Düşük şiddetli scope reduction durumlarında varsayılan davranış continue-degraded olabilir; yüksek şiddette varsayılan davranış ek bağlam istemek, yeniden paketlemek veya escalation/user input akışına başvurmaktır.
Subagent failure varsayılan olarak localized failure olarak ele alınabilir; ancak dış etki oluşmuşsa bu ancak reconciliation tamamlandıktan sonra kesinleşebilir.
Side-effect ledger’ın canonical sahibi subagent değil, runtime/execution layer olacaktır.
Her effectful işlem önce durable effect intent olarak kaydedilmeli; effect sonrası durum committed, failed-no-effect, uncertain-effect veya compensated olarak güncellenmelidir.
Ledger ile dış etki arasında tam atomiklik garanti edilemeyen durumlarda varsayılan davranış uncertain_effect ve zorunlu reconciliation olacaktır.
Emergency revoke sırasında in-flight uncertain effect’ler reconciliation-only akışına alınır; committed, no-effect veya compensation-required sonuçlarından biriyle kapanmadan işlem tamamlanmış sayılmaz.
Query/run lifecycle için ortak bir global lifecycle contract bulunmalıdır.
Daemon, subagent veya diğer execution modlarına ait ek semantik durumlar, global lifecycle’ın yerine geçen ayrı state makineleri olarak değil, mode-specific detail states olarak modellenmelidir.
Mode-specific detail state’ler keyfi üretilmez; owner’lı, açıklamalı ve geçerli lifecycle bağlamı tanımlı bir mode-scoped registry içinde kayıtlı olmalıdır.
Yeni detail state ekleme, CI schema validation ve owner-gated review olmadan kabul edilmemelidir.
Runtime yalnızca ilgili execution mode için izinli detail state’leri kabul etmeli; bilinmeyen veya kayıtsız state’leri reject etmeli veya güvenli fallback’e normalize etmelidir.
Madde 7, exact pipeline, schema, storage, retention ve workflow detaylarını değil; packaging, provenance, isolation ve lifecycle governance için mimari invariant’ları tanımlar.
Yasak yaklaşımlar
Build-time packaging ile runtime gating’i aynı şey gibi ele almak yapılamaz.
Build’de bulunmayan capability’yi runtime flag ile “zorla açmak” yapılamaz.
Capability manifest’i ownersız, versiyonsuz veya review’sız artifact olarak yönetmek yapılamaz.
Manifest rollback sonrası aktif run’ların davranışını belirsiz bırakmak yapılamaz.
White-label senaryosu bahanesiyle audit, trace, actor origin veya capability provenance gizlenemez.
Governance erişimini normal işletim yolu olarak ad hoc veri tabanı erişimine dayandırmak yapılamaz.
Break-glass erişimi sürekli açık, denetimsiz veya self-service günlük yol haline getirmek yapılamaz.
Subagent’lara parent memory’ye sınırsız ve ham erişim vermek yapılamaz.
Subagent’ların shared memory’ye doğrudan ve provenance’sız yazmasına izin vermek yapılamaz.
Scope reduction’ı görünmez bırakmak ve parent’ı sessiz bağlam kaybıyla çalıştırmak yapılamaz.
Side-effect ledger’ı yalnızca subagent’ın kendi raporuna bırakmak yapılamaz.
Dış etki oluşabilecek işlemleri intent kaydı olmadan yürütmek yapılamaz.
uncertain_effect durumlarını reconciliation olmadan kapatılmış saymak yapılamaz.
Subagent failure’ı her zaman parent failure saymak veya tam tersi, her zaman önemsiz localized hata gibi görmek yapılamaz.
Global lifecycle ile mode-specific detail states’i aynı enum içinde keyfi biçimde karıştırmak yapılamaz.
Registry’ye keyfi detail state eklemek ve yalnızca production runtime’da doğrulamak yapılamaz.
Madde 7’ye pipeline, storage, retention veya workflow detaylarını gereksiz biçimde gömerek anayasa ile runbook sınırını bozmak yapılamaz.
Uygulama çerçevesi
A. Capability Packaging

Runa’da capability surface iki katmanda yönetilecektir: build-time packaging ve runtime gating. Build-time packaging, profile-based build’ler aracılığıyla capability’nin fiziksel olarak dağıtıma dahil edilip edilmediğini belirler. Bunun canonical kaynağı versiyonlu Capability Manifest’tir. Runtime gating, yalnızca build’de mevcut capability’ler üzerinde çalışabilir; build’de bulunmayan capability için runtime enablement talebi gelirse sistem unavailable_in_build benzeri görünür durum üretir. Manifest rollback, varsayılan olarak gelecekteki aktivasyonları etkiler; aktif run’lar çözülmüş capability snapshot’ı ile devam eder. Ancak capability declaration’daki default revoke class veya Security/Policy’nin uyguladığı süreli emergency revoke overlay, gerekli durumlarda in-flight invalidation başlatabilir. Revoke, yeni effect başlatmayı durdurur; mevcut uncertain effect’leri ise reconciliation-only akışına geçirir.

B. Governance Transparency ve White-label

Runa, branding ile governance provenance’i birbirinden ayıracaktır. White-label ve enterprise branding presentation düzeyinde desteklenebilir; ancak audit, trace, actor origin, capability provenance ve automated action kayıtları korunacaktır. Bu kayıtlar tenant-isolated ve role-based biçimde tutulacak; yetkili erişim normal koşullarda ürünleşmiş Admin/Audit UI ve Governance API üzerinden sağlanacaktır. Normal akışta ad hoc veri tabanı erişimi kullanılmaz. İstisnai incident durumlarında yalnızca tanımlı incident rolleri, güçlü kimlik doğrulama, gerekçe, zaman sınırlaması ve gerçek zamanlı uyarı koşullarıyla break-glass erişimi açabilir. Break-glass erişim auditlenir, süre dolunca otomatik kapanır ve uzatılması ayrıca denetimli review gerektirir.

C. Runtime-native Multi-agent Orchestration

Runa’da çoklu ajan davranışı prompt rol taklidi ile değil, runtime-native subagent orchestration ile kurulacaktır. Subagent’lar ayrı sub-run kimliği, ayrı event lineage, ayrı budget ve scoped logical isolation ile çalışır. Memory scope, caller request, capability declaration ve runtime policy kesişimiyle belirlenir. Subagent’a varsayılan olarak curated read-only slice verilir; shared memory’ye direct write yoktur. Scope daralması olursa runtime bunu canonical scope_reduced sinyali ve severity ile parent’a görünür kılar. Subagent çıktıları candidate/provenance-tagged artifact veya merge adayı olarak döner. Side-effect ownership runtime’dadır: her effectful çağrı önce durable effect intent olarak kaydedilir, sonra dış etki uygulanır, ardından ledger committed/failed-no-effect/uncertain-effect/compensated durumlarından birine taşınır. Subagent failure localized kabul edilebilir; ancak unresolved effect varsa parent run reconciliation veya compensation-required akışına yükseltilir. Riskli veya ağır alt görevlerde subagent, logical isolation’dan hard isolation profiline yükseltilebilir.

D. Lifecycle Contracts ve Registry Governance

Runa tüm run türleri için ortak bir global lifecycle contract kullanacaktır. Initializing, active, waiting, paused, degraded, verifying, completed, failed, cancelled benzeri halleri global lifecycle belirler. Daemon, subagent, escalation veya diğer execution modlarına ait daha ayrıntılı durumlar ise mode_detail_state olarak modellenir. Bu detail state’ler mode-scoped registry içinde owner’lı, açıklamalı, allowed lifecycle bağlamı tanımlı ve observability/fallback semantiği belirlenmiş biçimde kayıtlı olmalıdır. Registry değişiklikleri yalnızca CI schema validation ile değil, owner-gated review ile korunacaktır. Pre-deployment aşamasında hatalı veya uygunsuz state genişlemeleri engellenir; runtime’da ise ek savunma hattı olarak validation sürer. Böylece lifecycle sistemi hem genişleyebilir hem de kirlenmeden kalır.

Deliberate boundary listesi

Madde 7 bilinçli olarak aşağıdaki konuları kapsam dışı bırakır; bunlar operasyonel policy veya implementation RFC alanına aittir:

CI/CD pipeline adımlarının exact tasarımı
Capability Manifest dosya formatı, imza mekanizması ve artifact yayın akışı
Exact JSON/protobuf/schema alan adları ve dosya yapıları
Side-effect ledger’ın fiziksel storage seçimi, tablo/index tasarımı ve replication stratejisi
Memory slicing, poisoning detection ve merge scoring algoritmalarının detaylı matematiği
Governance provenance retention süresi, legal hold ve export policy ayrıntıları
Break-glass on-call runbook’u, süre eşikleri ve approval form detayları
Registry review workflow’unun exact Git/branch/CODEOWNERS uygulaması
White-label sözleşme hükümleri, ticari marka dili ve commercial packaging ayrıntıları
SKU bazlı capability paketleme stratejileri ve ticari plan eşlemeleri
Sayısal SLA/SLO hedefleri, performans eşikleri ve rollout cadence ayrıntıları

Bu deliberate boundary, Madde 7’nin mimari invariant’ları tanımladığını; süreç, araç, sayı ve workflow detaylarının ise bilinçli olarak daha alt seviyedeki dokümanlara bırakıldığını belirtir.

Kabul kriterleri

Madde 7 aşağıdaki koşullar sağlandığında “implement edildi” sayılır:

Capability surface build-time packaging ve runtime gating olarak iki ayrı fakat sıralı katman halinde çalışıyorsa.
Build’de olmayan capability için runtime görünür unavailable_in_build veya eşdeğer durum üretebiliyorsa.
Capability Manifest versiyonlu, review edilebilir ve rollback edilebilir canonical artifact olarak kullanılıyorsa.
Manifest rollback future activation’ı etkiliyor ve active run’lar resolved capability snapshot ile yönetiliyorsa.
Emergency revoke overlay mekanizması tanımlı ve auditlenebilir biçimde uygulanabiliyorsa.
Governance provenance tenant-isolated, role-based ve ürünleşmiş UI/API yolu üzerinden erişilebilir durumdaysa.
Break-glass erişim sadece tanımlı incident rolleri tarafından, zaman sınırlı ve uyarı üreterek açılabiliyorsa.
Subagent memory scope intersection modeliyle belirleniyor, scope reduction parent’a görünür oluyorsa.
Subagent shared memory’ye doğrudan yazmıyor; candidate/provenance-tagged merge modeli uygulanıyorsa.
Side-effect ledger runtime-owned olarak çalışıyor, effect intent önce kaydediliyor ve uncertain-effect durumları reconciliation’a giriyorsa.
Localized failure ile unresolved side-effect durumları birbirinden ayrıştırılıyor ve parent run buna göre davranıyorsa.
Global lifecycle contract ile mode-specific detail states ayrılmış ve registry-controlled biçimde yönetiliyorsa.
Detail state registry değişiklikleri CI validation ve owner-gated review olmadan merge edilemiyorsa.
Runtime, bilinmeyen veya kayıtsız detail state’leri reject ediyor veya güvenli fallback’e normalize ediyorsa.
Madde 7’deki deliberate boundary korunuyor; operasyonel ve implementation detayları anayasa içine sızmıyorsa.
Resmi karar cümlesi

Runa’nın üretim sertleştirme ve ürünleştirme mimarisi, shared core + capability packaging + runtime gating, governance-protected white-label transparency, runtime-owned subagent isolation ve side-effect tracking, ayrıca registry-controlled lifecycle contracts ilkeleri üzerine kurulacaktır; build mevcudiyeti izin için önkoşul olacak, governance provenance kaybolmayacak, subagent davranışı scoped ve auditable kalacak, lifecycle genişlemesi ise owner-gated validation altında tutulacaktır.








Runa Architectural Constitution — Madde 8
Observability, Evaluation, Reliability ve Release Safety Anayasası

Durum: Kilitlendi
Kapsam: Observability omurgası, trace politikası, evaluation governance, release gate modeli, reliability/incident disiplini ve Madde 7 governance provenance ile ilişki
Amaç: Runa’nın yalnızca çalışan değil, ölçülebilen, güvenle geliştirilebilen, regresyonları yakalanabilen ve kontrollü biçimde yayına alınabilen frontier-grade bir platform olmasını sağlamak

Bu madde, paylaşılan metindeki “asıl fark model değil, harness” yaklaşımının kalite döngüsü, ölçüm ve release güvenliği düzeyine taşınmış anayasal karşılığıdır.

Resmi karar özeti

Runa’da kalite, güvenilirlik ve release emniyeti sonradan eklenen operasyonel detaylar olarak değil; full quality loop yaklaşımıyla mimarinin asli parçası olarak ele alınacaktır. Bu yaklaşım dört kapalı halkadan oluşur: observe, evaluate, gate, learn. Tüm run’lar için sampling’e tabi olmayan minimal lineage ve sağlık sinyalleri tutulacak; hata, mutasyon, approval, daemon, escalation ve deneysel akışlar için yüksek sadakatli trace zorunlu olacaktır. Golden task suite, statik benchmark değil, versioned living benchmark olarak ortak sahiplikle yönetilecektir. Release safety; hard safety invariants, kalibrasyonla oluşan provisional/hard empirical floors ve baseline’a göre regression budget modeliyle çalışacaktır. Governance provenance ile observability aynı telemetry omurgasını paylaşabilecek, ancak ayrı amaçlara hizmet eden iki farklı sözleşme olarak ele alınacaktır.

Zorunlu ilkeler
Runa, observability, evaluation, reliability ve release safety’i tek bir full quality loop altında ele alacaktır.
Her run için sampling’e tabi olmayan minimal lineage ve sağlık sinyalleri zorunlu olarak tutulacaktır.
Full-fidelity trace, en az hata veren, mutasyon yapan, approval gerektiren, daemon çalışan, escalation/deep mode kullanan, canary/experiment içinde bulunan veya security/policy olayı içeren run’lar için zorunlu olacaktır.
Düşük riskli ve başarılı run’larda ayrıntılı payload trace adaptif sampling ile yönetilebilir; ancak lineage, capability, state, error ve maliyet/latency özeti kaybolamaz.
Observability’de “metadata her zaman, payload bağlama göre” ilkesi uygulanacaktır.
Governance provenance ve observability trace’leri aynı telemetry spine üzerinde korele olabilse de aynı şey sayılmayacaktır.
Madde 7 audit-grade provenance, erişim ve tenant sınırlarını; Madde 8 ise sampling, evaluation, reliability ve release safety semantiğini tanımlayacaktır.
Golden task suite, versioned living benchmark olarak yönetilecek; statik ve terk edilmiş benchmark kullanımı yasak olacaktır.
Golden task suite’in sahipliği Platform/Evals, Product ve ilgili Domain/Capability owner arasında ortaklaştırılacaktır.
Her golden task owner’lı, gözden geçirme tarihli ve değişiklik sonrası yenilenebilir olacaktır.
Büyük capability, prompt, context, memory, tool veya policy değişikliklerinde ilgili golden task bölümlerinin gözden geçirilmesi zorunlu olacaktır.
Release blocker eşikleri sabit ve keyfi sayılar değil, owner’lı kalite sözleşmeleri olarak yönetilecektir.
Her kritik capability için hem hard safety invariants, hem empirical quality floors, hem de regression budget tanımlanacaktır.
Hard safety invariants veri beklemeden ilk günden zorunlu blocker olabilir.
Empirical quality floors başlangıçta provisional olarak tanımlanacak, kalibrasyonla hard release floor statüsüne yükseltilecektir.
Provisional floor’lar shadow/canary, golden suite ve erken üretim gözlemleriyle kalibre edilmeden nihai kabul edilmeyecektir.
Release gate mantığı en az canary, expansion ve full rollout aşamalarını ayırmalıdır.
Her gate aşamasında farklı kapsam ve sıkılıkta blocker kuralları uygulanabilir; ancak override disiplini tüm aşamalarda auditli ve gerekçeli olmalıdır.
Release blocker threshold değişiklikleri Platform/Evals ve Product sahipliğinde yönetilecek; riskli capability’lerde Security/Policy katılımı zorunlu olacaktır.
Override yalnızca named owners tarafından, açık gerekçe, süreli istisna ve audit kaydı ile uygulanabilir.
Reliability disiplini, incident taxonomy, replay, postmortem ve regression-to-eval dönüşümünü zorunlu kılar.
Her kritik hata veya önemli regresyon, sınıflandırılabilir, tekrar üretilebilir ve mümkünse replay edilebilir olmalıdır.
Önemli incident’lerden türeyen görevler, golden suite veya özel regression eval setlerine eklenerek sistem öğrenmesine dönüştürülmelidir.
Trace sampling kararı maliyet gerekçesiyle observability’yi anlamsız hale getirecek seviyeye indirilemez.
Release safety, yalnızca metrik gösterimi değil; rollout, rollback, kill switch ve quality gate davranışlarıyla birlikte ele alınmalıdır.
Shadow, canary ve kademeli açılım desteği olmayan capability’ler kritik yüzeylerde doğrudan tam yayına alınmamalıdır.
Quality loop’un amacı yalnızca hata bulmak değil; sistemin neden bozulduğunu açıklayabilmek ve güvenle geliştirmek olmalıdır.
Deliberate boundary gereği, exact eşik sayıları, retention süreleri, vendor/tool seçimi ve dashboard/runbook ayrıntıları anayasa dışında bırakılacaktır.
Yasak yaklaşımlar
Tüm run’lar için ya tam trace ya da neredeyse hiç trace yaklaşımına saplanmak yapılamaz.
Sampling bahanesiyle lineage, state transition, capability kimliği, error sınıfı veya temel sağlık sinyallerini kaybetmek yapılamaz.
Golden task suite’i tek ekip sahipliğinde, ownersız veya tarihsiz bırakmak yapılamaz.
Stale benchmark ile release güvenliği sağlanıyormuş gibi davranılamaz.
Release blocker eşiklerini kod içine gömülü, değiştirilemez sabitler gibi ele almak yapılamaz.
Tamamen sezgisel ve ownersız “bu release iyi görünüyor” kararıyla kritik rollout yapmak yapılamaz.
Override mekanizmasını gizli, denetimsiz veya kalıcı bypass kapısı haline getirmek yapılamaz.
Incident’ları yalnızca kapatıp geçmek, onları replay/eval öğrenmesine dönüştürmemek yapılamaz.
Governance provenance ile observability’yi gereksiz yere iki bağımsız veri evreni haline getirerek korelasyon kaybı yaratmak yapılamaz.
Aynı veri omurgasını kullanırken audit-grade provenance kurallarını sampling mantığıyla zayıflatmak yapılamaz.
Hard safety invariants olmadan yalnızca provisional metriklerle release safety varmış gibi davranılamaz.
Kalibrasyon süreci tamamlanmadan empirical floor’ları nihai ve tartışılmaz değerler gibi işletmek yapılamaz.
Shadow/canary olmadan kritik capability’leri doğrudan tam rollout’a itmek yapılamaz.
Uygulama çerçevesi
A. Observability

Runa observability omurgası katmanlı trace politikasıyla çalışacaktır. Her run için sampling’e tabi olmayan minimal lineage tutulacaktır: run_id, trace_id, parent/subagent lineage, tenant/user scope, capability ids, lifecycle geçişleri, tool invocation metadata, error class ve cost/latency summary bu katmana dahildir. Bunun üstünde risk-temelli full-fidelity trace katmanı yer alacaktır; mutasyon, approval, daemon, escalation, error, policy olayı ve deneysel yüzey içeren run’lar tam izlenecektir. Düşük riskli başarılı run’larda ayrıntılı payload trace, adaptif veya tail-based sampling ile yönetilebilir. Bu observability modeli, Madde 7’de tanımlanan governance provenance ile aynı telemetry spine üzerinde korele olabilir; ancak observability’nin amacı kalite, performans, hata analizi ve release güvenliğidir.

B. Evaluation

Runa evaluation sistemi, versioned living benchmark yaklaşımıyla yönetilecektir. Golden task suite üç mantıksal bölüme ayrılabilir: yavaş değişen core invariant tasks, capability-specific tasks ve yeni incident/regresyonlardan türeyen recent regression tasks. Suite’in sahipliği Platform/Evals, Product ve ilgili capability/domain owner arasında paylaşılır. Her task owner’lı, last-reviewed bilgili ve değişiklik sonrası yeniden ele alınabilir olmalıdır. Büyük sistem değişiklikleri, ilgili eval alanlarında refresh zorunluluğu doğurur. Stale benchmark kullanımı yasaktır; suite güncelliği, eval kalitesinin parçasıdır.

C. Reliability ve Incident Discipline

Runa reliability katmanı, incident taxonomy, replay desteği, postmortem disiplini ve regression-to-eval öğrenme döngüsüyle çalışacaktır. Her kritik veya tekrarlayan hata sınıflandırılabilir olmalı; run, trace ve capability bağlamı üzerinden tekrar üretilebilir şekilde incelenebilmelidir. Replay desteği mümkün olan yerlerde kalite analizinin temel aracı olacaktır. Incident sonrası yalnızca “sorun çözüldü” demek yeterli olmayacak; olayın golden suite’e, regression eval setine, guard tuning sürecine veya release blocker threshold’larına etkisi belirlenmelidir. Reliability burada log tutmak değil, öğrenen operasyonel disiplin kurmaktır.

D. Release Safety

Release safety, owner’lı threshold sözleşmeleri ve kademeli rollout rejimi ile işletilecektir. Her kritik capability için hard safety invariants, provisional/hard empirical floors ve baseline’a göre regression budget tanımlanır. Hard safety invariants veri beklemeden ilk günden geçerlidir; empirical floors ise önce kalibrasyon rejiminde provisional başlar, sonradan hard floor’a yükseltilir. Release gate’ler en az canary, expansion ve full rollout seviyelerinde uygulanmalıdır. Threshold değişiklikleri Platform/Evals ve Product sahipliğinde yönetilir; güvenlik/risk içeren capability’lerde Security/Policy katılımı zorunludur. Override mümkün olabilir, ancak yalnızca named owner’lar tarafından, gerekçeli, süreli ve auditli istisna olarak kullanılabilir. Rollback ve kill switch, release safety modelinin ayrılmaz parçasıdır.

Deliberate boundary listesi

Madde 8 bilinçli olarak aşağıdaki konuları kapsam dışı bırakır; bunlar operasyonel policy veya implementation RFC alanına aittir:

Exact trace field şemaları, event/protobuf/JSON alan isimleri
Trace retention gün sayıları ve veri saklama ayrıntıları
Sampling oranlarının sayısal değerleri ve dinamik tuning algoritmaları
Golden suite depolama biçimi, dosya düzeni ve execution tooling ayrıntıları
Specific eval scorer formülleri, rubric tasarımları ve model seçimi
Release blocker sayısal eşik değerleri ve exact threshold tabloları
Dashboard araçları, vendor seçimi ve telemetry backend tercihi
Incident SLA/SLO rakamları, on-call rotasyonu ve postmortem workflow ayrıntıları
Canary yüzdesi, rollout cadence, expansion adımları ve tam release runbook’u
Kill switch implementation detayı ve altyapı entegrasyon tasarımı
Shadow mode mimarisinin exact protokol ve ağ/topoloji ayrıntıları

Bu deliberate boundary, Madde 8’in kalite döngüsünün mimari invariant’larını tanımladığını; sayısal, araçsal ve süreçsel ayrıntıların ise bilinçli olarak alt seviye dokümanlara bırakıldığını belirtir.

Kabul kriterleri

Madde 8 aşağıdaki koşullar sağlandığında “implement edildi” sayılır:

Her run için sampling’e tabi olmayan minimal lineage ve sağlık sinyalleri tutuluyorsa.
Error, mutasyon, approval, daemon, escalation ve deneysel run sınıfları için full-fidelity trace zorunlu hale getirilmişse.
Observability ile governance provenance aynı telemetry spine üzerinde korele edilebiliyor ama ayrı sözleşmeler olarak işletiliyorsa.
Golden task suite versioned, owner’lı ve last-reviewed bilgili living benchmark olarak yönetiliyorsa.
Büyük sistem değişiklikleri sonrası ilgili eval setlerinin refresh/review süreci zorunlu ise.
Hard safety invariants ile empirical floors ayrımı uygulanıyorsa.
Empirical floors başlangıçta provisional olarak tanımlanıp kalibrasyon sonrası hard floor’a yükseltilebiliyorsa.
Release gate modeli en az canary, expansion ve full rollout seviyelerini ayırıyorsa.
Threshold sahipliği ve override yetkisi açık owner’lara bağlı, gerekçeli ve auditli biçimde çalışıyorsa.
Kritik incident’lar replay, postmortem ve regression-to-eval akışına bağlanıyorsa.
Kill switch ve rollback, release safety tasarımının fiilen uygulanmış parçalarıysa.
Deliberate boundary korunuyor ve sayısal/runbook ayrıntıları anayasa içine taşınmıyorsa.
Resmi karar cümlesi

Runa’nın kalite ve release güvenliği mimarisi, katmanlı observability, versioned living evaluation suite, owner’lı threshold sözleşmeleri ve kademeli release gate modeliyle çalışan bir full quality loop üzerine kurulacaktır; her run için zorunlu lineage korunacak, kalite tabanları hard safety invariants ve kalibrasyonlu empirical floors ile yönetilecek, incident’lar öğrenmeye dönüştürülecek ve release kararları denetlenebilir, ölçülebilir ve geri alınabilir hale getirilecektir.






Runa Architectural Constitution — Madde 9
Security, Sandbox & Trust Model Anayasası

Durum: Kilitlendi
Kapsam: Trust zone mimarisi, zone’lar arası güven ispatı, local daemon güvenliği, provider trust, plugin/MCP supply-chain güvenliği, model output guard, secret lifecycle, offline/degraded güvenlik davranışı ve güvenlik görünürlüğü
Amaç: Runa’nın cloud control plane, local daemon, browser, IDE, MCP/plugin ve model provider katmanları arasında güven sınırlarını açıkça tanımlamak; en güçlü capability’leri sunarken blast radius’u sınırlamak, güvenliği görünür kılmak ve güvenli varsayılanları korumak

Resmi karar özeti

Runa’nın güvenlik mimarisi, klasik web uygulaması güvenliği olarak değil; zero-trust, stratified execution security architecture olarak tasarlanacaktır. Sistem, en az cloud control plane, model provider boundary, local daemon, local OS capability layer, browser automation runtime, IDE integration runtime, MCP/plugin runtime ve external service boundary gibi trust zone’ları tanıyacak; bu zone’lar genişletilebilir ancak registry-controlled olacaktır. Madde 4’te tanımlanan permission ve action-context policy engine, tool execution governance katmanıdır; Madde 9 ise bunun üstünde yer alan trust boundary enforcement katmanıdır. Başka bir deyişle, Madde 4 “hangi aksiyon hangi koşulda izinli?” sorusunu, Madde 9 ise “bu aksiyon hangi güven sınırında, hangi kimlikle, hangi izolasyonda, hangi blast radius ile çalışır?” sorusunu cevaplar. Runa’da model output execution değildir; yalnızca intent veya aday aksiyon olarak değerlendirilir ve trust boundary enforcement katmanlarından geçmeden çalışamaz. Güvenlik ile performans arasındaki doğal gerilim kabul edilir; bu nedenle risk-temelli fast path ve tam guard path birlikte var olacaktır. Offline/degraded modda capability yüzeyi genişlemeyecek, daralacaktır. Governance ve security görünürlüğü kullanıcıya ve yetkili operatöre uygun biçimde yansıtılacak; security posture statik varsayımlarla değil, Madde 8 ile uyumlu biçimde sürekli değerlendirme ve adversarial test disipliniyle doğrulanacaktır.

Zorunlu ilkeler
Runa güvenlik mimarisi zero-trust ilkesine dayanacaktır; hiçbir trust zone başka bir zone’a varsayılan güven vermeyecektir.
Runa’da en az cloud control plane, model provider boundary, local daemon, local OS capability layer, browser automation runtime, IDE integration runtime, MCP/plugin runtime ve external service boundary trust zone olarak tanımlanmalıdır.
Trust zone listesi kapalı olmayacaktır; yeni zone’lar registry-controlled biçimde eklenebilecektir.
Her trust zone’un kimliği, yetki sınırı, izinli capability sınıfı, secret erişim düzeyi, audit seviyesi ve degrade davranışı açıkça tanımlanmalıdır.
Zone’lar arası iletişim yalnızca güven varsayımıyla değil, kriptografik kimlik ve karşılıklı doğrulama ile kurulmalıdır.
Cloud ve local daemon arasında spoof-resistant mutual authentication zorunlu olacaktır.
Daemon binary signing, zone’lar arası session token yönetimi ve device/session identity doğrulaması güven zincirinin zorunlu parçaları olacaktır.
Farklı ortamlar (development, staging, production ve benzeri) farklı trust policy profillerine tabi olacaktır.
Development/staging kolaylığı, production-grade trust boundary’lerini aşındıran sessiz geniş ayrıcalıklara dönüşemez; ortam farkları açık policy profilleriyle yönetilmelidir.
Model provider’lar da birer trust boundary ve attack surface olarak ele alınacaktır.
Hassas veri minimizasyonu, provider-specific routing ve redaction kuralları uygulanmadan model provider’a veri gönderilemez.
Secret’lar model context’e doğrudan sızdırılamaz; secret lifecycle ayrı ve izole bir güvenlik alanı olarak yönetilecektir.
Secret’lar dedicated ve isolated store’da tutulmalı; scope-limited, time-limited ve rotatable olmalıdır.
MCP/plugin veya başka dış entegrasyonlara verilen credential’lar minimum yetkiyle, dar kapsamlı ve mümkünse süreli verilmelidir.
Plugin/MCP supply-chain güvenliği birinci sınıf risk alanı olarak ele alınacaktır.
MCP/plugin/server entegrasyonları allow-by-default değil, trust enrollment rejimiyle açılacaktır.
Signed veya provenance-tagged manifests, capability scope tanımı, install/use/revoke lifecycle ve secret isolation plugin/MCP güvenliğinin zorunlu parçalarıdır.
Local daemon varsayılan olarak minimum yetkiyle başlar; capability açıldıkça yükselen stratified privilege tiers ile çalışır.
Daemon için en az observe-only, scoped read/inspect, bounded local actions ve high-risk mutation gibi privilege sınıfları tanımlanmalıdır.
OS-level privilege escalation explicit, görünür ve daha sıkı onay/policy rejimine tabi olacaktır.
Bir trust zone’daki ihlal diğer zone’lara otomatik güven veya geçiş sağlamaz; blast radius tanımlı ve sınırlı olmak zorundadır.
Lateral movement prevention ve zone isolation enforcement güvenlik mimarisinin zorunlu parçasıdır.
Model output execution değildir.
Modelin ürettiği komut, patch, browser adımı veya başka herhangi bir aksiyon ancak validator, policy, risk sınıflandırma, sandbox ve gerekirse approval kapılarından geçtikten sonra çalışabilir.
Tüm aksiyonlar aynı ağırlıkta guard pipeline’dan geçmeyecektir; düşük riskli, deterministic ve semantic-first işlemler için fast path, yüksek riskli veya mutating işlemler için tam guard path uygulanacaktır.
Madde 4’teki tool risk sınıfları ve semantic-first hiyerarşi, Madde 9’daki risk-based security fast path ile uyumlu çalışacaktır.
Güvenlik ile latency arasında doğal bir gerilim olduğu anayasal olarak kabul edilir; bu nedenle güvenlik enforcement, risk sınıfına göre optimize edilir ancak tamamen atlanamaz.
Güvenlik kararları yalnızca sistem içi log’larda kalmayacak, kullanıcıya ve yetkili operatöre uygun biçimde görünür olacaktır.
Provider’a veri gönderimi, daemon privilege escalation, yüksek riskli plugin/MCP erişimi ve kritik mutasyon sınıfı aksiyonlar kullanıcı yüzeyinde uygun güvenlik görünürlüğü üretmelidir.
Offline/degraded modda capability yüzeyi genişlemeyecek, daralacaktır.
Cached policy süresiz güven kaynağı sayılamaz; freshness/TTL zorunlu olacak ve stale policy durumunda yüksek riskli capability’ler fail-safe davranışa geçecektir.
Offline veya kontrol düzlemi kaybı durumunda yerel daemon yalnızca açıkça izinli, daraltılmış ve stale-safe capability seti ile çalışabilir.
Security posture yalnızca statik policy ile değil, Madde 8 ile uyumlu adversarial evaluation, security regression testing ve attack-surface review ile sürekli doğrulanacaktır.
Security evidence, governance provenance ve observability ile korele edilebilir olmalı; ancak erişim ve retention politikaları ilgili maddelerde tanımlanan sınırları ihlal etmemelidir.
Yasak yaklaşımlar
Trust zone’ları yalnızca kavramsal diyagram olarak tanımlayıp zone’lar arası kimlik ve mutual authentication kurmamak yapılamaz.
Local daemon’ı “güvenilir ajan” varsayımıyla geniş yetkilerle başlatmak yapılamaz.
Development kolaylığı adına production boundary’lerini fiilen geçersiz kılan sessiz tam yetki profilleri kullanılamaz.
Model provider’ı nötr ve risksiz kanal gibi ele almak yapılamaz.
Secret’ları genel uygulama belleğinde, model context’te veya plugin’lere geniş ve süresiz biçimde taşımak yapılamaz.
Plugin/MCP server’ları provenance, scope ve enrollment olmadan güvenilir kabul etmek yapılamaz.
Bir trust zone’da ihlal oluştuğunda diğer zone’lara serbest geçişe izin vermek yapılamaz.
Model output’u doğrudan shell, file system, browser, IDE veya daemon aksiyonu olarak çalıştırmak yapılamaz.
Tüm işlemler için aynı ağır security gate’i zorlayarak sistemi kullanılmaz hale getirmek de, low-risk bahanesiyle high-risk işlemleri fast path’e sokmak da yapılamaz.
Güvenlik açısından kritik aksiyonların kullanıcıya veya operatöre tamamen görünmez kalmasına izin verilemez.
Offline/degraded modda stale policy ile capability yüzeyini genişletmek yapılamaz.
Cached policy’yi süresiz veya owner’sız güven kaynağı gibi kullanmak yapılamaz.
Güvenlik posture’unu yalnızca checklist veya tek seferlik review ile “tamamlandı” saymak yapılamaz.
Madde 4’ün execution governance sınırı ile Madde 9’un trust boundary enforcement sınırını karıştırmak yapılamaz.
Uygulama çerçevesi
A. Trust Zones ve Cryptographic Trust Fabric

Runa, trust zone temelli bir güvenlik omurgası kullanacaktır. Cloud control plane, model provider boundary, local daemon, local OS capability layer, browser runtime, IDE runtime, MCP/plugin runtime ve external service boundary başlangıç zone’larıdır; fakat sistem yeni zone’lar eklenebilecek şekilde registry-controlled tasarlanacaktır. Zone’lar arası güven, varsayımsal değil kriptografik olacaktır: signed daemon binary, mutual authentication, device/session identity ve session token yönetimi güven zincirinin temel parçalarıdır. Farklı ortamlar farklı trust policy profillerine sahip olacaktır; development ve staging profilleri production ile aynı güven rejimini birebir paylaşmak zorunda değildir, ancak bu farklılık açık ve yönetilen policy profilleriyle tanımlanmalıdır. Böylece “dev kolaylığı” production güvenliğini sessizce aşındıran istisna haline gelemez.

B. Provider Trust, Secret Lifecycle ve Supply-chain Security

Runa, model provider’ları ve dış entegrasyonları bağımsız attack surface kabul eder. Provider’a giden context, veri minimizasyonu, routing ve redaction kurallarına tabi olacaktır. Secret’lar dedicated ve isolated store’da tutulacak; model context’e sızdırılmayacak; scope-limited, time-limited ve rotatable olacak şekilde yönetilecektir. MCP/plugin/server tarafında credential delegation dar kapsamlı yapılacak; signed/provenance-tagged manifest, enrollment, scoped capability declaration ve revoke lifecycle zorunlu olacaktır. Supply-chain güvenliği, yalnızca paket yükleme anında değil, capability kullanım ömrü boyunca korunacaktır.

C. Daemon Privilege, Output Guard ve Lateral Containment

Local daemon, minimum yetkiyle başlar ve stratified privilege tiers modeliyle yükselir. Observe-only, scoped read, bounded local actions ve high-risk mutation gibi ayrı privilege sınıfları bulunur. OS-level escalation daha sert guard ve approval rejimi gerektirir. Model output hiçbir zaman execution değildir; yalnızca aday aksiyon olarak değerlendirilir. Bu aday aksiyon, risk düzeyine göre fast path veya full guard path içinden geçer. Low-risk ve deterministic işlemler hızlı güvenlik yolundan akabilir; high-risk, mutating veya boundary-crossing işlemler tam validation, policy, classifier, sandbox ve approval zincirine girer. Bir zone’un ihlali diğer zone’lara sıçrama varsayımı yaratmaz; lateral movement prevention ve blast radius containment bu katmanın merkezindedir.

D. Offline / Degraded Security Behavior ve Security Evaluation

Cloud kaybı, policy fetch başarısızlığı veya stale cache durumlarında sistem fail-open değil fail-safe davranacaktır. Offline modda capability yüzeyi daralacak; stale policy ile yalnızca açıkça izinli düşük riskli capability’ler çalışabilecektir. Policy cache tazeliği zorunludur; stale state yüksek riskli yetkileri otomatik kapatır. Security posture yalnızca statik policy ile korunmaz; Madde 8 ile uyumlu biçimde adversarial testing, security regression eval’leri ve attack-surface review döngüsüyle doğrulanır. Bu sayede güvenlik, yalnızca tasarım niyeti olarak değil, sürekli ölçülen bir operasyonel özellik olarak yaşatılır.

Deliberate boundary listesi

Madde 9 bilinçli olarak aşağıdaki konuları kapsam dışı bırakır; bunlar operasyonel policy veya implementation RFC alanına aittir:

Spesifik şifreleme algoritmaları ve anahtar boyutları
Seçilecek sandbox teknolojisi veya izolasyon mekanizmasının exact türü (Docker, VM, process sandbox vb.)
Mutual auth veya session doğrulama için exact protokol tercihleri
Policy cache TTL’lerinin ve stale threshold’larının sayısal değerleri
Pen-test, red-team veya security review takvimleri ve cadenceleri
Network topology, service mesh, firewall kural setleri ve ağ segmentasyonu ayrıntıları
CVE scanning, SAST/DAST, dependency scanning veya security tooling vendor tercihleri
Secret store vendor seçimi ve exact rotation workflow adımları
Alerting sistemleri, SIEM entegrasyonları ve incident notification zinciri detayları
Break-glass rol eşlemesi, süre sınırları ve approval adımlarının exact runbook tasarımı
Development/staging/prod ortamları için exact permission tabloları ve override listeleri
UI’da güvenlik görünürlüğünün exact metinleri, ikonları ve component tasarımları

Bu deliberate boundary, Madde 9’un güvenlik mimarisinin değişmez ilkelerini tanımladığını; algoritma, araç, sayısal eşik ve runbook ayrıntılarını ise bilinçli olarak alt seviye dokümanlara bıraktığını belirtir.

Kabul kriterleri

Madde 9 aşağıdaki kriter kümeleri sağlandığında “implement edildi” sayılır:

1. Trust Fabric & Zone Model
En az çekirdek trust zone’lar tanımlanmışsa ve yeni zone ekleme registry-controlled ise
Zone’lar arası mutual authentication, signed daemon identity ve session/device kimlik doğrulaması mevcutsa
Development/staging/prod ortamlarının farklı trust policy profilleri açıkça uygulanıyorsa
2. Execution Security & Containment
Local daemon privilege tiers uygulanıyorsa
Model output doğrudan execution sayılmıyor ve risk-based guard pipeline içinden geçiyorsa
High-risk aksiyonlar full guard path’e, low-risk deterministic aksiyonlar kontrollü fast path’e giriyorsa
Lateral movement containment ve blast radius sınırları enforcement düzeyinde mevcutsa
3. Secrets, Providers & Supply Chain
Secret’lar isolated store’da, scope-limited ve rotatable lifecycle ile yönetiliyorsa
Provider’a giden veri minimizasyonu ve redaction politikaları uygulanıyorsa
MCP/plugin/server enrollment, provenance ve scoped credential ilkeleri uygulanıyorsa
4. Offline/Degraded Safety & Visibility
Offline/degraded modda capability yüzeyi genişlemeyip daralıyorsa
Policy cache freshness enforced ediliyor ve stale policy yüksek riskli capability’leri kapatıyorsa
Provider veri gönderimi, privilege escalation ve kritik plugin erişimleri kullanıcıya/operatöre uygun güvenlik görünürlüğü üretiyorsa
5. Security Governance & Continuous Validation
Security posture adversarial eval veya security regression döngüleriyle doğrulanıyorsa
Madde 4 ile Madde 9 arasındaki execution governance / trust boundary enforcement ayrımı mimaride korunuyorsa
Deliberate boundary ihlal edilmeden operasyonel detaylar ayrı policy/RFC katmanlarında yönetiliyorsa
Resmi karar cümlesi

Runa’nın güvenlik mimarisi, zero-trust ve stratified execution ilkeleri üzerine kurulacak; trust zone’lar kriptografik güven kumaşıyla bağlanacak, local daemon minimum yetkiyle ve sınırlı blast radius içinde çalışacak, model output hiçbir zaman doğrudan execution sayılmayacak, provider ve plugin sınırları attack surface olarak yönetilecek, offline/degraded durumda capability yüzeyi fail-safe biçimde daralacak ve tüm bu yapı sürekli güvenlik değerlendirmesiyle doğrulanacaktır.





Runa Architectural Constitution — Madde 10
Data Governance, Retention, Sovereignty, Sync Authority ve Deletion Orchestration Anayasası

Durum: Kilitlendi
Kapsam: Veri sınıfları, yaşam döngüsü, authority modeli, retention sınıfları, tenant/rezidans ilkeleri, PII işleme, silme/ihracat/hold akışları, sync conflict yönetimi ve referans bütünlüğü
Amaç: Runa’da verinin tek tip bir “uygulama verisi” gibi değil; farklı doğruluk, gizlilik, kalıcılık, yetki ve yaşam döngüsü rejimlerine sahip veri sınıfları olarak yönetilmesini sağlamak

Bu madde, önceki maddelerde tanımlanan memory, artifact truth store, provenance, observability ve local daemon yeteneklerinin veri yönetişimi açısından bütüncül ve güvenilir biçimde işletilmesini anayasal hale getirir. Runa’nın güçlü local daemon vizyonu ile cloud control plane, provenance ve eval omurgası arasındaki veri sınırlarını tutarlı biçimde kurar.

Resmi karar özeti

Runa’da veri mimarisi, data-class architecture + lifecycle governance ilkesiyle kurulacaktır. Veri, storage’a göre değil sınıfına göre tanımlanacak; her veri sınıfı için authority modeli, retention sınıfı, erişim sınırı, deletion/export davranışı, sync semantiği ve gizlilik kuralları ayrı belirlenecektir. Tek bir kaba “server-authoritative” yaklaşımı yerine data class’a göre differentiated authority model uygulanacaktır: governance/provenance server-authoritative olacak, user preference verisi server-authoritative + local cache ile çalışacak, workspace/project verisi local-primary ve opsiyonel sync destekleyecek, active run state run sırasında server-authoritative olacak, artifact verisi local storage + opsiyonel cloud backup modeliyle yönetilecek, ephemeral veriler ise tamamen local kalabilecektir. Runa, veri rezidansı, tenant-seviyesinde konum tercihi, PII duyarlılığı, at-rest encryption, data-class aware deletion orchestration, cross-class referential integrity ve sync conflict görünürlüğünü anayasal zorunluluk haline getirir. Kullanıcı verisi açık izin olmadan eğitim, fine-tuning veya model improvement için yeniden kullanılamaz.

Zorunlu ilkeler
Runa’da veri yönetimi data class before storage ilkesiyle yapılacaktır.
Her veri nesnesi, açıkça tanımlı bir veri sınıfına ait olmalıdır.
En az şu veri sınıfları anayasal sınıflar olarak tanımlanmalıdır: interaction data, operational run state, artifact truth data, memory data, governance/provenance data, observability/eval data ve ephemeral/cache data.
Her veri sınıfı için authority modeli, retention sınıfı, erişim düzeyi, deletion/export davranışı, sync semantiği ve gizlilik rejimi ayrı tanımlanmalıdır.
Runa tek tip “server-authoritative” model kullanmayacaktır; data class’a göre differentiated authority model uygulanacaktır.
Governance/provenance verisi server-authoritative olacaktır.
User preference verisi server-authoritative olacak, ancak performans ve kullanılabilirlik için local cache taşıyabilecektir.
Workspace/project verisi local-primary olabilir ve opsiyonel sync destekleyebilir.
Active run state, run süresince server-authoritative olarak ele alınacaktır.
Artifact truth data, local storage’da bulunabilir ve opsiyonel cloud backup ile desteklenebilir.
Ephemeral/cache data tamamen local tutulabilir ve truth kaynağı sayılmaz.
Veri authority modeli, capability veya surface bazında sessizce değiştirilemez; data class’ın parçası olarak açıkça tanımlanmalıdır.
Tenant, workspace, user ve device sınırları veri modelinde birinci sınıf kavramlar olacaktır.
Runa veri residency ilkelerini desteklemeli ve tenant-seviyesinde veri konum tercihi uygulanabilir olmalıdır.
Veri rezidansı ve tenant konum tercihleri storage implementasyon detayı değil, mimari veri yönetişimi zorunluluğudur.
PII-sensitive veri sınıfları ve PII taşıyabilecek veri yüzeyleri açıkça tanımlanmalıdır.
Kullanıcı mesajları, dosya içerikleri, ekran görüntüleri, artifact içerikleri ve türetilmiş bağlamlar PII taşıyabilecek yüzeyler olarak ele alınmalıdır.
PII-sensitive veri, data class boyunca redaction, masking ve minimization ilkelerine tabi olacaktır.
Madde 9’da tanımlanan provider trust minimization, PII-sensitive veri için daha sıkı uygulanmalıdır.
Hassas veri sınıfları at-rest encryption ile korunmalıdır.
At-rest encryption ilkesi storage vendor veya algoritma seçimine bağlı olmaksızın anayasal zorunluluktur.
Retention, storage alanına göre değil retention class’a göre yönetilecektir.
En az şu retention class ailesi desteklenmelidir: ephemeral, short-lived operational, user-visible durable, audit-grade durable ve hold-eligible.
Exact retention süreleri anayasa konusu değildir; ancak retention class zorunludur.
Deletion ve export, tekil storage silme işlemi değil; data-class aware orchestration olarak ele alınacaktır.
Kullanıcı veya tenant verisine silme talebi geldiğinde, tüm ilgili veri sınıfları üzerinden uygun deletion policy uygulanmalıdır.
Cross-class referential integrity korunmalıdır; silinen veya dönüştürülen veriye işaret eden diğer sınıflar sessizce orphan hale bırakılamaz.
Orphan referans riski olan deletion akışlarında tombstone, reference rewrite, cascade delete veya policy-retained pointer gibi açık stratejilerden biri uygulanmalıdır.
Hard delete ile tombstone davranışı aynı şey değildir; her veri sınıfı için uygun deletion semantics tanımlanmalıdır.
Legal hold, incident hold veya policy-retained kayıtlar, normal kullanıcı silme akışıyla aynı muameleye tabi tutulamaz.
Kullanıcı verisi, açık izin olmadan eğitim, fine-tuning veya model improvement amacıyla yeniden kullanılamaz.
Feedback veya reuse akışları açık izin, sınıflandırma ve yönetişim olmadan varsayılan olarak kapalı kabul edilir.
Sync conflict nedeniyle kullanıcı çalışması sessizce kaybolamaz.
Tüm sync conflict’ler tespit edilmeli ve deterministic, kullanıcıya görünür bir sonuca ulaşmalıdır.
Conflict çözümü, veri sınıfına göre farklı olabilir; ancak “sessiz overwrite” anayasal olarak yasaktır.
Multi-device kullanımda canonical truth ve local projection ayrımı veri sınıfına göre açıkça tanımlanmalıdır.
Cache ve derived summary katmanları truth store yerine geçemez.
Derived veya ephemeral veri sınıfları mümkün olduğunda yeniden üretilebilir olmalıdır.
Governance/provenance, observability ve eval verileri birbirine referans verebilir; ancak retention ve deletion davranışları aynı olmak zorunda değildir.
Deliberate boundary gereği, sayısal retention süreleri, storage motorları, şema alanları ve sync algoritma detayları anayasa dışında bırakılacaktır.
Yasak yaklaşımlar
Tüm veriyi tek retention ve tek authority rejimi altında toplamak yapılamaz.
Workspace/local-primary veriyi sessizce server-authoritative varsaymak veya tam tersi yapmak yapılamaz.
Data class tanımı olmadan storage tasarımıyla veri yönetişimi çözülmüş sayılmaz.
Governance/provenance, artifact, memory, trace ve cache verilerini aynı yaşam döngüsü varsayımıyla yönetmek yapılamaz.
Tenant veya residency tercihini “sonradan storage migration konusu” diye ertelemek yapılamaz.
PII taşıyan veriyi sınıflandırmadan genel veri gibi işlemek yapılamaz.
Hassas veri sınıflarını at-rest encryption olmadan bırakmak yapılamaz.
Kullanıcı verisini açık izin olmadan eğitim, model improvement veya benzeri yeniden kullanım akışlarına sokmak yapılamaz.
Deletion akışında cross-class referential integrity yok sayılarak orphan referanslar bırakmak yapılamaz.
“Delete” ile “tombstone” aynı kabul edilerek veri semantiği bulanıklaştırılamaz.
Sync conflict’lerde last-write-wins sessiz overwrite varsayılan davranış olamaz.
Kullanıcı çalışmasının veya memory etkisinin senkronizasyon sırasında görünmez biçimde kaybolmasına izin verilemez.
Cache veya summary verisini canonical truth yerine koymak yapılamaz.
Exact süreler, vendor seçimleri ve runbook detayları anayasa içine gömülerek deliberate boundary ihlal edilemez.
Uygulama çerçevesi
A. Data Classes ve Differentiated Authority

Runa veri mimarisi, veri sınıfı temelli yönetilecektir. Interaction data, operational run state, artifact truth, memory, governance/provenance, observability/eval ve ephemeral/cache verileri anayasal veri sınıflarıdır. Authority modeli veri sınıfına göre değişecektir: governance/provenance server-authoritative, user preference server-authoritative + local cache, workspace/project local-primary + optional sync, active run state run süresince server-authoritative, artifacts local storage + optional cloud backup, ephemeral/cache ise local-only olabilir. Bu yaklaşım, Runa’nın cloud control plane ile güçlü local daemon yeteneklerini uzlaştırır. Hiçbir veri sınıfı için “varsayılan authority” sessizce değiştirilmez; authority veri sınıfının mimari sözleşmesinin parçasıdır.

B. Retention, Sovereignty ve Sensitive Data Handling

Her veri sınıfı retention class ile yönetilecektir. Exact gün/süre değerleri ayrı policy/runbook alanına ait olsa da ephemeral, short-lived operational, user-visible durable, audit-grade durable ve hold-eligible sınıfları desteklenmelidir. Tenant-seviyesinde veri residency ve konum tercihi desteklenebilir olmalı; bu yalnızca altyapı tercihi değil veri yönetişimi ilkesidir. PII-sensitive veri sınıfları ve veri yüzeyleri tanımlanmalı; redaction, masking, minimization ve provider trust sınırları veri sınıfı boyunca uygulanmalıdır. Hassas veri sınıfları at-rest encryption ile korunacaktır. Böylece Runa yalnızca işlevsel değil, enterprise-uyumlu veri sınırları olan bir platform haline gelir.

C. Deletion, Export, Hold ve Referential Integrity

Silme, dışa aktarma veya tutma kararları data-class aware orchestration ile yapılacaktır. Kullanıcıya ait interaction verisi silinirken bunun memory, trace, eval sonucu, provenance pointer veya artifact referansları üzerindeki etkisi ayrıca değerlendirilmelidir. Cross-class referential integrity anayasal zorunluluktur; silinen veriye işaret eden başka veri sınıfları sessizce bozuk bırakılmaz. Her veri sınıfı için tombstone, hard delete, cascade delete, pointer rewrite veya policy-retained metadata stratejileri tanımlanabilir. Legal hold, incident hold veya audit-grade kayıtlar normal delete akışından ayrıştırılır. Export kabiliyeti de veri sınıfına göre farklı olabilir; tüm sınıflar aynı export semantics’i paylaşmak zorunda değildir.

D. Multi-device Sync ve Conflict Governance

Runa çok cihazlı kullanımda tek kaba sync modeli kullanmayacaktır. Veri sınıfına göre canonical truth ve local projection ayrımı yapılacaktır. Sync conflict tespiti zorunludur ve hiçbir conflict sessiz veri kaybına yol açamaz. Governance/provenance gibi sınıflar daha katı canonical davranış gösterebilir; workspace veya artifact verisi local-first davranabilir; active run state conflict-aware ve authoritative biçimde ele alınır. Memory ve user preference verileri, candidate merge veya deterministic resolution mantığıyla yönetilebilir. Temel anayasal ilke şudur: kullanıcı çalışması, approval etkisi, memory güncellemesi veya artifact referansı sync sırasında sessizce kaybolmayacaktır. Sistem, conflict’i görünür kılacak ve deterministic sonuca ulaştıracaktır.

Deliberate boundary listesi

Madde 10 bilinçli olarak aşağıdaki konuları kapsam dışı bırakır; bunlar operasyonel policy veya implementation RFC alanına aittir:

Exact retention gün/saat değerleri
Storage engine/vendor seçimi ve veri tabanı topolojisi
Encryption algoritması, key management vendor’ı ve rotation workflow ayrıntıları
Data residency’nin exact bölge/ülke matrisi ve migration operasyonları
PII detection modelleri, regex setleri veya classifier implementasyon detayları
Export formatları, file schemas ve API payload yapıları
Tombstone, hard delete ve cascade delete’in exact storage-level uygulama kodu
Sync conflict resolution algoritmalarının detaylı formülü veya CRDT/protocol seçimi
Local cache invalidation, offline storage mekanizması ve queue implementasyonu
Legal hold, discovery, compliance workflow ve review adımlarının exact runbook tasarımı
Training opt-in UI akışları, consent metinleri ve commercial/legal wording ayrıntıları

Bu deliberate boundary, Madde 10’un veri yönetişimi için mimari invariant’ları tanımladığını; storage, algoritma, sayısal süre ve süreç ayrıntılarını ise bilinçli olarak alt seviye dokümanlara bıraktığını belirtir.

Kabul kriterleri

Madde 10 aşağıdaki kriter kümeleri sağlandığında “implement edildi” sayılır:

1. Data Classes & Authority Model
Anayasal veri sınıfları tanımlanmışsa
Her veri sınıfı için authority modeli, retention class ve erişim rejimi belirlenmişse
Differentiated authority modeli uygulanıyor ve local/cloud gerilimi veri sınıfı bazında çözülmüşse
2. Sovereignty, Privacy & Sensitive Data Controls
Tenant-seviyesinde residency tercihi için mimari destek varsa
PII-sensitive veri sınıfları ve veri yüzeyleri tanımlanmışsa
Hassas veri sınıfları için at-rest encryption ve minimization ilkeleri uygulanıyorsa
Kullanıcı verisi açık izin olmadan training/model improvement için yeniden kullanılmıyorsa
3. Deletion / Export / Referential Integrity
Data-class aware deletion orchestration mevcutsa
Cross-class referential integrity korunuyor ve orphan referanslar sessizce bırakılmıyorsa
Hold/review/policy-retained kayıtlar normal delete akışından ayrıştırılmışsa
4. Sync & Multi-device Governance
Veri sınıfına göre canonical truth ve local projection modeli uygulanıyorsa
Sync conflict’ler tespit ediliyor ve kullanıcı çalışması sessizce kaybolmuyorsa
Conflict çözümü deterministic ve görünür bir sonuca ulaşıyorsa
5. Boundary Discipline
Cache/derived katmanlar truth store yerine geçmiyorsa
Deliberate boundary korunuyor ve storage/algorithm/runbook ayrıntıları anayasa içine sızmıyorsa
Resmi karar cümlesi

Runa’nın veri mimarisi, data-class architecture ve lifecycle governance ilkeleri üzerine kurulacak; her veri sınıfı kendi authority, retention, privacy ve deletion semantiğiyle yönetilecek, tenant-seviyesinde sovereignty ve hassas veri koruması desteklenecek, kullanıcı verisi açık izin olmadan yeniden kullanılmayacak ve çok cihazlı kullanımda hiçbir conflict veya silme işlemi sessiz veri kaybına veya bozuk referanslara yol açmayacaktır.







Runa Architectural Constitution — Madde 11
Knowledge, Retrieval & Connector Strategy Anayasası

Durum: Kilitlendi
Kapsam: Kaynak sınıfları, retrieval routing, source authority, freshness/staleness, conflict resolution, connector sözleşmeleri, user source agency, adversarial knowledge savunmaları ve Madde 2’ye context handoff
Amaç: Runa’nın bilgiyi yalnızca bulmasını değil; doğru kaynağı seçmesini, çelişkileri yönetmesini, tazeliği değerlendirmesini, kullanıcı tercihlerini gözetmesini ve retrieved knowledge’u güvenilir biçimde context katmanına beslemesini sağlamak

Bu madde, paylaşılan metindeki harness, context, compaction ve project-context vurgusunun; retrieval, connector ve bilgi güvenilirliği katmanına taşınmış anayasal karşılığıdır. Özellikle ürünün farkını modelden çok sistem/harness yaklaşımının yarattığı yönündeki temel sezgiyi, knowledge routing ve source governance düzeyine genişletir.

Resmi karar özeti

Runa’da bilgi erişimi, tek bir arama motoru veya düz RAG yaklaşımıyla değil; source-class architecture + retrieval routing policy ile yönetilecektir. Kaynaklar en az local working, synced knowledge, live connected, artifact truth, memory-derived ve public/web sınıflarına ayrılacak; her sınıf trust, freshness, authority, latency, cost ve failure semantiğiyle tanımlanacaktır. Retrieval kararları yalnızca alaka skoruna göre değil; görev tipi, bilgi alanı, source authority, freshness, user source preference, cost/latency budget ve security/trust kısıtlarıyla verilecektir. Memory yardımcı kaynaktır; truth store yerine geçmez. Farklı kaynaklardan gelen bilgi sessizce birleştirilmeyecek; conflict tespit edilecek, çözüm stratejisi uygulanacak ve gerektiğinde kullanıcıya görünür hale getirilecektir. Public/web ve düşük güvenli kaynaklar varsayılan olarak en düşük trust seviyesinde ele alınacak; kritik kararlarda tek başına belirleyici olamayacaktır. Retrieved knowledge, Madde 2’deki Context Composer katmanına kontrolsüz yığılmayacak; source metadata ve truth/freshness semantiğiyle birlikte uygun context layer’lara aktarılacaktır. Offline/degraded modda knowledge authority sıralaması değişebilecek, ancak bu değişim görünmez olmayacaktır.

Zorunlu ilkeler
Runa’da retrieval tasarımı source class before retrieval algorithm ilkesiyle kurulacaktır.
Retrieval, yalnızca search işlemi değil; routing, selection ve justification işlemidir.
En az şu source class’lar anayasal kaynak sınıfları olarak tanımlanmalıdır: local working sources, synced knowledge sources, live connected sources, artifact truth sources, memory-derived sources ve public/web sources.
Her source class için trust düzeyi, freshness semantiği, authority tipi, cost/latency profili ve failure davranışı tanımlanmalıdır.
Source authority statik bir sıralama olmayacaktır; görev tipine ve bilgi alanına göre context-sensitive authority resolution uygulanacaktır.
Bazen local workspace en güncel working truth, bazen live connector en güncel authoritative truth, bazen artifact store en yüksek doğruluk kaynağı olabilir; sistem bunu bağlamdan çıkarmalıdır.
Freshness, truth değerlendirmesinin parçasıdır; kaynak tazeliği reasoning girdisi olarak kullanılmalıdır.
Synced knowledge hızlı ama stale-prone, live connected source daha taze ama daha kırılgan, memory-derived source ise yardımcı bilgi olarak ele alınmalıdır.
Memory truth değildir; yardımcı ve türetilmiş kaynaktır.
Memory-derived içerik, authoritative truth veya artifact truth’un yerine geçemez.
Farklı kaynaklardan gelen çelişkili bilgi sessizce birleştirilemez.
Source conflict tespit edilmeli, conflict resolution stratejisi uygulanmalı ve yüksek etkili durumlarda kullanıcıya görünür hale getirilmelidir.
Conflict resolution her zaman tek bir sabit kural ile yapılmayacak; source authority, freshness, task type ve trust düzeyine göre bağlam-duyarlı olacaktır.
Düşük güvenli veya potansiyel adversarial kaynaklardan gelen bilgi, yüksek etkili kararları tek başına yönlendiremez.
Kritik kararlarda source cross-validation tercih edilmeli; özellikle düşük güvenli, stale-prone veya public/web kaynaklar tek başına belirleyici olmamalıdır.
Public/web sources varsayılan olarak en düşük default trust seviyesinde ele alınacaktır.
Public/web bilgisi local knowledge, artifact truth veya trusted connected sources ile çeliştiğinde özel conflict handling uygulanmalıdır.
Retrieval routing kararları yalnızca kaliteye göre değil, cost ve latency budget farkındalığıyla verilmelidir.
Retrieval bedava değildir; aşırı live fetch, gereksiz web araması veya düşük değerli connector çağrıları bütçe ihlali sayılabilir.
Connector’lar yalnızca entegrasyon kanalı değil, knowledge contract olarak ele alınacaktır.
Her connector için source class, trust düzeyi, freshness davranışı, auth scope’u, provenance formatı ve failure semantiği tanımlanmalıdır.
User source agency anayasal olarak desteklenmelidir.
Kullanıcı “yalnızca local kaynaklara bak”, “web’e gitme”, “canlı sistemle doğrula” gibi source tercihleri verebilmeli; retrieval routing bu tercihleri dikkate almalıdır.
User source preference, policy veya safety kısıtlarıyla çelişmiyorsa routing kararında bağlayıcı olmalıdır.
Retrieved knowledge, Madde 2’deki Context Composer’a kontrolsüz girmez; appropriate context layer ve budget kurallarıyla handoff edilir.
Retrieval sonucu, source metadata’sı, truth class’ı, freshness bilgisi ve gerekiyorsa conflict durumu ile birlikte Context Composer’a aktarılmalıdır.
Retrieved content’in hangi context layer’a besleneceği, Madde 2’deki composer katmanlarıyla uyumlu açık kurallara tabi olmalıdır.
Offline/degraded modda knowledge authority sıralaması değişebilir; local ve synced kaynaklar ağırlık kazanırken live connected kaynaklar devre dışı kalabilir.
Offline/degraded modda kullanılan bilginin stale olabileceği kullanıcıya ve runtime karar katmanına görünür olmalıdır.
Retrieval ve connector davranışları Madde 9’daki trust model ile uyumlu olacak; güvenlik ve bilgi stratejisi birbirini aşındırmayacaktır.
Retrieval posture, Madde 8 ile uyumlu biçimde evaluation ve adversarial testing ile doğrulanmalıdır.
Source poisoning, stale sync, wrong authority selection ve hidden conflict gibi hatalar eval ve regression kapsamına alınmalıdır.
Deliberate boundary gereği, exact ranking algoritmaları, embedding vendor’ları, fetch protokolleri ve connector implementasyon detayları anayasa dışında bırakılacaktır.
Yasak yaklaşımlar
Tüm knowledge kaynaklarını aynı retrieval mantığıyla, aynı truth ve freshness varsayımı altında yönetmek yapılamaz.
Memory-derived içeriği canonical truth yerine koymak yapılamaz.
Synced knowledge ile live connected source’u tazelik açısından eşdeğer varsaymak yapılamaz.
Farklı kaynaklardan gelen çelişkili bilgiyi sessizce harmanlamak yapılamaz.
Düşük güvenli veya adversarial olabilecek kaynağın kritik kararlarda tek başına belirleyici olmasına izin verilemez.
Public/web kaynakları varsayılan güvenli ve authoritative kabul edilemez.
Kullanıcının açık source tercihini sessizce yok saymak yapılamaz.
Retrieval routing’i maliyet ve latency’den bağımsız, sınırsız canlı sorgu motoru gibi tasarlamak yapılamaz.
Connector’ları “bağlandı geçti” yaklaşımıyla trust/freshness/provenance semantiği olmadan sisteme almak yapılamaz.
Retrieved knowledge’u Madde 2’deki context budget ve layer mantığını yok sayarak prompt’a yığmak yapılamaz.
Offline/degraded modda authority değişimini görünmez kılarak kullanıcıya güncelmiş gibi bilgi sunmak yapılamaz.
Security ve retrieval sınırlarını birbirine karıştırarak Madde 9’un trust enforcement katmanını zayıflatmak yapılamaz.
Exact ranking, embedding, fetch ve connector altyapı detaylarını anayasa maddesine gömerek deliberate boundary ihlal edilemez.
Uygulama çerçevesi
A. Source Classes ve Authority Resolution

Runa knowledge mimarisi, source class tabanlı çalışacaktır. Local working sources, aktif workspace ve yerel truth alanını temsil eder; synced knowledge sources hızlı ama stale olabilecek index/snapshot dünyasını temsil eder; live connected sources canlı ve daha güncel ama daha maliyetli ve daha kırılgan bilgi kanalıdır; artifact truth sources log, diff, tool output ve benzeri yüksek doğruluklu kanıtsal kaynakları ifade eder; memory-derived sources yardımcı ve türetilmiş bilgidir; public/web sources ise en düşük varsayılan trust ile ele alınan dış bilgidir. Authority resolution sabit bir sıralama ile değil, task type, domain, freshness ve source trust semantiğine göre bağlam-duyarlı yapılacaktır.

B. Retrieval Routing, Cost/Freshness ve User Source Agency

Runa’da retrieval motoru yalnızca arama yapmayacak; hangi kaynağa gidileceğine karar verecektir. Bu routing kararı alaka ile birlikte cost, latency, freshness, trust ve user preference sinyallerini kullanacaktır. Kullanıcılar belirli bağlamlarda source tercihleri verebilir; sistem bu tercihleri policy ile çelişmediği sürece routing kararına dahil etmek zorundadır. Freshness-aware routing temel kuraldır: güncellik kritikse live source, working truth kritikse local, hız ve düşük maliyet gerekiyorsa synced knowledge, kanıt gerekiyorsa artifact truth tercih edilir. Offline/degraded modda bu authority grafiği yeniden düzenlenir ve stale riski görünür biçimde etiketlenir.

C. Conflict Resolution, Poisoning Resistance ve Public/Web Guardrails

Runa sessiz source fusion yapmayacaktır. Farklı kaynaklardan gelen bilgi çeliştiğinde conflict detection devreye girecek; source authority, freshness, trust düzeyi ve task context kullanılarak çözüm stratejisi uygulanacaktır. Düşük güvenli kaynakların tek başına kritik karar üretmesi engellenecek; gerektiğinde cross-validation zorunlu hale gelecektir. Public/web sources özel guardrail rejimine tabidir: en düşük default trust seviyesiyle başlar, stale/hostile olabilecekleri varsayılır ve local knowledge, artifact truth veya trusted live sources ile çeliştiklerinde sessiz baskın çıkamazlar. Source poisoning ve adversarial knowledge, retrieval alanının temel tehdidi olarak kabul edilir.

D. Connector Contracts ve Context Handoff

Connector’lar yalnızca entegrasyon noktası değil, knowledge contract’tır. Her connector için source class, provenance formatı, freshness davranışı, auth/trust kapsamı, failure semantiği ve routing’teki rolü tanımlanmalıdır. Retrieval sonucu, Madde 2’deki Context Composer’a çıplak metin olarak değil; source metadata, authority/truth sınıfı, freshness bilgisi, conflict işareti ve gerekiyorsa policy/trust notlarıyla birlikte aktarılmalıdır. Böylece retrieved knowledge, context katmanında bütçe ve compositional kurallara tabi biçimde yer alır; retrieval ile prompt assembly arasında görünür ve denetlenebilir bir handoff sağlanır.

Deliberate boundary listesi

Madde 11 bilinçli olarak aşağıdaki konuları kapsam dışı bırakır; bunlar operasyonel policy veya implementation RFC alanına aittir:

Exact ranking algoritmaları, scorer formülleri ve blending mantıkları
Embedding vendor’ı, vector store seçimi ve index topology ayrıntıları
Connector fetch protokolleri, request batching ve caching implementasyon detayları
Freshness TTL sayıları, staleness budget değerleri ve sync cadenceleri
Cross-validation eşiklerinin sayısal değerleri
Source conflict çözümünde kullanılacak exact confidence matematiği
Web arama sağlayıcısı, crawler seçimi ve content extraction araçları
Connector onboarding workflow’unun exact UI/API tasarımı
Retrieval cost budget sayılarını ve latency SLO değerlerini belirleyen runbook’lar
Context Composer handoff payload’larının exact schema alanları ve serialization formatları
Source preference UI kopyaları, toggles ve kullanıcı deneyimi detayları

Bu deliberate boundary, Madde 11’in bilgi stratejisinin mimari invariant’larını tanımladığını; algoritmik, araçsal ve sayısal ayrıntıları ise bilinçli olarak alt seviye dokümanlara bıraktığını belirtir.

Kabul kriterleri

Madde 11 aşağıdaki kriter kümeleri sağlandığında “implement edildi” sayılır:

1. Source Model & Authority
Anayasal source class’lar tanımlanmışsa
Her source class için trust, freshness, authority ve failure semantiği belirlenmişse
Authority resolution statik değil bağlam-duyarlı çalışıyorsa
2. Routing, Freshness & User Agency
Retrieval routing cost, latency, freshness ve trust farkındalığıyla yapılıyorsa
User source preference sistemi routing’e yansıyorsa
Offline/degraded modda authority grafiği değişiyor ve stale riski görünür kılınıyorsa
3. Conflict & Adversarial Knowledge Handling
Source conflict tespiti yapılıyor ve sessiz birleşim engelleniyorsa
Düşük güvenli/public kaynaklar kritik kararlarda tek başına belirleyici olamıyorsa
Source poisoning ve wrong-authority selection eval kapsamına alınmışsa
4. Connector Contracts & Context Handoff
Connector’lar knowledge contract olarak tanımlanmışsa
Retrieval sonucu source metadata ve truth/freshness semantiğiyle Context Composer’a aktarılıyorsa
Madde 2 ve Madde 9 ile olan sınırlar uygulamada korunuyorsa
Resmi karar cümlesi

Runa’nın bilgi mimarisi, source-class architecture ve retrieval routing policy ilkeleri üzerine kurulacak; kaynak seçimi bağlam-duyarlı authority, freshness, trust, cost ve user preference sinyalleriyle yapılacak, memory truth yerine geçmeyecek, source conflict sessizce yutulmayacak, public/web kaynakları düşük varsayılan güvenle ele alınacak ve retrieved knowledge Madde 2’nin context katmanına provenance ile birlikte kontrollü biçimde aktarılacaktır.








Runa Architectural Constitution — Madde 12
Identity, Principal Model, Scoped Tenancy, Delegation ve Authorization Boundary Anayasası

Durum: Kilitlendi
Kapsam: Principal türleri, tenant/workspace/project hiyerarşisi, delegated principal modeli, device trust, principal lifecycle, cross-tenant sınırlar, impersonation, permission inheritance ve identity federation
Amaç: Runa’da “kim”, “hangi kapsam içinde”, “hangi veri ve capability sınırlarında”, “hangi cihazdan”, “hangi delegation zinciriyle” işlem yapıyor sorusunu anayasal seviyede netleştirmek; yetki, provenance, sync, support ve security katmanlarının aynı kimlik omurgası üzerinde tutarlı çalışmasını sağlamak

Bu madde, paylaşılan metindeki harness ve runtime-first yaklaşımının kimlik, kapsam ve aktör zinciri düzeyine taşınmış anayasal karşılığıdır; özellikle aynı runtime omurgasının farklı actor türleri ve execution bağlamları tarafından tüketildiği gerçeğini principal sistemiyle resmileştirir.

Resmi karar özeti

Runa’da kimlik modeli, tek bir “user id” etrafında değil; layered principal model + scoped tenancy yaklaşımıyla kurulacaktır. Human user, tenant admin, device, session/run, daemon, subagent, connector/service ve emergency/break-glass principal türleri anayasal principal sınıfları olarak tanınacaktır. Tenant, faturalama etiketi değil; policy, data isolation ve governance boundary olarak ele alınacaktır. Yetkilendirme modeli scoped RBAC + contextual policy overlay ile çalışacak; device trust ile user identity birbirinden ayrılacak; daemon, subagent ve connector’lar sınırsız user gölgesi olarak değil, delegated principals olarak işletilecektir. Hiyerarşi esnek ve collapsible olacaktır; her kurulum org → tenant → workspace → project → run/session derinliğini kullanmak zorunda değildir. Principal lifecycle, revocation, expiration, orphan cleanup, impersonation, delegation depth ve permission inheritance bu maddenin ayrılmaz parçalarıdır. Actor chain her zaman reconstructable olmalı; özellikle impersonation ve cross-tenant akışlarda gerçek aktör ile temsili aktör ayrı görünmelidir. Billing, metering, SKU ve paid reasoning gibi ticari yüzeyler bu maddenin deliberate boundary dışındadır.

Zorunlu ilkeler
Runa’da kimlik, tekil kullanıcı kimliği değil; principal sistemi olarak ele alınacaktır.
En az şu principal türleri anayasal principal sınıfları olarak tanımlanmalıdır: human user, tenant/org admin, device, session/run, daemon, subagent, connector/service ve break-glass/emergency principal.
Tenant, yalnızca müşteri etiketi değil; policy, data isolation ve governance boundary olarak ele alınacaktır.
Yetki modeli scoped RBAC + contextual policy overlay ile çalışacaktır.
User identity ile device trust aynı şey değildir; aynı kullanıcı farklı device principal’lar üzerinden farklı trust seviyelerinde temsil edilebilir.
Daemon, subagent, connector ve benzeri non-human aktörler doğrudan user principal olarak değil, delegated principal olarak çalışacaktır.
Delegation purpose-bound, scope-bound ve gerektiğinde time-bound olmak zorundadır.
Her aksiyonun actor chain’i reconstructable olmalıdır.
Actor chain’de human actor, delegated actor, device, session/run ve varsa connector/service principal ayrı ayrı görülebilmelidir.
Her principal türü tanımlı bir lifecycle’a sahip olmalıdır.
Principal lifecycle en az creation, activation, suspension, revocation, expiration ve orphan cleanup semantiklerini içermelidir.
Device principal’lar kayıp/çalınma veya trust bozulması durumunda revoke edilebilir olmalıdır.
Kullanıcı org/tenant bağlamından çıktığında veya erişimini kaybettiğinde, bağlı delegated principal’lar ve orphan state temizlenmelidir.
Parent user principal suspend/revoke olduğunda ilişkili daemon principal’ın davranışı açık policy ile tanımlanmalı; yetkisiz biçimde çalışmaya devam edemez.
Connector/service principal credential’ı expire veya revoke olduğunda ilgili principal suspended veya unusable duruma geçmelidir.
Cross-tenant data flow varsayılan olarak kapalıdır.
Cross-tenant erişim veya bilgi akışı yalnızca explicit, audited ve policy-controlled mekanizma ile açılabilir.
Bir kullanıcı birden fazla tenant’a üye olabilir; ancak bu üyelikler birbirine sessiz yetki veya veri mirası yaratamaz.
Impersonation veya “act as” semantiği desteklenecekse, audit, zaman sınırı, scope kısıtı ve uygun kullanıcı/operatör görünürlüğü zorunludur.
Impersonation durumunda actor chain’de gerçek aktör ile impersonated aktör ayrı principal’lar olarak görünmelidir.
Delegation depth sınırsız olamaz.
Delegation depth policy ile yönetilebilir, ancak “sınırsız zincir” anayasal olarak yasaktır.
Her delegation adımı görünür ve reconstructable olmalıdır.
Hiyerarşi esnek ve collapsible olacaktır.
Org → tenant → workspace → project → run/session modeli referans hiyerarşidir; fakat ürün profiline göre daha sığ veya kısmen çökmüş hiyerarşiler desteklenebilir.
Hiyerarşi collapsible olsa da semantik sınırlar kaybolamaz; hangi seviye hangi boundary’yi temsil ediyor açıkça tanımlanmalıdır.
Identity federation desteklenebilir olmalıdır.
Harici identity provider’lardan federe kimlik kabulü mimari olarak mümkün olmalı, ancak exact protokol deliberate boundary dışında kalmalıdır.
Permission inheritance modeli explicit olmalıdır.
Workspace, project veya alt scope’lara yetki yayılımı kontrolsüz ve örtük biçimde gerçekleşemez.
Yetki kalıtımı, scope sınırları ve override/restriction kuralları açık biçimde tanımlanmalıdır.
Permission inheritance ve contextual policy overlay birlikte çalışmalı; miras kalan rol, action-context kısıtlarını aşamaz.
Break-glass principal normal yönetim yolu değildir; istisnai, auditli ve daha dar scope’lu kimlik rejimi olarak ele alınmalıdır.
Identity ve tenant modeli Madde 9’daki trust model, Madde 10’daki data governance ve Madde 11’deki connector/source scope ilkeleriyle çelişemez.
Deliberate boundary gereği billing, metering, SKU, paid reasoning ve ticari entitlement ayrıntıları bu maddenin kapsamı dışındadır.
Yasak yaklaşımlar
Tüm insan ve non-human aktörleri tek bir user id etrafında çözmeye çalışmak yapılamaz.
Tenant’ı yalnızca ticari etiket veya müşteri klasörü gibi ele almak yapılamaz.
Device trust ile user identity’yi aynı kabul etmek yapılamaz.
Daemon, subagent veya connector principal’larını kullanıcının görünmez ve sınırsız uzantısı gibi işletmek yapılamaz.
Principal lifecycle ownersız bırakılarak revoke, expiration ve orphan cleanup davranışı belirsiz bırakılamaz.
Cross-tenant veri veya yetki akışını varsayılan açık hale getirmek yapılamaz.
Impersonation’ı görünmez, süresiz veya provenance zincirini bozan biçimde kullanmak yapılamaz.
Delegation zincirini sınırsız bırakmak veya zincir görünürlüğünü kaybetmek yapılamaz.
Hiyerarşiyi her kurulumda aynı derinlikte dayatmak veya tam tersi semantik sınırlar olmadan düzleştirmek yapılamaz.
Permission inheritance’ı örtük, kontrolsüz ve denetimsiz bırakmak yapılamaz.
Identity federation gereksinimini yalnızca entegrasyon detayı diye ertelemek yapılamaz.
Billing, metering veya SKU mantığını identity mimarisinin çekirdeği gibi ele almak yapılamaz.
Uygulama çerçevesi
A. Principal Model ve Lifecycle

Runa, principal-first kimlik modeli kullanacaktır. Human user, admin, device, run/session, daemon, subagent, connector/service ve emergency principal’lar ayrı actor türleri olarak ele alınır. Her principal türü creation, activation, suspension, revocation, expiration ve orphan cleanup semantiklerine sahip olacaktır. Device principal’lar device kaybı veya trust bozulması halinde iptal edilebilir; user ayrıldığında ona bağlı delegated principal’lar yetkisiz kalamaz; connector credential’ı sona erdiğinde ilgili principal çalışmaya devam edemez. Bu lifecycle modeli, hem güvenlik hem provenance hem de support operasyonları için zorunlu omurgadır.

B. Scoped Tenancy, Collapsible Hierarchy ve Cross-tenant Boundaries

Tenant, policy, data isolation ve governance boundary’dir. Referans hiyerarşi org/account → tenant → workspace → project → run/session şeklindedir; ancak bu yapı ürün profiline göre sığlaştırılabilir. Küçük takım veya bireysel kullanımda bazı katmanlar collapse olabilir; buna rağmen semantik sınırlar kaybolamaz. Cross-tenant data flow varsayılan olarak kapalıdır. Bir kullanıcının birden fazla tenant’a üye olması mümkündür, ancak bir tenant’taki yetki ve veri erişimi diğerine sessizce taşınamaz. Cross-tenant erişim ancak explicit, audited ve policy-controlled mekanizmalarla açılabilir.

C. Authorization, Delegation ve Permission Inheritance

Runa yetkilendirmesi scoped RBAC + contextual policy overlay ile çalışacaktır. Roller scope içinde geçerlidir; action-context policy bunların üstüne binen ikinci kontrol katmanıdır. Non-human aktörler delegated principal olarak çalışır; user → daemon, session → subagent, tenant/workspace → connector gibi zincirler açıkça taşınır. Delegation purpose-bound, scope-bound ve gerektiğinde time-bound olur. Delegation depth sınırlıdır ve policy ile yönetilir; sınırsız zincir yasaktır. Permission inheritance explicit olmak zorundadır: workspace’te verilen yetkinin project’e nasıl indiği, project override/restriction kuralları ve kalıtımın nereye kadar yayılacağı açıkça tanımlanmalıdır. Yetki kalıtımı, contextual policy kısıtlarını aşamaz.

D. Device Trust, Federation ve Impersonation

Device principal, human user’dan ayrı trust taşıyan bir aktördür. Aynı kullanıcı farklı cihazlarda farklı trust seviyelerine sahip olabilir; stale/orphan device’lar revoke edilebilir olmalıdır. Enterprise uyumlu kimlik yapısı için identity federation desteklenebilir olmalı; ancak SSO/protokol detayı deliberate boundary’e bırakılır. Impersonation veya “act as” semantiği gerekiyorsa bu görünmez bir admin sihri değil; zaman sınırlı, scope daraltılmış, auditli ve actor chain’de açıkça görünen bir işlem olmalıdır. Gerçek aktör ile impersonated aktör ayrı görünmeden impersonation çalışamaz. Bu, support ve break-glass yüzeylerinin güvenli kullanılabilmesi için zorunludur.

Deliberate boundary listesi

Madde 12 bilinçli olarak aşağıdaki konuları kapsam dışı bırakır; bunlar operasyonel policy veya implementation RFC alanına aittir:

Billing, metering, SKU, paid reasoning ve commercial entitlement modelleri
Exact SSO/federation protokolü, vendor seçimi ve claim mapping ayrıntıları
Role isimlerinin ürün/UI’daki exact kopyaları ve izin tablolarının tam listesi
Principal lifecycle event’lerinin exact payload şemaları
Delegation depth için sayısal limitler ve override istisna tabloları
Cross-tenant allow mekanizmalarının UI/API workflow ayrıntıları
Impersonation bildirim metinleri, süre değerleri ve runbook adımları
Device registration, pairing ve revocation UX akışlarının exact tasarımı
Permission inheritance engine’in teknik implementasyon detayları
Directory sync, SCIM benzeri provisioning veya HRIS entegrasyonlarının exact protokolleri

Bu deliberate boundary, Madde 12’nin kimlik, principal ve tenancy için mimari invariant’ları tanımladığını; ticari, sayısal, protokolsel ve ürün-UI detaylarını ise bilinçli olarak alt seviye dokümanlara bıraktığını belirtir.

Kabul kriterleri

Madde 12 aşağıdaki kriter kümeleri sağlandığında “implement edildi” sayılır:

1. Principal Model & Lifecycle
Anayasal principal türleri tanımlanmışsa
Her principal türü için lifecycle semantiği mevcutsa
Revocation, expiration ve orphan cleanup fiilen uygulanabiliyorsa
2. Tenancy & Boundary Semantics
Tenant policy/data/governance boundary olarak modellenmişse
Hiyerarşi collapsible ama semantik olarak korunuyorsa
Cross-tenant akış varsayılan kapalıysa ve explicit audited policy gerektiriyorsa
3. Authorization, Delegation & Inheritance
Scoped RBAC + contextual policy overlay uygulanıyorsa
Daemon, subagent ve connector delegated principal olarak çalışıyorsa
Delegation depth sınırlı ve görünür ise
Permission inheritance explicit, kontrol edilebilir ve policy ile uyumluysa
4. Device Trust, Federation & Impersonation
Device principal modeli user identity’den ayrılmışsa
Federation mimari olarak desteklenebilir haldeyse
Impersonation varsa auditli, süreli, scope-limited ve actor chain’de görünür biçimde çalışıyorsa
5. Provenance & Boundary Discipline
Actor chain reconstructability korunuyorsa
Madde 9, 10 ve 11 ile kimlik/sınır semantiği uygulamada çelişmiyorsa
Deliberate boundary korunuyor ve billing/protocol/runbook ayrıntıları anayasa içine sızmıyorsa
Resmi karar cümlesi

Runa’nın kimlik ve tenancy mimarisi, layered principal model ve scoped tenancy ilkeleri üzerine kurulacak; tenant policy ve veri sınırı olarak ele alınacak, non-human aktörler delegated principal olarak çalışacak, principal lifecycle ile revoke/orphan cleanup anayasal zorunluluk olacak, cross-tenant akış varsayılan kapalı kalacak, device trust user identity’den ayrılacak ve tüm actor zinciri reconstructable biçimde korunacaktır.








Runa Architectural Constitution — Madde 13
Developer Platform, Extension Standards, Registry Governance ve Runtime Extension Safety Anayasası

Durum: Kilitlendi
Kapsam: Platform genişletme yüzeyleri, extension türleri, registry-controlled registration, trust tier, compatibility, testing contract, extension composition ve runtime yükleme güvenliği
Amaç: Runa’nın yalnızca kapalı bir ürün değil, sözleşmeli ve güvenli biçimde genişleyebilen bir platform olmasını sağlamak; bunu yaparken extension kaosu, güvenlik aşınması ve compatibility bozulmasını önlemek

Bu madde, paylaşılan metindeki merkezi Tool Registry, plugin mimarisi, build-time capability packaging ve aynı event stream üzerinden birden fazla surface’in çalışması fikrinin platformlaşma düzeyine taşınmış anayasal karşılığıdır. Özellikle plugin tool registry ve capability packaging kombinasyonunun fark yarattığı vurgusu, bu maddenin temel dayanağıdır.

Resmi karar özeti

Runa’nın geliştirici platformu, contract-first platform extensibility yaklaşımıyla kurulacaktır. Tool/capability, connector, knowledge source adapter, renderer/presentation extension, policy/eval hook ve model/provider adapter gibi extension surface’ler açıkça tanımlanacak; bunların her biri registry-controlled registration, validation, compatibility, observability ve trust tier kurallarına tabi olacaktır. Extension kavramı tek tip değildir: internal, third-party ve user-created extension’lar farklı güven, review ve izolasyon rejimleriyle ele alınacaktır. Her extension yalnızca manifest’inde beyan ettiği veri çevresine erişebilecek, declare edilmemiş veri erişimi engellenecektir. Core değişiklikleri sessiz bozulmaya yol açmayacak; uyumsuz extension’lar graceful disabled veya degraded duruma geçirilecektir. Her extension testability contract taşımak zorundadır; platform doğrulama ve regresyon testleri tarafından denetlenebilir olmalıdır. Extension’lar arası bağımlılık desteklenirse bu bağımlılık explicit, versioned ve graph’ta görünür olacak; circular dependency yasaktır. Runtime hot-loading ve güncelleme yalnızca ilgili trust tier için uygun validation ve izolasyon zinciri tamamlandıktan sonra mümkün olacaktır.

Zorunlu ilkeler
Runa geliştirici platformu, contract-first platform extensibility ilkesiyle çalışacaktır.
Core platform, doğrudan fork veya rastgele kod ekleme ile değil; tanımlı extension surface’leri üzerinden genişletilecektir.
En az şu extension surface aileleri anayasal olarak tanımlanmalıdır: tool/capability extension, connector extension, knowledge source adapter, renderer/presentation extension, policy/eval hook ve model/provider adapter.
Her extension surface türü kendi ayrı contract’ına sahip olmalıdır; tek tip extension modeli yeterli değildir.
Extension registration ve activation, registry-controlled registration + validation rejimine tabi olacaktır.
Registry dışı, ownersız veya validation’sız extension yükleme anayasal olarak yasaktır.
Her extension version, compatibility, scope, trust tier, observability ve lifecycle metadata’sı taşımak zorundadır.
Compatibility, deprecation ve versioning anayasal zorunluluktur.
Core ile uyumsuz hale gelen extension’lar sessizce bozuk çalışamaz; graceful disabled veya degraded duruma alınmalıdır.
Sessiz corruption yasaktır.
Extension’lar tek güven modeline tabi olmayacaktır; en az internal, third-party ve user-created kategorileri tanımlanmalıdır.
Internal extension’lar native/core’ya en yakın trust rejiminde çalışabilir; ancak yine de registry ve compatibility kurallarına tabidir.
Third-party extension’lar signing, provenance, review ve daha sıkı sandbox/trust tier rejimine tabi olmalıdır.
User-created extension’lar en düşük varsayılan güven modeliyle ve maksimum izolasyonla çalışmalıdır.
Her extension yalnızca manifest’inde açıkça beyan ettiği veri çevresine erişebilir.
Declare edilmemiş veri erişimi engellenmelidir.
Extension’ların kullanıcı verisini tutma, dışarı gönderme veya cache’leme yetkisi açık ve sınırlı veri perimeter kurallarıyla tanımlanmalıdır.
Extension veri perimeter’i, Madde 10’daki data-class governance ile uyumlu olmak zorundadır.
Her extension testability contract taşımak zorundadır.
Platform, bir extension’ın çalışmasını doğrulayabilmeli ve onu regression test kapsamına alabilmelidir.
“Works on my machine” tipi doğrulanamaz extension’lar production-grade extension kabul edilemez.
Extension failure core sistemi sessizce bozamaz.
Extension failure, trust tier ve impact seviyesine göre localized, degraded, disabled veya isolated failure rejimiyle ele alınmalıdır.
Extension’lar arası bağımlılık desteklenecekse explicit, versioned ve graph’ta görünür olmalıdır.
Circular dependency yasaktır.
Dependency graph’i gizli veya dolaylı bağlarla oluşamaz; composition yapısı denetlenebilir olmalıdır.
Runtime extension hot-loading veya güncelleme, trust tier’a uygun validation ve izolasyon tamamlanmadan yapılamaz.
Untrusted code’un runtime’a kontrolsüz biçimde girmesi anayasal olarak yasaktır.
Hot-load/güncelleme sırasında compatibility check, trust check ve gerekiyorsa sandbox/approval zinciri tamamlanmadan activation olamaz.
Extension observability ve provenance zorunludur; her extension’ın kimliği, sürümü, trust tier’ı ve çağrı izi reconstructable olmalıdır.
Extension’ların runtime ve security davranışı Madde 4, 9, 10 ve 11 ile çelişemez.
Deliberate boundary gereği internal RFC/ADR süreçleri, local dev akışları ve staging operasyonları bu maddenin kapsamı dışındadır.
Yasak yaklaşımlar
Extension’ı tek tip ve tek güven modeliyle ele almak yapılamaz.
Registry dışı, validation’sız veya ownersız extension yüklemek yapılamaz.
Compatibility/deprecation kuralları olmadan core değiştirip extension’ların sessizce kırılmasına izin verilemez.
Kırılan extension’ı sessiz bozuk çalışma modunda bırakmak yapılamaz.
Internal, third-party ve user-created extension’ları aynı review ve trust rejimine tabi tutmak yapılamaz.
Extension’a manifest’inde beyan etmediği veri sınıflarına erişim vermek yapılamaz.
Extension’ın eriştiği veriyi sessizce dışarı göndermesine veya tutmasına izin verilemez.
Testability contract taşımayan extension’ı production-grade kabul etmek yapılamaz.
Dependency graph’i görünmez bırakmak veya circular dependency’ye izin vermek yapılamaz.
Hot-loading bahanesiyle untrusted code’u runtime’a doğrudan sokmak yapılamaz.
Extension failure’ın core sistemde sessiz corruption yaratmasına izin verilemez.
Team process, RFC/ADR ve local workflow detaylarını anayasa içine gömerek deliberate boundary ihlal edilemez.
Uygulama çerçevesi
A. Extension Surface ve Registry Governance

Runa, açıkça tanımlanmış extension surface’ler üzerinden genişleyecektir. Tool/capability, connector, knowledge source adapter, renderer, policy/eval hook ve model/provider adapter aileleri başlangıç surface’leridir. Her surface kendi contract’ını taşır ve merkezi registry tarafından yönetilir. Registry, yalnızca bir liste değil; compatibility, trust tier, observability, lifecycle ve activation otoritesidir. Core platformun yeni capability’leri de mümkün olduğunca bu surface’ler üzerinden tanımlanarak platform disiplini korunur.

B. Trust Tiers ve Extension Origin Modeli

Extension origin sınıfları üçlü modelle ele alınacaktır: internal, third-party ve user-created. Internal extension’lar native platforma daha yakın güven rejiminde olabilir; third-party extension’lar signing, provenance, review ve daha güçlü isolation ile; user-created extension’lar ise minimum governance varsayımı ve maksimum runtime izolasyonu ile çalışır. Böylece extension’ın kim tarafından üretildiği, nasıl doğrulandığı ve ne kadar güvenildiği platformun birinci sınıf kararı haline gelir.

C. Data Perimeter, Testing ve Compatibility

Her extension manifest’inde veri perimeter’ini açıkça declare etmek zorundadır: hangi data class’lara erişebilir, hangi veriyi tutabilir, hangi veriyi dışarı gönderebilir. Platform, declare edilmemiş veri erişimini engeller. Her extension ayrıca testability contract sunar; platform bunu smoke, compatibility ve regression testleriyle doğrulayabilir. Core platform değiştiğinde extension kırılırsa sessiz bozuk çalışma yerine graceful disabled veya degraded davranışı devreye girer. Compatibility, deprecation ve versioning bu yüzden yalnızca paket yönetimi değil, güvenlik ve güvenilirlik konusudur.

D. Composition ve Runtime Loading Safety

Extension’lar arası bağımlılık destekleniyorsa bu bağımlılık explicit ve versioned dependency graph ile tanımlanır. Circular dependency yasaktır. Runtime hot-loading, upgrade veya activation yalnızca ilgili trust tier’ın gerektirdiği validation, compatibility ve izolasyon zinciri tamamlandıktan sonra yapılır. Untrusted veya düşük güvenli extension’ın runtime’a kontrolsüz girişi engellenir. Böylece platform hem genişler hem de çalışan çekirdeğin bütünlüğünü korur.

Deliberate boundary listesi

Madde 13 bilinçli olarak aşağıdaki konuları kapsam dışı bırakır; bunlar operasyonel policy veya implementation RFC alanına aittir:

Internal RFC/ADR süreçleri ve review organizasyonu
Local development workflow, sandbox kurulum akışları ve staging runbook’ları
Exact manifest schema alan adları ve serialization formatları
Signing algoritmaları, key management ayrıntıları ve vendor/tool seçimleri
Marketplace UI/UX, listing kuralı ve ticari distribution mekanizmaları
Hot-reload protokolünün exact runtime implementasyonu
Test harness araçları, CI job yapısı ve execution environment detayları
Dependency graph storage modeli ve çözümleme algoritması
Compatibility semver kurallarının exact numeric tablosu
Extension package formatı, bundle tekniği ve dağıtım altyapısı

Bu deliberate boundary, Madde 13’ün platform genişletme için mimari invariant’ları tanımladığını; süreç, araç, şema ve pipeline ayrıntılarını ise bilinçli olarak alt seviye dokümanlara bıraktığını belirtir.

Kabul kriterleri

Madde 13 aşağıdaki kriter kümeleri sağlandığında “implement edildi” sayılır:

1. Extension Model & Registry
Anayasal extension surface aileleri tanımlanmışsa
Registry-controlled registration ve validation uygulanıyorsa
Extension metadata’sı compatibility, trust tier, scope ve observability içeriyorsa
2. Trust & Isolation
Internal, third-party ve user-created extension origin ayrımı uygulanıyorsa
Her origin için farklı trust/review/izolasyon rejimi mevcutsa
Untrusted code kontrolsüz hot-load edilemiyorsa
3. Data Perimeter & Testing
Extension veri erişimi manifest ile sınırlandırılmışsa
Declare edilmemiş veri erişimi engelleniyorsa
Testability contract ve regression doğrulaması fiilen uygulanıyorsa
4. Compatibility, Failure & Composition
Breaking change durumunda extension graceful disabled/degraded davranabiliyorsa
Extension failure core sistemde sessiz corruption yaratmıyorsa
Dependency graph explicit, versioned ve circular dependency’siz yönetiliyorsa
5. Boundary Discipline
Madde 4, 9, 10 ve 11 ile sınırlar korunuyorsa
RFC/ADR, local dev ve staging gibi takım süreçleri deliberate boundary dışında tutuluyorsa
Resmi karar cümlesi

Runa’nın geliştirici platformu, contract-first extensibility ilkesiyle kurulacak; extension surface’leri registry-controlled sözleşmeler altında yönetilecek, internal/third-party/user-created origin’ler farklı trust rejimlerine tabi olacak, her extension yalnızca declare ettiği veri perimeter’ine erişecek, testability ve compatibility zorunlu olacak, uyumsuz veya güvensiz extension’lar graceful disabled/degraded davranacak ve untrusted code runtime’a kontrolsüz biçimde giremeyecektir.









Runa Architectural Constitution — Madde 14
Human Operations, Support Surfaces, Operational Visibility ve Intervention Plane Anayasası

Durum: Kilitlendi
Kapsam: Operatör, support, tenant admin ve security/gov ekiplerinin kullandığı ürünleşmiş operasyonel yüzeyler; görünürlük modeli; müdahale primitive’leri; rol bazlı escalation yolları; self-service sınırları ve insan müdahalelerinin auditlenmesi
Amaç: Runa’daki approval, escalation, break-glass, incident ve replay gibi mekanizmaların kendisini yeniden tanımlamadan; bu mekanizmaların insanlara hangi güvenli, ürünleşmiş ve rol-sınırlı yüzeyler üzerinden sunulacağını anayasal hale getirmek

Bu madde, paylaşılan metindeki harness ve runtime-first yaklaşımının insan operatör, support ve tenant admin kullanım yüzeylerine taşınmış anayasal karşılığıdır. Mekanizmaların motorları diğer maddelerde tanımlanır; bu madde onların insanlara sunulan control plane yüzlerini tanımlar.

Resmi karar özeti

Runa’da insan operasyonu, arka kapı veya acil durum hack’i olarak değil; productized human operations plane olarak tasarlanacaktır. Approval, escalation, break-glass, incident, replay, revoke ve compensation gibi mekanizmaların kuralları diğer maddelerde tanımlanır; Madde 14 ise bu mekanizmaların support, tenant admin, platform ops ve security/gov aktörlerine hangi rol-sınırlı operational surface’ler üzerinden sunulacağını belirler. Görünürlük modeli summary-first, drill-down available ve role-scoped olacaktır. İnsan müdahaleleri serbest sistem erişimi değil; constrained operational primitives olarak sunulacaktır. Her operasyonel rol için kapsamını aşan durumlar adına açık bir escalation path bulunacaktır. Rutin kontrol ve görünürlük mümkün olduğunca self-service yüzeylerle çözülmeli; operatör müdahalesi istisnai durumlara ayrılmalıdır. İnsan aksiyonları auditli, nedenli, scope’lu ve reconstructable kalacaktır. Cross-tenant operasyonel görünürlük ve müdahale yalnızca uygun yetki ve audit ile mümkün olacak; tenant isolation, ops yüzeylerinde de korunacaktır. Kronik manuel müdahale kalıpları tespit edilip otomasyon adayı olarak ele alınacaktır.

Zorunlu ilkeler
Runa’da insan operasyonu, productized human operations plane olarak ele alınacaktır.
Bu madde mekanizmaların kendisini değil, onların insan operatörlere sunulan yüzeylerini tanımlar.
Approval, escalation, break-glass, incident, replay ve benzeri mekanizmaların motorları ilgili diğer maddelerde tanımlanır; Madde 14 bunların operational surface karşılığını tanımlar.
En az şu operational surface aileleri ürünleşmiş biçimde desteklenmelidir: run inspection surface, intervention surface, tenant admin surface, support/incident surface ve security/governance surface.
Görünürlük modeli summary-first, drill-down available ve role-scoped olacaktır.
Operatörler ham log yığını değil, karar almaya hazır operational context görmelidir.
İnsan müdahalesi serbest shell/DB erişimi değil, constrained operational primitives olarak sunulmalıdır.
En az pause, resume, cancel, quarantine, safe retry, request review, request re-auth ve scoped disable gibi müdahale primitive’leri desteklenebilir olmalıdır.
Human action auditability anayasal zorunluluktur.
Her insan müdahalesi actor, role, scope, reason, timestamp ve outcome ile reconstructable olmalıdır.
Support, tenant admin, platform ops ve security/governance rolleri aynı operational surface’i aynı kapsamla kullanamaz.
Her rol yalnızca kendi görev alanına uygun görünürlük ve müdahale primitive’lerine sahip olmalıdır.
Her operasyonel rol için, kendi kapsamını aşan durumlar adına tanımlı bir üst seviye escalation yolu bulunmalıdır.
Support yüzeyi gerektiğinde platform ops’a, platform ops gerektiğinde security/governance akışına kontrollü escalation yapabilmelidir.
Rol escalation zinciri auditli, gerekçeli ve görünür olmalıdır.
Rutin kontrol, health görünürlüğü ve düşük riskli yönetim işlemleri mümkün olduğunca self-service yüzeylerle çözülmelidir.
Operatör müdahalesi, self-service ile güvenli biçimde çözülemeyen istisnai durumlara ayrılmalıdır.
Tenant admin yüzeyleri tenant-scoped görünürlük ve tenant-scoped güvenli müdahale sağlayabilmelidir.
Platform operatör yüzeyleri tenant isolation sınırlarını varsayılan olarak ihlal etmez.
Cross-tenant görünürlük veya müdahale yalnızca uygun yetki, açık scope ve audit ile mümkün olabilir.
Operasyonel yüzeylerde yanlış tenant’a görünürlük veya etki yaratabilecek belirsiz bağlamlara izin verilemez.
Her intervention primitive’in güvenli başarısızlık davranışı ve geri dönüş etkisi açıkça tanımlanmalıdır.
İnsan operasyon yüzeyleri, Madde 7 provenance, Madde 8 replay/incident, Madde 12 principal modeli ve Madde 6 intervention mekanizmalarıyla tutarlı çalışmalıdır.
Kronik manuel müdahale kalıpları tespit edilebilir olmalıdır.
Sık tekrar eden manuel operasyonlar otomasyon veya ürün iyileştirme adayı olarak değerlendirilmelidir.
Human operations plane kalıcı insan emeği bağımlılığı üretmemeli; sistematik sorunları görünür kılıp otomasyona geri beslemelidir.
Güvenlik ve governance ile ilgili kritik durumlar, uygun rol yüzeylerinde görünür olmalıdır.
Deliberate boundary gereği, incident süreci, break-glass semantiği, escalation motoru ve impersonation kuralları bu maddede yeniden tanımlanmayacaktır.
Yasak yaklaşımlar
Operasyonel müdahaleyi arka kapı, ad hoc script veya DB düzeltmesi olarak yürütmek yapılamaz.
Mekanizmaların motorlarını bu maddede tekrar tanımlayarak diğer maddelerle çakışmak yapılamaz.
Tüm roller için aynı görünürlük ve aynı müdahale gücünü sunmak yapılamaz.
Operatör yüzeylerini ham log-first tasarlayıp insanlardan her şeyi trace’ten anlamasını beklemek yapılamaz.
Serbest shell, serbest veri tabanı düzenleme veya sınırsız policy bypass’ı “operasyon” diye sunmak yapılamaz.
Support rolünü tanımsız escalation’sız bırakmak yapılamaz.
Self-service ile çözülebilecek rutin işlemleri sürekli insan operatör kuyruğuna itmek yapılamaz.
Kronik manuel müdahaleleri görünmez bırakmak ve otomasyon adayı olarak değerlendirmemek yapılamaz.
Tenant isolation’ı ops yüzeylerinde gevşetmek veya yanlış tenant’a görünürlük üretmek yapılamaz.
İnsan müdahalelerini audit dışı, neden kaydı olmadan veya actor chain’den kopuk bırakmak yapılamaz.
Madde 6, 7, 8 ve 12’de tanımlanmış mekanizmaları burada yeniden icat etmek yapılamaz.
Uygulama çerçevesi
A. Operational Surfaces

Runa en az beş ürünleşmiş operasyonel yüzey sağlayacaktır: run inspection surface, intervention surface, tenant admin surface, support/incident surface ve security/governance surface. Run inspection, bir run’ın yaşam döngüsü, actor chain, approval/escalation geçmişi, source provenance özeti, unresolved effect’ler ve policy/security flag’lerini karar-verilebilir biçimde göstermelidir. Intervention surface, güvenli primitive’ler üzerinden kontrollü müdahale sağlar. Tenant admin yüzeyi kendi tenant sınırında health, connector durumu, daemon görünürlüğü ve tenant-scoped müdahale sunar. Support/incident yüzeyi replay, etki alanı, müşteri görünürlüğü ve escalation hazırlığına odaklanır. Security/governance yüzeyi ise policy denials, revoke durumları, break-glass görünürlüğü ve evidence trail’i operatöre sunar.

B. Visibility, Role Scoping ve Escalation Paths

Operasyonel görünürlük summary-first, drill-down available ve role-scoped olacaktır. Support agent ile security responder aynı veriyi aynı ayrıntıda görmez; tenant admin de platform ops ile aynı global görünüme sahip olmaz. Her rol için kendi kapsamını aşan durumlarda kullanılacak bir üst seviye escalation yolu bulunur. Bu escalation yalnızca iletişimsel değil; ürünleşmiş yüzeyde tanımlı bir handoff primitive’i olarak var olmalıdır. Böylece support bir güvenlik olayında doğrudan security/gov akışına kontrollü escalation yapabilir, tenant admin ise global platform yetkilerine erişmeden scoped yardım talebi başlatabilir.

C. Constrained Intervention ve Self-service Sınırı

İnsan müdahalesi, sınırsız erişim değil; constrained operational actions olarak tanımlanacaktır. Pause, resume, cancel, quarantine, safe retry, request review, scoped disable, request re-auth ve benzeri primitive’ler bu yüzeylerde kontrollü biçimde sunulabilir. Rutin görünürlük, kontrol ve düşük riskli ayarlar mümkün olduğunca self-service olarak kullanıcıya veya tenant admin’e verilecektir. Operatör müdahalesi yalnızca self-service sınırını aşan, güvenlik, policy, incident veya sistemik hata içeren durumlara ayrılmalıdır. Bu yaklaşım, human operations’ı kalıcı çözüm değil, ürünleşmiş geçici köprü ve öğrenme kanalı yapar.

D. Auditability, Tenant Isolation ve Operational Learning

İnsan aksiyonları da governed action’dır. Her operatör müdahalesi reason, actor, role, scope, tenant, time ve outcome ile auditlenir. Ops yüzeyleri tenant isolation’ı varsayılan olarak korur; cross-tenant görünürlük yalnızca yetki, açık bağlam ve audit ile sağlanabilir. Ayrıca sistem, tekrar eden manuel müdahale örüntülerini tespit edebilmeli; bu örüntüler otomasyon, ürün iyileştirmesi veya policy düzeltmesi için geri besleme olarak kullanılmalıdır. Bu yönüyle Madde 14, Madde 8’deki quality/learning loop’un insan operasyon ayağını ürün yüzeyine bağlar.

Deliberate boundary listesi

Madde 14 bilinçli olarak aşağıdaki konuları kapsam dışı bırakır; bunlar ilgili maddelerde veya operasyonel policy/runbook katmanında tanımlanır:

Approval motorunun kuralları ve approval timeout semantiği
Escalation engine’in karar kuralları ve de-escalation mantığı
Break-glass activation kuralları ve güvenlik semantiği
Incident taxonomy, postmortem workflow ve replay altyapısının kendisi
Impersonation’ın güvenlik kuralları ve principal semantiği
Exact UI component yapıları, ekran akışları ve metin kopyaları
Ops ekip organizasyonu, vardiya/on-call tasarımı ve support SLA’ları
Manual intervention primitive’lerinin exact teknik implementasyon detayları
Handoff, escalation veya support workflow’larının araç/protokol ayrıntıları

Bu deliberate boundary, Madde 14’ün insanlara sunulan operasyonel yüzeylerin mimari ilkelerini tanımladığını; mekanizma motorlarını, güvenlik kurallarını ve süreç runbook’larını ise tekrar etmeyip ilgili maddelere bıraktığını belirtir.

Kabul kriterleri

Madde 14 aşağıdaki kriter kümeleri sağlandığında “implement edildi” sayılır:

1. Surface Coverage & Visibility
En az anayasal operational surface aileleri mevcutsa
Görünürlük modeli summary-first, drill-down available ve role-scoped çalışıyorsa
Run, policy, provenance, incident ve unresolved effect bağlamı decision-ready şekilde görülebiliyorsa
2. Intervention & Escalation
İnsan müdahalesi constrained operational primitives ile sunuluyorsa
Her operasyonel rol için tanımlı üst seviye escalation yolu varsa
Support, tenant admin, platform ops ve security/gov yüzeyleri birbirinden ayrışmışsa
3. Self-service & Tenant Isolation
Rutin görünürlük ve düşük riskli işlemler uygun düzeyde self-service sunuluyorsa
Operatör müdahalesi istisnai durumlara ayrılmışsa
Tenant isolation ops yüzeylerinde korunuyor ve cross-tenant erişim yalnızca yetki + audit ile mümkün oluyorsa
4. Auditability & Learning
Tüm insan aksiyonları actor, reason, scope ve outcome ile auditleniyorsa
Tekrarlayan manuel müdahale kalıpları tespit edilebiliyor ve iyileştirme/otomasyon adayına dönüşebiliyorsa
Madde 6, 7, 8 ve 12 ile sınırlar pratikte korunuyorsa
Resmi karar cümlesi

Runa’nın insan operasyon mimarisi, productized human operations plane ilkesiyle kurulacak; müdahale mekanizmaları diğer maddelerde tanımlı kalırken bunların insan yüzeyleri rol-sınırlı, karar-verilebilir, constrained ve auditli biçimde sunulacak, her rol için açık escalation yolu bulunacak, rutin işlemler mümkün olduğunca self-service’e taşınacak, tenant isolation ops yüzeylerinde korunacak ve kronik manuel müdahaleler otomasyon için geri besleme haline getirilecektir.



