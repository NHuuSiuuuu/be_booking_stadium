const { pool } = require("../pool");

module.exports.create = async (bookingId, rating, comment, userId) => {
  try {
    if (rating < 1 || rating > 5) {
      throw {
        status: 400,
        message: "Rating phải từ 1 đến 5.",
      };
    }
    // Tìm booking
    const bookingResult = await pool.query(
      `
            SELECT *
            FROM bookings
            WHERE id = $1
            `,
      [bookingId],
    );

    if (bookingResult.rows.length === 0) {
      throw {
        status: 404,
        message: "Booking không tồn tại.",
      };
    }

    const booking = bookingResult.rows[0];

    if (booking.user_id !== userId) {
      throw {
        status: 403,
        message: "Không có quyền đánh giá",
      };
    }
    // if (booking.status !== "completed") {
    //   throw {
    //     status: 400,
    //     message: "Chi được đánh giá sau khi hoàn thành",
    //   };
    // }

    // Kiểm tra xem đã đánh giá sân đấy chưa - nếu đánh giá rồi không cho đánh giá nữa
    const reviewResult = await pool.query(
      `
            SELECT id
            FROM reviews
            WHERE booking_id = $1
            `,
      [bookingId],
    );
    if (reviewResult.rows.length > 0) {
      throw {
        status: 400,
        message: "Bạn đã đánh giá booking này.",
      };
    }
    // Insert review
    await pool.query(
      `
            INSERT INTO reviews
            (
                user_id,
                stadium_id,
                booking_id,
                rating,
                comment
            )
            VALUES
            ($1,$2,$3,$4,$5)
            `,
      [userId, booking.stadium_id, bookingId, rating, comment],
    );
    return {
      message: "Đánh giá thành công",
    };
  } catch (e) {
    throw e;
  }
};

module.exports.update = async (userId, reviewId, rating, comment) => {
  try {
    if (rating < 1 || rating > 5) {
      throw {
        status: 400,
        message: "Rating phải từ 1 đến 5.",
      };
    }
    // Tìm booking
    const reviewResult = await pool.query(
      `
            SELECT *
            FROM reviews
            WHERE id = $1
            `,
      [reviewId],
    );

    if (reviewResult.rows.length === 0) {
      throw {
        status: 404,
        message: "Review không tồn tại.",
      };
    }

    const review = reviewResult.rows[0];

    if (review.user_id !== userId) {
      throw {
        status: 403,
        message: "Bạn không có quyền đánh giá",
      };
    }

    // Update review
    await pool.query(
      `
            UPDATE reviews
            SET
                rating = $1,
                comment = $2,
                update_at = Now()
            WHERE
             id = $3       
            `,
      [rating, comment, reviewId],
    );
    return {
      message: "Cập nhật đánh giá thành công.",
    };
  } catch (e) {
    throw e;
  }
};

module.exports.delete = async (userId, reviewId) => {
  try {
    // Tìm booking
    const reviewResult = await pool.query(
      `
            SELECT *
            FROM reviews
            WHERE id = $1
            `,
      [reviewId],
    );

    if (reviewResult.rows.length === 0) {
      throw {
        status: 404,
        message: "Review không tồn tại.",
      };
    }

    const review = reviewResult.rows[0];

    if (review.user_id !== userId) {
      throw {
        status: 403,
        message: "Bạn không có quyền đánh giá",
      };
    }

    // Update review
    await pool.query(
      `
            DELETE 
            FROM reviews
            WHERE id = $1       
            `,
      [reviewId],
    );
    return {
      message: "Xóa thành công",
    };
  } catch (e) {
    throw e;
  }
};

// Thông kê + đánh giá của sân
module.exports.getReviewsByStadium = async (stadiumId) => {
  try {
    const result = await pool.query(
      `
        SELECT
            r.*,
            u.fullname
        FROM reviews r
        JOIN users u
        ON r.user_id = u.id

        WHERE stadium_id = $1

        ORDER BY created_at DESC
        `,
      [stadiumId],
    );

    const reviews = result.rows;

    const resultStatistics = await pool.query(
      `
        SELECT
          ROUND(AVG(rating), 1) AS average_rating,
          COUNT(*) AS total_reviews,

          COUNT(*) FILTER (WHERE rating = 5) AS five_star,
          COUNT(*) FILTER (WHERE rating = 4) AS four_star,
          COUNT(*) FILTER (WHERE rating = 3) AS three_star,
          COUNT(*) FILTER (WHERE rating = 2) AS two_star,
          COUNT(*) FILTER (WHERE rating = 1) AS one_star

        FROM reviews
        WHERE stadium_id = $1
      `,
      [stadiumId],
    );

    const statistics = resultStatistics.rows[0];

    return {
      message: "Danh sách đánh giá của sân",
      result: {
        avg_rating: statistics.average_rating,
        total_reviews: statistics.total_reviews,
        statistics: [
          {
            rating: 5,
            count: Number(statistics.five_star),
          },
          {
            rating: 4,
            count: Number(statistics.four_star),
          },
          {
            rating: 3,
            count: Number(statistics.three_star),
          },
          {
            rating: 2,
            count: Number(statistics.two_star),
          },
          {
            rating: 1,
            count: Number(statistics.one_star),
          },
        ],
        reviews,
      },
    };
  } catch (e) {
    throw e;
  }
};

// Thông kê danh sách các sân
module.exports.statistics = async () => {
  try {
    const result = await pool.query(
      `
      SELECT
      AVG(rating) AS average_rating,
      COUNT(*) AS total_reviews

      FROM reviews

      `,
    );

    const statistics = result.rows[0];

    return {
      message: "Thống kê đánh giá",
      result: statistics,
    };
  } catch (e) {
    throw e;
  }
};

// Thông kê danh sách các sân
module.exports.getMyReview = async (userId, stadiumId) => {
  try {
    const result = await pool.query(
      `
      SELECT
        r.*,
        u.fullname
      FROM reviews r
      JOIN users u
        ON r.user_id = u.id
      WHERE r.user_id = $1
        AND r.stadium_id = $2
      LIMIT 1
      `,
      [userId, stadiumId],
    );

    const statistics = result.rows[0];

    return {
      message: "Lấy đánh giá thành công",
      review: statistics,
    };
  } catch (e) {
    throw e;
  }
};
