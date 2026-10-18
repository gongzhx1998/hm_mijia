import { router, promptAction } from '@kit.ArkUI';
import * as ApiService from '../service/ApiService';
import * as MiCloud from '../service/MiCloud';
import { Device } from '../model/Models';
import { Logger } from '../common/AppConfig';

const TAG = 'DeviceControl';

/** 台灯场景模式项 */
interface SceneItem {
  value: number;
  label: string;
  icon: string;
}

/** 升降桌记忆位项 */
interface MemoryItem {
  value: number;   // mode 值（1-4 对应 Mem1-Mem4）
  piid: number;    // mem-one/two/three/four 的 piid（4-7）
  label: string;
}

/**
 * 设备控制页：根据服务端下发的 miot-spec 定义动态渲染控制面板。
 * - format=bool 属性 → 开关
 * - format=数值 + value-range 属性 → 滑块（min/max/step 由 spec 决定）
 * - 写值走 /miotspec/prop/set（siid/piid/value），读值走 /miotspec/prop/get。
 * 全真实、无 mock，控制能力完全由设备 spec 定义决定。
 */
@Entry
@Component
struct DeviceControl {
  @State device: Device | null = null;
  @State specProps: MiCloud.SpecProperty[] = [];
  @State propValues: Record<string, string | number | boolean> = {};
  @State busy: boolean = false;
  @State loading: boolean = false;
  private did: string = '';

  async aboutToAppear(): Promise<void> {
    const params = router.getParams() as Record<string, string>;
    this.did = params['did'] ?? '';
    const devices = await ApiService.getDevices('');
    for (let i = 0; i < devices.length; i++) {
      if (devices[i].did === this.did) {
        this.device = devices[i];
        break;
      }
    }
    if (this.device !== null) {
      await this.loadSpec();
    }
  }

  /** 拉取设备 spec 定义 + 批量读取当前属性值 */
  async loadSpec(): Promise<void> {
    this.loading = true;
    try {
      const specs = await MiCloud.getDeviceSpecs([this.did]);
      const spec = specs[this.did];
      if (spec !== undefined) {
        this.specProps = spec.props;
        await this.readValues();
      }
    } catch (e) {
      Logger.error(TAG, `loadSpec failed: ${e}`);
    } finally {
      this.loading = false;
    }
  }

  /** 批量读取所有可写属性的当前值 */
  async readValues(): Promise<void> {
    if (this.specProps.length === 0) {
      return;
    }
    const siids: number[] = [];
    const piids: number[] = [];
    for (let i = 0; i < this.specProps.length; i++) {
      siids.push(this.specProps[i].siid);
      piids.push(this.specProps[i].piid);
    }
    try {
      this.propValues = await MiCloud.miotGetPropValues(this.did, siids, piids);
    } catch (e) {
      Logger.error(TAG, `readValues failed: ${e}`);
    }
  }

