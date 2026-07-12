const { pool } = require("../pool");
const chatController = require("../controllers/chat.controller");

module.exports.create = async ({ stadium_id, day_of_week, slots }) => {
  try {
    // console.log(slots)
    // Xóa config cũ tránh trùng ngày
    await pool.query(
      `
       DELETE FROM price_configs 
       WHERE stadium_id = $1 AND day_of_week = $2
       `,
      [stadium_id, day_of_week],
    );

    const results = [];
    for (const slot of slots) {
      console.log(slot);
      const result = await pool.query(
        `
       INSERT INTO price_configs (
        stadium_id, day_of_week, start_time, end_time, price
       )
       VALUES($1, $2, $3, $4, $5) 
       RETURNING *; `,
        [stadium_id, day_of_week, slot.start_time, slot.end_time, slot.price],
      );
      results.push(result.rows[0]);
    }
    await chatController.updateDocument(stadium_id);

    return {
      message: "OK",
      results,
    };
  } catch (e) {
    throw e;
  }
};

module.exports.getByStadium = async ({ id }) => {
  const result = await pool.query(
    `
    SELECT *
    FROM price_configs
    WHERE stadium_id = $1
    ORDER BY day_of_week, start_time
    `,
    [id],
  );

  return result.rows;
};

module.exports.update = async ({
  id,
  day_of_week,
  start_time,
  end_time,
  price,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE price_configs
      SET
        day_of_week = $1,
        start_time = $2,
        end_time = $3,
        price = $4
      WHERE id = $5
      RETURNING *
      `,
      [day_of_week, start_time, end_time, price, id],
    );

    const stadiumResult = await client.query(
      `
      SELECT stadium_id 
      FROM price_configs
      where id= $1
      `,
      [id],
    );
    await client.query("COMMIT");

    await chatController.updateDocument(stadiumResult.rows[0].stadium_id);
  } catch (e) {
    await client.query("ROLLBACK"); // Lỗi thì hủy tất cả vừa làm

    throw e;
  } finally {
    client.release(); // trả lại kết nối sau khi dùng xong ( vì trên này await pool.connect(); mình mượn connect của pool)
  }
};

module.exports.delete = async ({ id }) => {
  try {
    await pool.query(
      ` DELETE 
        FROM price_configs
        WHERE id=${id}
      `,
    );
    const stadiumResult = await pool.query(
      `
      SELECT stadium_id 
      FROM price_configs
      where id= $1
      `,
      [id],
    );
    await chatController.updateDocument(stadiumResult.rows[0].stadium_id);

    return { message: "Xóa thành công!" };
  } catch (e) {
    throw e;
  }
};
