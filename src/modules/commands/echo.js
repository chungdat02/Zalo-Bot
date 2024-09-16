module.exports = {
    config: {
        name: "a",
        version: "24.10",
        credits: "a",
        description: "",
        tag: "bot",
        usage: "",
        countDown: 700,
        role: 3,
    },
    

   
    anyEvent: async function (api, event) {
    api.sendMessage({
        msg: "ok",
        quote: event
    }, event.threadId, event.type);
    }
   

    // run: (api, args) => {
    //     api.sendMessage('Tính năng echo luôn hoạt động.', args[1]);
    // },

    // anyEvent: (api, event) => {
    //     const threadId = event.threadId;
    //     const content = event.data?.content?.trim(); // Lấy nội dung tin nhắn từ event.data.content

    //     // Xử lý sự kiện gửi lại nội dung tin nhắn
    //     if (event.type === 1 && !event.isSelf && typeof content === 'string') {
    //         api.sendMessage({
    //             body: `${content}`, // Nội dung tin nhắn phản hồi
    //             quote: event.data.msgId // Trích dẫn ID của tin nhắn gốc (hoặc sử dụng thuộc tính phù hợp)
    //         }, threadId).catch(console.error); // Gửi lại nội dung tin nhắn
    //     }
    // },

    // onLoad: (api) => {
    //     // Khởi tạo các biến toàn cục nếu cần
    //     if (!global.client) global.client = {};
    // },
};
