import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
	buildProviderAuthoritySummary,
	loadEnvAuthorityFiles,
	resolveEnvAuthority,
} from './env-authority.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..', '..');
const distRoot = path.resolve(serverRoot, 'dist');

const DEEPSEEK_API_KEY_ENV = 'DEEPSEEK_API_KEY';
const DEEPSEEK_FAST_MODEL_ENV = 'DEEPSEEK_FAST_MODEL';
const DEEPSEEK_REASONING_MODEL_ENV = 'DEEPSEEK_REASONING_MODEL';
const DEFAULT_FAST_MODEL = 'deepseek-v4-flash';
const DEFAULT_REASONING_MODEL = 'deepseek-v4-pro';
const CHAT_DEFAULT_MAX_OUTPUT_TOKENS = 2048;

const scenarios = [
	{
		id: 'student_exam_plan',
		intent: 'cheap',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 180,
		persona: 'student',
		title: 'University student builds an exam plan',
		user_prompt:
			'Ben ikinci sınıf bilgisayar mühendisliği öğrencisiyim. Veri yapıları finaline 6 gün kaldı, yığın/kuyruk/ağaç konularım zayıf. Bana günlük, gerçekçi ve kısa bir çalışma planı çıkar.',
	},
	{
		id: 'student_concept_summary',
		intent: 'balanced',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 180,
		persona: 'student',
		title: 'Student asks for a concept explanation',
		user_prompt:
			'Big-O notasyonunu ezber gibi değil, sınavda kullanabileceğim şekilde örneklerle anlat. Özellikle O(n log n) ile O(n^2) farkını netleştir.',
	},
	{
		id: 'student_feedback_request',
		intent: 'balanced',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 180,
		persona: 'student',
		title: 'Student gets feedback on a draft',
		user_prompt:
			'Staj başvurum için şu cümleyi daha profesyonel yap: "Kod yazmayı seviyorum ve ekipte öğrenmek istiyorum." Bana 3 alternatif ver ve hangisini seçmem gerektiğini söyle.',
	},
	{
		id: 'developer_bug_triage',
		intent: 'deep_reasoning',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 220,
		persona: 'developer',
		title: 'Developer triages a production bug',
		user_prompt:
			'Bir React uygulamasında bazı kullanıcılarda "Maximum update depth exceeded" hatası çıkıyor. useEffect içinde auth state ve localStorage birlikte kullanılıyor. Kök sebebi nasıl izole ederim, hangi sırayla kontrol ederim?',
	},
	{
		id: 'developer_code_review',
		intent: 'deep_reasoning',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 220,
		persona: 'developer',
		title: 'Developer asks for code review guidance',
		user_prompt:
			'Node.js WebSocket servisinde kullanıcıdan gelen approval.resolve mesajını işliyorum. Race condition ve yetki sınırı açısından profesyonel code review checklist çıkar.',
	},
	{
		id: 'developer_implementation_plan',
		intent: 'balanced',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 200,
		persona: 'developer',
		title: 'Developer asks for a safe implementation plan',
		user_prompt:
			'Mevcut API contractını bozmadan bir provider adapter eklemem gerekiyor. Dosya sınırlarını, testleri ve riskleri içeren kısa ama uygulanabilir plan yaz.',
	},
	{
		id: 'researcher_question_map',
		intent: 'deep_reasoning',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 220,
		persona: 'researcher',
		title: 'Researcher frames a study question',
		user_prompt:
			'Akademik bir araştırma için yapay zekanın yazılım ekiplerinde verimlilik ve kaliteye etkisini inceleyeceğim. Araştırma sorularını, değişkenleri ve metodoloji risklerini karşılaştırmalı çıkar.',
	},
	{
		id: 'researcher_source_strategy',
		intent: 'balanced',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 200,
		persona: 'researcher',
		title: 'Researcher plans source validation',
		user_prompt:
			'Bir literatür taramasında blog yazıları, akademik makaleler ve şirket raporlarını karıştırmak zorundayım. Güvenilirlik puanlamasını pratik şekilde nasıl yaparım?',
	},
	{
		id: 'researcher_synthesis',
		intent: 'deep_reasoning',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 220,
		persona: 'researcher',
		title: 'Researcher asks for synthesis structure',
		user_prompt:
			'Üç farklı çalışmanın bulguları çelişiyor: biri AI ile hız artıyor diyor, biri kalite düşüyor diyor, biri etki yok diyor. Bunu tarafsız sentezlemek için bölüm yapısı öner.',
	},
	{
		id: 'small_business_customer_reply',
		intent: 'cheap',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 160,
		persona: 'small_business_owner',
		title: 'Small business owner replies to a customer',
		user_prompt:
			'Küçük bir kahve dükkanım var. Müşteri siparişinin geç geldiğini ve soğuk olduğunu yazmış. Savunmacı olmayan, çözüm odaklı kısa bir yanıt hazırla.',
	},
	{
		id: 'small_business_weekly_ops',
		intent: 'balanced',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 180,
		persona: 'small_business_owner',
		title: 'Small business owner plans operations',
		user_prompt:
			'Haftalık stok, personel vardiyası ve kampanya işlerini tek sayfalık bir kontrol listesine çevirmek istiyorum. Sade ve uygulanabilir bir düzen öner.',
	},
	{
		id: 'small_business_pricing',
		intent: 'deep_reasoning',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 220,
		persona: 'small_business_owner',
		title: 'Small business owner compares pricing options',
		user_prompt:
			'Yeni paket servis menüsünde kâr marjını korumak ama müşteri kaybetmemek istiyorum. Sabit indirim, ücretsiz teslimat ve paket ürün stratejilerini karşılaştır.',
	},
	{
		id: 'product_manager_prioritization',
		intent: 'deep_reasoning',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 220,
		persona: 'product_manager',
		title: 'Product manager prioritizes features',
		user_prompt:
			'Kapalı beta öncesi bir AI çalışma arkadaşı ürününde chat UX, provider güvenilirliği, desktop companion ve research mode arasında öncelik vermem gerekiyor. Sebep-sonuç ilişkisiyle sırala.',
	},
	{
		id: 'product_manager_metrics',
		intent: 'balanced',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 200,
		persona: 'product_manager',
		title: 'Product manager defines launch metrics',
		user_prompt:
			'İlk 20 test kullanıcısı için ürünün gerçekten değer verdiğini anlamak istiyorum. Nitel ve nicel metrikleri, haftalık takip düzeniyle birlikte öner.',
	},
	{
		id: 'product_manager_risk_comms',
		intent: 'balanced',
		max_output_tokens: CHAT_DEFAULT_MAX_OUTPUT_TOKENS,
		min_content_chars: 200,
		persona: 'product_manager',
		title: 'Product manager writes risk communication',
		user_prompt:
			'Beta kullanıcısına "ürün bazı dosya işlemlerinde onay isteyebilir ve canlı provider hataları görülebilir" mesajını güven veren ama dürüst bir dille yaz.',
	},
];

