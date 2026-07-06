const ReviewService = require("../services/reviews.service");

module.exports.create = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const userId = req.user.id;
    const result = await ReviewService.create(
      bookingId,
      rating,
      comment,
      userId,
    );
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.update = async (req, res) => {
  try {
    const reviewId = req.params.id;
    const { rating, comment } = req.body;

    const userId = req.user.id;
    const result = await ReviewService.update(
      userId,
      reviewId,
      rating,
      comment,
    );
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.delete = async (req, res) => {
  try {
    const reviewId = req.params.id;
    const userId = req.user.id;
    const result = await ReviewService.delete(userId, reviewId);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.getReviewsByStadium = async (req, res) => {
  try {
    const stadiumId = req.params.stadiumId;
    const result = await ReviewService.getReviewsByStadium(stadiumId);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.statistics = async (req, res) => {
  try {
    const result = await ReviewService.statistics();
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};

module.exports.getMyReview = async (req, res) => {
  try {
    const stadiumId = req.params.stadiumId;
    const userId = req.user.id;

    const result = await ReviewService.getMyReview(userId, stadiumId);
    return res.status(200).json(result);
    
  } catch (e) {
    return res.status(e.status || 500).json({
      message: e.message || e,
    });
  }
};
