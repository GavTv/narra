# Narra

Микро-SaaS, который превращает CSV, XLSX или сырой текст в короткий AI-нарратив, 2–3 подходящих графика и чат по данным.

**Live:** https://narra-mu.vercel.app  
**GitHub:** https://github.com/GavTv/narra


## Возможности

- drag-and-drop загрузка CSV/XLSX и вставка текста;
- структурированный AI-анализ без свободного HTML/кода от модели;
- интерактивные bar, line и pie charts;
- hybrid RAG-чат с памятью диалога и ссылками на строки отчёта;
- loading, empty и error states;
- демо-режим без API-ключа с детерминированным локальным анализом.

## Стек

Next.js, TypeScript, Tailwind CSS, Motion, Recharts, Gemini API, LangChain.js, LangGraph.js, Papa Parse, read-excel-file, Zod, Vitest.

## Запуск

```bash
npm install
cp .env.example .env.local
npm run dev
```

В `.env.local`:

```env
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-flash-latest
GEMINI_FALLBACK_MODEL=gemini-2.5-flash-lite
```

Откройте [http://localhost:3000](http://localhost:3000). Без ключа можно использовать кнопку «Демо-отчёт».

Проверки:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Структура (FSD)

```text
src/
  app/           # тонкие Next routes / API adapters
  widgets/       # Dashboard, ReportChat, UploadPanel, Header
  features/      # клиентские use-cases (fetch + hooks + UI)
  entities/      # чистый domain (типы, index, retrieve, local analysis)
  shared/        # http, result, validation, format, consts
  server/        # server-only: ai, rag, толстые use-cases
```

Импорты только вниз по слоям: `app → widgets → features → entities → shared`.  
`app/api → server use-case → ai/rag + entities`.  
`server` недоступен клиенту (`server-only`). Публичный API слайса — через `index.ts`.

Граница ответственности:
- **API route** — parse HTTP → вызвать use-case → вернуть JSON;
- **server use-case** — валидация, оркестрация AI/RAG, fallback, DTO;
- **entities** — домен без Gemini/HTTP;
- **client features** — тонкий `fetch` + session/chat hooks.

## Как устроено

1. Файл разбирается в браузере (`features/parseUpload`) и нормализуется до безопасной табличной структуры.
2. `/api/analyze` делегирует в `server/analyzeReport`: валидация Zod → Gemini → local fallback → DTO.
3. Модель выбирает типы графиков, но может использовать только значения из отчёта.
4. `/api/chat` делегирует в `server/askReport`: индекс → LangGraph RAG → local fallback → DTO.
5. LangGraph направляет точные вычисления в локальный query engine, а смысловые вопросы — в lexical retriever и Gemini.
6. Модель получает только найденные фрагменты и возвращает structured answer с проверяемыми citations.
7. Если LLM недоступна, приложение остаётся рабочим благодаря локальному анализатору.

Данные и индекс не сохраняются. В MVP анализируется первый лист XLSX; контекст ограничен 500 строками и 75 000 символами. Для такого объёма BM25-подобный поиск проще и точнее контролируется, чем внешняя векторная база.

## Deploy

1. Залейте репозиторий на GitHub.
2. Import в [Vercel](https://vercel.com/new).
3. Environment Variables: `GEMINI_API_KEY` (опционально `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`).
4. Deploy. Root = корень репо, framework = Next.js.

## Как использовался AI

Cursor — основная «команда разработки»; я держал роль PM/art director: скоуп на 2 дня, вайб UI, где резать сложность.

Примеры промптов:

- «Спроектируй компактный Next.js MVP без авторизации: upload → narrative → charts → grounded chat».
- «Верни строгую JSON-схему дашборда; все числа должны быть из входного отчёта».
- «Сделай hybrid RAG без векторной БД: lexical retrieve + deterministic calc + Gemini, с citations».
- «Разложи по FSD: тонкий API, толстый server use-case, чистый domain, худой client».

Где модель ошиблась и что поправил вручную:

- уязвимый `xlsx` → `read-excel-file`;
- вопросы вроде «что продалось меньше» давали ложный «данных нет» → доработал sales Q&A и validation citations;
- pie-инсайт в local fallback иногда подписывал не тот максимум → исправил расчёт;


Сценарий видео-питча: [`LOOM.md`](./LOOM.md).


