const { pool } = require("../pool");



//API chat - non-streaming, có hỗ trợ history hội thoại
module.exports.chat = async (req, res) => {
  try {
    const { question, history = [] } = req.body;

    if (!question) {
      return res.status(400).json({ message: "Thiếu câu hỏi (question)." });
    }

    const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
    const { GoogleGenerativeAIEmbeddings } =
      await import("@langchain/google-genai");

    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-3.1-flash-lite",
      apiKey: process.env.GOOGLE_API_KEY,
      maxRetries: 2,
    });

    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-001",
      apiKey: process.env.GOOGLE_API_KEY,
    });

    // Chỉ giữ 3 lượt gần nhất để tiết kiệm token
    const recentHistory = history.slice(-6);
    const historyText = recentHistory
      .map((h) => `${h.role === "user" ? "Người dùng" : "Bot"}: ${h.content}`)
      .join("\n");

    // Heuristic: chỉ rewrite câu hỏi khi có từ tham chiếu ngữ cảnh + đã có history
    const contextualWords = [
      "nó", "đó", "này", "vậy", "còn", "kia", "sân đó", "cái đó",
    ];
    const needsRewrite =
      recentHistory.length > 0 &&
      contextualWords.some((w) => question.toLowerCase().includes(w));

    let standaloneQuestion = question;

    if (needsRewrite) {
      const condensePrompt = `
        Dựa vào lịch sử hội thoại và câu hỏi mới, hãy viết lại câu hỏi mới
        thành một câu hỏi độc lập, đầy đủ ngữ cảnh (không cần lịch sử vẫn hiểu được).
        Chỉ trả về câu hỏi đã viết lại, không giải thích gì thêm.

        Lịch sử:
        ${historyText}

        Câu hỏi mới: ${question}
      `;
      const rewritten = await llm.invoke(condensePrompt);
      standaloneQuestion = rewritten.content.trim();
    }

    // Bước 1. Tạo vector câu hỏi
    const queryVector = await embeddings.embedQuery(standaloneQuestion);

    // Bước 2. Vector Search
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
          
          Đường dẫn tới trang của sân: /stadium/${row.metadata?.slug || ""}
      `,
      )
      .join("\n\n-----------------\n\n");

    // Bước 4. Prompt
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

      ${question}
    `;

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