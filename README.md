# Realtime Fintech Dashboard

Учебное Angular-приложение: живая таблица выдуманных инструментов и страница настроек генератора. Случайный шаг цены считает библиотека Rust, собранная в WebAssembly и запущенная внутри Web Worker. Это не биржа и не учебник по матчингу ордеров.

Метрики считаются в TypeScript внутри воркера. В главный поток уходит уже свёрнутый снимок, не чаще одного кадра. Цены внутри — целые центы, на экране — валюта.

## Prerequisites

- Node.js 22 or newer
- Rust stable (`rustup`)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

On macOS:

```bash
brew install wasm-pack
rustup target add wasm32-unknown-unknown
```

On any platform with Rust already installed:

```bash
cargo install wasm-pack
rustup target add wasm32-unknown-unknown
```

## Run

```bash
npm install
npm start
```

`npm start` builds the generator with `wasm-pack build --target web` into `public/market-wasm`, then serves the app at http://localhost:4200. The dashboard opens first. Settings do not change the run until Apply.

## Tests

```bash
npm test
npm run test:generator
```

`npm test` is `ng test` without a file watcher. `npm run test:generator` is `cargo test` for the Rust generator. Neither suite waits on a real timer.

## Where to read the design

- `docs/story.html` — связный разбор: как работает проект, зачем каждый файл и каждый паттерн
- `docs/how-it-works.html` — подробный разбор, что сделано и как данные идут от Wasm до таблицы
- `docs/design-patterns.md` — the ten patterns and why the others were left out
- `docs/files.md` — files that cannot carry a source header, including generated Wasm output
