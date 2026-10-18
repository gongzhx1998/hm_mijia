export class i {
    static readonly m: string = 'https://api.mijia.tech/app';
    static readonly KEY_TOKEN: string = 'mijia_token';
    static readonly o: string = 'mijia_user';
    static readonly t: string = 'mijia_current_home';
    static readonly u: string = 'mijia_cloud_devices';
    static readonly a1: string = 'mijia_scenes';
}
export class j {
    static readonly b1: number = 0x0000;
    static info(tag: string, msg: string): void {
        console.info(`[${tag}] ${msg}`);
    }
    static error(tag: string, msg: string): void {
        console.error(`[${tag}] ${msg}`);
    }
}
