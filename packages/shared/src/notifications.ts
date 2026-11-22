import { z } from 'zod';

export const notificationDetailSchema = z.object({
  label: z.string(),
  value: z.string(),
});
export type NotificationDetail = z.infer<typeof notificationDetailSchema>;

export const notificationViewSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  /** Path inside the workspace, e.g. /properties/imports. */
  link: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.iso.datetime(),
  /** Who, what and when, as label/value rows for the detail popup. */
  details: z.array(notificationDetailSchema).nullable(),
});
export type NotificationView = z.infer<typeof notificationViewSchema>;
