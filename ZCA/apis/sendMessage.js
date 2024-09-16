import FormData from "form-data";
import fs from "fs";
import sharp from "sharp";
import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/index.js";
import { GroupMessage, Message, MessageType } from "../models/Message.js";
import { encodeAES, getClientMessageType, getFileExtension, getFileName, getGifMetaData, getMd5LargeFileObject, handleZaloResponse, makeURL, removeUndefinedKeys, request } from "../utils.js";

const attachmentUrlType = {
    image: "photo_original/send?",
    gif: "gif?",
    video: "asyncfile/msg?",
    others: "asyncfile/msg?",
};

function prepareQMSGAttach(quote) {
    const quoteData = quote.data;
    if (typeof quoteData.content === "string")
        return quoteData.propertyExt;
    if (quoteData.msgType === "chat.todo")
        return {
            properties: {
                color: 0,
                size: 0,
                type: 0,
                subType: 0,
                ext: '{"shouldParseLinkOrContact":0}',
            },
        };
    return { ...quoteData.content, thumbUrl: quoteData.content.thumb, oriUrl: quoteData.content.href, normalUrl: quoteData.content.href };
}

function prepareQMSG(quote) {
    const quoteData = quote.data;
    if (quoteData.msgType === "chat.todo" && typeof quoteData.content !== "string") {
        return JSON.parse(quoteData.content.params).item.content;
    }
    return "";
}

async function send(data) {
    if (!Array.isArray(data))
        data = [data];
    const requests = data.map(async (each) => {
        const response = await request(each.url, {
            method: "POST",
            body: each.body,
            headers: each.headers,
        });
        const result = await handleZaloResponse(response);
        if (result.error)
            throw new ZaloApiError(result.error.message, result.error.code);
        return result.data;
    });
    return await Promise.all(requests);
}

