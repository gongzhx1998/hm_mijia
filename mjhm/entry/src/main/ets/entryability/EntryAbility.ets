import { AbilityConstant, common, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { webview } from '@kit.ArkWeb';
import { setStatusBar } from '../common/AppConfig';
import { ensureRnHostCache } from '../service/RnHostWarm';
import { ensureWarmWeb } from '../service/RnWebPool';

const DOMAIN = 0x0000;

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(DOMAIN, 'EntryAbility', 'onCreate');
    // 预热 Web 引擎（须在主线程、Web 组件创建前调用一次）
    try {
      webview.WebviewController.initializeWebEngine();
      hilog.info(DOMAIN, 'EntryAbility', 'PERF initializeWebEngine ok');
    } catch (e) {
      hilog.error(DOMAIN, 'EntryAbility', 'initializeWebEngine %{public}s', String(e));
    }
    // 后台预热 rnhost 文件缓存，避免点进插件页才拷 17MB+811 图
    const ctx: common.UIAbilityContext = this.context;
    setTimeout(() => {
      const t0: number = Date.now();
      ensureRnHostCache(ctx).then((dir: string) => {
        hilog.info(DOMAIN, 'EntryAbility', 'PERF warmCache ok +%{public}dms %{public}s', Date.now() - t0, dir);
      }).catch((e: Object) => {
        hilog.error(DOMAIN, 'EntryAbility', 'PERF warmCache fail %{public}s', String(e));
      });
    }, 0);
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, 'EntryAbility', 'Failed to load content: %{public}s', JSON.stringify(err));
        return;
      }
      hilog.info(DOMAIN, 'EntryAbility', 'Succeeded in loading content');
      // 缓存就绪后创建离线暖机 Web（index?warm=1 + sdk 预执行）
      const ctx: common.UIAbilityContext = this.context;
      const ui = windowStage.getMainWindowSync().getUIContext();
      let sbVp: number = 0;
      try {
        const win = windowStage.getMainWindowSync();
        const area = win.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM);
        sbVp = Math.round(ui.px2vp(area.topRect.height) * 100) / 100;
      } catch (_e) {
      }
      ensureRnHostCache(ctx).then((dir: string) => {
        ensureWarmWeb(ui, dir, sbVp);
        hilog.info(DOMAIN, 'EntryAbility', 'PERF ensureWarmWeb scheduled dir=%{public}s sb=%{public}s', dir,
          String(sbVp));
      }).catch((e: Object) => {
        hilog.error(DOMAIN, 'EntryAbility', 'ensureWarmWeb %{public}s', String(e));
      });
    });
    setStatusBar('#F5F6F7', false);
  }

  onWindowStageDestroy(): void {
    hilog.info(DOMAIN, 'EntryAbility', 'onWindowStageDestroy');
  }

  onForeground(): void {
    hilog.info(DOMAIN, 'EntryAbility', 'onForeground');
  }

  onBackground(): void {
    hilog.info(DOMAIN, 'EntryAbility', 'onBackground');
  }

  onDestroy(): void {
    hilog.info(DOMAIN, 'EntryAbility', 'onDestroy');
  }
}
