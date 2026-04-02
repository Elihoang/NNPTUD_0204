let express = require('express')
let router = express.Router()
let { checkLogin } = require('../utils/authHandler')
let messageModel = require('../schemas/messages')
let { uploadImage } = require('../utils/uploadHandler')
let mongoose = require('mongoose')

// GET /api/v1/messages
router.get('/', checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;

        let messages = await messageModel.find({
            $or: [
                { from: currentUserId },
                { to: currentUserId }
            ]
        })
            .populate('from', 'username avatarUrl')
            .populate('to', 'username avatarUrl')
            .sort({ createdAt: -1 });
        let conversationMap = new Map();

        for (let msg of messages) {
            let otherUserId = msg.from._id.toString() === currentUserId.toString()
                ? msg.to._id.toString()
                : msg.from._id.toString();

            if (!conversationMap.has(otherUserId)) {
                conversationMap.set(otherUserId, msg);
            }
        }

        let lastMessages = Array.from(conversationMap.values());

        res.send(lastMessages);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
})

// POST /api/v1/messages

router.post('/', checkLogin, uploadImage.single('file'), async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let { to } = req.body;

        if (!to) {
            return res.status(400).send({ message: "Thiếu trường 'to' (userID người nhận)" });
        }

        if (!mongoose.Types.ObjectId.isValid(to)) {
            return res.status(400).send({ message: "userID người nhận không hợp lệ" });
        }

        let messageType;
        let messageText;

        if (req.file) {
            // Nếu có file 
            messageType = 'file';
            messageText = req.file.path;
        } else {
            // Nếu là text thuần
            if (!req.body.text) {
                return res.status(400).send({ message: "Thiếu nội dung tin nhắn (text)" });
            }
            messageType = 'text';
            messageText = req.body.text;
        }

        let newMessage = new messageModel({
            from: currentUserId,
            to: to,
            messageContent: {
                type: messageType,
                text: messageText,
            }
        });

        await newMessage.save();
        await newMessage.populate('from', 'username avatarUrl');
        await newMessage.populate('to', 'username avatarUrl');

        res.status(201).send(newMessage);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
})

// GET /api/v1/messages/:userID
router.get('/:userID', checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let targetUserId = req.params.userID;

        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).send({ message: "userID không hợp lệ" });
        }

        let messages = await messageModel.find({
            $or: [
                { from: currentUserId, to: targetUserId },
                { from: targetUserId, to: currentUserId }
            ]
        })
            .populate('from', 'username avatarUrl')
            .populate('to', 'username avatarUrl')
            .sort({ createdAt: 1 });

        res.send(messages);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
})

module.exports = router;