  /** 写属性（云 miot-spec），成功后更新本地显示 */
  async setProp(prop: MiCloud.SpecProperty, value: string | number | boolean): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = true;
    try {
      await MiCloud.miotSetProp(this.did, prop.siid, prop.piid, value);
      this.updateValue(prop, value);
    } catch (e) {
      Logger.error(TAG, `setProp ${prop.siid}.${prop.piid} failed: ${e}`);
      promptAction.showToast({ message: '指令发送失败，请检查设备状态' });
    } finally {
      this.busy = false;
    }
  }

  /** 更新本地值（重建对象以触发 ArkTS 响应式刷新） */
  updateValue(prop: MiCloud.SpecProperty, value: string | number | boolean): void {
    const next: Record<string, string | number | boolean> = {};
    const keys = Object.keys(this.propValues);
    for (let i = 0; i < keys.length; i++) {
      next[keys[i]] = this.propValues[keys[i]];
    }
    next[`${prop.siid}.${prop.piid}`] = value;
    this.propValues = next;
  }

  // ==================== 定制设备判断 ====================
  isLight(): boolean {
    return this.device !== null && this.device.model === 'philips.light.lite';
  }

  isDesk(): boolean {
    return this.device !== null && this.device.model === 'xlang.desk.vlocv2';
  }

  // ==================== 按 siid/piid 直接读写 ====================
  getVal(siid: number, piid: number): string | number | boolean {
    return this.propValues[`${siid}.${piid}`];
  }

  getNum(siid: number, piid: number, def: number): number {
    const v = this.getVal(siid, piid);
    return typeof v === 'number' ? v : def;
  }

  getBool(siid: number, piid: number): boolean {
    return this.getVal(siid, piid) === true;
  }

  async setVal(siid: number, piid: number, value: string | number | boolean): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = true;
    try {
      await MiCloud.miotSetProp(this.did, siid, piid, value);
      const next: Record<string, string | number | boolean> = {};
      const keys = Object.keys(this.propValues);
      for (let i = 0; i < keys.length; i++) {
        next[keys[i]] = this.propValues[keys[i]];
      }
      next[`${siid}.${piid}`] = value;
      this.propValues = next;
    } catch (e) {
      Logger.error(TAG, `setVal ${siid}.${piid} failed: ${e}`);
      promptAction.showToast({ message: '指令发送失败，请检查设备状态' });
    } finally {
      this.busy = false;
    }
  }

  /**
   * 升降桌电机控制专用：无 busy 锁（按住=发启动、松手=发停止，两次请求必须连续发出，
   * 不能被 busy 锁挡住，否则松手后桌子停不下来）。
   */
  async sendMotor(value: number): Promise<void> {
    try {
      await MiCloud.miotSetProp(this.did, 2, 1, value);
      const next: Record<string, string | number | boolean> = {};
      const keys = Object.keys(this.propValues);
      for (let i = 0; i < keys.length; i++) {
        next[keys[i]] = this.propValues[keys[i]];
      }
      next['2.1'] = value;
      this.propValues = next;
    } catch (e) {
      Logger.error(TAG, `sendMotor failed: ${e}`);
    }
  }

  // 台灯场景（philips.light.lite mode 0-3）
  lightScenes(): SceneItem[] {
    return [
      { value: 0, label: '阅读', icon: '📖' },
      { value: 1, label: '电脑', icon: '💻' },
      { value: 2, label: '睡眠', icon: '🌙' },
      { value: 3, label: '专注', icon: '🎯' }
    ];
  }

  // 升降桌记忆位（mode 1-4 → 对应 mem-one~four 的 piid 4-7）
  deskMems(): MemoryItem[] {
    return [
      { value: 1, piid: 4, label: '记忆位1' },
      { value: 2, piid: 5, label: '记忆位2' },
      { value: 3, piid: 6, label: '记忆位3' },
      { value: 4, piid: 7, label: '记忆位4' }
    ];
  }

  // 台灯延时关灯预设（秒）
  delayOptions(): SceneItem[] {
    return [
      { value: 0, label: '关闭', icon: '' },
      { value: 900, label: '15分', icon: '' },
      { value: 1800, label: '30分', icon: '' },
      { value: 3600, label: '1小时', icon: '' },
      { value: 7200, label: '2小时', icon: '' }
    ];
  }

  delayLabel(): string {
    const v = this.getNum(3, 1, 0);
    if (v <= 0) {
      return '关闭';
    }
    if (v < 3600) {
      return `${Math.round(v / 60)} 分钟`;
    }
    return `${Math.round(v / 3600)} 小时`;
  }

  // 升降桌防夹灵敏度档位
  pinchLevels(): SceneItem[] {
    return [
      { value: 1, label: '低', icon: '' },
      { value: 2, label: '中', icon: '' },
      { value: 3, label: '高', icon: '' }
    ];
  }

  boolValue(prop: MiCloud.SpecProperty): boolean {
    const v = this.propValues[`${prop.siid}.${prop.piid}`];
    return v === true;
  }

  numValue(prop: MiCloud.SpecProperty): number {
    const v = this.propValues[`${prop.siid}.${prop.piid}`];
    if (typeof v === 'number') {
      return v;
    }
    if (v === true) {
      return 1;
    }
    if (v === false) {
      return 0;
    }
    return prop.min;
  }

  numDisplay(prop: MiCloud.SpecProperty): string {
    const v = this.numValue(prop);
    return prop.unit !== '' ? `${v}${this.unitDisplay(prop.unit)}` : String(v);
  }

  /** 单位中文显示：celsius→°C、percentage→%、minutes→分钟等 */
  unitDisplay(unit: string): string {
    if (unit === 'celsius') {
      return '°C';
    }
    if (unit === 'percentage') {
      return '%';
    }
    if (unit === 'minutes') {
      return '分钟';
    }
    if (unit === 'seconds') {
      return '秒';
    }
    if (unit === 'hours') {
      return '小时';
    }
    if (unit === 'fahrenheit') {
      return '°F';
    }
    return unit;
  }

  /** 属性中文名映射：优先用标准属性名（从 type urn 提取），回退到英文描述 */
  propLabel(prop: MiCloud.SpecProperty): string {
    const n = prop.name;
    if (n === 'on' || n === 'switch-status') {
      return '电源';
    }
    if (n === 'brightness') {
      return '亮度';
    }
    if (n === 'volume') {
      return '音量';
    }
    if (n === 'target-temperature') {
      return '目标温度';
    }
    if (n === 'temperature') {
      return '温度';
    }
    if (n === 'relative-humidity') {
      return '湿度';
    }
    if (n === 'battery-level') {
      return '电量';
    }
    if (n === 'mode') {
      return '模式';
    }
    if (n === 'mute') {
      return '静音';
    }
    if (n === 'fan-level') {
      return '风速';
    }
    if (n === 'sleep-mode') {
      return '睡眠模式';
    }
    if (n === 'anion') {
      return '负离子';
    }
    if (n === 'physical-controls-locked') {
      return '童锁';
    }
    if (n === 'alarm') {
      return '提示音';
    }
    if (n === 'motor-control') {
      return '电机控制';
    }
    if (n === 'vertical-swing') {
      return '上下扫风';
    }
    if (n === 'horizontal-swing') {
      return '左右扫风';
    }
    if (n === 'color-temperature') {
      return '色温';
    }
    if (n === 'color') {
      return '颜色';
    }
    if (n === 'steam-sterilization') {
      return '蒸汽除菌';
    }
    if (n === 'temperature-display-unit') {
      return '温度单位';
    }
    if (n === 'water-level') {
      return '水位';
    }
    if (n === 'spin-speed') {
      return '转速';
    }
    if (n === 'wash-time') {
      return '洗涤时间';
    }
    if (n === 'target-humidity') {
      return '目标湿度';
    }
    if (n === 'humidity') {
      return '湿度';
    }
    if (n === 'aqi' || n === 'pm2-5-density') {
      return 'PM2.5';
    }
    if (n === 'filter-life-level') {
      return '滤芯寿命';
    }
    if (n === 'filter-used-time') {
      return '滤芯使用时长';
    }
    if (n === 'heater') {
      return '加热';
    }
    if (n === 'child-lock') {
      return '童锁';
    }
    if (n === 'water-conservation') {
      return '节水';
    }
    if (n === 'target-position' || n === 'altitude') {
      return '高度';
    }
    if (n === 'pinch-sensitivity') {
      return '防夹灵敏度';
    }
    if (n === 'mem-one') {
      return '记忆位1';
    }
    if (n === 'mem-two') {
      return '记忆位2';
    }
    if (n === 'mem-three') {
      return '记忆位3';
    }
    if (n === 'mem-four') {
      return '记忆位4';
    }
    if (n === 'rinsh-times') {
      return '漂洗次数';
    }
    if (n === 'reservation-wash-status') {
      return '预约洗涤';
    }
    if (n === 'reservation-left-time') {
      return '预约剩余时间';
    }
    if (n === 'high-water-switch') {
      return '高水位';
    }
    if (n === 'shake-time') {
      return '抖散时间';
    }
    if (n === 'ai-mode') {
      return 'AI模式';
    }
    if (n === 'soak-time') {
      return '浸泡时间';
    }
    if (n === 'cold-wash-time') {
      return '冷水洗涤';
    }
    if (n === 'final-spin-speed') {
      return '最终转速';
    }
    if (n === 'has-washed-times') {
      return '已洗涤次数';
    }
    if (n === 'detergent-deli-time') {
      return '洗涤剂投放';
    }
    if (n === 'softener-deli-time') {
      return '柔顺剂投放';
    }
    if (n === 'dry-time' || n === 'drying-time') {
      return '烘干时间';
    }
    if (n === 'dry-temperature') {
      return '烘干温度';
    }
    if (n === 'drying-level') {
      return '烘干档位';
    }
    if (n === 'water-temperature') {
      return '水温';
    }
    if (n === 'reset') {
      return '复位';
    }
    if (n === 'dvalue') {
      return '定时值';
    }
    if (n === 'notify-switch') {
      return '通知开关';
    }
    if (n === 'notify-time') {
      return '通知时间';
    }
    if (n === 'night-light-en') {
      return '夜灯';
    }
    if (n === 'filter-debug-time') {
      return '滤芯调试时间';
    }
    if (n === 'aqi-update-heartbeat') {
      return 'AQI更新间隔';
    }
    if (n === 'filter-left-time') {
      return '滤芯剩余时间';
    }
    if (n === 'filter-left-flow') {
      return '滤芯剩余流量';
    }
    if (n === 'filter-used-flow') {
      return '滤芯已用流量';
    }
    if (n === 'filter-need-cleaning') {
      return '滤芯需清洗';
    }
    if (n === 'match-state') {
      return '匹配状态';
    }
    if (n === 'ac-work-mode') {
      return '空调工作模式';
    }
    if (n === 'ac-state') {
      return '空调状态';
    }
    if (n === 'ac-type') {
      return '空调类型';
    }
    if (n === 'ac-ctrl-library') {
      return '空调控制库';
    }
    if (n === 'fan-speed') {
      return '风速';
    }
    if (n === 'auto-keep-warm') {
      return '自动保温';
    }
    if (n === 'keep-warm-time') {
      return '保温时间';
    }
    if (n === 'cook-mode') {
      return '烹饪模式';
    }
    if (n === 'heat-level') {
      return '加热档位';
    }
    if (n === 'electric-power') {
      return '功率';
    }
    if (n === 'air-quality') {
      return '空气质量';
    }
    if (n === 'fault') {
      return '故障';
    }
    if (n === 'status') {
      return '状态';
    }
    if (n === 'left-time') {
      return '剩余时间';
    }
    if (n === 'target-time') {
      return '目标时间';
    }
    if (n === 'working-time') {
      return '工作时间';
    }
    if (n === 'working-level') {
      return '工作档位';
    }
    if (n === 'playing-state') {
      return '播放状态';
    }
    if (n === 'audio-id') {
      return '音频';
    }
    if (n === 'lock-action') {
      return '开锁动作';
    }
    if (n === 'door-state') {
      return '门状态';
    }
    if (n === 'tank-status') {
      return '水箱状态';
    }
    if (n === 'run-status') {
      return '运行状态';
    }
    if (n === 'remote-controllable') {
      return '远程可控';
    }
    if (n === 'uv-status') {
      return '紫外线状态';
    }
    if (n === 'tds-in') {
      return '入水TDS';
    }
    if (n === 'tds-out') {
      return '出水TDS';
    }
    if (n === 'load-value') {
      return '负载';
    }
    if (n === 'moto-speed-rpm') {
      return '电机转速';
    }
    if (n === 'pot-lift-memory') {
      return '提锅记忆';
    }
    if (n === 'silent-execution') {
      return '静音执行';
    }
    if (n === 'extend-func-enabled') {
      return '扩展功能';
    }
    if (n === 'components-status') {
      return '组件状态';
    }
    if (n === 'ir-mode') {
      return '红外模式';
    }
    if (n === 'ir-temperature') {
      return '红外温度';
    }
    if (n === 'left-toggle') {
      return '左键';
    }
    if (n === 'right-toggle') {
      return '右键';
    }
    if (n === 'light') {
      return '灯光';
    }
    if (n === 'light-mode') {
      return '灯光模式';
    }
    if (n === 'memory') {
      return '记忆';
    }
    if (n === 'version') {
      return '版本';
    }
    if (n === 'firmware-revision') {
      return '固件版本';
    }
    if (n === 'count-down') {
      return '倒计时';
    }
    if (n === 'history-data') {
      return '历史数据';
    }
    if (n === 'start-time') {
      return '开始时间';
    }
    if (n === 'end-time') {
      return '结束时间';
    }
    if (n === 'duration') {
      return '时长';
    }
    if (n === 'current-time') {
      return '当前时间';
    }
    // 回退到 description（有些 description 是中文），再回退到 name
    return prop.description !== '' ? prop.description : n;
  }

  /** 只读属性值展示 */
  strDisplay(prop: MiCloud.SpecProperty): string {
    const v = this.propValues[`${prop.siid}.${prop.piid}`];
    if (v === undefined || v === null) {
      return '—';
    }
    if (v === true) {
      return '开';
    }
    if (v === false) {
      return '关';
    }
    if (typeof v === 'number') {
      return prop.unit !== '' ? `${v}${this.unitDisplay(prop.unit)}` : String(v);
    }
    return String(v);
  }

  /** 是否为数值类型格式 */
  isNumericFormat(format: string): boolean {
    return format === 'uint8' || format === 'uint16' || format === 'uint32'
      || format === 'int' || format === 'int8' || format === 'int16' || format === 'int32'
      || format === 'float' || format === 'double';
  }

  /** 状态区属性：只读的数值（温度/湿度/PM2.5/电量等），大数字展示 */
  statusProps(): MiCloud.SpecProperty[] {
    const result: MiCloud.SpecProperty[] = [];
    for (let i = 0; i < this.specProps.length; i++) {
      const p = this.specProps[i];
      if (!p.writable && this.isNumericFormat(p.format)) {
        result.push(p);
      }
    }
    return result;
  }

  /** 控制区属性：可写属性 */
  writableProps(): MiCloud.SpecProperty[] {
    const result: MiCloud.SpecProperty[] = [];
    for (let i = 0; i < this.specProps.length; i++) {
      if (this.specProps[i].writable) {
        result.push(this.specProps[i]);
      }
    }
    return result;
  }

  /** 信息区属性：只读的非数值（门状态/运行状态/播放状态等） */
  infoProps(): MiCloud.SpecProperty[] {
    const result: MiCloud.SpecProperty[] = [];
    for (let i = 0; i < this.specProps.length; i++) {
      const p = this.specProps[i];
      if (!p.writable && !this.isNumericFormat(p.format)) {
        result.push(p);
      }
    }
    return result;
  }

  /** 设备图标（emoji，与首页一致） */
  deviceIcon(type: string): string {
    if (type === 'light') {
      return '💡';
    }
    if (type === 'switch') {
      return '🔌';
    }
    if (type === 'sensor') {
      return '🌡️';
    }
    if (type === 'camera') {
      return '📷';
    }
    if (type === 'air_conditioner') {
      return '❄️';
    }
    if (type === 'air_purifier') {
      return '🍃';
    }
    if (type === 'water_purifier') {
      return '🚰';
    }
    if (type === 'humidifier') {
      return '💧';
    }
    if (type === 'desk') {
      return '🪑';
    }
    if (type === 'fan') {
      return '🌀';
    }
    if (type === 'heater') {
      return '🔥';
    }
    if (type === 'curtain') {
      return '🪟';
    }
    if (type === 'lock') {
      return '🔒';
    }
    if (type === 'washer') {
      return '🧺';
    }
    if (type === 'speaker') {
      return '🔊';
    }
    if (type === 'juicer') {
      return '🥤';
    }
    if (type === 'cooker') {
      return '🍳';
    }
    if (type === 'fridge') {
      return '🧊';
    }
    if (type === 'router') {
      return '📶';
    }
    return '📱';
  }

  /** 控制项（控制卡内）：可写 bool→开关行，可写数值+range→滑块列 */
  @Builder
  SpecPropControl(prop: MiCloud.SpecProperty) {
    if (prop.writable && prop.format === 'bool') {
      Row() {
        Text(this.propLabel(prop))
          .fontSize(16)
          .fontColor('#333333')
          .layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.boolValue(prop) })
          .selectedColor('#1677FF')
          .onChange((isOn: boolean) => {
            this.setProp(prop, isOn);
          })
      }
      .width('100%')
      .padding({ top: 13, bottom: 13 })
    } else if (prop.writable && prop.hasRange) {
      Column() {
        Row() {
          Text(this.propLabel(prop))
            .fontSize(16)
            .fontColor('#333333')
            .layoutWeight(1)
          Text(this.numDisplay(prop))
            .fontSize(14)
            .fontColor('#999999')
        }
        Slider({
          value: this.numValue(prop),
          min: prop.min,
          max: prop.max,
          step: prop.step,
          style: SliderStyle.OutSet
        })
          .selectedColor('#1677FF')
          .onChange((value: number, mode: SliderChangeMode) => {
            if (mode === SliderChangeMode.Moving) {
              this.updateValue(prop, Math.round(value));
            } else if (mode === SliderChangeMode.End || mode === SliderChangeMode.Click) {
              this.setProp(prop, Math.round(value));
            }
          })
          .margin({ top: 10 })
      }
      .width('100%')
      .padding({ top: 13, bottom: 13 })
    }
  }

  /** 状态卡内的大数字块 */
  @Builder
  StatusTile(prop: MiCloud.SpecProperty) {
    Column() {
      Text(this.strDisplay(prop))
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .fontColor('#1A1A1A')
      Text(this.propLabel(prop))
        .fontSize(12)
        .fontColor('#999999')
        .margin({ top: 4 })
    }
    .width('100%')
    .padding(12)
    .alignItems(HorizontalAlign.Center)
  }

  @Builder
  InfoRow(label: string, value: string) {
    Row() {
      Text(label).fontSize(14).fontColor('#999999').layoutWeight(1)
      Text(value).fontSize(14).fontColor('#333333')
    }
    .width('100%')
    .padding({ top: 10, bottom: 10 })
  }

  @Builder
  CardTitle(title: string) {
    Text(title)
      .fontSize(15)
      .fontWeight(FontWeight.Medium)
      .fontColor('#666666')
      .width('100%')
      .margin({ bottom: 6 })
  }

  // ==================== 台灯定制面板（philips.light.lite） ====================
  @Builder
  LightPanel() {
    // 主控制卡：电源
    Column() {
      Row() {
        Text(this.getBool(2, 1) ? '💡' : '🌑')
          .fontSize(52)
        Text(this.getBool(2, 1) ? '已开灯' : '已关灯')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.getBool(2, 1) ? '#FFB300' : '#999999')
          .margin({ left: 14 })
      }
      .margin({ bottom: 20 })
      Toggle({ type: ToggleType.Switch, isOn: this.getBool(2, 1) })
        .selectedColor('#FFB300')
        .onChange((isOn: boolean) => {
          this.setVal(2, 1, isOn);
        })
    }
    .width('100%')
    .padding(24)
    .backgroundColor('#FFFFFF')
    .borderRadius(16)
    .margin({ bottom: 12 })
    .alignItems(HorizontalAlign.Center)

    // 亮度卡
    Column() {
      this.CardTitle('亮度')
      Text(`${this.getNum(2, 2, 0)}%`)
        .fontSize(26)
        .fontWeight(FontWeight.Bold)
        .fontColor('#1A1A1A')
        .margin({ bottom: 4 })
      Slider({
        value: this.getNum(2, 2, 50),
        min: 1,
        max: 100,
        step: 1,
        style: SliderStyle.OutSet
      })
        .selectedColor('#FFB300')
        .onChange((value: number, mode: SliderChangeMode) => {
          if (mode === SliderChangeMode.Moving) {
            const next: Record<string, string | number | boolean> = {};
            const keys = Object.keys(this.propValues);
            for (let i = 0; i < keys.length; i++) {
              next[keys[i]] = this.propValues[keys[i]];
            }
            next['2.2'] = Math.round(value);
            this.propValues = next;
          } else if (mode === SliderChangeMode.End || mode === SliderChangeMode.Click) {
            this.setVal(2, 2, Math.round(value));
          }
        })
        .margin({ top: 6 })
    }
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .borderRadius(16)
    .margin({ bottom: 12 })
    .alignItems(HorizontalAlign.Start)

    // 场景模式卡
    Column() {
      this.CardTitle('场景模式')
      Grid() {
        ForEach(this.lightScenes(), (scene: SceneItem) => {
          GridItem() {
            this.SceneButton(scene)
          }
        })
      }
      .columnsTemplate('1fr 1fr 1fr 1fr')
      .columnsGap(8)
      .width('100%')
    }
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .borderRadius(16)
    .margin({ bottom: 12 })
    .alignItems(HorizontalAlign.Start)

    // 更多设置卡：夜灯 + 延时关灯
    Column() {
      this.CardTitle('更多设置')
      Row() {
        Text('夜灯')
          .fontSize(16)
          .fontColor('#333333')
          .layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.getBool(3, 4) })
          .selectedColor('#1677FF')
          .onChange((isOn: boolean) => {
            this.setVal(3, 4, isOn);
          })
      }
      .width('100%')
      .padding({ top: 10, bottom: 10 })

      Row() {
        Text('延时关灯')
          .fontSize(16)
          .fontColor('#333333')
          .layoutWeight(1)
        Text(this.delayLabel())
          .fontSize(14)
          .fontColor('#999999')
      }
      .width('100%')
      .padding({ top: 10, bottom: 6 })

      Grid() {
        ForEach(this.delayOptions(), (opt: SceneItem) => {
          GridItem() {
            this.DelayButton(opt)
          }
        })
      }
      .columnsTemplate('1fr 1fr 1fr 1fr 1fr')
      .columnsGap(6)
      .width('100%')
    }
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .borderRadius(16)
    .margin({ bottom: 12 })
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  SceneButton(scene: SceneItem) {
    Column() {
      Text(scene.icon)
        .fontSize(24)
      Text(scene.label)
        .fontSize(13)
        .fontColor(this.getNum(2, 3, -1) === scene.value ? '#FFB300' : '#333333')
        .margin({ top: 4 })
    }
    .width('100%')
    .padding({ top: 12, bottom: 12 })
    .backgroundColor(this.getNum(2, 3, -1) === scene.value ? '#FFF8E1' : '#F5F6F7')
    .borderRadius(10)
    .onClick(() => {
      this.setVal(2, 3, scene.value);
    })
  }

  @Builder
  DelayButton(opt: SceneItem) {
    Column() {
      Text(opt.label)
        .fontSize(12)
        .fontColor(this.getNum(3, 1, -1) === opt.value ? '#1677FF' : '#666666')
    }
    .width('100%')
    .padding({ top: 9, bottom: 9 })
    .backgroundColor(this.getNum(3, 1, -1) === opt.value ? '#E6F1FB' : '#F5F6F7')
    .borderRadius(8)
    .onClick(() => {
      this.setVal(3, 1, opt.value);
    })
  }

  // ==================== 升降桌定制面板（xlang.desk.vlocv2） ====================
  @Builder
  DeskPanel() {
    // 高度大数字卡
    Column() {
      Text('当前高度')
        .fontSize(14)
        .fontColor('#999999')
      Text(`${this.getNum(4, 1, 0)}`)
        .fontSize(56)
        .fontWeight(FontWeight.Bold)
        .fontColor('#1A1A1A')
      Text('mm')
        .fontSize(14)
        .fontColor('#999999')
        .margin({ top: 2 })
    }
    .width('100%')
    .padding(24)
    .backgroundColor('#FFFFFF')
    .borderRadius(16)
    .margin({ bottom: 12 })
    .alignItems(HorizontalAlign.Center)

    // 升降控制卡（长按升降、松手停）
    Column() {
      this.CardTitle('升降控制（按住升降，松手停止）')
      Row() {
        Button('↑ 上升')
          .layoutWeight(1)
          .height(56)
          .fontSize(17)
          .fontColor('#FFFFFF')
          .backgroundColor('#1677FF')
          .borderRadius(12)
          .margin({ right: 8 })
          .onTouch((event: TouchEvent) => {
            if (event.type === TouchType.Down) {
              this.sendMotor(1);
            } else if (event.type === TouchType.Up || event.type === TouchType.Cancel) {
              this.sendMotor(0);
            }
          })
        Button('↓ 下降')
          .layoutWeight(1)
          .height(56)
          .fontSize(17)
          .fontColor('#FFFFFF')
          .backgroundColor('#1677FF')
          .borderRadius(12)
          .margin({ left: 8 })
          .onTouch((event: TouchEvent) => {
            if (event.type === TouchType.Down) {
              this.sendMotor(2);
            } else if (event.type === TouchType.Up || event.type === TouchType.Cancel) {
              this.sendMotor(0);
            }
          })
      }
      .width('100%')
      .margin({ top: 10 })
    }
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .borderRadius(16)
    .margin({ bottom: 12 })
    .alignItems(HorizontalAlign.Start)

    // 记忆位卡
    Column() {
      this.CardTitle('记忆位（点击移到该高度）')
      Grid() {
        ForEach(this.deskMems(), (mem: MemoryItem) => {
          GridItem() {
            this.MemButton(mem)
          }
        })
      }
      .columnsTemplate('1fr 1fr')
      .columnsGap(10)
      .rowsGap(10)
      .width('100%')
    }
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .borderRadius(16)
    .margin({ bottom: 12 })
    .alignItems(HorizontalAlign.Start)

    // 设置卡：防夹灵敏度 + 复位
    Column() {
      this.CardTitle('设置')
      Text('防夹灵敏度')
        .fontSize(16)
        .fontColor('#333333')
        .width('100%')
        .margin({ top: 6 })
      Row() {
        ForEach(this.pinchLevels(), (lv: SceneItem) => {
          this.PinchButton(lv)
        })
      }
      .width('100%')
      .margin({ top: 10 })

      Row() {
        Text('复位')
          .fontSize(16)
          .fontColor('#333333')
          .layoutWeight(1)
        Text('点击复位')
          .fontSize(14)
          .fontColor('#1677FF')
          .onClick(() => {
            this.setVal(4, 3, 1);
          })
      }
      .width('100%')
      .padding({ top: 14, bottom: 4 })
    }
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .borderRadius(16)
    .margin({ bottom: 12 })
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  MemButton(mem: MemoryItem) {
    Row() {
      Text(mem.label)
        .fontSize(15)
        .fontColor('#333333')
        .layoutWeight(1)
      Text(`${this.getNum(4, mem.piid, 0)} mm`)
        .fontSize(14)
        .fontColor('#1677FF')
    }
    .width('100%')
    .padding(14)
    .backgroundColor('#F5F6F7')
    .borderRadius(10)
    .onClick(() => {
      this.setVal(2, 4, mem.value);
    })
  }

  @Builder
  PinchButton(lv: SceneItem) {
    Text(lv.label)
      .fontSize(14)
      .fontColor(this.getNum(4, 2, 2) === lv.value ? '#FFFFFF' : '#666666')
      .textAlign(TextAlign.Center)
      .width(70)
      .height(36)
      .backgroundColor(this.getNum(4, 2, 2) === lv.value ? '#1677FF' : '#F5F6F7')
      .borderRadius(18)
      .margin({ right: 10 })
      .onClick(() => {
        this.setVal(4, 2, lv.value);
      })
  }

  build() {
    Column() {
      Row() {
        Text('←')
          .fontSize(20)
          .onClick(() => { router.back(); })
        Text(this.deviceName())
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .margin({ left: 12 })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 12 })

      if (this.device !== null) {
        Scroll() {
          Column() {
            // 顶部卡：大图标 + 设备名 + 在线状态
            Column() {
              Text(this.deviceIcon(this.device.type))
                .fontSize(52)
              Text(this.device.name)
                .fontSize(20)
                .fontWeight(FontWeight.Bold)
                .fontColor('#1A1A1A')
                .margin({ top: 10 })
              Row() {
                Text('●')
                  .fontSize(8)
                  .fontColor(this.device.online ? '#52C41A' : '#BFBFBF')
                Text(this.device.online ? '在线' : '离线')
                  .fontSize(13)
                  .fontColor(this.device.online ? '#52C41A' : '#BFBFBF')
                  .margin({ left: 5 })
              }
              .margin({ top: 8 })
            }
            .width('100%')
            .padding(24)
            .backgroundColor('#FFFFFF')
            .borderRadius(16)
            .margin({ bottom: 12 })

            if (this.loading) {
              Column() {
                LoadingProgress()
                  .width(36)
                  .height(36)
                  .color('#1677FF')
              }
              .width('100%')
              .padding(30)
            } else if (this.isLight()) {
              // 台灯定制面板
              this.LightPanel()
            } else if (this.isDesk()) {
              // 升降桌定制面板
              this.DeskPanel()
            } else {
              // 状态卡：只读数值大数字（温度/湿度/PM2.5/电量）
              if (this.statusProps().length > 0) {
                Column() {
                  this.CardTitle('状态')
                  Grid() {
                    ForEach(this.statusProps(), (prop: MiCloud.SpecProperty) => {
                      GridItem() {
                        this.StatusTile(prop)
                      }
                    })
                  }
                  .columnsTemplate('1fr 1fr')
                  .columnsGap(8)
                  .rowsGap(8)
                }
                .width('100%')
                .padding(16)
                .backgroundColor('#FFFFFF')
                .borderRadius(16)
                .margin({ bottom: 12 })
                .alignItems(HorizontalAlign.Start)
              }

              // 控制卡：可写属性（开关/滑块）
              if (this.writableProps().length > 0) {
                Column() {
                  this.CardTitle('控制')
                  ForEach(this.writableProps(), (prop: MiCloud.SpecProperty) => {
                    this.SpecPropControl(prop)
                  })
                }
                .width('100%')
                .padding({ left: 16, right: 16, top: 16, bottom: 6 })
                .backgroundColor('#FFFFFF')
                .borderRadius(16)
                .margin({ bottom: 12 })
                .alignItems(HorizontalAlign.Start)
              }

              // 信息卡：只读非数值 + 设备信息
              Column() {
                this.CardTitle('设备信息')
                ForEach(this.infoProps(), (prop: MiCloud.SpecProperty) => {
                  this.InfoRow(this.propLabel(prop), this.strDisplay(prop))
                })
                this.InfoRow('设备 ID', this.device.did)
                this.InfoRow('型号', this.device.model)
              }
              .width('100%')
              .padding({ left: 16, right: 16, top: 16, bottom: 6 })
              .backgroundColor('#FFFFFF')
              .borderRadius(16)
              .margin({ bottom: 12 })
              .alignItems(HorizontalAlign.Start)
            }
          }
          .padding({ left: 16, right: 16, bottom: 20 })
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F5F6F7')
  }

  deviceName(): string {
    if (this.device === null) {
      return '设备';
    }
    return this.device.name;
  }
}
