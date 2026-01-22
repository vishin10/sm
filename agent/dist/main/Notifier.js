"use strict";
/**
 * Notifier - Windows toast notifications for upload events
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notifier = void 0;
const node_notifier_1 = __importDefault(require("node-notifier"));
const path_1 = __importDefault(require("path"));
class Notifier {
    constructor(iconPath) {
        this.appName = 'Silent Manager Agent';
        this.iconPath = iconPath || path_1.default.join(__dirname, '../../assets/icon.png');
    }
    /**
     * Show success notification
     */
    success(title, message) {
        node_notifier_1.default.notify({
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
    error(title, message) {
        node_notifier_1.default.notify({
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
    info(title, message) {
        node_notifier_1.default.notify({
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
    uploadSuccess(fileName, storeName) {
        this.success('Shift Report Uploaded', `${fileName} uploaded to ${storeName}`);
    }
    /**
     * Notify failed upload
     */
    uploadFailed(fileName, error) {
        this.error('Upload Failed', `${fileName}: ${error}`);
    }
    /**
     * Notify agent connected
     */
    connected(storeName) {
        this.success('Agent Connected', `Now monitoring files for ${storeName}`);
    }
    /**
     * Notify agent disconnected
     */
    disconnected(reason) {
        this.error('Connection Lost', reason);
    }
}
exports.Notifier = Notifier;
//# sourceMappingURL=Notifier.js.map