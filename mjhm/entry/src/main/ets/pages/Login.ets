import { router, promptAction } from '@kit.ArkUI';
import { webview } from '@kit.ArkWeb';
import * as MiCloud from '../service/MiCloud';
import * as Storage from '../service/Storage';
import { AppConfig, Logger } from '../common/AppConfig';
import { UserInfo } from '../model/Models';

const TAG = 'Login';

/**
 * 登录页：真实小米账号登录（micloud 三步握手）
 * 二次验证在 App 内嵌 WebView 完成，验证通过后 WebView 自动跳转 sts 回调，
 * 拦截回调自动完成登录，无需手动操作。
 */
@Entry
@Component
struct Login {
  @State account: string = '';
  @State password: string = '';
  @State loading: boolean = false;
  @State verifyUrl: string = '';
  @State verifying: boolean = false;
  private stsPassed: boolean = false;
  private webController: webview.WebviewController = new webview.WebviewController();

  async doLogin(): Promise<void> {
    if (this.account === '' || this.password === '') {
      promptAction.showToast({ message: '请输入账号和密码' });
      return;
    }
    this.loading = true;
    this.verifyUrl = '';
    try {
      const ok = await MiCloud.login(this.account, this.password);
      if (!ok) {
        const url = MiCloud.getNotificationUrl();
        if (url !== '') {
          // 打开内嵌 WebView 做二次验证：先同步 http 模块的会话 Cookie 到 WebView
          this.stsPassed = false;
          this.verifyUrl = url;
          return;
        }
        promptAction.showToast({ message: '登录失败：请检查账号和密码' });
        return;
      }
      await this.finishLogin();
    } catch (e) {
      promptAction.showToast({ message: '登录异常，请检查网络' });
    } finally {
      this.loading = false;
    }
  }

  /** 登录成功后进入首页；设备列表后台异步拉取，避免网络卡顿阻断跳转 */
  async finishLogin(): Promise<void> {
    // 先保存登录态并跳转首页（不等待设备列表）
    const user: UserInfo = {
      userId: MiCloud.getUserId(),
      nickname: this.account,
      avatar: '',
      token: 'cloud_session'
    };
    try {
      await Storage.saveObject(AppConfig.KEY_USER, user);
      await Storage.saveString(AppConfig.KEY_TOKEN, 'cloud_session');
    } catch (e) {
      Logger.error(TAG, `save user failed: ${e}`);
    }
    promptAction.showToast({ message: '登录成功' });
    router.replaceUrl({ url: 'pages/Home' });

    // 后台异步拉设备列表，成功后再写入存储（首页 onShow 时读取）
    MiCloud.getDevices('cn').then((devices: MiCloud.CloudDevice[]) => {
      Storage.saveObject(AppConfig.KEY_CLOUD_DEVICES, devices);
    }).catch((e: Error) => {
      Logger.error(TAG, `getDevices background failed: ${e}`);
    });
  }

  /**
   * 同步判断某 URL 是否为验证完成回跳地址（callbackLogin 等，直接拦截）。
   */
  isVerifyCallback(url: string): boolean {
    return url.indexOf('callbackLogin') >= 0
      || url.indexOf('/pass/callback') >= 0;
  }

  /** 验证结果检查页：放行让 WebView 继续跳，同时 http 并行 GET 其 callback 参数签发 token */
  isResultCheck(url: string): boolean {
    return url.indexOf('identity/result/check') >= 0;
  }

  /** sts 签发地址：第一次放行让 WebView 写入 serviceToken cookie */
  isStsCallback(url: string): boolean {
    return url.indexOf('sts.api.io.mi.com') >= 0 || url.indexOf('/sts?') >= 0;
  }

