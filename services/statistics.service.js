const { pool } = require("../pool");
const AppError = require("../utils/AppError");

// Tổng lượt đặt sân tháng này
// Tổng doanh thu tháng này
// Doanh thu trung bình tháng này
/**
 * DATE_TRUNC: cắt bớt thời gian không cần thiết của gtri ngày giờ
 * Đưa nó về mốc ban đầu của thời gian đó
 */
module.exports.overview = async () => {
  try {
    const result = await pool.query(
      `
        SELECT 
          DATE_TRUNC('month', booking_date) AS month,
          COUNT(*) AS total_bookings,
          SUM(total_price) AS total_revenue,
          AVG(total_price) AS average_revenue
        FROM 
            bookings
        WHERE
            payment_status = 'paid'
        AND booking_date >= DATE_TRUNC('month',CURRENT_DATE - INTERVAL '1 month')  
        GROUP BY month
        ORDER BY month
        
        `,
    );

    const preMonth = result.rows[0];
    const currMonth = result.rows[1];

    // Hàm tính % tăng trưởng
    const calculateGrowth = (curr, prev) => {
      if (prev === 0) {
        return curr > 0 ? 100 : 0;
      }

      return (((curr - prev) / prev) * 100).toFixed(2);
    };

    // Tính booking tăng trưởng
    const bookingGrowth = calculateGrowth(
      currMonth.total_bookings,
      preMonth.total_bookings,
    );
    // Tính doanh thu tăng trưởng
    const totalRevenueGrowth = calculateGrowth(
      currMonth.total_revenue,
      preMonth.total_revenue,
    );

    // Tính doanh thu trung bình tăng trưởng
    const averageRevenueGrowth = calculateGrowth(
      currMonth.average_revenue,
      preMonth.average_revenue,
    );

    // console.log("preMonth",preMonth)
    // console.log("currMonth",currMonth)
    // console.log("bookingGrowth", bookingGrowth);
    return {
      data: {
        total_bookings: currMonth.total_bookings,
        total_revenue: currMonth.total_revenue,
        average_revenue: currMonth.average_revenue,

        booking_growth: bookingGrowth,
        revenue_growth: totalRevenueGrowth,
        average_revenue_growth: averageRevenueGrowth,
        },
      message: "ok",
    };
  } catch (e) {
    throw e;
  }
};

// API lượt đặt theo tháng
module.exports.bookingByMonth = async () => {
  try {
    const result = await pool.query(
      `
        SELECT 
            COUNT(*) as total_bookings,
            TO_CHAR(DATE_TRUNC('month',booking_date),'MM/YYYY') AS month,
            COALESCE(SUM(total_price),0) AS total_revenue
        FROM 
            bookings
        WHERE
            payment_status = 'paid'
        GROUP BY DATE_TRUNC('month', booking_date)
        ORDER BY DATE_TRUNC('month', booking_date)
        `,
    );
    return {
      data: result.rows,
      message: "Lượt booking và doanh thu theo từng tháng",
      status: "success",
    };
  } catch (e) {
    throw e;
  }
};

// API top sân đặt nhiều
module.exports.topStadiums = async () => {
  try {
    const result = await pool.query(
      `
        SELECT
            s.name,
            COUNT(*) AS total_bookings,
            COALESCE(SUM(total_price),0) AS total_revenue

        FROM bookings b
        JOIN stadiums s
            ON s.id = b.stadium_id
            AND payment_status = 'paid'
        GROUP BY s.id, s.name
        ORDER BY total_bookings DESC
        LIMIT 10;
        `,
    );
    return {
      data: result.rows,
      message: "Top sân đặt nhiều nhất",
      status: "success",
    };
  } catch (e) {
    throw e;
  }
};
