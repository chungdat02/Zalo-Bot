// Định nghĩa CallbacksMap
class CallbacksMap extends Map {
    /**
     * @param {number} ttl - Thời gian sống của callback (ms). Mặc định là 5 phút.
     */
    set(key, value, ttl = 5 * 60 * 1000) {
        setTimeout(() => {
            this.delete(key);
        }, ttl);
        return super.set(key, value);
    }
}

// Export CallbacksMap và các đối tượng khác
export { CallbacksMap };

// Khởi tạo và export appContext
export const appContext = {
    uploadCallbacks: new CallbacksMap(),
    options: {
        selfListen: false,
        checkUpdate: true,
    },
};
