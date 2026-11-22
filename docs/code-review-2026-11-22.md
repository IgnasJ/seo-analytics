# Kodo peržiūra ir patobulinimai (2026-11-22)

Peržiūrėtas visas serverio kodas (`src/lib`, `src/app/api`, `src/proxy.ts`), puslapiai
(`src/app/**/page.tsx`), konfigūracija (Dockerfile, docker-compose, `next.config.js`) ir
`docker/ai-runner`. Komponentai (`src/components`) peržiūrėti dalinai: pilnai – tie, kurie
daro užklausas, apklausą (polling) ar srautinį skaitymą; grafikų ir lentelių komponentai –
tik pagal paiešką (laikmačiai, `fetch`, `JSON.parse`, `dangerouslySetInnerHTML`).

Dokumentą sudaro trys dalys:

1. [Kas įgyvendinta](#1-kas-įgyvendinta)
2. [Kas neįgyvendinta ir kodėl](#2-kas-neįgyvendinta-ir-kodėl)
3. [Ką žinoti diegiant](#3-ką-žinoti-diegiant)

## Kaip tikrinta

| Patikra | Rezultatas |
| --- | --- |
| `pnpm test` | 212 testų praeina (buvo 189; pridėti 23 nauji) |
| `npx tsc --noEmit` | 0 klaidų (buvo 1 sena klaida `sync-button.tsx`) |
| `pnpm run build` | pavyko |
| Tikras serveris (`next start`) su DB **kopija** | visi puslapiai ir API maršrutai grąžina 200 / laukiamus kodus |
| Naršyklė (Chrome) | prisijungimas, dashboard, `/audit` eilutės išskleidimas, domeno skirtukai – be konsolės klaidų |

Nepatikrinta gyvai: `docker build`, tikra Google sinchronizacija (nenorėjau naudoti jūsų
Google paskyros be leidimo) ir tikras `claude` CLI generavimas (AI srautas tikrintas su
netikru „runner“ serveriu).

---

## 1. Kas įgyvendinta

### 1.1. Saugumas

| # | Problema | Sprendimas | Failai |
| --- | --- | --- | --- |
| S1 | **Nuotolinis komandų vykdymas.** `GET /api/guides/ping?cli=…` perduodavo `cli` į `spawn(..., { shell: true })`. Be `APP_PASSWORD` – pasiekiama be prisijungimo. | Leidžiamos tik `claude` ir `codex`; `shell` naudojamas tik Windows ir tik su leidžiamu vardu bei pastoviais argumentais; `runner` ir `url` parametrai tikrinami. Tas pats sąrašas taikomas `getRunner()` ir `PATCH /api/settings` (`ai_cli`, `ai_runner`, `ai_runner_url`, `ai_model`). | `src/lib/ai-runner/index.ts`, `src/app/api/guides/ping/route.ts`, `src/app/api/settings/route.ts` |
| S2 | **XSS / atviras nukreipimas** per `/login?next=javascript:…` (`window.location.href = next`). | `safeNextPath()` priima tik tos pačios kilmės kelius; atmeta `javascript:`, `//host`, `/\host`. | `src/lib/safe-redirect.ts`, `src/app/login/page.tsx` |
| S3 | Domeno tikrinimas `endsWith(hostname)` praleisdavo `evil-example.com`. | Tikslus sutapimas arba `.hostname` galūnė; URL tikrinamas `new URL()`. | `src/app/api/guides/route.ts` |
| S4 | Puslapio parsiuntimas AI gidui: laiko limitas nuimamas prieš skaitant turinį, dydis neribotas. | Limitas galioja iki skaitymo pabaigos; skaitoma ne daugiau 512 KB. | `src/lib/ai-runner/context.ts` |
| S5 | Prisijungimas neribojo bandymų. | 10 nesėkmių per 5 min. vienam adresui, 100 – visiems; atsakymas `429` su `Retry-After`. | `src/lib/rate-limit.ts`, `src/app/api/auth/login/route.ts` |
| S6 | Google OAuth be `state`. | Atsitiktinis `state` slapuke (`oauth_state`, 10 min.), tikrinamas grįžus. | `src/lib/google/oauth.ts`, `src/app/api/auth/google/route.ts`, `src/app/api/auth/callback/route.ts` |
| S7 | Proxy praleisdavo bet kurį kelią, kuris baigiasi `.js`, `.png` ir pan. (pvz. `/api/audit/5.js`). | Išimtis pašalinta; lieka tik `_next/static`, `_next/image`, `favicon.ico`. | `src/proxy.ts` |

### 1.2. Veikimo klaidos

| # | Problema | Sprendimas | Failai |
| --- | --- | --- | --- |
| B1 | GSC paspaudimai / parodymai buvo sumuojami tik iš top 500 užklausų, todėl **rodomi per maži**; vidutinė pozicija – paprastas vidurkis. | Sumos imamos iš dienų eilučių (visa svetainė); pozicija sveriama parodymais. | `src/lib/google/search-console.ts` (`computeGscOverview`) |
| B2 | AI generavimas nenutraukiamas uždarius puslapį – CLI procesas dirba iki galo. | `AbortSignal` nuo užklausos iki `spawn` / `fetch`; procesas nužudomas. Patikrinta: nutraukus klientą, „runner“ gauna atjungimą po 4 iš 40 dalių. | `src/lib/ai-runner/index.ts`, `src/lib/ai-runner/sse.ts`, `src/app/api/guides/route.ts`, `src/app/api/issues-guide/route.ts` |
| B3 | Nuotolinio „runner“ klaida `{__error}` būdavo įrašoma į gidą kaip tekstas `[object Object]`. | Klaida perduodama naudotojui, gidas neišsaugomas. | `src/lib/ai-runner/index.ts` |
| B4 | `docker/ai-runner/server.js`: trūkstant CLI procesas lūždavo (neapdorotas `error`); CLI nenutraukiamas atsijungus. | Pridėti `error` apdorojimai, `res.on("close")` nužudo procesą, užklausos dydžio riba 1 MB. | `docker/ai-runner/server.js` |
| B5 | Google API užklausos be laiko limito – pakibusi užklausa užblokuodavo domeno sinchronizaciją iki perkrovimo. | 30 s limitas visoms `googleapis` užklausoms ir CrUX. | `src/lib/google/request-options.ts`, `analytics.ts`, `search-console.ts` |
| B6 | Datos skaičiuotos vietos laiku, o formatuotos UTC – apie vidurnaktį intervalai pasislinkdavo. | Skaičiuojama UTC. | `src/lib/sync.ts` |
| B7 | `PATCH /api/domains/[id]` su vienu lauku ištrindavo kitą (GA4 ↔ GSC); netikrinamas `id` ir kategorija. | Dalinis atnaujinimas, tikrinimai, `400` / `404`. | `src/app/api/domains/[id]/route.ts` |
| B8 | `Dockerfile` kopijuoja `/app/public`, kurio nėra. | `RUN mkdir -p public` prieš build. | `Dockerfile` |
| B9 | `sidebar.tsx` grįždavo `null` prieš `useEffect` – „hooks“ taisyklės pažeidimas. | `return` perkeltas po „hooks“. | `src/components/layout/sidebar.tsx` |
| B10 | AI gidų komponentai netikrino `res.ok` – serverio klaida (pvz. „sync this domain first“) dingdavo be pranešimo; tinklo klaida nepagaunama. | Klaidos rodomos; generavimas nutraukiamas išmontavus komponentą. | `src/components/opportunities/guide-panel.tsx`, `src/components/issues/issue-fix-guide.tsx` |
| B11 | `SyncButton`: nepavykusi sinchronizacija atrodė kaip pavykusi; `asChild` neegzistuoja `Button` komponente (tipų klaida, paslėpta `ignoreBuildErrors`). | Rodoma klaida; nuoroda su `buttonVariants`. | `src/components/sync/sync-button.tsx` |
| B12 | AI nustatymų išsaugojimas netikrino atsakymo. | Rodoma, kodėl neišsaugota. | `src/components/settings/ai-runner-card.tsx` |
| B13 | Smulkūs: `createAudit` skaitė „paskutinę eilutę“ vietoj įterptos; `DELETE` / `PATCH` maršrutai be `id` tikrinimo. | Naudojamas `lastInsertRowid`; pridėti tikrinimai. | `src/lib/db/queries/audits.ts`, API maršrutai |

### 1.3. CPU ir RAM

| # | Kas pakeista | Poveikis | Failai |
| --- | --- | --- | --- |
| P1 | **Lengvos auditų eilutės.** Sąrašų užklausos nebegrąžina viso `result_json` (vid. 57 KB, iš jų ~20 KB ekrano nuotrauka) – tik balus (~150 B). Pilnas rezultatas užkraunamas išskleidus eilutę. | `/api/audit` 20 eilučių: 7 KB (išmatuota) vietoj ~1,1 MB (apskaičiuota iš DB). Tai kartojasi kas 5 s, kol vyksta auditas. | `src/lib/db/queries/audits.ts`, `src/app/audit/page.tsx` |
| P2 | **Auditų suvestinė.** SQLite pats ištraukia balus ir neišlaikytus patikrinimus. | Atsakymas tas pats (sutikrinta su senu skaičiavimu ant tikrų duomenų), bet nebenarstoma 4,1 MB JSON 72 eilutėms (iki ~28 MB prie 500). | `listAuditsForSummary`, `src/app/api/audit/summary/route.ts` |
| P3 | **Dashboard ir Analytics.** Skaitoma tik `overview` + `daily` (`getGscSummary`, `getAnalyticsSummary`), sinchronizacijos būsena – viena užklausa (`getLatestSync`); kai intervalas „1m“, tas pats įrašas nebeskaitomas du kartus. | GSC įrašas – 46 KB vid. (iki 252 KB) vienam domenui; dabar į V8 patenka keli KB. Užklausų vienam domenui: 7 → 6 (dashboard), 6 → 3–5 (analytics). | `src/lib/db/queries/cache.ts`, `src/app/page.tsx`, `src/app/analytics/page.tsx` |
| P4 | **Paruoštų užklausų kešas.** Anksčiau kiekviena užklausa buvo iš naujo analizuojama. | Kešas iki 200 užklausų; išvalomas po schemos keitimo (`exec`, `ALTER/CREATE/DROP`). | `src/lib/db/driver.ts` |
| P5 | Indeksas `sync_log(domain_id, synced_at, id)`. | Paskutinės sinchronizacijos paieška nebeskenuoja visos lentelės. | `src/lib/db/schema.ts` |
| P6 | `PRAGMA synchronous=NORMAL`, `busy_timeout=5000`. | Mažiau `fsync` rašant (WAL režime saugu). | `src/lib/db/index.ts` |
| P7 | GSC nebesiunčia užklausų „today“ / „yesterday“ (visada tušti – DB visi 13 domenų turėjo 0 eilučių). | 8 užklausomis mažiau domenui per sinchronizaciją (24 → 16). | `src/lib/sync.ts` |
| P8 | Google prieigos žetonas kešuojamas atmintyje. | „Sync all“ nebeatnaujina žetono kiekvienam domenui. | `src/lib/google/oauth.ts` |
| P9 | HMAC raktas sesijos tikrinimui importuojamas vieną kartą. | Proxy vykdomas kiekvienai užklausai. | `src/lib/auth.ts` |
| P10 | API skaitiklis: vienas įrašymas vietoj 4–5. | Mažiau DB rašymų. | `src/lib/db/queries/api-usage.ts` |

Tiesiogiai CPU ir RAM prieš / po **nematavau** (profiliavimo nedariau). Skaičiai aukščiau –
atsakymų dydžiai ir JSON apimtys, išmatuoti arba apskaičiuoti iš vietinės DB.

### 1.4. Nauji testai

- `src/lib/db/__tests__/slim-queries.test.ts` – lengvos eilutės, suvestinė (lygybė su pilnu skaičiavimu), kešo suvestinės, užklausų kešas po `ALTER TABLE`.
- `src/lib/google/__tests__/search-console.test.ts` – `computeGscOverview`.
- `src/lib/__tests__/safe-redirect.test.ts`, `src/lib/__tests__/rate-limit.test.ts`.

---

## 2. Kas neįgyvendinta ir kodėl

### 2.1. Reikia jūsų sprendimo

| # | Tema | Kodėl nedaryta |
| --- | --- | --- |
| N1 | **Automatinė sinchronizacija.** `/api/sync/startup` niekas nekviečia, todėl duomenys atsinaujina tik paspaudus mygtuką. | Reikia pasirinkti: išorinis cron (tada maršrutui reikia atskiro rakto, nes proxy reikalauja sesijos) ar laikmatis serverio procese. |
| N2 | **„Common failures“ filtras** `/audit` puslapyje: paspaudus perduodamas gedimo pavadinimas į `q`, o serveris `q` ieško URL lauke – rezultatas visada tuščias (`summary-card.tsx:243`, `audit/page.tsx`). | Reikia nuspręsti: daryti tikrą filtrą pagal gedimo `id` ar paversti tekstu be paspaudimo. |
| N3 | **`docker-compose.yml`**: programa pagal nutylėjimą `AI_RUNNER=local`, nors jos atvaizde CLI nėra; `ai-runner` konteineris veikia visada. | Pakeitus numatytąsias reikšmes arba perkėlus į `profiles`, pasikeistų esamas `docker compose up` elgesys. |
| N4 | **`sync_log` valymas** – lentelė auga be ribų (dabar 472 eilutės). | Tai duomenų trynimas; reikia nuspręsti, kiek istorijos laikyti. |
| N5 | **`APP_PASSWORD` nenustatytas = programa atvira.** | Sąmoningas pasirinkimas vietiniam darbui; viešam diegimui verta priverstinai reikalauti. |

### 2.2. Didesni darbai (rekomenduojama, bet negalėjau patikrinti gyvai)

| # | Tema | Nauda | Pastaba |
| --- | --- | --- | --- |
| R1 | **`googleapis` keitimas į `fetch`.** Naudojami tik keli REST kvietimai. | Paketas – 195 MB `node_modules`; serverio build'e yra 11,9 MB gabalas, kuris greičiausiai yra ši biblioteka (nepatvirtinta). Mažesnis RAM ir greitesnis paleidimas. | Reikia testuoti su tikra Google paskyra. |
| R2 | **GA4 `batchRunReports`** – 5 ataskaitos viena užklausa. | 30 → 6 HTTP užklausos domenui. | Tas pats – reikia gyvo patikrinimo. |
| R3 | **Ekrano nuotraukos atskirai** nuo `result_json` (atskiras stulpelis ar lentelė). | `/audit/url` puslapis vis dar perduoda visus pilnus auditus į naršyklę (373 KB vienam URL su 2 auditais). | Reikia DB migracijos. |
| R4 | **`/api/sync/all` kaip foninis darbas.** Dabar HTTP užklausa laukia visų domenų; tarpinis serveris gali ją nutraukti. | Patikimesnė „Sync all“ būsena. | Reikia būsenos apklausos UI. |
| R5 | **Domeno puslapis** kiekvienai užklausai atvaizduoja visus skirtukus (500 užklausų, 200 puslapių, galimybės). | Mažesnis RSC atsakymas (dabar 103–142 KB). | Skirtuką perkelti į URL ir atvaizduoti tik aktyvų. |
| R6 | **Grafikai (`recharts`)** domeno ir analytics puslapiuose kraunami iškart; tingiai kraunami tik `/audit/url` grafikai. | Mažesnis pradinis JS naršyklėje. | Tik naršyklės pusė. |
| R7 | **PSI atsakymo `fields` parametras** – prašyti tik reikalingų laukų. | Mažiau RAM audito metu. | Nepatikrinta, ar Google leidžia reikiamą laukų kaukę. |

### 2.3. Smulkmenos

- `LIKE` paieškoje neekranuojami `%` ir `_` (`listAuditsFiltered`, `listAuditsForHostname`).
- `summary-card.tsx` suvestinę užkrauna vieną kartą ir neatnaujina po naujų auditų.
- `next.config.js` – `typescript.ignoreBuildErrors: true` su komentaru apie Bun, kuris nebenaudojamas. Dabar tipų klaidų nėra, tad patikrą galima įjungti atgal.
- `recordApiCall("crux" | "psi")` skaičiuoja ir nepavykusias užklausas, nors komentaras sako priešingai.
- `shadcn` paketas yra `dependencies`, nors reikalingas tik CSS importui (`globals.css`).

---

## 3. Ką žinoti diegiant

1. **GSC skaičiai pasikeis po kitos sinchronizacijos.** Paspaudimai ir parodymai padidės
   (anksčiau buvo skaičiuojama tik dalis srauto), vidutinė pozicija taps sverta. Seni kešo
   įrašai lieka su senomis reikšmėmis, kol domenas nesinchronizuotas iš naujo.
2. **GSC „Today“ ir „Yesterday“** nebeatnaujinami (jie ir anksčiau buvo tušti).
3. **Google paskyros prijungimas** dabar reikalauja `oauth_state` slapuko: srautą reikia
   pradėti nuo „Connect Google“ mygtuko toje pačioje naršyklėje.
4. **Prisijungimas**: po 10 neteisingų bandymų per 5 min. – `429`. Skaitiklis atmintyje,
   perkrovus serverį nusinulina. Adresas imamas iš `X-Forwarded-For`.
5. **Proxy** dabar tikrina visus kelius, išskyrus `_next/static`, `_next/image`,
   `favicon.ico`. Jei kada atsiras `public/` failų, kuriuos reikia rodyti neprisijungus,
   juos reikės įtraukti į `matcher`.
6. **AI nustatymai**: `ai_cli` – tik `claude` arba `codex`; `ai_runner_url` – tik
   `http(s)`; `ai_model` – tik modelio vardo simboliai. Tušti laukai reiškia „naudoti
   aplinkos kintamąjį“.
7. **`docker/ai-runner`** atvaizdą reikia perkurti, kad įsigaliotų `server.js` pakeitimai.
8. **DB**: pirmą kartą paleidus sukuriamas indeksas `idx_sync_log_domain` (vietinėje DB jis
   jau sukurtas `next build` metu). Kitų schemos pakeitimų nėra.
9. Pakeitimai **neįkelti į git** (nei commit, nei push) – jie yra darbiniame kataloge.
