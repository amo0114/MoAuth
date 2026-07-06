/** Edge middleware 与 Node 运行时共享，勿引入 node:* 依赖 */
export const ACCOUNT_SESSION_COOKIE = "moauth_account_session";
export const ACCOUNT_SESSION_TTL_SECONDS = 8 * 60 * 60;

/** Issued by Connect; cleared on Account logout so MoAuth flows re-enter identity login. */
export const CONNECT_SESSION_COOKIE = "moauth_connect_session";