const BookingService = require("../services/bookings.service");

module.exports.create = async (req, res) => {
  try {
    const result = await BookingService.create(req);
    return res.status(201).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.get = async (req, res) => {
  try {
    // console.log("req", req.query)
    const result = await BookingService.get(req.query);
    return res.status(201).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.success = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await BookingService.success(id);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message,
    });
  }
};

module.exports.bookedSlots = async (req, res) => {
  try {
    const { stadium_id, date } = req.query;
    // console.log( stadium_id, date)
    const result = await BookingService.bookedSlots(stadium_id, date);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message,
    });
  }
};

module.exports.holdSlots = async (req, res) => {
  try {
    const { stadium_id, date, price_config_id, socket_id } = req.query;
    // console.log("Chayyj vqua controller",socket_id);
    const result = await BookingService.holdSlots(
      stadium_id,
      date,
      price_config_id,
      socket_id
    );
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message,
    });
  }
};

module.exports.updateStatus = async (req, res) => {
  try {
    const order = await BookingService.updateStatus(req.body);
    return res.status(200).json(order);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || "Lỗi server",
    });
  }
};

module.exports.cancelBooking = async (req, res) => {
  try {
    const id = req.params.id;
    const user = req.user.id;
    const order = await BookingService.cancelBooking(id, user);

    return res.status(200).json(order);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || "Lỗi server",
    });
  }
};

module.exports.getMyBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("req.user.id", req.user.id);
    const order = await BookingService.getMyBookings(userId);

    return res.status(200).json(order);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || "Lỗi server",
    });
  }
};
