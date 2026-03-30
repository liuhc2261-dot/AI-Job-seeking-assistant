import crypto from "node:crypto";

import QRCode from "qrcode";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  createUnavailablePaymentSession,
  getPersonalCollectionQrUrl,
  hasMerchantPaymentConfig,
  hasPersonalCollectionQr,
  isPaymentChannelConfigured,
  normalizeMultilineSecret,
  normalizePem,
  resolveAppUrl,
} from "@/lib/payments";
import type {
  CommercePaymentChannelKind,
  CommercePaymentSession,
} from "@/types/commercial";

type PaymentGatewayCheckoutInput = {
  orderId: string;
  amountCents: number;
  planLabel: string;
  paymentChannel: CommercePaymentChannelKind;
};

type StoredPaymentSession = {
  channel: CommercePaymentChannelKind;
  status: "pending" | "ready" | "expired" | "paid" | "not_configured";
  expiresAt: string | null;
  codeUrl: string | null;
  paymentUrl: string | null;
  qrCodeDataUrl: string | null;
  displayTitle: string;
  displayDescription: string;
};

type WechatPayNotificationPayload = {
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
};

type AlipayNotificationPayload = {
  out_trade_no?: string;
  trade_no?: string;
  trade_status?: string;
};

type PaymentCallbackResult =
  | {
      handled: false;
      reason: "ignored";
    }
  | {
      handled: true;
      orderId: string;
      paymentChannel: CommercePaymentChannelKind;
      externalOrderId: string;
    };

const WECHAT_NATIVE_ORDER_URL =
  "https://api.mch.weixin.qq.com/v3/pay/transactions/native";

function getNonce(size = 24) {
  return crypto.randomBytes(size).toString("hex");
}

function buildWechatAuthorization({
  method,
  pathname,
  body,
}: {
  method: string;
  pathname: string;
  body: string;
}) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = getNonce(16);
  const message = `${method}\n${pathname}\n${timestamp}\n${nonce}\n${body}\n`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(message);
  signer.end();

  const signature = signer.sign(normalizePem(env.wechatPayPrivateKey), "base64");

  return `WECHATPAY2-SHA256-RSA2048 mchid="${env.wechatPayMerchantId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${env.wechatPaySerialNo}",signature="${signature}"`;
}

function verifyWechatNotificationSignature(bodyText: string, request: Request) {
  const timestamp = request.headers.get("wechatpay-timestamp")?.trim();
  const nonce = request.headers.get("wechatpay-nonce")?.trim();
  const signature = request.headers.get("wechatpay-signature")?.trim();

  if (!timestamp || !nonce || !signature || !env.wechatPayPlatformPublicKey) {
    return false;
  }

  const message = `${timestamp}\n${nonce}\n${bodyText}\n`;
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(message);
  verifier.end();

  return verifier.verify(
    normalizePem(env.wechatPayPlatformPublicKey),
    signature,
    "base64",
  );
}

function decryptWechatResource(resource: {
  associated_data?: string;
  nonce?: string;
  ciphertext?: string;
}) {
  if (!resource.nonce || !resource.ciphertext) {
    throw new Error("WECHAT_PAY_RESOURCE_INVALID");
  }

  const apiV3Key = Buffer.from(
    normalizeMultilineSecret(env.wechatPayApiV3Key),
    "utf8",
  );
  const ciphertext = Buffer.from(resource.ciphertext, "base64");
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    apiV3Key,
    Buffer.from(resource.nonce, "utf8"),
  );

  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  }

  decipher.setAuthTag(authTag);

  const plainText = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plainText) as WechatPayNotificationPayload;
}

function createAlipaySignature(params: URLSearchParams) {
  const signableParts = [...params.entries()]
    .filter(([key, value]) => key !== "sign" && value)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`);

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signableParts.join("&"));
  signer.end();

  return signer.sign(normalizePem(env.alipayPrivateKey), "base64");
}

function verifyAlipaySignature(params: URLSearchParams) {
  const signature = params.get("sign");

  if (!signature || !env.alipayPublicKey) {
    return false;
  }

  const signableParts = [...params.entries()]
    .filter(([key, value]) => key !== "sign" && key !== "sign_type" && value)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`);

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(signableParts.join("&"));
  verifier.end();

  return verifier.verify(normalizePem(env.alipayPublicKey), signature, "base64");
}

