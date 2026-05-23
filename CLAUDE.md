# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
npm run dev              # Vite dev server (frontend only, no Electron)
npm run build            # Vite production build only
npm run electron:dev     # Full Electron dev mode (Vite + Electron concurrently)
npm run electron:build   # Production build (vite build + electron-builder)
npm run electron:build:win  # Windows-only production build
```

To package for Windows when GitHub is unreachable (China mainland):
```bash
npx vite build && ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ npx electron-builder --win
```

## Architecture

**Electron + Vue 3 desktop app** for managing employee leave records. 包头市融媒体中心 internal system.

### Process model

```
┌─ Main Process (electron/) ─────────────────────────────┐
│  main.js       — App lifecycle, IPC handlers, service init
│  database.js   — SQLite via sql.js (WASM), two tables
│  ocr.js         — Multi-engine OCR (Tesseract / Tencent / GLM / Qwen-VL)
│  settings.js   — JSON config persisted to %APPDATA%/leave-management/
│  backup.js     — Export/import DB + images + settings as .zip (adm-zip)
│  preload.js    — contextBridge: exposes electronAPI to renderer
└──────────────────────────────────────────────────────────┘
                           │ IPC (invoke/handle)
┌─ Renderer (src/) ───────────────────────────────────────┐
│  App.vue                — Root: data management CRUD
│  components/
│    ImageUpload.vue       — OCR image upload + manual entry
│    OcrPreview.vue        — OCR result review with employee roster matching
│    DataTable.vue         — Leave records table with edit/delete
│    SearchPanel.vue       — Filter/search conditions
│    Statistics.vue        — Charts: leave types, departments, trends, ranking
│    EmployeeList.vue      — Employee roster CRUD, Excel import/export
│    BirthdayBlessing.vue  — Birthday tracking from ID numbers, employee editing
│    SettingsDialog.vue    — All settings including OCR engine, passwords, backup
│    LoginDialog.vue       — Login password gate
│  utils/api.js            — Safe wrapper: returns null/[] in browser, electronAPI in Electron
└──────────────────────────────────────────────────────────┘
```

### Data layer (`electron/database.js`)

SQLite via `sql.js` (no native compilation needed). Single file at `%APPDATA%/leave-management/leave_records.db`.

Two tables:
- **`leave_records`** — Leave application records. Schema defined in `createTables()`. Fields: applicant, department, agent, leave_type, start_date, end_date, days, apply_date, cancel_date, image_path, ocr_confidence, remark.
- **`employees`** — Employee roster. Schema in `createEmployeeTable()`. Fields: name, phone, id_number (partial unique index for non-empty), department, position, employment_type, seq_number, category_seq, remark, active.

Key patterns:
- `updateEmployee()` builds dynamic SET clauses from Object.entries — only passed fields are updated.
- `update()` for leave_records has a hardcoded column list. If adding new columns to leave_records, the `update()` SQL must be updated too (this caused the image_path bug).
- `id_number` uses a partial unique index: `WHERE id_number IS NOT NULL AND id_number != ''` — allows multiple empty values.
- `_migrateIdNumberConstraint()` handles schema evolution for the id_number unique constraint.
- Every write calls `this.save()` which exports WASM DB to file.

### OCR pipeline (`electron/ocr.js`)

Engine selection based on `settings.ocrEngine`:
- `tesseract` — Local Tesseract.js with dual-pass preprocessing (normal + handwriting-enhanced via sharp)
- `tencent` — Tencent Cloud GeneralHandwritingOCR API
- `glm` — ZhiPu GLM-4.6V-Flash vision model
- `glm-ocr` — ZhiPu GLM-OCR dedicated model, falls back to GLM-4.6V for missing fields
- `qwen-vl-plus` / `qwen-vl-72b` — Alibaba DashScope Qwen-VL

All engines return a uniform result shape: `{ fullText, confidence, engine, applicant, department, agent, leave_type, start_date, end_date, days, apply_date, cancel_date, fieldConfidence, extractedWords }`.

The Tesseract path uses spatial analysis (`extractFieldsWithSpatialAnalysis`) to find labels and extract neighboring values. Includes comprehensive printed-text filtering to ignore form boilerplate.

### IPC channel naming

All IPC uses `invoke/handle` (async). Channel prefixes:
- `dialog:*` — File dialogs
- `image:*` — Image file operations (copy, read, saveBase64)
- `ocr:*` — OCR recognition
- `db:*` — Database CRUD for both tables
- `settings:*` — Settings read/write/test
- `password:*` — Login and admin password management
- `backup:*` — Data export/import

### Build quirks

- `package.json` → `build.win.signAndEditExecutable: false` is set to skip electron-builder's built-in rcedit (requires winCodeSign from GitHub, unreachable from China). Icon is applied by `scripts/afterPack.js` using the local `rcedit` npm package.
- `asarUnpack` entries needed for native WASM/node modules: tesseract.js, sql.js, sharp, tencentcloud SDKs.
- Version bump: edit `package.json` → `version`, then rebuild.
