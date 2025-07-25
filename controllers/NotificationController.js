const Notification = require("../models/Notification");

exports.create = async (req, res) => {
  try {
    const notification = await Notification.create(req.body);
    res.status(201).json(notification);

    // Emit socket thông báo notification mới
    const io = req.app.get("io");
    if (io) {
      io.emit("new_notification", notification);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  const notifications = await Notification.find().sort({ createdAt: -1 });
  res.json(notifications);
};

exports.getById = async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) return res.status(404).json({ error: "Not found" });
  res.json(notification);
};

exports.update = async (req, res) => {
  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  if (!notification) return res.status(404).json({ error: "Not found" });
  res.json(notification);
};

exports.delete = async (req, res) => {
  const notification = await Notification.findByIdAndDelete(req.params.id);
  if (!notification) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Deleted" });
};
