# ADR 0008 — File imports and photo storage

- Status: Accepted (M2)
- Blueprint: §6.2, §7.4, §8.6, §13.1

## Decisions

- **Two-step import.** Upload stores the file and returns headers plus a suggested mapping.
  Preview and commit both read the stored file, so the reviewed data is the imported data.
- **Source.** Each tenant gets one built-in `CrmConnection` (provider CSV, systemKey
  `file-import`). `SyncRun` (kind FILE_IMPORT) holds counters, the mapping and the status.
- **Identity.** Upsert key `(tenant, source, externalId)`. Re-importing is idempotent.
- **Unmapped vs empty.** Unmapped column: field untouched. Mapped but empty: field cleared.
- **Errors, not guesses.** Ambiguous numbers (`4.50`, mixed separators), unknown currency and
  duplicate IDs in one file are row errors. Messages never echo cell values.
- **Commit runs in the worker.** Chunks of 200 rows, one transaction each. Retry resumes from
  `processedRows`. Measured: 5,000 rows in about 11 s on the dev machine.
- **Personal data.** The source file is deleted after completion, failure or expiry (24 h). Only
  row number, field and message are kept. Error report CSV neutralises `= + - @` cells.
- **Photos.** Validated by content (sharp), not MIME. EXIF orientation applied before reading
  size. Original under `raw/`, 640 px WebP preview under `normalized/`. Per-property SHA-256
  dedupe. Objects written before the row; objects deleted on row failure.
- **Access.** Bucket stays private. Browsers get 15-minute signed GET URLs.

## Not included

- Downloading photo URLs from CSV (SSRF risk; needs an allow-list in the CRM milestone).
- HEIC photos (rejected with a clear message).