function resolveApiKeySource(files) {
	const authority = resolveEnvAuthority({
		env: process.env,
		files,
		name: DEEPSEEK_API_KEY_ENV,
		required: true,
	});

	return {
		apiKey: authority.value,
		authority,
		envName: DEEPSEEK_API_KEY_ENV,
	};
}

function resolveModelSources(files) {
	const fast = resolveEnvAuthority({
		defaultValue: DEFAULT_FAST_MODEL,
		env: process.env,
		files,
		name: DEEPSEEK_FAST_MODEL_ENV,
	});
	const reasoning = resolveEnvAuthority({
		defaultValue: DEFAULT_REASONING_MODEL,
		env: process.env,
		files,
		name: DEEPSEEK_REASONING_MODEL_ENV,
	});

	return {
		fast: {
			authority: fast,
			model: fast.value ?? DEFAULT_FAST_MODEL,
		},
		reasoning: {
			authority: reasoning,
			model: reasoning.value ?? DEFAULT_REASONING_MODEL,
		},
	};
}

function buildAuthoritySummary(apiKeySource, modelSources) {
	return buildProviderAuthoritySummary({
		apiKeyAuthority: apiKeySource.authority,
		authoritativeEnv: DEEPSEEK_API_KEY_ENV,
		modelAuthorities: {
			fast: {
				authoritative_env: DEEPSEEK_FAST_MODEL_ENV,
				default_model: DEFAULT_FAST_MODEL,
				resolved_from: modelSources.fast.authority.report.resolved_from,
				source: modelSources.fast.authority.report.source,
			},
			reasoning: {
				authoritative_env: DEEPSEEK_REASONING_MODEL_ENV,
				default_model: DEFAULT_REASONING_MODEL,
				resolved_from: modelSources.reasoning.authority.report.resolved_from,
				source: modelSources.reasoning.authority.report.source,
			},
		},
	});
}

async function loadRuntimeModules() {
	const factoryUrl = pathToFileURL(path.resolve(distRoot, 'gateway/factory.js')).href;
	const factoryModule = await import(factoryUrl);

	return {
		createModelGateway: factoryModule.createModelGateway,
	};
}

function createGateway(modules, apiKey, fastModel) {
	return modules.createModelGateway({
		config: {
			apiKey,
			defaultMaxOutputTokens: 768,
			defaultModel: fastModel,
		},
		provider: 'deepseek',
	});
}

