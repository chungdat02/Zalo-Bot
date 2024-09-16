// src/core/handleEvent.js

const { readdirSync } = require("fs");
const path = require('path');
const logger = require('../utils/logger'); // Nhập logger

module.exports = () => {
    const client = global.client;
    const eventPath = path.join(__dirname, '..', 'modules', 'events');
    const eventFile = readdirSync(eventPath).filter(File => File.endsWith('.js'));
    let eventCount = 0,
        onloadCount = 0,
        anyEventCount = 0;

    for (const File of eventFile) {
        delete require.cache[require.resolve(path.join(eventPath, File))];
        const event = require(path.join(eventPath, File));
        if (!event.config.name) return;

        if (event.run) {
            client.events.set(event.config.name, event);
            eventCount++;
        }

        if (event.onload) {
            onloadCount++;
        }

        if (event.anyEvent) {
            anyEventCount++;
        }
    }

    logger.info('Đã load thành công', eventCount, 'lệnh:'/*, onloadCount, 'lệnh onload,', anyEventCount, 'lệnh anyEvent.'*/);
};
