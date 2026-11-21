# ADR 0006 — SeaweedFS for local S3-compatible storage

- Status: Accepted (M0)
- Blueprint: §8.6

## Context

The plan named MinIO for local object storage. Its public Docker images (`minio/minio`,
`minio/mc`, `quay.io/minio/minio`) could not be pulled on 21 Nov 2026.

## Decision

Use SeaweedFS (`chrislusf/seaweedfs`, pinned tag, Apache-2.0) with its S3 gateway for local
development. Dev-only credentials live in `infra/seaweedfs/s3.json`. The bucket is created by
`pnpm services:up` (`apps/api/scripts/ensure-bucket.mjs`).

The application only talks S3 through `@aws-sdk/client-s3`, so production can use AWS S3,
Cloudflare R2 or a regional provider without code changes; that choice remains open (KVKK data
location review).