export function sendMessageFactory(api) {
    const serviceURLs = {
        message: {
            [MessageType.DirectMessage]: makeURL(`${api.zpwServiceMap.chat[0]}/api/message`, {
                zpw_ver: api.API_VERSION,
                zpw_type: api.API_TYPE,
                nretry: 0,
            }),
            [MessageType.GroupMessage]: makeURL(`${api.zpwServiceMap.group[0]}/api/group`, {
                zpw_ver: api.API_VERSION,
                zpw_type: api.API_TYPE,
                nretry: 0,
            }),
        },
        attachment: {
            [MessageType.DirectMessage]: `${api.zpwServiceMap.file[0]}/api/message/`,
            [MessageType.GroupMessage]: `${api.zpwServiceMap.file[0]}/api/group/`,
        },
    };

    const { sharefile } = appContext.settings.features;

    function isExceedMaxFile(totalFile) {
        return totalFile > sharefile.max_file;
    }

    function isExceedMaxFileSize(fileSize) {
        return fileSize > sharefile.max_size_share_file_v3 * 1024 * 1024;
    }

    function getGroupLayoutId() {
        return Date.now();
    }

    async function upthumb(filePath, url) {
        let formData = new FormData();
        let buffer = await sharp(filePath).png().toBuffer();
        formData.append("fileContent", buffer, {
            filename: "blob",
            contentType: "image/png",
        });
        const params = {
            clientId: Date.now(),
            imei: appContext.imei,
        };
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt message");
        let response = await request(makeURL(url + "upthumb?", {
            zpw_ver: api.API_VERSION,
            zpw_type: api.API_TYPE,
            params: encryptedParams,
        }), {
            method: "POST",
            headers: formData.getHeaders(),
            body: formData.getBuffer(),
        });
        const result = await handleZaloResponse(response);
        if (result.error)
            throw new ZaloApiError(result.error.message, result.error.code);
        return result.data;
    }

    function handleMentions(type, msg, mentions) {
        let totalMentionLen = 0;
        const mentionsFinal = Array.isArray(mentions) && type === MessageType.GroupMessage
            ? mentions
                .filter((m) => m.pos >= 0 && m.uid && m.len > 0)
                .map((m) => {
                    totalMentionLen += m.len;
                    return {
                        pos: m.pos,
                        uid: m.uid,
                        len: m.len,
                        type: m.uid === "-1" ? 1 : 0,
                    };
                })
            : [];
        if (totalMentionLen > msg.length) {
            throw new ZaloApiError("Invalid mentions: total mention characters exceed message length");
        }
        return {
            mentionsFinal,
            msgFinal: msg,
        };
    }

    async function handleMessage({ msg, mentions, quote }, threadId, type) {
        if (!msg || msg.trim().length === 0)
            throw new ZaloApiError("Missing message content");

        // Kiểm tra nếu msg là URL
        try {
            new URL(msg);
        } catch (_) {
            throw new ZaloApiError("Invalid URL format");
        }

        const isValidInstance = quote instanceof Message || quote instanceof GroupMessage;
        if (quote && !isValidInstance)
            throw new ZaloApiError("Invalid quote message");

        const isGroupMessage = type === MessageType.GroupMessage;
        const { mentionsFinal, msgFinal } = handleMentions(type, msg, mentions);
        msg = msgFinal;

        const quoteData = quote?.data;
        if (quoteData) {
            if (typeof quoteData.content !== "string" && quoteData.msgType === "webchat") {
                throw new ZaloApiError("This kind of `webchat` quote type is not available");
            }
            if (quoteData.msgType === "group.poll") {
                throw new ZaloApiError("The `group.poll` quote type is not available");
            }
        }

        const isMentionsValid = mentionsFinal.length > 0 && isGroupMessage;
        const params = quote
            ? {
                toid: isGroupMessage ? undefined : threadId,
                grid: isGroupMessage ? threadId : undefined,
                message: msg,
                clientId: Date.now(),
                mentionInfo: isMentionsValid ? JSON.stringify(mentionsFinal) : undefined,
                qmsgOwner: quoteData.uidFrom,
                qmsgId: quoteData.msgId,
                qmsgCliId: quoteData.cliMsgId,
                qmsgType: getClientMessageType(quoteData.msgType),
                qmsgTs: quoteData.ts,
                qmsg: typeof quoteData.content === "string" ? quoteData.content : prepareQMSG(quote),
                imei: isGroupMessage ? undefined : appContext.imei,
                visibility: isGroupMessage ? 0 : undefined,
                qmsgAttach: isGroupMessage ? JSON.stringify(prepareQMSGAttach(quote)) : undefined,
                qmsgTTL: quoteData.ttl,
                ttl: 0,
            }
            : {
                message: msg,
                clientId: Date.now(),
                mentionInfo: isMentionsValid ? JSON.stringify(mentionsFinal) : undefined,
                imei: isGroupMessage ? undefined : appContext.imei,
                ttl: 0,
                visibility: isGroupMessage ? 0 : undefined,
                toid: isGroupMessage ? undefined : threadId,
                grid: isGroupMessage ? threadId : undefined,
            };

        for (const key in params) {
            if (params[key] === undefined)
                delete params[key];
        }

        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt message");

        const finalServiceUrl = new URL(serviceURLs.message[type]);
        if (quote) {
            finalServiceUrl.pathname = finalServiceUrl.pathname + "/quote";
        } else {
            finalServiceUrl.pathname =
                finalServiceUrl.pathname +
                "/" +
                (isGroupMessage ? (params.mentionInfo ? "mention" : "sendmsg") : "sms");
        }

        return {
            url: finalServiceUrl.toString(),
            body: new URLSearchParams({ params: encryptedParams }),
        };
    }

    async function handleAttachment({ msg, attachments, mentions, quote }, threadId, type) {
        if (!attachments || attachments.length === 0)
            throw new ZaloApiError("Missing attachments");
        const firstExtFile = getFileExtension(attachments[0]);
        const isSingleFile = attachments.length === 1;
        const isGroupMessage = type === MessageType.GroupMessage;
        const canBeDesc = isSingleFile && ["jpg", "jpeg", "png", "webp"].includes(firstExtFile);
        const gifFiles = attachments.filter((e) => e.mimeType === "image/gif");
        if (gifFiles.length > 0) {
            const result = await send(
                attachments.map(async (each) => {
                    const fileExtension = getFileExtension(each);
                    const meta = fileExtension === "gif" ? await getGifMetaData(each) : {};
                    const formData = new FormData();
                    formData.append("file", fs.createReadStream(each), { filename: getFileName(each) });
                    formData.append("message", JSON.stringify({
                        clientId: Date.now(),
                        imei: appContext.imei,
                        ...meta,
                    }));
                    return {
                        url: makeURL(serviceURLs.attachment[type] + attachmentUrlType[fileExtension], {
                            zpw_ver: api.API_VERSION,
                            zpw_type: api.API_TYPE,
                        }),
                        body: formData,
                        headers: formData.getHeaders(),
                    };
                })
            );
            return result;
        }

        const thumbFiles = attachments.filter((e) => ["jpg", "jpeg", "png", "webp"].includes(getFileExtension(e)));
        const nonThumbFiles = attachments.filter((e) => !["jpg", "jpeg", "png", "webp"].includes(getFileExtension(e)));
        if (thumbFiles.length > 0) {
            const results = await Promise.all(
                thumbFiles.map(async (filePath) => {
                    const fileExtension = getFileExtension(filePath);
                    if (isExceedMaxFileSize(fs.statSync(filePath).size))
                        throw new ZaloApiError("File size exceeds maximum limit");
                    if (isExceedMaxFile(attachments.length))
                        throw new ZaloApiError("Exceeds maximum file count");

                    const fileUrl = await upthumb(filePath, serviceURLs.attachment[type] + attachmentUrlType[fileExtension]);
                    return {
                        url: fileUrl,
                        type: "thumb",
                    };
                })
            );
            const result = await send(
                nonThumbFiles.map(async (filePath) => {
                    const formData = new FormData();
                    formData.append("file", fs.createReadStream(filePath), { filename: getFileName(filePath) });
                    formData.append("message", JSON.stringify({
                        clientId: Date.now(),
                        imei: appContext.imei,
                    }));
                    return {
                        url: makeURL(serviceURLs.attachment[type] + attachmentUrlType[getFileExtension(filePath)], {
                            zpw_ver: api.API_VERSION,
                            zpw_type: api.API_TYPE,
                        }),
                        body: formData,
                        headers: formData.getHeaders(),
                    };
                })
            );
            return [...results, ...result];
        }
    }

    async function sendMessage({ msg, attachments, mentions, quote }, threadId, type) {
        if (attachments && attachments.length > 0) {
            return await handleAttachment({ msg, attachments, mentions, quote }, threadId, type);
        }
        const messageData = await handleMessage({ msg, mentions, quote }, threadId, type);
        return await send(messageData);
    }

    return {
        sendMessage,
    };
}