function buildRequest(scenario) {
	const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

	return {
		max_output_tokens: scenario.max_output_tokens,
		messages: [
			{
				content:
					'You are Runa, a practical AI work partner. Reply in Turkish. Produce only user-facing assistant content; never expose hidden reasoning. Keep the answer concise, practical, and complete in 4-7 bullets or short paragraphs.',
				role: 'system',
			},
			{
				content: scenario.user_prompt,
				role: 'user',
			},
		],
		metadata: {
			model_router: {
				allow_provider_fallback: false,
				intent: scenario.intent,
			},
		},
		run_id: `deepseek_user_journey_${scenario.id}_${stamp}`,
		trace_id: `trace_deepseek_user_journey_${scenario.id}_${stamp}`,
	};
}

function expectedModelForScenario(scenario, modelSources) {
	return scenario.intent === 'deep_reasoning' || scenario.intent === 'tool_heavy'
		? modelSources.reasoning.model
		: modelSources.fast.model;
}

function validateScenarioResponse({ response, scenario, modelSources }) {
	const errors = [];
	const content = response.message.content.trim();
	const expectedModel = expectedModelForScenario(scenario, modelSources);

	if (response.provider !== 'deepseek') {
		errors.push(`unexpected_provider:${response.provider}`);
	}

	if (response.model !== expectedModel) {
		errors.push(`unexpected_model:${response.model}:expected:${expectedModel}`);
	}

	if (response.finish_reason !== 'stop') {
		errors.push(`finish_reason:${response.finish_reason}`);
	}

	if (content.length < scenario.min_content_chars) {
		errors.push(`content_too_short:${content.length}:min:${scenario.min_content_chars}`);
	}

	if (response.tool_call_candidate !== undefined) {
		errors.push('unexpected_tool_call_candidate');
	}

	if (/reasoning_content|internal_reasoning|hidden reasoning/iu.test(content)) {
		errors.push('reasoning_leak_marker');
	}

	return errors;
}

function toErrorSummary(error) {
	if (error instanceof Error) {
		return {
			message: error.message,
			name: error.name,
		};
	}

	return {
		message: 'Unknown DeepSeek user journey failure.',
		name: 'UnknownError',
	};
}

function printSummary(summary) {
	process.stdout.write(`DEEPSEEK_USER_JOURNEY_LIVE_SUMMARY ${JSON.stringify(summary)}\n`);
}

async function runScenario({ gateway, modelSources, scenario }) {
	const startedAt = Date.now();
	const response = await gateway.generate(buildRequest(scenario));
	const latencyMs = Date.now() - startedAt;
	const validationErrors = validateScenarioResponse({
		modelSources,
		response,
		scenario,
	});

	return {
		content_length: response.message.content.trim().length,
		finish_reason: response.finish_reason,
		id: scenario.id,
		intent: scenario.intent,
		latency_ms: latencyMs,
		model: response.model,
		persona: scenario.persona,
		provider: response.provider,
		response_preview: response.message.content.trim().slice(0, 160),
		status: validationErrors.length === 0 ? 'PASS' : 'FAIL',
		title: scenario.title,
		validation_errors: validationErrors,
	};
}

async function main() {
	const envFiles = loadEnvAuthorityFiles(repoRoot);
	const apiKeySource = resolveApiKeySource(envFiles);
	const modelSources = resolveModelSources(envFiles);
	const databaseUrlAuthority = resolveEnvAuthority({
		env: process.env,
		files: envFiles,
		name: 'DATABASE_URL',
	});

	if (!apiKeySource.apiKey) {
		printSummary({
			...buildAuthoritySummary(apiKeySource, modelSources),
			blocker_kind: 'credential_missing',
			database_url_authority: databaseUrlAuthority.report,
			provider: 'deepseek',
			result: 'BLOCKED',
			scenario_count: scenarios.length,
			stage_results: [],
			working_directory: repoRoot,
		});
		process.exitCode = 2;
		return;
	}

	const modules = await loadRuntimeModules();
	const gateway = createGateway(modules, apiKeySource.apiKey, modelSources.fast.model);
	const stageResults = [];

	for (const scenario of scenarios) {
		try {
			stageResults.push(
				await runScenario({
					gateway,
					modelSources,
					scenario,
				}),
			);
		} catch (error) {
			stageResults.push({
				error: toErrorSummary(error),
				id: scenario.id,
				intent: scenario.intent,
				persona: scenario.persona,
				status: 'FAIL',
				title: scenario.title,
			});
		}
	}

	const failedStages = stageResults.filter((result) => result.status !== 'PASS');

	printSummary({
		...buildAuthoritySummary(apiKeySource, modelSources),
		api_key_env: apiKeySource.envName,
		database_url_authority: databaseUrlAuthority.report,
		persona_count: new Set(scenarios.map((scenario) => scenario.persona)).size,
		provider: 'deepseek',
		result: failedStages.length === 0 ? 'PASS' : 'FAIL',
		scenario_count: scenarios.length,
		stage_results: stageResults,
		working_directory: repoRoot,
	});

	if (failedStages.length > 0) {
		process.exitCode = 1;
	}
}

await main();