async function createQrCodeDataUrl(value: string | null) {
  if (!value) {
    return null;
  }

  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 260,
  });
}

function getPaymentExpiresAt(minutesFromNow: number) {
  return new Date(Date.now() + minutesFromNow * 60_000);
}

function resolvePersonalPaymentDescription(channel: CommercePaymentChannelKind) {
  const providerLabel = channel === "wechat" ? "微信" : "支付宝";
  const contact = env.personalPaymentContact.trim();

  if (contact) {
    return `请使用${providerLabel}扫码向个人账户付款。付款后请保留截图，并通过 ${contact} 发送订单号，等待人工确认到账。`;
  }

  return `请使用${providerLabel}扫码向个人账户付款。付款后请保留截图，并联系站长人工确认到账后开通权益。`;
}

export class PaymentServiceError extends Error {
  constructor(
    public readonly code:
      | "PAYMENT_CHANNEL_NOT_SUPPORTED"
      | "PAYMENT_PROVIDER_NOT_CONFIGURED"
      | "PAYMENT_GATEWAY_ERROR"
      | "PAYMENT_SIGNATURE_INVALID"
      | "PAYMENT_CALLBACK_INVALID",
    public readonly details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

class PaymentService {
  async createCheckoutSession(
    input: PaymentGatewayCheckoutInput,
  ): Promise<CommercePaymentSession> {
    if (input.paymentChannel === "manual") {
      return {
        channel: "manual",
        status: "ready",
        expiresAt: null,
        codeUrl: null,
        paymentUrl: null,
        qrCodeDataUrl: null,
        displayTitle: "人工开通",
        displayDescription:
          "当前订单使用人工开通模式，请在确认到账后手动发放套餐权益。",
      };
    }

    if (!isPaymentChannelConfigured(input.paymentChannel)) {
      return createUnavailablePaymentSession(input.paymentChannel);
    }

    if (hasMerchantPaymentConfig(input.paymentChannel)) {
      if (input.paymentChannel === "wechat") {
        return this.createWechatCheckoutSession(input);
      }

      if (input.paymentChannel === "alipay") {
        return this.createAlipayCheckoutSession(input);
      }
    }

    if (hasPersonalCollectionQr(input.paymentChannel)) {
      return this.createPersonalCollectionSession(input);
    }

    throw new PaymentServiceError("PAYMENT_PROVIDER_NOT_CONFIGURED", {
      paymentChannel: input.paymentChannel,
    });
  }

  async buildOrderPaymentSession(order: {
    id: string;
    amountCents: number;
    paymentChannel: string | null;
    paymentPayload: unknown;
    paymentExpiresAt: Date | null;
    status: string;
    planCode: "TRIAL" | "JD_DIAGNOSE_PACK_29";
  }): Promise<CommercePaymentSession | null> {
    const channel =
      (order.paymentChannel as CommercePaymentChannelKind | null) ?? null;

    if (!channel) {
      return null;
    }

    if (order.status === "PAID" || order.status === "MANUAL_GRANTED") {
      return {
        channel,
        status: "paid",
        expiresAt: order.paymentExpiresAt?.toISOString() ?? null,
        codeUrl: null,
        paymentUrl: null,
        qrCodeDataUrl: null,
        displayTitle: "已支付",
        displayDescription: "该订单已完成支付，权益已发放或正在同步。",
      };
    }

    const storedPayload = this.parseStoredPaymentSession(order.paymentPayload);

    if (storedPayload) {
      const expired =
        order.paymentExpiresAt !== null &&
        order.paymentExpiresAt.getTime() <= Date.now();

      return {
        ...storedPayload,
        status: expired ? "expired" : storedPayload.status,
        expiresAt: order.paymentExpiresAt?.toISOString() ?? storedPayload.expiresAt,
      };
    }

    if (channel === "manual") {
      return {
        channel: "manual",
        status: "ready",
        expiresAt: null,
        codeUrl: null,
        paymentUrl: null,
        qrCodeDataUrl: null,
        displayTitle: "人工开通",
        displayDescription: "该订单正在等待人工确认到账。",
      };
    }

    return createUnavailablePaymentSession(channel);
  }

  async ensureOrderPaymentSession(order: {
    id: string;
    amountCents: number;
    paymentChannel: string | null;
    paymentPayload: unknown;
    paymentExpiresAt: Date | null;
    status: string;
    planCode: "TRIAL" | "JD_DIAGNOSE_PACK_29";
  }) {
    const currentSession = await this.buildOrderPaymentSession(order);
    const channel = order.paymentChannel as CommercePaymentChannelKind | null;

    if (!channel) {
      return null;
    }

    if (
      currentSession &&
      currentSession.status !== "expired" &&
      currentSession.status !== "not_configured"
    ) {
      return currentSession;
    }

    if (channel === "manual") {
      return currentSession;
    }

    const planLabel =
      order.planCode === "JD_DIAGNOSE_PACK_29" ? "29 元冲刺包" : "免费试用";
    const session = await this.createCheckoutSession({
      orderId: order.id,
      amountCents: order.amountCents,
      planLabel,
      paymentChannel: channel,
    });
    const expiresAt = session.expiresAt ? new Date(session.expiresAt) : null;

    await prisma.commerceOrder.update({
      where: {
        id: order.id,
      },
      data: {
        paymentPayload: session,
        paymentExpiresAt: expiresAt,
      },
    });

    return session;
  }

  async handleWechatCallback(request: Request): Promise<PaymentCallbackResult> {
    const bodyText = await request.text();

    if (!verifyWechatNotificationSignature(bodyText, request)) {
      throw new PaymentServiceError("PAYMENT_SIGNATURE_INVALID", {
        provider: "wechat",
      });
    }

    const payload = JSON.parse(bodyText) as {
      resource?: {
        associated_data?: string;
        nonce?: string;
        ciphertext?: string;
      };
    };
    const resource = decryptWechatResource(payload.resource ?? {});

    if (
      resource.trade_state !== "SUCCESS" ||
      !resource.out_trade_no ||
      !resource.transaction_id
    ) {
      return {
        handled: false,
        reason: "ignored",
      };
    }

    return {
      handled: true,
      orderId: resource.out_trade_no,
      paymentChannel: "wechat",
      externalOrderId: resource.transaction_id,
    };
  }

  async handleAlipayCallback(request: Request): Promise<PaymentCallbackResult> {
    const bodyText = await request.text();
    const params = new URLSearchParams(bodyText);

    if (!verifyAlipaySignature(params)) {
      throw new PaymentServiceError("PAYMENT_SIGNATURE_INVALID", {
        provider: "alipay",
      });
    }

    const payload = Object.fromEntries(params.entries()) as AlipayNotificationPayload;

    if (
      !payload.out_trade_no ||
      !payload.trade_no ||
      (payload.trade_status !== "TRADE_SUCCESS" &&
        payload.trade_status !== "TRADE_FINISHED")
    ) {
      return {
        handled: false,
        reason: "ignored",
      };
    }

    return {
      handled: true,
      orderId: payload.out_trade_no,
      paymentChannel: "alipay",
      externalOrderId: payload.trade_no,
    };
  }

  private parseStoredPaymentSession(value: unknown) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const payload = value as Partial<StoredPaymentSession>;

    if (
      typeof payload.channel !== "string" ||
      typeof payload.status !== "string" ||
      typeof payload.displayTitle !== "string" ||
      typeof payload.displayDescription !== "string"
    ) {
      return null;
    }

    return {
      channel: payload.channel as CommercePaymentChannelKind,
      status: payload.status as CommercePaymentSession["status"],
      expiresAt: payload.expiresAt ?? null,
      codeUrl: payload.codeUrl ?? null,
      paymentUrl: payload.paymentUrl ?? null,
      qrCodeDataUrl: payload.qrCodeDataUrl ?? null,
      displayTitle: payload.displayTitle,
      displayDescription: payload.displayDescription,
    } satisfies CommercePaymentSession;
  }

  private createPersonalCollectionSession(
    input: PaymentGatewayCheckoutInput,
  ): CommercePaymentSession {
    const imageUrl = getPersonalCollectionQrUrl(input.paymentChannel);
    const providerLabel = input.paymentChannel === "wechat" ? "微信" : "支付宝";

    return {
      channel: input.paymentChannel,
      status: "ready",
      expiresAt: null,
      codeUrl: null,
      paymentUrl: imageUrl,
      qrCodeDataUrl: imageUrl,
      displayTitle: `${providerLabel}个人收款码`,
      displayDescription: resolvePersonalPaymentDescription(input.paymentChannel),
    };
  }

  private async createWechatCheckoutSession(
    input: PaymentGatewayCheckoutInput,
  ): Promise<CommercePaymentSession> {
    const bodyPayload = {
      appid: env.wechatPayAppId,
      mchid: env.wechatPayMerchantId,
      description: input.planLabel,
      out_trade_no: input.orderId,
      notify_url: resolveAppUrl(env.wechatPayNotifyPath),
      amount: {
        total: input.amountCents,
        currency: "CNY",
      },
      attach: input.orderId,
    };
    const body = JSON.stringify(bodyPayload);
    const authorization = buildWechatAuthorization({
      method: "POST",
      pathname: "/v3/pay/transactions/native",
      body,
    });
    const response = await fetch(WECHAT_NATIVE_ORDER_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    const responseText = await response.text();

    if (!response.ok) {
      throw new PaymentServiceError("PAYMENT_GATEWAY_ERROR", {
        provider: "wechat",
        status: response.status,
        responsePreview: responseText.slice(0, 240),
      });
    }

    const payload = JSON.parse(responseText) as {
      code_url?: string;
    };

    if (!payload.code_url) {
      throw new PaymentServiceError("PAYMENT_GATEWAY_ERROR", {
        provider: "wechat",
        responsePreview: responseText.slice(0, 240),
      });
    }

    const expiresAt = getPaymentExpiresAt(30);

    return {
      channel: "wechat",
      status: "ready",
      expiresAt: expiresAt.toISOString(),
      codeUrl: payload.code_url,
      paymentUrl: payload.code_url,
      qrCodeDataUrl: await createQrCodeDataUrl(payload.code_url),
      displayTitle: "微信支付二维码",
      displayDescription: "使用微信扫一扫支付，支付成功后权益会自动到账。",
    };
  }

  private async createAlipayCheckoutSession(
    input: PaymentGatewayCheckoutInput,
  ): Promise<CommercePaymentSession> {
    const params = new URLSearchParams({
      app_id: env.alipayAppId,
      method: "alipay.trade.precreate",
      charset: "utf-8",
      sign_type: "RSA2",
      timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
      version: "1.0",
      notify_url: resolveAppUrl(env.alipayNotifyPath),
      biz_content: JSON.stringify({
        out_trade_no: input.orderId,
        total_amount: (input.amountCents / 100).toFixed(2),
        subject: input.planLabel,
      }),
    });

    params.set("sign", createAlipaySignature(params));

    const response = await fetch(env.alipayGatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(20_000),
    });
    const responseText = await response.text();

    if (!response.ok) {
      throw new PaymentServiceError("PAYMENT_GATEWAY_ERROR", {
        provider: "alipay",
        status: response.status,
        responsePreview: responseText.slice(0, 240),
      });
    }

    const payload = JSON.parse(responseText) as {
      alipay_trade_precreate_response?: {
        code?: string;
        msg?: string;
        sub_msg?: string;
        qr_code?: string;
      };
    };
    const precreateResult = payload.alipay_trade_precreate_response;

    if (precreateResult?.code !== "10000" || !precreateResult.qr_code) {
      throw new PaymentServiceError("PAYMENT_GATEWAY_ERROR", {
        provider: "alipay",
        code: precreateResult?.code ?? null,
        message: precreateResult?.sub_msg ?? precreateResult?.msg ?? "unknown_error",
      });
    }

    const expiresAt = getPaymentExpiresAt(15);

    return {
      channel: "alipay",
      status: "ready",
      expiresAt: expiresAt.toISOString(),
      codeUrl: precreateResult.qr_code,
      paymentUrl: precreateResult.qr_code,
      qrCodeDataUrl: await createQrCodeDataUrl(precreateResult.qr_code),
      displayTitle: "支付宝二维码",
      displayDescription: "使用支付宝扫一扫支付，支付成功后权益会自动到账。",
    };
  }
}

export const paymentService = new PaymentService();
