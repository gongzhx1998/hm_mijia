if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface DeviceControl_Params {
    device?: Device | null;
    specProps?: MiCloud.SpecProperty[];
    propValues?: Record<string, string | number | boolean>;
    busy?: boolean;
    loading?: boolean;
    did?: string;
}
import router from "@ohos:router";
import promptAction from "@ohos:promptAction";
import * as ApiService from "@normalized:N&&&entry/src/main/ets/service/ApiService&";
import * as MiCloud from "@normalized:N&&&entry/src/main/ets/service/MiCloud&";
import type { Device } from '../model/Models';
import { Logger } from "@normalized:N&&&entry/src/main/ets/common/AppConfig&";
const TAG = 'DeviceControl';
/** 台灯场景模式项 */
interface SceneItem {
    value: number;
    label: string;
    icon: string;
}
/** 升降桌记忆位项 */
interface MemoryItem {
    value: number; // mode 值（1-4 对应 Mem1-Mem4）
    piid: number; // mem-one/two/three/four 的 piid（4-7）
    label: string;
}
class DeviceControl extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__device = new ObservedPropertyObjectPU(null, this, "device");
        this.__specProps = new ObservedPropertyObjectPU([], this, "specProps");
        this.__propValues = new ObservedPropertyObjectPU({}, this, "propValues");
        this.__busy = new ObservedPropertySimplePU(false, this, "busy");
        this.__loading = new ObservedPropertySimplePU(false, this, "loading");
        this.did = '';
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: DeviceControl_Params) {
        if (params.device !== undefined) {
            this.device = params.device;
        }
        if (params.specProps !== undefined) {
            this.specProps = params.specProps;
        }
        if (params.propValues !== undefined) {
            this.propValues = params.propValues;
        }
        if (params.busy !== undefined) {
            this.busy = params.busy;
        }
        if (params.loading !== undefined) {
            this.loading = params.loading;
        }
        if (params.did !== undefined) {
            this.did = params.did;
        }
    }
    updateStateVars(params: DeviceControl_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__device.purgeDependencyOnElmtId(rmElmtId);
        this.__specProps.purgeDependencyOnElmtId(rmElmtId);
        this.__propValues.purgeDependencyOnElmtId(rmElmtId);
        this.__busy.purgeDependencyOnElmtId(rmElmtId);
        this.__loading.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__device.aboutToBeDeleted();
        this.__specProps.aboutToBeDeleted();
        this.__propValues.aboutToBeDeleted();
        this.__busy.aboutToBeDeleted();
        this.__loading.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __device: ObservedPropertyObjectPU<Device | null>;
    get device() {
        return this.__device.get();
    }
    set device(newValue: Device | null) {
        this.__device.set(newValue);
    }
    private __specProps: ObservedPropertyObjectPU<MiCloud.SpecProperty[]>;
    get specProps() {
        return this.__specProps.get();
    }
    set specProps(newValue: MiCloud.SpecProperty[]) {
        this.__specProps.set(newValue);
    }
    private __propValues: ObservedPropertyObjectPU<Record<string, string | number | boolean>>;
    get propValues() {
        return this.__propValues.get();
    }
    set propValues(newValue: Record<string, string | number | boolean>) {
        this.__propValues.set(newValue);
    }
    private __busy: ObservedPropertySimplePU<boolean>;
    get busy() {
        return this.__busy.get();
    }
    set busy(newValue: boolean) {
        this.__busy.set(newValue);
    }
    private __loading: ObservedPropertySimplePU<boolean>;
    get loading() {
        return this.__loading.get();
    }
    set loading(newValue: boolean) {
        this.__loading.set(newValue);
    }
    private did: string;
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
        }
        catch (e) {
            Logger.error(TAG, `loadSpec failed: ${e}`);
        }
        finally {
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
        }
        catch (e) {
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
        }
        catch (e) {
            Logger.error(TAG, `setProp ${prop.siid}.${prop.piid} failed: ${e}`);
            promptAction.showToast({ message: '指令发送失败，请检查设备状态' });
        }
        finally {
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
        }
        catch (e) {
            Logger.error(TAG, `setVal ${siid}.${piid} failed: ${e}`);
            promptAction.showToast({ message: '指令发送失败，请检查设备状态' });
        }
        finally {
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
        }
        catch (e) {
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
    SpecPropControl(prop: MiCloud.SpecProperty, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (prop.writable && prop.format === 'bool') {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width('100%');
                        Row.padding({ top: 13, bottom: 13 });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.propLabel(prop));
                        Text.fontSize(16);
                        Text.fontColor('#333333');
                        Text.layoutWeight(1);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Toggle.create({ type: ToggleType.Switch, isOn: this.boolValue(prop) });
                        Toggle.selectedColor('#1677FF');
                        Toggle.onChange((isOn: boolean) => {
                            this.setProp(prop, isOn);
                        });
                    }, Toggle);
                    Toggle.pop();
                    Row.pop();
                });
            }
            else if (prop.writable && prop.hasRange) {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.padding({ top: 13, bottom: 13 });
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.propLabel(prop));
                        Text.fontSize(16);
                        Text.fontColor('#333333');
                        Text.layoutWeight(1);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.numDisplay(prop));
                        Text.fontSize(14);
                        Text.fontColor('#999999');
                    }, Text);
                    Text.pop();
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Slider.create({
                            value: this.numValue(prop),
                            min: prop.min,
                            max: prop.max,
                            step: prop.step,
                            style: SliderStyle.OutSet
                        });
                        Slider.selectedColor('#1677FF');
                        Slider.onChange((value: number, mode: SliderChangeMode) => {
                            if (mode === SliderChangeMode.Moving) {
                                this.updateValue(prop, Math.round(value));
                            }
                            else if (mode === SliderChangeMode.End || mode === SliderChangeMode.Click) {
                                this.setProp(prop, Math.round(value));
                            }
                        });
                        Slider.margin({ top: 10 });
                    }, Slider);
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(2, () => {
                });
            }
        }, If);
        If.pop();
    }
    /** 状态卡内的大数字块 */
    StatusTile(prop: MiCloud.SpecProperty, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.padding(12);
            Column.alignItems(HorizontalAlign.Center);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.strDisplay(prop));
            Text.fontSize(24);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor('#1A1A1A');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.propLabel(prop));
            Text.fontSize(12);
            Text.fontColor('#999999');
            Text.margin({ top: 4 });
        }, Text);
        Text.pop();
        Column.pop();
    }
    InfoRow(label: string, value: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ top: 10, bottom: 10 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(label);
            Text.fontSize(14);
            Text.fontColor('#999999');
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(value);
            Text.fontSize(14);
            Text.fontColor('#333333');
        }, Text);
        Text.pop();
        Row.pop();
    }
    CardTitle(title: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(title);
            Text.fontSize(15);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor('#666666');
            Text.width('100%');
            Text.margin({ bottom: 6 });
        }, Text);
        Text.pop();
    }
    // ==================== 台灯定制面板（philips.light.lite） ====================
    LightPanel(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 主控制卡：电源
            Column.create();
            // 主控制卡：电源
            Column.width('100%');
            // 主控制卡：电源
            Column.padding(24);
            // 主控制卡：电源
            Column.backgroundColor('#FFFFFF');
            // 主控制卡：电源
            Column.borderRadius(16);
            // 主控制卡：电源
            Column.margin({ bottom: 12 });
            // 主控制卡：电源
            Column.alignItems(HorizontalAlign.Center);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.margin({ bottom: 20 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.getBool(2, 1) ? '💡' : '🌑');
            Text.fontSize(52);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.getBool(2, 1) ? '已开灯' : '已关灯');
            Text.fontSize(20);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.getBool(2, 1) ? '#FFB300' : '#999999');
            Text.margin({ left: 14 });
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Toggle.create({ type: ToggleType.Switch, isOn: this.getBool(2, 1) });
            Toggle.selectedColor('#FFB300');
            Toggle.onChange((isOn: boolean) => {
                this.setVal(2, 1, isOn);
            });
        }, Toggle);
        Toggle.pop();
        // 主控制卡：电源
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 亮度卡
            Column.create();
            // 亮度卡
            Column.width('100%');
            // 亮度卡
            Column.padding(16);
            // 亮度卡
            Column.backgroundColor('#FFFFFF');
            // 亮度卡
            Column.borderRadius(16);
            // 亮度卡
            Column.margin({ bottom: 12 });
            // 亮度卡
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.CardTitle.bind(this)('亮度');
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(`${this.getNum(2, 2, 0)}%`);
            Text.fontSize(26);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor('#1A1A1A');
            Text.margin({ bottom: 4 });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Slider.create({
                value: this.getNum(2, 2, 50),
                min: 1,
                max: 100,
                step: 1,
                style: SliderStyle.OutSet
            });
            Slider.selectedColor('#FFB300');
            Slider.onChange((value: number, mode: SliderChangeMode) => {
                if (mode === SliderChangeMode.Moving) {
                    const next: Record<string, string | number | boolean> = {};
                    const keys = Object.keys(ObservedObject.GetRawObject(this.propValues));
                    for (let i = 0; i < keys.length; i++) {
                        next[keys[i]] = this.propValues[keys[i]];
                    }
                    next['2.2'] = Math.round(value);
                    this.propValues = next;
                }
                else if (mode === SliderChangeMode.End || mode === SliderChangeMode.Click) {
                    this.setVal(2, 2, Math.round(value));
                }
            });
            Slider.margin({ top: 6 });
        }, Slider);
        // 亮度卡
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 场景模式卡
            Column.create();
            // 场景模式卡
            Column.width('100%');
            // 场景模式卡
            Column.padding(16);
            // 场景模式卡
            Column.backgroundColor('#FFFFFF');
            // 场景模式卡
            Column.borderRadius(16);
            // 场景模式卡
            Column.margin({ bottom: 12 });
            // 场景模式卡
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.CardTitle.bind(this)('场景模式');
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Grid.create();
            Grid.columnsTemplate('1fr 1fr 1fr 1fr');
            Grid.columnsGap(8);
            Grid.width('100%');
        }, Grid);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const scene = _item;
                {
                    const itemCreation2 = (elmtId, isInitialRender) => {
                        GridItem.create(() => { }, false);
                    };
                    const observedDeepRender = () => {
                        this.observeComponentCreation2(itemCreation2, GridItem);
                        this.SceneButton.bind(this)(scene);
                        GridItem.pop();
                    };
                    observedDeepRender();
                }
            };
            this.forEachUpdateFunction(elmtId, this.lightScenes(), forEachItemGenFunction);
        }, ForEach);
        ForEach.pop();
        Grid.pop();
        // 场景模式卡
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 更多设置卡：夜灯 + 延时关灯
            Column.create();
            // 更多设置卡：夜灯 + 延时关灯
            Column.width('100%');
            // 更多设置卡：夜灯 + 延时关灯
            Column.padding(16);
            // 更多设置卡：夜灯 + 延时关灯
            Column.backgroundColor('#FFFFFF');
            // 更多设置卡：夜灯 + 延时关灯
            Column.borderRadius(16);
            // 更多设置卡：夜灯 + 延时关灯
            Column.margin({ bottom: 12 });
            // 更多设置卡：夜灯 + 延时关灯
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.CardTitle.bind(this)('更多设置');
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ top: 10, bottom: 10 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('夜灯');
            Text.fontSize(16);
            Text.fontColor('#333333');
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Toggle.create({ type: ToggleType.Switch, isOn: this.getBool(3, 4) });
            Toggle.selectedColor('#1677FF');
            Toggle.onChange((isOn: boolean) => {
                this.setVal(3, 4, isOn);
            });
        }, Toggle);
        Toggle.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ top: 10, bottom: 6 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('延时关灯');
            Text.fontSize(16);
            Text.fontColor('#333333');
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.delayLabel());
            Text.fontSize(14);
            Text.fontColor('#999999');
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Grid.create();
            Grid.columnsTemplate('1fr 1fr 1fr 1fr 1fr');
            Grid.columnsGap(6);
            Grid.width('100%');
        }, Grid);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const opt = _item;
                {
                    const itemCreation2 = (elmtId, isInitialRender) => {
                        GridItem.create(() => { }, false);
                    };
                    const observedDeepRender = () => {
                        this.observeComponentCreation2(itemCreation2, GridItem);
                        this.DelayButton.bind(this)(opt);
                        GridItem.pop();
                    };
                    observedDeepRender();
                }
            };
            this.forEachUpdateFunction(elmtId, this.delayOptions(), forEachItemGenFunction);
        }, ForEach);
        ForEach.pop();
        Grid.pop();
        // 更多设置卡：夜灯 + 延时关灯
        Column.pop();
    }
    SceneButton(scene: SceneItem, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.padding({ top: 12, bottom: 12 });
            Column.backgroundColor(this.getNum(2, 3, -1) === scene.value ? '#FFF8E1' : '#F5F6F7');
            Column.borderRadius(10);
            Column.onClick(() => {
                this.setVal(2, 3, scene.value);
            });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(scene.icon);
            Text.fontSize(24);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(scene.label);
            Text.fontSize(13);
            Text.fontColor(this.getNum(2, 3, -1) === scene.value ? '#FFB300' : '#333333');
            Text.margin({ top: 4 });
        }, Text);
        Text.pop();
        Column.pop();
    }
    DelayButton(opt: SceneItem, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.padding({ top: 9, bottom: 9 });
            Column.backgroundColor(this.getNum(3, 1, -1) === opt.value ? '#E6F1FB' : '#F5F6F7');
            Column.borderRadius(8);
            Column.onClick(() => {
                this.setVal(3, 1, opt.value);
            });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(opt.label);
            Text.fontSize(12);
            Text.fontColor(this.getNum(3, 1, -1) === opt.value ? '#1677FF' : '#666666');
        }, Text);
        Text.pop();
        Column.pop();
    }
    // ==================== 升降桌定制面板（xlang.desk.vlocv2） ====================
    DeskPanel(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 高度大数字卡
            Column.create();
            // 高度大数字卡
            Column.width('100%');
            // 高度大数字卡
            Column.padding(24);
            // 高度大数字卡
            Column.backgroundColor('#FFFFFF');
            // 高度大数字卡
            Column.borderRadius(16);
            // 高度大数字卡
            Column.margin({ bottom: 12 });
            // 高度大数字卡
            Column.alignItems(HorizontalAlign.Center);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('当前高度');
            Text.fontSize(14);
            Text.fontColor('#999999');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(`${this.getNum(4, 1, 0)}`);
            Text.fontSize(56);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor('#1A1A1A');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('mm');
            Text.fontSize(14);
            Text.fontColor('#999999');
            Text.margin({ top: 2 });
        }, Text);
        Text.pop();
        // 高度大数字卡
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 升降控制卡（长按升降、松手停）
            Column.create();
            // 升降控制卡（长按升降、松手停）
            Column.width('100%');
            // 升降控制卡（长按升降、松手停）
            Column.padding(16);
            // 升降控制卡（长按升降、松手停）
            Column.backgroundColor('#FFFFFF');
            // 升降控制卡（长按升降、松手停）
            Column.borderRadius(16);
            // 升降控制卡（长按升降、松手停）
            Column.margin({ bottom: 12 });
            // 升降控制卡（长按升降、松手停）
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.CardTitle.bind(this)('升降控制（按住升降，松手停止）');
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.margin({ top: 10 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('↑ 上升');
            Button.layoutWeight(1);
            Button.height(56);
            Button.fontSize(17);
            Button.fontColor('#FFFFFF');
            Button.backgroundColor('#1677FF');
            Button.borderRadius(12);
            Button.margin({ right: 8 });
            Button.onTouch((event: TouchEvent) => {
                if (event.type === TouchType.Down) {
                    this.sendMotor(1);
                }
                else if (event.type === TouchType.Up || event.type === TouchType.Cancel) {
                    this.sendMotor(0);
                }
            });
        }, Button);
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('↓ 下降');
            Button.layoutWeight(1);
            Button.height(56);
            Button.fontSize(17);
            Button.fontColor('#FFFFFF');
            Button.backgroundColor('#1677FF');
            Button.borderRadius(12);
            Button.margin({ left: 8 });
            Button.onTouch((event: TouchEvent) => {
                if (event.type === TouchType.Down) {
                    this.sendMotor(2);
                }
                else if (event.type === TouchType.Up || event.type === TouchType.Cancel) {
                    this.sendMotor(0);
                }
            });
        }, Button);
        Button.pop();
        Row.pop();
        // 升降控制卡（长按升降、松手停）
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 记忆位卡
            Column.create();
            // 记忆位卡
            Column.width('100%');
            // 记忆位卡
            Column.padding(16);
            // 记忆位卡
            Column.backgroundColor('#FFFFFF');
            // 记忆位卡
            Column.borderRadius(16);
            // 记忆位卡
            Column.margin({ bottom: 12 });
            // 记忆位卡
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.CardTitle.bind(this)('记忆位（点击移到该高度）');
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Grid.create();
            Grid.columnsTemplate('1fr 1fr');
            Grid.columnsGap(10);
            Grid.rowsGap(10);
            Grid.width('100%');
        }, Grid);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const mem = _item;
                {
                    const itemCreation2 = (elmtId, isInitialRender) => {
                        GridItem.create(() => { }, false);
                    };
                    const observedDeepRender = () => {
                        this.observeComponentCreation2(itemCreation2, GridItem);
                        this.MemButton.bind(this)(mem);
                        GridItem.pop();
                    };
                    observedDeepRender();
                }
            };
            this.forEachUpdateFunction(elmtId, this.deskMems(), forEachItemGenFunction);
        }, ForEach);
        ForEach.pop();
        Grid.pop();
        // 记忆位卡
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 设置卡：防夹灵敏度 + 复位
            Column.create();
            // 设置卡：防夹灵敏度 + 复位
            Column.width('100%');
            // 设置卡：防夹灵敏度 + 复位
            Column.padding(16);
            // 设置卡：防夹灵敏度 + 复位
            Column.backgroundColor('#FFFFFF');
            // 设置卡：防夹灵敏度 + 复位
            Column.borderRadius(16);
            // 设置卡：防夹灵敏度 + 复位
            Column.margin({ bottom: 12 });
            // 设置卡：防夹灵敏度 + 复位
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.CardTitle.bind(this)('设置');
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('防夹灵敏度');
            Text.fontSize(16);
            Text.fontColor('#333333');
            Text.width('100%');
            Text.margin({ top: 6 });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.margin({ top: 10 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const lv = _item;
                this.PinchButton.bind(this)(lv);
            };
            this.forEachUpdateFunction(elmtId, this.pinchLevels(), forEachItemGenFunction);
        }, ForEach);
        ForEach.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ top: 14, bottom: 4 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('复位');
            Text.fontSize(16);
            Text.fontColor('#333333');
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('点击复位');
            Text.fontSize(14);
            Text.fontColor('#1677FF');
            Text.onClick(() => {
                this.setVal(4, 3, 1);
            });
        }, Text);
        Text.pop();
        Row.pop();
        // 设置卡：防夹灵敏度 + 复位
        Column.pop();
    }
    MemButton(mem: MemoryItem, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding(14);
            Row.backgroundColor('#F5F6F7');
            Row.borderRadius(10);
            Row.onClick(() => {
                this.setVal(2, 4, mem.value);
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(mem.label);
            Text.fontSize(15);
            Text.fontColor('#333333');
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(`${this.getNum(4, mem.piid, 0)} mm`);
            Text.fontSize(14);
            Text.fontColor('#1677FF');
        }, Text);
        Text.pop();
        Row.pop();
    }
    PinchButton(lv: SceneItem, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(lv.label);
            Text.fontSize(14);
            Text.fontColor(this.getNum(4, 2, 2) === lv.value ? '#FFFFFF' : '#666666');
            Text.textAlign(TextAlign.Center);
            Text.width(70);
            Text.height(36);
            Text.backgroundColor(this.getNum(4, 2, 2) === lv.value ? '#1677FF' : '#F5F6F7');
            Text.borderRadius(18);
            Text.margin({ right: 10 });
            Text.onClick(() => {
                this.setVal(4, 2, lv.value);
            });
        }, Text);
        Text.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor('#F5F6F7');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ left: 16, right: 16, top: 14, bottom: 12 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('←');
            Text.fontSize(20);
            Text.onClick(() => { router.back(); });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.deviceName());
            Text.fontSize(18);
            Text.fontWeight(FontWeight.Medium);
            Text.margin({ left: 12 });
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.device !== null) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Scroll.create();
                        Scroll.layoutWeight(1);
                        Scroll.scrollBar(BarState.Off);
                    }, Scroll);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.padding({ left: 16, right: 16, bottom: 20 });
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        // 顶部卡：大图标 + 设备名 + 在线状态
                        Column.create();
                        // 顶部卡：大图标 + 设备名 + 在线状态
                        Column.width('100%');
                        // 顶部卡：大图标 + 设备名 + 在线状态
                        Column.padding(24);
                        // 顶部卡：大图标 + 设备名 + 在线状态
                        Column.backgroundColor('#FFFFFF');
                        // 顶部卡：大图标 + 设备名 + 在线状态
                        Column.borderRadius(16);
                        // 顶部卡：大图标 + 设备名 + 在线状态
                        Column.margin({ bottom: 12 });
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.deviceIcon(this.device.type));
                        Text.fontSize(52);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.device.name);
                        Text.fontSize(20);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor('#1A1A1A');
                        Text.margin({ top: 10 });
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.margin({ top: 8 });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('●');
                        Text.fontSize(8);
                        Text.fontColor(this.device.online ? '#52C41A' : '#BFBFBF');
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.device.online ? '在线' : '离线');
                        Text.fontSize(13);
                        Text.fontColor(this.device.online ? '#52C41A' : '#BFBFBF');
                        Text.margin({ left: 5 });
                    }, Text);
                    Text.pop();
                    Row.pop();
                    // 顶部卡：大图标 + 设备名 + 在线状态
                    Column.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width('100%');
                        Row.padding(14);
                        Row.backgroundColor('#FFFFFF');
                        Row.borderRadius(12);
                        Row.margin({ bottom: 12 });
                        Row.onClick(() => {
                            if (this.device !== null) {
                                const params: Record<string, string> = {
                                    'did': this.device.did,
                                    'model': this.device.model,
                                    'name': this.device.name
                                };
                                router.pushUrl({ url: 'pages/PluginHost', params: params });
                            }
                        });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('米家原版插件（实验）');
                        Text.fontSize(14);
                        Text.fontColor('#1677FF');
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(' ›');
                        Text.fontSize(14);
                        Text.fontColor('#1677FF');
                    }, Text);
                    Text.pop();
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.loading) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Column.create();
                                    Column.width('100%');
                                    Column.padding(30);
                                }, Column);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    LoadingProgress.create();
                                    LoadingProgress.width(36);
                                    LoadingProgress.height(36);
                                    LoadingProgress.color('#1677FF');
                                }, LoadingProgress);
                                Column.pop();
                            });
                        }
                        else if (this.isLight()) {
                            this.ifElseBranchUpdateFunction(1, () => {
                                // 台灯定制面板
                                this.LightPanel.bind(this)();
                            });
                        }
                        else if (this.isDesk()) {
                            this.ifElseBranchUpdateFunction(2, () => {
                                // 升降桌定制面板
                                this.DeskPanel.bind(this)();
                            });
                        }
                        else {
                            this.ifElseBranchUpdateFunction(3, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    If.create();
                                    // 状态卡：只读数值大数字（温度/湿度/PM2.5/电量）
                                    if (this.statusProps().length > 0) {
                                        this.ifElseBranchUpdateFunction(0, () => {
                                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                Column.create();
                                                Column.width('100%');
                                                Column.padding(16);
                                                Column.backgroundColor('#FFFFFF');
                                                Column.borderRadius(16);
                                                Column.margin({ bottom: 12 });
                                                Column.alignItems(HorizontalAlign.Start);
                                            }, Column);
                                            this.CardTitle.bind(this)('状态');
                                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                Grid.create();
                                                Grid.columnsTemplate('1fr 1fr');
                                                Grid.columnsGap(8);
                                                Grid.rowsGap(8);
                                            }, Grid);
                                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                ForEach.create();
                                                const forEachItemGenFunction = _item => {
                                                    const prop = _item;
                                                    {
                                                        const itemCreation2 = (elmtId, isInitialRender) => {
                                                            GridItem.create(() => { }, false);
                                                        };
                                                        const observedDeepRender = () => {
                                                            this.observeComponentCreation2(itemCreation2, GridItem);
                                                            this.StatusTile.bind(this)(prop);
                                                            GridItem.pop();
                                                        };
                                                        observedDeepRender();
                                                    }
                                                };
                                                this.forEachUpdateFunction(elmtId, this.statusProps(), forEachItemGenFunction);
                                            }, ForEach);
                                            ForEach.pop();
                                            Grid.pop();
                                            Column.pop();
                                        });
                                    }
                                    // 控制卡：可写属性（开关/滑块）
                                    else {
                                        this.ifElseBranchUpdateFunction(1, () => {
                                        });
                                    }
                                }, If);
                                If.pop();
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    If.create();
                                    // 控制卡：可写属性（开关/滑块）
                                    if (this.writableProps().length > 0) {
                                        this.ifElseBranchUpdateFunction(0, () => {
                                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                Column.create();
                                                Column.width('100%');
                                                Column.padding({ left: 16, right: 16, top: 16, bottom: 6 });
                                                Column.backgroundColor('#FFFFFF');
                                                Column.borderRadius(16);
                                                Column.margin({ bottom: 12 });
                                                Column.alignItems(HorizontalAlign.Start);
                                            }, Column);
                                            this.CardTitle.bind(this)('控制');
                                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                ForEach.create();
                                                const forEachItemGenFunction = _item => {
                                                    const prop = _item;
                                                    this.SpecPropControl.bind(this)(prop);
                                                };
                                                this.forEachUpdateFunction(elmtId, this.writableProps(), forEachItemGenFunction);
                                            }, ForEach);
                                            ForEach.pop();
                                            Column.pop();
                                        });
                                    }
                                    // 信息卡：只读非数值 + 设备信息
                                    else {
                                        this.ifElseBranchUpdateFunction(1, () => {
                                        });
                                    }
                                }, If);
                                If.pop();
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    // 信息卡：只读非数值 + 设备信息
                                    Column.create();
                                    // 信息卡：只读非数值 + 设备信息
                                    Column.width('100%');
                                    // 信息卡：只读非数值 + 设备信息
                                    Column.padding({ left: 16, right: 16, top: 16, bottom: 6 });
                                    // 信息卡：只读非数值 + 设备信息
                                    Column.backgroundColor('#FFFFFF');
                                    // 信息卡：只读非数值 + 设备信息
                                    Column.borderRadius(16);
                                    // 信息卡：只读非数值 + 设备信息
                                    Column.margin({ bottom: 12 });
                                    // 信息卡：只读非数值 + 设备信息
                                    Column.alignItems(HorizontalAlign.Start);
                                }, Column);
                                this.CardTitle.bind(this)('设备信息');
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    ForEach.create();
                                    const forEachItemGenFunction = _item => {
                                        const prop = _item;
                                        this.InfoRow.bind(this)(this.propLabel(prop), this.strDisplay(prop));
                                    };
                                    this.forEachUpdateFunction(elmtId, this.infoProps(), forEachItemGenFunction);
                                }, ForEach);
                                ForEach.pop();
                                this.InfoRow.bind(this)('设备 ID', this.device.did);
                                this.InfoRow.bind(this)('型号', this.device.model);
                                // 信息卡：只读非数值 + 设备信息
                                Column.pop();
                            });
                        }
                    }, If);
                    If.pop();
                    Column.pop();
                    Scroll.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        Column.pop();
    }
    deviceName(): string {
        if (this.device === null) {
            return '设备';
        }
        return this.device.name;
    }
    rerender() {
        this.updateDirtyElements();
    }
    public __resetStateVarsOnReuse__Internal(params: Object): void {
    }
    static getEntryName(): string {
        return "DeviceControl";
    }
}
registerNamedRoute(() => new DeviceControl(undefined, {}), "", { bundleName: "com.mijia.hm", moduleName: "entry", pagePath: "pages/DeviceControl", pageFullPath: "entry/src/main/ets/pages/DeviceControl", integratedHsp: "false", moduleType: "followWithHap" });