  /** 延迟指定毫秒 */
  delay(ms: number): Promise<void> {
    return new Promise<void>((resolve: () => void) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * http 路径：用 cookieJar 直接 GET result/check 的 callback 地址签发 serviceToken。
   */
  async tryHttpFinish(url: string): Promise<void> {
    if (this.verifying) {
      return;
    }
    this.verifying = true;
    try {
      const accCookie = this.readCookieFromWeb('https://account.xiaomi.com');
      MiCloud.mergeCookieFromWeb(accCookie);
      const ok = await MiCloud.completeLoginAfterVerify(url);
      if (ok) {
        Logger.info(TAG, 'http path success, calling finishLogin');
        await this.finishLogin();
        return;
      }
      // http 路径失败，等 WebView 路径（tryWebFinish）继续尝试，这里不弹 toast
      Logger.error(TAG, 'http finish failed, waiting web path');
    } catch (e) {
      Logger.error(TAG, `tryHttpFinish error: ${e}`);
      promptAction.showToast({ message: '登录态获取异常，请重试' });
    } finally {
      this.verifying = false;
    }
  }

  /**
   * WebView 路径：sts 跳转放行后，serviceToken 已写入 WebView cookie，延迟读取完成登录。
   */
  async tryWebFinish(): Promise<void> {
    if (this.verifying) {
      return;
    }
    this.verifying = true;
    try {
      await this.delay(2500);
      const stsCookie = this.readCookieFromWeb('https://sts.api.io.mi.com');
      const apiCookie = this.readCookieFromWeb('https://api.io.mi.com');
      const accCookie = this.readCookieFromWeb('https://account.xiaomi.com');
      MiCloud.mergeCookieFromWeb(stsCookie);
      MiCloud.mergeCookieFromWeb(apiCookie);
      let token = MiCloud.extractCookieValue(stsCookie, 'serviceToken');
      if (token === '') {
        token = MiCloud.extractCookieValue(apiCookie, 'serviceToken');
      }
      if (token === '') {
        token = MiCloud.extractCookieValue(accCookie, 'serviceToken');
      }
      Logger.error(TAG, `web path stsCookie=${stsCookie}`);
      if (token !== '') {
        const ok = await MiCloud.completeLoginWithToken(token, `${stsCookie}; ${apiCookie}`);
        if (ok) {
          await this.finishLogin();
          return;
        }
      }
      // WebView cookie 里也拿不到，最后再走一次 http 完整链路
      const ok2 = await MiCloud.completeLoginAfterVerify('https://account.xiaomi.com/identity/result/check');
      if (ok2) {
        await this.finishLogin();
        return;
      }
      promptAction.showToast({ message: '验证已通过，但获取登录态失败，请重试' });
    } catch (e) {
      Logger.error(TAG, `tryWebFinish error: ${e}`);
      promptAction.showToast({ message: '登录态获取异常，请重试' });
    } finally {
      this.verifying = false;
    }
  }

  /**
   * 拦截 WebView 的跳转：验证完成后小米会跳回 callback 约定地址，
   * 此时用保存的登录参数重放 serviceLoginAuth2 完成登录。
   */
  async onVerifyIntercept(url: string): Promise<void> {
    if (this.verifying) {
      return;
    }
    this.verifying = true;
    try {
      Logger.info(TAG, `onVerifyIntercept url=${url}`);
      // 先把 WebView 验证得到的 Cookie 合并进 http 模块会话罐（信任状态绑定在 Cookie 上）
      const accCookie = this.readCookieFromWeb('https://account.xiaomi.com');
      const stsCookie = this.readCookieFromWeb('https://sts.api.io.mi.com');
      const apiCookie = this.readCookieFromWeb('https://api.io.mi.com');
      Logger.info(TAG, `account cookie=${accCookie}`);
      Logger.info(TAG, `sts cookie=${stsCookie}`);
      MiCloud.mergeCookieFromWeb(accCookie);
      MiCloud.mergeCookieFromWeb(stsCookie);
      MiCloud.mergeCookieFromWeb(apiCookie);

      // 用保存的登录参数完成登录（重新拿 ssecurity + serviceToken）
      const ok = await MiCloud.completeLoginAfterVerify(url);
      if (ok) {
        await this.finishLogin();
        return;
      }
      promptAction.showToast({ message: '验证已通过，但获取登录态失败，请重试' });
    } catch (e) {
      Logger.error(TAG, `onVerifyIntercept error: ${e}`);
      promptAction.showToast({ message: '登录态获取异常，请重试' });
    } finally {
      this.verifying = false;
    }
  }

  /** 从 WebView Cookie 读取指定域的 Cookie 字符串 */
  readCookieFromWeb(domain: string): string {
    try {
      return webview.WebCookieManager.fetchCookieSync(domain);
    } catch (e) {
      return '';
    }
  }

  build() {
    Column() {
      if (this.verifyUrl !== '') {
        // 二次验证：全屏内嵌浏览器，验证完成后自动登录
        Column() {
          Row() {
            Text('←')
              .fontSize(20)
              .onClick(() => { this.verifyUrl = ''; })
            Text('小米账号安全验证')
              .fontSize(16)
              .fontWeight(FontWeight.Medium)
              .margin({ left: 12 })
          }
          .width('100%')
          .padding({ left: 16, right: 16, top: 12, bottom: 12 })

          Web({ src: this.verifyUrl, controller: this.webController })
            .onControllerAttached(() => {
              // 同步 http 模块会话 Cookie 到 WebView（含 deviceId，保持会话一致）
              const sessionCookie = MiCloud.getSessionCookie();
              if (sessionCookie !== '') {
                webview.WebCookieManager.configCookieSync('https://account.xiaomi.com', sessionCookie);
              }
            })
            .onLoadIntercept((event) => {
              const url = event.data.getRequestUrl();
              // 验证结果检查页：放行 WebView 继续跳，同时 http 并行 GET 其 callback 签发 token
              if (this.isResultCheck(url)) {
                Logger.info(TAG, `result/check, allow web + http parallel: ${url}`);
                this.tryHttpFinish(url);
                return false;
              }
              // sts 签发地址：第一次放行让 WebView 写入 serviceToken cookie，随后延迟读取
              if (this.isStsCallback(url)) {
                if (!this.stsPassed) {
                  this.stsPassed = true;
                  Logger.info(TAG, `sts callback, allow once: ${url}`);
                  this.tryWebFinish();
                  return false;
                }
                this.onVerifyIntercept(url);
                return true;
              }
              // 其他验证完成回跳（callbackLogin 等）：拦截，由 App 接管
              if (this.isVerifyCallback(url)) {
                this.onVerifyIntercept(url);
                return true;
              }
              return false;
            })
            .width('100%')
            .layoutWeight(1)
        }
        .width('100%')
        .height('100%')
      } else {
        Column() {
          Text('米家')
            .fontSize(36)
            .fontWeight(FontWeight.Bold)
            .fontColor('#1A1A1A')
          Text('HarmonyOS 原生版')
            .fontSize(14)
            .fontColor('#999999')
            .margin({ top: 8 })
        }
        .margin({ top: 80 })

        Column() {
          TextInput({ placeholder: '小米账号（手机号/邮箱/小米ID）', text: this.account })
            .onChange((v: string) => { this.account = v; })
            .height(48)
            .margin({ bottom: 16 })

          TextInput({ placeholder: '密码', text: this.password })
            .type(InputType.Password)
            .onChange((v: string) => { this.password = v; })
            .height(48)
            .margin({ bottom: 24 })

          Button(this.loading ? '登录中…' : '登录小米账号')
            .width('100%')
            .height(48)
            .backgroundColor('#FF6700')
            .fontColor('#FFFFFF')
            .enabled(!this.loading)
            .onClick(() => { this.doLogin(); })
        }
        .width('100%')
        .padding({ left: 32, right: 32 })
        .margin({ top: 40 })

        Text('登录即代表同意《用户协议》与《隐私政策》')
          .fontSize(12)
          .fontColor('#BBBBBB')
          .textAlign(TextAlign.Center)
          .margin({ top: 24 })
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#FFFFFF')
  }
}
