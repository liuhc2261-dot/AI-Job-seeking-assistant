import { z } from "zod";

export const commerceCheckoutRequestSchema = z.object({
  planCode: z.enum(["jd_diagnose_pack_29"]),
  paymentChannel: z.enum(["manual", "wechat", "alipay"]).default("wechat"),
});

export const commerceConfirmOrderSchema = z.object({
  paymentChannel: z.enum(["manual", "wechat", "alipay"]).optional(),
  externalOrderId: z
    .string()
    .trim()
    .max(128, "外部订单号不能超过 128 个字符。")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(240, "备注不能超过 240 个字符。")
    .optional()
    .or(z.literal("")),
});
