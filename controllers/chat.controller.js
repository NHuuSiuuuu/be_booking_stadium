const { pool } = require("../pool");

//API tạo Vector Database.
module.exports.index = async (req, res) => {
  // Chat với mô hình Gemini (LLM) nó sẽ tự sinh ra câu trả lời
  const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");

  // Tạo embedding: biến văn bản thành vector
  const { GoogleGenerativeAIEmbeddings } =
    await import("@langchain/google-genai");

  const { RecursiveCharacterTextSplitter } =
    await import("@langchain/textsplitters");

  const { Document } = await import("@langchain/core/documents");

  const embeddings = new GoogleGenerativeAIEmbeddings({
    // test thằng này chiều vector là 3072
    model: "gemini-embedding-001", // 768 dimensions
    apiKey: process.env.GOOGLE_API_KEY,

    //   taskType: TaskType.RETRIEVAL_DOCUMENT,
    // title: "Document title",
  });

  const stadiums = await pool.query(`
    SELECT *
    FROM stadiums
 
 `);

  // console.log("stadiums", stadiums.rows);

  const docs = await Promise.all(
    stadiums.rows.map(async (stadium) => {
      // console.log("stadium.id",stadium.id)
      const prices = await pool.query(
        `
      SELECT*
      
      FROM price_configs
      WHERE stadium_id = $1
    
      `,
        [stadium.id],
      );
      const priceText = prices.rows
        .map((p) => `${p.start_time} - ${p.end_time}: ${p.price}đ`)
        .join("\n");

      return new Document({
        pageContent: `
            Tên sân: 
            ${stadium.name}

            Địa chỉ: 
            ${stadium.address}
         
            Mô tả: 
            ${stadium.description}

            Tiện ích: 
            ${stadium.utility}

            Loại sân: 
            ${stadium.type}
            
            Bảng giá:
            ${priceText}
      `,
        metadata: {
          sourceType: "stadiums",
          slug: stadium.slug,
          sourceId: stadium.id,
        },
      });
    }),
  );
  console.log("docs", docs);

  // Hàm chia docs:  Document dài 10000 kí tự cắt ra
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500, // cắt ra 500 ki tự ( độ dài tối đa mỗi đoạn)
    chunkOverlap: 100, // số kí tự lặp lại giữa 2 chuck liên tiếp
  });

  // Bước 3. Chia document
  const chunks = await splitter.splitDocuments(docs);
  // console.log("chunks", chunks);

  // Bước 4. Tạo embedding
  const vectors = await embeddings.embedDocuments(
    //embedDocuments: Hàm này nhận một mảng document.
    chunks.map((chunk) => chunk.pageContent),
  );
  for (let i = 0; i < chunks.length; i++) {
    await pool.query(
      `
        INSERT INTO documents
        (
          source_type,
          source_id,
          content,
          metadata,
          embedding
        )

        VALUES
        (
            $1,
            $2,
            $3,
            $4, 
            $5
        )
        `,
      [
        chunks[i].metadata.sourceType, // stadium
        chunks[i].metadata.sourceId, // id sân
        chunks[i].pageContent,
        chunks[i].metadata,
        JSON.stringify(vectors[i]),
      ],
    );
  }
  console.log("vectors.length", vectors);
  return res.json({
    message: "Thêm docs vector thành công",
  });
};

