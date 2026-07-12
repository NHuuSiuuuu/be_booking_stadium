const { pool } = require("../pool");
const slugify = require("slugify");
const chatController = require("../controllers/chat.controller");

module.exports.index = async ({
  filter,
  sort,
  limit,
  page,
  lat,
  lng,
  keyword,
  radius,
}) => {
  try {
    let baseWhere = `
    FROM stadiums 
    LEFT JOIN price_configs ON price_configs.stadium_id  = stadiums.id
    WHERE 1=1`;
    let values = [];
    let index = 1;
    const filters = {};

    // Filter
    if (filter) {
      // convert hết về mảng
      const filterArray = Array.isArray(filter) ? filter : [filter];

      // convert sang obj
      filterArray.forEach((item) => {
        const [key, value] = item.split(":");
        filters[key] = value; // {status:true}
      });
    }
    // Filter status
    if (filters.status !== undefined) {
      baseWhere += ` AND status = $${index}`;
      values.push(filters.status === "true"); // convert sang boolean
      index++;
    }

    // Filter featured
    if (filters.featured !== undefined) {
      baseWhere += ` AND featured = $${index}`;
      values.push(filters.featured === "true");
      index++;
    }

    if (filters.type) {
      baseWhere += ` AND type = $${index}`;
      values.push(Number(filters.type));
      index++;
    }
    if (filters.dist) {
      baseWhere += ` AND district_id = $${index}`;
      values.push(Number(filters.dist));
      index++;
    }

    // Search
    if (keyword && keyword.trim() !== "") {
      baseWhere += ` AND (unaccent(name) ILIKE unaccent($${index}) 
                    OR unaccent(address) ILIKE unaccent($${index}))`; // unaccent:bỏ dấu
      values.push(`%${keyword.trim()}%`);
      index++;
    }

    // Tính khoảng cách
    let selectDistance = "";
    let orderSql = "";
    const radiusKm = Number(radius) || 5; // mặc định 5km
    const radiusMeter = radiusKm * 1000;
    if (lat != null && lng != null) {
      // ST_Distance(geom1, geom2): toa do san bong - toa do user
      // Tính khoảng cách = mét
      selectDistance = `
      ST_Distance(
      geom,
      ST_SetSRID(ST_MakePoint($${index + 1}, $${index}), 4326)
      ) AS distance
      `;

      // Lấy trong bán kính 5km
      // ST_DWithin(geom1, geom2, distance);
      baseWhere += `
        AND ST_DWithin(
          stadiums.geom::geography,
          ST_SetSRID(ST_MakePoint($${index + 1}, $${index}), 4326)::geography,
          ${radiusMeter}
        )
      `;

      values.push(Number(lat), Number(lng));
      index += 2;

      // Sort them sân gần nhất
      orderSql = ` ORDER BY distance ASC`;
    }

    // Sort
    // Nếu không phải tính khoảng cách
    if (!orderSql) {
      if (sort) {
        console.log(sort);
        const [key, value] = sort.split(":");
        // Các trường sort
        const allowedFields = ["name", "address", "district_id"];
        const direction = value?.toUpperCase() === "desc" ? "DESC" : "ASC";

        if (allowedFields.includes(key)) {
          orderSql += ` ORDER BY ${key} ${direction}`;
        }
      } else {
        orderSql += ` ORDER BY stadiums.id DESC`;
      }
    }

    // limit

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;

    const limitSql = `LIMIT $${index}`;
    values.push(limitNumber);
    index++;

    // OFFSET
    const offsetSql = ` OFFSET $${index}`;
    // skip
    values.push((pageNumber - 1) * limitNumber);
    index++;

    // console.log(values);

    const result = await pool.query(
      `
      SELECT stadiums.*,
        ST_Y(stadiums.geom) AS lat,
        ST_X(stadiums.geom) AS lng,
        ${selectDistance ? `${selectDistance},` : ""}
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'start_time', price_configs.start_time,
            'end_time', price_configs.end_time,
            'price', price_configs.price
          ) ORDER BY price_configs.start_time
        ) FILTER (WHERE price_configs.id IS NOT NULL) AS price_configs,
        MIN(price_configs.price) as min_price,
        MAX(price_configs.price) as max_price
      ${baseWhere}
      GROUP BY stadiums.id
      ${orderSql} ${limitSql} ${offsetSql}
      `,
      values,
    );

    // OVER tính toán ko làm mất dữ liệu từng dòng
    const totalStadium = await pool.query(
      `SELECT COUNT(DISTINCT stadiums.id) AS total
       ${baseWhere}
   
    `,
      values.slice(0, values.length - 2), // bỏ limit + offset (bỏ 2 thằng ở cuối cùng)
    );

    const total = totalStadium?.rows[0].total;
    console.log("total", total);
    return {
      message: "SUCCESS",
      stadiums: result.rows,
      total: total,
      pageCurrent: pageNumber,
      totalPage: Math.ceil(total / limitNumber),
    };
  } catch (e) {
    throw e;
  }
};

