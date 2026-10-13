# MediaPipe Tasks Vision 0.10.35

Cópia local de `@mediapipe/tasks-vision@0.10.35` (npm), para o Fono do Leo funcionar sem CDN e offline.

- `vision_bundle.js`: `vision_bundle.mjs` do pacote, sem o comentário de source map.
- `wasm/`: runtime WebAssembly do pacote (com e sem SIMD).
- `../../models/face_landmarker.task`: modelo Face Landmarker (float16, versão 1) de
  `storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/`.

Licença: Apache License 2.0, © Google LLC. Para atualizar, troque a pasta inteira por uma
com o novo número de versão e ajuste os caminhos em `js/engine/face.js`; o service worker
guarda esta pasta em cache para sempre, então a versão no nome é o que força o download novo.