module.exports.chat = async (req, res) => {
  try {
    const { question, history = [] } = req.body;
    if (!question) {
      return res.status(400).json({ message: "Thiếu câu hỏi (question)." });
    }

    // console.log("history", history);
    // Embedding
    // LLM
    const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
    const { GoogleGenerativeAIEmbeddings } =
      await import("@langchain/google-genai");

    // LLM
    const llm = new ChatGoogleGenerativeAI({
      // model: "gemini-flash-latest",
      model: "gemini-3.1-flash-lite",
      apiKey: process.env.GOOGLE_API_KEY,
      maxRetries: 2,
    });

    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-001",
      apiKey: process.env.GOOGLE_API_KEY,
    });

    // Lịch sử gần đây ( chỉ lấy 3 lượt gần nhất)
    const recentHistory = history.slice(-6); // lấy 6 phần tử ở cuối mảng
    const historyText = recentHistory
      .map((r) => `${r.role === "user" ? "Người dùng" : "Bot"}: ${r.content}`)
      .join("\n");
    console.log("historyText", historyText);
    console.log("recentHistory", recentHistory.length);
    let standalonePrompt = question;
    if (recentHistory.length > 0) {
      const prt = `
        Dựa vào lịch sử hội thoại và câu hỏi mới, hãy viết lại câu hỏi mới
        thành một câu hỏi độc lập, đầy đủ ngữ cảnh (không cần lịch sử vẫn hiểu được).
        Chỉ trả về câu hỏi đã viết lại, không giải thích gì thêm.

        Lịch sử:
        ${historyText}

        Câu hỏi mới: ${question}
      `;
      const response = await llm.invoke(prt);
      // Câu hỏi độc lập
      standalonePrompt = response.content.trim();
      console.log("có chạy vào đây");
    }
    console.log("standalonePrompt câu hỏi độc lập:", standalonePrompt);

    // Bước 1. Tạo vector câu hỏi
    const queryVector = await embeddings.embedQuery(standalonePrompt);

    // // Bước 2. Vector Search
    const result = await pool.query(
      `
      SELECT
          content,
          metadata,
          source_type,
          embedding <=> $1::vector AS distance
      FROM documents
      ORDER BY distance
      LIMIT 3
      `,
      [JSON.stringify(queryVector)],
    );

    // Bước 3. Ghép context
    const context = result.rows
      .map(
        (row) =>
          `
          ${row.source_type.toUpperCase()}

          ${row.content}

          Đường dẫn tới trang của sân: /stadiums/${row.metadata?.slug || ""}

      `,
      )
      .join("\n\n-----------------\n\n");

    const prompt = `
      Bạn là chatbot của website đặt sân bóng.

      Chỉ trả lời dựa trên context dưới đây.

      Nếu context không có thông tin thì trả lời:

      "Tôi không tìm thấy thông tin."

      Nếu người dùng hỏi thông tin về một sân bóng, hãy luôn đính kèm đường dẫn tới trang của sân đó (có trong context) ở cuối câu trả lời để người dùng có thể click vào xem. (Ví dụ: [Xem chi tiết sân tại đây](/stadium/...))

      Lịch sử hội thoại gần đây (dùng để trả lời tự nhiên, đúng mạch, không lặp lại thông tin đã nói):

      ${historyText || "(không có)"}

      Context:

      ${context}

      Câu hỏi:

      ${standalonePrompt}
    `;

    console.log("prompt ", prompt);
    // console.log("result.rows ", result.rows);

    // Bước 4. Gọi gemini
    const response = await llm.invoke(prompt);
    res.json({
      answer: response.content,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message,
    });
  }
};

//Hàm  tạo Vector Database sân.
module.exports.updateDocument = async (stadiumId) => {
  // Chat với mô hình Gemini (LLM) nó sẽ tự sinh ra câu trả lời
  const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");

  // Tạo embedding: biến văn bản thành vector
  const { GoogleGenerativeAIEmbeddings } =
    await import("@langchain/google-genai");

  const { RecursiveCharacterTextSplitter } =
    await import("@langchain/textsplitters");

  const { Document } = await import("@langchain/core/documents");

  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
    apiKey: process.env.GOOGLE_API_KEY,
  });

  // Xóa document cũ của sân
  await pool.query(
    `
    DELETE FROM documents
    WHERE source_type = 'stadiums'
    AND source_id = $1
    `,
    [stadiumId],
  );

  // Lấy thông tin sân
  const stadiumResult = await pool.query(
    `
    SELECT *
    FROM stadiums
    WHERE id = $1
 `,
    [stadiumId],
  );

  // Nếu sân đã bị xóa thì kết thúc
  if (stadiumResult.rows.length === 0) {
    return;
  }

  const stadium = stadiumResult.rows[0];

  // Lấy bảng giá
  const prices = await pool.query(
    `
      SELECT*
      
      FROM price_configs
      WHERE stadium_id = $1
    
      `,
    [stadiumId],
  );
  const priceText = prices.rows
    .map((p) => `${p.start_time} - ${p.end_time}: ${p.price}đ`)
    .join("\n");

  const docs = [
    new Document({
      pageContent: `
            Tên sân: 
            ${stadium.name}

            Địa chỉ: 
            ${stadium.address}
         
            Mô tả: 
            ${stadium.description}

            Tiện ích: 
            ${stadium.utility}

            Loại sân: 
            ${stadium.type}
            
            Bảng giá:
            ${priceText}
      `,
      metadata: {
        sourceType: "stadiums",
        slug: stadium.slug,
        sourceId: stadium.id,
      },
    }),
  ];

  // console.log("docs", docs);

  // Hàm chia docs:  Document dài 10000 kí tự cắt ra
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500, // cắt ra 500 ki tự ( độ dài tối đa mỗi đoạn)
    chunkOverlap: 100, // số kí tự lặp lại giữa 2 chuck liên tiếp
  });

  // Bước 3. Chia document
  const chunks = await splitter.splitDocuments(docs);
  // console.log("chunks", chunks);
  // Bước 4. Tạo embedding
  const vectors = await embeddings.embedDocuments(
    //embedDocuments: Hàm này nhận một mảng document.
    chunks.map((chunk) => chunk.pageContent),
  );
  for (let i = 0; i < chunks.length; i++) {
    await pool.query(
      `
        INSERT INTO documents
        (
          source_type,
          source_id,
          content,
          metadata,
          embedding
        )

        VALUES
        (
            $1,
            $2,
            $3,
            $4,
            $5
        )
        `,
      [
        chunks[i].metadata.sourceType, // stadium
        chunks[i].metadata.sourceId, // id sân
        chunks[i].pageContent,
        chunks[i].metadata,
        JSON.stringify(vectors[i]),
      ],
    );
  }
  console.log(`Đã cập nhật Vector DB cho sân ${stadiumId}`);
};