module.exports.create = async ({
  name,
  address,
  district_id,
  lng,
  lat,
  description,
  featured,
  status,
  thumbnail, // array URL từ Cloudinary
  type,
  utility,
}) => {
  try {
    let slug = slugify(name, {
      lower: true,
      strict: true,
    });
    let count = 1;
    while (true) {
      const check = await pool.query(
        "SELECT id FROM stadiums WHERE slug = $1",
        [slug],
      );
      if (check.rows.length === 0) break;
      slug = `${slug}-${count + 1}`;
    }

    const utilityParse =
      typeof utility === "string" ? JSON.parse(utility) : utility;

    const thumbnailParse =
      typeof thumbnail === "string" ? JSON.parse(thumbnail) : thumbnail;

    const result = await pool.query(
      `
      INSERT INTO stadiums (
        name,
        slug,
        address,
        district_id,
        geom,
        description,
        featured,
        status,
        thumbnail,
        type,
        utility
      )
      VALUES ($1,$2,$3,$4,ST_SetSRID(ST_Point($5,$6),4326),$7,$8,$9,$10,$11,$12)
      RETURNING*, ST_AsGeoJSON(geom) as geom`,
      [
        name,
        slug,
        address,
        district_id,
        lng || null,
        lat || null,
        description,
        featured,
        status,
        thumbnailParse,
        type,
        utilityParse,
      ],
    );

    chatController.updateDocument(result.rows[0].id);
    return {
      message: "SUCCESS",
      stadium: result.rows,
    };
  } catch (e) {
    throw e;
  }
};

module.exports.update = async (id, data) => {
  try {
    const {
      name,
      address,
      district_id,
      lng,
      lat,
      description,
      featured,
      status,
      thumbnail, // array URL
      type,
      utility,
    } = data;

    // Tạo slug
    let slug = slugify(name, {
      lower: true,
      strict: true,
    });
    let count = 1;
    while (true) {
      const check = await pool.query(
        "SELECT id FROM stadiums WHERE slug = $1",
        [slug],
      );
      if (check.rows.length === 0) break;
      slug = `${slug}-${count + 1}`;
    }
    const utilityParse =
      typeof utility === "string" ? JSON.parse(utility) : utility;

    const thumbnailParse =
      typeof thumbnail === "string" ? JSON.parse(thumbnail) : thumbnail;

    const result = await pool.query(
      `
      UPDATE stadiums
      SET
        name = $1,
        slug = $2,
        address = $3,
        district_id = $4,
        geom = ST_SetSRID(ST_Point($5,$6),4326),
        description = $7,
        featured = $8,
        status = $9,
        thumbnail = $10,
        type = $11,
        utility = $12
      WHERE id = $13
      RETURNING *
      `,
      [
        name,
        slug,
        address,
        district_id || null,
        lng || null,
        lat || null,
        description,
        featured,
        status,
        thumbnailParse,
        type,
        utilityParse,
        id,
      ],
    );
    chatController.updateDocument(id);

    return {
      message: "SUCCESS",
      stadium: result.rows,
    };
  } catch (e) {
    throw e;
  }
};

module.exports.delete = async (id) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM stadiums
      WHERE id = $1
      `,
      [id],
    );

    await client.query(
      `
      DELETE FROM documents
      WHERE source_type = 'stadiums'
      AND source_id = $1
      `,
      [id],
    );
    await client.query("COMMIT");

    return {
      message: "Xóa thành công!",
    };
  } catch (e) {
    await client.query("ROLLBACK"); // Lỗi thì hủy tất cả vừa làm
    throw e;
  } finally {
    client.release(); // trả lại kết nối sau khi dùng xong ( vì trên này await pool.connect(); mình mượn connect của pool)
  }
};

module.exports.detail = async (id) => {
  try {
    const result = await pool.query(
      ` SELECT* 
        FROM stadiums
        WHERE id=${id}
      `,
    );
    return result.rows;
  } catch (e) {
    throw e;
  }
};

module.exports.detailUser = async (slug) => {
  try {
    // console.log(slug);
    const result = await pool.query(
      ` SELECT* 
        FROM stadiums
        WHERE slug = $1
      `,
      [slug],
    );
    return result.rows;
  } catch (e) {
    throw e;
  }
};
