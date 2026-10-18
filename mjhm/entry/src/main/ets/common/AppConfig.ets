import { window } from '@kit.ArkUI';

/**
 * 全局常量与配置
 * 全真实数据：小米账号登录走米家云私有协议（micloud 三步握手），设备控制走 miIO 局域网协议
 */
export class AppConfig {
  // 米家云 API 基址（签名请求）—— 逆向 aa.apk（com.xiaomi.smarthome）确认：
  // 中国大陆服务器使用新域名 api.mijia.tech（ir7.OooOoO0 逻辑），海外用 {region}.api.io.mi.com
  static readonly IOT_API_BASE: string = 'https://api.mijia.tech/app';

  // 本地存储 key
  static readonly KEY_TOKEN: string = 'mijia_token';
  static readonly KEY_USER: string = 'mijia_user';
  static readonly KEY_CURRENT_HOME: string = 'mijia_current_home';
  static readonly KEY_CLOUD_DEVICES: string = 'mijia_cloud_devices';
  static readonly KEY_SCENES: string = 'mijia_scenes';
}

/** 全局日志 */
export class Logger {
  static readonly DOMAIN: number = 0x0000;

  static info(tag: string, msg: string): void {
    console.info(`[${tag}] ${msg}`);
  }

  static error(tag: string, msg: string): void {
    console.error(`[${tag}] ${msg}`);
  }
}

/**
 * 设置状态栏颜色：让顶部状态栏与页面背景色一致。
 * @param bgColor 状态栏背景色（如首页深蓝 #6E93B8、其他浅色 #F5F6F7）
 * @param lightText 状态栏文字/图标是否用浅色（深色背景用 true 白字，浅色背景用 false 黑字）
 */
export async function setStatusBar(bgColor: string, lightText: boolean): Promise<void> {
  try {
    const win = await window.getLastWindow(getContext());
    await win.setWindowSystemBarProperties({
      statusBarColor: bgColor,
      statusBarContentColor: lightText ? '#FFFFFF' : '#000000'
    });
  } catch (e) {
    Logger.error('StatusBar', `setStatusBar failed: ${e}`);
  }
}
