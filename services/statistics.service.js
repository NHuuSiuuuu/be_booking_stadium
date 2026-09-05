const { pool } = require("../pool");
const AppError = require("../utils/AppError");

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toCsv(rows) {
  const headers = [
    "id",
    "stadium_name",
    "booking_date",
    "start_time",
    "end_time",
    "customer_name",
    "phone",
    "payment_method",
    "payment_status",
    "status",
    "total_price",
  ];

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ].join("\n");
}

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
            status = 'completed'
        AND booking_date >= DATE_TRUNC('month',CURRENT_DATE - INTERVAL '1 month')  
        GROUP BY month
        ORDER BY month
        
        `,
    );

    const preMonth = result.rows[0] || {
      total_bookings: 0,
      total_revenue: 0,
      average_revenue: 0,
    };
    const currMonth = result.rows[1] || preMonth;

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
            status = 'completed'
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
            AND b.status = 'completed'
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

module.exports.revenueByMonth = module.exports.bookingByMonth;

module.exports.statusSummary = async () => {
  try {
    const result = await pool.query(
      `
        SELECT
          status,
          COUNT(*) AS total_bookings,
          COALESCE(SUM(total_price), 0) AS total_revenue
        FROM bookings
        GROUP BY status
        ORDER BY total_bookings DESC
        `,
    );

    return {
      data: result.rows,
      message: "Thống kê đơn đặt theo trạng thái",
      status: "success",
    };
  } catch (e) {
    throw e;
  }
};

module.exports.paymentSummary = async () => {
  try {
    const result = await pool.query(
      `
        SELECT
          payment_method,
          payment_status,
          COUNT(*) AS total_bookings,
          COALESCE(SUM(total_price), 0) AS total_revenue
        FROM bookings
        GROUP BY payment_method, payment_status
        ORDER BY total_bookings DESC
        `,
    );

    return {
      data: result.rows,
      message: "Thống kê đơn đặt theo phương thức thanh toán",
      status: "success",
    };
  } catch (e) {
    throw e;
  }
};

module.exports.bookingsExportCsv = async () => {
  try {
    const result = await pool.query(
      `
        SELECT
          b.id,
          s.name AS stadium_name,
          TO_CHAR(b.booking_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS booking_date,
          pc.start_time,
          pc.end_time,
          b.full_name AS customer_name,
          b.phone,
          b.payment_method,
          b.payment_status,
          b.status,
          b.total_price
        FROM bookings b
        JOIN stadiums s ON s.id = b.stadium_id
        JOIN price_configs pc ON pc.id = b.price_config_id
        ORDER BY b.booking_date DESC, b.id DESC
        LIMIT 1000
        `,
    );

    return toCsv(result.rows);
  } catch (e) {
    throw e;
  }
};
