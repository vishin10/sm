/**
 * Notifier - Windows toast notifications for upload events
 */
export declare class Notifier {
    private appName;
    private iconPath;
    constructor(iconPath?: string);
    /**
     * Show success notification
     */
    success(title: string, message: string): void;
    /**
     * Show error notification
     */
    error(title: string, message: string): void;
    /**
     * Show info notification
     */
    info(title: string, message: string): void;
    /**
     * Notify successful upload
     */
    uploadSuccess(fileName: string, storeName: string): void;
    /**
     * Notify failed upload
     */
    uploadFailed(fileName: string, error: string): void;
    /**
     * Notify agent connected
     */
    connected(storeName: string): void;
    /**
     * Notify agent disconnected
     */
    disconnected(reason: string): void;
}
//# sourceMappingURL=Notifier.d.ts.map