import { AUDIT_EVENT_TYPES } from "@moauth/audit-store";

export function loginSuccessSummary() {
  return "账号中心登录成功";
}

export function handoffIssuedSummary(clientDisplayName) {
  return clientDisplayName
    ? `为 ${clientDisplayName} 登录签发 handoff`
    : "为应用登录签发 handoff";
}

export function handoffConsumedSummary(clientDisplayName) {
  return clientDisplayName
    ? `Connect 消费 handoff，建立 ${clientDisplayName} SSO`
    : "Connect 消费 handoff 建立 SSO";
}

export function consentGrantedSummary(clientDisplayName) {
  return clientDisplayName
    ? `授权 ${clientDisplayName} 访问账号信息`
    : "授权应用访问账号信息";
}

export function consentDeniedSummary(clientDisplayName) {
  return clientDisplayName
    ? `拒绝 ${clientDisplayName} 的授权请求`
    : "拒绝应用授权请求";
}

export function profileUpdatedSummary() {
  return "更新个人资料";
}

export function passwordChangedSummary() {
  return "修改登录密码";
}

export function passwordResetSummary() {
  return "通过邮箱重置密码";
}

export function emailVerifiedSummary() {
  return "邮箱验证成功";
}

export function applicationRevokedSummary(displayName) {
  return displayName ? `撤销 ${displayName} 的授权` : "撤销应用授权";
}

export { AUDIT_EVENT_TYPES };