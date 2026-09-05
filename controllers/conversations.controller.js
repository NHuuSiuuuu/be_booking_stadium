const jwt = require("jsonwebtoken");
const ConversationService = require("../services/conversations.service");

module.exports.createSocketToken = async (req, res, next) => {
  try {
    const token = jwt.sign(
      {
        id: req.user.id,
        isAdmin: req.user.isAdmin === true,
      },
      process.env.ACCESS_TOKEN,
      { expiresIn: "5m" },
    );

    res.json({ message: "success", result: { token } });
  } catch (err) {
    next(err);
  }
};

module.exports.getOrCreate = async (req, res, next) => {
  try {
    const result = await ConversationService.getOrCreate({
      userId: req.user.id,
      stadiumId: req.body.stadium_id,
    });
    res.json({ message: "success", result });
  } catch (err) {
    next(err);
  }
};

module.exports.list = async (req, res, next) => {
  try {
    const result = await ConversationService.list(req.user);
    res.json({ message: "success", result });
  } catch (err) {
    next(err);
  }
};

module.exports.getMessages = async (req, res, next) => {
  try {
    const result = await ConversationService.getMessages(req.params.id, req.user);
    res.json({ message: "success", result });
  } catch (err) {
    next(err);
  }
};

module.exports.sendMessage = async (req, res, next) => {
  try {
    const result = await ConversationService.sendMessage(
      req.params.id,
      req.user,
      req.body.content,
    );
    res.json({ message: "success", result });
  } catch (err) {
    next(err);
  }
};

module.exports.markRead = async (req, res, next) => {
  try {
    const result = await ConversationService.markRead(req.params.id, req.user);
    res.json({ message: "success", result });
  } catch (err) {
    next(err);
  }
};

module.exports.close = async (req, res, next) => {
  try {
    const result = await ConversationService.close(req.params.id, req.user);
    res.json({ message: "success", result });
  } catch (err) {
    next(err);
  }
};

module.exports.delete = async (req, res, next) => {
  try {
    const result = await ConversationService.delete(req.params.id);
    res.json({ message: "success", result });
  } catch (err) {
    next(err);
  }
};
