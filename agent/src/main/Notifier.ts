/**
 * Notifier - Windows toast notifications for upload events
 */

import notifier from 'node-notifier';
import path from 'path';

export class Notifier {
    private appName = 'Silent Manager Agent';
    private iconPath: string;

    constructor(iconPath?: string) {
        this.iconPath = iconPath || path.join(__dirname, '../../assets/icon.png');
    }

    /**
     * Show success notification
     */
    success(title: string, message: string): void {
        notifier.notify({
            title: title,
            message: message,
            icon: this.iconPath,
            appID: this.appName,
            sound: false
        });
    }

    /**
     * Show error notification
     */
    error(title: string, message: string): void {
        notifier.notify({
            title: `⚠️ ${title}`,
            message: message,
            icon: this.iconPath,
            appID: this.appName,
            sound: true
        });
    }

    /**
     * Show info notification
     */
    info(title: string, message: string): void {
        notifier.notify({
            title: title,
            message: message,
            icon: this.iconPath,
            appID: this.appName,
            sound: false
        });
    }

    /**
     * Notify successful upload
     */
    uploadSuccess(fileName: string, storeName: string): void {
        this.success(
            'Shift Report Uploaded',
            `${fileName} uploaded to ${storeName}`
        );
    }

    /**
     * Notify failed upload
     */
    uploadFailed(fileName: string, error: string): void {
        this.error(
            'Upload Failed',
            `${fileName}: ${error}`
        );
    }

    /**
     * Notify agent connected
     */
    connected(storeName: string): void {
        this.success(
            'Agent Connected',
            `Now monitoring files for ${storeName}`
        );
    }

    /**
     * Notify agent disconnected
     */
    disconnected(reason: string): void {
        this.error(
            'Connection Lost',
            reason
        );
    }
}
