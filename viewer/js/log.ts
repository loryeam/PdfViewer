function log(logger: (...data: string[]) => void, tag: string, msg: string) {
    logger(`${tag}: ${msg}`);
}

export class Log {
    static d(tag: string, msg: string) {
        log(console.debug, tag, msg);
    }

    static e(tag: string, msg: string) {
        log(console.error, tag, msg);
    }

    static i(tag: string, msg: string) {
        log(console.info, tag, msg);
    }

    static w(tag: string, msg: string) {
        log(console.warn, tag, msg);
    }
}
